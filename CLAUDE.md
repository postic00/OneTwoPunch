# 프로젝트 규칙

## 푸시 순서

푸시할 때는 반드시 아래 순서를 따른다:

1. **웹 빌드**
   ```
   npm run build
   ```

2. **Capacitor 싱크**
   ```
   npx cap sync android
   ```

3. **커밋 & 푸시**
   ```
   git add ...
   git commit -m "..."
   git push
   ```

---

## 프로젝트 구조

### 스택
- React + TypeScript + Vite
- Capacitor (Android, com.postic.onetwopunch)
- 앱인토스 배포: `npx ait build` (granite.config.ts)

### 소스 파일

| 파일 | 역할 |
|------|------|
| `src/App.tsx` | 메인 컴포넌트. 게임 로직 전체 포함 |
| `src/App.css` | 스타일 전체 |
| `src/components/AdModal.tsx` | 광고 모달 (로딩/카운트다운/결과/준비중) |
| `src/utils/admob.ts` | AdMob 초기화 및 보상형 광고 |
| `src/utils/tossAd.ts` | 토스 광고 로드/표시/환경감지 |

### 게임 상태
- `IDLE` → 홈 화면
- `SETTINGS` → 설정 화면
- `PLAYING` → 게임 진행
- `GAMEOVER` → 게임 오버 오버레이

### 캐릭터 / 스테이지
- 스테이지 1~10, 각 스테이지마다 캐릭터 변경
- 임계값: `STAGE_THRESHOLDS = [0, 40, 90, 150, 220, 300, 390, 490, 600, 720]`
- 캐릭터 이미지: `public/asset/10_char.png` ~ `19_char.png`
- 공식: `getStage(score) + 9` → 이미지 번호

### 스테이지별 이펙트
- 1/3 이상: 땀 SVG 애니메이션
- 2/3 이상: 땀 + 별 3개 타원 궤도 회전

### 광고
- Android: AdMob 보상형 (`ca-app-pub-1253913975799895/1209453159`)
- AdMob App ID: `ca-app-pub-1253913975799895~1199842734`
- 토스: `ait.v2.live.5cc05be07a994871` (sandbox: `ait-ad-test-rewarded-id`)
- 광고 트리거: 이어하기(게임오버), 충전(홈/게임화면)

### 목숨 시스템
- 기본 최대 5개, 광고 충전 최대 20개 (`AD_MAX_LIVES`)
- 10분마다 1개 자동 충전 (`CHARGE_INTERVAL_MS`)
- localStorage: `boxing_lives`, `boxing_next_charge`

### 타이머
- 초기: `INITIAL_TIME = 300000` (테스트용 300초, **배포 시 3000으로 변경**)
- DOM 직접 업데이트 (`timerBarRef`) — React 리렌더 없음
- 백그라운드 진입 시 `visibilitychange`로 pause/resume

### 에셋
| 파일 | 설명 |
|------|------|
| `public/asset/0_main_bg.png` | 홈 배경 |
| `public/asset/1_game_bg.png` | 게임 배경 (pngquant 압축) |
| `public/asset/2_glove.png` | 왼쪽 글러브 |
| `public/asset/2_glove_r.png` | 오른쪽 글러브 |
| `public/asset/10~19_char.png` | 스테이지별 캐릭터 |

### 테스트용 기능
- 게임 화면 "타격: N" 텍스트 탭 → 다음 스테이지로 점프
