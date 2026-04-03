import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'
import { Capacitor } from '@capacitor/core'
import { initAdMob } from './utils/admob'
import { isTossEnvironment } from './utils/tossAd'
import AdModal from './components/AdModal'

function isAndroid() { return Capacitor.getPlatform() === 'android' }

if (typeof window !== 'undefined' && (isTossEnvironment() || isAndroid())) {
  document.documentElement.style.setProperty('--safe-area-inset-top', '0px')
  document.documentElement.style.setProperty('--safe-area-inset-bottom', '0px')
}

type Side = 'LEFT' | 'RIGHT'
type GameState = 'IDLE' | 'SETTINGS' | 'PLAYING' | 'GAMEOVER'

const MAX_LIVES = 5
const AD_MAX_LIVES = 20
const INITIAL_TIME = 300000
const MIN_TIME = 300
const MIN_DECREASE = 1
const CHARGE_INTERVAL_MS = 10 * 60 * 1000 // 10분

// 스테이지 누적 타격 임계값 (10개 스테이지)
const STAGE_THRESHOLDS = [0, 40, 90, 150, 220, 300, 390, 490, 600, 720]

const TAUNT_MISS = [
  '눈 뜨고 치셨어요?', '완전 반대잖아요', '왼오른쪽도 모르세요?',
  '일부러 그런 건 아니죠?', '어디 보고 치셨어요?', '반대 아닌가요?',
  '그냥 아무데나 치셨죠?', '잘못 건드리셨어요', '손이 두 개 맞아요?',
  '저 방어 안 했는데요?', '실수도 너무하네요', '다음엔 제대로 좀요',
  '방향감각 없으신가요?', '그쪽이 아닌데요?', '막힌 쪽을 왜 치세요?',
]
const TAUNT_TIMEOUT = [
  '구경하러 오셨어요?', '낮잠 주무셨어요?', '손이 굳으셨나요?',
  '잠깐 자셨어요?', '반응속도가 문제네요', '느릿느릿하시네요',
  '좀 더 빨리요', '기회를 날려버리셨네요', '생각이 너무 많으시네요',
  '구경만 하실 건가요?', '시간이 넉넉했는데요?', '너무 여유롭네요',
  '1초도 못 버티셨어요?', '좀 서둘러 주세요', '보고만 계셨어요?',
]
function randomTaunt(isMiss: boolean) {
  const arr = isMiss ? TAUNT_MISS : TAUNT_TIMEOUT
  return arr[Math.floor(Math.random() * arr.length)]
}

function getStage(score: number): number {
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= STAGE_THRESHOLDS[i]) return i + 1
  }
  return 1
}

function isOverHalfStage(score: number): boolean {
  const stage = getStage(score)
  const stageStart = STAGE_THRESHOLDS[stage - 1]
  const stageLength = 40 + (stage - 1) * 10
  return score >= stageStart + stageLength / 2
}

