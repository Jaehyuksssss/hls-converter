import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';

class VideoConverter {
  constructor() {
    // ffmpeg 경로 확인
    this.checkFFmpeg();
  }

  // FFmpeg 설치 확인
  checkFFmpeg() {
    try {
      ffmpeg.getAvailableCodecs((err, codecs) => {
        if (err) {
          console.error(' FFmpeg가 설치되지 않았습니다.');
          console.error('FFmpeg 설치 방법:');
          console.error('  macOS: brew install ffmpeg');
          console.error('  Ubuntu: sudo apt install ffmpeg');
          console.error('  CentOS: sudo yum install ffmpeg');
          process.exit(1);
        }
      });
    } catch (error) {
      console.error(' FFmpeg 확인 실패:', error.message);
      process.exit(1);
    }
  }

  // TS 파일을 MP4로 변환
  async convertToMP4(concatFile, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      console.log(' MP4 변환 시작...');
      
      const {
        videoCodec = 'libx264',
        audioCodec = 'aac',
        videoBitrate = '2000k',
        audioBitrate = '128k',
        resolution = '1920x1080',
        fps = 30
      } = options;

      const command = ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .videoCodec(videoCodec)
        .audioCodec(audioCodec)
        .videoBitrate(videoBitrate)
        .audioBitrate(audioBitrate)
        .size(resolution)
        .fps(fps)
        .outputOptions([
          '-movflags', '+faststart',
          '-pix_fmt', 'yuv420p'
        ])
        .output(outputPath);

      // 진행률 표시
      let lastProgress = 0;
      command.on('progress', (progress) => {
        const percent = Math.round(progress.percent || 0);
        if (percent > lastProgress) {
          console.log(`🔄 변환 진행률: ${percent}%`);
          lastProgress = percent;
        }
      });

      // 완료 처리
      command.on('end', () => {
        console.log(' MP4 변환 완료!');
        resolve(outputPath);
      });

      // 에러 처리
      command.on('error', (err) => {
        console.error(' 변환 실패:', err.message);
        reject(new Error(`MP4 변환 실패: ${err.message}`));
      });

      // 변환 시작
      command.run();
    });
  }

  // 품질별 설정 반환
  getQualitySettings(quality = 'medium') {
    const settings = {
      low: {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        videoBitrate: '800k',
        audioBitrate: '96k',
        resolution: '854x480',
        fps: 25
      },
      medium: {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        videoBitrate: '2000k',
        audioBitrate: '128k',
        resolution: '1280x720',
        fps: 30
      },
      high: {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        videoBitrate: '4000k',
        audioBitrate: '192k',
        resolution: '1920x1080',
        fps: 30
      },
      best: {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        videoBitrate: '8000k',
        audioBitrate: '256k',
        resolution: '1920x1080',
        fps: 60
      }
    };

    return settings[quality] || settings.medium;
  }

  // 파일 정보 가져오기
  async getFileInfo(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`파일 정보 읽기 실패: ${err.message}`));
        } else {
          resolve(metadata);
        }
      });
    });
  }

  // 파일 크기 확인
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      throw new Error(`파일 크기 확인 실패: ${error.message}`);
    }
  }

  // 파일 크기를 사람이 읽기 쉬운 형태로 변환
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export default VideoConverter; 