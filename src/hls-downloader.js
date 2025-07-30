import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class HLSDownloader {
  constructor(options = {}) {
    this.tempDir = path.join(__dirname, '../temp');
    this.segments = [];
    this.manifestUrl = '';
    this.baseUrl = '';
    this.maxConcurrent = options.maxConcurrent || 5; // 동시 다운로드 수
    this.retryAttempts = options.retryAttempts || 3; // 재시도 횟수
    this.timeout = options.timeout || 30000; // 타임아웃
  }

  async init() {
    // 임시 디렉토리 생성
    await fs.ensureDir(this.tempDir);
  }

  // URL에서 기본 경로 추출
  getBaseUrl(url) {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${path.dirname(urlObj.pathname)}/`;
  }

  // 상대 경로를 절대 경로로 변환
  resolveUrl(relativePath) {
    if (relativePath.startsWith('http')) {
      return relativePath;
    }
    return this.baseUrl + relativePath;
  }

  // 마스터 플레이리스트에서 스트림 URL 추출
  async extractStreamUrl(masterPlaylist) {
    const lines = masterPlaylist.split('\n');
    const streamUrls = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.endsWith('.m3u8')) {
        streamUrls.push(trimmedLine);
      }
    }
    
    if (streamUrls.length === 0) {
      throw new Error('스트림 URL을 찾을 수 없습니다.');
    }
    
    // 중간 품질의 스트림 선택 (보통 3-4번째)
    const selectedIndex = Math.min(3, streamUrls.length - 1);
    const selectedUrl = streamUrls[selectedIndex];
    
    console.log(`📺 스트림 선택: ${selectedUrl} (${streamUrls.length}개 중 ${selectedIndex + 1}번째)`);
    return this.resolveUrl(selectedUrl);
  }

  // M3U8 매니페스트 파싱
  async parseManifest(manifestUrl) {
    try {
      console.log('📋 매니페스트 파싱 중...');
      this.manifestUrl = manifestUrl;
      this.baseUrl = this.getBaseUrl(manifestUrl);

      const response = await axios.get(manifestUrl);
      const content = response.data;
      const lines = content.split('\n').filter(line => line.trim());

      // 마스터 플레이리스트인지 확인
      const isMasterPlaylist = lines.some(line => 
        line.includes('#EXT-X-STREAM-INF') || 
        (line.includes('#EXT-X-MEDIA') && line.includes('TYPE=AUDIO'))
      );

      if (isMasterPlaylist) {
        console.log('📺 마스터 플레이리스트 감지, 스트림 URL 추출 중...');
        const streamUrl = await this.extractStreamUrl(content);
        return await this.parseManifest(streamUrl);
      }

      const segments = [];
      let currentSegment = null;

      for (const line of lines) {
        if (line.startsWith('#EXTINF:')) {
          // 세그먼트 정보 파싱
          const duration = parseFloat(line.match(/#EXTINF:([\d.]+)/)?.[1] || 0);
          currentSegment = { duration };
        } else if (line.startsWith('#') && !line.startsWith('#EXTINF:')) {
          // 다른 태그들은 무시
          continue;
        } else if (line.trim() && !line.startsWith('#')) {
          // 세그먼트 URL
          if (currentSegment) {
            currentSegment.url = this.resolveUrl(line.trim());
            segments.push(currentSegment);
            currentSegment = null;
          }
        }
      }

      this.segments = segments;
      console.log(`✅ ${segments.length}개 세그먼트 발견`);
      return segments;
    } catch (error) {
      throw new Error(`매니페스트 파싱 실패: ${error.message}`);
    }
  }

  // 세그먼트 다운로드 (재시도 로직 포함)
  async downloadSegment(segment, index, totalSegments) {
    let attempts = 0;
    
    while (attempts < this.retryAttempts) {
      try {
        const fileName = `segment_${index.toString().padStart(6, '0')}.ts`;
        const filePath = path.join(this.tempDir, fileName);
        
        const response = await axios({
          method: 'GET',
          url: segment.url,
          responseType: 'stream',
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HLS-Downloader/1.0)'
          }
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            const progress = ((index + 1) / totalSegments * 100).toFixed(1);
            console.log(`📥 세그먼트 ${index + 1}/${totalSegments} 다운로드 완료 (${progress}%)`);
            resolve(filePath);
          });
          writer.on('error', reject);
        });
      } catch (error) {
        attempts++;
        console.warn(`⚠️ 세그먼트 ${index + 1} 다운로드 실패 (시도 ${attempts}/${this.retryAttempts}): ${error.message}`);
        
        if (attempts >= this.retryAttempts) {
          throw new Error(`세그먼트 ${index + 1} 다운로드 실패: ${error.message}`);
        }
        
        // 재시도 전 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  // 병렬 다운로드 실행
  async downloadSegmentsParallel(segments, totalSegments) {
    console.log(`🚀 병렬 다운로드 시작 (최대 ${this.maxConcurrent}개 동시)`);
    
    const downloadedFiles = [];
    const queue = [...segments];
    const activeDownloads = new Set();
    
    const processQueue = async () => {
      while (queue.length > 0 || activeDownloads.size > 0) {
        // 활성 다운로드가 최대 개수보다 적으면 새 다운로드 시작
        while (activeDownloads.size < this.maxConcurrent && queue.length > 0) {
          const segmentIndex = segments.length - queue.length;
          const segment = queue.shift();
          
          const downloadPromise = this.downloadSegment(segment, segmentIndex, totalSegments)
            .then(filePath => {
              downloadedFiles.push(filePath);
              activeDownloads.delete(downloadPromise);
            })
            .catch(error => {
              console.error(`❌ 세그먼트 ${segmentIndex + 1} 다운로드 실패:`, error.message);
              activeDownloads.delete(downloadPromise);
            });
          
          activeDownloads.add(downloadPromise);
        }
        
        // 활성 다운로드가 있으면 완료될 때까지 대기
        if (activeDownloads.size > 0) {
          await Promise.race(activeDownloads);
        }
      }
    };
    
    await processQueue();
    console.log(`✅ 총 ${downloadedFiles.length}개 세그먼트 다운로드 완료`);
    return downloadedFiles;
  }

  // 모든 세그먼트 다운로드 (기존 순차 방식)
  async downloadAllSegments() {
    console.log('🚀 순차 다운로드 시작...');
    const downloadedFiles = [];

    for (let i = 0; i < this.segments.length; i++) {
      try {
        const filePath = await this.downloadSegment(this.segments[i], i, this.segments.length);
        downloadedFiles.push(filePath);
      } catch (error) {
        console.error(`❌ 세그먼트 ${i + 1} 다운로드 실패:`, error.message);
        // 실패한 세그먼트는 건너뛰고 계속 진행
        continue;
      }
    }

    console.log(`✅ 총 ${downloadedFiles.length}개 세그먼트 다운로드 완료`);
    return downloadedFiles;
  }

  // 세그먼트 파일들을 하나로 병합
  async mergeSegments(segmentFiles, outputPath) {
    console.log('🔗 세그먼트 병합 중...');
    
    const concatFile = path.join(this.tempDir, 'concat.txt');
    const concatContent = segmentFiles.map(file => `file '${file}'`).join('\n');
    
    await fs.writeFile(concatFile, concatContent);
    
    return {
      concatFile,
      segmentFiles
    };
  }

  // 임시 파일 정리
  async cleanup() {
    try {
      await fs.remove(this.tempDir);
      console.log(' 임시 파일 정리 완료');
    } catch (error) {
      console.warn(' 임시 파일 정리 실패:', error.message);
    }
  }

  // 전체 다운로드 프로세스 (병렬 다운로드 옵션)
  async download(url, outputPath, options = {}) {
    const { keepTemp = false, parallel = true } = options;
    
    try {
      await this.init();
      
      // 매니페스트 파싱
      await this.parseManifest(url);
      
      // 세그먼트 다운로드 (병렬 또는 순차)
      let segmentFiles;
      if (parallel && this.segments.length > 1) {
        segmentFiles = await this.downloadSegmentsParallel(this.segments, this.segments.length);
      } else {
        segmentFiles = await this.downloadAllSegments();
      }
      
      if (segmentFiles.length === 0) {
        throw new Error('다운로드된 세그먼트가 없습니다.');
      }
      
      // 세그먼트 병합 준비
      const { concatFile } = await this.mergeSegments(segmentFiles, outputPath);
      
      return {
        concatFile,
        segmentFiles,
        totalSegments: this.segments.length,
        downloadedSegments: segmentFiles.length
      };
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }
}

export default HLSDownloader; 