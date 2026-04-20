# TG Petrol Pump Trading — Product Overview System

A full-stack product catalogue for TG Petrol Pump Trading built with **Node.js + Express**, **Firebase Firestore + Storage**, and a **vanilla HTML/CSS/JS** frontend.

---

## 📁 Project Structure

```
tg-petrol-pump/
├── server/                        # Backend (Node.js + Express)
│   ├── index.js                   # App entry point
│   ├── config/
│   │   └── firebase.js            # Firebase Admin SDK init
│   ├── middleware/
│   │   ├── auth.js                # JWT verification
│   │   ├── security.js            # Helmet, CORS, rate limiting
│   │   ├── validate.js            # Input validation rules
│   │   └── upload.js              # Multer + file-type validation
│   ├── controllers/
│   │   ├── authController.js      # Login, logout, verify
│   │   ├── productController.js   # Full product CRUD
│   │   └── uploadController.js    # Firebase Storage upload/delete
│   ├── routes/
│   │   ├── auth.js                # /api/auth
│   │   ├── products.js            # /api/products
│   │   └── upload.js              # /api/upload
│   └── utils/
│       ├── logger.js              # Winston logger
│       └── sanitize.js            # XSS/injection sanitization
│
├── public/                        # Public storefront (no login)
│   ├── index.html
│   ├── css/store.css
│   └── js/
│       ├── store.js               # Main entry (ES module)
│       ├── api.js                 # Public HTTP client
│       ├── modal.js               # Product detail modal
│       └── ui.js                  # Shared UI helpers
│
├── admin/                         # Admin panel (login required)
│   ├── login.html
│   ├── dashboard.html
│   ├── css/admin.css
│   └── js/
│       ├── auth.js                # Login/logout/session
│       ├── api.js                 # Authenticated HTTP client
│       ├── products.js            # Product tables + delete
│       ├── form.js                # Add/edit product form
│       └── ui.js                  # Navigation + toast
│
├── firestore.rules                # Firestore security rules
├── storage.rules                  # Storage security rules
├── package.json
├── .env.example                   # → copy to .env
└── README.md
```

---

## ⚙️ Prerequisites

- **Node.js** v18+ (check with `node -v`)
- **npm** v9+
- A **Firebase** project with **Firestore** and **Storage** enabled
- A Firebase **service account key** JSON file

---

## 🚀 Setup Instructions

### Step 1 — Clone / Extract

```bash
# If downloaded as ZIP:
unzip tg-petrol-pump.zip
cd tg-petrol-pump
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Firebase Project Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Enable **Firestore Database** (start in production mode)
4. Enable **Firebase Storage**
5. Go to **Project Settings → Service Accounts** → click **Generate new private key**
6. Save the downloaded JSON as `serviceAccountKey.json` in the project root (same level as `package.json`)
7. Go to **Project Settings → General** and copy your **Web API Key**

### Step 4 — Create Admin User

1. In Firebase Console → **Authentication** → Enable **Email/Password**
2. Add a user (your admin email + password)
3. In **Firestore Database**, create a collection called `admin_users`
4. Add a document with these fields:
   ```
   email: "your-admin@email.com"  (string)
   role:  "admin"                  (string)
   ```

### Step 5 — Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in all values:

```env
PORT=3000
NODE_ENV=development

JWT_SECRET=replace_with_64_random_chars_minimum

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_SERVICE_ACCOUNT_KEY=./serviceAccountKey.json
FIREBASE_WEB_API_KEY=your_web_api_key_from_firebase_console

ALLOWED_ORIGINS=http://localhost:3000
ADMIN_EMAIL=admin@tgpetrol.com
```

> **Generating a secure JWT_SECRET:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### Step 6 — Deploy Firebase Security Rules

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools
firebase login
firebase init  # select Firestore + Storage for your project

# Deploy rules
firebase deploy --only firestore:rules,storage
```

### Step 7 — Run the server

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 URL Structure

| URL | Description |
|-----|-------------|
| `http://localhost:3000/` | Public product storefront |
| `http://localhost:3000/admin/login.html` | Admin login |
| `http://localhost:3000/admin/dashboard.html` | Admin dashboard |
| `http://localhost:3000/api/health` | Server health check |

---

