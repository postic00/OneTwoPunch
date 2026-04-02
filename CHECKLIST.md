# 원투펀치 출시 체크리스트

## AdMob
- App ID: `ca-app-pub-1253913975799895~1199842734`
- Rewarded Ad ID: `ca-app-pub-1253913975799895/1209453159`

## 앱인토스
- Toss Ad Group ID: `ait.v2.live.93ce2a2ea05b4289`
- **아이콘 600x600 필요** (미준비)

## 필요한 파일
- [ ] 앱인토스 아이콘 600x600
- [ ] 앱인토스 가로 섬네일 1932x828
- [ ] 앱인토스 세로 스크린샷 636x1048 (3장 이상)
- [ ] 앱 아이콘 1024x1024
- [ ] Google Play 아이콘 512x512
- [ ] Google Play 섬네일 1024x500
- [ ] 스크린샷 세로 3장 이상 (Google Play 콘솔용)
- [ ] 앱 설명문 (Google Play 콘솔용)

## 배포
- 웹: `npx vercel --prod --name onetwo-punch`
- Android APK: `./1.build_android.sh`
- 개인정보처리방침: `/public/privacy.html`
- app-ads.txt: `/public/app-ads.txt`
