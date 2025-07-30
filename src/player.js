#!/usr/bin/env node

import { Command } from 'commander';
import HLSDownloader from './hls-downloader.js';

const program = new Command();

program
  .name('hls-player')
  .description('HLS 스트림 정보 확인 및 분석 도구')
  .version('1.0.0');

program
  .command('info')
  .description('HLS 스트림 상세 정보 확인')
  .requiredOption('-u, --url <url>', 'HLS 스트림 URL (.m3u8)')
  .option('--detailed', '상세 정보 출력')
  .action(async (options) => {
    try {
      console.log('🎬 HLS 스트림 분석 시작');
      console.log(`📡 URL: ${options.url}`);
      console.log('');

      const downloader = new HLSDownloader();
      await downloader.init();
      
      const segments = await downloader.parseManifest(options.url);
      
      console.log('📊 스트림 정보:');
      console.log(`  - 총 세그먼트: ${segments.length}개`);
      
      if (segments.length > 0) {
        const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);
        const avgDuration = totalDuration / segments.length;
        
        console.log(`  - 총 길이: ${Math.round(totalDuration)}초 (${Math.round(totalDuration / 60)}분 ${totalDuration % 60}초)`);
        console.log(`  - 평균 세그먼트 길이: ${avgDuration.toFixed(2)}초`);
        console.log(`  - 첫 번째 세그먼트: ${segments[0].url}`);
        console.log(`  - 마지막 세그먼트: ${segments[segments.length - 1].url}`);
        
        if (options.detailed) {
          console.log('');
          console.log('📋 세그먼트 상세 정보:');
          segments.slice(0, 10).forEach((segment, index) => {
            console.log(`  ${index + 1}. ${segment.duration}s - ${segment.url}`);
          });
          if (segments.length > 10) {
            console.log(`  ... (총 ${segments.length}개 세그먼트)`);
          }
        }
        
        // 품질 분석
        const durations = segments.map(s => s.duration);
        const uniqueDurations = [...new Set(durations)];
        console.log('');
        console.log('🎯 세그먼트 길이 분석:');
        uniqueDurations.forEach(duration => {
          const count = durations.filter(d => d === duration).length;
          const percentage = ((count / segments.length) * 100).toFixed(1);
          console.log(`  - ${duration}s: ${count}개 (${percentage}%)`);
        });
      }
      
    } catch (error) {
      console.error(' 오류 발생:', error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('HLS 스트림 유효성 검사')
  .requiredOption('-u, --url <url>', 'HLS 스트림 URL (.m3u8)')
  .action(async (options) => {
    try {
      console.log('🔍 HLS 스트림 유효성 검사 시작');
      console.log(`📡 URL: ${options.url}`);
      console.log('');

      const downloader = new HLSDownloader();
      await downloader.init();
      
      const segments = await downloader.parseManifest(options.url);
      
      console.log('✅ 검사 결과:');
      console.log(`  - 매니페스트 파싱: 성공`);
      console.log(`  - 세그먼트 수: ${segments.length}개`);
      
      if (segments.length === 0) {
        console.log('  - ⚠️ 세그먼트가 없습니다.');
        process.exit(1);
      }
      
      // 세그먼트 URL 접근성 테스트
      console.log('  - 세그먼트 접근성 테스트 중...');
      let accessibleCount = 0;
      
      for (let i = 0; i < Math.min(5, segments.length); i++) {
        try {
          const response = await fetch(segments[i].url, { method: 'HEAD' });
          if (response.ok) {
            accessibleCount++;
          }
        } catch (error) {
          console.log(` 세그먼트 ${i + 1} 접근 불가`);
        }
      }
      
      console.log(`  - 접근 가능한 세그먼트: ${accessibleCount}/5`);
      
      if (accessibleCount === 5) {
        console.log('  -  스트림이 정상적으로 작동합니다.');
      } else {
        console.log('  -  일부 세그먼트에 접근할 수 없습니다.');
      }
      
    } catch (error) {
      console.error(' 검사 실패:', error.message);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('HLS 스트림 통계 정보')
  .requiredOption('-u, --url <url>', 'HLS 스트림 URL (.m3u8)')
  .action(async (options) => {
    try {
      console.log(' HLS 스트림 통계 분석');
      console.log(` URL: ${options.url}`);
      console.log('');

      const downloader = new HLSDownloader();
      await downloader.init();
      
      const segments = await downloader.parseManifest(options.url);
      
      if (segments.length === 0) {
        console.log(' 분석할 세그먼트가 없습니다.');
        process.exit(1);
      }
      
      const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);
      const avgDuration = totalDuration / segments.length;
      const durations = segments.map(s => s.duration);
      
      // 통계 계산
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);
      
      console.log(' 통계 정보:');
      console.log(`  - 총 세그먼트: ${segments.length}개`);
      console.log(`  - 총 길이: ${totalDuration.toFixed(2)}초`);
      console.log(`  - 평균 길이: ${avgDuration.toFixed(2)}초`);
      console.log(`  - 최소 길이: ${minDuration.toFixed(2)}초`);
      console.log(`  - 최대 길이: ${maxDuration.toFixed(2)}초`);
      console.log(`  - 표준편차: ${stdDev.toFixed(2)}초`);
      console.log(`  - 변동계수: ${((stdDev / avgDuration) * 100).toFixed(1)}%`);
      
      // 길이별 분포
      console.log('');
      console.log(' 세그먼트 길이 분포:');
      const durationGroups = {};
      segments.forEach(segment => {
        const duration = Math.round(segment.duration);
        durationGroups[duration] = (durationGroups[duration] || 0) + 1;
      });
      
      Object.entries(durationGroups)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([duration, count]) => {
          const percentage = ((count / segments.length) * 100).toFixed(1);
          console.log(`  - ${duration}s: ${count}개 (${percentage}%)`);
        });
      
    } catch (error) {
      console.error(' 통계 분석 실패:', error.message);
      process.exit(1);
    }
  });

// 도움말 표시
if (process.argv.length === 2) {
  console.log('🎬 HLS 플레이어');
  console.log('');
  console.log('사용법:');
  console.log('  npm run player -- info --url "https://example.com/stream.m3u8"');
  console.log('  npm run player -- validate --url "https://example.com/stream.m3u8"');
  console.log('  npm run player -- stats --url "https://example.com/stream.m3u8"');
  console.log('');
  console.log('도움말: npm run player -- --help');
  process.exit(0);
}

program.parse(); 