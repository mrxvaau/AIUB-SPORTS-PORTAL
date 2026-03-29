/**
 * Enterprise Health Check Routes
 * 
 * GET /health          — Lightweight probe for LB/Cloudflare (no auth)
 * GET /health/detailed — Full diagnostics (admin auth required)
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

const startTime = Date.now();
const SERVER_NAME = process.env.SERVER_NAME || 'app-server-1';
const APP_VERSION = process.env.APP_VERSION || require('../package.json').version;

/**
 * Lightweight health check — for load balancers, Cloudflare, Nginx, PM2.
 * Must respond < 200ms. No DB calls.
 */
router.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        server: SERVER_NAME,
        version: APP_VERSION
    });
});

/**
 * Detailed health check — includes DB, Storage, memory.
 * Protected in production (should be behind admin auth or IP whitelist).
 */
router.get('/detailed', async (req, res) => {
    const checks = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        server: SERVER_NAME,
        version: APP_VERSION,
        node: process.version,
        env: process.env.NODE_ENV || 'development',
        memory: {},
        supabase_db: { status: 'unknown' },
        supabase_storage: { status: 'unknown' }
    };

    // Memory usage
    const mem = process.memoryUsage();
    checks.memory = {
        rss_mb: Math.round(mem.rss / 1024 / 1024),
        heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        external_mb: Math.round(mem.external / 1024 / 1024)
    };

    // Supabase DB check
    try {
        const dbStart = Date.now();
        const { error } = await supabase.from('users').select('id').limit(1);
        const dbLatency = Date.now() - dbStart;
        if (error) throw error;
        checks.supabase_db = { status: 'ok', latency_ms: dbLatency };
    } catch (err) {
        checks.supabase_db = { status: 'error', message: err.message };
        checks.status = 'degraded';
    }

    // Supabase Storage check
    try {
        const storageStart = Date.now();
        const { error } = await supabase.storage.listBuckets();
        const storageLatency = Date.now() - storageStart;
        if (error) throw error;
        checks.supabase_storage = { status: 'ok', latency_ms: storageLatency };
    } catch (err) {
        checks.supabase_storage = { status: 'error', message: err.message };
        checks.status = 'degraded';
    }

    const httpStatus = checks.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(checks);
});

module.exports = router;
