#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import HLSDownloader from './hls-downloader.js';
import VideoConverter from './video-converter.js';

const program = new Command();

program
  .name('hls-downloader')
  .description('HLS 스트림을 다운로드하고 MP4로 변환하는 도구')
  .version('1.0.0');

program
  .command('download')
  .description('HLS 스트림을 다운로드하고 MP4로 변환')
  .requiredOption('-u, --url <url>', 'HLS 스트림 URL (.m3u8)')
  .option('-o, --output <path>', '출력 파일 경로', 'output.mp4')
  .option('-q, --quality <quality>', '품질 설정 (low, medium, high, best)', 'medium')
  .option('--keep-temp', '임시 파일 유지')
  .option('--no-convert', 'MP4 변환 건너뛰기')
  .option('--parallel <number>', '동시 다운로드 수 (기본값: 5)', '5')
  .option('--retry <number>', '재시도 횟수 (기본값: 3)', '3')
  .option('--timeout <number>', '타임아웃 (밀리초, 기본값: 30000)', '30000')
  .option('--sequential', '순차 다운로드 사용 (병렬 다운로드 비활성화)')
  .action(async (options) => {
    try {
      console.log('🚀 HLS 다운로더 시작');
      console.log(`📡 URL: ${options.url}`);
      console.log(`💾 출력: ${options.output}`);
      console.log(`🎯 품질: ${options.quality}`);
      console.log('');

      // 출력 디렉토리 생성
      const outputDir = path.dirname(options.output);
      if (outputDir !== '.') {
        await fs.ensureDir(outputDir);
      }

      // HLS 다운로더 초기화 (성능 옵션 포함)
      const downloaderOptions = {
        maxConcurrent: parseInt(options.parallel),
        retryAttempts: parseInt(options.retry),
        timeout: parseInt(options.timeout)
      };
      
      const downloader = new HLSDownloader(downloaderOptions);
      const converter = new VideoConverter();

      console.log(`⚡ 성능 설정: 동시 다운로드 ${options.parallel}개, 재시도 ${options.retry}회, 타임아웃 ${options.timeout}ms`);

      // 다운로드 실행
      const downloadOptions = {
        keepTemp: options.keepTemp,
        parallel: !options.sequential
      };
      
      const downloadResult = await downloader.download(options.url, options.output, downloadOptions);

      console.log('');
      console.log(` 다운로드 통계:`);
      console.log(`  - 총 세그먼트: ${downloadResult.totalSegments}`);
      console.log(`  - 다운로드된 세그먼트: ${downloadResult.downloadedSegments}`);
      console.log('');

      if (options.convert === false) {
        console.log('⏭️ MP4 변환을 건너뜁니다.');
        console.log(`📁 임시 파일 위치: ${downloader.tempDir}`);
        return;
      }

      // 품질 설정 가져오기
      const qualitySettings = converter.getQualitySettings(options.quality);
      console.log(` 변환 설정: ${options.quality} 품질`);

      // MP4 변환
      const outputPath = await converter.convertToMP4(
        downloadResult.concatFile,
        options.output,
        qualitySettings
      );

      // 파일 정보 표시
      const fileSize = await converter.getFileSize(outputPath);
      const formattedSize = converter.formatFileSize(fileSize);

      console.log('');
      console.log(' 변환 완료!');
      console.log(` 파일: ${outputPath}`);
      console.log(` 크기: ${formattedSize}`);

      // 임시 파일 정리
      if (!options.keepTemp) {
        await downloader.cleanup();
      } else {
        console.log(`📁 임시 파일 유지: ${downloader.tempDir}`);
      }

    } catch (error) {
      console.error(' 오류 발생:', error.message);
      process.exit(1);
    }
  });

program
  .command('info')
  .description('HLS 스트림 정보 확인')
  .requiredOption('-u, --url <url>', 'HLS 스트림 URL (.m3u8)')
  .action(async (options) => {
    try {
      console.log('📋 HLS 스트림 정보 확인 중...');
      
      const downloader = new HLSDownloader();
      await downloader.init();
      
      const segments = await downloader.parseManifest(options.url);
      
      console.log('');
      console.log('📊 스트림 정보:');
      console.log(`  - 총 세그먼트: ${segments.length}`);
      
      if (segments.length > 0) {
        const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);
        const avgDuration = totalDuration / segments.length;
        
        console.log(`  - 총 길이: ${Math.round(totalDuration)}초`);
        console.log(`  - 평균 세그먼트 길이: ${avgDuration.toFixed(2)}초`);
        console.log(`  - 첫 번째 세그먼트: ${segments[0].url}`);
        console.log(`  - 마지막 세그먼트: ${segments[segments.length - 1].url}`);
      }
      
    } catch (error) {
      console.error(' 오류 발생:', error.message);
      process.exit(1);
    }
  });

// 기본 명령어 (download와 동일)
program
  .argument('[url]', 'HLS 스트림 URL (.m3u8)')
  .option('-o, --output <path>', '출력 파일 경로', 'output.mp4')
  .option('-q, --quality <quality>', '품질 설정 (low, medium, high, best)', 'medium')
  .option('--keep-temp', '임시 파일 유지')
  .option('--no-convert', 'MP4 변환 건너뛰기')
  .action(async (url, options) => {
    if (!url) {
      console.error(' URL이 필요합니다.');
      console.error('사용법: npm start -- --url "https://example.com/stream.m3u8"');
      process.exit(1);
    }

    // download 명령어와 동일한 로직 실행
    const downloadCommand = program.commands.find(cmd => cmd.name() === 'download');
    await downloadCommand.action({
      url,
      output: options.output,
      quality: options.quality,
      keepTemp: options.keepTemp,
      convert: options.convert
    });
  });

// 도움말 표시
if (process.argv.length === 2) {
    console.log(' HLS 다운로더');
  console.log('');
  console.log('사용법:');
  console.log('  npm start -- --url "https://example.com/stream.m3u8"');
  console.log('  npm start -- --url "https://example.com/stream.m3u8" --output "video.mp4" --quality high');
  console.log('');
  console.log('도움말: npm start -- --help');
  process.exit(0);
}

program.parse(); 