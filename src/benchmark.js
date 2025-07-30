#!/usr/bin/env node

import HLSDownloader from './hls-downloader.js';
import fs from 'fs-extra';

async function benchmarkDownload(url, options = {}) {
  const startTime = Date.now();
  
  try {
    const downloader = new HLSDownloader(options);
    await downloader.init();
    
    console.log(`🧪 벤치마크 시작: ${url}`);
    console.log(`⚙️ 설정: 동시 다운로드 ${options.maxConcurrent || 5}개, 재시도 ${options.retryAttempts || 3}회`);
    
    // 매니페스트 파싱 시간 측정
    const parseStart = Date.now();
    const segments = await downloader.parseManifest(url);
    const parseTime = Date.now() - parseStart;
    
    console.log(`📊 파싱 완료: ${segments.length}개 세그먼트 (${parseTime}ms)`);
    
    // 다운로드 시간 측정
    const downloadStart = Date.now();
    const segmentFiles = await downloader.downloadSegmentsParallel(segments, segments.length);
    const downloadTime = Date.now() - downloadStart;
    
    const totalTime = Date.now() - startTime;
    const avgSpeed = segments.length / (downloadTime / 1000); // 세그먼트/초
    
    console.log(`📥 다운로드 완료: ${segmentFiles.length}개 세그먼트 (${downloadTime}ms)`);
    console.log(`⚡ 평균 속도: ${avgSpeed.toFixed(2)} 세그먼트/초`);
    console.log(`⏱️ 총 소요 시간: ${totalTime}ms`);
    
    // 임시 파일 정리
    await downloader.cleanup();
    
    return {
      segments: segments.length,
      downloaded: segmentFiles.length,
      parseTime,
      downloadTime,
      totalTime,
      avgSpeed
    };
    
  } catch (error) {
    console.error(`❌ 벤치마크 실패: ${error.message}`);
    throw error;
  }
}

async function runBenchmarks() {
  const testUrl = 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8';
  
  console.log('🚀 HLS 다운로더 성능 벤치마크');
  console.log('=' * 50);
  
  const results = [];
  
  // 순차 다운로드 테스트
  console.log('\n📊 순차 다운로드 테스트');
  try {
    const sequentialResult = await benchmarkDownload(testUrl, {
      maxConcurrent: 1,
      retryAttempts: 3,
      timeout: 30000
    });
    results.push({ name: '순차 다운로드', ...sequentialResult });
  } catch (error) {
    console.error('순차 다운로드 테스트 실패');
  }
  
  // 병렬 다운로드 테스트 (5개)
  console.log('\n📊 병렬 다운로드 테스트 (5개 동시)');
  try {
    const parallel5Result = await benchmarkDownload(testUrl, {
      maxConcurrent: 5,
      retryAttempts: 3,
      timeout: 30000
    });
    results.push({ name: '병렬 다운로드 (5개)', ...parallel5Result });
  } catch (error) {
    console.error('병렬 다운로드 테스트 실패');
  }
  
  // 병렬 다운로드 테스트 (10개)
  console.log('\n📊 병렬 다운로드 테스트 (10개 동시)');
  try {
    const parallel10Result = await benchmarkDownload(testUrl, {
      maxConcurrent: 10,
      retryAttempts: 3,
      timeout: 30000
    });
    results.push({ name: '병렬 다운로드 (10개)', ...parallel10Result });
  } catch (error) {
    console.error('병렬 다운로드 테스트 실패');
  }
  
  // 결과 요약
  console.log('\n📈 벤치마크 결과 요약');
  console.log('=' * 50);
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}`);
    console.log(`   - 세그먼트: ${result.segments}개`);
    console.log(`   - 다운로드: ${result.downloaded}개`);
    console.log(`   - 파싱 시간: ${result.parseTime}ms`);
    console.log(`   - 다운로드 시간: ${result.downloadTime}ms`);
    console.log(`   - 총 시간: ${result.totalTime}ms`);
    console.log(`   - 평균 속도: ${result.avgSpeed.toFixed(2)} 세그먼트/초`);
    console.log('');
  });
  
  // 성능 향상률 계산
  if (results.length >= 2) {
    const sequential = results.find(r => r.name.includes('순차'));
    const parallel = results.find(r => r.name.includes('병렬'));
    
    if (sequential && parallel) {
      const speedup = parallel.avgSpeed / sequential.avgSpeed;
      const timeReduction = ((sequential.totalTime - parallel.totalTime) / sequential.totalTime * 100);
      
      console.log('🎯 성능 향상 분석');
      console.log(`   - 속도 향상: ${speedup.toFixed(2)}배`);
      console.log(`   - 시간 단축: ${timeReduction.toFixed(1)}%`);
    }
  }
}

// 벤치마크 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarks().catch(console.error);
}

export { benchmarkDownload, runBenchmarks }; 