package ru.aegisarena.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.SafeBrowsingResponse;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.RequiresApi;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import java.util.Locale;

public final class MainActivity extends ComponentActivity {
    private static final int FILE_CHOOSER_REQUEST = 4107;
    private static final String STATE_OFFLINE = "state_offline";

    private WebView webView;
    private ProgressBar progressBar;
    private View loadingShell;
    private View authErrorScreen;
    private ValueCallback<Uri[]> fileCallback;
    private Uri pendingCameraUri;
    private boolean showingOffline;
    private boolean initialPageLoaded;
    private String retryUrl = BuildConfig.BASE_URL;
    private String lastAppUrl = BuildConfig.BASE_URL;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(getColor(R.color.aegis_ink));
        getWindow().setNavigationBarColor(getColor(R.color.aegis_ink));
        setContentView(R.layout.activity_main);

        View root = findViewById(R.id.app_root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
        webView = findViewById(R.id.web_view);
        progressBar = findViewById(R.id.page_progress);
        loadingShell = findViewById(R.id.loading_shell);
        authErrorScreen = findViewById(R.id.auth_error_screen);
        findViewById(R.id.auth_retry).setOnClickListener(view -> resumeNavigation(retryUrl));
        findViewById(R.id.auth_home).setOnClickListener(view -> resumeNavigation(BuildConfig.BASE_URL));
        configureWebView();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (showingOffline) {
                    finish();
                } else if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });

        if (savedInstanceState != null && webView.restoreState(savedInstanceState) != null) {
            showingOffline = savedInstanceState.getBoolean(STATE_OFFLINE, false);
            retryUrl = savedInstanceState.getString("retry_url", BuildConfig.BASE_URL);
            lastAppUrl = savedInstanceState.getString("last_app_url", BuildConfig.BASE_URL);
            if (savedInstanceState.getBoolean("steam_error", false)) {
                authErrorScreen.setVisibility(View.VISIBLE);
                webView.setVisibility(View.INVISIBLE);
            }
            finishInitialLoad(false);
            return;
        }
        loadIntentOrHome(getIntent());
    }

    @SuppressLint({"SetJavaScriptEnabled", "WebViewApiAvailability"})
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " AegisArenaAndroid/" + BuildConfig.VERSION_NAME);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            WebView.startSafeBrowsing(this, success -> { });
        }

        webView.setWebViewClient(new ArenaWebViewClient());
        webView.setWebChromeClient(new ArenaChromeClient());
    }

    private void loadIntentOrHome(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        String target = targetFromDeepLink(data);
        resumeNavigation(target == null ? BuildConfig.BASE_URL : target);
    }

    private void resumeNavigation(String target) {
        flushWebCookies();
        authErrorScreen.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        showingOffline = false;
        webView.loadUrl(target);
    }

    private void flushWebCookies() {
        CookieManager.getInstance().flush();
    }

    private String targetFromDeepLink(Uri data) {
        if (data == null) return null;
        if ("aegisarena".equals(data.getScheme())) {
            if ("retry".equals(data.getHost())) return retryUrl;
            if (!"open".equals(data.getHost())) return null;
            String path = data.getPath();
            if (path == null || path.isBlank()) path = "/home";
            String query = data.getEncodedQuery() == null ? "" : "?" + data.getEncodedQuery();
            String fragment = data.getEncodedFragment() == null ? "" : "#" + data.getEncodedFragment();
            return baseOrigin() + path + query + fragment;
        }
        return isFirstParty(data) ? data.toString() : null;
    }

    private String baseOrigin() {
        Uri base = Uri.parse(BuildConfig.BASE_URL);
        return base.getScheme() + "://" + base.getEncodedAuthority();
    }

    private boolean isFirstParty(Uri uri) {
        Uri base = Uri.parse(BuildConfig.BASE_URL);
        return uri.getHost() != null && uri.getHost().equalsIgnoreCase(base.getHost())
                && base.getScheme().equalsIgnoreCase(uri.getScheme())
                && effectivePort(uri) == effectivePort(base);
    }

    private int effectivePort(Uri uri) {
        return uri.getPort() != -1 ? uri.getPort() : "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }

    private boolean isSteamLogin(Uri uri) {
        String host = uri.getHost();
        if (host == null) return false;
        String normalized = host.toLowerCase(Locale.ROOT);
        return normalized.equals("steamcommunity.com")
                || normalized.endsWith(".steamcommunity.com")
                || normalized.equals("steampowered.com")
                || normalized.endsWith(".steampowered.com");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "Не найдено приложение для этой ссылки", Toast.LENGTH_SHORT).show();
        }
    }

    private void showOffline(Uri failedUri) {
        boolean steam = isSteamLogin(failedUri);
        Uri last = Uri.parse(lastAppUrl);
        String next = last.getEncodedPath() + (last.getEncodedQuery() == null ? "" : "?" + last.getEncodedQuery());
        retryUrl = steam ? baseOrigin() + "/api/auth/steam?next=" + Uri.encode(next) : failedUri.toString();
        showingOffline = true;
        progressBar.setVisibility(View.GONE);
        finishInitialLoad(true);
        if (steam) {
            // A native screen cannot be replaced by Chromium's late error-page commit.
            webView.setVisibility(View.INVISIBLE);
            authErrorScreen.setVisibility(View.VISIBLE);
            authErrorScreen.requestFocus();
        } else {
            webView.loadUrl("file:///android_asset/offline.html");
        }
    }

    private void finishInitialLoad(boolean immediately) {
        if (initialPageLoaded) return;
        initialPageLoaded = true;
        if (immediately) {
            loadingShell.setVisibility(View.GONE);
            return;
        }
        loadingShell.animate()
                .alpha(0f)
                .setDuration(180L)
                .withEndAction(() -> loadingShell.setVisibility(View.GONE))
                .start();
    }

    private final class ArenaWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme();
            if ("aegisarena".equals(scheme)) {
                String target = targetFromDeepLink(uri);
                if (target != null) {
                    resumeNavigation(target);
                }
                return true;
            }
            if ("http".equals(scheme) || "https".equals(scheme)) {
                if (isFirstParty(uri) || isSteamLogin(uri)) return false;
                openExternal(uri);
                return true;
            }
            openExternal(uri);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            Uri uri = Uri.parse(url);
            if (isFirstParty(uri) && uri.getPath() != null && !uri.getPath().startsWith("/api/auth/")) lastAppUrl = url;
            if (!url.startsWith("file:///android_asset/")) {
                showingOffline = authErrorScreen.getVisibility() == View.VISIBLE;
                progressBar.setVisibility(showingOffline ? View.GONE : View.VISIBLE);
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
            flushWebCookies();
            finishInitialLoad(false);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (BuildConfig.DEBUG) android.util.Log.w("AegisNavigation", "error=" + error.getErrorCode() + " main=" + request.isForMainFrame() + " host=" + request.getUrl().getHost());
            if (request.isForMainFrame() && (isFirstParty(request.getUrl()) || isSteamLogin(request.getUrl()))) {
                if (isSteamLogin(request.getUrl())) showOffline(request.getUrl());
                else view.post(() -> showOffline(request.getUrl()));
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            super.onReceivedHttpError(view, request, response);
            if (request.isForMainFrame() && isSteamLogin(request.getUrl()) && response.getStatusCode() >= 400) {
                showOffline(request.getUrl());
            }
        }

        @Override
        @RequiresApi(Build.VERSION_CODES.O_MR1)
        public void onSafeBrowsingHit(WebView view, WebResourceRequest request, int threatType, SafeBrowsingResponse callback) {
            callback.backToSafety(true);
        }
    }

    private final class ArenaChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(showingOffline || newProgress >= 100 ? View.GONE : View.VISIBLE);
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;

            Intent picker;
            try {
                picker = params.createIntent();
            } catch (ActivityNotFoundException error) {
                picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("image/*");
            }

            Intent camera = createCameraIntent();
            Intent chooser = Intent.createChooser(picker, getString(R.string.file_chooser));
            if (camera != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] { camera });
            try {
                startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                return true;
            } catch (ActivityNotFoundException error) {
                fileCallback.onReceiveValue(null);
                fileCallback = null;
                return false;
            }
        }
    }

    private Intent createCameraIntent() {
        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camera.resolveActivity(getPackageManager()) == null) return null;

        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, "aegis-evidence-" + System.currentTimeMillis() + ".jpg");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Aegis Arena");
        }
        pendingCameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (pendingCameraUri == null) return null;
        camera.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
        camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        return camera;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;

        Uri[] result = null;
        boolean usedCamera = resultCode == RESULT_OK && (data == null || data.getData() == null) && pendingCameraUri != null;
        if (usedCamera) {
            result = new Uri[] { pendingCameraUri };
        } else if (resultCode == RESULT_OK) {
            result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        }
        if (!usedCamera && pendingCameraUri != null) getContentResolver().delete(pendingCameraUri, null, null);
        pendingCameraUri = null;
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        loadIntentOrHome(intent);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        flushWebCookies();
        webView.saveState(outState);
        outState.putBoolean(STATE_OFFLINE, showingOffline);
        outState.putBoolean("steam_error", authErrorScreen.getVisibility() == View.VISIBLE);
        outState.putString("retry_url", retryUrl);
        outState.putString("last_app_url", lastAppUrl);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        flushWebCookies();
        super.onPause();
    }

    @Override
    protected void onStop() {
        flushWebCookies();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        webView.stopLoading();
        webView.destroy();
        super.onDestroy();
    }
}
