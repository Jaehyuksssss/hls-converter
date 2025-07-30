#!/usr/bin/env node

import HLSDownloader from './hls-downloader.js';
import VideoConverter from './video-converter.js';

async function testHLSDownloader() {
  console.log(' HLS 다운로더 테스트 시작');
  
  try {
    // HLS 다운로더 테스트
    const downloader = new HLSDownloader();
    await downloader.init();
    
    console.log(' HLS 다운로더 초기화 성공');
    
    // VideoConverter 테스트
    const converter = new VideoConverter();
    console.log(' VideoConverter 초기화 성공');
    
    // 품질 설정 테스트
    const qualitySettings = converter.getQualitySettings('medium');
    console.log(' 품질 설정 테스트 성공:', qualitySettings);
    
    console.log(' 모든 테스트 통과!');
    
  } catch (error) {
    console.error(' 테스트 실패:', error.message);
    process.exit(1);
  }
}

// 테스트 실행
testHLSDownloader(); 