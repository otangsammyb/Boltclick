/**
 * PM2 Ecosystem Config — Production
 * Runs the bot in cluster mode (one worker per CPU core).
 * Usage:  pm2 start ecosystem.config.js --env production
 */
module.exports = {
  apps: [
    {
      name: 'restaurant-bot',
      script: 'src/app.js',

      // ── Cluster mode (utilise all CPU cores) ──────────────────────
      instances: 'max',   // or a fixed number e.g. 4
      exec_mode: 'cluster',

      // ── Environment ───────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // ── Reliability ───────────────────────────────────────────────
      watch: false,                    // never watch in production
      max_memory_restart: '512M',      // auto-restart if RAM exceeds 512 MB
      restart_delay: 3000,             // wait 3 s between restarts
      max_restarts: 10,                // give up after 10 consecutive crashes
      exp_backoff_restart_delay: 100,  // exponential back-off on crashes

      // ── Logging ───────────────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-err.log',
      merge_logs: true,

      // ── Graceful shutdown ─────────────────────────────────────────
      kill_timeout: 5000,    // wait up to 5 s for in-flight requests to finish
      listen_timeout: 8000,  // max time PM2 waits for the app to start
    },
  ],
};
