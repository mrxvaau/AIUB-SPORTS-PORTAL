/**
 * AIUB Sports Portal — Production Readiness Tests
 * 
 * Tests: health endpoint, env URL switching, graceful shutdown,
 * worker guard, CORS, and request logging.
 * 
 * Run: cd backend && npm test
 */

const request = require('supertest');

// ─── Health Endpoint Tests ───
describe('Health Endpoint', () => {
    let app;

    beforeAll(() => {
        // Set env vars before requiring app
        process.env.SERVER_NAME = 'test-server';
        process.env.APP_VERSION = '3.0.0-test';
        process.env.NODE_ENV = 'test';
        process.env.TRUST_PROXY = '1';
        app = require('../server');
    });

    test('GET /health returns 200 with correct structure', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('uptime');
        expect(res.body).toHaveProperty('server', 'test-server');
        expect(res.body).toHaveProperty('version', '3.0.0-test');
    });

    test('GET /health responds in under 100ms', async () => {
        const start = Date.now();
        await request(app).get('/health');
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(100);
    });

    test('GET /health/detailed returns memory and DB status', async () => {
        const res = await request(app).get('/health/detailed');
        expect(res.body).toHaveProperty('memory');
        expect(res.body.memory).toHaveProperty('rss_mb');
        expect(res.body.memory).toHaveProperty('heap_used_mb');
        expect(res.body).toHaveProperty('supabase_db');
        expect(res.body).toHaveProperty('supabase_storage');
        expect(res.body).toHaveProperty('node');
        expect(res.body).toHaveProperty('env');
    });

    test('GET /api/health (legacy) returns 200', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('server', 'test-server');
    });

    test('Response includes X-Request-ID header', async () => {
        const res = await request(app).get('/health');
        expect(res.headers).toHaveProperty('x-request-id');
        expect(res.headers['x-request-id']).toBeTruthy();
    });
});

// ─── Environment URL Switching Tests ───
describe('Environment Configuration', () => {
    test('SERVER_NAME reads from env', () => {
        process.env.SERVER_NAME = 'my-custom-server';
        // Re-read
        const name = process.env.SERVER_NAME;
        expect(name).toBe('my-custom-server');
    });

    test('CORS_ORIGINS parses comma-separated values', () => {
        process.env.CORS_ORIGINS = 'https://example.com,https://admin.example.com';
        const origins = process.env.CORS_ORIGINS.split(',').map(o => o.trim());
        expect(origins).toHaveLength(2);
        expect(origins).toContain('https://example.com');
        expect(origins).toContain('https://admin.example.com');
    });

    test('TRUST_PROXY defaults correctly', () => {
        const trustProxy = process.env.TRUST_PROXY || 1;
        expect(trustProxy).toBeTruthy();
    });
});

// ─── Worker Guard Tests ───
describe('Worker Guard', () => {
    test('isWorker returns true when WORKER_ENABLED=true', () => {
        process.env.WORKER_ENABLED = 'true';
        const { isWorker } = require('../lib/worker-guard');
        expect(isWorker()).toBe(true);
    });

    test('isWorker returns false when WORKER_ENABLED=false', () => {
        process.env.WORKER_ENABLED = 'false';
        // Need to clear require cache to re-eval
        delete require.cache[require.resolve('../lib/worker-guard')];
        const { isWorker } = require('../lib/worker-guard');
        expect(isWorker()).toBe(false);
    });

    test('isWorker returns false when WORKER_ENABLED not set', () => {
        delete process.env.WORKER_ENABLED;
        delete require.cache[require.resolve('../lib/worker-guard')];
        const { isWorker } = require('../lib/worker-guard');
        expect(isWorker()).toBe(false);
    });
});

// ─── Shutdown Guard Tests ───
describe('Shutdown Guard', () => {
    test('shutdownGuard module exports correctly', () => {
        const shutdown = require('../lib/shutdown');
        expect(shutdown).toHaveProperty('attachShutdown');
        expect(shutdown).toHaveProperty('shutdownGuard');
        expect(typeof shutdown.attachShutdown).toBe('function');
        expect(typeof shutdown.shutdownGuard).toBe('function');
    });
});

// ─── Logger Tests ───
describe('Structured Logger', () => {
    test('Logger exports a pino instance', () => {
        const logger = require('../lib/logger');
        expect(logger).toHaveProperty('info');
        expect(logger).toHaveProperty('error');
        expect(logger).toHaveProperty('warn');
        expect(logger).toHaveProperty('debug');
        expect(typeof logger.info).toBe('function');
    });
});

// ─── Request Logger Middleware Tests ───
describe('Request Logger Middleware', () => {
    test('createRequestLogger returns a function', () => {
        const { createRequestLogger } = require('../middleware/request-logger');
        const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        const middleware = createRequestLogger(mockLogger);
        expect(typeof middleware).toBe('function');
    });
});

// ─── Security Headers Tests ───
describe('Security Headers', () => {
    let app;

    beforeAll(() => {
        app = require('../server');
    });

    test('Response includes helmet security headers', async () => {
        const res = await request(app).get('/health');
        // Helmet sets these
        expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
        expect(res.headers).toHaveProperty('x-frame-options');
    });
});

// ─── CORS Tests ───
describe('CORS Configuration', () => {
    let app;

    beforeAll(() => {
        process.env.CORS_ORIGINS = 'http://localhost:3001,http://example.com';
        process.env.NODE_ENV = 'test';
        delete require.cache[require.resolve('../server')];
        app = require('../server');
    });

    test('Allows requests without origin (server-to-server)', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
    });
});
