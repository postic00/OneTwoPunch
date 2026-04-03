import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'
import { Capacitor } from '@capacitor/core'
import { initAdMob } from './utils/admob'
import { isTossEnvironment } from './utils/tossAd'
import AdModal from './components/AdModal'
import * as faceapi from 'face-api.js'

function isAndroid() { return Capacitor.getPlatform() === 'android' }

if (typeof window !== 'undefined' && (isTossEnvironment() || isAndroid())) {
  document.documentElement.style.setProperty('--safe-area-inset-top', '0px')
  document.documentElement.style.setProperty('--safe-area-inset-bottom', '0px')
}

type Side = 'LEFT' | 'RIGHT'
type GameState = 'IDLE' | 'SETTINGS' | 'PLAYING' | 'GAMEOVER'

const MAX_LIVES = 5
const AD_MAX_LIVES = 20
const INITIAL_TIME = 3000000 // 테스트용 3000초, 배포 시 3000으로 변경
const MIN_TIME = 300
const MIN_DECREASE = 2
const CHARGE_INTERVAL_MS = 10 * 60 * 1000 // 10분

// 스테이지 누적 타격 임계값 (10개 스테이지)
const STAGE_THRESHOLDS = [0, 40, 90, 150, 220, 300, 390, 490, 600, 720]

// 동물별 난이도 1~5 (1=쉬움, 5=어려움)
const ANIMAL_NAMES: Record<number, string> = {
  1: '강아지', 2: '곰', 3: '여우', 4: '판다',
  5: '토끼', 6: '호랑이', 7: '원숭이', 8: '고양이', 9: '돼지',
}
const ANIMAL_DIFFICULTY: Record<number, number> = {
  1: 2, 2: 3, 3: 4, 4: 1, 5: 1, 6: 5, 7: 4, 8: 2, 9: 2,
}
// 동물별 구멍 위치 오버라이드 (512 기준)
const MASK_MOUTH_OVERRIDE: Record<number, { cy: number; rx: number; ry: number }> = {
  9: { cy: 368, rx: 42, ry: 30 }, // 돼지: 주둥이 안쪽으로 내림
}
const DIFFICULTY_SETTINGS: Record<number, { initialTime: number; timeDecrease: number }> = {
  1: { initialTime: 3500, timeDecrease: 30 },
  2: { initialTime: 3000, timeDecrease: 30 },
  3: { initialTime: 2500, timeDecrease: 30 },
  4: { initialTime: 2000, timeDecrease: 30 },
  5: { initialTime: 1500, timeDecrease: 30 },
}

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

function isOverThirdStage(score: number): boolean {
  const stage = getStage(score)
  const stageStart = STAGE_THRESHOLDS[stage - 1]
  const stageLength = 40 + (stage - 1) * 10
  return score >= stageStart + stageLength / 3
}

