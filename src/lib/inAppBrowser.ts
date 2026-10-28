// Google blocks OAuth inside the Facebook/Instagram in-app browsers (disallowed_useragent).
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram/i.test(userAgent)
}

export function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent)
}

// Android intent link that opens the given https URL in Chrome, falling back to the same URL.
export function chromeIntentUrl(url: string): string {
  const { host, pathname, search } = new URL(url)
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
}
