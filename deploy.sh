#!/bin/bash
# deploy.sh — запускать на сервере для обновления игры
# Usage: ./deploy.sh
set -e

echo "🚀 Deploying Landlord..."

# Pull latest code
git pull origin main

# Rebuild and restart app container only (DB data stays intact)
docker compose build app
docker compose up -d --no-deps app

echo "✅ Deploy complete! Logs:"
docker compose logs app --tail=20
