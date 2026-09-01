// =========================================================================
// NARI NIKETAN — Nari AI Website Operations Center Engine v2.0
// Comprehensive Health, QA, Security, Performance, SEO & Business Sentinel
// =========================================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NariOpsEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CONFIG = {
    version: '2.0.0',
    defaultOrigin: typeof window !== 'undefined' ? window.location.origin : 'https://www.nariniketan.shop',
    coreRoutes: [
      { path: '/index.html', title: 'Home', isPublic: true },
      { path: '/shop.html', title: 'Shop Storefront', isPublic: true },
      { path: '/product.html', title: 'Product Detail', isPublic: true },
      { path: '/cart.html', title: 'Cart', isPublic: true },
      { path: '/checkout.html', title: 'Checkout & Pickup', isPublic: true },
      { path: '/login.html', title: 'Customer Login', isPublic: true },
      { path: '/register.html', title: 'Register', isPublic: true },
      { path: '/my-account.html', title: 'My Account', isProtected: true },
      { path: '/my-orders.html', title: 'My Orders', isProtected: true },
      { path: '/seller/login.html', title: 'Seller Login', isPublic: true },
      { path: '/seller/index.html', title: 'Seller Portal', isProtected: true },
      { path: '/delivery/login.html', title: 'Delivery Partner Login', isPublic: true },
      { path: '/delivery/index.html', title: 'Delivery Partner Portal', isProtected: true },
      { path: '/admin/index.html', title: 'Admin Operations', isProtected: true },
      { path: '/grievance-redressal.html', title: 'Grievance Redressal', isPublic: true },
      { path: '/privacy-policy.html', title: 'Privacy Policy', isPublic: true },
      { path: '/terms-and-conditions.html', title: 'Terms & Conditions', isPublic: true },
      { path: '/return-policy.html', title: 'Return Policy', isPublic: true }
    ],
    viewports: [
      { id: 'vp-320', width: 320, height: 568, name: '320 × 568 (Small Phone)', isMobile: true },
      { id: 'vp-360', width: 360, height: 800, name: '360 × 800 (Android Standard)', isMobile: true },
      { id: 'vp-375', width: 375, height: 812, name: '375 × 812 (iPhone SE / Mini)', isMobile: true },
      { id: 'vp-390', width: 390, height: 844, name: '390 × 844 (iPhone 14 / 15)', isMobile: true },
      { id: 'vp-412', width: 412, height: 915, name: '412 × 915 (Galaxy / Pixel)', isMobile: true },
      { id: 'vp-430', width: 430, height: 932, name: '430 × 932 (iPhone Pro Max)', isMobile: true },
      { id: 'vp-768', width: 768, height: 1024, name: '768 × 1024 (Tablet / iPad)', isMobile: false },
      { id: 'vp-1280', width: 1280, height: 800, name: '1280 × 800 (Desktop HD)', isMobile: false }
    ],
    pillarWeights: {
      website: 10,
      functionality: 12,
      responsive: 12,
      api: 10,
      firebase: 10,
      security: 10,
      performance: 8,
      seo: 8,
      accessibility: 8,
      seller: 6,
      admin: 6
    }
  };

  class OperationsEngine {
    constructor() {
      this.state = {
        lastRunTimestamp: null,
        overallScore: null,
        status: 'NOT TESTED',
        activeIncidents: [],
        pillarResults: {
          website: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          functionality: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          responsive: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          api: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          firebase: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          security: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          performance: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          seo: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          accessibility: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          seller: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          admin: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 },
          ai: { status: 'NOT TESTED', score: null, findings: [], passed: 0, failed: 0 }
        },
        viewportMatrix: {}
      };
      CONFIG.viewports.forEach(vp => {
        this.state.viewportMatrix[vp.id] = { ...vp, status: 'NOT TESTED', overflowPx: 0, culprit: null };
      });
    }

    // ── 1. Calculate Score for a Pillar based on real findings ─────────────────
    calculatePillarScore(pillarKey) {
      const p = this.state.pillarResults[pillarKey];
      if (!p || (p.passed === 0 && p.failed === 0)) return null;

      let penalty = 0;
      p.findings.forEach(f => {
        const sev = (f.severity || 'MEDIUM').toUpperCase();
        if (sev === 'CRITICAL') penalty += 25;
        else if (sev === 'HIGH') penalty += 15;
        else if (sev === 'MEDIUM') penalty += 8;
        else if (sev === 'LOW') penalty += 3;
      });

      const score = Math.max(0, 100 - penalty);
      p.score = score;
      p.status = score >= 90 ? 'HEALTHY' : (score >= 70 ? 'WARNING' : 'FAILING');
      return score;
    }

    // ── 2. Calculate Aggregate Overall Score ─────────────────────────────────
    calculateOverallScore() {
      let totalWeighted = 0;
      let totalWeight = 0;

      for (const [pillar, weight] of Object.entries(CONFIG.pillarWeights)) {
        const score = this.calculatePillarScore(pillar);
        if (score !== null) {
          totalWeighted += (score * weight);
          totalWeight += weight;
        }
      }

      if (totalWeight === 0) {
        this.state.overallScore = null;
        this.state.status = 'NOT TESTED';
        return null;
      }

      this.state.overallScore = Math.round(totalWeighted / totalWeight);
      this.state.status = this.state.overallScore >= 90 ? 'HEALTHY' : (this.state.overallScore >= 70 ? 'WARNING' : 'FAILING');
      return this.state.overallScore;
    }

    // ── 3. Add Diagnostic Finding ─────────────────────────────────────────────
    addFinding(pillarKey, finding) {
      if (!this.state.pillarResults[pillarKey]) return;
      const p = this.state.pillarResults[pillarKey];
      
      const record = {
        id: 'inc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        pillar: pillarKey,
        severity: finding.severity || 'MEDIUM',
        category: finding.category || 'General',
        title: finding.title || 'Diagnostic Notice',
        problem: finding.problem || '',
        cause: finding.cause || '',
        fix: finding.fix || '',
        evidence: finding.evidence || '',
        page: finding.page || '',
        target: finding.target || '',
        timestamp: new Date().toISOString(),
        status: 'OPEN'
      };

      p.findings.push(record);
      p.failed++;
      this.state.activeIncidents.unshift(record);
      return record;
    }

    markPassed(pillarKey, count = 1) {
      if (this.state.pillarResults[pillarKey]) {
        this.state.pillarResults[pillarKey].passed += count;
      }
    }

    // ── 4. Pillar: Multi-Viewport & Responsive Layout Sandbox Auditor ─────────
    async auditViewport(doc, viewport) {
      const { width, height, id } = viewport;
      const pKey = 'responsive';

      if (!doc || !doc.documentElement) {
        this.state.viewportMatrix[id] = { ...viewport, status: 'ERROR', overflowPx: 0, culprit: 'Document not accessible' };
        return;
      }

      const scrollW = Math.max(
        doc.documentElement.scrollWidth || 0,
        doc.body ? doc.body.scrollWidth : 0
      );

      const overflowPx = Math.max(0, scrollW - width);
      const culprits = [];

      if (scrollW > width + 3) {
        const allEls = doc.querySelectorAll('body *');
        for (let i = 0; i < allEls.length; i++) {
          const el = allEls[i];
          if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            const r = el.getBoundingClientRect();
            if (r.right > width + 3 || r.left < -3 || r.width > width + 3) {
              const sel = el.id ? '#' + el.id : (el.className ? '.' + String(el.className).trim().split(' ')[0] : el.tagName.toLowerCase());
              if (!culprits.includes(sel) && sel !== 'body' && sel !== 'html') {
                culprits.push(sel);
                if (culprits.length >= 3) break;
              }
            }
          }
        }

        const culpritStr = culprits.length ? culprits.join(', ') : 'container layout';
        this.state.viewportMatrix[id] = { ...viewport, status: 'FAIL', overflowPx, culprit: culpritStr };
        this.addFinding(pKey, {
          severity: 'HIGH',
          category: 'Mobile Horizontal Overflow',
          title: `Horizontal overflow on ${width}px viewport`,
          problem: `Page width exceeds viewport width by +${overflowPx}px.`,
          cause: `Offending element(s): ${culpritStr} width extends beyond the screen.`,
          fix: `Apply 'width: 100%; max-width: 100%; box-sizing: border-box; flex-wrap: wrap;' to ${culpritStr}.`,
          evidence: `Viewport width: ${width}px | Rendered document scrollWidth: ${scrollW}px`,
          target: `${width} × ${height}`
        });
      } else {
        this.state.viewportMatrix[id] = { ...viewport, status: 'PASS', overflowPx: 0, culprit: null };
        this.markPassed(pKey);
      }
    }

    // ── 5. Pillar: Broken Links & Asset Scanner ───────────────────────────────
    auditDocumentLinksAndImages(doc, pageUrl) {
      if (!doc) return;

      // Scan Links
      const links = doc.querySelectorAll('a[href]');
      let validLinks = 0;
      links.forEach(a => {
        const href = (a.getAttribute('href') || '').trim();
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        
        if (href.includes('undefined') || href.includes('null') || href.includes('NaN')) {
          this.addFinding('website', {
            severity: 'HIGH',
            category: 'Malformed Link',
            title: 'Malformed link URL detected',
            problem: `Link contains invalid value: "${href}"`,
            cause: 'Missing template parameter or unpopulated product/category slug in link tag.',
            fix: 'Verify URL generation logic before rendering href.',
            evidence: `Text: "${a.textContent.trim().slice(0, 30)}" | Destination: ${href}`,
            page: pageUrl
          });
        } else {
          validLinks++;
        }
      });
      if (validLinks > 0) this.markPassed('website', validLinks);

      // Scan Images
      const imgs = doc.querySelectorAll('img');
      let validImgs = 0;
      imgs.forEach(img => {
        const src = (img.getAttribute('src') || '').trim();
        if (!src) {
          this.addFinding('website', {
            severity: 'MEDIUM',
            category: 'Missing Image Source',
            title: 'Image tag missing src attribute',
            problem: 'An <img> tag has an empty or missing src attribute.',
            cause: 'Product image URL was null or undefined in database record.',
            fix: 'Add fallback placeholder SVG when image URL is missing.',
            page: pageUrl
          });
        } else if (img.complete && img.naturalWidth === 0 && !src.startsWith('data:image/svg')) {
          this.addFinding('website', {
            severity: 'HIGH',
            category: 'Broken Image Asset',
            title: 'Broken image failed to load',
            problem: `Image failed to render: ${src.slice(0, 60)}...`,
            cause: '404 from host or expired Storage URL token.',
            fix: 'Verify asset path in Firebase Storage.',
            evidence: `Alt: "${img.alt || 'No alt'}" | Src: ${src.slice(0, 80)}`,
            page: pageUrl
          });
        } else {
          validImgs++;
        }
      });
      if (validImgs > 0) this.markPassed('website', validImgs);
    }

    // ── 6. Pillar: Interactive Elements & Forms QA ───────────────────────────
    auditDocumentInteractiveElements(doc, pageUrl) {
      if (!doc) return;

      // Test Buttons
      const buttons = doc.querySelectorAll('button, .btn, [role="button"]');
      let safeBtnCount = 0;
      buttons.forEach(btn => {
        const text = (btn.textContent || '').trim();
        const hasAria = btn.getAttribute('aria-label') || btn.getAttribute('title');
        if (!text && !hasAria && !btn.querySelector('svg, img')) {
          this.addFinding('accessibility', {
            severity: 'LOW',
            category: 'Inaccessible Button',
            title: 'Button has no accessible name or text',
            problem: 'A clickable button contains no text or aria-label.',
            cause: 'Icon-only button missing aria-label attribute.',
            fix: 'Add aria-label="..." to the button.',
            page: pageUrl
          });
        } else {
          safeBtnCount++;
        }
      });
      if (safeBtnCount > 0) this.markPassed('functionality', safeBtnCount);

      // Test Forms
      const forms = doc.querySelectorAll('form');
      forms.forEach(form => {
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(inp => {
          const id = inp.getAttribute('id');
          const type = inp.getAttribute('type') || 'text';
          if (type === 'hidden') return;

          const hasLabel = id ? doc.querySelector(`label[for="${id}"]`) : null;
          const hasAriaLabel = inp.getAttribute('aria-label') || inp.getAttribute('placeholder');

          if (!hasLabel && !hasAriaLabel) {
            this.addFinding('accessibility', {
              severity: 'LOW',
              category: 'Form Input Missing Label',
              title: `Input (${type}) missing associated label`,
              problem: 'Form control is missing an explicit <label> or aria-label.',
              cause: 'Input tag without matching for/id label association.',
              fix: 'Add a <label for="..."> or aria-label to the form input.',
              page: pageUrl
            });
          }
        });
      });
      this.markPassed('functionality', forms.length);
    }

    // ── 7. Pillar: SEO & Metadata Audit ───────────────────────────────────────
    auditDocumentSEO(doc, pageUrl) {
      if (!doc) return;

      const title = doc.querySelector('title');
      if (!title || !title.textContent.trim()) {
        this.addFinding('seo', {
          severity: 'HIGH',
          category: 'Missing Page Title',
          title: 'Missing or empty <title> tag',
          problem: 'The page has no <title> tag.',
          cause: 'HTML header omitted title tag.',
          fix: 'Add descriptive <title>Brand — Page Name</title>.',
          page: pageUrl
        });
      } else {
        this.markPassed('seo');
      }

      const metaDesc = doc.querySelector('meta[name="description"]');
      if (!metaDesc || !metaDesc.getAttribute('content')) {
        this.addFinding('seo', {
          severity: 'MEDIUM',
          category: 'Missing Meta Description',
          title: 'Missing meta description tag',
          problem: 'The page lacks a meta description for search engine snippets.',
          cause: '<meta name="description"> tag missing in <head>.',
          fix: 'Add <meta name="description" content="..."> with 120-160 characters.',
          page: pageUrl
        });
      } else {
        this.markPassed('seo');
      }

      const h1s = doc.querySelectorAll('h1');
      if (h1s.length === 0) {
        this.addFinding('seo', {
          severity: 'MEDIUM',
          category: 'Missing H1 Heading',
          title: 'Page has no <h1> heading',
          problem: 'Search engines expect exactly one primary <h1> heading per document.',
          cause: 'Header hierarchy begins with h2 or div.',
          fix: 'Add a single prominent <h1> representing the page title.',
          page: pageUrl
        });
      } else if (h1s.length > 1) {
        this.addFinding('seo', {
          severity: 'LOW',
          category: 'Multiple H1 Headings',
          title: `Multiple <h1> tags found (${h1s.length})`,
          problem: 'Best SEO practice requires a single <h1> heading per page.',
          cause: 'Multiple components render <h1> tags.',
          fix: 'Refactor secondary titles to <h2>.',
          page: pageUrl
        });
      } else {
        this.markPassed('seo');
      }
    }

    // ── 8. Pillar: Defensive Security & Configuration Audit ───────────────────
    auditSecurityConfig(doc, pageUrl) {
      if (typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        this.addFinding('security', {
          severity: 'CRITICAL',
          category: 'Insecure Transport (HTTP)',
          title: 'Page served over insecure HTTP',
          problem: 'Traffic is unencrypted, exposing user credentials and data.',
          cause: 'SSL certificate not configured or redirect missing.',
          fix: 'Enforce HTTPS redirect via Firebase Hosting / Cloudflare.',
          page: pageUrl
        });
      } else {
        this.markPassed('security');
      }

      if (doc) {
        const scripts = doc.querySelectorAll('script:not([src])');
        scripts.forEach(s => {
          const code = s.textContent || '';
          if (code.includes('eval(') || code.includes('document.write(')) {
            this.addFinding('security', {
              severity: 'HIGH',
              category: 'Dangerous DOM Pattern',
              title: 'Use of eval() or document.write() detected',
              problem: 'Inline script uses unsafe execution primitives.',
              cause: 'Legacy script snippet.',
              fix: 'Replace eval/document.write with safe DOM manipulation methods.',
              page: pageUrl
            });
          }
        });
      }
      this.markPassed('security');
    }

    // ── 9. Pillar: Firebase & Firestore Database Latency / Health Probe ───────
    async probeFirebase(db) {
      const pKey = 'firebase';
      if (!db) {
        this.addFinding(pKey, {
          severity: 'CRITICAL',
          category: 'Firebase Database Offline',
          title: 'Firestore SDK is not initialized',
          problem: 'Application cannot connect to Cloud Firestore.',
          cause: 'Firebase configuration object missing or invalid credentials.',
          fix: 'Verify firebase-config.js initialization.'
        });
        return;
      }

      const start = Date.now();
      try {
        await db.collection('products').limit(1).get();
        const latency = Date.now() - start;

        if (latency > 3000) {
          this.addFinding(pKey, {
            severity: 'MEDIUM',
            category: 'Slow Firestore Latency',
            title: `Firestore query latency high (${latency}ms)`,
            problem: `Read operation took ${latency}ms to respond.`,
            cause: 'Network congestion or missing index.',
            fix: 'Add composite indexes or verify network routing.'
          });
        } else {
          this.markPassed(pKey, 2);
        }
      } catch (err) {
        this.addFinding(pKey, {
          severity: 'CRITICAL',
          category: 'Firestore Permission/Network Error',
          title: 'Firestore query failed: ' + (err.message || 'Error'),
          problem: err.message,
          cause: 'Security rules rejected query or quota exhausted.',
          fix: 'Review firestore.rules permissions.'
        });
      }
    }

    // ── 10. Pillar: Business Logic, Prices & Fulfilment Checks ─────────────────
    auditBusinessLogic(cartItems, orderData) {
      const pKey = 'functionality';

      // Verify cart calculation
      if (cartItems && cartItems.length > 0) {
        let computedTotal = 0;
        cartItems.forEach(item => {
          const price = Number(item.salePrice || item.price) || 0;
          const qty = Number(item.quantity) || 1;
          if (price <= 0) {
            this.addFinding(pKey, {
              severity: 'HIGH',
              category: 'Zero/Negative Product Price',
              title: `Item "${item.name || 'Product'}" has invalid price ₹${price}`,
              problem: 'Product price is zero or negative.',
              cause: 'Malformed catalog entry.',
              fix: 'Correct product price in seller portal.'
            });
          }
          computedTotal += (price * qty);
        });
        this.markPassed(pKey);
      }

      // Verify Delivery vs Store Pickup constraints
      if (orderData) {
        if (orderData.fulfilmentType === 'pickup') {
          if (!orderData.storePickupLocation) {
            this.addFinding(pKey, {
              severity: 'HIGH',
              category: 'Store Pickup Missing Hub',
              title: 'Pickup order missing selected store hub',
              problem: 'Order marked as pickup but has no store location.',
              cause: 'Checkout form allowed submission without pickup selection.',
              fix: 'Enforce store pickup selection before order creation.'
            });
          } else {
            this.markPassed(pKey);
          }
        } else if (orderData.fulfilmentType === 'delivery') {
          if (!orderData.shippingAddress || !orderData.shippingAddress.pincode) {
            this.addFinding(pKey, {
              severity: 'HIGH',
              category: 'Delivery Missing Address',
              title: 'Delivery order missing shipping pincode',
              problem: 'Home delivery selected but shipping address is incomplete.',
              cause: 'Validation bypassed.',
              fix: 'Require valid 6-digit pincode for delivery.'
            });
          } else {
            this.markPassed(pKey);
          }
        }
      }
    }

    // ── 11. Pillar: AI Services Health ────────────────────────────────────────
    auditAIServices() {
      const pKey = 'ai';
      if (typeof window !== 'undefined') {
        const hasStylist = !!window.NariAIStylist || !!document.getElementById('nari-ai-launcher');
        const hasSearch = !!window.NariAISearch;
        const hasAds = !!window.NariAIAds;

        if (hasStylist) this.markPassed(pKey);
        if (hasSearch) this.markPassed(pKey);
        if (hasAds) this.markPassed(pKey);
      }
    }

    // ── 12. Finalize Audit Run & Generate Incident Report ──────────────────────
    finalizeRun() {
      this.state.lastRunTimestamp = new Date().toISOString();
      this.auditAIServices();
      this.calculateOverallScore();

      return {
        timestamp: this.state.lastRunTimestamp,
        overallScore: this.state.overallScore,
        status: this.state.status,
        pillarResults: this.state.pillarResults,
        viewportMatrix: this.state.viewportMatrix,
        incidents: this.state.activeIncidents
      };
    }

    // ── Export Full Audit Report ──────────────────────────────────────────────
    exportReport(format = 'json') {
      const summary = {
        title: 'Nari Niketan Website Operations Center — Health Audit Report',
        generatedAt: new Date().toLocaleString('en-IN'),
        version: CONFIG.version,
        overallScore: this.state.overallScore,
        status: this.state.status,
        pillarBreakdown: {},
        incidentsCount: this.state.activeIncidents.length,
        incidents: this.state.activeIncidents
      };

      for (const [key, p] of Object.entries(this.state.pillarResults)) {
        summary.pillarBreakdown[key] = {
          status: p.status,
          score: p.score,
          passed: p.passed,
          failed: p.failed,
          findingsCount: p.findings.length
        };
      }

      if (format === 'json') {
        return JSON.stringify(summary, null, 2);
      } else if (format === 'csv') {
        let csv = 'Severity,Category,Title,Problem,Cause,Suggested Fix,Page/Target,Timestamp\n';
        this.state.activeIncidents.forEach(inc => {
          csv += `"${inc.severity}","${inc.category}","${inc.title.replace(/"/g, '""')}","${inc.problem.replace(/"/g, '""')}","${inc.cause.replace(/"/g, '""')}","${inc.fix.replace(/"/g, '""')}","${inc.page || inc.target || ''}","${inc.timestamp}"\n`;
        });
        return csv;
      }
      return summary;
    }
  }

  return new OperationsEngine();
}));
