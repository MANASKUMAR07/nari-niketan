# 🌸 Nari Niketan — Indian Ethnic Wear E-Commerce Platform

> **Ethically Handcrafted Indian Fashion — Sarees, Kurtas, Lehengas, Suits, Dupattas & Accessories.**  
> Powered by an Offline-Ready PWA Frontend, Secure Cloud Run Node.js/Express Backend, and Google Cloud Firestore.

---

## 📁 Repository Architecture

The project is cleanly modularized into three primary folders:

```
NARI NIKETAN/
├── 🌐 frontend/              # PWA Web Client & Portals
│   ├── index.html            # Customer Homepage
│   ├── shop.html             # Product Catalog & Category Filters
│   ├── product.html          # Dynamic Product Detail & Variant Selector
│   ├── cart.html             # Shopping Bag & Summary
│   ├── checkout.html         # Multi-Step Checkout & UPI QR Payments
│   ├── confirmation.html     # Order Confirmation & Real-time Tracking
│   ├── login.html / register # Customer Authentication
│   ├── my-account.html       # Profile, Addresses & Preferences
│   ├── my-orders.html        # Order History & Invoices
│   ├── admin-dashboard.html  # Quick Admin Portal Entry
│   ├── admin/                # Enterprise Operations & Inventory Center
│   ├── seller/               # 6-Step Seller Onboarding & Product Wizard
│   ├── delivery/             # Delivery Partner Field Portal with GPS & OTP
│   ├── css/                  # Responsive Layouts & Design System Tokens
│   ├── js/                   # Client State, Firebase Client SDK, AI Copilot
│   ├── images/               # WebP & Original Product Images & Banners
│   ├── sw.js                 # Offline-First PWA Service Worker
│   └── manifest.webmanifest  # Web App Manifest & App Icons
│
├── ⚙️ backend/               # Secure Node.js + Express API
│   ├── src/                  # Controllers, Services, Middleware, Validators
│   ├── firestore.rules       # Granular Firestore Security Rules
│   ├── firestore.indexes.json# Compound Query Indexes
│   ├── storage.rules         # Cloud Storage Security Rules
│   ├── test-backend-comprehensive.js # Comprehensive Business Logic Suite
│   ├── test-variant-inventory.js     # Variant Matrix & Inventory Unit Tests
│   ├── Dockerfile            # Multi-stage Container for Google Cloud Run
│   ├── .env.example          # Backend Environment Configuration
│   ├── env.yaml              # Cloud Run Deployment Secrets Mapping
│   └── package.json          # Express, Firebase Admin, Sharp, Zod, Winston
│
├── 📚 docs/                  # System Architecture & Technical Manuals
│   ├── Nari_Niketan_Complete_System_Architecture.pdf
│   ├── Nari_Niketan_Complete_System_Architecture_and_Analysis.pdf
│   ├── NARI_NIKETAN_Architecture_and_Implementation.pdf
│   ├── Nari_Niketan_Complete_Technical_Documentation.pdf
│   ├── Nari_Niketan_Master_Analysis_2024.pdf
│   ├── android-packaging-guide.md
│   ├── project-documentation.html
│   └── README.md
│
├── scripts/                  # PWA Icon/Screenshot Generators & QA Audits
├── scratch/                  # Maintenance, Migration & Utility Scripts
├── firebase.json             # Firebase Hosting & Firestore/Storage Rules Config
├── netlify.toml              # Netlify Deployment Configuration
└── vercel.json               # Vercel Deployment Configuration
```

---

## 🚀 Quick Start Guide

### 1. Running the Frontend Locally

The frontend is pure, performant Vanilla HTML5, CSS3, and modern JavaScript.

- **Option A (VSCode Live Server)**:
  Open this project in VSCode and click **Go Live**. Live Server is automatically configured to serve from `/frontend` on port `5501`.

- **Option B (Node.js serve)**:
  ```bash
  npx -y serve frontend -l 5500
  ```
  Visit [http://localhost:5500](http://localhost:5500).

---

### 2. Running the Backend API

The backend manages server-side pricing verification, coupon logic, atomic inventory deductions, image compression, and AI Stylist interactions.

```bash
cd backend
npm install
cp .env.example .env     # Configure your Firebase credentials
npm run dev              # Starts Express on http://localhost:8080
```

#### Running Backend Tests:
```bash
cd backend
npm test
```
Runs both the comprehensive automated verification suite and the variant inventory matrix test suite.

---

### 3. Running Automated Operations & QA Audit

From the repository root:
```bash
node scripts/nari-ops-audit.js
```
Validates routes, zero-overflow responsive rules, safe-area compliance, SEO tags, security headers, and health scoring formulas.

---

## 🔒 Security Architecture Highlights

1. **Zero Client Trust**: All pricing, discounts, shipping charges, and stock deductions are calculated and verified server-side.
2. **Custom Claims RBAC**: Admin, Seller, and Delivery roles are enforced using verified Firebase Auth Custom Claims.
3. **Manual UPI Confirmation**: Customer UTR numbers are safely logged in `Pending UTR Verification` status; orders are never marked paid without administrative review.
4. **Offline Resilience**: PWA Service Worker precaches the core shell and product catalog, enabling browsing without an active internet connection.
