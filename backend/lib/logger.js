/**
 * Structured JSON Logger — Production-Ready
 * Uses pino for fast, JSON-native logging compatible with Loki/Grafana/ELK.
 */

const pino = require('pino');

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const SERVER_NAME = process.env.SERVER_NAME || 'app-server-1';
const APP_VERSION = process.env.APP_VERSION || require('../package.json').version;

const transport = process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined; // In production, raw JSON goes to stdout for log aggregators

const logger = pino({
    level: LOG_LEVEL,
    base: {
        server: SERVER_NAME,
        version: APP_VERSION,
        env: process.env.NODE_ENV || 'development'
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(transport ? { transport } : {})
});

module.exports = logger;
