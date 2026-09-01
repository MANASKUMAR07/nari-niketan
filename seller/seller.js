// =============================================
// NARI NIKETAN — Seller Portal Logic
// =============================================

// ─── GUARD: Check seller authentication ─────
const SellerGuard = {
  currentUser: null,
  sellerData: null,

  _reveal() {
    var s = document.getElementById('seller-auth-guard-style');
    if (s) s.remove();
  },

  async init() {
    return new Promise((resolve) => {
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          // Stay hidden and redirect — no flash
          window.location.replace('login.html');
          return;
        }
        try {
          const doc = await db.collection('users').doc(user.uid).get();
          if (!doc.exists) { window.location.replace('login.html'); return; }
          const data = doc.data();

          // Must be a seller (approved or has isSeller flag)
          if (!data.isSeller && data.sellerStatus !== 'approved') {
            if (data.sellerStatus === 'pending') {
              window.location.replace('login.html?pending=1');
            } else {
              window.location.replace('login.html');
            }
            return;
          }

          // Auth passed — reveal the page
          this._reveal();
          this.currentUser = user;
          this.sellerData  = data;
          resolve({ user, data });
        } catch (e) {
          console.error('Guard error:', e);
          window.location.replace('login.html');
        }
      });
    });
  }
};

// ─── TOAST ──────────────────────────────────
const SellerToast = {
  show(message, type = 'default', duration = 3500) {
    const container = document.getElementById('seller-toast-container');
    const icons = { success: '✅', error: '❌', warning: '⚠️', default: '🔔' };
    const toast = document.createElement('div');
    toast.className = `seller-toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || icons.default}</span><span class="seller-toast-msg">${message}</span><button class="seller-toast-close" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove && toast.remove(), duration);
  }
};

// ─── CONFIRM DIALOG ─────────────────────────
const SellerConfirm = {
  _resolve: null,
  show(title, message, icon = '⚠️') {
    document.getElementById('confirm-icon').textContent  = icon;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent   = message;
    document.getElementById('confirm-overlay').classList.add('open');
    return new Promise(res => { this._resolve = res; });
  },
  close(result) {
    document.getElementById('confirm-overlay').classList.remove('open');
    if (this._resolve) this._resolve(result);
    this._resolve = null;
  }
};

// ─── NAVIGATION ─────────────────────────────
const SellerNav = {
  current: 'dashboard',
  titles: {
    dashboard:   '📊 Dashboard',
    products:    '🛍️ My Products',
    'add-product': '➕ Add / Edit Product',
    orders:      '📦 Orders',
    earnings:    '💰 Earnings',
    profile:     '🏪 Store Profile',
    settings:    '⚙️ Settings',
  },

  go(section) {
    // Hide all
    document.querySelectorAll('.seller-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));

    // Show target
    const target = document.getElementById(`section-${section}`);
    if (target) target.classList.add('active');

    // Highlight sidebar
    const link = document.querySelector(`.sidebar-link[data-section="${section}"]`);
    if (link) link.classList.add('active');

    document.getElementById('topbar-page-title').textContent = this.titles[section] || section;
    this.current = section;
    this.closeMobile();

    // Load section data
    if (section === 'dashboard')   SellerDashboard.load();
    if (section === 'products')    SellerProducts.load();
    if (section === 'orders')      SellerOrders.load();
    if (section === 'earnings')    SellerEarnings.load();
    if (section === 'profile')     SellerProfile.load();
    if (section === 'add-product') SellerProducts.openAddForm();
  },

  openMobile() {
    document.getElementById('seller-sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('open');
  },
  closeMobile() {
    document.getElementById('seller-sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  }
};

// ─── HELPERS ────────────────────────────────
function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function statusBadge(status) {
  const map = {
    'Pending':    'badge-pending',
    'Processing': 'badge-processing',
    'Shipped':    'badge-shipped',
    'Delivered':  'badge-delivered',
    'Cancelled':  'badge-cancelled',
    'Approved':   'badge-approved',
    'Rejected':   'badge-rejected',
    'active':     'badge-active',
    'inactive':   'badge-cancelled',
    'pending':    'badge-pending',
    'approved':   'badge-approved',
    'rejected':   'badge-rejected',
  };
  return `<span class="badge ${map[status] || 'badge-info'}">${status || '—'}</span>`;
}

// ─── DASHBOARD ──────────────────────────────
const SellerDashboard = {
  async load() {
    const uid = SellerGuard.currentUser.uid;
    const data = SellerGuard.sellerData;

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = data.firstName || data.displayName || 'Seller';
    document.getElementById('dashboard-greeting').textContent = `${greeting}, ${name}! Here's your store summary.`;

    // Approval notice
    if (data.sellerStatus !== 'approved') {
      document.getElementById('approval-notice').style.display = 'flex';
    }

    // ⚡ Show skeleton shimmer IMMEDIATELY while data loads
    ['stat-products','stat-orders','stat-revenue','stat-rating'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('skeleton');
    });

    // Stats — ⚡ PARALLEL fetch (was sequential — cuts load time in half)
    try {
      const [prods, orders] = await Promise.all([
        db.collection('products').where('sellerId', '==', uid).get(),
        db.collection('orders').where('sellerIds', 'array-contains', uid).get()
      ]);

      // Remove skeletons
      ['stat-products','stat-orders','stat-revenue','stat-rating'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('skeleton');
      });

      const productCount = prods.size;
      const activeCount  = prods.docs.filter(d => d.data().active !== false).length;
      document.getElementById('stat-products').textContent = productCount;
      document.getElementById('stat-products-active').textContent = `${activeCount} active`;

      const orderList = orders.docs.map(d => ({ id: d.id, ...d.data() }));
      const pending   = orderList.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
      document.getElementById('stat-orders').textContent = orderList.length;
      document.getElementById('stat-orders-pending').innerHTML = pending > 0 ? `<span style="color:var(--warning)">${pending} need attention</span>` : 'all caught up';

      const revenue = orderList
        .filter(o => o.status !== 'Cancelled')
        .reduce((sum, o) => sum + (o.sellerAmounts?.[uid] || o.total || 0), 0);
      document.getElementById('stat-revenue').textContent = fmt(revenue);

      const rating = data.sellerProfile?.rating || 0;
      document.getElementById('stat-rating').textContent = rating > 0 ? `⭐ ${rating.toFixed(1)}` : 'No ratings yet';

      // Update badge
      if (pending > 0) {
        const b = document.getElementById('badge-orders');
        b.textContent = pending;
        b.style.display = 'inline-flex';
      }

      // Recent orders (last 5)
      const recent = orderList.sort((a, b) => {
        const getMs = o => o.createdAt?.toMillis?.() || o.createdAt?.seconds * 1000 || 0;
        return getMs(b) - getMs(a);
      }).slice(0, 5);
      this.renderRecentOrders(recent);

      // Revenue chart
      this.renderBarChart(orderList, 'revenue-chart');

    } catch (e) {
      console.error('Dashboard load error:', e);
      ['stat-products','stat-orders','stat-revenue','stat-rating'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('skeleton'); el.textContent = '—'; }
      });
    }
  },

  renderRecentOrders(orders) {
    const el = document.getElementById('recent-orders-list');
    if (!orders.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>No orders yet</p></div>`;
      return;
    }
    el.innerHTML = orders.map(o => `
      <div class="recent-order-item">
        <div class="recent-order-icon">📦</div>
        <div class="recent-order-info">
          <div class="recent-order-title">#${o.id.slice(-8).toUpperCase()} — ${o.customerName || 'Customer'}</div>
          <div class="recent-order-sub">${fmtDate(o.createdAt)} · ${statusBadge(o.status)}</div>
        </div>
        <div class="recent-order-amount">${fmt(o.total)}</div>
      </div>
    `).join('');
  },

  renderBarChart(orders, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ label: d.toLocaleString('en-IN', { month: 'short' }), month: d.getMonth(), year: d.getFullYear(), total: 0 });
    }
    orders.filter(o => o.status !== 'Cancelled').forEach(o => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
      const m = months.find(x => x.month === d.getMonth() && x.year === d.getFullYear());
      if (m) m.total += (o.total || 0);
    });
    const max = Math.max(...months.map(m => m.total), 1);
    el.innerHTML = months.map(m => `
      <div class="bar-item">
        <div class="bar" style="height:${Math.max((m.total / max) * 100, 4)}%" title="${fmt(m.total)}"></div>
        <div class="bar-label">${m.label}</div>
      </div>
    `).join('');
  }
};


// ─── PRODUCTS & 4-STEP WIZARD CONTROLLER ───
const SellerWizard = {
  currentStep: 1,
  selectedStyle: 'signature',
  currentSuggestions: {},

  init() {
    this.renderStyleSelector();
  },

  goToStep(step) {
    if (step > this.currentStep) {
      // Validate prior steps
      if (this.currentStep === 1 && !this.validateStep1()) return;
      if (this.currentStep === 2 && !this.validateStep2()) return;
      if (this.currentStep === 3 && !this.validateStep3()) return;
    }

    this.currentStep = step;
    document.querySelectorAll('.wizard-step-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.wizard-step-item').forEach((item, idx) => {
      item.classList.remove('active');
      if (idx + 1 < step) item.classList.add('completed');
      else item.classList.remove('completed');
    });

    const activePanel = document.getElementById(`wizard-step-${step}`);
    if (activePanel) activePanel.classList.add('active');

    const activeNav = document.getElementById(`step-nav-${step}`);
    if (activeNav) activeNav.classList.add('active');

    const progress = ((step - 1) / 3) * 100;
    const bar = document.getElementById('wizard-progress-bar');
    if (bar) bar.style.width = `${progress}%`;

    // Button states
    const prevBtn = document.getElementById('btn-wizard-prev');
    const nextBtn = document.getElementById('btn-wizard-next');
    const pubBtn = document.getElementById('btn-wizard-publish');

    if (prevBtn) prevBtn.style.display = (step > 1) ? 'inline-flex' : 'none';
    if (nextBtn) nextBtn.style.display = (step < 4) ? 'inline-flex' : 'none';
    if (pubBtn) pubBtn.style.display = (step === 4) ? 'inline-flex' : 'none';

    if (step === 4) {
      this.renderPreview();
    }

    this.updateQualityScore();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  nextStep() {
    if (this.currentStep < 4) {
      this.goToStep(this.currentStep + 1);
    }
  },

  prevStep() {
    if (this.currentStep > 1) {
      this.goToStep(this.currentStep - 1);
    }
  },

  validateStep1() {
    const name = document.getElementById('p-name')?.value.trim();
    const cat = document.getElementById('p-category')?.value;
    const price = document.getElementById('p-price')?.value;
    const stock = document.getElementById('p-stock')?.value;

    if (!name) {
      SellerToast.show('Please enter a product name.', 'warning');
      document.getElementById('p-name')?.focus();
      return false;
    }
    if (!cat) {
      SellerToast.show('Please select a product category.', 'warning');
      document.getElementById('p-category')?.focus();
      return false;
    }
    if (!price || parseFloat(price) <= 0) {
      SellerToast.show('Please enter a valid MRP price.', 'warning');
      document.getElementById('p-price')?.focus();
      return false;
    }
    if (!stock || parseInt(stock) < 0) {
      SellerToast.show('Please enter available stock quantity.', 'warning');
      document.getElementById('p-stock')?.focus();
      return false;
    }
    return true;
  },

  validateStep2() {
    const totalImgs = SellerProducts.imageURLs.length + SellerProducts.imageFiles.length;
    if (totalImgs === 0) {
      SellerToast.show('Please upload at least 1 product photo.', 'warning');
      return false;
    }
    return true;
  },

  validateStep3() {
    const desc = document.getElementById('p-desc')?.value.trim();
    if (!desc) {
      SellerToast.show('Please generate or write a product description.', 'warning');
      document.getElementById('p-desc')?.focus();
      return false;
    }
    return true;
  },

  // ── QUALITY SCORE ──────────────────────────────────────────
  updateQualityScore() {
    let score = 0;
    const name = document.getElementById('p-name')?.value.trim();
    const cat = document.getElementById('p-category')?.value;
    const price = document.getElementById('p-price')?.value;
    const fabric = document.getElementById('p-fabric')?.value.trim();
    const occ = document.getElementById('p-occasion')?.value;
    const desc = document.getElementById('p-desc')?.value.trim();
    const imgCount = SellerProducts.imageURLs.length + SellerProducts.imageFiles.length;

    if (name && name.length > 5) score += 20;
    if (cat) score += 15;
    if (price && parseFloat(price) > 0) score += 15;
    if (imgCount >= 1) score += 15;
    if (imgCount >= 3) score += 10;
    if (fabric) score += 10;
    if (occ) score += 5;
    if (desc && desc.length > 30) score += 10;

    score = Math.min(100, score);
    const scoreVal = document.getElementById('quality-score-val');
    const scoreFill = document.getElementById('quality-score-fill');
    const scoreTip = document.getElementById('quality-score-tip');

    if (scoreVal) scoreVal.textContent = `${score}%`;
    if (scoreFill) scoreFill.style.width = `${score}%`;
    if (scoreTip) {
      if (score < 40) scoreTip.textContent = '— Add photos & material details for better visibility';
      else if (score < 80) scoreTip.textContent = '— Great start! Add AI description & occasion for best results';
      else scoreTip.textContent = '— Excellent! Your product listing is primed to sell';
    }
  },

  // ── SMART AI FIELD SUGGESTIONS ─────────────────────────────
  onTitleChange() {
    this.updateQualityScore();
    const title = document.getElementById('p-name')?.value.trim();
    if (!title || title.length < 3 || typeof SellerAI === 'undefined') {
      document.getElementById('ai-suggestions-box').style.display = 'none';
      return;
    }

    const suggestions = SellerAI.suggestDetails(title);
    this.currentSuggestions = suggestions;

    const chipsEl = document.getElementById('ai-suggestions-chips');
    const box = document.getElementById('ai-suggestions-box');
    if (!chipsEl || !box) return;

    let html = '';
    if (suggestions.category && !document.getElementById('p-category').value) {
      html += `<div class="ai-chip" onclick="SellerWizard.applySuggestion('category', '${suggestions.category}')">Category: <strong>${suggestions.category}</strong> [Apply]</div>`;
    }
    if (suggestions.fabric && !document.getElementById('p-fabric').value) {
      html += `<div class="ai-chip" onclick="SellerWizard.applySuggestion('fabric', '${suggestions.fabric}')">Possible Fabric: <strong>${suggestions.fabric}</strong> [Apply]</div>`;
    }
    if (suggestions.occasion && !document.getElementById('p-occasion').value) {
      html += `<div class="ai-chip" onclick="SellerWizard.applySuggestion('occasion', '${suggestions.occasion}')">Occasion: <strong>${suggestions.occasion}</strong> [Apply]</div>`;
    }
    if (suggestions.color && !document.getElementById('p-color').value) {
      html += `<div class="ai-chip" onclick="SellerWizard.applySuggestion('color', '${suggestions.color}')">Color: <strong>${suggestions.color}</strong> [Apply]</div>`;
    }

    if (html) {
      chipsEl.innerHTML = html;
      box.style.display = 'block';
    } else {
      box.style.display = 'none';
    }
  },

  applySuggestion(field, val) {
    if (field === 'category') {
      document.getElementById('p-category').value = val;
    } else if (field === 'fabric') {
      document.getElementById('p-fabric').value = val;
    } else if (field === 'occasion') {
      document.getElementById('p-occasion').value = val;
    } else if (field === 'color') {
      document.getElementById('p-color').value = val;
    }
    SellerToast.show(`Applied ${field}: ${val}`, 'success');
    this.onTitleChange();
  },

  acceptAllSuggestions() {
    if (this.currentSuggestions.category) document.getElementById('p-category').value = this.currentSuggestions.category;
    if (this.currentSuggestions.fabric) document.getElementById('p-fabric').value = this.currentSuggestions.fabric;
    if (this.currentSuggestions.occasion) document.getElementById('p-occasion').value = this.currentSuggestions.occasion;
    if (this.currentSuggestions.color) document.getElementById('p-color').value = this.currentSuggestions.color;
    if (this.currentSuggestions.tags && this.currentSuggestions.tags.length) {
      document.getElementById('p-tags').value = this.currentSuggestions.tags.join(', ');
    }
    document.getElementById('ai-suggestions-box').style.display = 'none';
    SellerToast.show('All AI suggestions applied! ✨', 'success');
    this.updateQualityScore();
  },

  onCategoryChange(val) {
    const custom = document.getElementById('p-category-custom-wrap');
    if (val === '__other__') {
      if (custom) custom.style.display = 'block';
    } else {
      if (custom) custom.style.display = 'none';
    }
    this.updateQualityScore();
  },

  // ── STYLE SELECTOR ─────────────────────────────────────────
  renderStyleSelector() {
    const grid = document.getElementById('ai-style-selector-grid');
    if (!grid || typeof SellerAI === 'undefined') return;

    grid.innerHTML = Object.values(SellerAI.STYLES).map(s => `
      <div class="ai-style-card ${s.id === this.selectedStyle ? 'active' : ''}" onclick="SellerWizard.selectStyle('${s.id}')">
        <h5>${s.name}</h5>
        <p>${s.desc}</p>
      </div>
    `).join('');
  },

  selectStyle(styleId) {
    this.selectedStyle = styleId;
    this.renderStyleSelector();
    SellerToast.show(`Writing style set: ${SellerAI.STYLES[styleId]?.name || styleId}`, 'info');
  },

  // ── AI DESCRIPTION GENERATION ──────────────────────────────
  generateAiDescription() {
    const name = document.getElementById('p-name')?.value.trim();
    const cat = document.getElementById('p-category')?.value;
    const fab = document.getElementById('p-fabric')?.value.trim();
    const occ = document.getElementById('p-occasion')?.value;
    const col = document.getElementById('p-color')?.value.trim();
    const price = document.getElementById('p-price')?.value;

    if (!name) {
      SellerToast.show('Please enter a product name first in Step 1.', 'warning');
      this.goToStep(1);
      return;
    }

    const btn = document.getElementById('btn-generate-ai-desc');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '✨ Crafting Description with AI...';
    }

    setTimeout(() => {
      try {
        const res = SellerAI.generateDescription({
          name, category: cat, fabric: fab, occasion: occ, color: col, price
        }, this.selectedStyle);

        document.getElementById('p-short-desc').value = res.shortDescription;
        document.getElementById('p-desc').value = res.description;
        document.getElementById('p-highlights').value = res.highlights.map(h => `• ${h}`).join('\n');

        const toolbar = document.getElementById('ai-refine-toolbar');
        if (toolbar) toolbar.style.display = 'flex';

        SellerToast.show('AI Description generated! ✨', 'success');
        this.updateQualityScore();
      } catch (err) {
        SellerToast.show('AI generation fallback active. You can edit directly.', 'warning');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '✨ Regenerate Description with AI';
        }
      }
    }, 400);
  },

  refineDescription(action) {
    let desc = document.getElementById('p-desc')?.value.trim() || '';
    if (!desc) { this.generateAiDescription(); return; }

    if (action === 'shorter') {
      const sentences = desc.split('. ');
      desc = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '');
      SellerToast.show('Description made concise ✂', 'info');
    } else if (action === 'detailed') {
      desc += ' Handcrafted with meticulous attention to detail, this outfit ensures lasting elegance, effortless draping, and unmatched festive charm.';
      SellerToast.show('Added detailed styling notes 📖', 'info');
    } else if (action === 'premium') {
      desc = 'An exquisite boutique statement piece from Nari Niketan. ' + desc;
      SellerToast.show('Upgraded to luxury boutique tone 💎', 'info');
    } else if (action === 'simpler') {
      desc = desc.replace(/exquisitely|meticulous|unmatched panache|discerning|bespoke/gi, 'beautiful');
      SellerToast.show('Simplified for easy reading 😊', 'info');
    } else if (action === 'festive') {
      desc += ' Radiate celebratory joy at weddings, festivals, and unforgettable milestones.';
      SellerToast.show('Added festive celebratory flair 🎉', 'info');
    } else if (action === 'seo') {
      const name = document.getElementById('p-name')?.value.trim() || 'ethnic outfit';
      desc = `Buy ${name} online from Nari Niketan with doorstep delivery. ` + desc;
      SellerToast.show('Optimized for search discovery 🔎', 'info');
    }
    document.getElementById('p-desc').value = desc;
  },

  // ── VISUAL AI IMAGE ASSISTANT ──────────────────────────────
  async analyzeMainImage() {
    const totalImgs = SellerProducts.imageURLs.length + SellerProducts.imageFiles.length;
    if (totalImgs === 0) {
      SellerToast.show('Please upload a product photo first to analyze.', 'warning');
      return;
    }

    const btn = document.getElementById('btn-ai-analyze-img');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '✨ Analyzing Photo...';
    }

    const res = await SellerAI.analyzeImage();
    const box = document.getElementById('visual-ai-result-box');
    const content = document.getElementById('visual-ai-result-content');

    if (box && content) {
      content.innerHTML = `
        <div><strong>✓ Detected:</strong> ${res.detected.productType} &bull; ${res.detected.style}</div>
        <div><strong>~ Possible:</strong> ${res.possible.pattern} &bull; ${res.possible.occasion}</div>
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.3rem;">ℹ️ Please verify material and exact color in Step 1.</div>
      `;
      box.style.display = 'block';
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = '✨ Re-Analyze Photo with AI';
    }
    SellerToast.show('Photo analyzed! Insights added.', 'success');
  },

  // ── STEP 4: LIVE CUSTOMER PREVIEW ──────────────────────────
  renderPreview() {
    const previewBox = document.getElementById('customer-preview-mock');
    if (!previewBox) return;

    const name = document.getElementById('p-name')?.value.trim() || 'Untitled Ethnic Outfit';
    const cat = document.getElementById('p-category')?.value || 'Ethnic Wear';
    const mrp = parseFloat(document.getElementById('p-price')?.value) || 0;
    const salePrice = parseFloat(document.getElementById('p-sale-price')?.value) || null;
    const stock = parseInt(document.getElementById('p-stock')?.value) || 0;
    const shortDesc = document.getElementById('p-short-desc')?.value.trim();
    const fullDesc = document.getElementById('p-desc')?.value.trim() || 'No description provided.';
    const highlights = document.getElementById('p-highlights')?.value.split('\n').filter(Boolean);
    const colors = document.getElementById('p-color')?.value.trim();
    const sizes = document.getElementById('p-sizes')?.value.trim();

    const mainImgUrl = SellerProducts.imageURLs[0] || (SellerProducts.imageFiles[0] ? URL.createObjectURL(SellerProducts.imageFiles[0]) : 'https://placehold.co/320x420/1A1225/D4AF37?text=No+Photo');

    const discPercent = (salePrice && mrp > salePrice) ? Math.round(((mrp - salePrice) / mrp) * 100) : 0;

    previewBox.innerHTML = `
      <div class="preview-img-box">
        <img src="${mainImgUrl}" alt="${name}">
        ${discPercent > 0 ? `<div style="position:absolute;top:10px;left:10px;background:#2E7D32;color:#fff;font-size:0.75rem;font-weight:800;padding:2px 8px;border-radius:4px;">${discPercent}% OFF</div>` : ''}
      </div>

      <div class="preview-details-box">
        <div style="font-size:0.78rem;color:#8B1A4A;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.2rem;">${cat}</div>
        <h2 class="preview-prod-title">${name}</h2>

        <div class="preview-price-row">
          <span class="preview-sale-price">₹${Number(salePrice || mrp).toLocaleString('en-IN')}</span>
          ${salePrice && salePrice < mrp ? `<span class="preview-mrp">₹${Number(mrp).toLocaleString('en-IN')}</span>` : ''}
          ${discPercent > 0 ? `<span class="preview-disc-badge">${discPercent}% OFF</span>` : ''}
        </div>

        <div style="font-size:0.78rem;color:${stock > 0 ? '#15803D' : '#c62828'};font-weight:700;margin-bottom:0.75rem;">
          ${stock > 0 ? `✓ In Stock (${stock} available)` : '✕ Out of Stock'}
        </div>

        ${shortDesc ? `<p style="font-size:0.85rem;font-style:italic;color:#666;margin-bottom:0.75rem;">"${shortDesc}"</p>` : ''}

        ${highlights && highlights.length ? `
          <div class="preview-highlights-list">
            <strong>Highlights:</strong>
            <ul style="margin:0.25rem 0 0 0;padding-left:1.2rem;">
              ${highlights.map(h => `<li>${h.replace(/^[•\-\*]\s*/, '')}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="preview-desc-text">${fullDesc}</div>

        ${colors ? `<div style="font-size:0.8rem;color:#555;margin-bottom:0.3rem;"><strong>Colors:</strong> ${colors}</div>` : ''}
        ${sizes ? `<div style="font-size:0.8rem;color:#555;margin-bottom:0.3rem;"><strong>Sizes:</strong> ${sizes}</div>` : ''}
      </div>
    `;
  },

  // ── SAVE & PUBLISH ─────────────────────────────────────────
  async saveDraft() {
    await SellerProducts.saveProductWithStatus(false);
  },

  async publishProduct() {
    await SellerProducts.saveProductWithStatus(true);
  },

  openQuickAdd() {
    SellerProducts.openAddForm();
    SellerToast.show('Upload photos to start Quick Add with AI! ⚡', 'info');
    this.goToStep(2);
  }
};

// ─── EXTENDED SELLER PRODUCTS ───────────────────────────────
const SellerProducts = {
  allProducts: [],
  imageFiles: [],   // local file blobs
  imageURLs: [],    // existing Storage URLs or approved AI image URLs
  imageMetadata: [], // [{ url, source: 'ai_generated'|'seller_uploaded', approvedBySeller: true, viewType, generatedAt }]
  aiCandidates: [], // Pending AI views awaiting review
  selectedAiView: 'angle_45',
  isAiGenerating: false,
  editingId: null,
  isActive: true,

  async load() {
    const uid = SellerGuard.currentUser.uid;
    const tbody = document.getElementById('products-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-dim)">Loading…</td></tr>`;
    try {
      const snap = await db.collection('products').where('sellerId', '==', uid).get();
      this.allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.allProducts.sort((a, b) => {
        const t = p => p.createdAt?.toMillis?.() || p.createdAt?.seconds * 1000 || 0;
        return t(b) - t(a);
      });
      const b = document.getElementById('badge-products');
      if (b && this.allProducts.length > 0) { b.textContent = this.allProducts.length; b.style.display = 'inline-flex'; }
      this.renderTable(this.allProducts);
    } catch (e) {
      console.error('Products load:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="notice error"><span>❌</span> Failed to load products. Please refresh.</div></td></tr>`;
    }
  },

  filter() {
    const q    = document.getElementById('product-search')?.value.toLowerCase() || '';
    const cat  = document.getElementById('product-cat-filter')?.value || '';
    const stat = document.getElementById('product-status-filter')?.value || '';
    const filtered = this.allProducts.filter(p => {
      const matchQ   = !q   || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
      const matchCat = !cat || p.category === cat;
      const matchSt  = !stat || (stat === 'active' ? p.active !== false : p.active === false);
      return matchQ && matchCat && matchSt;
    });
    this.renderTable(filtered);
  },

  renderTable(products) {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;
    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🛍️</div><h3>No products found</h3><p>Try adjusting filters or add a new product</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = products.map(p => `
      <tr>
        <td>
          <div class="product-cell">
            <img class="product-thumb" src="${p.imageUrl || p.images?.[0] || 'https://placehold.co/44x54/1A1225/D4AF37?text=P'}" alt="${p.name || ''}" onerror="this.src='https://placehold.co/44x54/1A1225/D4AF37?text=P'">
            <div class="product-cell-info">
              <div class="product-cell-name">${p.name || '—'}</div>
              <div class="product-cell-cat">${p.sku || ''}</div>
            </div>
          </div>
        </td>
        <td class="td-muted">${p.category || '—'}</td>
        <td>
          ${p.salePrice ? `<span style="font-weight:700;color:var(--accent)">${fmt(p.salePrice)}</span> <span style="text-decoration:line-through;color:var(--text-dim);font-size:0.78rem">${fmt(p.price)}</span>` : `<span style="font-weight:600">${fmt(p.price)}</span>`}
        </td>
        <td>
          <span style="color:${(p.stock || 0) < 5 ? 'var(--error)' : (p.stock || 0) < 20 ? 'var(--warning)' : 'var(--green)'}; font-weight:600">${p.stock ?? '—'}</span>
        </td>
        <td>${statusBadge(p.active !== false ? 'active' : 'inactive')}</td>
        <td>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-xs" onclick="SellerProducts.edit('${p.id}')">✏️ Edit</button>
            <button class="btn btn-accent btn-xs" onclick="SellerProducts.openPromoteModal('${p.id}')" title="Request AI Ads Promotion">📢 Promote</button>
            <button class="btn btn-outline btn-xs" onclick="SellerProducts.duplicate('${p.id}')" title="Duplicate product details">📄 Copy</button>
            <button class="btn btn-danger btn-xs" onclick="SellerProducts.delete('${p.id}', '${(p.name || '').replace(/'/g, '')}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  
  
  // ── SELLER PROMOTION REQUEST ────────────────────────────────
  currentPromoteProduct: null,

  openPromoteModal(productId) {
    const p = this.allProducts.find(x => x.id === productId);
    if (!p) return;
    this.currentPromoteProduct = p;

    const modal = document.getElementById('seller-promote-modal');
    const body = document.getElementById('seller-promote-modal-body');
    if (!modal || !body) return;

    const price = p.salePrice || p.price || 0;
    const img = p.imageUrl || (p.images && p.images[0]) || '';

    // Generate AI Proposal
    const adHeadline = `Exquisite Handcrafted ${p.name}`;
    const adSubheadline = `Tailored for festive elegance & special occasions with doorstep delivery.`;

    body.innerHTML = `
      <div style="display:flex;gap:1rem;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(212,175,55,0.25);border-radius:10px;padding:0.75rem;margin-bottom:1rem;">
        ${img ? `<img src="${img}" alt="${p.name}" style="width:60px;aspect-ratio:3/4;object-fit:cover;border-radius:6px;">` : ''}
        <div>
          <h4 style="font-size:0.92rem;color:#fff;margin:0 0 4px;">${p.name}</h4>
          <div style="font-size:0.8rem;font-weight:700;color:#FFE082;">₹${Number(price).toLocaleString('en-IN')}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);">${p.category || 'Ethnic Wear'}</div>
        </div>
      </div>

      <div style="margin-bottom:1rem;">
        <label style="font-size:0.78rem;font-weight:700;color:#FFE082;text-transform:uppercase;margin-bottom:0.3rem;display:block;">
          ✨ Proposed AI Ad Headline:
        </label>
        <input type="text" class="form-control" id="promote-headline" value="${adHeadline}">
      </div>

      <div style="margin-bottom:1rem;">
        <label style="font-size:0.78rem;font-weight:700;color:#FFE082;text-transform:uppercase;margin-bottom:0.3rem;display:block;">
          ✨ Promotional Message:
        </label>
        <textarea class="form-control" id="promote-subheadline" style="min-height:70px;">${adSubheadline}</textarea>
      </div>

      <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:8px;padding:0.75rem;font-size:0.78rem;color:#A3E635;">
        ✓ Your promotion request will be prioritized for Homepage &amp; Nari AI Picks rotation upon Admin approval.
      </div>
    `;

    modal.classList.remove('hidden');
  },

  closePromoteModal() {
    const modal = document.getElementById('seller-promote-modal');
    if (modal) modal.classList.add('hidden');
    this.currentPromoteProduct = null;
  },

  async submitPromoteRequest() {
    if (!this.currentPromoteProduct) return;
    const btn = document.getElementById('btn-submit-promote-req');
    if (btn) btn.disabled = true;

    try {
      const p = this.currentPromoteProduct;
      const headline = document.getElementById('promote-headline')?.value || p.name;
      const subheadline = document.getElementById('promote-subheadline')?.value || '';
      const uid = SellerGuard.currentUser.uid;
      const data = SellerGuard.sellerData;

      if (typeof db !== 'undefined' && db) {
        await db.collection('sellerAdRequests').add({
          productId: p.id,
          productName: p.name,
          category: p.category || '',
          price: p.salePrice || p.price || 0,
          imageUrl: p.imageUrl || (p.images && p.images[0]) || '',
          sellerId: uid,
          sellerName: data.sellerProfile?.storeName || data.displayName || 'Seller',
          headline,
          subheadline,
          status: 'pending_review',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      this.closePromoteModal();
      SellerToast.show('Promotion request submitted to Admin! 🚀', 'success');
    } catch (e) {
      SellerToast.show('Failed to submit request: ' + e.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  // ── AI PHOTO ASSISTANT CONTROLLER ──────────────────────────
  renderAiPhotoAssistant() {
    const card = document.getElementById('ai-photo-assistant-card');
    const badge = document.getElementById('photo-count-badge');
    if (!card) return;

    const totalUploaded = this.imageURLs.length + this.imageFiles.length;
    if (badge) badge.textContent = `${totalUploaded} / 6 images`;

    if (totalUploaded >= 6) {
      card.innerHTML = `
        <div style="text-align:center;padding:0.5rem 0;">
          <div style="font-size:1.5rem;margin-bottom:0.25rem;">✓</div>
          <h4 style="color:#22C55E;font-size:1rem;font-weight:700;margin-bottom:0.2rem;">Maximum 6 Product Images Reached</h4>
          <p style="font-size:0.8rem;color:var(--text-dim);">Your listing has a complete photo set. You can reorder or remove photos above if needed.</p>
        </div>
      `;
      return;
    }

    if (totalUploaded === 0) {
      card.innerHTML = `
        <div class="ai-photo-header">
          <div class="ai-photo-title">✨ AI Product Photo Assistant</div>
        </div>
        <p class="ai-photo-desc">Upload at least 1 product photo above to unlock AI-assisted multi-angle views (Back view, 45° angle, Fabric close-up, and Flatlay display).</p>
      `;
      return;
    }

    const remaining = 6 - totalUploaded;
    const uid = (SellerGuard && SellerGuard.currentUser) ? SellerGuard.currentUser.uid : 'guest';
    const quota = SellerAI.photoAssistant ? SellerAI.photoAssistant.getQuota(uid) : { remaining: 25 };
    const views = SellerAI.photoAssistant ? Object.values(SellerAI.photoAssistant.VIEW_TYPES) : [];

    card.innerHTML = `
      <div class="ai-photo-header">
        <div class="ai-photo-title">✨ AI Product Photo Assistant</div>
        <span class="ai-photo-counter-badge">✨ You have ${totalUploaded} photos &bull; Generate up to ${remaining} more</span>
      </div>

      <p class="ai-photo-desc">
        Need more product views? Generate additional complementary angles while preserving 100% of your authentic product colors, fabric texture, and embroidery.
      </p>

      <div class="ai-photo-views-label">1. Choose Perspective to Generate:</div>
      <div class="ai-views-pill-grid">
        ${views.map(v => `
          <div class="ai-view-pill ${v.id === this.selectedAiView ? 'active' : ''}" onclick="SellerProducts.selectAiView('${v.id}')">
            <span>${v.icon}</span>
            <span>${v.label}</span>
          </div>
        `).join('')}
      </div>

      <div class="ai-gen-btn-group">
        <button type="button" class="ai-gen-action-btn" id="btn-gen-ai-single" onclick="SellerProducts.generateAiViews(1)" ${this.isAiGenerating ? 'disabled' : ''}>
          <span>✨ Generate 1 View (${SellerAI.photoAssistant?.VIEW_TYPES[this.selectedAiView]?.label || 'Selected'})</span>
        </button>
        
        ${remaining >= 2 ? `
          <button type="button" class="ai-gen-action-btn btn-secondary-ai" onclick="SellerProducts.generateAiViews(2)" ${this.isAiGenerating ? 'disabled' : ''}>
            <span>✨ Generate 2 Complementary Views</span>
          </button>
        ` : ''}

        ${remaining > 2 ? `
          <button type="button" class="ai-gen-action-btn btn-secondary-ai" onclick="SellerProducts.generateAiViews(${remaining})" ${this.isAiGenerating ? 'disabled' : ''}>
            <span>✨ Generate All Remaining (${remaining})</span>
          </button>
        ` : ''}
      </div>

      <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.75rem;display:flex;align-items:center;justify-content:space-between;">
        <span>🛡️ Grounded on your uploaded photo &bull; Zero fabrication</span>
        <span style="color:#FFE082;">⚡ ${quota.remaining} AI views remaining today</span>
      </div>

      <div id="ai-photo-loading-container" style="display:none;"></div>
    `;
  },

  selectAiView(viewId) {
    this.selectedAiView = viewId;
    this.renderAiPhotoAssistant();
  },

  async generateAiViews(count = 1) {
    const totalUploaded = this.imageURLs.length + this.imageFiles.length;
    if (totalUploaded === 0) {
      SellerToast.show('Please upload a reference product photo first.', 'warning');
      return;
    }

    const remaining = 6 - totalUploaded;
    const toGenCount = Math.min(count, remaining);
    if (toGenCount <= 0) {
      SellerToast.show('Maximum 6 product images reached.', 'info');
      return;
    }

    const uid = (SellerGuard && SellerGuard.currentUser) ? SellerGuard.currentUser.uid : 'guest';
    const quota = SellerAI.photoAssistant.getQuota(uid);
    if (quota.remaining <= 0) {
      SellerToast.show('Daily AI photo limit reached (25/25). You can upload photos directly.', 'warning');
      return;
    }

    // Get primary reference image source
    let refSrc = '';
    if (this.imageURLs.length > 0) {
      refSrc = this.imageURLs[0];
    } else if (this.imageFiles.length > 0) {
      refSrc = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(this.imageFiles[0]);
      });
    }

    this.isAiGenerating = true;
    this.renderAiPhotoAssistant();

    const loadBox = document.getElementById('ai-photo-loading-container');
    if (loadBox) {
      loadBox.style.display = 'block';
      loadBox.innerHTML = `
        <div class="ai-photo-loading-box">
          <div class="ai-photo-loading-spinner">✨</div>
          <div class="ai-photo-loading-step" id="ai-loading-step-text">Analyzing fabric texture &amp; embroidery motifs...</div>
          <div class="ai-photo-loading-sub">Preserving authentic colors &amp; border alignment</div>
          <div class="ai-loading-progress-bar">
            <div class="ai-loading-progress-fill" id="ai-loading-progress-fill"></div>
          </div>
          <button type="button" class="btn btn-ghost btn-xs" onclick="SellerProducts.cancelAiGen()" style="color:#EF5350;margin-top:4px;">
            ✕ Cancel Generation
          </button>
        </div>
      `;
    }

    try {
      const stepText = document.getElementById('ai-loading-step-text');
      const progressFill = document.getElementById('ai-loading-progress-fill');

      // Determine view list
      let viewKeys = [this.selectedAiView];
      if (toGenCount > 1) {
        const recommended = SellerAI.photoAssistant.getRecommendedViews(totalUploaded, [this.selectedAiView]);
        viewKeys = [this.selectedAiView, ...recommended.map(r => r.id)].slice(0, toGenCount);
      }

      for (let i = 0; i < viewKeys.length; i++) {
        const vKey = viewKeys[i];
        const vMeta = SellerAI.photoAssistant.VIEW_TYPES[vKey] || { name: vKey };

        if (stepText) stepText.textContent = `Synthesizing ${vMeta.name} (${i + 1}/${viewKeys.length})...`;
        if (progressFill) progressFill.style.width = `${Math.round(((i + 0.5) / viewKeys.length) * 100)}%`;

        await new Promise(r => setTimeout(r, 600));

        const result = await SellerAI.photoAssistant.generateProductView(refSrc, vKey, {
          name: document.getElementById('p-name')?.value,
          category: document.getElementById('p-category')?.value
        });

        SellerAI.photoAssistant.incrementQuota(uid);
        this.aiCandidates.push(result);
      }

      if (stepText) stepText.textContent = 'Validating color & pattern consistency... ✓';
      if (progressFill) progressFill.style.width = '100%';
      await new Promise(r => setTimeout(r, 400));

      SellerToast.show(`Generated ${toGenCount} AI view(s)! Review them below. ✨`, 'success');
      this.renderAiReviewTray();

    } catch (err) {
      console.error('AI Photo Gen error:', err);
      SellerToast.show('Could not synthesize photo view: ' + err.message, 'error');
    } finally {
      this.isAiGenerating = false;
      this.renderAiPhotoAssistant();
    }
  },

  cancelAiGen() {
    this.isAiGenerating = false;
    this.renderAiPhotoAssistant();
    SellerToast.show('AI generation cancelled.', 'info');
  },

  renderAiReviewTray() {
    const tray = document.getElementById('ai-review-tray');
    const grid = document.getElementById('ai-candidates-grid');
    if (!tray || !grid) return;

    if (this.aiCandidates.length === 0) {
      tray.style.display = 'none';
      return;
    }

    tray.style.display = 'block';
    grid.innerHTML = this.aiCandidates.map((cand, idx) => `
      <div class="ai-candidate-card">
        <div class="ai-candidate-img-wrap">
          <div class="ai-badge-review">🤖 AI GENERATED</div>
          <img src="${cand.url}" alt="${cand.viewName}">
          <div class="ai-candidate-view-tag">${cand.viewName}</div>
        </div>
        <div class="ai-candidate-body">
          <div class="ai-quality-tag">${cand.qualityTags ? cand.qualityTags[0] : '✓ Quality Verified'}</div>
          <div class="ai-candidate-actions">
            <button type="button" class="btn-ai-use" onclick="SellerProducts.useAiCandidate(${idx})">
              ✓ Use Image
            </button>
            <button type="button" class="btn-ai-regen" onclick="SellerProducts.regenerateAiCandidate(${idx})">
              ↻ Regenerate
            </button>
            <button type="button" class="btn-ai-discard" onclick="SellerProducts.discardAiCandidate(${idx})">
              🗑 Discard
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  useAiCandidate(index) {
    const total = this.imageURLs.length + this.imageFiles.length;
    if (total >= 6) {
      SellerToast.show('Maximum 6 product images reached.', 'warning');
      return;
    }

    const cand = this.aiCandidates.splice(index, 1)[0];
    if (!cand) return;

    // Add to approved product images
    this.imageURLs.push(cand.url);
    this.imageMetadata.push({
      url: cand.url,
      source: 'ai_generated',
      viewType: cand.viewType,
      approvedBySeller: true,
      generatedAt: cand.generatedAt
    });

    this.renderImagePreviews();
    this.renderAiReviewTray();
    this.renderAiPhotoAssistant();
    SellerWizard.updateQualityScore();
    SellerToast.show(`Approved & added ${cand.label || 'AI view'} to listing! ✨`, 'success');
  },

  async regenerateAiCandidate(index) {
    const cand = this.aiCandidates[index];
    if (!cand) return;

    let refSrc = this.imageURLs[0] || '';
    if (!refSrc && this.imageFiles.length > 0) {
      refSrc = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(this.imageFiles[0]);
      });
    }

    SellerToast.show(`Regenerating ${cand.label}...`, 'info');
    try {
      const refreshed = await SellerAI.photoAssistant.generateProductView(refSrc, cand.viewType);
      this.aiCandidates[index] = refreshed;
      this.renderAiReviewTray();
      SellerToast.show(`Regenerated ${cand.label}! Review updated image.`, 'success');
    } catch (e) {
      SellerToast.show('Regeneration failed: ' + e.message, 'error');
    }
  },

  discardAiCandidate(index) {
    this.aiCandidates.splice(index, 1);
    this.renderAiReviewTray();
    SellerToast.show('AI Candidate discarded', 'info');
  },

  openAddForm() {
    this.editingId = null;
    this.imageFiles = [];
    this.imageURLs  = [];
    this.isActive   = true;
    document.getElementById('product-edit-id').value = '';
    document.getElementById('add-product-title').textContent = 'Add New Product';
    
    // Clear inputs
    ['p-name', 'p-fabric', 'p-desc', 'p-short-desc', 'p-highlights', 'p-tags', 'p-price', 'p-sale-price', 'p-stock', 'p-sku', 'p-color', 'p-sizes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (document.getElementById('p-category')) document.getElementById('p-category').value = '';
    if (document.getElementById('p-occasion')) document.getElementById('p-occasion').value = '';

    this.aiCandidates = [];
    this.imageMetadata = [];
    this.renderImagePreviews();
    this.renderAiPhotoAssistant();
    this.renderAiReviewTray();
    SellerWizard.init();
    SellerWizard.goToStep(1);
  },

  async edit(id) {
    const p = this.allProducts.find(x => x.id === id);
    if (!p) return;
    this.editingId  = id;
    this.imageFiles = [];
    this.imageURLs  = (p.images && p.images.length > 0) ? [...p.images] : (p.imageUrl ? [p.imageUrl] : []);
    this.isActive   = p.active !== false;

    SellerNav.go('add-product');

    document.getElementById('product-edit-id').value = id;
    document.getElementById('add-product-title').textContent = 'Edit Product';
    document.getElementById('p-name').value       = p.name || '';
    
    const catSelect = document.getElementById('p-category');
    const knownCats = ['Sarees','Suits','Lehengas','Kurtas','Accessories','Jewellery'];
    if (p.category && !knownCats.includes(p.category)) {
      catSelect.value = '__other__';
      const wrap = document.getElementById('p-category-custom-wrap');
      if (wrap) wrap.style.display = 'block';
      const customEl = document.getElementById('p-category-custom');
      if (customEl) customEl.value = p.category;
    } else {
      catSelect.value = p.category || '';
    }

    document.getElementById('p-fabric').value     = p.fabric || '';
    document.getElementById('p-desc').value       = p.description || '';
    if (document.getElementById('p-short-desc')) document.getElementById('p-short-desc').value = p.shortDescription || '';
    if (document.getElementById('p-highlights')) document.getElementById('p-highlights').value = (p.highlights || []).join('\n');
    document.getElementById('p-tags').value       = (p.tags || []).join(', ');
    document.getElementById('p-price').value      = p.price || '';
    document.getElementById('p-sale-price').value = p.salePrice || '';
    document.getElementById('p-stock').value      = p.stock || '';
    document.getElementById('p-sku').value        = p.sku || '';
    document.getElementById('p-color').value      = (p.colors || []).join(', ');
    document.getElementById('p-sizes').value      = (p.sizes || []).join(', ');
    document.getElementById('p-occasion').value   = p.occasion || '';

    this.aiCandidates = [];
    this.imageMetadata = [];
    this.renderImagePreviews();
    this.renderAiPhotoAssistant();
    this.renderAiReviewTray();
    SellerWizard.init();
    SellerWizard.goToStep(1);
  },

  duplicate(id) {
    const p = this.allProducts.find(x => x.id === id);
    if (!p) return;
    this.openAddForm();
    document.getElementById('add-product-title').textContent = `Duplicate: ${p.name}`;
    document.getElementById('p-name').value = `Copy of ${p.name}`;
    document.getElementById('p-category').value = p.category || '';
    document.getElementById('p-fabric').value = p.fabric || '';
    document.getElementById('p-desc').value = p.description || '';
    if (document.getElementById('p-short-desc')) document.getElementById('p-short-desc').value = p.shortDescription || '';
    if (document.getElementById('p-highlights')) document.getElementById('p-highlights').value = (p.highlights || []).join('\n');
    document.getElementById('p-tags').value = (p.tags || []).join(', ');
    document.getElementById('p-price').value = p.price || '';
    document.getElementById('p-sale-price').value = p.salePrice || '';
    document.getElementById('p-stock').value = p.stock || '';
    document.getElementById('p-color').value = (p.colors || []).join(', ');
    document.getElementById('p-sizes').value = (p.sizes || []).join(', ');
    document.getElementById('p-occasion').value = p.occasion || '';
    this.imageURLs = (p.images && p.images.length > 0) ? [...p.images] : (p.imageUrl ? [p.imageUrl] : []);
    this.renderImagePreviews();
    SellerToast.show('Product cloned! Edit and publish as new.', 'success');
  },

  async delete(id, name) {
    const confirmed = await SellerConfirm.show(`Delete "${name}"?`, 'This product will be permanently removed and won\'t be visible to buyers.', '🗑️');
    if (!confirmed) return;
    try {
      await db.collection('products').doc(id).delete();
      this.allProducts = this.allProducts.filter(p => p.id !== id);
      this.renderTable(this.allProducts);
      SellerToast.show('Product deleted', 'success');
    } catch (e) {
      SellerToast.show('Failed to delete product', 'error');
    }
  },

  // ── IMAGE MANAGEMENT & REORDERING ──────────────────────────
  handleImageFiles(files) {
    const remaining = 6 - this.imageURLs.length - this.imageFiles.length;
    const toAdd = Array.from(files).slice(0, remaining);
    toAdd.forEach(f => this.imageFiles.push(f));
    this.renderImagePreviews();
    this.renderAiPhotoAssistant();
    SellerWizard.updateQualityScore();
  },

  renderImagePreviews() {
    const grid = document.getElementById('photo-grid-manager');
    if (!grid) return;

    let items = [];
    this.imageURLs.forEach((url, i) => {
      items.push({ url, isExisting: true, index: i });
    });
    this.imageFiles.forEach((f, i) => {
      items.push({ url: URL.createObjectURL(f), isExisting: false, index: i });
    });

    if (items.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.85rem;">No photos uploaded yet. Click above or drag photos to upload.</div>`;
      return;
    }

    grid.innerHTML = items.map((item, i) => `
      <div class="photo-card ${i === 0 ? 'is-main' : ''}">
        ${i === 0 ? '<div class="photo-badge-main">⭐ Main Photo</div>' : ''}
        <img src="${item.url}" alt="Product Photo ${i + 1}">
        <div class="photo-card-actions">
          ${i > 0 ? `<button type="button" class="photo-btn" onclick="SellerProducts.setAsMain(${i})" title="Set as Main Photo">⭐</button>` : '<span></span>'}
          <button type="button" class="photo-btn btn-del" onclick="SellerProducts.removeImage(${i})" title="Delete Photo">✕</button>
        </div>
      </div>
    `).join('');
  },

  setAsMain(index) {
    // Reorder images so selected index is 1st
    const totalExisting = this.imageURLs.length;
    if (index < totalExisting) {
      const selected = this.imageURLs.splice(index, 1)[0];
      this.imageURLs.unshift(selected);
    } else {
      const fileIdx = index - totalExisting;
      const selected = this.imageFiles.splice(fileIdx, 1)[0];
      this.imageFiles.unshift(selected);
    }
    this.renderImagePreviews();
    SellerToast.show('Main product photo updated! ⭐', 'success');
  },

  removeImage(index) {
    const totalExisting = this.imageURLs.length;
    if (index < totalExisting) {
      this.imageURLs.splice(index, 1);
    } else {
      this.imageFiles.splice(index - totalExisting, 1);
    }
    this.renderImagePreviews();
    this.renderAiPhotoAssistant();
    SellerWizard.updateQualityScore();
  },

  dragOver(e) { e.preventDefault(); document.getElementById('upload-zone-large')?.classList.add('drag-over'); },
  dragLeave() { document.getElementById('upload-zone-large')?.classList.remove('drag-over'); },
  drop(e) {
    e.preventDefault();
    document.getElementById('upload-zone-large')?.classList.remove('drag-over');
    this.handleImageFiles(e.dataTransfer.files);
  },

  async uploadImageToStorage(file, uid, productId) {
    const compressedBlob = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 900;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else       { w = Math.round(w * MAX / h); h = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(resolve, 'image/jpeg', 0.82);
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const path     = `products/${uid}/${productId}/${filename}`;
    const ref      = firebase.storage().ref(path);
    const snap     = await ref.put(compressedBlob, { contentType: 'image/jpeg' });
    return await snap.ref.getDownloadURL();
  },

  async saveProductWithStatus(isPublished) {
    if (!SellerWizard.validateStep1()) { SellerWizard.goToStep(1); return; }
    if (!SellerWizard.validateStep2()) { SellerWizard.goToStep(2); return; }
    if (!SellerWizard.validateStep3()) { SellerWizard.goToStep(3); return; }

    const pubBtn = document.getElementById('btn-wizard-publish');
    const draftBtn = document.getElementById('btn-save-draft');
    if (pubBtn) pubBtn.disabled = true;
    if (draftBtn) draftBtn.disabled = true;

    try {
      const uid  = SellerGuard.currentUser.uid;
      const data = SellerGuard.sellerData;
      const docId = this.editingId || db.collection('products').doc().id;

      let uploadedURLs = [];
      if (this.imageFiles.length > 0) {
        uploadedURLs = await Promise.all(
          this.imageFiles.map(f => this.uploadImageToStorage(f, uid, docId))
        );
      }

      const allImages = [...this.imageURLs, ...uploadedURLs];
      const primaryImageUrl = allImages[0] || '';

      const salePrice = parseFloat(document.getElementById('p-sale-price')?.value) || null;
      const price     = parseFloat(document.getElementById('p-price')?.value);

      const highlights = (document.getElementById('p-highlights')?.value || '')
        .split('\n')
        .map(h => h.trim().replace(/^[•\-\*]\s*/, ''))
        .filter(Boolean);

      const product = {
        name:         document.getElementById('p-name').value.trim(),
        category:     (()=>{ const sel=document.getElementById('p-category'); return sel.value==='__other__' ? (document.getElementById('p-category-custom')?.value.trim()||'Other') : sel.value; })(),
        fabric:       document.getElementById('p-fabric')?.value.trim() || '',
        description:  document.getElementById('p-desc')?.value.trim() || '',
        shortDescription: document.getElementById('p-short-desc')?.value.trim() || '',
        highlights:   highlights,
        tags:         document.getElementById('p-tags')?.value.split(',').map(t => t.trim()).filter(Boolean),
        price,
        salePrice,
        stock:        parseInt(document.getElementById('p-stock')?.value) || 0,
        sku:          document.getElementById('p-sku')?.value.trim() || '',
        colors:       document.getElementById('p-color')?.value.split(',').map(c => c.trim()).filter(Boolean),
        sizes:        document.getElementById('p-sizes')?.value.split(',').map(s => s.trim()).filter(Boolean),
        occasion:     document.getElementById('p-occasion')?.value || '',
        images:       allImages,
        imageUrl:     primaryImageUrl,
        active:       isPublished,
        draft:        !isPublished,
        sellerId:     uid,
        sellerName:   data.sellerProfile?.storeName || data.displayName || '',
        sellerStatus: data.sellerStatus || 'pending',
        imageObjects: this.imageMetadata || [],
        aiGenerated:  { style: SellerWizard.selectedStyle, generatedAt: new Date().toISOString(), photoAssistantUsed: (this.imageMetadata||[]).some(m => m.source === 'ai_generated') },
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (salePrice && price) {
        product.discount = Math.round(((price - salePrice) / price) * 100);
      }

      if (this.editingId) {
        await db.collection('products').doc(docId).update(product);
        SellerToast.show(isPublished ? 'Product published successfully! 🎉' : 'Draft saved! 💾', 'success');
      } else {
        product.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('products').doc(docId).set(product);
        SellerToast.show(isPublished ? 'Product published successfully! 🎉' : 'Draft saved! 💾', 'success');
      }

      setTimeout(() => {
        SellerNav.go('products');
      }, 1000);

    } catch (e) {
      console.error('Save product error:', e);
      SellerToast.show('Error saving product: ' + e.message, 'error');
    } finally {
      if (pubBtn) pubBtn.disabled = false;
      if (draftBtn) draftBtn.disabled = false;
    }
  }
};

// ─── ORDERS ─────────────────────────────────
const SellerOrders = {
  allOrders: [],

  async load() {
    const uid = SellerGuard.currentUser.uid;
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-dim)">Loading…</td></tr>`;
    try {
      const snap = await db.collection('orders')
        .where('sellerIds', 'array-contains', uid)
        .orderBy('createdAt', 'desc')
        .get();
      this.allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.renderTable(this.allOrders);
    } catch (e) {
      // Fallback without orderBy (in case index not built)
      try {
        const snap2 = await db.collection('orders').where('sellerIds', 'array-contains', uid).get();
        this.allOrders = snap2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
          const t = o => o.createdAt?.toMillis?.() || o.createdAt?.seconds * 1000 || 0;
          return t(b) - t(a);
        });
        this.renderTable(this.allOrders);
      } catch (e2) {
        console.error('Orders load:', e2);
        tbody.innerHTML = `<tr><td colspan="7"><div class="notice error"><span>❌</span> Failed to load orders.</div></td></tr>`;
      }
    }
  },

  filter() {
    const q    = document.getElementById('order-search')?.value.toLowerCase() || '';
    const stat = document.getElementById('order-status-filter')?.value || '';
    const filtered = this.allOrders.filter(o => {
      const matchQ  = !q   || o.id.toLowerCase().includes(q) || (o.customerName || '').toLowerCase().includes(q);
      const matchSt = !stat || o.status === stat;
      return matchQ && matchSt;
    });
    this.renderTable(filtered);
  },

  renderTable(orders) {
    const tbody = document.getElementById('orders-tbody');
    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><h3>No orders found</h3><p>Orders for your products will appear here</p></div></td></tr>`;
      return;
    }
    const uid = SellerGuard.currentUser.uid;
    tbody.innerHTML = orders.map(o => {
      const myItems = (o.items || []).filter(item => item.sellerId === uid);
      const myTotal = o.sellerAmounts?.[uid] || myItems.reduce((s, i) => s + (i.price * i.qty || 0), 0);
      return `
        <tr>
          <td><span style="font-weight:600;font-family:monospace">#${o.id.slice(-8).toUpperCase()}</span></td>
          <td>
            <div style="font-weight:600;font-size:0.87rem">${o.customerName || '—'}</div>
            <div class="td-muted">${o.customerEmail || ''}</div>
          </td>
          <td>
            <div style="font-size:0.83rem;color:var(--text-muted)">${myItems.map(i => i.name || 'Item').join(', ').slice(0, 40)}${myItems.length > 1 ? ` (+${myItems.length - 1} more)` : ''}</div>
          </td>
          <td style="font-weight:700;color:var(--accent)">${fmt(myTotal)}</td>
          <td class="td-muted">${fmtDate(o.createdAt)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="SellerOrders.viewDetail('${o.id}')">👁️ View</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async viewDetail(orderId) {
    const o = this.allOrders.find(x => x.id === orderId);
    if (!o) return;
    const uid = SellerGuard.currentUser.uid;
    const myItems = (o.items || []).filter(item => item.sellerId === uid);
    const myTotal = o.sellerAmounts?.[uid] || myItems.reduce((s, i) => s + (i.price * i.qty || 0), 0);

    document.getElementById('order-modal-title').textContent = `Order #${orderId.slice(-8).toUpperCase()}`;
    document.getElementById('order-modal-body').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:1rem">
        <!-- Status + Date -->
        <div style="display:flex;justify-content:space-between;align-items:center">
          ${statusBadge(o.status)}
          <span style="color:var(--text-muted);font-size:0.82rem">${fmtDate(o.createdAt)}</span>
        </div>

        <!-- Customer -->
        <div style="background:var(--bg-card2);border-radius:var(--radius);padding:1rem">
          <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.08em">Customer</div>
          <div style="font-weight:600">${o.customerName || '—'}</div>
          <div style="color:var(--text-muted);font-size:0.83rem">${o.customerEmail || ''}</div>
          <div style="color:var(--text-muted);font-size:0.83rem">${o.customerPhone || ''}</div>
        </div>

        <!-- Shipping Address -->
        ${o.shippingAddress ? `
        <div style="background:var(--bg-card2);border-radius:var(--radius);padding:1rem">
          <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.08em">Ship To</div>
          <div style="font-size:0.88rem;line-height:1.6;color:var(--text-muted)">
            ${o.shippingAddress.line1 || ''} ${o.shippingAddress.line2 || ''}<br>
            ${o.shippingAddress.city || ''}, ${o.shippingAddress.state || ''} ${o.shippingAddress.pin || ''}<br>
            ${o.shippingAddress.country || 'India'}
          </div>
        </div>` : ''}

        <!-- Items -->
        <div>
          <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.08em">Your Items in this Order</div>
          ${myItems.map(item => `
            <div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid var(--border-soft)">
              ${item.image ? `<img src="${item.image}" style="width:50px;height:50px;border-radius:var(--radius);object-fit:cover">` : '<div style="width:50px;height:50px;border-radius:var(--radius);background:var(--bg-card2);display:flex;align-items:center;justify-content:center;font-size:1.3rem">🛍️</div>'}
              <div style="flex:1">
                <div style="font-weight:600;font-size:0.88rem">${item.name || '—'}</div>
                <div style="font-size:0.78rem;color:var(--text-muted)">${item.size ? 'Size: ' + item.size : ''} ${item.color ? '· Color: ' + item.color : ''}</div>
                <div style="font-size:0.8rem;color:var(--text-muted)">Qty: ${item.qty || 1}</div>
              </div>
              <div style="font-weight:700;color:var(--accent)">${fmt((item.price || 0) * (item.qty || 1))}</div>
            </div>
          `).join('')}
        </div>

        <!-- Total -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:0.5rem">
          <span style="font-weight:700">Your Earnings</span>
          <span style="font-weight:800;font-size:1.1rem;color:var(--accent)">${fmt(myTotal)}</span>
        </div>

        ${o.trackingNumber ? `
        <div style="background:var(--bg-card2);border-radius:var(--radius);padding:0.85rem">
          <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.3rem">Tracking Number</div>
          <div style="font-weight:600">${o.trackingNumber}</div>
          ${o.courier ? `<div style="font-size:0.8rem;color:var(--text-muted)">${o.courier}</div>` : ''}
        </div>` : ''}
      </div>
    `;

    document.getElementById('order-modal-footer').innerHTML = `
      <button class="btn btn-ghost" onclick="SellerOrders.closeModal()">Close</button>
    `;
    document.getElementById('order-modal-overlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('order-modal-overlay').classList.remove('open');
  }
};

// ─── EARNINGS ───────────────────────────────
const SellerEarnings = {
  async load() {
    const uid = SellerGuard.currentUser.uid;
    try {
      const snap = await db.collection('orders').where('sellerIds', 'array-contains', uid).get();
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const delivered = orders.filter(o => o.status === 'Delivered');
      const total     = delivered.reduce((s, o) => s + (o.sellerAmounts?.[uid] || o.total || 0), 0);
      const now       = new Date();
      const thisMonth = delivered.filter(o => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(0);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).reduce((s, o) => s + (o.sellerAmounts?.[uid] || o.total || 0), 0);

      document.getElementById('earn-total').textContent   = fmt(total);
      document.getElementById('earn-month').textContent   = fmt(thisMonth);
      document.getElementById('earn-pending').textContent = fmt(0);
      document.getElementById('earn-paid').textContent    = fmt(total);

      SellerDashboard.renderBarChart(orders, 'earn-chart');

      // Load saved bank details
      const data = SellerGuard.sellerData;
      const bank = data.bankDetails || {};
      if (bank.accountName)   document.getElementById('bank-name').value = bank.accountName;
      if (bank.accountNumber) document.getElementById('bank-acc').value  = bank.accountNumber;
      if (bank.ifsc)          document.getElementById('bank-ifsc').value = bank.ifsc;
      if (bank.bankName)      document.getElementById('bank-bank').value = bank.bankName;
      if (bank.upi)           document.getElementById('bank-upi').value  = bank.upi;
    } catch (e) {
      console.error('Earnings load:', e);
    }
  }
};

// ─── PROFILE ────────────────────────────────
const SellerProfile = {
  async load() {
    const data = SellerGuard.sellerData;
    const sp   = data.sellerProfile || {};
    document.getElementById('prof-store').value    = sp.storeName || '';
    document.getElementById('prof-category').value = sp.primaryCategory || '';
    document.getElementById('prof-gstin').value    = sp.gstin || '';
    document.getElementById('prof-desc').value     = sp.description || '';
    document.getElementById('prof-phone').value    = data.phone || '';
    document.getElementById('prof-email').value    = data.email || '';
    document.getElementById('prof-address').value  = sp.address || '';

    // Stats
    const statusMap = { pending: 'Pending Review', approved: 'Approved', rejected: 'Rejected' };
    const badgeCls  = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };
    const st = data.sellerStatus || 'pending';
    document.getElementById('prof-status-badge').className = `badge ${badgeCls[st] || 'badge-pending'}`;
    document.getElementById('prof-status-badge').textContent = statusMap[st] || st;

    document.getElementById('prof-stat-revenue').textContent = fmt(sp.totalRevenue || 0);
    document.getElementById('prof-stat-orders').textContent  = sp.totalSales || 0;
    document.getElementById('prof-stat-rating').textContent  = sp.rating ? `⭐ ${sp.rating.toFixed(1)}` : 'No ratings yet';

    if (data.createdAt) {
      document.getElementById('prof-stat-since').textContent = fmtDate(data.createdAt);
    }

    // Count products
    try {
      const snap = await db.collection('products').where('sellerId', '==', SellerGuard.currentUser.uid).get();
      document.getElementById('prof-stat-products').textContent = snap.size;
    } catch(e) {}
  },

  async save() {
    try {
      const uid = SellerGuard.currentUser.uid;
      const update = {
        phone: document.getElementById('prof-phone').value.trim(),
        'sellerProfile.storeName':       document.getElementById('prof-store').value.trim(),
        'sellerProfile.primaryCategory': document.getElementById('prof-category').value,
        'sellerProfile.gstin':           document.getElementById('prof-gstin').value.trim(),
        'sellerProfile.description':     document.getElementById('prof-desc').value.trim(),
        'sellerProfile.address':         document.getElementById('prof-address').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection('users').doc(uid).update(update);
      // Update local cache
      SellerGuard.sellerData = { ...SellerGuard.sellerData, ...update };
      const sn = document.getElementById('sidebar-store');
      if (sn) sn.textContent = document.getElementById('prof-store').value.trim() || 'My Store';
      SellerToast.show('Store profile saved!', 'success');
    } catch(e) {
      SellerToast.show('Failed to save profile', 'error');
    }
  },

  async saveBankDetails() {
    try {
      const uid = SellerGuard.currentUser.uid;
      const bank = {
        accountName:   document.getElementById('bank-name').value.trim(),
        accountNumber: document.getElementById('bank-acc').value.trim(),
        ifsc:          document.getElementById('bank-ifsc').value.trim().toUpperCase(),
        bankName:      document.getElementById('bank-bank').value.trim(),
        upi:           document.getElementById('bank-upi').value.trim(),
        updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection('users').doc(uid).update({ bankDetails: bank });
      SellerToast.show('Bank details saved!', 'success');
    } catch(e) {
      SellerToast.show('Failed to save bank details', 'error');
    }
  }
};

// ─── SETTINGS ───────────────────────────────
const SellerSettings = {
  async changePassword() {
    const oldPass     = document.getElementById('set-old-pass').value;
    const newPass     = document.getElementById('set-new-pass').value;
    const confirmPass = document.getElementById('set-confirm-pass').value;

    if (!oldPass || !newPass || !confirmPass) { SellerToast.show('Please fill all fields', 'warning'); return; }
    if (newPass !== confirmPass) { SellerToast.show('New passwords do not match', 'error'); return; }
    if (newPass.length < 6) { SellerToast.show('Password must be at least 6 characters', 'error'); return; }

    try {
      const user  = auth.currentUser;
      const cred  = firebase.auth.EmailAuthProvider.credential(user.email, oldPass);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(newPass);
      document.getElementById('set-old-pass').value     = '';
      document.getElementById('set-new-pass').value     = '';
      document.getElementById('set-confirm-pass').value = '';
      SellerToast.show('Password updated successfully!', 'success');
    } catch (e) {
      let msg = 'Failed to update password.';
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') msg = 'Current password is incorrect.';
      SellerToast.show(msg, 'error');
    }
  },

  async deactivate() {
    const confirmed = await SellerConfirm.show('Deactivate Seller Account?', 'All your products will be hidden from the store. You can reactivate by contacting support.', '⚠️');
    if (!confirmed) return;
    try {
      const uid = SellerGuard.currentUser.uid;
      await db.collection('users').doc(uid).update({ sellerStatus: 'inactive', isSeller: false });
      await db.collection('products').where('sellerId', '==', uid).get().then(snap => {
        const batch = db.batch();
        snap.docs.forEach(d => batch.update(d.ref, { active: false }));
        return batch.commit();
      });
      SellerToast.show('Account deactivated. Signing out…', 'warning');
      setTimeout(() => auth.signOut().then(() => window.location.href = '../index.html'), 2000);
    } catch(e) {
      SellerToast.show('Failed to deactivate account', 'error');
    }
  }
};

// ─── INIT ────────────────────────────────────
(async () => {
  const { user, data } = await SellerGuard.init();

  // Populate sidebar UI
  const name  = data.firstName || data.displayName || 'Seller';
  const store = data.sellerProfile?.storeName || 'My Store';
  const initL = name.charAt(0).toUpperCase();

  document.getElementById('sidebar-name').textContent   = name;
  document.getElementById('sidebar-store').textContent  = store;
  document.getElementById('sidebar-avatar').textContent = initL;
  document.getElementById('topbar-avatar').textContent  = initL;

  // Load default section
  SellerDashboard.load();
})();
