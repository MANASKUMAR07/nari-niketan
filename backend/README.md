# Nari Niketan — Secure Backend API

High-performance, secure Node.js + Express backend API for **Nari Niketan Premium Boutique**, powered by Firebase Admin SDK and ready for Google Cloud Run deployment.

---

## 🛡️ Key Security Architectural Pillars

1. **Never Trust the Client**: All pricing, discounts, shipping charges, and total order amounts are calculated server-side from canonical Firestore product records. Client-provided prices and subtotals are completely ignored.
2. **Token-Only Identity**: User identity (`uid`, `email`, roles) is strictly extracted from verified Firebase ID tokens via `authenticateFirebaseUser` middleware. Any client-sent `userId` field in request bodies is discarded.
3. **Role Enforcement via Custom Claims**: Primary authorization for Admins, Owners, and Sellers is verified using Firebase Auth Custom Claims (`admin`, `owner`, `seller`), avoiding forged role properties.
4. **Manual UPI Verification Safeguard**: Customer UTR submissions transition to `Pending UTR Verification` status. Orders are never automatically marked as `Paid` without administrator confirmation.
5. **Brute-Force & Abuse Mitigation**: Multi-tiered rate limiters isolate order creation, coupon validation, payment submission, and general routes.
6. **Input Sanitization**: Strict Zod schemas sanitize all incoming payloads before reaching business logic layers.

---

## 📁 Directory Structure

```
backend/
├── src/
│   ├── app.js                     # Express application entry & middleware orchestration
│   ├── config/
│   │   └── firebase.js            # Firebase Admin SDK initialization (Environment variables only)
│   ├── middleware/
│   │   ├── auth.js                # authenticateFirebaseUser, requireAdmin, requireSeller, requireOwner
│   │   ├── errorHandler.js        # Safe operational error handler (never leaks stack traces/internals)
│   │   └── rateLimiter.js         # Tiered Express rate limiters
│   ├── services/
│   │   ├── pricingService.js      # Server-authoritative subtotal, shipping & grand total calculations
│   │   ├── couponService.js       # Server-side coupon validation, limits & discount computation
│   │   └── orderService.js        # Core order creation pipeline
│   ├── validators/
│   │   ├── orderValidator.js      # Zod validation schema for order requests
│   │   ├── couponValidator.js     # Zod validation schema for coupon requests
│   │   ├── adminValidator.js      # Zod validation schemas for administrative operations
│   │   └── sellerValidator.js     # Zod validation schemas for seller operations
│   ├── controllers/
│   │   ├── orderController.js     # Order creation & retrieval endpoints
│   │   ├── couponController.js    # Coupon validation preview endpoint
│   │   ├── paymentController.js   # UTR submission & payment query endpoints
│   │   ├── adminController.js     # Admin dashboards, roles & order management
│   │   └── sellerController.js    # Seller catalog & earnings endpoints
│   ├── routes/
│   │   ├── health.js              # GET /api/health
│   │   ├── orders.js              # /api/orders
│   │   ├── coupons.js             # /api/coupons
│   │   ├── payments.js            # /api/payments
│   │   ├── admin.js               # /api/admin
│   │   └── seller.js              # /api/seller
│   └── utils/
│       ├── logger.js              # Winston structured logging & audit helpers
│       ├── errors.js              # Typed HTTP AppError classes
│       └── asyncHandler.js        # Async wrapper for Express handlers
├── .env.example                   # Environment variable template
├── .gitignore                     # Server-level ignore rules
├── .dockerignore                  # Docker build context exclusions
├── Dockerfile                     # Multi-stage production container for Cloud Run
└── package.json                   # Dependencies and scripts
```

---

## 🚀 Local Development Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in your Firebase credentials in `.env`:
```ini
PORT=8080
NODE_ENV=development
FIREBASE_PROJECT_ID=nari-niketan
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@nari-niketan.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,https://nariniketan.shop
```

### 3. Run Development Server
```bash
npm run dev
```
Test health endpoint:
```bash
curl http://localhost:8080/api/health
```

---

## ☁️ Google Cloud Run Deployment Guide

### 1. Build and Deploy with Google Cloud CLI
Ensure `gcloud` is logged in and configured with your project:
```bash
gcloud config set project nari-niketan
```

Deploy directly from the `backend` directory:
```bash
cd backend
gcloud run deploy nari-niketan-api \
  --source . \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,FIREBASE_PROJECT_ID=nari-niketan,FREE_SHIPPING_THRESHOLD=999,SHIPPING_CHARGE=99,ALLOWED_ORIGINS=https://nariniketan.shop,https://www.nariniketan.shop,https://nari-niketan.web.app" \
  --set-secrets "FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest"
```

### 2. Connect Frontend to the Cloud Run API
Set the backend URL in your frontend scripts (or pass `window.NARI_API_URL`):
```html
<script>
  window.NARI_API_URL = "https://nari-niketan-api-997712460310.asia-south1.run.app/api";
</script>
```

---

## 📚 API Endpoint Reference

### Public / Health
- `GET /api/health` — Service health probe and version status

### Orders (Authenticated: Bearer Token)
- `POST /api/orders` — Secure order creation with server pricing & coupon recalculation
- `GET /api/orders/my` — Customer order history
- `GET /api/orders/:id` — Single order detail (Customer sees self, Admin sees all, Seller sees line items)

### Coupons (Authenticated: Bearer Token)
- `POST /api/coupons/validate` — Validate coupon eligibility & calculate estimated discount preview

### Payments (Authenticated: Bearer Token)
- `POST /api/payments/submit-utr` — Submit manual UPI UTR for verification
- `GET /api/payments/status/:orderId` — Check status of order payment

### Admin (Authenticated: Admin Role / Custom Claim)
- `GET /api/admin/orders` — List all store orders
- `PATCH /api/admin/orders/:id/status` — Update order processing status
- `PATCH /api/admin/orders/:id/verify-payment` — Mark manual UPI payment as Verified
- `GET /api/admin/users` — List registered users
- `PATCH /api/admin/users/:uid/role` — Update Firebase Custom Claims (admin, seller, owner)
- `PATCH /api/admin/users/:uid/block` — Disable/enable user account
- `GET /api/admin/coupons` — List all promo coupons
- `POST /api/admin/coupons` — Create a new coupon
- `PATCH /api/admin/coupons/:id` — Edit an existing coupon
- `DELETE /api/admin/coupons/:id` — Delete a coupon
- `GET /api/admin/stats` — Store performance metrics
- `POST /api/admin/payouts` — Issue delivery partner payout

### Seller (Authenticated: Seller Role / Custom Claim)
- `GET /api/seller/profile` — Seller profile information
- `GET /api/seller/products` — List seller's products
- `POST /api/seller/products` — Create new product
- `PATCH /api/seller/products/:id` — Update product details (ownership verified)
- `DELETE /api/seller/products/:id` — Delete product (ownership verified)
- `PATCH /api/seller/products/:id/inventory` — Update product stock
- `GET /api/seller/orders` — Orders containing seller's items
- `GET /api/seller/earnings` — Seller revenue and breakdown metrics
