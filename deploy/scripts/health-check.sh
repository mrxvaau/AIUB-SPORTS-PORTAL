#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AIUB Sports Portal — Health Check Script
# Usage: ./health-check.sh [url]
# Exit code 0 = healthy, 1 = unhealthy
# ═══════════════════════════════════════════════════════════

HEALTH_URL="${1:-http://localhost:3000/health}"

echo "🏥 Checking: $HEALTH_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HEALTHY (HTTP $HTTP_CODE)"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    exit 0
else
    echo "❌ UNHEALTHY (HTTP $HTTP_CODE)"
    echo "$BODY"
    exit 1
fi