function isOverTwoThirdsStage(score: number): boolean {
  const stage = getStage(score)
  const stageStart = STAGE_THRESHOLDS[stage - 1]
  const stageLength = 40 + (stage - 1) * 10
  return score >= stageStart + (stageLength * 2) / 3
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
  const [nextChargeTime, setNextChargeTime] = useState<number>(() => {
    const s = localStorage.getItem('boxing_next_charge')
    return s ? Number(s) : 0
  })
  const [chargeCountdown, setChargeCountdown] = useState(0)
  const [usedContinue, setUsedContinue] = useState(false)
  const [adModal, setAdModal] = useState<'continue' | 'charge' | null>(null)
  const [charStage, setCharStage] = useState(1)
  const [charAnim, setCharAnim] = useState<'idle' | 'exit-left' | 'exit-right' | 'exit-down' | 'enter-left' | 'enter-right' | 'enter-top'>('idle')
  const charTransitioning = useRef(false)
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('boxing_tutorial_done'))
  const [showInfiniteSetup, setShowInfiniteSetup] = useState(false)
  const [infiniteLoading, setInfiniteLoading] = useState(false)
  const [infiniteProgress, setInfiniteProgress] = useState(0)

  const [infiniteError, setInfiniteError] = useState<string | null>(null)
  const [infiniteCharUrl, setInfiniteCharUrl] = useState<string | null>(null)
  const [infiniteMode, setInfiniteMode] = useState(false)
  const [infiniteReady, setInfiniteReady] = useState(false)
  const [infiniteDifficulty, setInfiniteDifficulty] = useState(3)
  const [infiniteAnimalIdx, setInfiniteAnimalIdx] = useState(1)
  const infiniteDifficultyRef = useRef(3)
  const faceModelsLoaded = useRef(false)
  const infiniteModeRef = useRef(false)
  const [isNewBest, setIsNewBest] = useState(false)
  const [tauntMsg, setTauntMsg] = useState('')
  const [recordMsg, setRecordMsg] = useState('')

  const soundRef = useRef(soundOn)
  soundRef.current = soundOn

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
  const decreaseCountRef = useRef(0)
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

  const RECORD_MSGS = [
    '🏆 신기록 달성!', '🎉 최고기록 경신!', '🔥 대단해요!', '⚡ 새 기록!', '👊 최강!',
  ]

  const saveBest = useCallback((s: number) => {
    const prevBest = Number(localStorage.getItem('boxing_best') ?? 0)
    if (s > prevBest) {
      setIsNewBest(true)
      setRecordMsg(RECORD_MSGS[Math.floor(Math.random() * RECORD_MSGS.length)])
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
      setCombo(0)
      setFlash('MISS')
      setTauntMsg(randomTaunt(false))
      if (!infiniteModeRef.current) {
        const newLives = Math.max(0, livesRef.current - 1)
        setLives(newLives)
        livesRef.current = newLives
      }
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
      const newScore = scoreRef.current + 1
      setScore(newScore)
      scoreRef.current = newScore
      const decrease = timeDecreaseRef.current
      decreaseCountRef.current += 1
      if (decreaseCountRef.current >= 4) {
        decreaseCountRef.current = 0
        timeDecreaseRef.current = Math.max(MIN_DECREASE, decrease - 1)
      }
      const newTl = Math.max(MIN_TIME, timeLimitRef.current - decrease)
      setTimeLimit(newTl)
      timeLimitRef.current = newTl
      nextRound(newTl)
    } else {
      setFlash('MISS')
      setCombo(0)
      setTauntMsg(randomTaunt(true))
      if (!infiniteModeRef.current) {
        const newLives = Math.max(0, livesRef.current - 1)
        setLives(newLives)
        livesRef.current = newLives
      }
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
    decreaseCountRef.current = 0
    scoreRef.current = 0
    setTimeout(() => nextRound(INITIAL_TIME), 100)
  }, [clearTimers, nextRound])

  const startInfiniteGame = useCallback(() => {
    const diff = infiniteDifficultyRef.current
    const settings = DIFFICULTY_SETTINGS[diff] ?? DIFFICULTY_SETTINGS[3]
    const initTime = settings.initialTime
    clearTimers()
    setTimeLimit(initTime)
    setScore(0)
    setFlash(null)
    setCombo(0)
    setUsedContinue(false)
    setIsNewBest(false)
    setMaxCombo(0)
    const newLives = Math.max(0, livesRef.current - 1)
    setLives(newLives)
    livesRef.current = newLives
    localStorage.setItem('boxing_lives', String(newLives))
    setInfiniteMode(true)
    infiniteModeRef.current = true
    setGameState('PLAYING')
    timeLimitRef.current = initTime
    timeDecreaseRef.current = settings.timeDecrease
    decreaseCountRef.current = 0
    scoreRef.current = 0
    setTimeout(() => nextRound(initTime), 100)
  }, [clearTimers, nextRound])

  const continueGame = useCallback(() => {
    setAdModal('continue')
  }, [clearTimers, nextRound])

  const handleAdCharge = useCallback(() => {
    setAdModal('charge')
  }, [])

  useEffect(() => () => { clearTimers(); _ac?.close(); _ac = null }, [clearTimers])
  useEffect(() => { initAdMob() }, [])

  // 스테이지 변경 시 캐릭터 전환 씬
  useEffect(() => {
    const newStage = getStage(score)
    if (newStage === charStage || charTransitioning.current) return
    charTransitioning.current = true
    const exits: Array<'exit-left' | 'exit-right' | 'exit-down'> = ['exit-left', 'exit-right', 'exit-down']
    const exitDir = exits[Math.floor(Math.random() * exits.length)]
    const enterOptions: Record<string, Array<'enter-left' | 'enter-right' | 'enter-top'>> = {
      'exit-left':  ['enter-right', 'enter-top'],
      'exit-right': ['enter-left',  'enter-top'],
      'exit-down':  ['enter-left',  'enter-right'],
    }
    const enterDir = enterOptions[exitDir][Math.floor(Math.random() * 2)]
    setCharAnim(exitDir)
    setTimeout(() => {
      setCharStage(newStage)
      setCharAnim(enterDir)
      setTimeout(() => {
        setCharAnim('idle')
        charTransitioning.current = false
      }, 350)
    }, 350)
  }, [score, charStage])

  // 백그라운드 진입 시 타이머 일시정지
  useEffect(() => {
    const pauseTimeRef = { current: 0 }
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (stateRef.current === 'PLAYING') {
          pauseTimeRef.current = performance.now()
          if (timerRef.current) clearTimeout(timerRef.current)
          if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
      } else {
        if (stateRef.current === 'PLAYING' && pauseTimeRef.current > 0) {
          const pausedDuration = performance.now() - pauseTimeRef.current
          startTimeRef.current += pausedDuration
          const tl = timeLimitRef.current
          const elapsed = performance.now() - startTimeRef.current
          const remaining = tl - elapsed
          pauseTimeRef.current = 0
          if (remaining <= 0) {
            setCombo(0)
            setFlash('MISS')
            setTauntMsg(randomTaunt(false))
            const newLives = Math.max(0, livesRef.current - 1)
            setLives(newLives)
            livesRef.current = newLives
            saveBest(scoreRef.current)
            if (soundRef.current) playGameOver()
            setGameState('GAMEOVER')
          } else {
            timerRef.current = setTimeout(() => {
              setCombo(0)
              setFlash('MISS')
              setTauntMsg(randomTaunt(false))
              const newLives = Math.max(0, livesRef.current - 1)
              setLives(newLives)
              livesRef.current = newLives
              saveBest(scoreRef.current)
              if (soundRef.current) playGameOver()
              setGameState('GAMEOVER')
            }, remaining)
            timerDangerRef.current = false
            const tick = () => {
              const el = performance.now() - startTimeRef.current
              const pct = Math.max(0, (tl - el) / tl)
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
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [saveBest])


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
          {lives === 0 && (
            <p className="no-lives-msg">목숨이 없어요! 충전 버튼을 눌러주세요</p>
          )}
          <div className="home-bottom">
            {livesBlock}
            <div className="start-btn-row">
              <button className="start-btn" onClick={() => { if (soundOn) playClick(); startGame() }} disabled={lives === 0}>시작하기</button>
              <button className="infinite-btn" onClick={() => setShowInfiniteSetup(true)}>무한모드</button>
            </div>
            <div className="home-btn-row">
              <button className="settings-btn" onClick={() => setGameState('SETTINGS')}>⚙ 설정</button>
              <button className="settings-btn" onClick={() => setShowTutorial(true)}>? 도움말</button>
            </div>
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
        {showInfiniteSetup && (
          <div className="tutorial-overlay" onClick={() => { setShowInfiniteSetup(false); setInfiniteReady(false); if (!infiniteMode) setInfiniteCharUrl(null) }}>
            <div className="infinite-setup-box" onClick={e => e.stopPropagation()}>
              <p className="infinite-setup-title">무한모드</p>
              <p className="infinite-setup-desc">상대방의 사진을 선택해주세요</p>
              {infiniteError && (
                <p className="infinite-error-msg">{infiniteError}</p>
              )}
              {infiniteLoading && (
                <div className="infinite-loading-wrap">
                  <div className="infinite-loading-bar">
                    <div className="infinite-loading-fill" style={{ width: `${infiniteProgress}%` }} />
                  </div>
                  <span className="infinite-loading-text">
                    {infiniteProgress < 60 ? '모델 로딩 중...' : infiniteProgress < 100 ? '얼굴 분석 중...' : '완료!'}
                  </span>
                </div>
              )}
              {infiniteReady && infiniteCharUrl && (
                <div className="infinite-preview">
                  <img src={infiniteCharUrl} className="infinite-preview-char" alt="캐릭터" />
                  <p className="infinite-preview-name">{ANIMAL_NAMES[infiniteAnimalIdx]}</p>
                  <div className="infinite-preview-stars">
                    {'★'.repeat(infiniteDifficulty)}{'☆'.repeat(5 - infiniteDifficulty)}
                  </div>
                  <div className="infinite-preview-btns">
                    <button className="infinite-retry-btn" onClick={() => { setInfiniteReady(false); setInfiniteCharUrl(null) }}>다시 선택</button>
                    <button className="infinite-start-btn" onClick={() => { setInfiniteReady(false); setShowInfiniteSetup(false); startInfiniteGame() }}>시작</button>
                  </div>
                </div>
              )}
              {!infiniteLoading && !infiniteReady && (
              <label className="infinite-photo-btn">
                사진 선택
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    e.target.value = ''
                    setInfiniteError(null)
                    setInfiniteLoading(true)
                    setInfiniteProgress(5)

                    const url = URL.createObjectURL(file)

                    try {
                      if (!faceModelsLoaded.current) {
                        setInfiniteProgress(15)
                        await Promise.all([
                          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
                          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                        ])
                        faceModelsLoaded.current = true
                      }
                      setInfiniteProgress(60)

                      const img = await faceapi.fetchImage(url)
                      setInfiniteProgress(75)

                      const result = await faceapi
                        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
                        .withFaceLandmarks()
                      setInfiniteProgress(100)

                      if (!result) {
                        setInfiniteLoading(false)
                        setInfiniteProgress(0)
                        URL.revokeObjectURL(url)
                        setInfiniteError('얼굴을 찾을 수 없어요.\n다른 사진을 선택해주세요.')
                        return
                      }

                      // 512×512 캐릭터 합성
                      // 레이어 순서: 몸통 → 눈/코입(마스크 구멍 위치) → SVG 마스크
                      const maskPool = [9] // 테스트: 돼지만
                      const maskIdx = maskPool[Math.floor(Math.random() * maskPool.length)]
                      const maskName = `21_animal_${maskIdx}`
                      const pts = result.landmarks.positions

                      // 기존 캐릭터 비율 270×398 → 400×590 캔버스
                      // 머리: (0,0,400,400) / 몸통: (0,320,400,270) — 80px 겹침으로 목 연결
                      const canvas = document.createElement('canvas')
                      canvas.width = 400; canvas.height = 590
                      const ctx = canvas.getContext('2d')!

                      // 1. 몸통 — y:320부터 하단
                      const bodyImg = new Image()
                      bodyImg.src = '/asset/20_body.png'
                      await new Promise((res, rej) => { bodyImg.onload = res; bodyImg.onerror = () => rej(new Error('몸통 이미지 로드 실패')) })
                      ctx.drawImage(bodyImg, 0, 320, 400, 270)

                      // 머리(마스크) 영역: 상단 400×400, 여백 없이 전체 너비
                      const HEAD_X = 0, HEAD_Y = 0, HEAD_W = 400, HEAD_H = 400
                      const hs = HEAD_W / 512
                      const mouthOvr = MASK_MOUTH_OVERRIDE[maskIdx]
                      const HOLES = {
                        rightEye:  { cx: 170*hs, cy: 212*hs, rx: 52*hs, ry: 36*hs },
                        leftEye:   { cx: 342*hs, cy: 212*hs, rx: 52*hs, ry: 36*hs },
                        mouthNose: { cx: 256*hs, cy: (mouthOvr?.cy ?? 338)*hs, rx: (mouthOvr?.rx ?? 46)*hs, ry: (mouthOvr?.ry ?? 34)*hs },
                      }

                      const faceImg = new Image()
                      faceImg.src = url
                      await new Promise((res, rej) => { faceImg.onload = res; faceImg.onerror = () => rej(new Error('사진 로드 실패')) })

                      // 랜드마크로 소스 영역 계산 후 구멍 위치에 맞게 그리기
                      const drawAtHole = (indices: number[], hole: { cx: number, cy: number, rx: number, ry: number }, pad = 0.4) => {
                        const xs = indices.map(i => pts[i].x)
                        const ys = indices.map(i => pts[i].y)
                        const minX = Math.min(...xs), maxX = Math.max(...xs)
                        const minY = Math.min(...ys), maxY = Math.max(...ys)
                        const fw = maxX - minX, fh = maxY - minY
                        const sx = Math.max(0, minX - fw * pad)
                        const sy = Math.max(0, minY - fh * pad)
                        const sw = fw * (1 + pad * 2)
                        const sh = fh * (1 + pad * 2)
                        ctx.save()
                        ctx.beginPath()
                        ctx.ellipse(hole.cx, hole.cy, hole.rx, hole.ry, 0, 0, Math.PI * 2)
                        ctx.clip()
                        ctx.drawImage(faceImg, sx, sy, sw, sh,
                          hole.cx - hole.rx, hole.cy - hole.ry, hole.rx * 2, hole.ry * 2)
                        ctx.restore()
                      }

                      // 2. 마스크 오버레이
                      const maskImg = new Image()
                      maskImg.src = `/asset/${maskName}.png`
                      await new Promise((res, rej) => { maskImg.onload = res; maskImg.onerror = () => rej(new Error('마스크 로드 실패')) })
                      ctx.drawImage(maskImg, HEAD_X, HEAD_Y, HEAD_W, HEAD_H)

                      // 3. 눈/코/입 — 마스크 위에 배치
                      drawAtHole([36,37,38,39,40,41], HOLES.rightEye)
                      drawAtHole([42,43,44,45,46,47], HOLES.leftEye)
                      // 코 — 동물별 SVG 스타일로 그리기
                      const nx = 256*hs, ny = 278*hs
                      const noses: Record<number, () => void> = {
                        1: () => { // 개 — 검은 삼각 코
                          ctx.beginPath(); ctx.moveTo(nx, ny-10*hs); ctx.lineTo(nx-14*hs, ny+8*hs); ctx.lineTo(nx+14*hs, ny+8*hs); ctx.closePath()
                          ctx.fillStyle = '#222'; ctx.fill()
                        },
                        2: () => { // 곰 — 넓은 타원 코
                          ctx.beginPath(); ctx.ellipse(nx, ny, 18*hs, 12*hs, 0, 0, Math.PI*2)
                          ctx.fillStyle = '#1a1a1a'; ctx.fill()
                        },
                        3: () => { // 여우 — 검은 삼각 코
                          ctx.beginPath(); ctx.moveTo(nx, ny-8*hs); ctx.lineTo(nx-12*hs, ny+8*hs); ctx.lineTo(nx+12*hs, ny+8*hs); ctx.closePath()
                          ctx.fillStyle = '#111'; ctx.fill()
                        },
                        4: () => { // 판다 — 작은 검은 코
                          ctx.beginPath(); ctx.ellipse(nx, ny, 12*hs, 9*hs, 0, 0, Math.PI*2)
                          ctx.fillStyle = '#111'; ctx.fill()
                        },
                        5: () => { // 토끼 — 작은 Y자 코
                          ctx.strokeStyle = '#c97b8a'; ctx.lineWidth = 3*hs; ctx.lineCap = 'round'
                          ctx.beginPath(); ctx.moveTo(nx, ny-6*hs); ctx.lineTo(nx, ny+4*hs)
                          ctx.moveTo(nx, ny+4*hs); ctx.lineTo(nx-8*hs, ny+10*hs)
                          ctx.moveTo(nx, ny+4*hs); ctx.lineTo(nx+8*hs, ny+10*hs)
                          ctx.stroke()
                        },
                        6: () => { // 호랑이 — 분홍 삼각 코
                          ctx.beginPath(); ctx.moveTo(nx, ny-10*hs); ctx.lineTo(nx-14*hs, ny+8*hs); ctx.lineTo(nx+14*hs, ny+8*hs); ctx.closePath()
                          ctx.fillStyle = '#d4637a'; ctx.fill()
                        },
                        7: () => { // 원숭이 — 넓은 타원 코
                          ctx.beginPath(); ctx.ellipse(nx, ny+4*hs, 20*hs, 12*hs, 0, 0, Math.PI*2)
                          ctx.fillStyle = '#c07850'; ctx.fill()
                          ctx.beginPath(); ctx.ellipse(nx-8*hs, ny+4*hs, 6*hs, 5*hs, 0, 0, Math.PI*2)
                          ctx.fillStyle = '#7a3a10'; ctx.fill()
                          ctx.beginPath(); ctx.ellipse(nx+8*hs, ny+4*hs, 6*hs, 5*hs, 0, 0, Math.PI*2)
                          ctx.fillStyle = '#7a3a10'; ctx.fill()
                        },
                        8: () => { // 토끼2 — 분홍 작은 코
                          ctx.beginPath(); ctx.ellipse(nx, ny, 10*hs, 7*hs, 0, 0, Math.PI*2)
                          ctx.fillStyle = '#e8a0b0'; ctx.fill()
                        },
                        9: () => { // 돼지 — 주둥이
                          const py = 360*hs
                          ctx.beginPath(); ctx.ellipse(nx, py, 52*hs, 38*hs, 0, 0, Math.PI*2)
                          ctx.fillStyle = '#f09090'; ctx.fill()
                          ctx.beginPath(); ctx.ellipse(nx-18*hs, py+6*hs, 12*hs, 10*hs, 0, 0, Math.PI*2)
                          ctx.fillStyle = '#c06060'; ctx.fill()
                          ctx.beginPath(); ctx.ellipse(nx+18*hs, py+6*hs, 12*hs, 10*hs, 0, 0, Math.PI*2)
                          ctx.fillStyle = '#c06060'; ctx.fill()
                        },
                      }
                      noses[maskIdx]?.()

                      drawAtHole([48,49,50,51,52,53,54,55,56,57,58,59], HOLES.mouthNose, 0.2)

                      const charUrl = canvas.toDataURL('image/png')
                      setInfiniteCharUrl(charUrl)
                      URL.revokeObjectURL(url)

                      const diff = ANIMAL_DIFFICULTY[maskIdx] ?? 3
                      setInfiniteDifficulty(diff)
                      setInfiniteAnimalIdx(maskIdx)
                      infiniteDifficultyRef.current = diff
                      setInfiniteLoading(false)
                      setInfiniteProgress(0)
                      setInfiniteReady(true)
                    } catch (err) {
                      console.error('infinite setup error:', err)
                      setInfiniteLoading(false)
                      setInfiniteProgress(0)
                      URL.revokeObjectURL(url)
                      const msg = err instanceof Error ? err.message : String(err)
                      setInfiniteError(`오류: ${msg}`)
                    }
                  }}
                />
              </label>
              )}
              {!infiniteLoading && !infiniteReady && (
                <button className="infinite-setup-close" onClick={() => { setShowInfiniteSetup(false); setInfiniteCharUrl(null) }}>닫기</button>
              )}
            </div>
          </div>
        )}
        {showTutorial && (
          <div className="tutorial-overlay">
            <div className="tutorial-box">
              <div className="tutorial-section">
                <p className="tutorial-section-title">게임 규칙</p>
                <div className="tutorial-steps">
                  <div className="tutorial-step">
                    <span className="tutorial-step-num">1</span>
                    <span>상대가 한쪽 글러브로 막습니다</span>
                  </div>
                  <div className="tutorial-step">
                    <span className="tutorial-step-num">2</span>
                    <span>막지 않은 반대쪽을 빠르게 쳐요!</span>
                  </div>
                </div>
              </div>
              <div className="tutorial-section">
                <p className="tutorial-section-title">게임 오버</p>
                <div className="tutorial-steps">
                  <div className="tutorial-step">
                    <span className="tutorial-step-num">!</span>
                    <span>막은 쪽을 치면 게임이 끝나요</span>
                  </div>
                  <div className="tutorial-step">
                    <span className="tutorial-step-num">!</span>
                    <span>시간 초과시 게임이 끝나요</span>
                  </div>
                </div>
              </div>
              <button className="tutorial-start-btn" onClick={() => { localStorage.setItem('boxing_tutorial_done', '1'); setShowTutorial(false) }}>확인</button>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
    <div className="game" style={isAndroid() ? { height: '100vh', boxSizing: 'border-box', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', overflow: 'hidden' } : undefined}>
      <div className="hp-bar">
        <div className="score-info" style={{ cursor: 'pointer' }} onPointerDown={() => {
          const stage = getStage(scoreRef.current)
          const next = STAGE_THRESHOLDS[Math.min(stage, STAGE_THRESHOLDS.length - 1)]
          setScore(next)
          scoreRef.current = next
        }}>타격: {score}</div>
      </div>

      <div key={hitEffectKey} className={`opponent ${flash === 'MISS' ? 'miss' : ''}`}>
        <div className="combo-wrap">
          {flash === 'HIT' && <span key={hitEffectKey} className="hit-effect">💥</span>}
          {combo >= 10 && <div className="combo" style={{ fontSize: `${Math.min(45, 15 + Math.floor((combo - 10) / 5))}px` }}>{combo} COMBO!</div>}
        </div>
        <div className="boxer-row">
          <img src="/asset/2_glove.png" className={`glove left ${gameState === 'PLAYING' && blockSide === 'LEFT' ? 'blocking' : ''}`} />
          <img src={infiniteMode && infiniteCharUrl ? infiniteCharUrl : `/asset/${charStage + 9}_char.png`} className={`boxer-body char-${charAnim}`} />
          <img src="/asset/2_glove_r.png" className={`glove right ${gameState === 'PLAYING' && blockSide === 'RIGHT' ? 'blocking' : ''}`} />
          {isOverThirdStage(score) && (
            <svg className="sweat-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
              <ellipse className="sweat-drop d1" cx="50" cy="10" rx="3.5" ry="5.5" fill="#7ec8e3" opacity="0.9"/>
              <ellipse className="sweat-drop d2" cx="50" cy="10" rx="3" ry="5" fill="#7ec8e3" opacity="0.9"/>
              <ellipse className="sweat-drop d3" cx="50" cy="10" rx="3.5" ry="5.5" fill="#7ec8e3" opacity="0.9"/>
              <ellipse className="sweat-drop d4" cx="50" cy="10" rx="3" ry="5" fill="#7ec8e3" opacity="0.9"/>
            </svg>
          )}
          {isOverTwoThirdsStage(score) && (
            <div className="stars-orbit">
              {[0,1,2].map(i => (
                <div key={i} className="star-arm" style={{ '--i': i } as React.CSSProperties}>
                  <span className="star-dot">⭐</span>
                </div>
              ))}
            </div>
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
            <button className="overlay-btn-sub" onClick={() => { clearTimers(); setInfiniteMode(false); infiniteModeRef.current = false; setGameState('IDLE') }}>홈으로</button>
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
