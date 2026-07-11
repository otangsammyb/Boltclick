# 🍽️ WhatsApp Restaurant SalesBot

A **multi-tenant**, production-ready WhatsApp ordering bot for restaurants in Cameroon. Each restaurant runs inside its own Docker container on a single VPS.

---

## ✨ Features
- 🤖 **Bilingual bot** (English + French) via Meta WhatsApp Cloud API
- 🛒 **Full ordering flow** — menu, cart, checkout
- 📍 **Live location delivery** with fee calculation (200 FCFA/km)
- 💳 **MTN & Orange Money** payments via CamPay
- 🧾 **PDF receipts** for orders and table bookings
- 📅 **Table booking** with capacity management
- 🔁 **"The Usual"** — re-order last order in one tap
- 🗺️ **Smart delivery routing** — groups nearby orders for one rider
- ⭐ **30-min follow-up ratings** (automated)
- 🧑 **Human handoff** with admin WhatsApp notification
- 📊 **Admin dashboard** — live orders, revenue charts, menu CRUD, analytics
- 🚗 **Delivery driver app** — PWA with order management
- 🐳 **Docker multi-tenant** — 50 restaurants on 1 VPS

---

## 📁 Project Structure
```
restaurant-bot/
├── src/
│   ├── app.js               # Entry point
│   ├── config/              # env.js, db.js
│   ├── models/              # MongoDB models
│   ├── bot/                 # WhatsApp bot engine
│   │   ├── handlers/        # Conversation handlers
│   │   ├── language/        # EN/FR strings
│   │   ├── dispatcher.js    # State machine
│   │   └── webhook.js       # Meta webhook
│   ├── payments/            # CamPay integration
│   ├── pdf/                 # PDF receipt generator
│   ├── routing/             # Smart delivery routing
│   ├── scheduler/           # 30-min follow-up cron
│   ├── admin/               # Admin API
│   └── delivery/            # Delivery driver API
├── public/
│   ├── admin/               # Admin dashboard SPA
│   └── delivery/            # Delivery driver PWA
├── tests/
├── nginx/                   # Multi-tenant reverse proxy
├── scripts/new-tenant.sh    # Onboard a new restaurant
├── Dockerfile
└── docker-compose.yml
```

---

## 🚀 Quick Start (Development)

### 1. Clone & Configure
```bash
cp .env.example .env
# Edit .env with your Meta, CamPay credentials
```

### 2. Run with Docker
```bash
docker compose --profile dev up -d
# App: http://localhost:3000
# Admin: http://localhost:3000/admin
# Delivery: http://localhost:3000/delivery
# Mongo UI: http://localhost:8081
```

### 3. Expose with ngrok (for Meta webhook)
```bash
ngrok http 3000
# Copy the https URL → paste in Meta App Dashboard as webhook URL
# Path: https://<ngrok-url>/webhook
# Verify Token: value from META_VERIFY_TOKEN in .env
```

### 4. Run Tests
```bash
npm test
```

---

## ⚙️ Meta WhatsApp Setup

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create App → Business type
3. Add **WhatsApp** product
4. Get **Phone Number ID** and **Temporary Access Token**
5. Configure webhook:
   - URL: `https://yourdomain.com/webhook`
   - Verify Token: your `META_VERIFY_TOKEN`
   - Subscribe to: `messages`
6. Add test phone numbers in the sandbox

---

## 💳 CamPay Setup

1. Register at [campay.net](https://campay.net)
2. Get credentials from your dashboard
3. Use `https://demo.campay.net/api` for sandbox testing
4. Switch to `https://www.campay.net/api` for production
5. Configure webhook URL: `https://yourdomain.com/payments/webhook`

---

## 🏗️ Add a New Restaurant (Multi-Tenant)

```bash
bash scripts/new-tenant.sh pizza-palace 3002
# → Creates new Docker container on port 3002
# → Edit the new .env for restaurant-specific settings
# → Add server block in nginx/nginx.conf
```

---

## 🌐 Production Deployment (Hostinger VPS)

```bash
# 1. Clone to server
git clone <repo> && cd restaurant-bot
cp .env.example .env && nano .env  # fill production values

# 2. Start
docker compose up -d

# 3. SSL (Let's Encrypt)
sudo certbot --nginx -d yourdomain.com

# 4. Update nginx.conf with your domain
# 5. Set Meta webhook to https://yourdomain.com/webhook
# 6. Switch CAMPAY_BASE_URL to https://www.campay.net/api
```

---

## 📊 Admin Dashboard

- URL: `/admin`  
- Login: configured via `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`
- Features: live order feed, revenue charts, menu CRUD, bookings calendar, delivery groups, customer list, ratings, handoffs

## 🚗 Delivery Driver App

- URL: `/delivery`
- Login: driver code `DRIVER_<riderId>` (assigned via admin dashboard)
- Features: view assigned delivery groups, start run, mark deliveries

---

## 🎨 Brand Colors (UI)
| Token | Hex | Use |
|---|---|---|
| `--green`  | `#00ed64` | Primary accent, CTAs |
| `--teal`   | `#00684a` | Secondary, sidebar active |
| `--mid`    | `#023430` | Card/surface background |
| `--dark`   | `#001e2b` | Main background |

---

Built with ❤️ for restaurants in Cameroon 🇨🇲
 

 implementation
 if userenter table number which is not in range let the bot tell the user to enter a valid table number




 new functionality:

 "Act as a Senior Full-Stack Engineer and Geospatial Expert. I am building a real-time delivery tracking dashboard for my SaaS, 'Apexify', using Leaflet.js, OpenStreetMap, and Leaflet Routing Machine.

The Objective: Create a high-performance driver tracking interface with the following advanced features:

Custom Identity: Replace default markers with custom SVG/PNG icons—a delivery bike for the driver and a house/user icon for the destination. The driver icon must rotate to face the direction of travel (heading).

Real-time Synchronization: Use a WebSocket-based logic (simulated or real) to update the driver's lat/lng. Implement Marker Interpolation (e.g., using Leaflet.Marker.SlideTo) so the bike moves smoothly across the road at 60fps rather than teleporting.

Smart Routing & Re-routing: Plot a path using OSRM. If the driver deviates from the path by more than 50 meters, automatically recalculate the route from their new position.

Voice Navigation Engine: Integrate the Web Speech API to provide turn-by-turn voice instructions. The system must 'look ahead' at the routing instructions and trigger a voice prompt ('Turn right in 100 meters') based on proximity to the next coordinate.

Geofencing: Implement a 'Near Arrival' trigger. When the driver is within 200 meters of the customer, trigger a specific UI animation and a voice alert: 'Arriving at destination'.

Technical Constraints: >    - Optimize for mobile performance (low battery drain).

Use a 'Dark Mode' or custom-styled map tile layer to look premium.

Ensure the code is modular so I can easily plug in my MongoDB coordinates via a JS API.

Provide the complete functioning functionality