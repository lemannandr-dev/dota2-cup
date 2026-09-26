export function isIosDevice(userAgent: string, platform = '', maxTouchPoints = 0) {
	return /iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function isStandaloneDisplay(mediaStandalone: boolean, navigatorStandalone = false) {
	return mediaStandalone || navigatorStandalone;
}
