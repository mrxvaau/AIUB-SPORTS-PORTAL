/**
 * Graceful Shutdown Handler
 * Handles SIGTERM/SIGINT for zero-downtime deploys with PM2/Docker.
 * Drains active connections before exiting.
 */

const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT, 10) || 10000; // 10s default

let isShuttingDown = false;

/**
 * Attach graceful shutdown to an HTTP server instance.
 * @param {import('http').Server} server - The HTTP server from app.listen()
 * @param {object} [options]
 * @param {Function} [options.onShutdown] - Async cleanup function (close DB, flush logs, etc.)
 * @param {object} [options.logger] - Logger instance (defaults to console)
 */
function attachShutdown(server, options = {}) {
    const log = options.logger || console;
    const cleanup = options.onShutdown || (() => Promise.resolve());

    async function gracefulShutdown(signal) {
        if (isShuttingDown) return;
        isShuttingDown = true;

        log.info ? log.info({ signal }, `Received ${signal}. Starting graceful shutdown...`)
            : log.log(`Received ${signal}. Starting graceful shutdown...`);

        // Stop accepting new connections
        server.close(async () => {
            try {
                await cleanup();
                log.info ? log.info('Cleanup complete. Exiting.')
                    : log.log('Cleanup complete. Exiting.');
                process.exit(0);
            } catch (err) {
                log.error ? log.error({ err }, 'Error during cleanup')
                    : log.error('Error during cleanup:', err);
                process.exit(1);
            }
        });

        // Force exit if draining takes too long
        setTimeout(() => {
            log.warn ? log.warn(`Shutdown timeout (${SHUTDOWN_TIMEOUT}ms) reached. Forcing exit.`)
                : log.warn(`Shutdown timeout (${SHUTDOWN_TIMEOUT}ms) reached. Forcing exit.`);
            process.exit(1);
        }, SHUTDOWN_TIMEOUT).unref();
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Windows-specific: handle Ctrl+C
    if (process.platform === 'win32') {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.on('SIGINT', () => process.emit('SIGINT'));
    }
}

/**
 * Middleware to reject requests during shutdown (503 Service Unavailable).
 */
function shutdownGuard(req, res, next) {
    if (isShuttingDown) {
        res.set('Connection', 'close');
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Server is shutting down. Please retry.'
        });
    }
    next();
}

module.exports = { attachShutdown, shutdownGuard };
