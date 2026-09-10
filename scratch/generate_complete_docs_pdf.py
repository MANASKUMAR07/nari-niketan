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
        self.drawString(36, 11 * inch - 30, "NARI NIKETAN — Complete Technology, System Architecture & Backend API Documentation")
        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.5)
        self.line(36, 11 * inch - 34, 8.5 * inch - 36, 11 * inch - 34)

        # Running Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 36, 24, page_str)
        self.drawString(36, 24, "CONFIDENTIAL & PROPRIETARY — Nari Niketan Engineering Specification v2.2")
        self.line(36, 32, 8.5 * inch - 36, 32)

        self.restoreState()


def build_pdf():
    pdf_filename = r"c:\Users\manas\OneDrive\Desktop\NARI NIKETAN\Nari_Niketan_Complete_Technical_Documentation.pdf"
    
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=44,
        bottomMargin=44
    )

    styles = getSampleStyleSheet()

    # Custom Typography Styles
    c_primary = colors.HexColor("#8B1A4A")
    c_gold = colors.HexColor("#B8860B")
    c_dark = colors.HexColor("#111827")
    c_body = colors.HexColor("#374151")
    c_dim = colors.HexColor("#6B7280")
    c_bg_light = colors.HexColor("#F9FAFB")

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=c_primary,
        alignment=1, # Center
        spaceAfter=12
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=c_gold,
        alignment=1,
        spaceAfter=18
    )

    h1_style = ParagraphStyle(
        'ChapterH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=c_primary,
        spaceBefore=12,
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
        spaceBefore=9,
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

    code_style = ParagraphStyle(
        'CustomCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#065F46"),
        spaceAfter=4
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
        return HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#E5E7EB"), spaceBefore=5, spaceAfter=7)

    # =========================================================================
    # COVER PAGE
    # =========================================================================
    story.append(Spacer(1, 30))
    story.append(p("NARI NIKETAN", title_style))
    story.append(p("COMPLETE TECHNOLOGY, SYSTEM ARCHITECTURE & BACKEND API DOCUMENTATION", subtitle_style))
    story.append(hr())
    
    meta_text = """
    <b>Comprehensive Technical Reference Manual &amp; Engineering Audit</b><br/>
    <b>Version:</b> 2.2.0 (Production Node.js Backend API Release) &nbsp;|&nbsp; <b>Date:</b> September 2026<br/>
    <b>Platform:</b> High-Performance Indian Ethnic E-Commerce Platform + Cloud Run Microservice<br/>
    <b>Storefront URL:</b> https://www.nariniketan.shop &nbsp;|&nbsp; <b>Firebase App:</b> https://nari-niketan.web.app<br/>
    <b>Backend API URL:</b> https://nari-niketan-api-997712460310.asia-south1.run.app
    """
    story.append(p(meta_text, ParagraphStyle('CoverMeta', parent=body_style, alignment=1, fontSize=8, leading=11, textColor=c_dim)))
    story.append(Spacer(1, 20))

    cover_summary_data = [
        [Paragraph("<b>Audit Metric / Attribute</b>", table_header), Paragraph("<b>Verified Value / State</b>", table_header)],
        [Paragraph("<b>Architecture Type</b>", table_cell_bold), Paragraph("Hybrid Jamstack + Node.js/Express Secure API on Google Cloud Run", table_cell)],
        [Paragraph("<b>Frontend Storefront</b>", table_cell_bold), Paragraph("Vanilla ES6+ JavaScript, Semantic HTML5, Modular CSS3 Architecture", table_cell)],
        [Paragraph("<b>Backend API Layer</b>", table_cell_bold), Paragraph("Express 4.19, Helmet, Strict CORS, Tiered Rate Limiting, Winston Audit Logs", table_cell)],
        [Paragraph("<b>Database &amp; Cloud Storage</b>", table_cell_bold), Paragraph("Cloud Firestore (17 Collections) + Firebase Cloud Storage (5MB MIME Rules)", table_cell)],
        [Paragraph("<b>Authentication &amp; RBAC</b>", table_cell_bold), Paragraph("Firebase Auth ID Tokens + Firebase Custom Claims (Admin, Seller, Owner)", table_cell)],
        [Paragraph("<b>Pricing &amp; Order Engine</b>", table_cell_bold), Paragraph("Server-Authoritative Calculation: Zero Trust on Client Prices/Subtotals", table_cell)],
        [Paragraph("<b>Internal AI Suite</b>", table_cell_bold), Paragraph("Nari AI Stylist RAG, NLP Search, Virtual Try-On, Nari AI Ads, Seller Photo Wizard", table_cell)],
        [Paragraph("<b>Continuous Monitoring</b>", table_cell_bold), Paragraph("Nari AI Website Operations Center (12 Pillars, 8 Viewports Sandbox Testing)", table_cell)],
        [Paragraph("<b>Fulfilment Model</b>", table_cell_bold), Paragraph("Dual Mode: Direct Home Delivery + Physical Store Pickup (Google Maps Geocoding)", table_cell)],
        [Paragraph("<b>Hosting &amp; Edge CDN</b>", table_cell_bold), Paragraph("Firebase Hosting (Global Fastly CDN, TLS 1.3) + Cloud Run (asia-south1)", table_cell)]
    ]
    t_cover = Table(cover_summary_data, colWidths=[180, 360])
    t_cover.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_cover)
    story.append(Spacer(1, 20))
    story.append(p("<b>Document Classification:</b> CONFIDENTIAL / OFFICIAL ENGINEERING SPECIFICATION", ParagraphStyle('Class', parent=body_style, alignment=1, fontSize=8, textColor=c_gold)))
    story.append(PageBreak())

    # =========================================================================
    # PART 1 & 2: EXECUTIVE SUMMARY & TECHNOLOGY STACK
    # =========================================================================
    story.append(p("Part 1 & 2 — Executive Summary & Complete Technology Stack", h1_style))
    story.append(hr())
    story.append(p("<b>1.1 System Purpose &amp; Domain:</b><br/>Nari Niketan is an enterprise-grade ethnic fashion e-commerce ecosystem serving premium Indian ethnic wear (Sarees, Lehengas, Kurtis, Suits, Dupattas, Gowns, Jewellery). The platform implements a secure 3-tier architecture with zero-trust business logic running on Google Cloud Run."))

    tech_stack_data = [
        [Paragraph("<b>Layer / Domain</b>", table_header), Paragraph("<b>Technologies &amp; Libraries</b>", table_header), Paragraph("<b>Version &amp; Notes</b>", table_header)],
        [Paragraph("Frontend UI / Storefront", table_cell_bold), Paragraph("HTML5 Semantic, CSS3 Custom Properties, Vanilla ES6+ JS", table_cell), Paragraph("Zero framework dependencies, ultra-fast load", table_cell)],
        [Paragraph("Backend API Runtime", table_cell_bold), Paragraph("Node.js, Express.js, Docker, Google Cloud Run", table_cell), Paragraph("Node v20 LTS, asia-south1 region", table_cell)],
        [Paragraph("Backend Security", table_cell_bold), Paragraph("Helmet, CORS Allowlist, express-rate-limit, Zod", table_cell), Paragraph("Strict input validation &amp; tiered DDoS mitigation", table_cell)],
        [Paragraph("SDK &amp; Persistence", table_cell_bold), Paragraph("firebase-admin SDK, Cloud Firestore NoSQL", table_cell), Paragraph("v12.3.0, Application Default Credentials (ADC)", table_cell)],
        [Paragraph("Client-Side Auth", table_cell_bold), Paragraph("Firebase Auth (Email, Google OAuth, Phone OTP)", table_cell), Paragraph("Bearer ID Token attached to API calls", table_cell)],
        [Paragraph("Image &amp; Asset Storage", table_cell_bold), Paragraph("Firebase Cloud Storage, Fastly Edge CDN", table_cell), Paragraph("5MB max upload, image/* MIME validation", table_cell)],
        [Paragraph("Geocoding &amp; Maps", table_cell_bold), Paragraph("OpenStreetMap, Leaflet.js, Google Maps Platform", table_cell), Paragraph("GPS coordinate capture &amp; store pickup routing", table_cell)],
        [Paragraph("Logging &amp; Monitoring", table_cell_bold), Paragraph("Winston Structured Logger, Nari Ops Engine v2.0", table_cell), Paragraph("Audit logging for all orders, roles, payouts", table_cell)]
    ]
    t_tech = Table(tech_stack_data, colWidths=[120, 240, 180])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 3.5),
    ]))
    story.append(t_tech)

    # =========================================================================
    # PART 4 & 5: SYSTEM ARCHITECTURE MODEL & BACKEND DESIGN
    # =========================================================================
    story.append(Spacer(1, 8))
    story.append(p("Part 4 & 5 — 3-Tier System Architecture & Cloud Run API Layer", h1_style))
    story.append(hr())
    story.append(p("<b>5.1 Architectural Decoupling &amp; Security Boundary:</b><br/>To guarantee tamper-proof order totals, discount calculations, and role authorizations, all state-mutating operations are decoupled from the browser and handled by the Node.js Cloud Run service:"))

    arch_points = [
        "<b>1. Client Presentation Tier:</b> HTML5/CSS3/JS storefront hosted on Firebase Global CDN. Executes client-side UX estimates, AI Stylist advisor, and sends Bearer ID tokens on checkout.",
        "<b>2. Application Security Tier (Cloud Run):</b> Express API verifying Firebase ID tokens, validating Zod schemas, enforcing tiered rate limits, calculating pricing authoritatively, and setting Custom Claims.",
        "<b>3. Cloud Persistence Tier (GCP):</b> Cloud Firestore managing 17 distinct collections, Cloud Storage housing product images, and Firebase Auth managing user identities."
    ]
    for ap in arch_points:
        story.append(p(f"• {ap}", bullet_style))

    # =========================================================================
    # PART 12: BACKEND API ENDPOINT REFERENCE MATRIX
    # =========================================================================
    story.append(PageBreak())
    story.append(p("Part 12 — Backend API Endpoint Reference Matrix", h1_style))
    story.append(hr())
    story.append(p("All API endpoints are mounted under <code>/api/*</code> and require Bearer Token authorization unless marked Public:"))

    api_matrix = [
        [Paragraph("<b>Method &amp; Endpoint</b>", table_header), Paragraph("<b>Auth Level</b>", table_header), Paragraph("<b>Description &amp; Security Controls</b>", table_header)],
        [Paragraph("<code>GET /api/health</code>", table_cell_bold), Paragraph("Public", table_cell), Paragraph("Returns service health, version, and environment status", table_cell)],
        [Paragraph("<code>GET /</code>", table_cell_bold), Paragraph("Public", table_cell), Paragraph("Root welcome status and documentation pointer", table_cell)],
        [Paragraph("<code>POST /api/orders</code>", table_cell_bold), Paragraph("Authenticated", table_cell), Paragraph("Creates order with server-calculated price, stock check &amp; coupon", table_cell)],
        [Paragraph("<code>GET /api/orders/my</code>", table_cell_bold), Paragraph("Authenticated", table_cell), Paragraph("Fetches authenticated user's personal order history", table_cell)],
        [Paragraph("<code>GET /api/orders/:id</code>", table_cell_bold), Paragraph("Authenticated", table_cell), Paragraph("Gets single order. Customers see self, Admin all, Seller line items", table_cell)],
        [Paragraph("<code>POST /api/coupons/validate</code>", table_cell_bold), Paragraph("Authenticated", table_cell), Paragraph("Validates coupon dates, usage limits, minimum order &amp; discount", table_cell)],
        [Paragraph("<code>POST /api/payments/submit-utr</code>", table_cell_bold), Paragraph("Authenticated", table_cell), Paragraph("Submits manual UPI UTR. Rejects duplicate UTRs. Status: Pending", table_cell)],
        [Paragraph("<code>GET /api/payments/status/:id</code>", table_cell_bold), Paragraph("Authenticated", table_cell), Paragraph("Returns verification status of order payment", table_cell)],
        [Paragraph("<code>GET /api/admin/orders</code>", table_cell_bold), Paragraph("Admin / Owner", table_cell), Paragraph("Lists all store orders with status and date filters", table_cell)],
        [Paragraph("<code>PATCH /api/admin/orders/:id/status</code>", table_cell_bold), Paragraph("Admin / Owner", table_cell), Paragraph("Updates order lifecycle state and delivery milestones", table_cell)],
        [Paragraph("<code>PATCH /api/admin/orders/:id/verify-payment</code>", table_cell_bold), Paragraph("Admin / Owner", table_cell), Paragraph("Manually confirms customer UPI UTR payment", table_cell)],
        [Paragraph("<code>PATCH /api/admin/users/:uid/role</code>", table_cell_bold), Paragraph("Owner Only", table_cell), Paragraph("Sets Firebase Custom Claims (admin, seller, owner)", table_cell)],
        [Paragraph("<code>PATCH /api/admin/users/:uid/block</code>", table_cell_bold), Paragraph("Admin / Owner", table_cell), Paragraph("Disables/enables user account in Firebase Auth &amp; Firestore", table_cell)],
        [Paragraph("<code>POST /api/admin/coupons</code>", table_cell_bold), Paragraph("Admin / Owner", table_cell), Paragraph("Creates new promotional discount coupon", table_cell)],
        [Paragraph("<code>GET /api/seller/products</code>", table_cell_bold), Paragraph("Seller Role", table_cell), Paragraph("Lists catalog products belonging to authenticated seller", table_cell)],
        [Paragraph("<code>POST /api/seller/products</code>", table_cell_bold), Paragraph("Seller Role", table_cell), Paragraph("Adds new product with sellerId bound from verified token", table_cell)],
        [Paragraph("<code>PATCH /api/seller/products/:id</code>", table_cell_bold), Paragraph("Seller Role", table_cell), Paragraph("Updates product details (ownership verified on every update)", table_cell)],
        [Paragraph("<code>GET /api/seller/earnings</code>", table_cell_bold), Paragraph("Seller Role", table_cell), Paragraph("Computes revenue breakdown (day, week, month, total)", table_cell)]
    ]
    t_api = Table(api_matrix, colWidths=[160, 90, 290])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_api)

    # =========================================================================
    # PART 10 & 11: AUTHENTICATION, RBAC & CUSTOM CLAIMS
    # =========================================================================
    story.append(Spacer(1, 8))
    story.append(p("Part 10 & 11 — Authentication & Firebase Custom Claims RBAC Matrix", h1_style))
    story.append(hr())
    story.append(p("<b>11.1 Custom Claims Authorization Model:</b><br/>Role elevation is strictly enforced via Firebase Auth Custom Claims set by the backend Admin SDK. Clients cannot alter their own claims:"))

    rbac_data = [
        [Paragraph("<b>Role Level</b>", table_header), Paragraph("<b>Claim Property</b>", table_header), Paragraph("<b>Target User Scope</b>", table_header), Paragraph("<b>Privilege Scope</b>", table_header)],
        [Paragraph("Customer / Guest", table_cell_bold), Paragraph("Default (No Claims)", table_cell), Paragraph("All registered shoppers", table_cell), Paragraph("Browse catalog, create orders, view personal orders", table_cell)],
        [Paragraph("Approved Seller", table_cell_bold), Paragraph("<code>{ seller: true }</code>", table_cell), Paragraph("Verified vendor partners", table_cell), Paragraph("Manage own products, view order line items &amp; earnings", table_cell)],
        [Paragraph("Store Admin", table_cell_bold), Paragraph("<code>{ admin: true }</code>", table_cell), Paragraph("Operations &amp; support managers", table_cell), Paragraph("Order management, payment verification, coupon creation", table_cell)],
        [Paragraph("Platform Owner", table_cell_bold), Paragraph("<code>{ owner: true }</code>", table_cell), Paragraph("Verified root administrators", table_cell), Paragraph("Full system access + role elevation &amp; payout dispatch", table_cell)]
    ]
    t_rbac = Table(rbac_data, colWidths=[100, 110, 140, 190])
    t_rbac.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 3.5),
    ]))
    story.append(t_rbac)

    # =========================================================================
    # PART 13 & 14: INTERNAL AI SUITE & OPS CENTER
    # =========================================================================
    story.append(PageBreak())
    story.append(p("Part 13 & 14 — Internal AI Suite & Operations Center Sentinel", h1_style))
    story.append(hr())
    story.append(p("<b>13.1 Rule-Based Client-Side AI Engines:</b><br/>All internal AI features operate locally in the browser with zero external paid API dependencies, ensuring privacy, instant latency, and zero token costs:"))

    ai_features = [
        "<b>1. Nari AI Stylist Advisor (<code>js/nari-ai-stylist.js</code>):</b> Multi-criteria outfit recommendation engine utilizing body shape analysis, occasion taxonomy, and color harmony charts.",
        "<b>2. Natural Language Search (<code>js/nari-ai-search.js</code>):</b> Query tokenizer extracting colors, fabrics, prices, and categories into interactive search filter chips.",
        "<b>3. Virtual Try-On Canvas (<code>js/nari-virtual-tryon.js</code>):</b> HTML5 Canvas composite tool overlaying drape silhouettes on customer-uploaded photos.",
        "<b>4. Nari AI Ad Studio (<code>js/nari-ai-ads.js</code>):</b> Contextual ad headline and CTA generator tracking variant click-through performance.",
        "<b>5. Seller Copywriter &amp; Photo Assistant (<code>seller/seller-ai.js</code>):</b> Structured product description generator across 7 brand voices and 6-angle photo checklist."
    ]
    for af in ai_features:
        story.append(p(f"• {af}", bullet_style))

    story.append(Spacer(1, 6))
    story.append(p("<b>14.1 Website Operations Center v2.0 (12 Pillars Live Health Monitoring):</b>"))

    ops_pillars = [
        [Paragraph("<b>Pillar</b>", table_header), Paragraph("<b>Inspection Scope</b>", table_header), Paragraph("<b>Verification Method</b>", table_header)],
        [Paragraph("1. Website Routes", table_cell_bold), Paragraph("Crawls 16 core pages, detects 404s and broken links", table_cell), Paragraph("Live fetch &amp; sandbox DOM link parsing", table_cell)],
        [Paragraph("2. QA &amp; Journeys", table_cell_bold), Paragraph("Form constraints, button handlers, Add-to-Cart state", table_cell), Paragraph("Simulated click events &amp; form checks", table_cell)],
        [Paragraph("3. Multi-Viewport", table_cell_bold), Paragraph("Overflow checks across 8 viewports (320px–1280px)", table_cell), Paragraph("Isolated iframe sandbox scrollWidth probe", table_cell)],
        [Paragraph("4. Backend API", table_cell_bold), Paragraph("Endpoint response codes, latency &amp; Cloud Run status", table_cell), Paragraph("Health check probe on /api/health", table_cell)],
        [Paragraph("5. Firestore DB", table_cell_bold), Paragraph("Firestore query latency and collection read/write rules", table_cell), Paragraph("Live read probe on 'products' collection", table_cell)],
        [Paragraph("6. Security &amp; Config", table_cell_bold), Paragraph("HTTPS, X-Frame-Options, MIME sniffing, safe scripts", table_cell), Paragraph("Response header scanner", table_cell)],
        [Paragraph("7. Performance", table_cell_bold), Paragraph("DOM load time, page weight, heavy images (>500KB)", table_cell), Paragraph("Performance API &amp; image dimensions", table_cell)],
        [Paragraph("8. SEO &amp; Metadata", table_cell_bold), Paragraph("Title tags, meta descriptions, single H1, canonical tags", table_cell), Paragraph("HTML head parser", table_cell)],
        [Paragraph("9. Accessibility", table_cell_bold), Paragraph("Image alt tags, accessible button names, input labels", table_cell), Paragraph("WCAG 2.1 AA attribute auditor", table_cell)],
        [Paragraph("10. Seller Portal", table_cell_bold), Paragraph("6-image upload constraints, draft/publish state", table_cell), Paragraph("Seller form &amp; image array validator", table_cell)],
        [Paragraph("11. Admin Operations", table_cell_bold), Paragraph("Order state transitions, invoice calculations", table_cell), Paragraph("Admin state machine probe", table_cell)],
        [Paragraph("12. AI Services", table_cell_bold), Paragraph("Availability of Stylist, Search, Ads &amp; Try-on", table_cell), Paragraph("Global AI object integrity probe", table_cell)]
    ]
    t_ops = Table(ops_pillars, colWidths=[100, 260, 180])
    t_ops.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_ops)

    # =========================================================================
    # PART 41: MASTER ARCHITECTURE DIAGRAM
    # =========================================================================
    story.append(PageBreak())
    story.append(p("Part 41 — Master System Architecture Blueprint", h1_style))
    story.append(hr())
    
    # Master Architecture Diagram using styled table
    diag_rows = [
        [Paragraph("<b>TIER 1: CLIENT ACCESS TIERS (Presentation Layer)</b>", table_header), "", ""],
        [Paragraph("<b>Customer Storefront</b><br/>shop.html, cart.html, checkout.html<br/>Firebase Hosting (Global Fastly CDN)", table_cell),
         Paragraph("<b>Seller Vendor Portal</b><br/>/seller/index.html<br/>Catalog, Inventory, AI Copywriter", table_cell),
         Paragraph("<b>Admin Operations Portal</b><br/>/admin/index.html<br/>Orders, Users, Payouts, Health Sentinel", table_cell)],
        [Paragraph("<b>HTTPS REST Requests + Bearer Firebase ID Token (Authorization Header) &darr;</b>", ParagraphStyle('DiagArrow', parent=table_cell_bold, alignment=1, textColor=c_primary)), "", ""],
        [Paragraph("<b>TIER 2: NODE.JS / EXPRESS BACKEND API (Google Cloud Run — asia-south1)</b>", table_header), "", ""],
        [Paragraph("<b>Security &amp; Auth Gateway</b><br/>• authenticateFirebaseUser (ID Tokens)<br/>• Firebase Custom Claims (admin/seller/owner)<br/>• Helmet Security Headers &amp; Strict CORS<br/>• Tiered Rate Limiters (DDoS Protection)", table_cell),
         Paragraph("<b>Server Business Logic Engine</b><br/>• Zero-Trust Pricing Calculation<br/>• Server-Authoritative Coupon Engine<br/>• Inventory Stock &amp; Availability Checks<br/>• Manual UPI UTR Duplicate Safeguard", table_cell),
         Paragraph("<b>Observability &amp; Admin SDK</b><br/>• Winston Structured Audit Logging<br/>• Privileged Firebase Admin SDK (ADC)<br/>• Zod Request Schema Validation<br/>• Global Safe Error Handler", table_cell)],
        [Paragraph("<b>Privileged Firestore &amp; Storage Protocols (Application Default Credentials) &darr;</b>", ParagraphStyle('DiagArrow2', parent=table_cell_bold, alignment=1, textColor=c_gold)), "", ""],
        [Paragraph("<b>TIER 3: CLOUD PERSISTENCE &amp; MANAGED SERVICES (Google Cloud Platform)</b>", table_header), "", ""],
        [Paragraph("<b>Cloud Firestore NoSQL</b><br/>17 Collections: products, orders, users, coupons, categories, banners, systemAlerts, payouts", table_cell),
         Paragraph("<b>Firebase Cloud Storage</b><br/>Product media, seller uploads, 5MB image/* rules, delivery proofs", table_cell),
         Paragraph("<b>Firebase Authentication</b><br/>Google OAuth, Email/Password, Phone OTP Identity Store", table_cell)]
    ]
    t_diag = Table(diag_rows, colWidths=[180, 180, 180])
    t_diag.setStyle(TableStyle([
        ('SPAN', (0, 0), (2, 0)),
        ('BACKGROUND', (0, 0), (2, 0), c_primary),
        ('SPAN', (0, 2), (2, 2)),
        ('BACKGROUND', (0, 2), (2, 2), colors.HexColor("#F3F4F6")),
        ('SPAN', (0, 3), (2, 3)),
        ('BACKGROUND', (0, 3), (2, 3), c_primary),
        ('SPAN', (0, 5), (2, 5)),
        ('BACKGROUND', (0, 5), (2, 5), colors.HexColor("#F3F4F6")),
        ('SPAN', (0, 6), (2, 6)),
        ('BACKGROUND', (0, 6), (2, 6), c_gold),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, 1), [colors.HexColor("#F9FAFB")]),
        ('ROWBACKGROUNDS', (0, 4), (-1, 4), [colors.HexColor("#FFFFFF")]),
        ('ROWBACKGROUNDS', (0, 7), (-1, 7), [colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_diag)

    # =========================================================================
    # PART 42: CHECKLIST & EXECUTIVE CONCLUSION
    # =========================================================================
    story.append(Spacer(1, 8))
    story.append(p("Part 42 — Final Implementation Verification Checklist", h1_style))
    story.append(hr())

    chk_data = [
        [Paragraph("<b>Component / Area</b>", table_header), Paragraph("<b>Implementation State</b>", table_header), Paragraph("<b>Readiness</b>", table_header), Paragraph("<b>Production Verification Notes</b>", table_header)],
        [Paragraph("Storefront UI &amp; Navigation", table_cell_bold), Paragraph("Live on Firebase", table_cell), Paragraph("<font color='#16A34A'>100% Ready</font>", table_cell), Paragraph("Zero-overflow across 320px–1280px viewports", table_cell)],
        [Paragraph("Backend API on Cloud Run", table_cell_bold), Paragraph("Live in asia-south1", table_cell), Paragraph("<font color='#16A34A'>100% Ready</font>", table_cell), Paragraph("Revision 00002-rww serving 100% traffic, /api/health OK", table_cell)],
        [Paragraph("Server Pricing &amp; Orders", table_cell_bold), Paragraph("Server-Authoritative", table_cell), Paragraph("<font color='#16A34A'>100% Ready</font>", table_cell), Paragraph("Zero trust on client totals; prices fetched from DB", table_cell)],
        [Paragraph("Custom Claims RBAC", table_cell_bold), Paragraph("Implemented", table_cell), Paragraph("<font color='#16A34A'>100% Ready</font>", table_cell), Paragraph("Admin &amp; Seller roles verified via verified token claims", table_cell)],
        [Paragraph("Manual UPI Verification", table_cell_bold), Paragraph("Pending Review State", table_cell), Paragraph("<font color='#16A34A'>100% Ready</font>", table_cell), Paragraph("UTR submissions queued for admin approval; dupes blocked", table_cell)],
        [Paragraph("Firestore Security Rules", table_cell_bold), Paragraph("Deployed &amp; Hardened", table_cell), Paragraph("<font color='#16A34A'>100% Ready</font>", table_cell), Paragraph("Evaluates Custom Claims with zero-leak user rules", table_cell)]
    ]
    t_chk = Table(chk_data, colWidths=[120, 95, 75, 250])
    t_chk.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ('PADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_chk)

    # Build PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[SUCCESS] Generated comprehensive PDF document successfully at: {pdf_filename}")

if __name__ == "__main__":
    build_pdf()
