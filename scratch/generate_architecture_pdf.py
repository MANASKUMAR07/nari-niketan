import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

# =========================================================================
# NUMBERED CANVAS (Page X of Y & Running Header/Footer)
# =========================================================================
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Skip cover page

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#6B7280"))

        # Running Header
        self.drawString(36, 11 * inch - 30, "NARI NIKETAN — Complete System Architecture & Engineering Specification")
        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.5)
        self.line(36, 11 * inch - 34, 8.5 * inch - 36, 11 * inch - 34)

        # Running Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 36, 24, page_str)
        self.drawString(36, 24, "CONFIDENTIAL & PROPRIETARY — Nari Niketan System Architecture v3.0")
        self.line(36, 32, 8.5 * inch - 36, 32)

        self.restoreState()


def build_pdf():
    pdf_filename = r"c:\Users\manas\OneDrive\Desktop\NARI NIKETAN\Nari_Niketan_Complete_System_Architecture.pdf"
    
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=44,
        bottomMargin=44
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    c_primary = colors.HexColor("#8B1A4A")     # Royal Burgundy
    c_gold = colors.HexColor("#B8860B")        # Antique Gold
    c_dark = colors.HexColor("#111827")        # Slate 900
    c_body = colors.HexColor("#374151")        # Slate 700
    c_dim = colors.HexColor("#6B7280")         # Slate 500
    c_accent = colors.HexColor("#065F46")      # Emerald Dark

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=c_primary,
        alignment=1,
        spaceAfter=10
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=c_gold,
        alignment=1,
        spaceAfter=16
    )

    h1_style = ParagraphStyle(
        'ChapterH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=c_primary,
        spaceBefore=11,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12.5,
        textColor=c_dark,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=c_body,
        spaceAfter=4
    )

    bullet_style = ParagraphStyle(
        'CustomBullet',
        parent=body_style,
        leftIndent=10,
        bulletIndent=3,
        spaceAfter=3
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.2,
        leading=9.2,
        textColor=c_body
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=table_cell,
        fontName='Helvetica-Bold',
        textColor=c_dark
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=table_cell,
        fontName='Helvetica-Bold',
        fontSize=7.2,
        leading=9.2,
        textColor=colors.white
    )

    story = []

    def p(text, style=body_style):
        return Paragraph(text, style)

    def hr():
        return HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#E5E7EB"), spaceBefore=4, spaceAfter=6)

    # =========================================================================
    # 1. COVER PAGE
    # =========================================================================
    story.append(Spacer(1, 24))
    story.append(p("NARI NIKETAN", title_style))
    story.append(p("COMPLETE SYSTEM ARCHITECTURE & ENGINEERING SPECIFICATION", subtitle_style))
    story.append(hr())
    
    meta_text = """
    <b>Official Technical Architecture Blueprint &amp; System Manual</b><br/>
    <b>Version:</b> 3.0.0 (Production Node.js Backend &amp; Multi-Portal Ecosystem Release) &nbsp;|&nbsp; <b>Date:</b> September 2026<br/>
    <b>Domain:</b> https://www.nariniketan.shop &nbsp;|&nbsp; <b>Firebase Hosting:</b> https://nari-niketan.web.app<br/>
    <b>Backend API (Cloud Run):</b> https://nari-niketan-api-997712460310.asia-south1.run.app
    """
    story.append(p(meta_text, ParagraphStyle('CoverMeta', parent=body_style, alignment=1, fontSize=8, leading=11, textColor=c_dim)))
    story.append(Spacer(1, 16))

    cover_table_data = [
        [Paragraph("<b>System Dimension / Pillar</b>", table_header), Paragraph("<b>Architectural Specification &amp; Implementation</b>", table_header)],
        [Paragraph("<b>Architecture Pattern</b>", table_cell_bold), Paragraph("Hybrid Jamstack + Microservice API on Google Cloud Run (asia-south1, Mumbai)", table_cell)],
        [Paragraph("<b>Frontend Presentation Tier</b>", table_cell_bold), Paragraph("Progressive Web App (PWA), Semantic HTML5, CSS3 Custom Tokens, Vanilla ES6+ JS", table_cell)],
        [Paragraph("<b>Backend API Layer</b>", table_cell_bold), Paragraph("Node.js 20 LTS, Express 4.19, Helmet, CORS Allowlist, Rate Limiters, Winston Audit Logging", table_cell)],
        [Paragraph("<b>Cloud Database &amp; Storage</b>", table_cell_bold), Paragraph("Cloud Firestore NoSQL (17 collections, atomic transactions) + Firebase Storage (5MB MIME)", table_cell)],
        [Paragraph("<b>Authentication &amp; RBAC</b>", table_cell_bold), Paragraph("Firebase Auth + Custom Claims (admin, seller, owner) + Firestore Security Rules", table_cell)],
        [Paragraph("<b>Pricing &amp; Discount Authority</b>", table_cell_bold), Paragraph("100% Server-Authoritative: Zero Trust on client-sent prices, totals, or discount rates", table_cell)],
        [Paragraph("<b>Multi-Portal Ecosystem</b>", table_cell_bold), Paragraph("4 Unified Portals: Customer Storefront, Admin Operations, Vendor/Seller, Delivery Partner", table_cell)],
        [Paragraph("<b>Logistics &amp; Fleet Engine</b>", table_cell_bold), Paragraph("Zone matching, OTP handoff verification, GPS Google Maps navigation, COD reconciliations", table_cell)],
        [Paragraph("<b>Payment Settlement</b>", table_cell_bold), Paragraph("Dynamic BharatPe UPI VPA QR generator with UTR manual audit + Cash on Delivery (COD)", table_cell)],
        [Paragraph("<b>Edge Caching &amp; Offline</b>", table_cell_bold), Paragraph("Service Worker (v6.0) with offline precache shell + dynamic bypass for real-time portals", table_cell)]
    ]
    t_cover = Table(cover_table_data, colWidths=[160, 380])
    t_cover.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_cover)
    story.append(Spacer(1, 16))
    story.append(p("<b>Document Classification:</b> OFFICIAL ENGINEERING SPECIFICATION &amp; PRODUCTION BLUEPRINT", ParagraphStyle('Class', parent=body_style, alignment=1, fontSize=8, textColor=c_gold)))
    story.append(PageBreak())

    # =========================================================================
    # 2. HIGH-LEVEL MULTI-TIER SYSTEM TOPOLOGY
    # =========================================================================
    story.append(p("Section 1 — Multi-Tier System Topology & Security Boundary", h1_style))
    story.append(hr())
    story.append(p("The Nari Niketan platform is organized into three distinct, decoupled architectural layers designed for sub-second load times, defense-in-depth security, and infinite auto-scaling:"))

    topology_points = [
        "<b>1. Client Presentation Tier (Edge CDN):</b> Hosted across Google Edge CDN / Firebase Hosting with HTTP/2 and TLS 1.3. Serves the responsive customer storefront, PWA shell, and management portals. Contains zero business secrets.",
        "<b>2. Application Security &amp; Logic Tier (Cloud Run):</b> Containerized Node.js/Express service deployed in <code>asia-south1</code> (Mumbai). Validates all incoming payloads with Zod schemas, fetches ground-truth catalog prices from Firestore, enforces coupon quotas, and signs state changes.",
        "<b>3. Cloud Persistence &amp; Identity Tier (Google Cloud / Firebase):</b> Cloud Firestore manages NoSQL documents with atomic batch transactions. Firebase Auth issues cryptographically signed JWT ID tokens containing role claims. Cloud Storage stores product photography."
    ]
    for pt in topology_points:
        story.append(p(f"• {pt}", bullet_style))

    story.append(Spacer(1, 6))
    story.append(p("Section 2 — Multi-Portal Ecosystem & Access Control Matrix", h1_style))
    story.append(hr())

    portal_table_data = [
        [Paragraph("<b>Portal</b>", table_header), Paragraph("<b>Target User</b>", table_header), Paragraph("<b>Primary Capabilities</b>", table_header), Paragraph("<b>Auth &amp; RBAC Control</b>", table_header)],
        [Paragraph("<b>Storefront PWA</b><br/><code>/index.html</code>", table_cell_bold), Paragraph("Shoppers / Customers", table_cell), Paragraph("Catalog browsing, faceted filters, AI Stylist advisor, server-validated cart, UPI/COD checkout, order tracking.", table_cell), Paragraph("Public / Authenticated Customer JWT", table_cell)],
        [Paragraph("<b>Admin Operations</b><br/><code>/admin</code>", table_cell_bold), Paragraph("Super Admins &amp; Ops", table_cell), Paragraph("Catalog management, stock editing, dispatch assignment, coupon creation, seller verification, finance payouts.", table_cell), Paragraph("Firebase Custom Claim <code>admin: true</code> or <code>owner: true</code>", table_cell)],
        [Paragraph("<b>Seller Portal</b><br/><code>/seller</code>", table_cell_bold), Paragraph("Artisans &amp; Vendors", table_cell), Paragraph("Vendor onboarding, product creation/editing, inventory sync, vendor order inspection, and payout settlements.", table_cell), Paragraph("Firestore status <code>sellerStatus: 'approved'</code>", table_cell)],
        [Paragraph("<b>Delivery Partner</b><br/><code>/delivery</code>", table_cell_bold), Paragraph("Fleet Riders &amp; Agents", table_cell), Paragraph("Shift availability, assigned delivery queue, Google Maps navigation, customer dialing, and OTP handoff.", table_cell), Paragraph("Firestore status <code>deliveryPartnerStatus: 'approved'</code>", table_cell)]
    ]
    t_portals = Table(portal_table_data, colWidths=[90, 85, 235, 130])
    t_portals.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 3.5),
    ]))
    story.append(t_portals)

    # =========================================================================
    # 3. BACKEND MICROSERVICE ARCHITECTURE (CLOUD RUN)
    # =========================================================================
    story.append(PageBreak())
    story.append(p("Section 3 — Backend Microservice Design & Server Authority", h1_style))
    story.append(hr())
    story.append(p("The backend API service (<code>nari-niketan-api</code>) is containerized via Docker and runs on Google Cloud Run in the <code>asia-south1</code> region with automated auto-scaling and IAM authorization."))

    api_design_data = [
        [Paragraph("<b>Component / Service</b>", table_header), Paragraph("<b>Implementation Details &amp; Engineering Rules</b>", table_header)],
        [Paragraph("<b>Pricing Service</b><br/><code>pricingService.js</code>", table_cell_bold), Paragraph("Computes line items, category subtotals, dynamic free shipping thresholds (Rs. 999 threshold / Rs. 99 standard fee), and 0% GST (inclusive). Ignores all client-submitted totals.", table_cell)],
        [Paragraph("<b>Coupon Engine</b><br/><code>couponService.js</code>", table_cell_bold), Paragraph("Validates coupon active state, expiration dates, minimum cart spend, per-user usage limits, and computes percentage vs flat discounts strictly on the server.", table_cell)],
        [Paragraph("<b>Order Processor</b><br/><code>orderService.js</code>", table_cell_bold), Paragraph("Fetches active product documents directly from Firestore, checks inventory levels, generates 6-digit delivery OTPs, records coupon usage, and writes orders atomically.", table_cell)],
        [Paragraph("<b>Input Validation</b><br/><code>orderValidator.js</code>", table_cell_bold), Paragraph("Strict Zod schema validation for cart payloads, addresses (6-digit PIN codes, line items), and phone numbers. Rejects invalid requests with HTTP 400 before DB access.", table_cell)],
        [Paragraph("<b>Security Middleware</b><br/><code>helmet &amp; cors</code>", table_cell_bold), Paragraph("Enforces strict Content Security Policy, HSTS, X-Frame-Options DENY, and CORS origin whitelist restricted to <code>nariniketan.shop</code> and Firebase domains.", table_cell)],
        [Paragraph("<b>DDoS Rate Limiting</b><br/><code>rateLimiter.js</code>", table_cell_bold), Paragraph("Tiered memory rate limiters: General endpoints (100 req/15 min), Order placement (10 req/15 min), Coupon validation (20 req/15 min).", table_cell)],
        [Paragraph("<b>Structured Logging</b><br/><code>logger.js</code>", table_cell_bold), Paragraph("Winston logger outputting structured JSON logs for Google Cloud Logging, capturing request IDs, audit trails, and execution latencies.", table_cell)]
    ]
    t_api = Table(api_design_data, colWidths=[140, 400])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_api)

    story.append(Spacer(1, 6))
    story.append(p("Section 4 — Cloud Firestore NoSQL Data Architecture", h1_style))
    story.append(hr())

    db_schema_data = [
        [Paragraph("<b>Collection Name</b>", table_header), Paragraph("<b>Key Schema Fields &amp; Data Types</b>", table_header), Paragraph("<b>Security &amp; Read/Write Access</b>", table_header)],
        [Paragraph("<code>/users/{uid}</code>", table_cell_bold), Paragraph("email, displayName, role, isAdmin, isSeller, sellerStatus, isDeliveryPartner, deliveryPartnerStatus, shiftStatus, deliveryProfile", table_cell), Paragraph("Owner read/write profile; Admin manages roles &amp; statuses.", table_cell)],
        [Paragraph("<code>/products/{id}</code>", table_cell_bold), Paragraph("title, price, originalPrice, stock, category, sellerId, images[], status, tags[], rating", table_cell), Paragraph("Public read; Admin &amp; owning Seller create/update/delete.", table_cell)],
        [Paragraph("<code>/orders/{id}</code>", table_cell_bold), Paragraph("userId, customerName, phone, deliveryAddress{}, items[], subtotal, discountAmount, shipping, totalAmount, paymentMethod, paymentStatus, upiUtr, deliveryOtp, status, assignedDeliveryPartnerId, deliveryState", table_cell), Paragraph("Admin all; User reads own; Seller reads items; Assigned Rider reads and updates delivery status.", table_cell)],
        [Paragraph("<code>/coupons/{id}</code>", table_cell_bold), Paragraph("code, discountType, discountValue, minCartAmount, maxDiscount, validUntil, usageLimit, usedCount, active", table_cell), Paragraph("Admin manages; Authenticated users validated via Cloud Run.", table_cell)],
        [Paragraph("<code>/deliveryPayouts/{id}</code>", table_cell_bold), Paragraph("deliveryPartnerId, amount, orderIds[], status, processedAt, notes", table_cell), Paragraph("Admin manages; Rider reads own payout history.", table_cell)],
        [Paragraph("<code>/sellerPayouts/{id}</code>", table_cell_bold), Paragraph("sellerId, amount, orderIds[], status, processedAt, notes", table_cell), Paragraph("Admin manages; Seller reads own settlements.", table_cell)],
        [Paragraph("<code>/reviews/{id}</code>", table_cell_bold), Paragraph("productId, userId, userName, rating, comment, createdAt", table_cell), Paragraph("Public read; Authenticated verified buyer create.", table_cell)]
    ]
    t_db = Table(db_schema_data, colWidths=[105, 295, 140])
    t_db.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 3.5),
    ]))
    story.append(t_db)

    # =========================================================================
    # 4. CORE BUSINESS LIFECYCLES & STATE ENGINES
    # =========================================================================
    story.append(PageBreak())
    story.append(p("Section 5 — Core Business Workflows & State Machines", h1_style))
    story.append(hr())

    story.append(p("<b>5.1 Order Placement &amp; Server-Authoritative Pipeline:</b>"))
    order_flow = [
        "<b>Step 1 — Cart Checkout:</b> Customer initiates checkout. Frontend packages selected product IDs, quantities, address, and coupon code.",
        "<b>Step 2 — API Ingestion:</b> Request hits <code>POST /api/orders</code> on Cloud Run with Bearer Firebase ID Token. Zod validates payload format.",
        "<b>Step 3 — Price Lookup &amp; Inventory Lock:</b> Backend queries Firestore for active product documents, verifies stock availability, and computes authoritative subtotals.",
        "<b>Step 4 — Coupon Application:</b> If coupon provided, verifies validity window and user usage history before applying discount.",
        "<b>Step 5 — Order Creation:</b> Generates 6-digit random delivery OTP, writes order record with <code>paymentStatus: 'Pending (COD)'</code> or <code>'Pending UTR Verification'</code>, and returns order ID."
    ]
    for of in order_flow:
        story.append(p(f"• {of}", bullet_style))

    story.append(Spacer(1, 6))
    story.append(p("<b>5.2 Delivery Fleet Dispatch &amp; Fulfillment State Machine:</b>"))
    delivery_flow = [
        "<b>1. Assigned (<code>assigned</code>):</b> Admin assigns order to a delivery partner via Smart Load Balancing (matching zone and lowest active orders).",
        "<b>2. Accepted (<code>accepted</code>):</b> Rider receives push notification / queue update and accepts assignment. (Status: <i>Processing</i>).",
        "<b>3. Reached Store (<code>reached_store</code>):</b> Rider arrives at vendor hub to collect packaged garments.",
        "<b>4. Picked Up (<code>picked_up</code>):</b> Rider confirms package pickup from merchant. (Status: <i>Shipped</i>).",
        "<b>5. Out for Delivery (<code>out_for_delivery</code>):</b> Rider departs towards customer address using built-in Google Maps navigation.",
        "<b>6. Reached Customer (<code>reached_customer</code>):</b> Rider arrives at customer doorstep, triggers phone call if necessary.",
        "<b>7. Delivered (<code>delivered</code>):</b> Customer provides 6-digit OTP. For COD orders, cash is collected and recorded. Status updates to <i>Delivered</i>."
    ]
    for df in delivery_flow:
        story.append(p(f"• {df}", bullet_style))

    story.append(Spacer(1, 6))
    story.append(p("<b>5.3 Payment Verification Workflow (Manual UPI &amp; COD):</b>"))
    payment_flow = [
        "<b>Manual BharatPe UPI VPA:</b> Dynamic QR code generated with VPA (<code>BHARATPE.8E0Q0V9A0U38126@fbpe</code>, Payee: Anshu Kumari). Customer inputs 12-digit bank UTR reference number upon payment.",
        "<b>UTR Anti-Tampering Engine:</b> Submissions are recorded in <code>/payments</code>. Duplicate UTRs are rejected immediately. Status defaults to <code>Pending UTR Verification</code>.",
        "<b>Admin Reconciliation:</b> Admin confirms bank account receipt and flags order as <code>Paid</code> via <code>PATCH /api/admin/orders/:id/verify-payment</code>.",
        "<b>Cash on Delivery (COD):</b> Available for orders up to Rs. 5,000. Rider collects exact cash upon delivery handoff and system marks COD as collected."
    ]
    for pf in payment_flow:
        story.append(p(f"• {pf}", bullet_style))

    # =========================================================================
    # 5. PWA CACHING, DEPLOYMENT & HOSTING TOPOLOGY
    # =========================================================================
    story.append(PageBreak())
    story.append(p("Section 6 — Progressive Web App (PWA) & Caching Architecture", h1_style))
    story.append(hr())
    story.append(p("The client application implements a Service Worker (<code>sw.js</code> v6.0) utilizing tailored caching strategies to balance ultra-fast load times with live data consistency:"))

    pwa_data = [
        [Paragraph("<b>Traffic / Asset Category</b>", table_header), Paragraph("<b>Caching Strategy</b>", table_header), Paragraph("<b>Behavior &amp; Rationale</b>", table_header)],
        [Paragraph("<b>HTML Navigation Pages</b><br/>(<code>*.html</code>)", table_cell_bold), Paragraph("Network-First with Offline Fallback", table_cell), Paragraph("Fetches fresh HTML from CDN; serves cached version or <code>offline.html</code> if offline.", table_cell)],
        [Paragraph("<b>Static Core Assets</b><br/>(CSS, Icons, Brand Logos)", table_cell_bold), Paragraph("Stale-While-Revalidate", table_cell), Paragraph("Serves cached assets instantly while fetching background updates for next visit.", table_cell)],
        [Paragraph("<b>Delivery &amp; Admin Portals</b><br/>(<code>/delivery/*</code>, <code>/admin/*</code>)", table_cell_bold), Paragraph("Strict Dynamic Bypass", table_cell), Paragraph("Completely bypasses Service Worker cache to guarantee 100% real-time Firestore synchronization.", table_cell)],
        [Paragraph("<b>Cloud Run API Traffic</b><br/>(<code>*.run.app</code>)", table_cell_bold), Paragraph("Strict Dynamic Bypass", table_cell), Paragraph("Direct network pass-through to ensure accurate pricing calculations and atomic order creations.", table_cell)]
    ]
    t_pwa = Table(pwa_data, colWidths=[130, 130, 280])
    t_pwa.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_pwa)

    story.append(Spacer(1, 8))
    story.append(p("Section 7 — Infrastructure Deployment & Production Endpoints", h1_style))
    story.append(hr())

    endpoints_data = [
        [Paragraph("<b>Resource / Environment</b>", table_header), Paragraph("<b>Production URL / Identifier</b>", table_header), Paragraph("<b>Provider &amp; Region</b>", table_header)],
        [Paragraph("Primary Custom Domain", table_cell_bold), Paragraph("<code>https://nariniketan.shop</code> &amp; <code>https://www.nariniketan.shop</code>", table_cell), Paragraph("Google Edge CDN / Hostinger DNS", table_cell)],
        [Paragraph("Firebase Hosting Origin", table_cell_bold), Paragraph("<code>https://nari-niketan.web.app</code>", table_cell), Paragraph("Google Cloud Firebase CDN", table_cell)],
        [Paragraph("Backend Cloud Run API", table_cell_bold), Paragraph("<code>https://nari-niketan-api-997712460310.asia-south1.run.app</code>", table_cell), Paragraph("Google Cloud Run (asia-south1, Mumbai)", table_cell)],
        [Paragraph("Firestore NoSQL DB", table_cell_bold), Paragraph("<code>nari-niketan</code> (default instance)", table_cell), Paragraph("Google Cloud Firestore (asia-south1)", table_cell)],
        [Paragraph("Firebase Storage Bucket", table_cell_bold), Paragraph("<code>gs://nari-niketan.appspot.com</code>", table_cell), Paragraph("Google Cloud Storage (Multi-region asia)", table_cell)]
    ]
    t_endpoints = Table(endpoints_data, colWidths=[130, 270, 140])
    t_endpoints.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_endpoints)

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Architecture PDF successfully built at: {pdf_filename}")

if __name__ == "__main__":
    build_pdf()
