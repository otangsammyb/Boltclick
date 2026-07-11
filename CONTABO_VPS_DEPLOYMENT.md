# 🚀 Contabo VPS — Complete Deployment Guide
### Restaurant WhatsApp Bot · Docker Compose · Self-Hosted MongoDB · Free SSL

> **Chosen method: Docker Compose**
> One command starts Node.js + MongoDB + Nginx together. No dependency conflicts, easy updates, zero MongoDB Atlas fees.

---

## 📦 What You Need Before Starting

| Item | Details |
|---|---|
| Contabo VPS | **Cloud VPS S** minimum (4 vCPU / 8 GB RAM / 200 GB SSD) |
| OS | Ubuntu 22.04 LTS (pick this when ordering) |
| Domain | Any domain name (e.g. `myrestaurant.com`) |
| SSH Client | Windows Terminal, PuTTY, or VS Code Remote SSH |
| Your [.env](file:///c:/Users/Administrateur/Desktop/restaurant%20bot/.env) file | Filled-in copy from [.env.example](file:///c:/Users/Administrateur/Desktop/restaurant%20bot/.env.example) |

---

## 🛒 Step 0 — Order Your Contabo VPS

1. Go to **[contabo.com](https://contabo.com)** → Cloud VPS → select **Cloud VPS S**
2. Choose **Ubuntu 22.04** as the operating system
3. Set a **root password** (save it — Contabo will also email it)
4. Complete checkout
5. Wait ~15 minutes — Contabo will email you with:
   - Your **VPS IP address** (e.g. `185.x.x.x`)
   - Your root password

---

## 🔐 Step 1 — First Login

Open **Windows Terminal** and connect:

```bash
ssh root@YOUR_VPS_IP
# Enter the root password from the Contabo email
```

Once connected, update the system:

```bash
apt update && apt upgrade -y && apt autoremove -y
```

---

## 👤 Step 2 — Create a Non-Root User

Running everything as `root` is unsafe. Create a regular user:

```bash
# Create user (replace 'botadmin' with any name you like)
adduser botadmin
# You'll be asked to set a password — use a strong one

# Give it sudo privileges
usermod -aG sudo botadmin

# Switch to the new user
su - botadmin
```

From now on, all commands run as `botadmin`. If you disconnect and reconnect, SSH in as:

```bash
ssh botadmin@YOUR_VPS_IP
```

---

## 🛡️ Step 3 — Firewall Setup (UFW)

```bash
sudo apt install ufw -y

# Block everything by default
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow only SSH, HTTP and HTTPS
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (needed for SSL certificate generation)
sudo ufw allow 443/tcp   # HTTPS

# Turn the firewall on
sudo ufw enable

# Confirm
sudo ufw status
```

Expected output:
```
Status: active
To                         Action      From
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

> [!CAUTION]
> **Never** open port `27017` (MongoDB). It stays inside Docker's private network, invisible to the internet.

---

## 🔑 Step 4 — Set Up SSH Key Login (Optional but Recommended)

This lets you log in without typing a password every time.

On your **Windows machine** (open a NEW terminal — not the VPS one):

```powershell
# Generate an SSH key pair (skip if you already have one)
ssh-keygen -t ed25519 -C "your@email.com"
# Press Enter for all prompts to use defaults

# Copy your public key to the VPS
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh botadmin@YOUR_VPS_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

Now you can SSH in without a password:
```bash
ssh botadmin@YOUR_VPS_IP
```

---

## 🌐 Step 5 — Point Your Domain to the VPS

In your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.):

| Record Type | Name | Value |
|---|---|---|
| `A` | `@` | `YOUR_VPS_IP` |
| `A` | `www` | `YOUR_VPS_IP` |

**Wait 5–30 minutes** for DNS to propagate. Test it:
```bash
# Run this on the VPS
ping myrestaurant.com
# Should show YOUR_VPS_IP
```

---

## 🐳 Step 6 — Install Docker

```bash
# Remove any old Docker versions
sudo apt remove docker docker-engine docker.io containerd runc -y 2>/dev/null

# Install required tools
sudo apt install ca-certificates curl gnupg -y

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose plugin
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y

# Allow botadmin to run Docker without sudo
sudo usermod -aG docker $USER

# IMPORTANT: Apply the group change immediately
newgrp docker

# Verify
docker --version
docker compose version
```

You should see something like:
```
Docker version 26.x.x
Docker Compose version v2.x.x
```

---

## 📁 Step 7 — Upload the Bot to the VPS

You have two options — pick one:

### Option A: Upload via SFTP (recommended for Windows)

Install **[FileZilla](https://filezilla-project.org/)** (free), then:
- Host: `YOUR_VPS_IP`
- Username: `botadmin`
- Password: your botadmin password
- Port: `22`

Upload your entire `restaurant bot` folder to:
```
/home/botadmin/restaurant-bot/
```

### Option B: Upload via command line (SCP)

In **Windows PowerShell**:
```powershell
scp -r "C:\Users\Administrateur\Desktop\restaurant bot" botadmin@YOUR_VPS_IP:/home/botadmin/restaurant-bot
```

### Option C: Use Git

If your code is on GitHub/GitLab:
```bash
# On the VPS
sudo apt install git -y
cd /home/botadmin
git clone https://github.com/YOUR_USERNAME/restaurant-bot.git restaurant-bot
```

---

## ⚙️ Step 8 — Configure Environment Variables

```bash
cd /home/botadmin/restaurant-bot
cp .env.example .env
nano .env
```

Fill in **every single value**. Key ones for production:

```env
NODE_ENV=production
PORT=3000
BASE_URL=https://myrestaurant.com

# MongoDB — self-hosted, zero fees
MONGO_ROOT_PASSWORD=Pick_A_Very_Strong_Root_Pass_Here_123!
MONGO_BOT_PASSWORD=Pick_A_Different_Strong_App_Pass_456!
MONGO_URI=mongodb://botuser:Pick_A_Different_Strong_App_Pass_456!@mongo:27017/restaurant_bot?authSource=restaurant_bot

# Generate a 64-character random JWT secret:
# Run this: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=paste_the_64_char_hex_here

# Meta / WhatsApp
META_PHONE_NUMBER_ID=your_id_from_meta_dashboard
META_WHATSAPP_TOKEN=your_token_from_meta_dashboard
META_VERIFY_TOKEN=any_random_string_you_choose
```

Save: press `Ctrl+X` → `Y` → `Enter`

> [!IMPORTANT]
> The `MONGO_URI` inside [.env](file:///c:/Users/Administrateur/Desktop/restaurant%20bot/.env) uses `@mongo:27017` — `mongo` is the Docker container hostname, NOT `localhost`. This is correct.

---

## 🔒 Step 9 — Get a Free SSL Certificate

Before starting the containers, get your SSL certificate. Certbot runs standalone (uses port 80 briefly):

```bash
sudo apt install certbot -y

sudo certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email your@email.com \
  -d myrestaurant.com \
  -d www.myrestaurant.com
```

**Success message looks like:**
```
Congratulations! Your certificate and chain have been saved at:
/etc/letsencrypt/live/myrestaurant.com/fullchain.pem
```

> [!NOTE]
> If this fails, make sure your domain DNS has propagated (Step 5) and port 80 is open (Step 3).

### Auto-renew SSL every 60 days:

```bash
sudo crontab -e
# Add this line at the bottom:
0 3 * * * certbot renew --quiet --deploy-hook "docker compose -f /home/botadmin/restaurant-bot/docker-compose.yml exec nginx nginx -s reload"
```

---

## 🔧 Step 10 — Update nginx.conf With Your Domain

```bash
nano /home/botadmin/restaurant-bot/nginx/nginx.conf
```

Find and replace **every** occurrence of `yourdomain.com` with your actual domain:

```nginx
# Change these lines:
server_name yourdomain.com www.yourdomain.com;
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# To (using your real domain):
server_name myrestaurant.com www.myrestaurant.com;
ssl_certificate /etc/letsencrypt/live/myrestaurant.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/myrestaurant.com/privkey.pem;
```

Save: `Ctrl+X` → `Y` → `Enter`

---

## 🚀 Step 11 — Launch Everything with Docker Compose

```bash
cd /home/botadmin/restaurant-bot

# Build the Node.js image and start all 3 containers:
# - restaurant_bot_app   (Node.js)
# - restaurant_bot_mongo (MongoDB — self-hosted, free)
# - restaurant_nginx     (Nginx reverse proxy + SSL)
docker compose up -d --build
```

This will take **2–5 minutes** on first run. Watch the progress:
```bash
docker compose logs -f
# Press Ctrl+C to stop watching (containers keep running)
```

Check that all containers are healthy:
```bash
docker compose ps
```

Expected output:
```
NAME                      IMAGE                   STATUS
restaurant_bot_app        restaurant-bot:latest   Up (healthy)
restaurant_bot_mongo      mongo:7.0               Up (healthy)
restaurant_nginx          nginx:1.25-alpine        Up
```

---

## ✅ Step 12 — Verify the Deployment

```bash
# Test the health endpoint
curl https://myrestaurant.com/health
```

Expected response:
```json
{"status":"ok","uptime":15.3,"env":"production"}
```

Also open in your browser:
- `https://myrestaurant.com/admin` → Admin panel
- `https://myrestaurant.com/health` → Health check

---

## 📱 Step 13 — Register the WhatsApp Webhook

1. Go to **[developers.facebook.com](https://developers.facebook.com)**
2. Open your app → **WhatsApp** → **Configuration**
3. Set the **Callback URL**: `https://myrestaurant.com/webhook`
4. Set **Verify Token**: the value of `META_VERIFY_TOKEN` from your [.env](file:///c:/Users/Administrateur/Desktop/restaurant%20bot/.env)
5. Click **Verify and Save**
6. Under **Webhook Fields**, subscribe to: `messages`

---

## 💾 Step 14 — Set Up Daily Backups

```bash
# Create backup script
nano /home/botadmin/backup.sh
```

Paste this content:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M)
DIR=/home/botadmin/backups
mkdir -p $DIR

source /home/botadmin/restaurant-bot/.env

docker exec restaurant_bot_mongo mongodump \
  --username root \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db restaurant_bot \
  --archive=$DIR/backup_$DATE.gz \
  --gzip

# Delete backups older than 14 days
find $DIR -name "*.gz" -mtime +14 -delete
echo "✅ Backup done: backup_$DATE.gz"
```

```bash
chmod +x /home/botadmin/backup.sh

# Schedule it at 3 AM every night
crontab -e
# Add:
0 3 * * * /home/botadmin/backup.sh >> /home/botadmin/backup.log 2>&1
```

---

## 🔄 Step 15 — How to Update the Bot After Code Changes

Every time you change your code locally and want to deploy:

```bash
# 1. Upload new code to VPS (via SFTP or SCP — same as Step 7)

# 2. On the VPS, rebuild and restart
cd /home/botadmin/restaurant-bot
docker compose up -d --build

# That's it! Docker rebuilds only the changed layers.
```

---

## 🛠️ Useful Commands Reference

```bash
# View live logs
docker compose logs -f

# View logs for a specific container
docker compose logs -f app
docker compose logs -f mongo
docker compose logs -f nginx

# Restart only the app (after code change without full rebuild)
docker compose restart app

# Stop everything
docker compose down

# Stop and DELETE all data (dangerous!)
docker compose down -v

# Check resource usage
docker stats

# Open a shell inside the MongoDB container
docker exec -it restaurant_bot_mongo mongosh \
  -u root -p YOUR_MONGO_ROOT_PASSWORD --authenticationDatabase admin
```

---

## 🔥 Troubleshooting

| Problem | Solution |
|---|---|
| `docker compose ps` shows container as `Exit 1` | Run `docker compose logs app` to see the error |
| SSL certificate failed | Check DNS propagation: `nslookup myrestaurant.com` must show your VPS IP |
| WhatsApp webhook not verifying | Check `META_VERIFY_TOKEN` in [.env](file:///c:/Users/Administrateur/Desktop/restaurant%20bot/.env) matches Meta dashboard |
| Port 80/443 already in use | Nothing should be running outside Docker. Check: `sudo ss -tlnp \| grep 80` |
| MongoDB auth error | Re-check that `MONGO_BOT_PASSWORD` in [.env](file:///c:/Users/Administrateur/Desktop/restaurant%20bot/.env) matches `MONGO_URI` exactly |
| Can't connect to VPS | Verify your IP on Contabo dashboard; check UFW allows port 22 |

---

## 💰 Total Monthly Cost

| Item | Price |
|---|---|
| Contabo Cloud VPS S | ~€6/month |
| MongoDB (self-hosted) | **€0** |
| SSL Certificate | **€0** |
| **Total** | **~€6/month** |

> [!TIP]
> MongoDB Atlas equivalent would cost €57+/month for a production cluster. Self-hosting saves you over **€600/year**.
