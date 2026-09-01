/**
 * =========================================================================
 * NARI NIKETAN — Standalone Operations & QA Audit Suite
 * Automated Test Runner for Node.js / CI / Production Verification
 * =========================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
console.log('🚀 [Nari AI Operations Center] Starting Full Automated Health & QA Audit...\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings = [];

function check(title, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${title}`);
  } catch (err) {
    failedTests++;
    findings.push({ title, error: err.message });
    console.log(`  ❌ [FAIL] ${title} — ${err.message}`);
  }
}

// ── PILLAR 1: CRAWLER & ROUTE DISCOVERY ──────────────────────────────────────
console.log('--- Pillar 1: Core Routes & File Integrity ---');
const coreRoutes = [
  'index.html', 'shop.html', 'product.html', 'cart.html', 'checkout.html',
  'login.html', 'register.html', 'my-account.html', 'my-orders.html',
  'seller/login.html', 'seller/index.html', 'delivery/login.html', 'delivery/index.html', 'admin/index.html',
  'grievance-redressal.html', 'privacy-policy.html', 'terms-and-conditions.html', 'return-policy.html'
];

coreRoutes.forEach(r => {
  check(`Route file exists: ${r}`, () => {
    const fullPath = path.join(ROOT_DIR, r);
    assert(fs.existsSync(fullPath), `File ${r} missing from distribution`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(content.length > 500, `File ${r} is unexpectedly small or empty`);
  });
});

// ── PILLAR 2: RESPONSIVE OVERFLOW & DRAWER BOUNDARIES ────────────────────────
console.log('\n--- Pillar 2: Responsive Zero-Overflow Architecture ---');
check('Layout CSS enforces transform-based drawer with visibility hidden', () => {
  const layoutCss = fs.readFileSync(path.join(ROOT_DIR, 'css/amazon-layout.css'), 'utf8');
  assert(layoutCss.includes('transform: translateX(-110%)'), 'Drawer must use translateX(-110%) when closed');
  assert(layoutCss.includes('visibility: hidden;'), 'Drawer must use visibility: hidden when closed');
  assert(layoutCss.includes('max-width: 85vw'), 'Drawer must be constrained with max-width: 85vw');
});

check('Global mobile overflow protection enabled on html and body', () => {
  const layoutCss = fs.readFileSync(path.join(ROOT_DIR, 'css/amazon-layout.css'), 'utf8');
  assert(layoutCss.includes('overflow-x: hidden !important;'), 'html, body must have overflow-x: hidden');
  assert(layoutCss.includes('max-width: 100vw !important;'), 'html, body must have max-width: 100vw');
});

// ── PILLAR 3: SEARCH & FILTER CHIPS RESPONSIVENESS ───────────────────────────
console.log('\n--- Pillar 3: Search, Chips & Empty State QA ---');
check('AI search suggestions wrap naturally without horizontal scrolling', () => {
  const searchCss = fs.readFileSync(path.join(ROOT_DIR, 'css/nari-ai-search.css'), 'utf8');
  assert(searchCss.includes('flex-wrap: wrap;'), 'Search suggestions must have flex-wrap: wrap');
});

check('Shop empty state is centered and constrained to max-width', () => {
  const shopCss = fs.readFileSync(path.join(ROOT_DIR, 'css/shop.css'), 'utf8');
  assert(shopCss.includes('.empty-state'), 'shop.css must style .empty-state');
  assert(shopCss.includes('max-width: 440px;'), 'Empty state card must be constrained to 440px');
});

// ── PILLAR 4: FLOATING WIDGET SAFE AREA INSET ────────────────────────────────
console.log('\n--- Pillar 4: Floating UI & Safe-Area Compliance ---');
check('AI Stylist floating launcher respects mobile safe-area-inset-bottom', () => {
  const stylistCss = fs.readFileSync(path.join(ROOT_DIR, 'css/nari-ai-stylist.css'), 'utf8');
  assert(stylistCss.includes('env(safe-area-inset-bottom'), 'Launcher must use env(safe-area-inset-bottom)');
});

// ── PILLAR 5: SEO, METADATA & SCHEMA ─────────────────────────────────────────
console.log('\n--- Pillar 5: SEO & Metadata Integrity ---');
['index.html', 'shop.html', 'product.html'].forEach(page => {
  check(`${page} contains valid <title> and meta viewport`, () => {
    const html = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
    assert(html.includes('<title>'), `${page} missing <title> tag`);
    assert(html.includes('name="viewport"'), `${page} missing viewport meta`);
  });
});

// ── PILLAR 6: SECURITY & DEFENSIVE HEADERS ───────────────────────────────────
console.log('\n--- Pillar 6: Security & Configuration Rules ---');
check('Firebase hosting configuration enforces security headers', () => {
  const fbJson = fs.readFileSync(path.join(ROOT_DIR, 'firebase.json'), 'utf8');
  assert(fbJson.includes('X-Content-Type-Options'), 'firebase.json must define X-Content-Type-Options header');
  assert(fbJson.includes('X-Frame-Options'), 'firebase.json must define X-Frame-Options header');
});

// ── PILLAR 7: DYNAMIC HEALTH SCORE ENGINE FORMULA ────────────────────────────
console.log('\n--- Pillar 7: Dynamic Scoring Formula Accuracy ---');
check('Dynamic score calculation penalizes issues correctly', () => {
  const engine = require(path.join(ROOT_DIR, 'js/nari-ops-engine.js'));
  engine.state.pillarResults.responsive.findings = [
    { severity: 'HIGH' }
  ];
  engine.state.pillarResults.responsive.passed = 5;
  const score = engine.calculatePillarScore('responsive');
  assert.strictEqual(score, 85, '1 High issue must reduce score to 85');
});

// ── SUMMARY REPORT ───────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log(`🎉 Audit Complete: ${passedTests} / ${totalTests} Passed (${failedTests} Failed)`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
