import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'
import { isTossEnvironment, showTossRewardedAd, preloadTossAd, TEST_MODE } from './tossAd'

const REWARDED_AD_ID = 'ca-app-pub-1253913975799895/1209453159'

export async function initAdMob() {
  if (isTossEnvironment()) {
    preloadTossAd()
    return
  }
  if (!Capacitor.isNativePlatform()) return
  await AdMob.initialize({ testingDevices: [], initializeForTesting: TEST_MODE })
}

export async function showRewardedAd(): Promise<boolean> {
  if (TEST_MODE) return new Promise(resolve => setTimeout(() => resolve(true), 1500))
  if (isTossEnvironment()) return showTossRewardedAd()
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
