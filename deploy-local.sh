#!/bin/bash

echo " HLS 다운로더 로컬 배포"
echo "================================"

# 의존성 설치
echo " 의존성 설치 중..."
npm install

# FFmpeg 확인
if ! command -v ffmpeg &> /dev/null; then
    echo " FFmpeg가 설치되지 않았습니다."
    echo "macOS: brew install ffmpeg"
    echo "Ubuntu: sudo apt install ffmpeg"
    echo "Windows: https://ffmpeg.org/download.html"
    exit 1
fi

echo " FFmpeg 확인됨"

# 포트 확인
PORT=3000
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo " 포트 $PORT이 사용 중입니다. 다른 포트를 사용합니다."
    PORT=3001
fi

echo " 웹 서버 시작: http://localhost:$PORT"
echo " 브라우저에서 접속하세요!"
echo "  중지: Ctrl+C"

# 환경 변수 설정
export PORT=$PORT
export NODE_ENV=production

# 웹 서버 시작
npm run web 