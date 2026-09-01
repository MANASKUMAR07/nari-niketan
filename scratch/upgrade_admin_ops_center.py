import os

admin_html_path = r"C:\Users\manas\OneDrive\Desktop\NARI NIKETAN\admin\index.html"
admin_js_path   = r"C:\Users\manas\OneDrive\Desktop\NARI NIKETAN\js\admin-advanced.js"

# 1. Update admin/index.html
with open(admin_html_path, "r", encoding="utf-8") as f:
    html = f.read()

# Add CSS link if not present
if 'nari-ops-center.css' not in html:
    html = html.replace('<link rel="stylesheet" href="admin.css?v=3.1">', '<link rel="stylesheet" href="admin.css?v=3.1">\n  <link rel="stylesheet" href="../css/nari-ops-center.css?v=2.0">')

# Add JS engine link if not present
if 'nari-ops-engine.js' not in html:
    html = html.replace('<script src="../js/admin-advanced.js', '<script src="../js/nari-ops-engine.js?v=2.0"></script>\n<script src="../js/admin-advanced.js')

# The full multi-tab Nari AI Website Operations Center markup
ops_center_markup = """    <!-- ==================== 20. NARI AI WEBSITE OPERATIONS CENTER ==================== -->
    <section class="admin-section" id="section-monitor">
      <div class="ops-center-container">
        
        <!-- Header -->
        <div class="ops-header">
          <div class="ops-title-group">
            <h2>&#x1F6E1;&#xFE0F; Nari AI Website Operations Center</h2>
            <p>Comprehensive Real-Time QA, Security, Performance, SEO, Responsiveness &amp; Business Operations Sentinel</p>
          </div>
          <div class="ops-actions">
            <button class="btn btn-primary" onclick="NariAdminMonitor.runAudit('full')" id="btn-run-full-audit" style="font-weight:700;">
              &#x25B6; Run Full Audit
            </button>
            <button class="btn btn-accent" onclick="NariAdminMonitor.runAudit('quick')">
              &#x26A1; Quick Audit
            </button>
            <button class="btn btn-outline" onclick="NariAdminMonitor.openExportModal()">
              &#x1F4E5; Export Report
            </button>
            <button class="btn btn-outline" onclick="NariAdminMonitor.load()">
              &#x21BB; Refresh Logs
            </button>
          </div>
        </div>

        <!-- Scope & Target Selector Bar -->
        <div class="panel" style="background:rgba(212,175,55,0.04);border:1.5px solid rgba(212,175,55,0.3);padding:1rem 1.25rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:280px;">
              <span style="font-size:0.8rem;font-weight:700;color:#FFE082;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">
                &#x1F3AF; Target URL:
              </span>
              <input type="text" class="form-control" id="ops-target-url" value="../shop.html" 
                     style="flex:1;font-family:monospace;font-size:0.88rem;padding:0.4rem 0.75rem;background:rgba(0,0,0,0.5);color:#fff;"
                     placeholder="e.g. ../shop.html, ../index.html, https://www.nariniketan.shop">
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <span style="font-size:0.75rem;color:var(--text-dim);">Quick Targets:</span>
              <button class="btn btn-ghost btn-xs" onclick="NariAdminMonitor.setTarget('../shop.html')">&#x1F50D; /shop.html</button>
              <button class="btn btn-ghost btn-xs" onclick="NariAdminMonitor.setTarget('../index.html')">&#x1F3E0; /index.html</button>
              <button class="btn btn-ghost btn-xs" onclick="NariAdminMonitor.setTarget('../checkout.html')">&#x1F6D2; /checkout.html</button>
              <button class="btn btn-ghost btn-xs" onclick="NariAdminMonitor.setTarget('../product.html')">&#x1F457; /product.html</button>
              <button class="btn btn-ghost btn-xs" onclick="NariAdminMonitor.setTarget('../seller/index.html')">&#x1F3EA; /seller</button>
            </div>
          </div>
          <div class="ops-audit-progress-wrap" id="ops-progress-wrap">
            <div class="ops-audit-progress-bar" id="ops-progress-bar"></div>
          </div>
          <div style="font-size:0.75rem;color:var(--text-dim);margin-top:6px;" id="ops-status-text">
            Ready &mdash; Select an audit mode above to begin live verification
          </div>
        </div>

        <!-- Overall Score & Aggregate Metrics Card -->
        <div class="ops-score-gauge-card">
          <div class="ops-score-circle">
            <div class="ops-score-value" id="ops-overall-score">&mdash;</div>
            <div class="ops-score-label">Overall Health</div>
          </div>
          <div class="ops-stats-summary">
            <div class="ops-stat-pill">
              <div class="ops-stat-pill-label">Active Incidents</div>
              <div class="ops-stat-pill-value" id="ops-incidents-count" style="color:#FFE082;">0 Open</div>
            </div>
            <div class="ops-stat-pill">
              <div class="ops-stat-pill-label">Passed Checks</div>
              <div class="ops-stat-pill-value" id="ops-passed-count" style="color:#4ADE80;">0</div>
            </div>
            <div class="ops-stat-pill">
              <div class="ops-stat-pill-label">Failed Checks</div>
              <div class="ops-stat-pill-value" id="ops-failed-count" style="color:#F87171;">0</div>
            </div>
            <div class="ops-stat-pill">
              <div class="ops-stat-pill-label">Audit Scope</div>
              <div class="ops-stat-pill-value" id="ops-scope-label" style="color:#38BDF8;font-size:0.95rem;">12 Pillars</div>
            </div>
          </div>
        </div>

        <!-- 12-Pillar Health Scorecard Grid -->
        <div class="ops-pillars-grid">
          <div class="ops-pillar-card not-tested" id="pillar-website" onclick="NariAdminMonitor.switchTab('tech')">
            <div class="ops-pillar-header">
              <span>&#x1F310; Website &amp; Crawl</span>
              <span class="ops-pillar-score" id="score-website">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-website">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-functionality" onclick="NariAdminMonitor.switchTab('qa')">
            <div class="ops-pillar-header">
              <span>&#x26A1; QA &amp; Journeys</span>
              <span class="ops-pillar-score" id="score-functionality">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-functionality">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-responsive" onclick="NariAdminMonitor.switchTab('responsive')">
            <div class="ops-pillar-header">
              <span>&#x1F4F1; Responsiveness</span>
              <span class="ops-pillar-score" id="score-responsive">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-responsive">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-api" onclick="NariAdminMonitor.switchTab('tech')">
            <div class="ops-pillar-header">
              <span>&#x1F310; APIs &amp; Network</span>
              <span class="ops-pillar-score" id="score-api">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-api">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-firebase" onclick="NariAdminMonitor.switchTab('tech')">
            <div class="ops-pillar-header">
              <span>&#x1F525; Firebase / DB</span>
              <span class="ops-pillar-score" id="score-firebase">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-firebase">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-security" onclick="NariAdminMonitor.switchTab('security')">
            <div class="ops-pillar-header">
              <span>&#x1F6E1;&#xFE0F; Security Config</span>
              <span class="ops-pillar-score" id="score-security">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-security">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-performance" onclick="NariAdminMonitor.switchTab('perf')">
            <div class="ops-pillar-header">
              <span>&#x1F680; Performance</span>
              <span class="ops-pillar-score" id="score-performance">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-performance">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-seo" onclick="NariAdminMonitor.switchTab('perf')">
            <div class="ops-pillar-header">
              <span>&#x1F50D; SEO &amp; Schema</span>
              <span class="ops-pillar-score" id="score-seo">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-seo">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-accessibility" onclick="NariAdminMonitor.switchTab('perf')">
            <div class="ops-pillar-header">
              <span>&#x267F; Accessibility</span>
              <span class="ops-pillar-score" id="score-accessibility">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-accessibility">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-seller" onclick="NariAdminMonitor.switchTab('business')">
            <div class="ops-pillar-header">
              <span>&#x1F3EA; Seller Portal</span>
              <span class="ops-pillar-score" id="score-seller">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-seller">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-admin" onclick="NariAdminMonitor.switchTab('business')">
            <div class="ops-pillar-header">
              <span>&#x1F511; Admin Portal</span>
              <span class="ops-pillar-score" id="score-admin">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-admin">Not Tested</span>
          </div>

          <div class="ops-pillar-card not-tested" id="pillar-ai" onclick="NariAdminMonitor.switchTab('business')">
            <div class="ops-pillar-header">
              <span>&#x2728; AI Services</span>
              <span class="ops-pillar-score" id="score-ai">&mdash;</span>
            </div>
            <span class="ops-pillar-status-tag not-tested" id="tag-ai">Not Tested</span>
          </div>
        </div>

        <!-- Sub-Tabs Navigation -->
        <div class="ops-tabs-nav">
          <button class="ops-tab-btn active" onclick="NariAdminMonitor.switchTab('overview')">&#x1F4CA; Overview &amp; Matrix</button>
          <button class="ops-tab-btn" onclick="NariAdminMonitor.switchTab('tech')">&#x1F527; Technical &amp; Errors</button>
          <button class="ops-tab-btn" onclick="NariAdminMonitor.switchTab('qa')">&#x26A1; QA &amp; Journeys</button>
          <button class="ops-tab-btn" onclick="NariAdminMonitor.switchTab('responsive')">&#x1F4F1; Multi-Viewport Matrix</button>
          <button class="ops-tab-btn" onclick="NariAdminMonitor.switchTab('security')">&#x1F6E1;&#xFE0F; Security &amp; RBAC</button>
          <button class="ops-tab-btn" onclick="NariAdminMonitor.switchTab('perf')">&#x1F680; Performance &amp; SEO</button>
          <button class="ops-tab-btn" onclick="NariAdminMonitor.switchTab('business')">&#x1F3EA; Business &amp; AI Logic</button>
          <button class="ops-tab-btn" onclick="NariAdminMonitor.switchTab('incidents')">&#x1F4CB; Active Incidents (<span id="tab-incidents-badge">0</span>)</button>
        </div>

        <!-- Tab 1: Overview & Matrix -->
        <div class="ops-tab-panel active" id="ops-tab-overview">
          <div class="panel">
            <div class="panel-header">
              <h3>&#x1F3AF; Operations Center Executive Summary</h3>
              <span style="font-size:0.75rem;color:var(--text-dim);" id="ops-summary-timestamp">Last Audit: Never run</span>
            </div>
            <div class="panel-body" style="padding:1.25rem;">
              <p style="font-size:0.85rem;color:#ECE0E6;margin-bottom:1rem;line-height:1.6;">
                The Operations Center executes continuous, unsimulated checks against all 16 core storefront routes and endpoints. Zero hardcoded passes &mdash; scores are strictly generated from verified HTTP status, live DOM measurements, Firestore latency probes, and security heuristics.
              </p>
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:1rem;">
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:1rem;">
                  <div style="font-size:0.75rem;color:var(--text-dim);font-weight:700;text-transform:uppercase;">Crawl Status</div>
                  <div style="font-size:1.1rem;font-weight:700;color:#FFE082;margin-top:4px;" id="ops-crawl-summary">16 Core Routes Identified</div>
                </div>
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:1rem;">
                  <div style="font-size:0.75rem;color:var(--text-dim);font-weight:700;text-transform:uppercase;">Database Connectivity</div>
                  <div style="font-size:1.1rem;font-weight:700;color:#22C55E;margin-top:4px;" id="ops-db-summary">Firestore Active</div>
                </div>
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:1rem;">
                  <div style="font-size:0.75rem;color:var(--text-dim);font-weight:700;text-transform:uppercase;">Mobile Layout Health</div>
                  <div style="font-size:1.1rem;font-weight:700;color:#38BDF8;margin-top:4px;" id="ops-mobile-summary">Ready for Audit</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Technical & Errors -->
        <div class="ops-tab-panel" id="ops-tab-tech">
          <div class="panel">
            <div class="panel-header">
              <h3>&#x1F527; JavaScript Exceptions, Network &amp; Database Diagnostics</h3>
            </div>
            <div class="panel-body" style="padding:1.25rem;">
              <div id="tech-findings-container">
                <p style="color:var(--text-dim);font-size:0.85rem;">Run an audit to view technical diagnostics.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: QA & Journeys -->
        <div class="ops-tab-panel" id="ops-tab-qa">
          <div class="panel">
            <div class="panel-header">
              <h3>&#x26A1; Interactive Buttons, Forms &amp; Broken Links Audit</h3>
            </div>
            <div class="panel-body" style="padding:1.25rem;">
              <div id="qa-findings-container">
                <p style="color:var(--text-dim);font-size:0.85rem;">Run a QA audit to inspect links, buttons, and form boundaries.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 4: Responsive Matrix -->
        <div class="ops-tab-panel" id="ops-tab-responsive">
          <div class="panel">
            <div class="panel-header">
              <h3>&#x1F4F1; Multi-Viewport Responsive Layout Test Matrix</h3>
              <span style="font-size:0.75rem;color:var(--text-dim);">Live isolated iframe sandbox measurement</span>
            </div>
            <div class="panel-body" style="padding:1.25rem;">
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(135px, 1fr));gap:0.75rem;" id="ops-viewport-matrix-grid">
                <!-- Dynamically populated viewport cards -->
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 5: Security & Config -->
        <div class="ops-tab-panel" id="ops-tab-security">
          <div class="panel">
            <div class="panel-header">
              <h3>&#x1F6E1;&#xFE0F; Defensive Security, RBAC &amp; Configuration Audit</h3>
            </div>
            <div class="panel-body" style="padding:1.25rem;">
              <div id="security-findings-container">
                <p style="color:var(--text-dim);font-size:0.85rem;">Run an audit to inspect transport security, headers, and access control.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 6: Performance & SEO -->
        <div class="ops-tab-panel" id="ops-tab-perf">
          <div class="panel">
            <div class="panel-header">
              <h3>&#x1F680; Performance, SEO, Metadata &amp; WCAG Accessibility</h3>
            </div>
            <div class="panel-body" style="padding:1.25rem;">
              <div id="perf-findings-container">
                <p style="color:var(--text-dim);font-size:0.85rem;">Run an audit to view load times, structured schema, and a11y compliance.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 7: Business & AI Logic -->
        <div class="ops-tab-panel" id="ops-tab-business">
          <div class="panel">
            <div class="panel-header">
              <h3>&#x1F3EA; Catalog Integrity, Fulfilment (Pickup/Delivery) &amp; AI Sentinel</h3>
            </div>
            <div class="panel-body" style="padding:1.25rem;">
              <div id="business-findings-container">
                <p style="color:var(--text-dim);font-size:0.85rem;">Run an audit to inspect price consistency and order constraints.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 8: Incident Timeline & Logs -->
        <div class="ops-tab-panel" id="ops-tab-incidents">
          <div class="panel">
            <div class="panel-header">
              <h3>&#x1F4CB; Active Incidents &amp; Root Cause Analysis</h3>
              <button class="btn btn-ghost btn-xs" onclick="NariAdminMonitor.clearResolvedLogs()">&#x1F9F9; Clear Resolved</button>
            </div>
            <div class="panel-body" style="padding:1.25rem;">
              <div id="ops-incidents-list">
                <p style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:2rem;">
                  &#x23F3; No active incidents. Run an audit to perform an end-to-end scan.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Hidden Isolated Browser Sandbox for Live DOM Testing -->
      <div id="audit-sandbox-container" style="position:fixed;top:-10000px;left:-10000px;visibility:hidden;pointer-events:none;z-index:-999;"></div>

    </section>"""

marker_start = '<!-- ==================== 20. NARI AI REAL-TIME WEBSITE HEALTH & RESPONSIVE MONITOR ==================== -->'
marker_end = '<!-- ==================== 21. NARI AI STYLIST & ANALYTICS ==================== -->'

if marker_start in html:
    idx1 = html.find(marker_start)
    idx2 = html.find(marker_end)
    html = html[:idx1] + ops_center_markup + '\n\n    ' + html[idx2:]

with open(admin_html_path, "w", encoding="utf-8") as f:
    f.write(html)
print("Updated admin/index.html with full Nari AI Website Operations Center!")
