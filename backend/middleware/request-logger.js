/**
 * Request Logger Middleware
 * Structured logging for every HTTP request with timing, request ID, and user context.
 * Compatible with Loki, Grafana, ELK, Cloudflare Logs.
 */

const crypto = require('crypto');

/**
 * Creates request logging middleware.
 * @param {object} logger - Pino logger instance
 * @returns {Function} Express middleware
 */
function createRequestLogger(logger) {
    return function requestLogger(req, res, next) {
        // Generate or pass-through request ID (Cloudflare/LB may set one)
        const requestId = req.headers['x-request-id']
            || req.headers['cf-ray']  // Cloudflare ray ID
            || crypto.randomUUID();

        req.id = requestId;
        res.setHeader('X-Request-ID', requestId);

        const startTime = process.hrtime.bigint();

        // Log after response is sent
        res.on('finish', () => {
            const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
            const logData = {
                reqId: requestId,
                method: req.method,
                path: req.originalUrl || req.url,
                status: res.statusCode,
                duration: Math.round(durationMs * 100) / 100,
                ip: req.ip || req.connection?.remoteAddress,
                userAgent: req.headers['user-agent'],
            };

            // Attach user context if available
            if (req.user) {
                logData.userId = req.user.id;
                logData.studentId = req.user.studentId;
            }
            if (req.admin) {
                logData.adminRoles = req.admin.roles;
            }

            // Log level based on status code
            if (res.statusCode >= 500) {
                logger.error(logData, `${req.method} ${req.originalUrl} ${res.statusCode}`);
            } else if (res.statusCode >= 400) {
                logger.warn(logData, `${req.method} ${req.originalUrl} ${res.statusCode}`);
            } else {
                logger.info(logData, `${req.method} ${req.originalUrl} ${res.statusCode}`);
            }
        });

        next();
    };
}

module.exports = { createRequestLogger };