// Web Audio
let _ac: AudioContext | null = null
function getAC() {
  if (!_ac) _ac = new AudioContext()
  if (_ac.state === 'suspended') _ac.resume()
  return _ac
}
function playHit() {
  const ac = getAC()
  // 저주파 둔탁한 타격음
  const osc = ac.createOscillator(); const g = ac.createGain()
  osc.connect(g); g.connect(ac.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(160, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.2)
  g.gain.setValueAtTime(0.8, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25)
  osc.start(); osc.stop(ac.currentTime + 0.25)
  // 노이즈 버스트 (저역통과)
  const bufSize = Math.floor(ac.sampleRate * 0.08)
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
  const noise = ac.createBufferSource(); noise.buffer = buf
  const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 350
  const ng = ac.createGain()
  ng.gain.setValueAtTime(0.5, ac.currentTime)
  ng.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08)
  noise.connect(filter); filter.connect(ng); ng.connect(ac.destination)
  noise.start()
}
function playMiss() {
  const ac = getAC()
  const osc = ac.createOscillator(); const g = ac.createGain()
  osc.connect(g); g.connect(ac.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(300, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.3)
  g.gain.setValueAtTime(0.35, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)
  osc.start(); osc.stop(ac.currentTime + 0.3)
}
function playCombo(combo: number) {
  const ac = getAC()
  const freq = Math.min(1200, 440 + combo * 15)
  const osc = ac.createOscillator(); const g = ac.createGain()
  osc.connect(g); g.connect(ac.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, ac.currentTime)
  g.gain.setValueAtTime(0.2, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12)
  osc.start(); osc.stop(ac.currentTime + 0.12)
}
function playGameOver() {
  const ac = getAC()
  ;[400, 280, 180].forEach((freq, i) => {
    const osc = ac.createOscillator(); const g = ac.createGain()
    osc.connect(g); g.connect(ac.destination)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, ac.currentTime + i * 0.18)
    g.gain.setValueAtTime(0.3, ac.currentTime + i * 0.18)
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.18 + 0.18)
    osc.start(ac.currentTime + i * 0.18); osc.stop(ac.currentTime + i * 0.18 + 0.18)
  })
}
function playClick() {
  const ac = getAC()
  const osc = ac.createOscillator(); const g = ac.createGain()
  osc.connect(g); g.connect(ac.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(900, ac.currentTime)
  g.gain.setValueAtTime(0.1, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05)
  osc.start(); osc.stop(ac.currentTime + 0.05)
}


export default function App() {
  const [gameState, setGameState] = useState<GameState>('IDLE')
  const [lives, setLives] = useState(() => {
    const s = localStorage.getItem('boxing_lives')
    return s !== null ? Math.min(AD_MAX_LIVES, Number(s)) : MAX_LIVES
  })
  const [blockSide, setBlockSide] = useState<Side>('LEFT')
  const [timeLimit, setTimeLimit] = useState(INITIAL_TIME)
  const timerBarRef = useRef<HTMLDivElement>(null)
  const timerDangerRef = useRef(false)
  const [score, setScore] = useState(0)
  const [flash, setFlash] = useState<'HIT' | 'MISS' | null>(null)
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem('boxing_best') ?? 0))
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [hitEffectKey, setHitEffectKey] = useState(0)
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('boxing_sound') !== 'off')
  const [vibrationOn, setVibrationOn] = useState(() => localStorage.getItem('boxing_vibration') !== 'off')
  const [nextChargeTime, setNextChargeTime] = useState<number>(() => {
    const s = localStorage.getItem('boxing_next_charge')
    return s ? Number(s) : 0
  })
  const [chargeCountdown, setChargeCountdown] = useState(0)
  const [usedContinue, setUsedContinue] = useState(false)
  const [adModal, setAdModal] = useState<'continue' | 'charge' | null>(null)
  const [isNewBest, setIsNewBest] = useState(false)
  const [tauntMsg, setTauntMsg] = useState('')
  const [recordMsg, setRecordMsg] = useState('')

  const soundRef = useRef(soundOn)
  const vibrationRef = useRef(vibrationOn)
  soundRef.current = soundOn
  vibrationRef.current = vibrationOn

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)

  const stateRef = useRef<GameState>('IDLE')
  const blockRef = useRef<Side>('LEFT')
  const livesRef = useRef(lives)
  const timeLimitRef = useRef(INITIAL_TIME)
  const scoreRef = useRef(0)
  const nextChargeTimeRef = useRef(nextChargeTime)
  const timeDecreaseRef = useRef(30)
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
        const elapsed = Math.floor((now - nct) / CHARGE_INTERVAL_MS) + 1
        setLives(prev => {
          const next = Math.min(MAX_LIVES, prev + elapsed)
          livesRef.current = next
          if (next < MAX_LIVES) {
            const t = nct + elapsed * CHARGE_INTERVAL_MS
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
    const prevBest = Number(localStorage.getItem('boxing_best') ?? 0)
    if (s > prevBest) {
      setIsNewBest(true)
      const all = [...TAUNT_MISS, ...TAUNT_TIMEOUT]
      setRecordMsg(all[Math.floor(Math.random() * all.length)])
      setBestScore(s)
      localStorage.setItem('boxing_best', String(s))
    }
  }, [])

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (flashResetRef.current) clearTimeout(flashResetRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const nextRound = useCallback((tl: number) => {
    const newBlock: Side = Math.random() < 0.5 ? 'LEFT' : 'RIGHT'
    setBlockSide(newBlock)
    blockRef.current = newBlock
    if (timerBarRef.current) timerBarRef.current.style.height = '100%'
    startTimeRef.current = performance.now()
    flashResetRef.current = setTimeout(() => setFlash(null), 350)

    timerRef.current = setTimeout(() => {
      if (vibrationRef.current) navigator.vibrate?.([80, 30, 80])
      setCombo(0)
      setFlash('MISS')
      setTauntMsg(randomTaunt(false))
      const newLives = Math.max(0, livesRef.current - 1)
      setLives(newLives)
      livesRef.current = newLives
      saveBest(scoreRef.current)
      if (soundRef.current) playGameOver()
      setGameState('GAMEOVER')
    }, tl)

    timerDangerRef.current = false
    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current
      const pct = Math.max(0, (tl - elapsed) / tl)
      if (timerBarRef.current) {
        timerBarRef.current.style.height = `${pct * 100}%`
        const isDanger = pct < 0.3
        if (isDanger !== timerDangerRef.current) {
          timerDangerRef.current = isDanger
          timerBarRef.current.classList.toggle('danger', isDanger)
        }
      }
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
      const elapsed = performance.now() - startTimeRef.current
      const tooSlow = elapsed > timeLimitRef.current * 0.5
      if (tooSlow) {
        setCombo(0)
        if (soundRef.current) playHit()
      } else {
        setCombo(c => {
          const next = c + 1
          setMaxCombo(m => Math.max(m, next))
          if (soundRef.current) next >= 10 ? playCombo(next) : playHit()
          return next
        })
      }
      if (vibrationRef.current) navigator.vibrate?.(30)
      const newScore = scoreRef.current + 1
      setScore(newScore)
      scoreRef.current = newScore
      const stage = getStage(newScore)
      const decrease = Math.max(MIN_DECREASE, 25 + stage * 5)
      timeDecreaseRef.current = decrease
      const newTl = Math.max(MIN_TIME, timeLimitRef.current - decrease)
      setTimeLimit(newTl)
      timeLimitRef.current = newTl
      nextRound(newTl)
    } else {
      setFlash('MISS')
      setCombo(0)
      setTauntMsg(randomTaunt(true))
      if (soundRef.current) playMiss()
      if (vibrationRef.current) navigator.vibrate?.([80, 30, 80])
      const newLives = Math.max(0, livesRef.current - 1)
      setLives(newLives)
      livesRef.current = newLives
      saveBest(scoreRef.current)
      if (soundRef.current) playGameOver()
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
    setIsNewBest(false)
    setMaxCombo(0)
    setGameState('PLAYING')
    timeLimitRef.current = INITIAL_TIME
    timeDecreaseRef.current = 30
    scoreRef.current = 0
    setTimeout(() => nextRound(INITIAL_TIME), 100)
  }, [clearTimers, nextRound])

  const continueGame = useCallback(() => {
    setAdModal('continue')
  }, [clearTimers, nextRound])

  const handleAdCharge = useCallback(() => {
    setAdModal('charge')
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])
  useEffect(() => { initAdMob() }, [])


  const livesBlock = (
    <div className="lives-row">
      <div className="lives-display">
        <div className="hp-hearts">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`hp-heart ${i < lives ? 'active' : 'empty'}`}>🥊</span>
          ))}
        </div>
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
      <div className="home" style={isAndroid() ? { height: '100vh', boxSizing: 'border-box', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', overflow: 'hidden' } : undefined}>
        <div className="home-bottom">
          <div className="settings-list">
            <div className="settings-row">
              <span>🔊 소리</span>
              <button
                className={`toggle ${soundOn ? 'on' : 'off'}`}
                onClick={() => setSoundOn(v => { const next = !v; localStorage.setItem('boxing_sound', next ? 'on' : 'off'); if (next) playClick(); return next })}
              >{soundOn ? 'ON' : 'OFF'}</button>
            </div>
            <div className="settings-row">
              <span>📳 진동</span>
              <button
                className={`toggle ${vibrationOn ? 'on' : 'off'}`}
                onClick={() => setVibrationOn(v => { const next = !v; localStorage.setItem('boxing_vibration', next ? 'on' : 'off'); if (next) navigator.vibrate?.(100); return next })}
              >{vibrationOn ? 'ON' : 'OFF'}</button>
            </div>
          </div>
          <button className="start-btn" onClick={() => setGameState('IDLE')}>돌아가기</button>
        </div>
      </div>
    )
  }

  if (gameState === 'IDLE') {
    return (
      <>
        <div className="home" style={isAndroid() ? { height: '100vh', boxSizing: 'border-box', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', overflow: 'hidden' } : undefined}>
          <div className="best-score">⚡ 최고 점수: {bestScore} ⚡</div>
          <div className="home-bottom">
            {livesBlock}
            <button className="start-btn" onClick={() => { if (soundOn) playClick(); startGame() }} disabled={lives === 0}>시작하기</button>
            <button className="settings-btn" onClick={() => setGameState('SETTINGS')}>⚙ 설정</button>
          </div>
        </div>
        {adModal === 'charge' && (
          <AdModal
            onComplete={() => {
              setAdModal(null)
              if (livesRef.current >= AD_MAX_LIVES) return
              const next = livesRef.current + 1
              setLives(next)
              livesRef.current = next
            }}
            onClose={() => setAdModal(null)}
          />
        )}
      </>
    )
  }

  return (
    <>
    <div className="game" style={isAndroid() ? { height: '100vh', boxSizing: 'border-box', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', overflow: 'hidden' } : undefined}>
      <div className="hp-bar">
        <div className="score-info">타격: {score}</div>
      </div>

      <div key={hitEffectKey} className={`opponent ${flash === 'MISS' ? 'miss' : ''}`}>
        <div className="combo-wrap">
          {flash === 'HIT' && <span key={hitEffectKey} className="hit-effect">💥</span>}
          {combo >= 10 && <div className="combo" style={{ fontSize: `${Math.min(45, 15 + Math.floor((combo - 10) / 5))}px` }}>{combo} COMBO!</div>}
        </div>
        <div className="boxer-row">
          <img src="/asset/2_glove.png" className={`glove left ${gameState === 'PLAYING' && blockSide === 'LEFT' ? 'blocking' : ''}`} />
          <img src={`/asset/${getStage(score) + 9}_char.png`} className="boxer-body" />
          <img src="/asset/2_glove_r.png" className={`glove right ${gameState === 'PLAYING' && blockSide === 'RIGHT' ? 'blocking' : ''}`} />
          {isOverHalfStage(score) && (
            <svg className="sweat-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
              <ellipse className="sweat-drop d1" cx="50" cy="10" rx="3.5" ry="5.5" fill="#7ec8e3" opacity="0.9"/>
              <ellipse className="sweat-drop d2" cx="50" cy="10" rx="3" ry="5" fill="#7ec8e3" opacity="0.9"/>
              <ellipse className="sweat-drop d3" cx="50" cy="10" rx="3.5" ry="5.5" fill="#7ec8e3" opacity="0.9"/>
              <ellipse className="sweat-drop d4" cx="50" cy="10" rx="3" ry="5" fill="#7ec8e3" opacity="0.9"/>
            </svg>
          )}
        </div>
      </div>

      <div className={`timer-bar-wrap ${blockSide === 'LEFT' ? 'right' : 'left'} ${flash === 'HIT' ? 'hidden' : ''}`}>
        <div
          ref={timerBarRef}
          className="timer-bar-fill"
          style={{ height: '100%' }}
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
          <div className="overlay-content">
            <div className="gameover-newbest">
              {isNewBest && <p className="gameover-record">{recordMsg}</p>}
              <p className="gameover-taunt">{tauntMsg}</p>
            </div>
            <p className="gameover-reason">{flash === 'MISS' ? '잘못 쳤어요!' : '시간 초과!'}</p>
            <div className="score-info">타격: {score}</div>
            <p className="gameover-combo">최대 콤보: {maxCombo}</p>
            {!usedContinue && (
              <button className="overlay-btn" onClick={continueGame}>📺 이어하기</button>
            )}
            <button className="overlay-btn-sub" onClick={() => { clearTimers(); setGameState('IDLE') }}>홈으로</button>
          </div>
        </div>
      )}
    </div>
    {adModal === 'continue' && (
      <AdModal
        onComplete={() => {
          setAdModal(null)
          setUsedContinue(true)
          clearTimers()
          setFlash(null)
          setGameState('PLAYING')
          setTimeout(() => nextRound(timeLimitRef.current), 100)
        }}
        onClose={() => setAdModal(null)}
      />
    )}
    {adModal === 'charge' && (
      <AdModal
        onComplete={() => {
          setAdModal(null)
          if (livesRef.current >= AD_MAX_LIVES) return
          const next = livesRef.current + 1
          setLives(next)
          livesRef.current = next
        }}
        onClose={() => setAdModal(null)}
      />
    )}
    </>
  )
}
