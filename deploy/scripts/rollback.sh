#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AIUB Sports Portal — Rollback Script
# Reverts to the previous git commit and reloads PM2.
# Usage: ./rollback.sh [commit_hash]
# ═══════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/var/www/aiub-sports-portal"
HEALTH_URL="http://localhost:3000/health"
ROLLBACK_TARGET="${1:-HEAD~1}"

echo "═══════════════════════════════════════════"
echo "⏪ AIUB Sports Portal — Rollback"
echo "═══════════════════════════════════════════"
echo "🎯 Rolling back to: $ROLLBACK_TARGET"
echo "⏰ $(date)"
echo ""

# ─── Step 1: Rollback Code ───
cd "$APP_DIR"
CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo "📍 Current commit: $CURRENT_COMMIT"

git reset --hard "$ROLLBACK_TARGET"
NEW_COMMIT=$(git rev-parse --short HEAD)
echo "📍 Rolled back to: $NEW_COMMIT"

# ─── Step 2: Reinstall Dependencies ───
echo "📦 Reinstalling dependencies..."
cd "$APP_DIR/backend"
npm ci --production

# ─── Step 3: Reload PM2 ───
echo "♻️  Reloading PM2..."
pm2 reload ecosystem.config.js --update-env

# ─── Step 4: Health Check ───
echo "🏥 Verifying health..."
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Rollback successful! Server healthy."
    curl -s "$HEALTH_URL" | python3 -m json.tool 2>/dev/null || curl -s "$HEALTH_URL"
else
    echo "❌ Health check failed after rollback (HTTP $HTTP_STATUS)"
    echo "   Manual intervention required!"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════"
echo "✅ Rollback complete: $CURRENT_COMMIT → $NEW_COMMIT"
echo "═══════════════════════════════════════════"
