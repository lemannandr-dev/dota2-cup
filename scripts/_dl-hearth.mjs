import https from "node:https";
import fs from "node:fs";
const urls = [
  "https://commons.wikimedia.org/wiki/Special:FilePath/Dark_brown_firewood_texture_(Unsplash_kFxWDfj0pD8).jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Dark_brown_firewood_texture_%28Unsplash_kFxWDfj0pD8%29.jpg/1280px-Dark_brown_firewood_texture_%28Unsplash_kFxWDfj0pD8%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/1/16/Dark_brown_firewood_texture_%28Unsplash_kFxWDfj0pD8%29.jpg"
];
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "AegisArena/1.0 (local build; atmosphere CC0 cache)", Accept: "image/*" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        get(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(url + " -> " + res.statusCode));
        res.resume();
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}
for (const url of urls) {
  try {
    const buf = await get(url);
    if (buf.length < 20000) throw new Error("small " + buf.length);
    fs.writeFileSync("public/atmosphere/hearth.jpg", buf);
    console.log("OK", url, buf.length);
    process.exit(0);
  } catch (e) {
    console.error("FAIL", e.message);
  }
}
process.exit(1);
