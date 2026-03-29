/**
 * Worker Guard — Background Job Duplication Prevention
 * 
 * In a multi-server deployment, only ONE server should run background jobs
 * (cron tasks, cleanup jobs, scheduled notifications, etc.).
 * 
 * Usage:
 *   const { isWorker } = require('./lib/worker-guard');
 *   if (isWorker()) {
 *       // Start cron jobs, scheduled tasks, etc.
 *       startCleanupJob();
 *       startReminderJob();
 *   }
 * 
 * Configuration:
 *   Set WORKER_ENABLED=true in .env on ONLY ONE server.
 *   All other servers should have WORKER_ENABLED=false or omit it.
 */

/**
 * Check if this server instance is the designated worker.
 * @returns {boolean}
 */
function isWorker() {
    return process.env.WORKER_ENABLED === 'true';
}

/**
 * Guard wrapper — only executes the callback if this is the worker server.
 * @param {Function} fn - The function to run if this is the worker
 * @param {string} [jobName] - Optional name for logging
 * @returns {*} Result of fn(), or undefined if not worker
 */
function runIfWorker(fn, jobName = 'background job') {
    if (!isWorker()) {
        return undefined;
    }
    const logger = require('./logger');
    logger.info({ job: jobName }, `Starting ${jobName} (this server is the designated worker)`);
    return fn();
}

module.exports = { isWorker, runIfWorker };
