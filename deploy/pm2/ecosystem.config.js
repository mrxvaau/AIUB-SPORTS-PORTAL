// ═══════════════════════════════════════════════════════════
// AIUB Sports Portal — PM2 Ecosystem Configuration
// Zero-downtime deploys, cluster mode, graceful restart
// ═══════════════════════════════════════════════════════════

module.exports = {
    apps: [{
        name: 'aiub-sports-portal',
        script: './server.js',
        cwd: '/var/www/aiub-sports-portal/backend',

        // ─── Cluster Mode ───
        instances: process.env.PM2_INSTANCES || 2,  // Number of workers per server
        exec_mode: 'cluster',

        // ─── Graceful Shutdown ───
        wait_ready: true,           // Wait for process.send('ready') signal
        listen_timeout: 10000,      // 10s to become ready
        kill_timeout: 5000,         // 5s to finish draining after SIGTERM
        shutdown_with_message: true,

        // ─── Auto-Restart ───
        max_memory_restart: '512M', // Restart if memory exceeds 512MB
        autorestart: true,
        max_restarts: 10,
        restart_delay: 1000,        // 1s between restarts

        // ─── Logging ───
        output: '/var/log/aiub-sports-portal/out.log',
        error: '/var/log/aiub-sports-portal/error.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,           // Merge cluster worker logs

        // ─── Environment Variables ───
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },

        // Per-server override (use: pm2 start ecosystem.config.js --env server1)
        env_server1: {
            SERVER_NAME: 'app-server-1',
            WORKER_ENABLED: 'true'      // Only server-1 runs background jobs
        },
        env_server2: {
            SERVER_NAME: 'app-server-2',
            WORKER_ENABLED: 'false'
        },

        // ─── Watch (development only) ───
        watch: false,               // Never watch in production
        ignore_watch: ['node_modules', 'uploads', 'logs', '*.log']
    }]
};
