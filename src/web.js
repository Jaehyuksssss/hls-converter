#!/usr/bin/env node

import WebServer from './web-server.js';

const port = process.env.PORT || 3000;
const server = new WebServer(port);

console.log(' HLS 다운로더 웹 서버 시작');
console.log(` 서버 주소: http://localhost:${port}`);
console.log(' 브라우저에서 위 주소로 접속하세요.');
console.log('⏹  서버 중지: Ctrl+C');

server.start(); 