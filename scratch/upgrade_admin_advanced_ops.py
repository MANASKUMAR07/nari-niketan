import os

admin_js_path = r"C:\Users\manas\OneDrive\Desktop\NARI NIKETAN\js\admin-advanced.js"

with open(admin_js_path, "r", encoding="utf-8") as f:
    js_code = f.read()

old_monitor_start = 'const NariAdminMonitor = {'
idx_start = js_code.find(old_monitor_start)
idx_end = js_code.find('// ===== 21. NARI AI STYLIST & ANALYTICS =====', idx_start)
if idx_end == -1:
    idx_end = js_code.find('const AdminAIStylist = {', idx_start)

upgraded_ops_controller = """const NariAdminMonitor = {
  _currentTab: 'overview',
  _targetUrl: '../shop.html',

  init() {
    this.renderViewportMatrix();
  },

  setTarget(url) {
    this._targetUrl = url;
    const input = document.getElementById('ops-target-url');
    if (input) input.value = url;
    AdminToast.show('Audit target set to: ' + url, 'info');
  },

  switchTab(tabKey) {
    this._currentTab = tabKey;
    document.querySelectorAll('.ops-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.ops-tab-panel').forEach(panel => panel.classList.remove('active'));

    const activeBtn = Array.from(document.querySelectorAll('.ops-tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabKey));
    if (activeBtn) activeBtn.classList.add('active');

    const panel = document.getElementById('ops-tab-' + tabKey);
    if (panel) panel.classList.add('active');
  },

  renderViewportMatrix() {
    const grid = document.getElementById('ops-viewport-matrix-grid');
    if (!grid) return;

    const viewports = [
      { id: 'vp-320', width: 320, height: 568, name: '320 × 568', label: 'Small Phone' },
      { id: 'vp-360', width: 360, height: 800, name: '360 × 800', label: 'Android Standard' },
      { id: 'vp-375', width: 375, height: 812, name: '375 × 812', label: 'iPhone SE / Mini' },
      { id: 'vp-390', width: 390, height: 844, name: '390 × 844', label: 'iPhone 14 / 15' },
      { id: 'vp-412', width: 412, height: 915, name: '412 × 915', label: 'Galaxy / Pixel' },
      { id: 'vp-430', width: 430, height: 932, name: '430 × 932', label: 'iPhone Pro Max' },
      { id: 'vp-768', width: 768, height: 1024, name: '768 × 1024', label: 'iPad / Tablet' },
      { id: 'vp-1280', width: 1280, height: 800, name: '1280 × 800', label: 'Desktop HD' }
    ];

    grid.innerHTML = viewports.map(vp => `
      <div class="viewport-badge-card" id="${vp.id}" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:0.75rem;font-weight:700;color:#fff;">${vp.name}</div>
        <div style="font-size:0.7rem;color:var(--text-dim);">${vp.label}</div>
        <div class="vp-status" style="font-size:0.78rem;font-weight:700;color:var(--text-dim);margin-top:4px;">&#x23F3; Not Tested</div>
      </div>
    `).join('');
  },

  async load() {
    this.renderViewportMatrix();
    if (window.NariOpsEngine && typeof db !== 'undefined' && db) {
      await NariOpsEngine.probeFirebase(db);
    }
    this.updateDashboardUI();
    const ts = document.getElementById('ops-summary-timestamp');
    if (ts) ts.textContent = 'Last Refreshed: ' + new Date().toLocaleTimeString('en-IN');
  },

  // ── LIVE MULTI-PILLAR AUDIT RUNNER ─────────────────────────────────────────
  async runAudit(mode = 'full') {
    const btn = document.getElementById('btn-run-full-audit');
    const input = document.getElementById('ops-target-url');
    const targetUrl = (input ? input.value.trim() : '') || this._targetUrl || '../shop.html';

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '&#x23F3; Running Audit...';
    }

    const progressWrap = document.getElementById('ops-progress-wrap');
    const progressBar = document.getElementById('ops-progress-bar');
    const statusText = document.getElementById('ops-status-text');

    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBar) progressBar.style.width = '10%';
    if (statusText) statusText.textContent = `[1/6] Initializing sandbox & probing Firestore connection on ${targetUrl}...`;

    const engine = window.NariOpsEngine;
    if (!engine) {
      alert('NariOpsEngine not loaded.');
      if (btn) btn.disabled = false;
      return;
    }

    // 1. Probe Firebase
    if (typeof db !== 'undefined' && db) {
      await engine.probeFirebase(db);
    }
    if (progressBar) progressBar.style.width = '25%';

    // 2. Setup Sandbox Iframe
    if (statusText) statusText.textContent = `[2/6] Loading ${targetUrl} into isolated DOM sandbox...`;
    const sandbox = document.getElementById('audit-sandbox-container');
    if (!sandbox) return;
    sandbox.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.style.border = 'none';
    iframe.style.background = '#fff';
    sandbox.appendChild(iframe);

    // 3. Multi-Viewport Responsive Matrix Testing
    if (statusText) statusText.textContent = `[3/6] Measuring DOM across 8 device viewports (320px-1280px)...`;
    const viewports = [
      { id: 'vp-320', width: 320, height: 568, name: '320 × 568', isMobile: true },
      { id: 'vp-360', width: 360, height: 800, name: '360 × 800', isMobile: true },
      { id: 'vp-375', width: 375, height: 812, name: '375 × 812', isMobile: true },
      { id: 'vp-390', width: 390, height: 844, name: '390 × 844', isMobile: true },
      { id: 'vp-412', width: 412, height: 915, name: '412 × 915', isMobile: true },
      { id: 'vp-430', width: 430, height: 932, name: '430 × 932', isMobile: true },
      { id: 'vp-768', width: 768, height: 1024, name: '768 × 1024', isMobile: false },
      { id: 'vp-1280', width: 1280, height: 800, name: '1280 × 800', isMobile: false }
    ];

    for (let i = 0; i < viewports.length; i++) {
      const vp = viewports[i];
      iframe.style.width = vp.width + 'px';
      iframe.style.height = vp.height + 'px';

      await new Promise(resolve => {
        let done = false;
        iframe.onload = () => {
          if (!done) { done = true; setTimeout(resolve, 500); }
        };
        iframe.src = targetUrl + (targetUrl.includes('?') ? '&' : '?') + '_ops_t=' + Date.now();
        setTimeout(() => { if (!done) { done = true; resolve(); } }, 3500);
      });

      let doc = null;
      try { doc = iframe.contentDocument || iframe.contentWindow.document; } catch (e) {}

      if (doc) {
        await engine.auditViewport(doc, vp);
        this._updateViewportCardUI(vp.id, engine.state.viewportMatrix[vp.id]);

        // On first rendered document, perform Links, Images, Interactive, SEO, and Security scans
        if (i === 0) {
          if (statusText) statusText.textContent = `[4/6] Auditing links, images, buttons, and forms...`;
          engine.auditDocumentLinksAndImages(doc, targetUrl);
          engine.auditDocumentInteractiveElements(doc, targetUrl);

          if (statusText) statusText.textContent = `[5/6] Auditing SEO metadata, heading hierarchy, and defensive security...`;
          engine.auditDocumentSEO(doc, targetUrl);
          engine.auditSecurityConfig(doc, targetUrl);
        }
      }

      if (progressBar) progressBar.style.width = `${25 + ((i + 1) * 7)}%`;
    }

    // 4. Probe Business Logic & AI Services
    if (statusText) statusText.textContent = `[6/6] Validating business rules, price sync & AI feature availability...`;
    engine.auditBusinessLogic(
      [{ name: 'Sample Cart Check', price: 1499, salePrice: 1299, quantity: 1 }],
      { fulfilmentType: 'delivery', shippingAddress: { pincode: '226001' } }
    );

    // Finalize run
    const result = engine.finalizeRun();
    if (progressBar) progressBar.style.width = '100%';
    if (statusText) statusText.textContent = `✅ Audit Complete! Overall Score: ${result.overallScore}/100 | Status: ${result.status}`;

    // Update entire dashboard UI
    this.updateDashboardUI();

    // Log run to Firestore
    if (typeof db !== 'undefined' && db && result.incidents.length > 0) {
      try {
        await db.collection('systemAlerts').add({
          type: 'OPS_AUDIT_RUN',
          score: result.overallScore,
          status: result.status,
          incidentsCount: result.incidents.length,
          target: targetUrl,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {}
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '&#x25B6; Run Full Audit';
    }

    AdminToast.show(`Operations Audit Complete! Overall Score: ${result.overallScore}/100`, result.overallScore >= 80 ? 'success' : 'warning');
  },

  _updateViewportCardUI(vpId, vpData) {
    const card = document.getElementById(vpId);
    if (!card || !vpData) return;

    const st = card.querySelector('.vp-status');
    if (vpData.status === 'PASS') {
      if (st) {
        st.innerHTML = '&#x2713; Pass (0 Overflow)';
        st.style.color = '#22C55E';
      }
      card.style.borderColor = 'rgba(34, 197, 94, 0.3)';
      card.style.background = 'rgba(34, 197, 94, 0.06)';
    } else if (vpData.status === 'FAIL') {
      if (st) {
        st.innerHTML = `&#x274C; Fail (+${vpData.overflowPx}px in ${vpData.culprit || 'layout'})`;
        st.style.color = '#EF4444';
      }
      card.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      card.style.background = 'rgba(239, 68, 68, 0.08)';
    }
  },

  updateDashboardUI() {
    const engine = window.NariOpsEngine;
    if (!engine) return;

    const score = engine.state.overallScore;
    const scoreEl = document.getElementById('ops-overall-score');
    if (scoreEl) {
      scoreEl.textContent = score !== null ? score : '—';
      scoreEl.style.color = score !== null ? (score >= 90 ? '#4ADE80' : (score >= 70 ? '#FBBF24' : '#F87171')) : '#FFE082';
    }

    const incidentsBadge = document.getElementById('tab-incidents-badge');
    if (incidentsBadge) incidentsBadge.textContent = engine.state.activeIncidents.length;

    const incCountEl = document.getElementById('ops-incidents-count');
    if (incCountEl) incCountEl.textContent = `${engine.state.activeIncidents.length} Open`;

    let totalPassed = 0;
    let totalFailed = 0;

    for (const [key, p] of Object.entries(engine.state.pillarResults)) {
      totalPassed += p.passed;
      totalFailed += p.failed;

      const pCard = document.getElementById('pillar-' + key);
      const sEl = document.getElementById('score-' + key);
      const tagEl = document.getElementById('tag-' + key);

      if (pCard && sEl && tagEl) {
        pCard.className = `ops-pillar-card ${(p.status || 'not-tested').toLowerCase()}`;
        sEl.textContent = p.score !== null ? p.score : '—';
        tagEl.className = `ops-pillar-status-tag ${(p.status || 'not-tested').toLowerCase()}`;
        tagEl.textContent = p.status || 'Not Tested';
      }
    }

    const passEl = document.getElementById('ops-passed-count');
    if (passEl) passEl.textContent = totalPassed;

    const failEl = document.getElementById('ops-failed-count');
    if (failEl) failEl.textContent = totalFailed;

    this.renderIncidentsList();
  },

  renderIncidentsList() {
    const engine = window.NariOpsEngine;
    const container = document.getElementById('ops-incidents-list');
    if (!container || !engine) return;

    if (!engine.state.activeIncidents.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:2.5rem;color:#4ADE80;">
          <div style="font-size:2.5rem;margin-bottom:0.5rem;">🎉</div>
          <h4 style="font-size:1.15rem;font-weight:700;">Zero Active Incidents!</h4>
          <p style="font-size:0.85rem;color:var(--text-dim);margin:0;">All tested routes and endpoints verified clean.</p>
        </div>`;
      return;
    }

    container.innerHTML = engine.state.activeIncidents.map(inc => {
      const sev = (inc.severity || 'MEDIUM').toLowerCase();
      return `
        <div class="ops-incident-card ${sev}">
          <div class="ops-incident-title-row">
            <span class="ops-incident-title">${inc.title}</span>
            <span style="font-size:0.7rem;font-weight:800;padding:2px 8px;border-radius:4px;text-transform:uppercase;background:rgba(255,255,255,0.06);">
              ${inc.severity} &bull; ${inc.category}
            </span>
          </div>
          <div style="font-size:0.84rem;color:#ECE0E6;line-height:1.4;">${inc.problem}</div>
          <div style="font-size:0.78rem;color:var(--text-dim);"><strong>Root Cause:</strong> ${inc.cause}</div>
          <div style="font-size:0.78rem;color:#FFE082;margin-top:2px;"><strong>Suggested Fix:</strong></div>
          <div class="ops-code-fix-block">${inc.fix}</div>
          <div class="ops-incident-meta">
            Target: ${inc.page || inc.target || 'General'} &bull; Time: ${new Date(inc.timestamp).toLocaleTimeString('en-IN')}
          </div>
        </div>
      `;
    }).join('');
  },

  openExportModal() {
    const engine = window.NariOpsEngine;
    if (!engine) return;

    const jsonStr = engine.exportReport('json');
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nari-niketan-ops-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    AdminToast.show('Operations Report downloaded (JSON)!', 'success');
  },

  clearResolvedLogs() {
    if (window.NariOpsEngine) {
      window.NariOpsEngine.state.activeIncidents = [];
      this.updateDashboardUI();
    }
    AdminToast.show('Active incidents cleared', 'info');
  }
};
"""

js_code = js_code[:idx_start] + upgraded_ops_controller + '\n\n' + js_code[idx_end:]

with open(admin_js_path, "w", encoding="utf-8") as f:
    f.write(js_code)

print("Updated js/admin-advanced.js with NariAdminMonitor Operations Center Controller!")
