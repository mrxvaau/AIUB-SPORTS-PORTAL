#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AIUB Sports Portal — Two-Server Rolling Deploy
# Deploys to server 1 first, verifies, then server 2.
# Usage: ./sync-two-server.sh
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ───
SERVER_1="user@server1-ip"
SERVER_2="user@server2-ip"
APP_DIR="/var/www/aiub-sports-portal"
DEPLOY_SCRIPT="$APP_DIR/deploy/scripts/deploy.sh"
HEALTH_URL_1="http://server1-ip:3000/health"
HEALTH_URL_2="http://server2-ip:3000/health"

echo "═══════════════════════════════════════════"
echo "🔄 Two-Server Rolling Deploy"
echo "═══════════════════════════════════════════"
echo "📡 Server 1: $SERVER_1"
echo "📡 Server 2: $SERVER_2"
echo "⏰ $(date)"
echo ""

# ─── Step 1: Deploy to Server 1 ───
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 Deploying to Server 1..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ssh "$SERVER_1" "cd $APP_DIR && bash $DEPLOY_SCRIPT"

echo ""
echo "🏥 Verifying Server 1 health..."
sleep 3
S1_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL_1" 2>/dev/null || echo "000")
if [ "$S1_STATUS" != "200" ]; then
    echo "❌ Server 1 health check FAILED! Aborting. Server 2 untouched."
    exit 1
fi
echo "✅ Server 1 healthy"

# ─── Step 2: Deploy to Server 2 ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 Deploying to Server 2..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ssh "$SERVER_2" "cd $APP_DIR && bash $DEPLOY_SCRIPT"

echo ""
echo "🏥 Verifying Server 2 health..."
sleep 3
S2_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL_2" 2>/dev/null || echo "000")
if [ "$S2_STATUS" != "200" ]; then
    echo "❌ Server 2 health check FAILED!"
    echo "   Server 1 is still running. Consider rollback on Server 2."
    exit 1
fi
echo "✅ Server 2 healthy"

echo ""
echo "═══════════════════════════════════════════"
echo "✅ Both servers deployed and verified!"
echo "═══════════════════════════════════════════"
