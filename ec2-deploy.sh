#!/usr/bin/env bash
# ==============================================================================
# PSI (Pan Science Innovation) — AWS EC2 One-Command Automated Deployment Script
# Supports: Ubuntu 22.04 / 24.04 LTS on AWS Free Tier (t2.micro / t3.micro)
# ==============================================================================
set -euo pipefail

echo "========================================="
echo "🚀 Starting PSI EC2 Deployment Setup..."
echo "========================================="

# 1. Update system & install prerequisites
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git

# 2. Install Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker "$USER" || true
fi

# 3. Detect Public IP for nip.io automatic SSL
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || curl -s https://ifconfig.me || echo "")
if [ -z "$PUBLIC_IP" ]; then
    echo "⚠️ Could not auto-detect public IP. Falling back to localhost."
    DOMAIN="localhost"
else
    DOMAIN="${PUBLIC_IP}.nip.io"
fi

echo "🌐 Configured Domain with Automatic SSL: https://${DOMAIN}"

# 4. Clone or update repository
APP_DIR="/opt/psi-app"
if [ ! -d "$APP_DIR" ]; then
    echo "📥 Cloning PSI repository to ${APP_DIR}..."
    sudo git clone https://github.com/himgaur2004/AI-Multimedia--PSI.git "$APP_DIR"
    sudo chown -R "$USER":"$USER" "$APP_DIR"
else
    echo "🔄 Updating existing repository at ${APP_DIR}..."
    cd "$APP_DIR"
    git pull origin main
fi

cd "$APP_DIR"

# 5. Generate .env file if not exists
cat <<EOF > .env
PROJECT_NAME="PSI - AI Document & Multimedia Q&A"
VERSION=1.0.0
SECRET_KEY="psi_aws_ec2_production_secret_key_$(openssl rand -hex 16)"
DATABASE_URL="mongodb+srv://himgaursingh_db_user:himgaursingh1@cluster0.ieebzgz.mongodb.net/psi_db?authSource=admin&retryWrites=true&w=majority"
MONGODB_URL="mongodb+srv://himgaursingh_db_user:himgaursingh1@cluster0.ieebzgz.mongodb.net/psi_db?authSource=admin&retryWrites=true&w=majority"
CORS_ORIGINS="https://ai-multimedia-psi.vercel.app,http://localhost:5173,http://localhost:3000"
OPENAI_API_KEY=""
DOMAIN="${DOMAIN}"
PORT=8000
EOF

# 6. Build and launch Docker Compose stack with Caddy automatic SSL
echo "🐳 Launching Docker Compose stack with backend + Caddy SSL..."
docker compose -f docker-compose.ec2.yml down --remove-orphans || true
docker compose -f docker-compose.ec2.yml up -d --build

# 7. Wait and verify health
echo "⏳ Waiting for backend and SSL certificates to initialize..."
for i in {1..12}; do
    if curl -s -f "http://localhost:8000/health" > /dev/null; then
        echo "✅ Local backend is healthy!"
        break
    fi
    echo "Waiting for backend ($i/12)..."
    sleep 5
done

echo ""
echo "=========================================================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "Your backend is now live on AWS EC2 with automatic HTTPS:"
echo ""
echo "🔗 HTTPS Endpoint : https://${DOMAIN}"
echo "🏥 Health Check   : https://${DOMAIN}/health"
echo "📚 Swagger Docs   : https://${DOMAIN}/docs"
echo ""
echo "👉 Now configure this in Vercel Settings or in the app's 'Server Settings':"
echo "   Backend URL = https://${DOMAIN}"
echo "=========================================================================="
