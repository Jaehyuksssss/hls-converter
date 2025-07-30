#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';

async function cleanup() {
  console.log('🧹 HLS 다운로더 파일 정리 시작...');
  
  const currentDir = process.cwd();
  let totalSize = 0;
  let deletedFiles = 0;
  
  try {
    // MP4 파일 삭제
    const mp4Files = await fs.readdir(currentDir);
    for (const file of mp4Files) {
      if (file.endsWith('.mp4')) {
        const filePath = path.join(currentDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        await fs.remove(filePath);
        deletedFiles++;
        console.log(`🗑️ 삭제됨: ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      }
    }
    
    // 임시 디렉토리 삭제
    const tempDir = path.join(currentDir, 'temp');
    if (await fs.pathExists(tempDir)) {
      const tempStats = await fs.stat(tempDir);
      await fs.remove(tempDir);
      console.log(`🗑️ 임시 디렉토리 삭제됨: temp/`);
    }
    
    // TS 파일 삭제 (혹시 남아있다면)
    const tsFiles = await fs.readdir(currentDir);
    for (const file of tsFiles) {
      if (file.endsWith('.ts')) {
        const filePath = path.join(currentDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        await fs.remove(filePath);
        deletedFiles++;
        console.log(`🗑️ 삭제됨: ${file}`);
      }
    }
    
    console.log('');
    console.log('✅ 정리 완료!');
    console.log(`📊 삭제된 파일: ${deletedFiles}개`);
    console.log(`💾 확보된 공간: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('❌ 정리 중 오류 발생:', error.message);
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanup();
}

export { cleanup }; 