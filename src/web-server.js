import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import HLSDownloader from './hls-downloader.js';
import VideoConverter from './video-converter.js';
import axios from 'axios'; // axios 추가

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WebServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.downloads = new Map(); // 진행 중인 다운로드 추적
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  setupRoutes() {
    // 메인 페이지
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // HLS 플레이어 페이지
    this.app.get('/player', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/player.html'));
    });

    // 다운로드 시작
    this.app.post('/api/download', async (req, res) => {
      try {
        const { url, output, quality = 'medium' } = req.body;

        if (!url) {
          return res.status(400).json({ error: 'URL이 필요합니다.' });
        }

        const downloadId = Date.now().toString();
        const outputPath = output || `download_${downloadId}.mp4`;

        // 다운로드 정보 저장
        this.downloads.set(downloadId, {
          id: downloadId,
          url,
          output: outputPath,
          quality,
          status: 'starting',
          progress: 0,
          message: '다운로드 시작...',
          startTime: new Date(),
          segments: {
            total: 0,
            downloaded: 0
          }
        });

        // 비동기로 다운로드 실행 (성능 옵션 포함)
        const downloaderOptions = {
          maxConcurrent: 5,
          retryAttempts: 3,
          timeout: 30000
        };
        
        this.startDownload(downloadId, url, outputPath, quality, downloaderOptions);

        res.json({ 
          success: true, 
          downloadId,
          message: '다운로드가 시작되었습니다.' 
        });

      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 다운로드 상태 확인
    this.app.get('/api/download/:id', (req, res) => {
      const download = this.downloads.get(req.params.id);
      if (!download) {
        return res.status(404).json({ error: '다운로드를 찾을 수 없습니다.' });
      }
      res.json(download);
    });

    // 다운로드 목록
    this.app.get('/api/downloads', (req, res) => {
      const downloads = Array.from(this.downloads.values());
      res.json(downloads);
    });

    // 파일 다운로드
    this.app.get('/api/file/:filename', (req, res) => {
      const filename = req.params.filename;
      const filePath = path.join(process.cwd(), filename);
      
      if (fs.existsSync(filePath)) {
        res.download(filePath);
      } else {
        res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
      }
    });

    // 스트림 정보 확인
    this.app.post('/api/info', async (req, res) => {
      try {
        const { url } = req.body;
        
        if (!url) {
          return res.status(400).json({ error: 'URL이 필요합니다.' });
        }

        const downloader = new HLSDownloader();
        await downloader.init();
        
        const segments = await downloader.parseManifest(url);
        
        const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);
        
        res.json({
          success: true,
          segments: segments.length,
          duration: Math.round(totalDuration),
          avgSegmentDuration: segments.length > 0 ? (totalDuration / segments.length).toFixed(2) : 0
        });

      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async startDownload(downloadId, url, outputPath, quality, downloaderOptions = {}) {
    const download = this.downloads.get(downloadId);
    
    try {
      download.status = 'downloading';
      download.message = '매니페스트 파싱 중...';
      this.downloads.set(downloadId, download);

      const downloader = new HLSDownloader(downloaderOptions);
      const converter = new VideoConverter();

      // 매니페스트 파싱
      const segments = await downloader.parseManifest(url);
      download.segments.total = segments.length;
      download.message = `${segments.length}개 세그먼트 발견`;
      this.downloads.set(downloadId, download);

      // 세그먼트 다운로드 (진행률 업데이트 포함)
      const segmentFiles = [];
      for (let i = 0; i < segments.length; i++) {
        try {
          const filePath = await this.downloadSegmentWithProgress(downloader, segments[i], i, segments.length, downloadId);
          segmentFiles.push(filePath);
          
          download.segments.downloaded = segmentFiles.length;
          download.progress = Math.round((segmentFiles.length / segments.length) * 50); // 다운로드는 50%까지
          download.message = `세그먼트 다운로드 중... (${segmentFiles.length}/${segments.length})`;
          this.downloads.set(downloadId, download);
        } catch (error) {
          console.error(`세그먼트 ${i + 1} 다운로드 실패:`, error.message);
          continue;
        }
      }

      if (segmentFiles.length === 0) {
        throw new Error('다운로드된 세그먼트가 없습니다.');
      }

      // 세그먼트 병합
      download.status = 'converting';
      download.progress = 60;
      download.message = '세그먼트 병합 중...';
      this.downloads.set(downloadId, download);

      const { concatFile } = await downloader.mergeSegments(segmentFiles, outputPath);

      // MP4 변환
      download.progress = 70;
      download.message = 'MP4 변환 중...';
      this.downloads.set(downloadId, download);

      const qualitySettings = converter.getQualitySettings(quality);
      const finalOutputPath = await converter.convertToMP4(concatFile, outputPath, qualitySettings);

      // 완료
      download.status = 'completed';
      download.progress = 100;
      download.message = '다운로드 완료!';
      download.endTime = new Date();
      download.filePath = finalOutputPath;
      
      const fileSize = await converter.getFileSize(finalOutputPath);
      download.fileSize = converter.formatFileSize(fileSize);
      
      this.downloads.set(downloadId, download);

      // 임시 파일 정리
      await downloader.cleanup();

    } catch (error) {
      download.status = 'error';
      download.message = `오류: ${error.message}`;
      download.endTime = new Date();
      this.downloads.set(downloadId, download);
    }
  }

  async downloadSegmentWithProgress(downloader, segment, index, totalSegments, downloadId) {
    const fileName = `segment_${index.toString().padStart(6, '0')}.ts`;
    const filePath = path.join(downloader.tempDir, fileName);
    
    const response = await axios({
      method: 'GET',
      url: segment.url,
      responseType: 'stream',
      timeout: 30000
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(filePath));
      writer.on('error', reject);
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🌐 웹 서버가 http://localhost:${this.port} 에서 실행 중입니다.`);
      console.log(`📱 브라우저에서 위 주소로 접속하세요.`);
    });
  }
}

export default WebServer; 