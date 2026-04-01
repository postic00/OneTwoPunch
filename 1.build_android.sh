#!/bin/bash
set -e

rm -f public/app-debug.apk
npm run build
npx cap sync android

export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android
./gradlew assembleDebug
cd ..

cp android/app/build/outputs/apk/debug/app-debug.apk public/app-debug.apk
echo "APK copied to public/app-debug.apk"
