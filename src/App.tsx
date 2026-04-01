import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'

type Side = 'LEFT' | 'RIGHT'
type GameState = 'IDLE' | 'SETTINGS' | 'PLAYING' | 'GAMEOVER'

const MAX_LIVES = 5
const INITIAL_TIME = 3000
const MIN_TIME = 300
const INITIAL_DECREASE = 30
const MIN_DECREASE = 1
const CHARGE_INTERVAL_MS = 10 * 60 * 1000 // 10분

// 광고 시청 후 콜백 호출 (실제 AdMob 등 연동 시 여기를 교체)
function showAd(onRewarded: () => void) {
  // TODO: Capacitor AdMob 플러그인 연동
  onRewarded()
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('IDLE')
  const [lives, setLives] = useState(() => {
    const s = localStorage.getItem('boxing_lives')
    return s !== null ? Math.min(MAX_LIVES, Number(s)) : MAX_LIVES
  })
  const [blockSide, setBlockSide] = useState<Side>('LEFT')
  const [timeLimit, setTimeLimit] = useState(INITIAL_TIME)
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME)
  const [score, setScore] = useState(0)
  const [flash, setFlash] = useState<'HIT' | 'MISS' | null>(null)
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem('boxing_best') ?? 0))
  const [combo, setCombo] = useState(0)
  const [hitEffectKey, setHitEffectKey] = useState(0)
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('boxing_sound') !== 'off')
  const [vibrationOn, setVibrationOn] = useState(() => localStorage.getItem('boxing_vibration') !== 'off')
  const [nextChargeTime, setNextChargeTime] = useState<number>(() => {
    const s = localStorage.getItem('boxing_next_charge')
    return s ? Number(s) : 0
  })
  const [chargeCountdown, setChargeCountdown] = useState(0)
  const [usedContinue, setUsedContinue] = useState(false)

  const soundRef = useRef(soundOn)
  const vibrationRef = useRef(vibrationOn)
  soundRef.current = soundOn
  vibrationRef.current = vibrationOn

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)

  const stateRef = useRef<GameState>('IDLE')
  const blockRef = useRef<Side>('LEFT')
  const livesRef = useRef(lives)
  const timeLimitRef = useRef(INITIAL_TIME)
  const scoreRef = useRef(0)
  const nextChargeTimeRef = useRef(nextChargeTime)
  const timeDecreaseRef = useRef(INITIAL_DECREASE)
  stateRef.current = gameState
  blockRef.current = blockSide
  livesRef.current = lives
  timeLimitRef.current = timeLimit
  scoreRef.current = score
  nextChargeTimeRef.current = nextChargeTime

  // lives 변경 시 localStorage 저장 + 자동충전 타이머 설정
  useEffect(() => {
    localStorage.setItem('boxing_lives', String(lives))
    if (lives >= MAX_LIVES) {
      if (nextChargeTimeRef.current !== 0) {
        nextChargeTimeRef.current = 0
        setNextChargeTime(0)
        localStorage.removeItem('boxing_next_charge')
      }
    } else if (nextChargeTimeRef.current === 0) {
      const t = Date.now() + CHARGE_INTERVAL_MS
      nextChargeTimeRef.current = t
      setNextChargeTime(t)
      localStorage.setItem('boxing_next_charge', String(t))
    }
  }, [lives])

  // 자동충전 카운트다운 틱
  useEffect(() => {
    const tick = setInterval(() => {
      const nct = nextChargeTimeRef.current
      if (nct === 0) { setChargeCountdown(0); return }
      const now = Date.now()
      if (now >= nct) {
        setLives(prev => {
          const next = Math.min(MAX_LIVES, prev + 1)
          livesRef.current = next
          if (next < MAX_LIVES) {
            const t = now + CHARGE_INTERVAL_MS
            nextChargeTimeRef.current = t
            setNextChargeTime(t)
            localStorage.setItem('boxing_next_charge', String(t))
          } else {
            nextChargeTimeRef.current = 0
            setNextChargeTime(0)
            localStorage.removeItem('boxing_next_charge')
          }
          return next
        })
        setChargeCountdown(0)
      } else {
        setChargeCountdown(Math.ceil((nct - now) / 1000))
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  const saveBest = useCallback((s: number) => {
    setBestScore(prev => {
      const next = Math.max(prev, s)
      localStorage.setItem('boxing_best', String(next))
      return next
    })
  }, [])

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const nextRound = useCallback((tl: number) => {
    const newBlock: Side = Math.random() < 0.5 ? 'LEFT' : 'RIGHT'
    setBlockSide(newBlock)
    blockRef.current = newBlock
    setTimeLeft(tl)
    startTimeRef.current = performance.now()
    setTimeout(() => setFlash(null), 350)

    timerRef.current = setTimeout(() => {
      if (vibrationRef.current) navigator.vibrate?.([80, 30, 80])
      setCombo(0)
      setFlash('MISS')
      const newLives = livesRef.current - 1
      setLives(newLives)
      livesRef.current = newLives
      saveBest(scoreRef.current)
      setGameState('GAMEOVER')
    }, tl)

    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current
      setTimeLeft(Math.max(0, tl - elapsed))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [saveBest])

  const handlePunch = useCallback((side: Side) => {
    if (stateRef.current !== 'PLAYING') return
    clearTimers()

    if (side !== blockRef.current) {
      setFlash('HIT')
      setHitEffectKey(k => k + 1)
      setCombo(c => c + 1)
      if (vibrationRef.current) navigator.vibrate?.(30)
      const newScore = scoreRef.current + 1
      setScore(newScore)
      scoreRef.current = newScore
      const decrease = timeDecreaseRef.current
      timeDecreaseRef.current = Math.max(MIN_DECREASE, decrease - 1)
      const newTl = Math.max(MIN_TIME, timeLimitRef.current - decrease)
      setTimeLimit(newTl)
      timeLimitRef.current = newTl
      nextRound(newTl)
    } else {
      setFlash('MISS')
      setCombo(0)
      if (vibrationRef.current) navigator.vibrate?.([80, 30, 80])
      const newLives = livesRef.current - 1
      setLives(newLives)
      livesRef.current = newLives
      saveBest(scoreRef.current)
      setGameState('GAMEOVER')
    }
  }, [clearTimers, nextRound, saveBest])

  const startGame = useCallback(() => {
    clearTimers()
    setTimeLimit(INITIAL_TIME)
    setScore(0)
    setFlash(null)
    setCombo(0)
    setUsedContinue(false)
    setGameState('PLAYING')
    timeLimitRef.current = INITIAL_TIME
    timeDecreaseRef.current = INITIAL_DECREASE
    scoreRef.current = 0
    setTimeout(() => nextRound(INITIAL_TIME), 100)
  }, [clearTimers, nextRound])

  const continueGame = useCallback(() => {
    showAd(() => {
      setUsedContinue(true)
      clearTimers()
      setFlash(null)
      setGameState('PLAYING')
      setTimeout(() => nextRound(timeLimitRef.current), 100)
    })
  }, [clearTimers, nextRound])

  const handleAdCharge = useCallback(() => {
    showAd(() => {
      const next = livesRef.current + 1
      setLives(next)
      livesRef.current = next
    })
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const timerPct = timeLeft / timeLimit

  const livesBlock = (
    <div className="lives-row">
      <div className="lives-display">
        {Array.from({ length: MAX_LIVES }).map((_, i) => (
          <span key={i} className={`hp-heart ${i < lives ? 'active' : 'empty'}`}>🥊</span>
        ))}
        <span className="hp-text">{lives}/{MAX_LIVES}</span>
      </div>
      <button className="charge-btn" onClick={handleAdCharge}>
        <span>📺 충전</span>
        {lives < MAX_LIVES && chargeCountdown > 0 && (
          <span className="charge-timer-inline">
            {Math.floor(chargeCountdown / 60)}:{String(chargeCountdown % 60).padStart(2, '0')}
          </span>
        )}
      </button>
    </div>
  )

  if (gameState === 'SETTINGS') {
    return (
      <div className="home">
        <div className="home-title">설정</div>
        <div className="settings-list">
          <div className="settings-row">
            <span>🔊 소리</span>
            <button
              className={`toggle ${soundOn ? 'on' : 'off'}`}
              onClick={() => setSoundOn(v => { const next = !v; localStorage.setItem('boxing_sound', next ? 'on' : 'off'); return next })}
            >{soundOn ? 'ON' : 'OFF'}</button>
          </div>
          <div className="settings-row">
            <span>📳 진동</span>
            <button
              className={`toggle ${vibrationOn ? 'on' : 'off'}`}
              onClick={() => setVibrationOn(v => { const next = !v; localStorage.setItem('boxing_vibration', next ? 'on' : 'off'); return next })}
            >{vibrationOn ? 'ON' : 'OFF'}</button>
          </div>
        </div>
        <button className="overlay-btn" onClick={() => setGameState('IDLE')}>돌아가기</button>
      </div>
    )
  }

  if (gameState === 'IDLE') {
    return (
      <div className="home">
        <div className="best-score">⚡ 최고 점수: {bestScore} ⚡</div>
        <div className="home-bottom">
          {livesBlock}
<button className="start-btn" onClick={startGame}>시작하기</button>
          <button className="settings-btn" onClick={() => setGameState('SETTINGS')}>⚙ 설정</button>
        </div>
      </div>
    )
  }

  return (
    <div className="game">
      <div className="hp-bar">
        <div className="score-info">타격: {score}</div>
      </div>

      <div key={hitEffectKey} className={`opponent ${flash === 'MISS' ? 'miss' : ''}`}>
        <div className="combo-wrap">
          {flash === 'HIT' && <span key={hitEffectKey} className="hit-effect">💥</span>}
          {combo >= 2 && <div className="combo">{combo} COMBO!</div>}
        </div>
        <div className="boxer-row">
          <img src="/asset/2_glove.png" className={`glove left ${gameState === 'PLAYING' && blockSide === 'LEFT' ? 'blocking' : ''}`} />
          <img src="/asset/10_char.png" className="boxer-body" />
          <img src="/asset/2_glove_r.png" className={`glove right ${gameState === 'PLAYING' && blockSide === 'RIGHT' ? 'blocking' : ''}`} />
        </div>
      </div>

      <div className={`timer-bar-wrap ${blockSide === 'LEFT' ? 'right' : 'left'} ${flash === 'HIT' ? 'hidden' : ''}`}>
        <div
          className={`timer-bar-fill ${timerPct < 0.3 ? 'danger' : ''}`}
          style={{ height: `${timerPct * 100}%` }}
        />
      </div>

      <div className="controls">
        <button className="punch-btn left-btn" onPointerDown={() => handlePunch('LEFT')}>
          <img src="/asset/2_glove.png" className="btn-glove" />
        </button>
        <button className="punch-btn right-btn" onPointerDown={() => handlePunch('RIGHT')}>
          <img src="/asset/2_glove_r.png" className="btn-glove" />
        </button>
      </div>

      {gameState === 'GAMEOVER' && (
        <div className="overlay">
          <h1>MISS!</h1>
          <p>점수: {score}</p>
          {!usedContinue && (
            <button className="overlay-btn" onClick={continueGame}>📺 이어하기</button>
          )}
<button className="overlay-btn-sub" onClick={() => { clearTimers(); setGameState('IDLE') }}>홈으로</button>
        </div>
      )}
    </div>
  )
}
