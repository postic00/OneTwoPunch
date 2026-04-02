import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework'

const AD_GROUP_ID = 'ait.v2.live.93ce2a2ea05b4289'

export function isTossAdSupported(): boolean {
  try {
    return loadFullScreenAd.isSupported()
  } catch {
    return false
  }
}

export function preloadTossAd(): void {
  if (!isTossAdSupported()) return
  loadFullScreenAd({
    options: { adGroupId: AD_GROUP_ID },
    onEvent: () => {},
    onError: () => {},
  })
}

export function showTossRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isTossAdSupported()) {
      resolve(true)
      return
    }
    let rewarded = false
    showFullScreenAd({
      options: { adGroupId: AD_GROUP_ID },
      onEvent: (event) => {
        if (event.type === 'userEarnedReward') rewarded = true
        if (event.type === 'dismissed') {
          preloadTossAd()
          resolve(rewarded)
        }
      },
      onError: () => resolve(false),
    })
  })
}
