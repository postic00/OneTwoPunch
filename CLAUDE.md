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
