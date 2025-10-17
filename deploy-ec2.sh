#!/bin/bash

echo " HLS 다운로더 EC2 배포 스크립트"
echo "=================================="

# 시스템 업데이트
echo " 시스템 업데이트 중..."
sudo apt update && sudo apt upgrade -y

# Node.js 설치 (v18)
echo " Node.js 설치 중..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# FFmpeg 설치
echo " FFmpeg 설치 중..."
sudo apt install -y ffmpeg

# Git 설치
echo " Git 설치 중..."
sudo apt install -y git

# 프로젝트 디렉토리 생성
echo " 프로젝트 디렉토리 설정 중..."
mkdir -p /home/ubuntu/hls-downloader
cd /home/ubuntu/hls-downloader

# 프로젝트 파일 복사 (로컬에서 실행하는 경우)
if [ -f "package.json" ]; then
    echo " 로컬 파일을 사용합니다."
else
    echo " GitHub에서 프로젝트를 클론합니다."
    git clone https://github.com/your-username/hls-downloader.git .
fi

# 의존성 설치
echo "의존성 설치 중..."
npm install

# PM2 설치 및 설정
echo " PM2 설치 중..."
sudo npm install -g pm2

# PM2 설정 파일 생성
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'hls-downloader',
    script: 'src/web.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# PM2로 애플리케이션 시작
echo " 애플리케이션 시작 중..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 방화벽 설정 (Ubuntu)
echo " 방화벽 설정 중..."
sudo ufw allow 3000
sudo ufw allow ssh
sudo ufw --force enable

echo " 배포 완료!"
echo " 웹 서버: http://YOUR_EC2_IP:3000"
echo " PM2 상태: pm2 status"
echo " 로그 확인: pm2 logs hls-downloader" 