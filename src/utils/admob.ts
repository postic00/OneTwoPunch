import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'
import { isTossAdSupported, showTossRewardedAd, preloadTossAd } from './tossAd'

const REWARDED_AD_ID = 'ca-app-pub-1253913975799895/1209453159'

export async function initAdMob() {
  if (isTossAdSupported()) {
    preloadTossAd()
    return
  }
  if (!Capacitor.isNativePlatform()) return
  await AdMob.initialize({ testingDevices: [], initializeForTesting: false })
}

export async function showRewardedAd(): Promise<boolean> {
  if (isTossAdSupported()) return showTossRewardedAd()
  if (!Capacitor.isNativePlatform()) return true

  try {
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID })

    return new Promise((resolve) => {
      let rewarded = false

      const listeners: Promise<{ remove: () => void }>[] = []

      const cleanup = () => {
        listeners.forEach(p => p.then(h => h.remove()))
      }

      listeners.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true
      }))

      listeners.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        cleanup()
        resolve(rewarded)
      }))

      listeners.push(AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
        cleanup()
        resolve(false)
      }))

      AdMob.showRewardVideoAd()
    })
  } catch {
    return false
  }
}
