import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { showRewardedAd } from '../utils/admob'
import { isTossEnvironment, isTossAdReady, TEST_MODE } from '../utils/tossAd'

interface Props {
  onComplete: () => void
  onClose: () => void
}

export default function AdModal({ onComplete, onClose }: Props) {
  const { t } = useTranslation()
  const isNative = Capacitor.isNativePlatform() || isTossEnvironment()
  const [count, setCount] = useState(5)
  const [showEscape, setShowEscape] = useState(false)
  const [result, setResult] = useState<{ rewarded: boolean } | null>(null)
  const setAdResult = (rewarded: boolean) => setResult({ rewarded })
  const onCompleteRef = useRef(onComplete)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const [tossNotReady] = useState(() => !TEST_MODE && isTossEnvironment() && !isTossAdReady())

  useEffect(() => {
    if (isNative) {
      if (tossNotReady) return
      const escapeTimer = setTimeout(() => setShowEscape(true), 5000)
      showRewardedAd().then(rewarded => {
        clearTimeout(escapeTimer)
        setTimeout(() => setAdResult(rewarded), 500)
      }).catch(() => { clearTimeout(escapeTimer); setAdResult(false) })
      return
    }

    if (count <= 0) { setAdResult(true); return } // eslint-disable-line react-hooks/set-state-in-effect
    const t = setTimeout(() => setCount(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [count, isNative]) // eslint-disable-line react-hooks/exhaustive-deps

  if (tossNotReady) return (
    <div className="ad-modal-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={e => e.stopPropagation()}>
        <div className="ad-box">
          <span className="ad-icon">⏳</span>
          <span className="ad-text">{t('ad.preparing')}</span>
        </div>
        <button className="ad-skip-btn" onClick={onClose}>{t('ad.close')}</button>
      </div>
    </div>
  )

  if (result !== null) return (
    <div className="ad-modal-overlay">
      <div className="ad-modal">
        <div className="ad-box">
          <span className="ad-icon">{result.rewarded ? '🎉' : '😢'}</span>
          <span className="ad-text">
            {result.rewarded ? t('ad.rewardOk') : t('ad.rewardFail')}
          </span>
        </div>
        <button
          className="ad-confirm-btn"
          onClick={() => result.rewarded ? onCompleteRef.current() : onCloseRef.current()}
        >{t('ad.confirm')}</button>
      </div>
    </div>
  )

  if (isNative) return (
    <div className="ad-modal-overlay">
      <div className="ad-spinner" />
      {showEscape && (
        <button className="ad-skip-btn" style={{ position: 'absolute', bottom: 40 }}
          onClick={() => setAdResult(false)}>{t('ad.close')}</button>
      )}
    </div>
  )

  return (
    <div className="ad-modal-overlay">
      <div className="ad-modal">
        <div className="ad-box">
          <span className="ad-icon">📺</span>
          <span className="ad-text">{t('ad.watching')}</span>
          <span className="ad-count">{count}</span>
        </div>
        <button className="ad-skip-btn" onClick={() => setAdResult(false)}>{t('ad.skip')}</button>
      </div>
    </div>
  )
}
