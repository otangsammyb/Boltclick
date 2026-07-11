#!/bin/bash
# ============================================================
# new-tenant.sh — Onboard a new restaurant in < 5 minutes
# Usage: bash scripts/new-tenant.sh restaurant-name port
# Example: bash scripts/new-tenant.sh pizza-palace 3003
# ============================================================

set -e

NAME=$1
PORT=$2

if [ -z "$NAME" ] || [ -z "$PORT" ]; then
  echo "Usage: bash scripts/new-tenant.sh <restaurant-name> <port>"
  exit 1
fi

TARGET_DIR="../${NAME}-bot"

echo "📦  Cloning project for ${NAME}..."
cp -r "$(pwd)" "$TARGET_DIR"

echo "🔧  Creating .env from template..."
cp "$TARGET_DIR/.env.example" "$TARGET_DIR/.env"
sed -i "s/PORT=3000/PORT=${PORT}/" "$TARGET_DIR/.env"
sed -i "s/restaurant_bot/${NAME//-/_}_bot/" "$TARGET_DIR/.env"

echo "🐳  Starting Docker container for ${NAME} on port ${PORT}..."
cd "$TARGET_DIR"
docker compose up -d --build

echo ""
echo "✅  ${NAME} is live on port ${PORT}!"
echo "👉  Edit ${TARGET_DIR}/.env to configure restaurant details."
echo "👉  Add a new server block to nginx/nginx.conf for this port."
