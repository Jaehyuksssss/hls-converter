# HLS Downloader

.m3u8 주소만 있으면 HLS 스트림을 다운로드하고 MP4로 변환하는 프로그램입니다.

test : https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8

##  기능

-  HLS 스트림 (.m3u8) 다운로드
-  MP4 파일로 자동 변환
-  CLI 및 웹 인터페이스 지원
-  실시간 진행률 표시
-  다양한 품질 설정 (low, medium, high, best)
-  스트림 정보 미리보기
-  에러 처리 및 복구

##  설치

```bash
# 저장소 클론
git clone <repository-url>
cd hls-downloader

# 의존성 설치
npm install

# ffmpeg 설치 (필수)
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg
```

## 📖 사용법

### CLI 사용법

```bash
# 기본 사용법
npm start -- --url "https://example.com/stream.m3u8"

# 출력 파일 지정
npm start -- --url "https://example.com/stream.m3u8" --output "video.mp4"

# 품질 설정
npm start -- --url "https://example.com/stream.m3u8" --quality "high"

# 스트림 정보 확인
npm start -- info --url "https://example.com/stream.m3u8"

# 임시 파일 유지 (디버깅용)
npm start -- --url "https://example.com/stream.m3u8" --keep-temp

# MP4 변환 건너뛰기 (TS 파일만 다운로드)
npm start -- --url "https://example.com/stream.m3u8" --no-convert
```

### 🎬 HLS 플레이어 사용법

```bash
# 스트림 정보 확인
npm run player -- info --url "https://example.com/stream.m3u8"

# 상세 정보 확인
npm run player -- info --url "https://example.com/stream.m3u8" --detailed

# 스트림 유효성 검사
npm run player -- validate --url "https://example.com/stream.m3u8"

# 통계 분석
npm run player -- stats --url "https://example.com/stream.m3u8"
```

### 웹 인터페이스

```bash
# 웹 서버 시작
npm run web

# 브라우저에서 http://localhost:3000 접속
```

웹 인터페이스에서는:
-  URL 입력으로 간편한 다운로드
-  실시간 진행률 확인
-  품질 설정 선택
-  다운로드 히스토리 관리
-  완료된 파일 다운로드

## ⚙️ 품질 설정

| 품질 | 해상도 | 비트레이트 | 용도 |
|------|--------|------------|------|
| low | 854x480 | 800k | 빠른 다운로드 |
| medium | 1280x720 | 2000k | 기본 설정 |
| high | 1920x1080 | 4000k | 고화질 |
| best | 1920x1080 | 8000k | 최고 품질 |

##  테스트

```bash
# 기본 테스트 실행
npm test

# 성능 벤치마크 실행
npm run benchmark

# 프로그램 도움말
npm start -- --help
```

## ⚡ 성능 최적화

### 병렬 다운로드
- 기본적으로 5개 세그먼트를 동시에 다운로드
- `--parallel` 옵션으로 동시 다운로드 수 조정
- `--sequential` 옵션으로 순차 다운로드 사용

### 재시도 메커니즘
- 네트워크 오류 시 자동 재시도
- `--retry` 옵션으로 재시도 횟수 조정 (기본값: 3회)

### 타임아웃 설정
- `--timeout` 옵션으로 타임아웃 시간 조정 (기본값: 30초)

### 사용 예시
```bash
# 고성능 설정 (10개 동시 다운로드)
npm start -- --url "https://example.com/stream.m3u8" --parallel 10

# 안정성 우선 (순차 다운로드, 재시도 5회)
npm start -- --url "https://example.com/stream.m3u8" --sequential --retry 5

# 빠른 다운로드 (짧은 타임아웃)
npm start -- --url "https://example.com/stream.m3u8" --timeout 15000
```

##  프로젝트 구조

```
hls-downloader/
├── src/
│   ├── index.js          # CLI 메인
│   ├── web-server.js     # 웹 서버
│   ├── web.js           # 웹 서버 실행
│   ├── hls-downloader.js # HLS 다운로더 코어
│   ├── video-converter.js # FFmpeg 변환기
│   └── test.js          # 테스트
├── public/
│   └── index.html       # 웹 인터페이스
├── package.json
└── README.md
```

## 🔧 환경 요구사항

- Node.js 18+
- FFmpeg
- 인터넷 연결
- 충분한 디스크 공간

## 주의사항

- 저작권이 있는 콘텐츠는 개인 용도로만 사용하세요
- 서버에 과부하를 주지 않도록 주의하세요
- 대용량 파일 다운로드 시 충분한 디스크 공간을 확보하세요

##  문제 해결

### FFmpeg 오류
```bash
# FFmpeg 설치 확인
ffmpeg -version

# 경로 문제인 경우
export PATH="/opt/homebrew/bin:$PATH"
```

### 다운로드 실패
- URL이 올바른지 확인
- 네트워크 연결 상태 확인
- 서버가 HLS 스트림을 제공하는지 확인

### 변환 실패
- 충분한 디스크 공간 확보
- FFmpeg 설치 확인
- 임시 파일 정리 후 재시도

## 📄 라이선스

MIT License
