# 📘 AIUB Sports Portal — Production Deployment Guide

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Domain Day Checklist](#domain-day-checklist)
- [Two-Server HA Deployment](#two-server-ha-deployment)
- [Cloudflare Setup](#cloudflare-setup)
- [Nginx Configuration](#nginx-configuration)
- [PM2 Configuration](#pm2-configuration)
- [Rollback Plan](#rollback-plan)
- [Failover Test Guide](#failover-test-guide)
- [Monitoring](#monitoring)

---

## Architecture Overview

```
                    ┌──────────────────┐
                    │   Cloudflare     │
                    │   (CDN + WAF)    │
                    │   SSL/TLS Term.  │
                    └───────┬──────────┘
                            │ HTTPS
                    ┌───────▼──────────┐
                    │   Cloudflare     │
                    │   Load Balancer  │
                    └───────┬──────────┘
                            │ HTTP
              ┌─────────────┼─────────────┐
              │                           │
     ┌────────▼─────────┐       ┌────────▼─────────┐
     │    Server 1       │       │    Server 2       │
     │  ┌─────────────┐ │       │  ┌─────────────┐ │
     │  │   Nginx     │ │       │  │   Nginx     │ │
     │  │ (Rev.Proxy) │ │       │  │ (Rev.Proxy) │ │
     │  └──────┬──────┘ │       │  └──────┬──────┘ │
     │         │        │       │         │        │
     │  ┌──────▼──────┐ │       │  ┌──────▼──────┐ │
     │  │   PM2       │ │       │  │   PM2       │ │
     │  │ (Cluster x2)│ │       │  │ (Cluster x2)│ │
     │  └──────┬──────┘ │       │  └──────┬──────┘ │
     │         │        │       │         │        │
     │  ┌──────▼──────┐ │       │  ┌──────▼──────┐ │
     │  │  Node.js    │ │       │  │  Node.js    │ │
     │  │  Express    │ │       │  │  Express    │ │
     │  │  (Worker)   │ │       │  │  (Standby)  │ │
     │  └─────────────┘ │       │  └─────────────┘ │
     └──────────────────┘       └──────────────────┘
              │                           │
              └─────────┬─────────────────┘
                        │
               ┌────────▼─────────┐
               │    Supabase      │
               │  ┌────────────┐  │
               │  │ PostgreSQL │  │
               │  │ Storage    │  │
               │  │ Auth       │  │
               │  │ Realtime   │  │
               │  └────────────┘  │
               └──────────────────┘
```

**Key design decisions:**
- **Stateless app servers** — no local file storage, no in-memory sessions
- **Supabase handles all state** — DB, files, auth, realtime
- **Worker role** — only Server 1 runs background jobs (`WORKER_ENABLED=true`)
- **Cloudflare terminates SSL** — Nginx receives HTTP

---

## Domain Day Checklist

> **When you buy the domain, these are the ONLY steps needed:**

### Step 1: Update DNS (Cloudflare)
```
Type    Name              Content              Proxy
A       sportsportal.com  SERVER_1_IP          ✅ Proxied
A       sportsportal.com  SERVER_2_IP          ✅ Proxied (LB)
CNAME   www               sportsportal.com     ✅ Proxied
```

### Step 2: Update `.env` on BOTH Servers
```bash
# Change these values in backend/.env:
NODE_ENV=production
FRONTEND_URL=https://sportsportal.com
CORS_ORIGINS=https://sportsportal.com,https://www.sportsportal.com
COOKIE_DOMAIN=.sportsportal.com
AZURE_REDIRECT_URI=https://sportsportal.com/callback
LOG_LEVEL=info
JWT_SECRET=<generate-new-64-char-secret>

# Server 1 only:
SERVER_NAME=app-server-1
WORKER_ENABLED=true

# Server 2 only:
SERVER_NAME=app-server-2
WORKER_ENABLED=false
```

### Step 3: Update Azure AD
1. Go to Azure Portal → App Registrations → AIUB Sports Portal
2. Under **Authentication**, update redirect URI:
   - Remove: `http://localhost:3001/callback`
   - Add: `https://sportsportal.com/callback`

### Step 4: Update Nginx
```bash
# On both servers, edit /etc/nginx/sites-available/aiub-sports-portal
# Change: server_name _;
# To:     server_name sportsportal.com www.sportsportal.com;
nginx -t && sudo systemctl reload nginx
```

### Step 5: Deploy & Verify
```bash
# From your deploy machine:
cd deploy/scripts
./sync-two-server.sh

# Verify both servers:
./health-check.sh https://sportsportal.com/health
```

### Step 6: Smoke Test
- [ ] Login with Microsoft account
- [ ] Dashboard loads
- [ ] Admin dashboard loads
- [ ] Create tournament (image upload)
- [ ] Register for a game
- [ ] View bracket
- [ ] Check scheduling page

---

## Two-Server HA Deployment

### Initial Server Setup (both servers)

```bash
# 1. Install Node.js 18+ (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install PM2 globally
sudo npm install -g pm2

# 3. Install Nginx
sudo apt-get install -y nginx

# 4. Create app directory
sudo mkdir -p /var/www/aiub-sports-portal
sudo chown $USER:$USER /var/www/aiub-sports-portal

# 5. Clone repository
cd /var/www/aiub-sports-portal
git clone YOUR_REPO_URL .

# 6. Install dependencies
cd backend
npm ci --production

# 7. Create .env from template
cp /var/www/aiub-sports-portal/.env.example /var/www/aiub-sports-portal/backend/.env
# Edit .env with production values

# 8. Create log directory
sudo mkdir -p /var/log/aiub-sports-portal
sudo chown $USER:$USER /var/log/aiub-sports-portal

# 9. Setup Nginx
sudo cp /var/www/aiub-sports-portal/deploy/nginx/aiub-sports-portal.conf \
    /etc/nginx/sites-available/aiub-sports-portal
sudo ln -s /etc/nginx/sites-available/aiub-sports-portal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 10. Start with PM2
cd /var/www/aiub-sports-portal/backend
pm2 start /var/www/aiub-sports-portal/deploy/pm2/ecosystem.config.js --env server1
# On server 2: --env server2

# 11. PM2 startup on reboot
pm2 startup
pm2 save
```

### Rolling Deploy Process

```bash
# Always deploy server-by-server:
# 1. Deploy to server 1, verify health
# 2. Only then deploy to server 2

./deploy/scripts/sync-two-server.sh
```

---

## Cloudflare Setup

### Cloudflare Tunnel (Alternative to public IP)

If your servers don't have public IPs:

```bash
# 1. Install cloudflared on both servers
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# 2. Authenticate
cloudflared tunnel login

# 3. Create tunnel (one per server)
cloudflared tunnel create aiub-server-1
cloudflared tunnel create aiub-server-2

# 4. Configure tunnel
cat > ~/.cloudflared/config.yml << EOF
tunnel: YOUR_TUNNEL_ID
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json
ingress:
  - hostname: sportsportal.com
    service: http://localhost:80
  - service: http_status:404
EOF

# 5. Run as service
sudo cloudflared service install
sudo systemctl start cloudflared
```

### Cloudflare Load Balancer

1. Go to **Traffic → Load Balancing**
2. Create a pool with both server origins
3. Set health check path: `/health`
4. Expected response code: `200`
5. Check interval: `30s`
6. Enable **Session Affinity** if needed (not required — app is stateless)

---

## Nginx Configuration

The pre-built config is at `deploy/nginx/aiub-sports-portal.conf`.

Key features:
- **Rate limiting**: 30 req/s for API, 5 req/s for auth
- **Upstream with health checks**: Auto-removes failed backends
- **Proxy headers**: Real IP, forwarded-for, forwarded-proto
- **Static file caching**: 7-day cache for assets
- **WebSocket support**: Ready for future Supabase Realtime proxy

### Testing Nginx Config
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## PM2 Configuration

### Commands Reference
```bash
# Start
pm2 start ecosystem.config.js --env server1

# Zero-downtime reload
pm2 reload aiub-sports-portal

# Stop
pm2 stop aiub-sports-portal

# Status
pm2 status

# Logs
pm2 logs aiub-sports-portal --lines 50

# Monitor
pm2 monit

# Auto-start on reboot
pm2 startup
pm2 save
```

### Cluster Mode
- Each server runs 2 PM2 workers (configurable via `PM2_INSTANCES`)
- `wait_ready: true` ensures new workers are ready before old ones die
- `kill_timeout: 5000` gives 5 seconds for graceful shutdown

---

## Rollback Plan

### Quick Rollback
```bash
# Rollback to previous commit
./deploy/scripts/rollback.sh

# Rollback to specific commit
./deploy/scripts/rollback.sh abc1234
```

### Two-Server Rollback
```bash
# Server 1
ssh server1 "cd /var/www/aiub-sports-portal && bash deploy/scripts/rollback.sh"
./deploy/scripts/health-check.sh http://server1-ip:3000/health

# Server 2
ssh server2 "cd /var/www/aiub-sports-portal && bash deploy/scripts/rollback.sh"
./deploy/scripts/health-check.sh http://server2-ip:3000/health
```

---

## Failover Test Guide

### Test 1: Single Server Failure
```bash
# Stop server 1
ssh server1 "pm2 stop aiub-sports-portal"
# Verify: all traffic should route to server 2
curl https://sportsportal.com/health
# Restart server 1
ssh server1 "pm2 start aiub-sports-portal"
```

### Test 2: Rolling Restart
```bash
# This should cause zero downtime
pm2 reload aiub-sports-portal
```

### Test 3: Memory Limit Restart
```bash
# Workers exceeding 512MB will auto-restart
# Monitor: pm2 monit
```

### Test 4: Graceful Shutdown
```bash
# Send SIGTERM — should drain active requests
kill -SIGTERM $(pm2 pid aiub-sports-portal)
# Watch logs: should see "Starting graceful shutdown..."
```

---

## Monitoring

### Health Endpoints
| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `GET /health` | LB probe (fast) | No |
| `GET /health/detailed` | Full diagnostics | No (protect via IP whitelist) |
| `GET /api/health` | Legacy health | No |

### Log Aggregation
Logs are structured JSON (pino), ready for:
- **Loki + Grafana**: Forward PM2 logs via promtail
- **ELK**: Forward via filebeat
- **Cloudflare Logs**: Enable in Cloudflare dashboard

### Key Metrics to Monitor
- Response time (p50, p95, p99)
- Error rate (5xx)
- Memory usage per worker
- Supabase connection latency (from `/health/detailed`)
- PM2 restart count (`pm2 status`)
