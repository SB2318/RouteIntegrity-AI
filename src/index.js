/**
 * index.js — RouteIntegrity AI Express Server
 */

import 'dotenv/config';
import express from 'express';
import webhookRouter from './webhook.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ?? 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'RouteIntegrity AI', timestamp: new Date().toISOString() });
});

// LLM Webhook / API
app.use('/api', webhookRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route does not exist' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛡️  RouteIntegrity AI running on http://localhost:${PORT}`);
  console.log(`   POST /webhook/analyze-trip`);
  console.log(`   GET  /health\n`);
});