## 🔌 API Reference

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/login` | ❌ | Login with email+password → JWT |
| POST | `/logout` | ✅ | Clear session cookie |
| GET | `/verify` | ✅ | Check token validity |

### Products — `/api/products`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ❌ | List products (`?category`, `?search`, `?limit`, `?featured`) |
| GET | `/:id` | ❌ | Get single product |
| POST | `/` | ✅ Admin | Create product |
| PUT | `/:id` | ✅ Admin | Update product |
| DELETE | `/:id` | ✅ Admin | Delete product |
| PATCH | `/:id/featured` | ✅ Admin | Toggle featured |
| PATCH | `/:id/stock` | ✅ Admin | Update stock |
| POST | `/:id/view` | ❌ | Increment view count |

### Upload — `/api/upload`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/image` | ✅ Admin | Upload images (multipart, up to 10) |
| POST | `/video` | ✅ Admin | Upload video (multipart, 1 file) |
| DELETE | `/file` | ✅ Admin | Delete file from Storage |

---

## 🔐 Security Features

| Layer | Mechanism |
|-------|-----------|
| HTTP Headers | Helmet (CSP, HSTS, X-Frame-Options…) |
| CORS | Whitelist via `ALLOWED_ORIGINS` env var |
| Authentication | JWT HS256 (httpOnly cookie + Bearer token) |
| Brute-force | Rate limiter + progressive slow-down on login |
| General API | Rate limiting (120 req/min) |
| Input validation | express-validator on all routes |
| XSS prevention | `xss` library sanitizes all text fields |
| NoSQL injection | `express-mongo-sanitize` strips `$` and `.` |
| File upload | MIME type + magic byte validation |
| File size | 5 MB images / 100 MB videos |
| Storage paths | Backend-only writes; client paths restricted to `products/` |
| Firebase rules | All client writes denied in Firestore + Storage |
| Error handling | Stack traces never sent to client |
| Logging | Winston — security events → `logs/security.log` |

---

## 🔥 Firestore Data Schema

```
Collection: products
{
  id:              auto-generated
  name:            string
  slug:            string
  category:        "fuel-dispensers" | "spare-parts" | "accessories"
  description:     string (safe HTML)
  specifications:  { flowRate, power, weight, dimensions }
  price:           number
  discountPercent: number (0–100)
  finalPrice:      number
  stock:           number
  availability:    "in-stock" | "out-of-stock" | "coming-soon"
  images:          string[]  (Storage HTTPS URLs)
  videos:          string[]  (Storage HTTPS URLs)
  featured:        boolean
  views:           number
  createdAt:       timestamp
  updatedAt:       timestamp
}

Collection: admin_users
{
  email: string
  role:  "admin"
}
```

---

## 📦 Production Deployment (Nginx Example)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Use **PM2** to keep the Node server alive:
```bash
npm install -g pm2
pm2 start server/index.js --name tg-petrol
pm2 save
pm2 startup
```

---

## 📝 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | ❌ | Server port (default: 3000) |
| `NODE_ENV` | ❌ | `development` or `production` |
| `JWT_SECRET` | ✅ | Secret key for JWT signing (≥ 64 chars) |
| `JWT_EXPIRES_IN` | ❌ | Token TTL (default: `8h`) |
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | ✅ | Storage bucket name |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | ✅ | Path to service account JSON |
| `FIREBASE_WEB_API_KEY` | ✅ | Web API key (for Auth REST) |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins |
| `MAX_IMAGE_SIZE_MB` | ❌ | Max image size in MB (default: 5) |
| `MAX_VIDEO_SIZE_MB` | ❌ | Max video size in MB (default: 100) |
| `LOGIN_RATE_LIMIT_MAX` | ❌ | Max login attempts per window (default: 10) |
| `API_RATE_LIMIT_MAX` | ❌ | Max API requests per minute (default: 120) |

---

## 🛠 Troubleshooting

**`Missing required environment variables`**
→ Make sure `.env` exists and all required values are filled in.

**`Firebase service account key not found`**
→ Place `serviceAccountKey.json` in the project root and set `FIREBASE_SERVICE_ACCOUNT_KEY=./serviceAccountKey.json`

**`Access forbidden` on login**
→ Ensure the admin user exists in both Firebase Authentication AND in the `admin_users` Firestore collection with `role: "admin"`.

**Images not loading**
→ Check Firebase Storage rules are deployed and the bucket name in `.env` is correct.

---

© 2026 TG Petrol Pump Trading
