#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AIUB Sports Portal — Zero-Downtime Deploy Script
# Usage: ./deploy.sh [server1|server2|all]
# ═══════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/var/www/aiub-sports-portal"
REPO_BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_URL="http://localhost:3000/health"
MAX_HEALTH_RETRIES=10
HEALTH_RETRY_INTERVAL=3

echo "═══════════════════════════════════════════"
echo "🚀 AIUB Sports Portal — Deploy"
echo "═══════════════════════════════════════════"
echo "📁 App dir: $APP_DIR"
echo "🌿 Branch: $REPO_BRANCH"
echo "⏰ $(date)"
echo ""

# ─── Step 1: Pull Latest Code ───
echo "📥 Pulling latest code..."
cd "$APP_DIR"
git fetch origin "$REPO_BRANCH"
git reset --hard "origin/$REPO_BRANCH"
echo "✅ Code updated"

# ─── Step 2: Install Dependencies ───
echo "📦 Installing backend dependencies..."
cd "$APP_DIR/backend"
npm ci --production
echo "✅ Dependencies installed"

# ─── Step 3: Zero-Downtime Reload ───
echo "♻️  Reloading PM2 (zero-downtime)..."
pm2 reload ecosystem.config.js --update-env
echo "✅ PM2 reloaded"

# ─── Step 4: Health Check ───
echo "🏥 Running health check..."
sleep 2

for i in $(seq 1 $MAX_HEALTH_RETRIES); do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "✅ Health check passed (HTTP $HTTP_STATUS)"
        HEALTH_RESPONSE=$(curl -s "$HEALTH_URL")
        echo "   $HEALTH_RESPONSE"
        break
    fi
    echo "   Attempt $i/$MAX_HEALTH_RETRIES — HTTP $HTTP_STATUS, retrying in ${HEALTH_RETRY_INTERVAL}s..."
    sleep $HEALTH_RETRY_INTERVAL
done

if [ "$HTTP_STATUS" != "200" ]; then
    echo "❌ Health check FAILED after $MAX_HEALTH_RETRIES attempts!"
    echo "   Consider rolling back: ./rollback.sh"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════"
echo "✅ Deploy complete!"
echo "═══════════════════════════════════════════"
