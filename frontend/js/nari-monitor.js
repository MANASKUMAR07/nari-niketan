// =============================================
// NARI NIKETAN - AI Monitor Agent v1.0
// =============================================
// Architecture:
//   Frontend Monitor -> Error DB -> AI Analyser -> Alert Service -> Admin Panel
// SECURITY: Only sanitized error metadata is stored.
//   Never logs passwords, auth tokens, payment card data, or customer PII.
// =============================================

(function NariMonitor() {
  'use strict';

  var CONFIG = {
    version: '1.0.0',
    enabled: true,
    dedupWindowMs: 60000,
    offlineBufferMax: 50,
    probeIntervalMs: 300000,
    slowRequestThresholdMs: 3000,
    whatsappNumber: '916307032042',
    adminEmail: 'nariniketan07@gmail.com',
    funnelPages: {
      '/login.html': 'LOGIN',
      '/index.html': 'HOME',
      '/shop.html': 'SHOP',
      '/product.html': 'PRODUCT',
      '/cart.html': 'CART',
      '/checkout.html': 'CHECKOUT',
      '/confirmation.html': 'ORDER_CONFIRM',
      '/my-orders.html': 'MY_ORDERS'
    }
  };

  var _seen = {};
  var _offlineBuffer = [];
  var _sessionId = null;
  var _probeTimer = null;
  var _monitorReady = false;

  function _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function _getSessionId() {
    if (!_sessionId) {
      try {
        _sessionId = sessionStorage.getItem('_nm_sid') || _generateId();
        sessionStorage.setItem('_nm_sid', _sessionId);
      } catch (e) { _sessionId = _generateId(); }
    }
    return _sessionId;
  }

  function _currentPage() { return window.location.pathname || '/'; }

  function _funnelStep() {
    var path = _currentPage();
    for (var p in CONFIG.funnelPages) {
      if (path.endsWith(p) || path === p) return CONFIG.funnelPages[p];
    }
    return null;
  }

  function _sanitize(text) {
    if (typeof text !== 'string') text = String(text || '');
    text = text.replace(/eyJ[A-Za-z0-9+\/=._-]{20,}\.[A-Za-z0-9+\/=._-]+\.[A-Za-z0-9+\/=._-]+/g, '[TOKEN]');
    text = text.replace(/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13})\b/g, '[CARD]');
    text = text.replace(/(?:password|passwd|pwd|secret|token|auth)[=:]["']?[^\s&"']*/gi, '[CRED]');
    text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]');
    text = text.replace(/\b(?:\+91[-. ]?)?[6-9]\d{9}\b/g, '[PHONE]');
    return text.slice(0, 500);
  }

  function _sanitizeStack(stack) {
    if (!stack) return '';
    return stack.split('\n').slice(0, 5).map(_sanitize).join('\n');
  }

  // ── AI Analyser (Local Rule-Based — No External API Calls) ────────────────
  var AI = {
    _patterns: [
            { severity: 'high', tags: ['layout', 'mobile_overflow'], match: /horizontal.overflow|overflow.*viewport|scrollWidth/i, what: 'Mobile horizontal overflow detected', why: 'A DOM component exceeds the viewport width causing horizontal scrolling on mobile', cause: 'Fixed width container, unconstrained flex row, or large child element', fix: 'Replace fixed width with width:100%; max-width:100%; box-sizing:border-box; and flex-wrap:wrap;' },
      { severity: 'medium', tags: ['layout', 'text_clipping'], match: /text.clipping|text.*truncated|clipped.text/i, what: 'Text clipping detected on mobile', why: 'Text element exceeds its container without wrapping', cause: 'white-space:nowrap on long text or fixed container height', fix: 'Add word-break:break-word; and remove white-space:nowrap on mobile.' },
      { severity: 'medium', tags: ['resource', 'broken_image'], match: /broken.image|image.*load.*fail|naturalWidth.0/i, what: 'Broken image asset detected', why: 'Image URL failed to load or returned 404', cause: 'Missing file path or expired external image link', fix: 'Verify image URL in Firebase Storage or product catalog.' },
      { severity: 'medium', tags: ['layout', 'element_overlap'], match: /element.*overlap|widget.*covering/i, what: 'Floating element overlap detected', why: 'Fixed/floating widget covers interactive page content or footer', cause: 'High z-index floating button lacking safe-area offset', fix: 'Add safe-area-inset padding and adjust z-index.' },
      { severity: 'critical', tags: ['payment'], match: /payment|upi|razorpay|transaction|checkout.fail|order.*fail/i, what: 'Payment or order processing failure', why: 'Payment gateway or Firestore order write encountered an error', cause: 'Network timeout, gateway rejection, or Firestore permission denied', fix: 'Check Razorpay dashboard. Verify Firestore orders collection rules.' },
      { severity: 'critical', tags: ['auth'], match: /auth\/|firebase.*auth|sign.*in.*fail|login.*fail|token.*expired|permission.denied/i, what: 'Authentication or Firebase permission failure', why: 'User auth token invalid or security rules blocked request', cause: 'Expired session, changed security rules, or Firebase Auth quota exceeded', fix: 'Review Firestore security rules. Check Firebase Auth console.' },
      { severity: 'critical', tags: ['firestore'], match: /firestore.*unavailable|UNAVAILABLE|firebase.*network/i, what: 'Firestore database unreachable', why: 'Firebase backend not responding to operations', cause: 'Firebase regional outage, network block, or quota exhaustion', fix: 'Check status.firebase.google.com. Verify project quota.' },
      { severity: 'critical', tags: ['js_error'], match: /TypeError|ReferenceError|Cannot read prop|is not a function/i, what: 'Critical JavaScript runtime error — page may be broken', why: 'A core JS object or function is missing or called incorrectly', cause: 'Missing script dependency, DOM element not found, or race condition', fix: 'Check browser console for stack trace. Verify all scripts load correctly.' },
      { severity: 'high', tags: ['network'], match: /fetch.*fail|network.*error|status.500|status.503|status.502/i, what: 'API or network request failed with server error', why: 'Server endpoint returned 5xx or network dropped', cause: 'Backend service down or incorrect API URL', fix: 'Check server logs and API health.' },
      { severity: 'high', tags: ['storage'], match: /storage.*error|upload.*fail|firebase.*storage/i, what: 'Firebase Storage operation failed', why: 'File upload or download encountered an error', cause: 'Storage rules restriction or file size limit', fix: 'Check storage.rules permissions.' },
      { severity: 'high', tags: ['cart', 'funnel'], match: /cart.*fail|FUNNEL_FAILURE|add.*cart.*error/i, what: 'Shopping cart or e-commerce funnel failure', why: 'Cart sync with Firestore failed or funnel step errored', cause: 'Firestore write rejected or stale cache conflict', fix: 'Verify cart Firestore rules allow authenticated writes.' },
      { severity: 'low', tags: ['firestore', 'clock_sync'], match: /Detected an update time that is in the future|clock.skew|future/i, what: 'Firestore SDK clock synchronization notice', why: 'Client device clock was slightly ahead of server time', cause: 'Benign client timestamp drift — automatically handled by Firestore SDK', fix: 'Informational only. No action required.' },
      { severity: 'low', tags: ['firestore', 'multi_tab'], match: /Failed to obtain primary lease|primary lease|Backfill Indexes/i, what: 'Firestore multi-tab synchronization notice', why: 'Another open browser tab currently holds the local IndexedDB primary lease', cause: 'Benign multi-tab coordination in Firebase Firestore SDK — all open tabs operate normally', fix: 'Informational notice only. No action required — Firestore coordinates multi-tab syncing automatically.' },
      { severity: 'medium', tags: ['slow'], match: /slow.*request|SLOW_NETWORK/i, what: 'Slow API or network response detected', why: 'Request took longer than 3 seconds', cause: 'Large payload or heavy Firestore query without index', fix: 'Add Firestore composite indexes. Optimize image sizes.' },
      { severity: 'medium', tags: ['product'], match: /product.*load.*fail|products.*empty/i, what: 'Product loading failed or empty', why: 'Firestore products query returned error or no results', cause: 'Wrong collection path or filter mismatch', fix: 'Check Firestore products collection and indexes.' },
      { severity: 'medium', tags: ['resource'], match: /404|not.found|RESOURCE_ERROR/i, what: 'Missing resource or 404 detected', why: 'A page or asset could not be found', cause: 'Broken link or deleted file', fix: 'Check Firebase Hosting for missing files.' },
      { severity: 'low', tags: ['warning'], match: /deprecat|non.critical|minor/i, what: 'Non-critical warning', why: 'A deprecated API was triggered', cause: 'Old browser API or outdated library', fix: 'Review console for deprecation warnings.' }
    ],
    analyse: function (error) {
      var s = (error.message || '') + ' ' + (error.type || '') + ' ' + (error.stack || '');
      for (var i = 0; i < this._patterns.length; i++) {
        var p = this._patterns[i];
        if (p.match.test(s)) return { severity: p.severity, tags: p.tags, what: p.what, why: p.why, cause: p.cause, fix: p.fix };
      }
      return { severity: 'medium', tags: ['unknown'], what: 'An unexpected error occurred', why: 'Error does not match known patterns', cause: 'Unknown — manual investigation required', fix: 'Check browser console and Firestore logs.' };
    },
    severityEmoji: function (s) { return { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[s] || '⚪'; },
    severityLabel: function (s) { return { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[s] || 'Unknown'; }
  };

  // ── Alert Writer ───────────────────────────────────────────────────────────

  function _writeAlert(rawError) {
    if (!CONFIG.enabled) return;
    var key = (rawError.type || '') + ':' + (rawError.message || '').slice(0, 80);
    var now = Date.now();
    if (_seen[key] && (now - _seen[key]) < CONFIG.dedupWindowMs) return;
    _seen[key] = now;

    var sm = _sanitize(rawError.message || '');
    var ss = _sanitizeStack(rawError.stack || '');
    var su = (rawError.url || _currentPage()).split('?')[0];
    var analysis = AI.analyse({ message: sm, type: rawError.type, stack: ss });

    var alertObj = {
      id: _generateId(), sessionId: _getSessionId(),
      type: rawError.type || 'UNKNOWN', message: sm, stack: ss, url: su,
      page: _funnelStep() || su, userAgent: (navigator.userAgent || '').slice(0, 120),
      severity: analysis.severity, tags: analysis.tags,
      aiWhat: analysis.what, aiWhy: analysis.why, aiCause: analysis.cause, aiFix: analysis.fix,
      status: 'open', resolved: false, clientTime: new Date().toISOString()
    };

    setTimeout(function () {
      try {
        if (typeof db !== 'undefined' && db) {
          db.collection('systemAlerts').doc(alertObj.id).set(
            Object.assign({}, alertObj, { createdAt: firebase.firestore.FieldValue.serverTimestamp() })
          ).catch(function () { _bufferOffline(alertObj); });
        } else { _bufferOffline(alertObj); }
      } catch (e) { _bufferOffline(alertObj); }
    }, 0);

    if (analysis.severity === 'critical') {
      setTimeout(function () { _showCriticalBanner(alertObj); }, 0);
    }
  }

  function _bufferOffline(a) {
    _offlineBuffer.push(a);
    if (_offlineBuffer.length > CONFIG.offlineBufferMax) _offlineBuffer.shift();
  }

  function _flushOfflineBuffer() {
    if (!_offlineBuffer.length || typeof db === 'undefined') return;
    var f = _offlineBuffer.splice(0);
    f.forEach(function (a) {
      try { db.collection('systemAlerts').doc(a.id).set(Object.assign({}, a, { createdAt: firebase.firestore.FieldValue.serverTimestamp() })).catch(function () {}); } catch (e) {}
    });
  }

  function _showCriticalBanner(a) {
    if (window.location.pathname.indexOf('/admin/') !== -1) return;
    if (typeof auth === 'undefined' || !auth.currentUser) return;
    var ex = document.getElementById('_nm_banner'); if (ex) ex.remove();
    var b = document.createElement('div');
    b.id = '_nm_banner';
    b.setAttribute('style', 'position:fixed;bottom:20px;right:20px;z-index:999999;background:linear-gradient(135deg,#1a0a0a,#3d0000);border:2px solid #ff4444;border-radius:12px;color:#fff;padding:16px 20px;max-width:340px;box-shadow:0 8px 32px rgba(255,68,68,0.4);font-family:system-ui,sans-serif;font-size:14px;');
    b.innerHTML = '<b style="color:#ff6666">&#128308; Critical Error Detected</b>' +
      '<div style="color:#ffcccc;font-size:13px;margin:4px 0">' + a.message.slice(0, 100) + '</div>' +
      '<div style="color:#888;font-size:11px;margin-bottom:10px">' + a.page + '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<a href="/admin/#monitor" style="flex:1;text-align:center;background:#ff4444;color:#fff;text-decoration:none;padding:7px;border-radius:6px;font-size:12px;font-weight:600">View Admin</a>' +
      '<a href="https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent('[NariMonitor] CRITICAL: ' + a.message.slice(0, 80)) + '" target="_blank" style="flex:1;text-align:center;background:#25d366;color:#fff;text-decoration:none;padding:7px;border-radius:6px;font-size:12px;font-weight:600">WhatsApp</a>' +
      '</div>';
    var closeBtn = document.createElement('button');
    closeBtn.textContent = 'x';
    closeBtn.setAttribute('style', 'position:absolute;top:8px;right:10px;background:none;border:none;color:#888;font-size:18px;cursor:pointer;line-height:1');
    closeBtn.onclick = function () { b.remove(); };
    b.style.position = 'fixed';
    b.appendChild(closeBtn);
    document.body.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.remove(); }, 15000);
  }

  // ── Frontend Monitor ───────────────────────────────────────────────────────

  function _initFrontendMonitor() {
    var _origOnError = window.onerror;
    window.onerror = function (msg, src, ln, col, err) {
      setTimeout(function () { _writeAlert({ type: 'JS_ERROR', message: String(msg), stack: err ? err.stack : (src + ':' + ln + ':' + col), url: src || window.location.href }); }, 0);
      return _origOnError ? _origOnError.apply(this, arguments) : false;
    };
    window.addEventListener('unhandledrejection', function (e) {
      var r = e.reason;
      setTimeout(function () { _writeAlert({ type: 'UNHANDLED_PROMISE', message: r instanceof Error ? r.message : String(r), stack: r instanceof Error ? r.stack : '', url: window.location.href }); }, 0);
    });
    window.addEventListener('error', function (e) {
      if (e.target && e.target !== window && e.target.tagName) {
        var el = e.target; var src = el.src || el.href || '';
        if (src && !src.startsWith('data:') && src !== window.location.href && src.indexOf('analytics') === -1 && src.indexOf('gtag') === -1) {
          setTimeout(function () { _writeAlert({ type: 'RESOURCE_ERROR', message: 'Failed to load ' + el.tagName + ': ' + src.split('/').pop(), stack: '', url: src }); }, 0);
        }
      }
    }, true);
  }

  // ── Network Monitor ────────────────────────────────────────────────────────

  function _initNetworkMonitor() {
    var _origFetch = window.fetch; if (!_origFetch) return;
    window.fetch = function () {
      var args = Array.prototype.slice.call(arguments);
      var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
      if (url.indexOf('firestore.googleapis.com') !== -1 || url.indexOf('identitytoolkit') !== -1 || url.indexOf('googleapis.com/v1') !== -1) {
        return _origFetch.apply(this, args);
      }
      var t0 = performance.now();
      return _origFetch.apply(this, args).then(function (res) {
        var el = performance.now() - t0; var su = url.split('?')[0].slice(-80);
        if (!res.ok && res.status >= 400) { setTimeout(function () { _writeAlert({ type: 'FETCH_ERROR', message: 'HTTP ' + res.status + ' - ' + su, stack: '', url: url.split('?')[0] }); }, 0); }
        else if (el > CONFIG.slowRequestThresholdMs) { setTimeout(function () { _writeAlert({ type: 'SLOW_NETWORK', message: 'Slow request (' + Math.round(el) + 'ms): ' + su, stack: '', url: url.split('?')[0] }); }, 0); }
        return res;
      }).catch(function (err) {
        setTimeout(function () { _writeAlert({ type: 'FETCH_ERROR', message: 'Fetch failed: ' + err.message + ' - ' + url.split('?')[0].slice(-80), stack: err.stack || '', url: url.split('?')[0] }); }, 0);
        throw err;
      });
    };
  }

  // ── Console Capture (Firebase-related only) ────────────────────────────────

  function _initConsoleCapture() {
    var _orig = console.error;
    console.error = function () {
      _orig.apply(console, arguments);
      var msg = Array.prototype.slice.call(arguments).map(function (a) { return typeof a === 'string' ? a : (a && a.message ? a.message : String(a)); }).join(' ');
      // Ignore benign internal Firebase clock adjustments, multi-tab lease notices, and websocket logs
      if (/Detected an update time that is in the future|WebChannelConnection|LongPollingTransport|Failed to obtain primary lease|primary lease|Backfill Indexes/i.test(msg)) {
        return;
      }
      if (/firebase|firestore|payment|razorpay|upi|auth\/|PERMISSION/i.test(msg)) {
        setTimeout(function () { _writeAlert({ type: 'CONSOLE_ERROR', message: _sanitize(msg), stack: '', url: window.location.href }); }, 0);
      }
    };
  }

  // ── Synthetic Health Probes ────────────────────────────────────────────────

  var Probe = {
    runAll: function () {
      var results = { website: { ok: true, latency: 0 } };
      var _t = function (fn) {
        var t0 = performance.now();
        return Promise.resolve().then(fn)
          .then(function (r) { return Object.assign({ ok: true, latency: Math.round(performance.now() - t0) }, r || {}); })
          .catch(function (e) { return { ok: false, error: e.code || e.message, latency: Math.round(performance.now() - t0) }; });
      };
      return Promise.all([
        _t(function () { return db.collection('settings').doc('site').get(); }),
        _t(function () { return db.collection('healthProbes').doc('_ping').set({ ts: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); }),
        _t(function () { return { ok: auth.currentUser !== null }; }),
        _t(function () { return db.collection('products').limit(1).get().then(function (s) { return { count: s.size }; }); }),
        _t(function () { if (!auth.currentUser) return { skipped: true }; return db.collection('orders').limit(1).get(); })
      ]).then(function (rs) {
        results.firebase = rs[0]; results.database = rs[1]; results.auth = rs[2];
        results.products = rs[3]; results.orders = rs[4];
        results.payments = { ok: true, latency: 0, note: 'Manual check required' };
        return db.collection('healthProbes').add({ results: results, createdAt: firebase.firestore.FieldValue.serverTimestamp(), page: _currentPage() }).then(function () { return results; });
      }).catch(function (e) { console.warn('[NariMonitor] Probe error:', e.message); return results; });
    }
  };

  function _startPeriodicProbe() {
    setTimeout(function () {
      try { Probe.runAll(); } catch (e) {}
      _probeTimer = setInterval(function () { try { Probe.runAll(); } catch (e) {} }, CONFIG.probeIntervalMs);
    }, 10000);
  }

  // ── Funnel Tracker ─────────────────────────────────────────────────────────

  var FunnelTracker = {
    milestone: function (step, meta) {
      try { var s = JSON.parse(sessionStorage.getItem('_nm_funnel') || '[]'); s.push(Object.assign({ step: step, ts: Date.now() }, meta || {})); sessionStorage.setItem('_nm_funnel', JSON.stringify(s.slice(-20))); } catch (e) {}
    },
    failure: function (step, msg) { _writeAlert({ type: 'FUNNEL_FAILURE', message: 'Funnel failure at [' + step + ']: ' + _sanitize(msg), stack: '', url: window.location.href }); },
    getSteps: function () { try { return JSON.parse(sessionStorage.getItem('_nm_funnel') || '[]'); } catch (e) { return []; } }
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  window.NariMonitor = {
    report: function (type, message, extra) {
      _writeAlert({ type: type, message: _sanitize(message), stack: (extra && extra.stack) || '', url: (extra && extra.url) || window.location.href });
    },
    funnel: FunnelTracker,
    probe: Probe,
    runDiagnostic: function () { return Probe.runAll(); },
    config: CONFIG,
    ai: AI
  };

  // ── Boot ───────────────────────────────────────────────────────────────────

  function _boot() {
    if (!CONFIG.enabled || _monitorReady) return;
    _monitorReady = true;
    try {
      _initFrontendMonitor();
      _initNetworkMonitor();
      _initConsoleCapture();
      if (window.location.pathname.indexOf('/admin/') === -1) { _startPeriodicProbe(); }
      if (typeof db !== 'undefined') { setTimeout(_flushOfflineBuffer, 5000); }
      var step = _funnelStep(); if (step) FunnelTracker.milestone(step);
      console.log('%c[NariMonitor] v' + CONFIG.version + ' active', 'color:#9b59b6;font-weight:bold');
    } catch (e) { console.warn('[NariMonitor] Init failed:', e.message); }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _boot); }
  else { setTimeout(_boot, 100); }


  // ── ACTIVE RESPONSIVE & VISUAL AUDITOR ────────────────────────────────────
  function _auditViewportAndLayout() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    var innerW = window.innerWidth || document.documentElement.clientWidth;
    var innerH = window.innerHeight || document.documentElement.clientHeight;
    var scrollW = document.documentElement.scrollWidth || document.body.scrollWidth;
    var issues = [];

    // 1. Horizontal Overflow Detection
    if (scrollW > innerW + 3) {
      var overflowPx = Math.round(scrollW - innerW);
      var culprits = [];
      
      // Find offending DOM elements
      var allEls = document.querySelectorAll('body *');
      for (var i = 0; i < allEls.length; i++) {
        var el = allEls[i];
        if (el.offsetWidth > 0 && el.offsetHeight > 0) {
          var rect = el.getBoundingClientRect();
          if (rect.right > innerW + 4 || rect.width > innerW + 4) {
            var sel = el.id ? '#' + el.id : (el.className ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase());
            if (culprits.indexOf(sel) === -1 && sel !== 'body' && sel !== 'html') {
              culprits.push(sel);
              if (culprits.length >= 4) break;
            }
          }
        }
      }

      var culpritDesc = culprits.length ? culprits.join(', ') : 'Container element';
      _writeAlert({
        type: 'LAYOUT_OVERFLOW',
        message: 'Horizontal overflow detected: ' + overflowPx + 'px wider than viewport (' + innerW + 'px). Offending elements: ' + culpritDesc,
        stack: 'Viewport: ' + innerW + 'x' + innerH + ' | ScrollWidth: ' + scrollW + 'px'
      });
    }

    // 2. Broken Image Detection
    var imgs = document.querySelectorAll('img');
    for (var j = 0; j < imgs.length; j++) {
      var img = imgs[j];
      if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:image/svg')) {
        _writeAlert({
          type: 'BROKEN_IMAGE',
          message: 'Broken image detected: ' + (img.alt || 'Unnamed image') + ' (' + img.src.slice(0, 80) + ')',
          stack: 'Page: ' + _currentPage()
        });
      }
    }
  }

  // Run non-intrusive layout audit after page load
  if (typeof window !== 'undefined') {
    window.addEventListener('load', function () {
      setTimeout(_auditViewportAndLayout, 1500);
    });
    window.addEventListener('resize', function () {
      clearTimeout(window._nm_resizeTimer);
      window._nm_resizeTimer = setTimeout(_auditViewportAndLayout, 800);
    });
  }

  // Public API
  window.NariMonitor = {
    auditNow: _auditViewportAndLayout,
    logError: _writeAlert
  };

})();
