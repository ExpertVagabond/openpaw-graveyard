#!/usr/bin/env node
// Minimal HTTP server for live agent stats
// Serves JSON API + static site files

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT, SOLANA_WALLET } from './config.js';
import * as engine from './engine.js';
import * as tapestry from './tapestry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.join(__dirname, '..', 'site');
const PORT = parseInt(process.env.PORT) || 3456;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
};

// Cache stats for 60s to avoid hammering APIs
let statsCache = null;
let statsCacheTime = 0;
const CACHE_TTL = 60_000;

async function getStats() {
  if (statsCache && Date.now() - statsCacheTime < CACHE_TTL) return statsCache;
  try {
    statsCache = await engine.statsJson();
    statsCacheTime = Date.now();
  } catch (e) {
    statsCache = { error: e.message, timestamp: new Date().toISOString() };
  }
  return statsCache;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API routes
  if (url.pathname === '/api/stats') {
    const stats = await getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(stats, null, 2));
  }

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', agent: AGENT.name, uptime: process.uptime() }));
  }

  // Static file serving
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.join(SITE_DIR, filePath);

  // Prevent directory traversal
  if (!filePath.startsWith(SITE_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`OpenPaw server running at http://localhost:${PORT}`);
  console.log(`  API:  http://localhost:${PORT}/api/stats`);
  console.log(`  Site: http://localhost:${PORT}/`);
});
