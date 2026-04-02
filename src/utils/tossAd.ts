import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework'
import { getOperationalEnvironment } from '@apps-in-toss/web-bridge'

export function isTossEnvironment(): boolean {
  try {
    return typeof window !== 'undefined' &&
      typeof (window as unknown as Record<string, unknown>).ReactNativeWebView !== 'undefined'
  } catch {
    return false
  }
}

function getAdGroupId(): string {
  try {
    return getOperationalEnvironment() === 'sandbox'
      ? 'ait-ad-test-rewarded-id'
      : 'ait.v2.live.93ce2a2ea05b4289'
  } catch {
    return 'ait-ad-test-rewarded-id'
  }
}

function isTossAdSupported(): boolean {
  try {
    return loadFullScreenAd.isSupported() === true
  } catch {
    return false
  }
}

let adLoaded = false
let adLoading = false

export function isTossAdReady(): boolean {
  return adLoaded
}

export function preloadTossAd(): void {
  if (!isTossAdSupported()) return
  if (adLoading) return
  adLoaded = false
  adLoading = true
  loadFullScreenAd({
    options: { adGroupId: getAdGroupId() },
    onEvent: (event: { type: string }) => {
      if (event.type === 'loaded') { adLoaded = true; adLoading = false }
      if (event.type === 'failedToLoad') { adLoaded = false; adLoading = false }
    },
    onError: () => { adLoading = false },
  })
}

export function showTossRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!showFullScreenAd.isSupported()) { resolve(false); return }
    } catch { resolve(false); return }

    let rewarded = false
    let resolved = false
    const done = (result: boolean) => {
      if (resolved) return
      resolved = true
      resolve(result)
    }

    const show = () => {
      adLoaded = false
      try {
        showFullScreenAd({
          options: { adGroupId: getAdGroupId() },
          onEvent: (e: { type: string }) => {
            if (e.type === 'userEarnedReward') rewarded = true
            if (e.type === 'dismissed') {
              done(rewarded)
              preloadTossAd()
            }
            if (e.type === 'failedToShow') {
              done(false)
              preloadTossAd()
            }
          },
          onError: () => {
            done(false)
            preloadTossAd()
          },
        })
      } catch {
        done(false); preloadTossAd()
      }
    }

    if (adLoaded) {
      show()
    } else if (adLoading) {
      const poll = setInterval(() => {
        if (adLoaded) { clearInterval(poll); show() }
        else if (!adLoading) { clearInterval(poll); done(false) }
      }, 200)
    } else {
      adLoading = true
      loadFullScreenAd({
        options: { adGroupId: getAdGroupId() },
        onEvent: (event: { type: string }) => {
          if (event.type === 'loaded') { adLoaded = true; adLoading = false; show() }
          if (event.type === 'failedToLoad') { adLoading = false; done(false) }
        },
        onError: () => { adLoading = false; done(false) },
      })
    }
  })
}
