#!/bin/bash

set -e

PROJECT_DIR="/home/xor/Code/GSD"
BRANCH="Development"

echo "======================================"
echo "🚀 Deploying GSD"
echo "======================================"

cd "$PROJECT_DIR"

echo ""
echo "📥 Pulling latest code..."
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo ""
echo "🐳 Building new images (old containers keep serving traffic)..."
docker compose build

echo ""
echo "🔄 Swapping to new containers..."
docker compose up -d

echo ""
echo "⏳ Waiting for backend to come up..."
for i in $(seq 1 20); do
    if curl -fsS http://127.0.0.1:4000/api/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo ""
echo "🗃️ Running database setup..."
docker exec life-rpg-backend npm run db:generate
docker exec life-rpg-backend npm run db:push

echo ""
echo "🔍 Docker status..."
docker compose ps

echo ""
echo "🔍 Checking backend..."
if curl -fsS http://127.0.0.1:4000/api/health > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    echo ""
    echo "Backend logs:"
    docker logs life-rpg-backend --tail 50
    exit 1
fi

echo ""
echo "🔍 Checking frontend..."
if curl -fsS http://127.0.0.1:3000 > /dev/null; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend health check failed"
    echo ""
    echo "Frontend logs:"
    docker logs life-rpg-frontend --tail 50
    exit 1
fi

echo ""
echo "🔍 Checking API tunnel..."
if curl -fsS https://gsd-api.xorlabs.dev/api/health > /dev/null; then
    echo "✅ API tunnel is healthy"
else
    echo "❌ API tunnel health check failed"
    sudo systemctl status cloudflared --no-pager
    exit 1
fi

echo ""
echo "======================================"
echo "✅ GSD DEPLOYMENT SUCCESSFUL"
echo "======================================"

echo ""
echo "🌐 Website: https://gsd.xorlabs.dev"
echo "🔌 API:     https://gsd-api.xorlabs.dev"
echo ""
