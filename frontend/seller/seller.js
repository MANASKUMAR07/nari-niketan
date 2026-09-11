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
      // Local dev / offline file testing fallback
      if (window.location.protocol === 'file:') {
        this._reveal();
        const demoUser = { uid: 'demo_seller_uid', email: 'seller@nariniketan.shop' };
        const demoData = {
          firstName: 'Boutique',
          displayName: 'Boutique Seller',
          isSeller: true,
          sellerStatus: 'approved',
          sellerProfile: { storeName: 'Nari Niketan Boutique' }
        };
        this.currentUser = demoUser;
        this.sellerData  = demoData;
        resolve({ user: demoUser, data: demoData });
        return;
      }

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

          // Must be a seller (approved or has isSeller flag) or admin/owner
          const hasSellerAccess = data.isSeller || data.sellerStatus === 'approved' || data.isAdmin || data.role === 'admin' || data.role === 'owner';
          if (!hasSellerAccess) {
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
    dashboard:     '📊 Dashboard',
    products:      '🛍️ My Products',
    inventory:     '📦 Inventory & Stock',
    'add-product': '➕ Add / Edit Product',
    orders:        '📦 Orders',
    earnings:      '💰 Earnings',
    profile:       '🏪 Store Profile',
    settings:      '⚙️ Settings',
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
    if (section === 'inventory')   SellerInventory.load();
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
    'Pending':           'badge-pending',
    'Processing':        'badge-processing',
    'Shipped':           'badge-shipped',
    'Out for Delivery':  'badge-out-for-delivery',
    'out_for_delivery':  'badge-out-for-delivery',
    'Ready for Pickup':  'badge-ready-for-pickup',
    'ready_for_pickup':  'badge-ready-for-pickup',
    'Collected':         'badge-delivered',
    'Delivered':         'badge-delivered',
    'Cancelled':         'badge-cancelled',
    'Approved':          'badge-approved',
    'Rejected':          'badge-rejected',
    'active':            'badge-active',
    'inactive':          'badge-cancelled',
    'pending':           'badge-pending',
    'approved':          'badge-approved',
    'rejected':          'badge-rejected',
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


// ─── VARIANT MATRIX & INVENTORY BUILDER ────────────────────
const SellerVariants = {
  PRESETS: {
    colors: [
      { name: 'Ruby Red', hex: '#C62828' },
      { name: 'Maroon', hex: '#880E4F' },
      { name: 'Wine', hex: '#4A0E17' },
      { name: 'Emerald Green', hex: '#1B5E20' },
      { name: 'Bottle Green', hex: '#0B3B17' },
      { name: 'Royal Blue', hex: '#1565C0' },
      { name: 'Navy Blue', hex: '#0D1B2A' },
      { name: 'Sky Blue', hex: '#81D4FA' },
      { name: 'Mustard Gold', hex: '#FBC02D' },
      { name: 'Metallic Gold', hex: '#D4AF37' },
      { name: 'Peach', hex: '#FFAB91' },
      { name: 'Rose Pink', hex: '#E91E63' },
      { name: 'Blush Pink', hex: '#F8BBD0' },
      { name: 'Rust Orange', hex: '#E65100' },
      { name: 'Plum Purple', hex: '#6A1B9A' },
      { name: 'Ivory / Off-White', hex: '#FDFBF7' },
      { name: 'Classic Black', hex: '#212121' },
      { name: 'Multicolor', hex: 'linear-gradient(135deg,#ff5252,#ffd700,#4caf50,#2196f3)' }
    ],
    sizes: [
      'XS (34)', 'S (36)', 'M (38)', 'L (40)', 'XL (42)', 'XXL (44)', '3XL (46)', 'Free Size'
    ]
  },

  productType: 'size_color',
  selectedColors: [],
  selectedSizes: [],
  variants: [],

  init() {
    this.renderColorChips();
    this.renderSizeChips();
    this.setProductType(this.productType || 'size_color');
  },

  setProductType(type) {
    this.productType = type;
    document.querySelectorAll('.product-type-card').forEach(c => c.classList.remove('selected'));
    const activeCard = document.getElementById(`ptype-${type}`);
    if (activeCard) activeCard.classList.add('selected');

    const builderWrap = document.getElementById('variant-builder-controls');
    const matrixWrap  = document.getElementById('variant-matrix-section');
    const singleWrap  = document.getElementById('single-stock-section');
    const colorSec    = document.getElementById('color-picker-section');
    const sizeSec     = document.getElementById('size-picker-section');

    if (type === 'single') {
      if (builderWrap) builderWrap.style.display = 'none';
      if (matrixWrap) matrixWrap.style.display = 'none';
      if (singleWrap) singleWrap.style.display = 'block';
    } else {
      if (builderWrap) builderWrap.style.display = 'block';
      if (matrixWrap) matrixWrap.style.display = 'block';
      if (singleWrap) singleWrap.style.display = 'none';

      if (colorSec) colorSec.style.display = (type === 'size_only') ? 'none' : 'block';
      if (sizeSec) sizeSec.style.display = (type === 'color_only') ? 'none' : 'block';
    }

    this.recalculateTotalStock();
  },

  renderColorChips() {
    const container = document.getElementById('preset-colors-chips');
    if (!container) return;
    container.innerHTML = this.PRESETS.colors.map(c => {
      const isSel = this.selectedColors.some(x => x.name.toLowerCase() === c.name.toLowerCase());
      return `
        <div class="preset-chip ${isSel ? 'selected' : ''}" onclick="SellerVariants.toggleColor('${c.name}', '${c.hex}')">
          <span class="preset-chip-swatch" style="background:${c.hex}"></span>
          <span>${c.name}</span>
        </div>
      `;
    }).join('');
  },

  renderSizeChips() {
    const container = document.getElementById('preset-sizes-chips');
    if (!container) return;
    container.innerHTML = this.PRESETS.sizes.map(s => {
      const isSel = this.selectedSizes.some(x => x.toLowerCase() === s.toLowerCase());
      return `
        <div class="preset-chip ${isSel ? 'selected' : ''}" onclick="SellerVariants.toggleSize('${s}')">
          <span>${s}</span>
        </div>
      `;
    }).join('');
  },

  toggleColor(name, hex) {
    const idx = this.selectedColors.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
    if (idx >= 0) {
      this.selectedColors.splice(idx, 1);
    } else {
      this.selectedColors.push({ name, hex });
    }
    this.renderColorChips();
  },

  toggleSize(size) {
    const idx = this.selectedSizes.findIndex(x => x.toLowerCase() === size.toLowerCase());
    if (idx >= 0) {
      this.selectedSizes.splice(idx, 1);
    } else {
      this.selectedSizes.push(size);
    }
    this.renderSizeChips();
  },

  addCustomColor() {
    const nameInput = document.getElementById('custom-color-name');
    const hexInput  = document.getElementById('custom-color-hex');
    const name = nameInput?.value.trim();
    const hex  = hexInput?.value || '#8B1A4A';
    if (!name) return;

    if (!this.PRESETS.colors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      this.PRESETS.colors.push({ name, hex });
    }
    if (!this.selectedColors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      this.selectedColors.push({ name, hex });
    }
    nameInput.value = '';
    this.renderColorChips();
  },

  addCustomSize() {
    const input = document.getElementById('custom-size-name');
    const size = input?.value.trim();
    if (!size) return;

    if (!this.PRESETS.sizes.some(s => s.toLowerCase() === size.toLowerCase())) {
      this.PRESETS.sizes.push(size);
    }
    if (!this.selectedSizes.some(s => s.toLowerCase() === size.toLowerCase())) {
      this.selectedSizes.push(size);
    }
    input.value = '';
    this.renderSizeChips();
  },

  generateMatrixFromSelection() {
    if (this.productType === 'single') return;

    const colors = (this.productType === 'size_only')
      ? [{ name: 'Standard', hex: '#8B1A4A' }]
      : (this.selectedColors.length > 0 ? this.selectedColors : [{ name: 'Standard', hex: '#8B1A4A' }]);

    const sizes = (this.productType === 'color_only')
      ? ['Free Size']
      : (this.selectedSizes.length > 0 ? this.selectedSizes : ['Free Size']);

    const existingMap = new Map();
    this.variants.forEach(v => {
      existingMap.set(`${(v.color||'').toLowerCase()}_${(v.size||'').toLowerCase()}`, v);
    });

    const newVariants = [];
    const cat = document.getElementById('p-category')?.value || 'ETH';
    const cleanCat = cat.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'CAT';

    colors.forEach(c => {
      sizes.forEach(s => {
        const key = `${c.name.toLowerCase()}_${s.toLowerCase()}`;
        const existing = existingMap.get(key);

        if (existing) {
          newVariants.push(existing);
        } else {
          const cleanCol = c.name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
          const cleanSz = s.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const autoSku = `NN-${cleanCat}-${cleanCol}-${cleanSz}`;
          const variantId = `var_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

          newVariants.push({
            variantId,
            sku: autoSku,
            color: c.name,
            colorCode: c.hex,
            size: s,
            quantity: 10,
            reservedQuantity: 0,
            availableQuantity: 10,
            lowStockThreshold: 5,
            price: null,
            active: true,
            status: 'in_stock'
          });
        }
      });
    });

    this.variants = newVariants;
    this.renderMatrixTable();
    this.recalculateTotalStock();
    SellerToast.show(`Generated ${this.variants.length} variant combinations! ⚡`, 'success');
  },

  renderMatrixTable() {
    const tbody = document.getElementById('variant-matrix-tbody');
    if (!tbody) return;

    if (!this.variants.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center;padding:2rem;color:var(--text-dim);">
            No variants created yet. Select colors &amp; sizes above and click "Generate / Refresh Variant Matrix".
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.variants.map((v) => {
      const q = Number(v.quantity || 0);
      const res = Number(v.reservedQuantity || 0);
      const avail = Math.max(0, q - res);
      const thresh = Number(v.lowStockThreshold || 5);

      return `
        <tr id="matrix-row-${v.variantId}">
          <td>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="preset-chip-swatch" style="background:${v.colorCode || '#8B1A4A'}"></span>
              <span style="font-weight:600;color:#fff">${v.color}</span>
            </div>
          </td>
          <td><span style="font-weight:600;color:#FFE082">${v.size}</span></td>
          <td>
            <input type="text" value="${v.sku || ''}" onchange="SellerVariants.updateVariantField('${v.variantId}', 'sku', this.value)">
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:4px;">
              <button type="button" class="btn btn-ghost btn-xs" onclick="SellerVariants.changeVariantQty('${v.variantId}', -1)" style="padding:2px 6px;">&minus;</button>
              <input type="number" value="${q}" min="0" oninput="SellerVariants.onVariantQuantityChange('${v.variantId}', this.value)" style="width:55px;">
              <button type="button" class="btn btn-ghost btn-xs" onclick="SellerVariants.changeVariantQty('${v.variantId}', 1)" style="padding:2px 6px;">+</button>
            </div>
          </td>
          <td><span style="color:var(--text-dim)">${res}</span></td>
          <td>
            <span id="avail-${v.variantId}" style="font-weight:700;color:${avail > 0 ? '#4CAF50' : '#EF5350'}">${avail}</span>
          </td>
          <td>
            <input type="number" value="${thresh}" min="1" onchange="SellerVariants.updateVariantField('${v.variantId}', 'lowStockThreshold', parseInt(this.value)||5)" style="width:55px;">
          </td>
          <td>
            <input type="number" placeholder="Optional" value="${v.price || ''}" onchange="SellerVariants.updateVariantField('${v.variantId}', 'price', parseFloat(this.value)||null)" style="width:75px;">
          </td>
          <td style="text-align:center">
            <input type="checkbox" ${v.active !== false ? 'checked' : ''} onchange="SellerVariants.updateVariantField('${v.variantId}', 'active', this.checked)" style="accent-color:#8B1A4A;width:16px;height:16px;">
          </td>
          <td style="text-align:center">
            <button type="button" class="btn btn-danger btn-xs" onclick="SellerVariants.removeVariantRow('${v.variantId}')" title="Delete variant">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  onVariantQuantityChange(variantId, val) {
    const q = Math.max(0, parseInt(val) || 0);
    const v = this.variants.find(x => x.variantId === variantId);
    if (v) {
      v.quantity = q;
      v.availableQuantity = Math.max(0, q - (v.reservedQuantity || 0));
      const thresh = v.lowStockThreshold || 5;
      v.status = q <= 0 ? 'out_of_stock' : (q <= thresh ? 'low_stock' : 'in_stock');
      const availEl = document.getElementById(`avail-${variantId}`);
      if (availEl) {
        availEl.textContent = v.availableQuantity;
        availEl.style.color = v.availableQuantity > 0 ? '#4CAF50' : '#EF5350';
      }
    }
    this.recalculateTotalStock();
    SellerWizard.updateQualityScore();
  },

  changeVariantQty(variantId, delta) {
    const v = this.variants.find(x => x.variantId === variantId);
    if (v) {
      const newQty = Math.max(0, (v.quantity || 0) + delta);
      const row = document.getElementById(`matrix-row-${variantId}`);
      if (row) {
        const inp = row.querySelector('input[type="number"]');
        if (inp) inp.value = newQty;
      }
      this.onVariantQuantityChange(variantId, newQty);
    }
  },

  updateVariantField(variantId, field, val) {
    const v = this.variants.find(x => x.variantId === variantId);
    if (v) {
      v[field] = val;
    }
  },

  removeVariantRow(variantId) {
    this.variants = this.variants.filter(v => v.variantId !== variantId);
    this.renderMatrixTable();
    this.recalculateTotalStock();
  },

  addEmptyVariantRow() {
    const variantId = `var_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.variants.push({
      variantId,
      sku: 'NN-CUSTOM',
      color: 'Custom',
      colorCode: '#8B1A4A',
      size: 'Free Size',
      quantity: 10,
      reservedQuantity: 0,
      availableQuantity: 10,
      lowStockThreshold: 5,
      price: null,
      active: true,
      status: 'in_stock'
    });
    this.renderMatrixTable();
    this.recalculateTotalStock();
  },

  applyBulkStock() {
    const input = document.getElementById('bulk-stock-val');
    const val = parseInt(input?.value);
    if (isNaN(val) || val < 0) {
      SellerToast.show('Enter a valid stock quantity.', 'warning');
      return;
    }
    this.variants.forEach(v => {
      v.quantity = val;
      v.availableQuantity = Math.max(0, val - (v.reservedQuantity || 0));
      v.status = val <= 0 ? 'out_of_stock' : (val <= (v.lowStockThreshold || 5) ? 'low_stock' : 'in_stock');
    });
    this.renderMatrixTable();
    this.recalculateTotalStock();
    SellerToast.show(`Set stock = ${val} across all ${this.variants.length} variants!`, 'success');
  },

  applyBulkThreshold() {
    const input = document.getElementById('bulk-threshold-val');
    const val = parseInt(input?.value);
    if (isNaN(val) || val < 1) {
      SellerToast.show('Enter a valid threshold >= 1.', 'warning');
      return;
    }
    this.variants.forEach(v => {
      v.lowStockThreshold = val;
      v.status = v.quantity <= 0 ? 'out_of_stock' : (v.quantity <= val ? 'low_stock' : 'in_stock');
    });
    this.renderMatrixTable();
    SellerToast.show(`Low stock alert threshold set to ${val}!`, 'success');
  },

  autoGenerateSkus() {
    const cat = document.getElementById('p-category')?.value || 'ETH';
    const cleanCat = cat.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'CAT';

    this.variants.forEach(v => {
      const cleanCol = (v.color || 'STD').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
      const cleanSz = (v.size || 'FS').split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      v.sku = `NN-${cleanCat}-${cleanCol}-${cleanSz}`;
    });

    this.renderMatrixTable();
    SellerToast.show('Generated clean SKUs for all variants! 🏷️', 'success');
  },

  recalculateTotalStock() {
    let total = 0;
    if (this.productType === 'single') {
      total = parseInt(document.getElementById('p-stock')?.value) || 0;
    } else {
      total = this.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
      const stockInp = document.getElementById('p-stock');
      if (stockInp) stockInp.value = total;
    }

    const pill = document.getElementById('live-total-stock-display');
    if (pill) pill.textContent = total;
    return total;
  },

  collectVariantsData() {
    if (this.productType === 'single') {
      return [];
    }
    return this.variants.map(v => ({
      variantId: v.variantId,
      sku: v.sku || null,
      size: v.size || '',
      color: v.color || '',
      colorCode: v.colorCode || null,
      quantity: Number(v.quantity || 0),
      reservedQuantity: Number(v.reservedQuantity || 0),
      availableQuantity: Math.max(0, Number(v.quantity || 0) - Number(v.reservedQuantity || 0)),
      lowStockThreshold: Number(v.lowStockThreshold || 5),
      price: v.price ? Number(v.price) : null,
      active: v.active !== false,
      status: v.quantity <= 0 ? 'out_of_stock' : (v.quantity <= (v.lowStockThreshold || 5) ? 'low_stock' : 'in_stock')
    }));
  },

  populateFromProduct(p) {
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      this.productType = p.productType || 'size_color';
      this.variants = p.variants.map(v => ({
        ...v,
        quantity: Number(v.quantity || 0),
        reservedQuantity: Number(v.reservedQuantity || 0),
        availableQuantity: Number(v.availableQuantity !== undefined ? v.availableQuantity : v.quantity || 0),
        lowStockThreshold: Number(v.lowStockThreshold || 5),
        active: v.active !== false
      }));

      const colMap = new Map();
      const szSet = new Set();
      this.variants.forEach(v => {
        if (v.color && v.color !== 'Standard') colMap.set(v.color, v.colorCode || '#8B1A4A');
        if (v.size && v.size !== 'Free Size') szSet.add(v.size);
      });

      this.selectedColors = Array.from(colMap.entries()).map(([name, hex]) => ({ name, hex }));
      this.selectedSizes = Array.from(szSet);
    } else {
      this.productType = 'single';
      this.variants = [];
      this.selectedColors = [];
      this.selectedSizes = [];
      const stockInp = document.getElementById('p-stock');
      if (stockInp) stockInp.value = p.stock || 0;
      const skuInp = document.getElementById('p-single-sku');
      if (skuInp) skuInp.value = p.sku || '';
    }

    this.init();
    this.renderMatrixTable();
    this.recalculateTotalStock();
  }
};

// ─── 6-STEP WIZARD CONTROLLER ──────────────────────────────
const SellerWizard = {
  currentStep: 1,
  selectedStyle: 'signature',
  currentSuggestions: {},
  autosaveTimer: null,

  SUBCATEGORIES: {
    'Sarees': [
      'Banarasi Silk', 'Kanjivaram Silk', 'Chanderi', 'Georgette', 'Chiffon',
      'Organza', 'Cotton Handloom', 'Tussar Silk', 'Bandhani & Leheriya',
      'Paithani', 'Patola', 'Linen Silk', 'Dola Silk', 'Kalamkari',
      'Ready-to-wear / Pre-draped', 'Net & Tissue', 'Partywear Silk'
    ],
    'Suits': [
      'Anarkali Suits', 'Straight Kurta Set', 'Sharara & Gharara Sets',
      'Palazzo Suit Sets', 'Churidar Sets', 'Patiala Suits', 'Angrakha Suits',
      'Unstitched Dress Material', 'Velvet Suits', 'Kaftan Sets', 'Embroidered Salwar Suit'
    ],
    'Lehengas': [
      'Bridal Lehengas', 'Partywear Lehengas', 'Floral Lehengas', 'Crop Top & Skirt',
      'Semi-Stitched Lehengas', 'Velvet Lehengas', 'Mirror Work Lehengas',
      'Silk & Brocade Lehengas', 'Cocktail Lehengas'
    ],
    'Kurtas': [
      'A-line Kurti', 'Straight Kurta', 'Flared Anarkali Kurta', 'Short Kurti',
      'Kurta with Pants / Dupatta', 'Tunic / Daily Wear', 'Embroidered Festive Kurti',
      'Cotton Handloom Kurti'
    ],
    'Western': [
      'Ethnic Gowns', 'Co-ord Sets', 'Draped Sarees', 'Jumpsuits', 'Maxi Dresses',
      'Indo-Western Fusion', 'Shrug & Jacket Sets', 'Cape Outfits', 'Peplum Sets'
    ],
    'Accessories': [
      'Dupattas & Shawls', 'Phulkari Dupattas', 'Banarasi Silk Dupattas',
      'Potli Bags & Clutches', 'Embroidered Belts', 'Mojaris & Juttis', 'Bangles & Kadas'
    ],
    'Jewellery': [
      'Necklace Sets', 'Kundan Jewellery', 'Temple Jewellery', 'Polki Sets',
      'Jhumkas & Earrings', 'Maang Tikka & Passa', 'Bangles / Chooda', 'Nose Rings / Nath', 'Anklets / Payal'
    ]
  },

  init() {
    this.renderStyleSelector();
    SellerVariants.init();
    this.startAutosave();
  },

  startAutosave() {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    this.autosaveTimer = setInterval(() => {
      this.autosaveDraft();
    }, 30000);
  },

  goToStep(step) {
    if (step > this.currentStep) {
      if (this.currentStep === 1 && !this.validateStep1()) return;
      if (this.currentStep === 2 && !this.validateStep2()) return;
      if (this.currentStep === 3 && !this.validateStep3()) return;
      if (this.currentStep === 4 && !this.validateStep4()) return;
      if (this.currentStep === 5 && !this.validateStep5()) return;
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

    const progress = ((step - 1) / 5) * 100;
    const bar = document.getElementById('wizard-progress-bar');
    if (bar) bar.style.width = `${progress}%`;

    const prevBtn = document.getElementById('btn-wizard-prev');
    const nextBtn = document.getElementById('btn-wizard-next');
    const pubBtn  = document.getElementById('btn-wizard-publish');

    if (prevBtn) prevBtn.style.display = (step > 1) ? 'inline-flex' : 'none';
    if (nextBtn) nextBtn.style.display = (step < 6) ? 'inline-flex' : 'none';
    if (pubBtn)  pubBtn.style.display  = (step === 6) ? 'inline-flex' : 'none';

    if (step === 6) {
      this.renderPreview();
      this.renderChecklist();
    }

    this.updateQualityScore();
    this.autosaveDraft();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  nextStep() {
    if (this.currentStep < 6) {
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
    const cat  = document.getElementById('p-category')?.value;

    if (!name || name.length < 3) {
      SellerToast.show('Please enter a product title (at least 3 characters).', 'warning');
      document.getElementById('p-name')?.focus();
      return false;
    }
    if (!cat) {
      SellerToast.show('Please select a main category.', 'warning');
      document.getElementById('p-category')?.focus();
      return false;
    }
    if (cat === '__other__') {
      const customCat = document.getElementById('p-category-custom')?.value.trim();
      if (!customCat) {
        SellerToast.show('Please type your custom category name.', 'warning');
        document.getElementById('p-category-custom')?.focus();
        return false;
      }
    }
    const subSel = document.getElementById('p-subcategory');
    if (subSel && subSel.value === '__custom_sub__') {
      const customSub = document.getElementById('p-subcategory-custom')?.value.trim();
      if (!customSub) {
        SellerToast.show('Please type your custom subcategory.', 'warning');
        document.getElementById('p-subcategory-custom')?.focus();
        return false;
      }
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
    if (SellerVariants.productType === 'single') {
      const stock = parseInt(document.getElementById('p-stock')?.value);
      if (isNaN(stock) || stock < 0) {
        SellerToast.show('Please enter valid stock quantity.', 'warning');
        document.getElementById('p-stock')?.focus();
        return false;
      }
    } else {
      if (!SellerVariants.variants.length) {
        SellerToast.show('Please generate or add at least 1 variant row.', 'warning');
        return false;
      }
      const totalStock = SellerVariants.recalculateTotalStock();
      if (totalStock <= 0) {
        SellerToast.show('Total stock across variants must be greater than 0.', 'warning');
        return false;
      }
    }
    return true;
  },

  validateStep4() {
    const price = parseFloat(document.getElementById('p-price')?.value);
    const salePrice = parseFloat(document.getElementById('p-sale-price')?.value);

    if (!price || price <= 0) {
      SellerToast.show('Please enter a valid MRP price greater than 0.', 'warning');
      document.getElementById('p-price')?.focus();
      return false;
    }
    if (!salePrice || salePrice <= 0) {
      SellerToast.show('Please enter a valid selling price greater than 0.', 'warning');
      document.getElementById('p-sale-price')?.focus();
      return false;
    }
    if (salePrice > price) {
      SellerToast.show('Selling price cannot be greater than MRP price.', 'error');
      document.getElementById('p-sale-price')?.focus();
      return false;
    }
    return true;
  },

  validateStep5() {
    const weight = parseFloat(document.getElementById('p-weight')?.value);
    if (!weight || weight <= 0) {
      SellerToast.show('Please enter a valid package weight (kg).', 'warning');
      document.getElementById('p-weight')?.focus();
      return false;
    }
    return true;
  },

  onPriceChange() {
    const mrp  = parseFloat(document.getElementById('p-price')?.value) || 0;
    const sale = parseFloat(document.getElementById('p-sale-price')?.value) || 0;
    const discEl = document.getElementById('p-discount-pct');

    if (mrp > 0 && sale > 0 && sale <= mrp) {
      const disc = Math.round(((mrp - sale) / mrp) * 100);
      if (discEl) discEl.value = `${disc}% OFF`;
    } else {
      if (discEl) discEl.value = '0%';
    }
    this.updateQualityScore();
  },

  onCategoryChange(val) {
    const custom = document.getElementById('p-category-custom-wrap');
    const subSel = document.getElementById('p-subcategory');
    const subCustomWrap = document.getElementById('p-subcategory-custom-wrap');
    const quickChips = document.getElementById('p-subcategory-quick-chips');

    if (val === '__other__') {
      if (custom) custom.style.display = 'block';
      if (subCustomWrap) subCustomWrap.style.display = 'block';
    } else {
      if (custom) custom.style.display = 'none';
      if (subCustomWrap) subCustomWrap.style.display = 'none';
    }

    if (subSel) {
      const list = this.SUBCATEGORIES[val] || [];
      let optionsHtml = `<option value="">Select Subcategory…</option>`;
      list.forEach(s => {
        optionsHtml += `<option value="${s}">${s}</option>`;
      });
      optionsHtml += `<option value="__custom_sub__">✏️ Other Subcategory (Type custom)…</option>`;
      subSel.innerHTML = optionsHtml;

      // Render quick subcategory chips
      if (quickChips) {
        if (list.length > 0) {
          quickChips.innerHTML = list.slice(0, 12).map(s => `
            <span class="subcat-quick-chip" data-subcat="${s}" onclick="SellerWizard.selectSubcategoryChip('${s.replace(/'/g, "\\'")}')">
              ${s}
            </span>
          `).join('');
        } else {
          quickChips.innerHTML = '';
        }
      }
    }

    this.updateQualityScore();
  },

  onSubcategoryChange(val) {
    const customWrap = document.getElementById('p-subcategory-custom-wrap');
    if (val === '__custom_sub__') {
      if (customWrap) {
        customWrap.style.display = 'block';
        document.getElementById('p-subcategory-custom')?.focus();
      }
    } else {
      if (customWrap && document.getElementById('p-category')?.value !== '__other__') {
        customWrap.style.display = 'none';
      }
    }

    // Highlight matching chip if available
    document.querySelectorAll('.subcat-quick-chip').forEach(chip => {
      if (chip.dataset.subcat === val) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    this.updateQualityScore();
  },

  selectSubcategoryChip(subcat) {
    const sel = document.getElementById('p-subcategory');
    const customWrap = document.getElementById('p-subcategory-custom-wrap');
    if (sel) {
      let found = false;
      for (let opt of sel.options) {
        if (opt.value === subcat) {
          sel.value = subcat;
          found = true;
          break;
        }
      }
      if (!found) {
        const newOpt = new Option(subcat, subcat, true, true);
        sel.add(newOpt, sel.options[sel.options.length - 1]);
        sel.value = subcat;
      }
    }
    if (customWrap && document.getElementById('p-category')?.value !== '__other__') {
      customWrap.style.display = 'none';
    }
    this.onSubcategoryChange(subcat);
  },

  toggleCustomSubcategory() {
    const customWrap = document.getElementById('p-subcategory-custom-wrap');
    const sel = document.getElementById('p-subcategory');
    if (customWrap) {
      const isVisible = customWrap.style.display === 'block';
      customWrap.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        if (sel) sel.value = '__custom_sub__';
        document.getElementById('p-subcategory-custom')?.focus();
      }
    }
  },

  generateSlug() {
    const title = document.getElementById('p-name')?.value.trim() || '';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slugEl = document.getElementById('p-slug');
    if (slugEl) slugEl.value = slug;
  },

  updateQualityScore() {
    let score = 0;
    const name = document.getElementById('p-name')?.value.trim();
    const cat  = document.getElementById('p-category')?.value;
    const price = document.getElementById('p-price')?.value;
    const salePrice = document.getElementById('p-sale-price')?.value;
    const fabric = document.getElementById('p-fabric')?.value.trim();
    const desc   = document.getElementById('p-desc')?.value.trim();
    const imgCount = SellerProducts.imageURLs.length + SellerProducts.imageFiles.length;
    const variantCount = SellerVariants.variants.length;

    if (name && name.length > 5) score += 20;
    if (cat) score += 15;
    if (price && parseFloat(price) > 0) score += 10;
    if (salePrice && parseFloat(salePrice) > 0) score += 10;
    if (imgCount >= 1) score += 15;
    if (imgCount >= 3) score += 5;
    if (fabric) score += 10;
    if (desc && desc.length > 30) score += 10;
    if (variantCount >= 1) score += 5;

    score = Math.min(100, score);
    const scoreVal  = document.getElementById('quality-score-val');
    const scoreFill = document.getElementById('quality-score-fill');
    const scoreTip  = document.getElementById('quality-score-tip');

    if (scoreVal)  scoreVal.textContent = `${score}%`;
    if (scoreFill) scoreFill.style.width = `${score}%`;
    if (scoreTip) {
      if (score < 40) scoreTip.textContent = '— Add photos & material details for better buyer visibility';
      else if (score < 80) scoreTip.textContent = '— Great progress! Generate AI description & fill occasion';
      else scoreTip.textContent = '— Excellent! Your product listing is primed to sell';
    }
  },

  onTitleChange() {
    this.updateQualityScore();
    const title = document.getElementById('p-name')?.value.trim();
    if (!title || title.length < 3 || typeof SellerAI === 'undefined') {
      const box = document.getElementById('ai-suggestions-box');
      if (box) box.style.display = 'none';
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
      html += `<div class="ai-chip" onclick="SellerWizard.applySuggestion('fabric', '${suggestions.fabric}')">Fabric: <strong>${suggestions.fabric}</strong> [Apply]</div>`;
    }
    if (suggestions.occasion && !document.getElementById('p-occasion').value) {
      html += `<div class="ai-chip" onclick="SellerWizard.applySuggestion('occasion', '${suggestions.occasion}')">Occasion: <strong>${suggestions.occasion}</strong> [Apply]</div>`;
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
      this.onCategoryChange(val);
    } else if (field === 'fabric') {
      document.getElementById('p-fabric').value = val;
    } else if (field === 'occasion') {
      document.getElementById('p-occasion').value = val;
    }
    SellerToast.show(`Applied ${field}: ${val}`, 'success');
    this.onTitleChange();
  },

  acceptAllSuggestions() {
    if (this.currentSuggestions.category) {
      document.getElementById('p-category').value = this.currentSuggestions.category;
      this.onCategoryChange(this.currentSuggestions.category);
    }
    if (this.currentSuggestions.fabric) document.getElementById('p-fabric').value = this.currentSuggestions.fabric;
    if (this.currentSuggestions.occasion) document.getElementById('p-occasion').value = this.currentSuggestions.occasion;
    const box = document.getElementById('ai-suggestions-box');
    if (box) box.style.display = 'none';
    SellerToast.show('All AI suggestions applied! ✨', 'success');
    this.updateQualityScore();
  },

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

  openAiDescModal() {
    const modal = document.getElementById('modal-ai-desc');
    if (modal) {
      this.renderStyleSelector();
      modal.classList.add('open');
    }
  },

  closeAiDescModal() {
    const modal = document.getElementById('modal-ai-desc');
    if (modal) modal.classList.remove('open');
  },

  generatedCopyTemp: null,

  generateAiDescription() {
    const name = document.getElementById('p-name')?.value.trim();
    const cat  = document.getElementById('p-category')?.value;
    const subcat = document.getElementById('p-subcategory')?.value;
    const fab  = document.getElementById('p-fabric')?.value.trim();
    const occ  = document.getElementById('p-occasion')?.value;
    const colors = SellerVariants.selectedColors.map(c => c.name);

    if (!name) {
      SellerToast.show('Please enter a product title first.', 'warning');
      return;
    }

    const btn = document.getElementById('btn-modal-ai-gen');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '✨ Crafting Description with AI...';
    }

    setTimeout(() => {
      try {
        const res = SellerAI.generateListingCopy({
          name, category: cat, subcategory: subcat, fabric: fab, occasion: occ, colors
        }, this.selectedStyle);

        this.generatedCopyTemp = res;

        const prevBox = document.getElementById('ai-modal-preview-box');
        const prevTxt = document.getElementById('ai-modal-preview-text');
        const applyBtn = document.getElementById('btn-modal-ai-apply');

        if (prevBox && prevTxt) {
          prevTxt.textContent = `${res.shortDescription}\n\n${res.description}\n\nHighlights:\n${res.highlights.map(h => '• ' + h).join('\n')}`;
          prevBox.style.display = 'block';
        }
        if (applyBtn) applyBtn.style.display = 'inline-flex';

        SellerToast.show('Boutique description crafted! Click "Use This Copy".', 'success');
      } catch (err) {
        console.error('AI copy error:', err);
        SellerToast.show('Generation error: ' + err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '✨ Regenerate Description';
        }
      }
    }, 350);
  },

  applyAiGeneratedCopy() {
    if (!this.generatedCopyTemp) return;
    const res = this.generatedCopyTemp;

    const shortEl = document.getElementById('p-short-desc');
    const descEl  = document.getElementById('p-desc');
    const tagEl   = document.getElementById('p-tags');

    if (shortEl) shortEl.value = res.shortDescription || '';
    if (descEl)  descEl.value  = res.description || '';
    if (tagEl && (!tagEl.value || tagEl.value.length < 5)) {
      tagEl.value = res.tags.join(', ');
    }

    this.closeAiDescModal();
    this.updateQualityScore();
    SellerToast.show('AI Description and Highlights applied to listing! ✨', 'success');
  },

  async analyzeMainImage() {
    const totalImgs = SellerProducts.imageURLs.length + SellerProducts.imageFiles.length;
    if (totalImgs === 0) {
      SellerToast.show('Please upload a product photo first to analyze.', 'warning');
      return;
    }

    const btn = document.getElementById('btn-ai-analyze-img');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '✨ Analyzing Photo with Gemini...';
    }

    let imageSrc = SellerProducts.imageURLs[0] || null;
    if (!imageSrc && SellerProducts.imageFiles[0]) {
      imageSrc = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(SellerProducts.imageFiles[0]);
      });
    }

    try {
      const res = await SellerAI.analyzeImage(imageSrc);
      if (res.data) {
        const nameInput = document.getElementById('p-name');
        const catInput  = document.getElementById('p-category');
        const fabInput  = document.getElementById('p-fabric');
        const priceInput = document.getElementById('p-price');
        const saleInput  = document.getElementById('p-sale-price');
        const descInput  = document.getElementById('p-desc');

        if (nameInput && (!nameInput.value || nameInput.value.length < 5)) nameInput.value = res.data.name || '';
        if (catInput && res.data.category) {
          catInput.value = res.data.category;
          this.onCategoryChange(res.data.category);
        }
        if (fabInput && res.data.fabric) fabInput.value = res.data.fabric;
        if (priceInput && (!priceInput.value || priceInput.value == '0')) priceInput.value = res.data.suggestedPrice || 3499;
        if (saleInput && (!saleInput.value || saleInput.value == '0')) saleInput.value = res.data.salePrice || 2499;
        if (descInput && (!descInput.value || descInput.value.length < 10)) descInput.value = res.data.description || '';
      }
      this.onPriceChange();
      SellerToast.show('Photo analyzed by Gemini AI! Details populated.', 'success');
    } catch (e) {
      SellerToast.show('Photo analysis completed with fallback suggestions.', 'info');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✨ Re-Analyze Photo with AI';
      }
    }
  },

  renderPreview() {
    const previewBox = document.getElementById('customer-preview-mock');
    if (!previewBox) return;

    const name = document.getElementById('p-name')?.value.trim() || 'Untitled Ethnic Outfit';
    const cat  = document.getElementById('p-category')?.value || 'Ethnic Wear';
    const subcat = document.getElementById('p-subcategory')?.value || '';
    const mrp  = parseFloat(document.getElementById('p-price')?.value) || 0;
    const salePrice = parseFloat(document.getElementById('p-sale-price')?.value) || mrp;
    const totalStock = SellerVariants.recalculateTotalStock();
    const shortDesc = document.getElementById('p-short-desc')?.value.trim();
    const fullDesc  = document.getElementById('p-desc')?.value.trim() || 'Exquisite Indian ethnic wear handcrafted for festive grace.';
    const fabric = document.getElementById('p-fabric')?.value.trim() || '';
    const occ    = document.getElementById('p-occasion')?.value || '';

    const mainImgUrl = SellerProducts.imageURLs[0] ||
      (SellerProducts.imageFiles[0] ? URL.createObjectURL(SellerProducts.imageFiles[0]) : 'https://placehold.co/320x420/1A1225/D4AF37?text=No+Photo');

    const discPercent = (mrp > salePrice && mrp > 0) ? Math.round(((mrp - salePrice) / mrp) * 100) : 0;

    const colorsList = SellerVariants.selectedColors.length > 0
      ? SellerVariants.selectedColors
      : [{ name: 'Standard', hex: '#8B1A4A' }];

    const sizesList = SellerVariants.selectedSizes.length > 0
      ? SellerVariants.selectedSizes
      : ['Free Size'];

    previewBox.innerHTML = `
      <div class="preview-img-box">
        <img src="${mainImgUrl}" alt="${name}">
        ${discPercent > 0 ? `<div style="position:absolute;top:10px;left:10px;background:#2E7D32;color:#fff;font-size:0.75rem;font-weight:800;padding:2px 8px;border-radius:4px;">${discPercent}% OFF</div>` : ''}
      </div>

      <div class="preview-details-box">
        <div style="font-size:0.78rem;color:#8B1A4A;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.2rem;">${subcat || cat}</div>
        <h2 class="preview-prod-title">${name}</h2>

        <div class="preview-price-row">
          <span class="preview-sale-price">₹${Number(salePrice).toLocaleString('en-IN')}</span>
          ${mrp > salePrice ? `<span class="preview-mrp">₹${Number(mrp).toLocaleString('en-IN')}</span>` : ''}
          ${discPercent > 0 ? `<span class="preview-disc-badge">${discPercent}% OFF</span>` : ''}
        </div>

        <div id="preview-stock-badge" style="font-size:0.85rem;color:${totalStock > 0 ? '#15803D' : '#c62828'};font-weight:700;margin-bottom:0.75rem;">
          ${totalStock > 10 ? `✓ In Stock (${totalStock} available across variants)` : totalStock > 0 ? `⚠️ Only ${totalStock} left in stock!` : '✕ Out of Stock'}
        </div>

        <!-- Interactive Color Swatches Mock -->
        <div style="margin-bottom:0.75rem;">
          <div style="font-size:0.78rem;font-weight:700;color:#FFE082;margin-bottom:0.3rem;">Color:</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${colorsList.map((c, i) => `
              <div style="width:24px;height:24px;border-radius:50%;background:${c.hex};border:2px solid ${i === 0 ? '#FFE082' : 'rgba(255,255,255,0.4)'}" title="${c.name}"></div>
            `).join('')}
          </div>
        </div>

        <!-- Interactive Size Buttons Mock -->
        <div style="margin-bottom:0.75rem;">
          <div style="font-size:0.78rem;font-weight:700;color:#FFE082;margin-bottom:0.3rem;">Size:</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${sizesList.map((s, i) => `
              <span style="font-size:0.75rem;padding:3px 8px;border-radius:4px;border:1px solid ${i === 0 ? '#D4AF37' : 'rgba(255,255,255,0.2)'};background:${i === 0 ? 'rgba(212,175,55,0.2)' : 'transparent'};color:${i === 0 ? '#FFE082' : '#ECE0E6'}">${s}</span>
            `).join('')}
          </div>
        </div>

        ${shortDesc ? `<p style="font-size:0.84rem;font-style:italic;color:#666;margin-bottom:0.75rem;">"${shortDesc}"</p>` : ''}
        <div class="preview-desc-text">${fullDesc}</div>

        <div style="margin-top:0.75rem;font-size:0.78rem;color:#777;display:flex;gap:15px;flex-wrap:wrap;">
          ${fabric ? `<span><strong>Fabric:</strong> ${fabric}</span>` : ''}
          ${occ ? `<span><strong>Occasion:</strong> ${occ}</span>` : ''}
          <span>🚚 <strong>Delivery:</strong> 3-5 days</span>
        </div>
      </div>
    `;
  },

  renderChecklist() {
    const listEl = document.getElementById('publish-checklist-items');
    const badgeEl = document.getElementById('checklist-summary-badge');
    if (!listEl) return;

    const name = document.getElementById('p-name')?.value.trim();
    const cat  = document.getElementById('p-category')?.value;
    const mrp  = parseFloat(document.getElementById('p-price')?.value) || 0;
    const sale = parseFloat(document.getElementById('p-sale-price')?.value) || 0;
    const totalImgs = SellerProducts.imageURLs.length + SellerProducts.imageFiles.length;
    const totalStock = SellerVariants.recalculateTotalStock();
    const weight = parseFloat(document.getElementById('p-weight')?.value) || 0;

    const checks = [
      { label: 'Product Title specified (min 5 characters)', pass: Boolean(name && name.length >= 5) },
      { label: 'Category & Subcategory chosen', pass: Boolean(cat) },
      { label: 'At least 1 product photo uploaded', pass: totalImgs >= 1 },
      { label: 'Valid MRP and Selling Price (Selling <= MRP)', pass: Boolean(mrp > 0 && sale > 0 && sale <= mrp) },
      { label: 'Variant stock configured and > 0', pass: totalStock > 0 },
      { label: 'Shipping weight & dimensions specified', pass: weight > 0 }
    ];

    const allPassed = checks.every(c => c.pass);

    listEl.innerHTML = checks.map(c => `
      <div class="checklist-item ${c.pass ? 'pass' : 'fail'}">
        <span class="check-icon">${c.pass ? '✅' : '❌'}</span>
        <span>${c.label}</span>
      </div>
    `).join('');

    if (badgeEl) {
      badgeEl.textContent = allPassed ? 'All criteria met ✓' : 'Incomplete items found';
      badgeEl.style.color = allPassed ? '#81C784' : '#EF5350';
      badgeEl.style.background = allPassed ? 'rgba(46,125,50,0.2)' : 'rgba(244,67,54,0.2)';
    }

    const pubBtn = document.getElementById('btn-wizard-publish');
    if (pubBtn) {
      pubBtn.disabled = !allPassed;
      if (!allPassed) pubBtn.title = 'Complete all checklist items before publishing';
      else pubBtn.removeAttribute('title');
    }
  },

  autosaveDraft() {
    try {
      const draft = {
        name: document.getElementById('p-name')?.value || '',
        category: document.getElementById('p-category')?.value || '',
        subcategory: document.getElementById('p-subcategory')?.value || '',
        brand: document.getElementById('p-brand')?.value || '',
        slug: document.getElementById('p-slug')?.value || '',
        shortDesc: document.getElementById('p-short-desc')?.value || '',
        desc: document.getElementById('p-desc')?.value || '',
        tags: document.getElementById('p-tags')?.value || '',
        price: document.getElementById('p-price')?.value || '',
        salePrice: document.getElementById('p-sale-price')?.value || '',
        fabric: document.getElementById('p-fabric')?.value || '',
        occasion: document.getElementById('p-occasion')?.value || '',
        work: document.getElementById('p-work')?.value || '',
        pattern: document.getElementById('p-pattern')?.value || '',
        stitch: document.getElementById('p-stitch')?.value || '',
        neckline: document.getElementById('p-neckline')?.value || '',
        care: document.getElementById('p-care')?.value || '',
        weight: document.getElementById('p-weight')?.value || '',
        variants: SellerVariants.variants,
        selectedColors: SellerVariants.selectedColors,
        selectedSizes: SellerVariants.selectedSizes,
        productType: SellerVariants.productType,
        savedAt: new Date().toLocaleTimeString()
      };
      localStorage.setItem('nari_seller_wizard_draft', JSON.stringify(draft));

      const pill = document.getElementById('autosave-status-pill');
      if (pill) {
        pill.textContent = `💾 Autosaved ${draft.savedAt}`;
      }
    } catch (e) {
      // ignore storage quota error
    }
  },

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

  onFilterCategoryChange(cat) {
    const subSel = document.getElementById('product-subcat-filter');
    if (subSel) {
      if (cat && SellerWizard.SUBCATEGORIES[cat]) {
        const list = SellerWizard.SUBCATEGORIES[cat];
        subSel.innerHTML = `<option value="">All Subcategories</option>` +
          list.map(s => `<option value="${s}">${s}</option>`).join('');
        subSel.style.display = 'inline-block';
      } else {
        subSel.innerHTML = `<option value="">All Subcategories</option>`;
        subSel.style.display = 'none';
        subSel.value = '';
      }
    }
    this.filter();
  },

  filter() {
    const q      = document.getElementById('product-search')?.value.toLowerCase() || '';
    const cat    = document.getElementById('product-cat-filter')?.value || '';
    const subcat = document.getElementById('product-subcat-filter')?.value || '';
    const stat   = document.getElementById('product-status-filter')?.value || '';
    const filtered = this.allProducts.filter(p => {
      const matchQ   = !q   || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || (p.subcategory || '').toLowerCase().includes(q);
      const matchCat = !cat || p.category === cat;
      const matchSub = !subcat || p.subcategory === subcat;
      const matchSt  = !stat || (stat === 'active' ? p.active !== false : p.active === false);
      return matchQ && matchCat && matchSub && matchSt;
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
            <img class="product-thumb" src="${p.thumbnail || (typeof p.images?.[0] === 'object' ? p.images[0].thumbnail : (p.imageUrl || p.images?.[0] || 'https://placehold.co/44x54/1A1225/D4AF37?text=P'))}" alt="${p.name || ''}" loading="lazy" width="44" height="54" onerror="this.src='https://placehold.co/44x54/1A1225/D4AF37?text=P'">
            <div class="product-cell-info">
              <div class="product-cell-name">${p.name || '—'}</div>
              <div class="product-cell-cat">${p.sku || ''}</div>
            </div>
          </div>
        </td>
        <td class="td-muted">
          <div style="font-weight:600;color:var(--text)">${p.category || '—'}</div>
          ${p.subcategory ? `<div style="font-size:0.75rem;color:var(--accent);font-weight:600;margin-top:2px;">${p.subcategory}</div>` : ''}
        </td>
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
    ['p-name', 'p-brand', 'p-slug', 'p-fabric', 'p-desc', 'p-short-desc', 'p-highlights', 'p-tags', 'p-price', 'p-sale-price', 'p-stock', 'p-sku', 'p-single-sku', 'p-single-low-stock', 'p-color', 'p-sizes', 'p-weight', 'p-length', 'p-width', 'p-height', 'p-work', 'p-pattern', 'p-stitch', 'p-neckline', 'p-care'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (document.getElementById('p-category')) document.getElementById('p-category').value = '';
    if (document.getElementById('p-subcategory')) document.getElementById('p-subcategory').innerHTML = '<option value="">Select Subcategory…</option>';
    if (document.getElementById('p-occasion')) document.getElementById('p-occasion').value = '';
    if (document.getElementById('p-discount-pct')) document.getElementById('p-discount-pct').value = '0%';
    if (document.getElementById('p-weight')) document.getElementById('p-weight').value = '0.5';
    if (document.getElementById('p-length')) document.getElementById('p-length').value = '30';
    if (document.getElementById('p-width')) document.getElementById('p-width').value = '25';
    if (document.getElementById('p-height')) document.getElementById('p-height').value = '5';

    // Reset variants state
    SellerVariants.productType = 'size_color';
    SellerVariants.selectedColors = [];
    SellerVariants.selectedSizes = [];
    SellerVariants.variants = [];
    SellerVariants.init();
    SellerVariants.renderMatrixTable();
    SellerVariants.recalculateTotalStock();

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
    if (document.getElementById('p-brand')) document.getElementById('p-brand').value = p.brand || '';
    if (document.getElementById('p-slug'))  document.getElementById('p-slug').value  = p.slug || '';
    
    const catSelect = document.getElementById('p-category');
    const knownCats = ['Sarees','Suits','Lehengas','Kurtas','Western','Accessories','Jewellery'];
    if (p.category && !knownCats.includes(p.category)) {
      catSelect.value = '__other__';
      const wrap = document.getElementById('p-category-custom-wrap');
      if (wrap) wrap.style.display = 'block';
      const customEl = document.getElementById('p-category-custom');
      if (customEl) customEl.value = p.category;
    } else {
      catSelect.value = p.category || '';
    }

    SellerWizard.onCategoryChange(catSelect.value);
    if (p.subcategory) {
      const subSel = document.getElementById('p-subcategory');
      const subCustomWrap = document.getElementById('p-subcategory-custom-wrap');
      const subCustomInp = document.getElementById('p-subcategory-custom');
      let found = false;
      if (subSel) {
        for (let opt of subSel.options) {
          if (opt.value === p.subcategory) {
            subSel.value = p.subcategory;
            found = true;
            break;
          }
        }
        if (!found) {
          const customOpt = new Option(p.subcategory, p.subcategory, true, true);
          subSel.add(customOpt, subSel.options[subSel.options.length - 1]);
          subSel.value = p.subcategory;
          if (subCustomWrap) subCustomWrap.style.display = 'block';
          if (subCustomInp) subCustomInp.value = p.subcategory;
        }
      }
      SellerWizard.onSubcategoryChange(p.subcategory);
    }

    document.getElementById('p-fabric').value     = p.fabric || (p.attributes?.fabric || '');
    document.getElementById('p-desc').value       = p.description || '';
    if (document.getElementById('p-short-desc')) document.getElementById('p-short-desc').value = p.shortDescription || '';
    if (document.getElementById('p-highlights')) document.getElementById('p-highlights').value = (p.highlights || []).join('\n');
    document.getElementById('p-tags').value       = (p.tags || []).join(', ');
    document.getElementById('p-price').value      = p.price || (p.pricing?.mrp || '');
    document.getElementById('p-sale-price').value = p.salePrice || (p.pricing?.sellingPrice || '');
    SellerWizard.onPriceChange();

    document.getElementById('p-stock').value      = p.stock ?? '';
    document.getElementById('p-sku').value        = p.sku || '';
    document.getElementById('p-occasion').value   = p.occasion || (p.attributes?.occasion || '');

    if (document.getElementById('p-pattern')) document.getElementById('p-pattern').value = p.pattern || (p.attributes?.pattern || '');
    if (document.getElementById('p-work'))    document.getElementById('p-work').value    = p.work || (p.attributes?.work || '');
    if (document.getElementById('p-stitch'))  document.getElementById('p-stitch').value  = p.stitch || (p.attributes?.stitch || '');
    if (document.getElementById('p-neckline')) document.getElementById('p-neckline').value = p.neckline || (p.attributes?.neckline || '');
    if (document.getElementById('p-care'))    document.getElementById('p-care').value    = p.care || (p.attributes?.care || '');

    if (document.getElementById('p-weight')) document.getElementById('p-weight').value = p.shipping?.weight || 0.5;
    if (document.getElementById('p-length')) document.getElementById('p-length').value = p.shipping?.length || 30;
    if (document.getElementById('p-width'))  document.getElementById('p-width').value  = p.shipping?.width || 25;
    if (document.getElementById('p-height')) document.getElementById('p-height').value = p.shipping?.height || 5;
    const shipClassEl = document.getElementById('p-shipping-class') || document.getElementById('p-shipping-cat');
    if (shipClassEl && p.shipping?.shippingCategory) {
      shipClassEl.value = p.shipping.shippingCategory;
    }

    // Populate variant system
    SellerVariants.populateFromProduct(p);

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
    SellerWizard.onCategoryChange(p.category || '');
    if (p.subcategory) {
      const subSel = document.getElementById('p-subcategory');
      const subCustomWrap = document.getElementById('p-subcategory-custom-wrap');
      const subCustomInp = document.getElementById('p-subcategory-custom');
      let found = false;
      if (subSel) {
        for (let opt of subSel.options) {
          if (opt.value === p.subcategory) {
            subSel.value = p.subcategory;
            found = true;
            break;
          }
        }
        if (!found) {
          const customOpt = new Option(p.subcategory, p.subcategory, true, true);
          subSel.add(customOpt, subSel.options[subSel.options.length - 1]);
          subSel.value = p.subcategory;
          if (subCustomWrap) subCustomWrap.style.display = 'block';
          if (subCustomInp) subCustomInp.value = p.subcategory;
        }
      }
      SellerWizard.onSubcategoryChange(p.subcategory);
    }
    document.getElementById('p-fabric').value = p.fabric || '';
    document.getElementById('p-desc').value = p.description || '';
    if (document.getElementById('p-short-desc')) document.getElementById('p-short-desc').value = p.shortDescription || '';
    if (document.getElementById('p-highlights')) document.getElementById('p-highlights').value = (p.highlights || []).join('\n');
    document.getElementById('p-tags').value = (p.tags || []).join(', ');
    document.getElementById('p-price').value = p.price || '';
    document.getElementById('p-sale-price').value = p.salePrice || '';
    SellerWizard.onPriceChange();
    document.getElementById('p-occasion').value = p.occasion || '';

    // Populate variants clone
    SellerVariants.populateFromProduct(p);

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
    this.imageURLs.forEach((item, i) => {
      const url = (typeof item === 'object' && item) ? (item.thumbnail || item.medium || item.original || '') : item;
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

  async uploadImageToStorage(file, uid, productId, altName = 'Product') {
    // 1. Try server-side Sharp API first if online and token available
    try {
      const currentUser = firebase.auth().currentUser;
      if (currentUser && window.location.protocol.startsWith('http')) {
        const token = await currentUser.getIdToken();
        const formData = new FormData();
        formData.append('image', file);
        formData.append('productId', productId);
        formData.append('alt', altName);

        const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? 'http://localhost:8080'
          : 'https://nari-niketan-api-997712460310.asia-south1.run.app';

        const res = await fetch(`${apiBase}/api/images/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.image) {
            return json.image;
          }
        }
      }
    } catch (apiErr) {
      console.warn('Backend image processing fallback to direct storage:', apiErr);
    }

    // 2. Direct client-side multi-variant generation (Canvas WebP + Storage)
    const createVariantBlob = (file, targetWidth, quality = 0.82, format = 'image/webp') => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            let w = img.width, h = img.height;
            if (w > targetWidth) {
              h = Math.round(h * targetWidth / w);
              w = targetWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob((blob) => {
              resolve(blob || file);
            }, format, quality);
          };
          img.onerror = () => resolve(file);
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    };

    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const [thumbBlob, medBlob, origBlob] = await Promise.all([
      createVariantBlob(file, 400, 0.82, 'image/webp'),
      createVariantBlob(file, 800, 0.84, 'image/webp'),
      createVariantBlob(file, 1600, 0.88, 'image/jpeg')
    ]);

    const basePath = `products/${uid}/${productId}`;
    const storageRef = firebase.storage();

    const [thumbSnap, medSnap, origSnap] = await Promise.all([
      storageRef.ref(`${basePath}/thumbnail/${fileId}.webp`).put(thumbBlob, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' }),
      storageRef.ref(`${basePath}/medium/${fileId}.webp`).put(medBlob, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' }),
      storageRef.ref(`${basePath}/original/${fileId}.jpg`).put(origBlob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' })
    ]);

    const [thumbUrl, medUrl, origUrl] = await Promise.all([
      thumbSnap.ref.getDownloadURL(),
      medSnap.ref.getDownloadURL(),
      origSnap.ref.getDownloadURL()
    ]);

    return {
      thumbnail: thumbUrl,
      medium: medUrl,
      large: medUrl,
      original: origUrl,
      alt: altName
    };
  },

  async saveProductWithStatus(isPublished) {
    if (isPublished) {
      if (!SellerWizard.validateStep1()) { SellerWizard.goToStep(1); return; }
      if (!SellerWizard.validateStep2()) { SellerWizard.goToStep(2); return; }
      if (!SellerWizard.validateStep3()) { SellerWizard.goToStep(3); return; }
      if (!SellerWizard.validateStep4()) { SellerWizard.goToStep(4); return; }
      if (!SellerWizard.validateStep5()) { SellerWizard.goToStep(5); return; }
    }

    const pubBtn = document.getElementById('btn-wizard-publish');
    const draftBtn = document.getElementById('btn-save-draft');
    if (pubBtn) pubBtn.disabled = true;
    if (draftBtn) draftBtn.disabled = true;

    try {
      const uid  = SellerGuard.currentUser.uid;
      const data = SellerGuard.sellerData;
      const docId = this.editingId || db.collection('products').doc().id;
      const pName = document.getElementById('p-name')?.value.trim() || 'Untitled Ethnic Product';

      let uploadedURLs = [];
      if (this.imageFiles.length > 0) {
        uploadedURLs = await Promise.all(
          this.imageFiles.map(f => this.uploadImageToStorage(f, uid, docId, pName))
        );
      }

      const allImages = [...this.imageURLs, ...uploadedURLs];
      const primaryVariant = allImages[0] || {};
      const primaryImageUrl = (typeof primaryVariant === 'object' && primaryVariant)
        ? (primaryVariant.large || primaryVariant.medium || primaryVariant.original || '')
        : (primaryVariant || '');
      const thumbnailImageUrl = (typeof primaryVariant === 'object' && primaryVariant)
        ? (primaryVariant.thumbnail || primaryVariant.medium || primaryVariant.original || '')
        : (primaryVariant || '');

      const price = parseFloat(document.getElementById('p-price')?.value) || 0;
      const salePrice = parseFloat(document.getElementById('p-sale-price')?.value) || price;
      const discountPercentage = (price > 0 && price > salePrice) ? Math.round(((price - salePrice) / price) * 100) : 0;

      const highlights = (document.getElementById('p-highlights')?.value || '')
        .split('\n')
        .map(h => h.trim().replace(/^[•\-\*]\s*/, ''))
        .filter(Boolean);

      // Collect variant data and compute aggregated metrics
      const variants = SellerVariants.collectVariantsData();
      const hasVariants = variants.length > 0;
      const totalStock = hasVariants
        ? variants.reduce((sum, v) => sum + (v.quantity || 0), 0)
        : (parseInt(document.getElementById('p-stock')?.value) || 0);

      const totalReserved = hasVariants
        ? variants.reduce((sum, v) => sum + (v.reservedQuantity || 0), 0)
        : 0;

      const totalAvailable = Math.max(0, totalStock - totalReserved);
      const lowStockCount = hasVariants
        ? variants.filter(v => v.quantity > 0 && v.quantity <= (v.lowStockThreshold || 5)).length
        : (totalStock > 0 && totalStock <= 5 ? 1 : 0);

      const outOfStockCount = hasVariants
        ? variants.filter(v => v.quantity <= 0).length
        : (totalStock <= 0 ? 1 : 0);

      const inventory = {
        totalQuantity: totalStock,
        totalReservedQuantity: totalReserved,
        totalAvailableQuantity: totalAvailable,
        lowStockCount,
        outOfStockCount,
        hasVariants
      };

      const pricing = {
        mrp: price,
        sellingPrice: salePrice,
        discountPercentage
      };

      const shipping = {
        weight: parseFloat(document.getElementById('p-weight')?.value) || 0.5,
        length: parseFloat(document.getElementById('p-length')?.value) || 30,
        width:  parseFloat(document.getElementById('p-width')?.value) || 25,
        height: parseFloat(document.getElementById('p-height')?.value) || 5,
        shippingCategory: document.getElementById('p-shipping-class')?.value || document.getElementById('p-shipping-cat')?.value || 'Standard',
        storePickupAvailable: document.getElementById('p-ship-pickup')?.checked !== false,
        deliveryAvailable: document.getElementById('p-ship-delivery')?.checked !== false
      };

      const attributes = {
        fabric:   document.getElementById('p-fabric')?.value.trim() || '',
        occasion: document.getElementById('p-occasion')?.value || '',
        pattern:  document.getElementById('p-pattern')?.value.trim() || '',
        work:     document.getElementById('p-work')?.value.trim() || '',
        stitch:   document.getElementById('p-stitch')?.value.trim() || '',
        neckline: document.getElementById('p-neckline')?.value.trim() || '',
        care:     document.getElementById('p-care')?.value.trim() || ''
      };

      // Legacy flat fields for backwards compatibility with existing catalog
      const colors = SellerVariants.selectedColors.length > 0
        ? SellerVariants.selectedColors.map(c => c.name)
        : (document.getElementById('p-color')?.value.split(',').map(c => c.trim()).filter(Boolean) || []);

      const sizes = SellerVariants.selectedSizes.length > 0
        ? SellerVariants.selectedSizes
        : (document.getElementById('p-sizes')?.value.split(',').map(s => s.trim()).filter(Boolean) || []);

      const product = {
        name:         pName,
        brand:        document.getElementById('p-brand')?.value.trim() || 'Nari Niketan Boutique',
        slug:         document.getElementById('p-slug')?.value.trim() || '',
        category:     (()=>{ const sel=document.getElementById('p-category'); return sel?.value==='__other__' ? (document.getElementById('p-category-custom')?.value.trim()||'Other') : (sel?.value||''); })(),
        subcategory:  (()=>{ const sel=document.getElementById('p-subcategory'); const custom=document.getElementById('p-subcategory-custom')?.value.trim(); return sel?.value==='__custom_sub__' ? (custom||'') : (sel?.value||custom||''); })(),
        fabric:       attributes.fabric,
        description:  document.getElementById('p-desc')?.value.trim() || '',
        shortDescription: document.getElementById('p-short-desc')?.value.trim() || '',
        highlights,
        tags:         document.getElementById('p-tags')?.value.split(',').map(t => t.trim()).filter(Boolean),
        price,
        salePrice,
        discount:     discountPercentage,
        stock:        totalStock,
        sku:          document.getElementById('p-sku')?.value.trim() || (variants[0]?.sku || ''),
        colors,
        sizes,
        occasion:     attributes.occasion,
        productType:  SellerVariants.productType,
        variants,
        inventory,
        pricing,
        shipping,
        attributes,
        images:       allImages,
        imageUrl:     primaryImageUrl,
        thumbnail:    thumbnailImageUrl,
        active:       isPublished,
        draft:        !isPublished,
        status:       isPublished ? (totalStock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK') : 'DRAFT',
        sellerId:     uid,
        sellerName:   data.sellerProfile?.storeName || data.displayName || '',
        sellerStatus: data.sellerStatus || 'pending',
        imageObjects: this.imageMetadata || [],
        aiGenerated:  { style: SellerWizard.selectedStyle, generatedAt: new Date().toISOString(), photoAssistantUsed: (this.imageMetadata||[]).some(m => m.source === 'ai_generated') },
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
      };

      let saved = false;

      // 1. Try Backend API first
      try {
        const currentUser = firebase.auth().currentUser;
        if (currentUser && window.location.protocol.startsWith('http')) {
          const token = await currentUser.getIdToken();
          const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8080'
            : 'https://nari-niketan-api-997712460310.asia-south1.run.app';

          const method = this.editingId ? 'PUT' : 'POST';
          const url = this.editingId ? `${apiBase}/api/seller/products/${docId}` : `${apiBase}/api/seller/products`;

          const res = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(product)
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success) saved = true;
          }
        }
      } catch (apiErr) {
        console.warn('Product save API fallback to Firestore:', apiErr);
      }

      // 2. Direct Firestore fallback
      if (!saved) {
        if (this.editingId) {
          await db.collection('products').doc(docId).update(product);
        } else {
          product.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          await db.collection('products').doc(docId).set(product);
        }

        // Record initial inventory audit log
        if (variants.length > 0) {
          variants.forEach(async (v) => {
            await db.collection('inventoryAuditLogs').add({
              sellerId: uid,
              productId: docId,
              productName: pName,
              sku: v.sku || '',
              variantId: v.variantId,
              variantDetails: `${v.color} / ${v.size}`,
              changeType: this.editingId ? 'SELLER_UPDATE' : 'INITIAL_STOCK',
              previousQuantity: 0,
              quantityChanged: v.quantity,
              newQuantity: v.quantity,
              reason: this.editingId ? 'SELLER_MANUAL_UPDATE' : 'RESTOCK',
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
          });
        }
      }

      localStorage.removeItem('nari_seller_wizard_draft');
      SellerToast.show(isPublished ? 'Product & Variants published successfully! 🎉' : 'Draft saved! 💾', 'success');

      setTimeout(() => {
        SellerNav.go('products');
      }, 900);

    } catch (e) {
      console.error('Save product error:', e);
      SellerToast.show('Error saving product: ' + e.message, 'error');
    } finally {
      if (pubBtn) pubBtn.disabled = false;
      if (draftBtn) draftBtn.disabled = false;
    }
  }
};

// ─── SELLER INVENTORY CONTROLLER ───────────────────────────
const SellerInventory = {
  inventoryItems: [],
  metrics: {
    totalProducts: 0,
    totalVariants: 0,
    totalStock: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  },
  currentStatusFilter: 'all',

  async load() {
    const uid = SellerGuard.currentUser?.uid;
    if (!uid) return;

    const tbody = document.getElementById('inventory-table-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;"><div class="empty-state"><div class="empty-icon">⏳</div><p>Loading inventory...</p></div></td></tr>`;
    }

    try {
      // 1. Try backend API first
      let loaded = false;
      try {
        const currentUser = firebase.auth().currentUser;
        if (currentUser && window.location.protocol.startsWith('http')) {
          const token = await currentUser.getIdToken();
          const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8080'
            : 'https://nari-niketan-api-997712460310.asia-south1.run.app';

          const res = await fetch(`${apiBase}/api/seller/inventory`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              this.inventoryItems = data.items || [];
              this.metrics = data.summary || {
                totalProducts: 0, totalVariants: 0, totalStock: 0, lowStockCount: 0, outOfStockCount: 0
              };
              loaded = true;
            }
          }
        }
      } catch (apiErr) {
        console.warn('Seller inventory API fallback to Firestore:', apiErr);
      }

      // 2. Direct Firestore Fallback
      if (!loaded) {
        const snap = await db.collection('products').where('sellerId', '==', uid).get();
        const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        let flattened = [];
        let totalStockSum = 0;
        let lowStockSum = 0;
        let oosSum = 0;

        products.forEach(p => {
          const pImage = p.thumbnail || (p.images?.[0]?.thumbnail || p.imageUrl || p.images?.[0] || 'https://placehold.co/44x54/1A1225/D4AF37?text=P');
          const pPrice = p.salePrice || p.pricing?.sellingPrice || p.price || 0;

          if (Array.isArray(p.variants) && p.variants.length > 0) {
            p.variants.forEach(v => {
              const q = Number(v.quantity || 0);
              const thresh = Number(v.lowStockThreshold || 5);
              const status = q <= 0 ? 'out_of_stock' : (q <= thresh ? 'low_stock' : 'in_stock');
              totalStockSum += q;
              if (status === 'low_stock') lowStockSum++;
              if (status === 'out_of_stock') oosSum++;

              flattened.push({
                productId: p.id,
                productName: p.name || 'Untitled',
                category: p.category || 'Ethnic Wear',
                thumbnail: pImage,
                variantId: v.variantId,
                sku: v.sku || '—',
                color: v.color || 'Standard',
                colorCode: v.colorCode || '#8B1A4A',
                size: v.size || 'Free Size',
                price: v.price || pPrice,
                quantity: q,
                reservedQuantity: Number(v.reservedQuantity || 0),
                availableQuantity: Math.max(0, q - Number(v.reservedQuantity || 0)),
                lowStockThreshold: thresh,
                status
              });
            });
          } else {
            const q = Number(p.stock || 0);
            const status = q <= 0 ? 'out_of_stock' : (q <= 5 ? 'low_stock' : 'in_stock');
            totalStockSum += q;
            if (status === 'low_stock') lowStockSum++;
            if (status === 'out_of_stock') oosSum++;

            flattened.push({
              productId: p.id,
              productName: p.name || 'Untitled',
              category: p.category || 'Ethnic Wear',
              thumbnail: pImage,
              variantId: 'single',
              sku: p.sku || '—',
              color: (p.colors && p.colors[0]) || 'Standard',
              colorCode: '#8B1A4A',
              size: (p.sizes && p.sizes[0]) || 'Free Size',
              price: pPrice,
              quantity: q,
              reservedQuantity: 0,
              availableQuantity: q,
              lowStockThreshold: 5,
              status
            });
          }
        });

        this.inventoryItems = flattened;
        this.metrics = {
          totalProducts: products.length,
          totalVariants: flattened.length,
          totalStock: totalStockSum,
          lowStockCount: lowStockSum,
          outOfStockCount: oosSum
        };
      }

      this.updateSummaryCards();
      this.filterTable();

    } catch (err) {
      console.error('Inventory load error:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--error);">Failed to load inventory. Please refresh.</td></tr>`;
      }
    }
  },

  updateSummaryCards() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setVal('inv-total-prods', this.metrics.totalProducts || 0);
    setVal('inv-total-variants', this.metrics.totalVariants || 0);
    setVal('inv-total-stock', this.metrics.totalStock || 0);
    setVal('inv-low-stock-count', this.metrics.lowStockCount || 0);
    setVal('inv-oos-count', this.metrics.outOfStockCount || 0);
  },

  setStatusFilter(status) {
    this.currentStatusFilter = status;
    ['all', 'in_stock', 'low_stock', 'out_of_stock'].forEach(st => {
      const btn = document.getElementById(`filter-btn-${st}`);
      if (btn) {
        if (st === status) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });
    this.filterTable();
  },

  filterTable() {
    const q = (document.getElementById('inv-search-input')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('inv-cat-filter')?.value || '';
    const status = this.currentStatusFilter;

    const filtered = this.inventoryItems.filter(item => {
      const matchQ = !q || (item.productName && item.productName.toLowerCase().includes(q)) || (item.sku && item.sku.toLowerCase().includes(q));
      const matchCat = !cat || item.category === cat;
      const matchStatus = (status === 'all') || (item.status === status);
      return matchQ && matchCat && matchStatus;
    });

    this.renderTable(filtered);
  },

  renderTable(items) {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:2.5rem;">
            <div class="empty-state">
              <div class="empty-icon">📦</div>
              <h3>No inventory items found</h3>
              <p>Try adjusting your search query or filters</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(item => {
      let statusBadgeHtml = '';
      if (item.status === 'out_of_stock') {
        statusBadgeHtml = `<span class="badge badge-danger" style="font-size:0.75rem;padding:3px 8px;">❌ Out of Stock</span>`;
      } else if (item.status === 'low_stock') {
        statusBadgeHtml = `<span class="badge badge-warning" style="font-size:0.75rem;padding:3px 8px;">⚠️ Low Stock (${item.availableQuantity} left)</span>`;
      } else {
        statusBadgeHtml = `<span class="badge badge-success" style="font-size:0.75rem;padding:3px 8px;">✓ In Stock</span>`;
      }

      return `
        <tr id="inv-row-${item.productId}-${item.variantId}">
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <img src="${item.thumbnail}" alt="${item.productName}" style="width:36px;height:45px;border-radius:4px;object-fit:cover;background:#222;">
              <div>
                <div style="font-weight:700;color:#fff;font-size:0.85rem;">${item.productName}</div>
                <div style="font-size:0.72rem;color:var(--text-dim);">ID: ${item.productId.slice(0, 8)}…</div>
              </div>
            </div>
          </td>
          <td><span style="font-size:0.82rem;color:var(--text-dim);">${item.category}</span></td>
          <td>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="preset-chip-swatch" style="background:${item.colorCode || '#8B1A4A'}"></span>
              <span style="font-size:0.82rem;color:#fff;">${item.color}</span>
            </div>
          </td>
          <td><span style="font-weight:700;color:#FFE082;font-size:0.82rem;">${item.size}</span></td>
          <td><code style="font-size:0.75rem;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;color:#ECE0E6;">${item.sku}</code></td>
          <td><span style="font-weight:700;color:#fff;font-size:0.84rem;">₹${Number(item.price).toLocaleString('en-IN')}</span></td>
          <td>
            <span style="font-size:0.95rem;font-weight:800;color:${item.availableQuantity > 0 ? '#81C784' : '#EF5350'}">
              ${item.availableQuantity}
            </span>
            ${item.reservedQuantity > 0 ? `<span style="font-size:0.72rem;color:var(--text-dim);margin-left:4px;">(${item.reservedQuantity} reserved)</span>` : ''}
          </td>
          <td>${statusBadgeHtml}</td>
          <td style="text-align:right">
            <button class="btn btn-primary btn-xs" onclick="SellerInventory.openQuickStockModal('${item.productId}', '${item.variantId}')" style="padding:4px 10px;font-size:0.75rem;">
              ✏️ Quick Stock
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  currentEditingItem: null,

  openQuickStockModal(productId, variantId) {
    const item = this.inventoryItems.find(x => x.productId === productId && x.variantId === variantId);
    if (!item) return;

    this.currentEditingItem = item;

    document.getElementById('qs-product-id').value = productId;
    document.getElementById('qs-variant-id').value = variantId;
    document.getElementById('qs-product-img').src = item.thumbnail;
    document.getElementById('qs-product-name').textContent = item.productName;
    document.getElementById('qs-variant-info').textContent = `Color: ${item.color} | Size: ${item.size} | SKU: ${item.sku}`;
    document.getElementById('qs-current-stock').value = `${item.quantity} in stock (${item.availableQuantity} available)`;
    document.getElementById('qs-new-stock').value = item.quantity;
    document.getElementById('qs-reason').value = 'RESTOCK';
    document.getElementById('qs-note').value = '';

    const modal = document.getElementById('modal-quick-stock');
    if (modal) modal.classList.add('open');
  },

  closeQuickStockModal() {
    const modal = document.getElementById('modal-quick-stock');
    if (modal) modal.classList.remove('open');
    this.currentEditingItem = null;
  },

  changeQsQty(delta) {
    const input = document.getElementById('qs-new-stock');
    if (input) {
      const cur = Math.max(0, (parseInt(input.value) || 0) + delta);
      input.value = cur;
    }
  },

  async submitQuickStockUpdate() {
    const productId = document.getElementById('qs-product-id')?.value;
    const variantId = document.getElementById('qs-variant-id')?.value;
    const newQty = parseInt(document.getElementById('qs-new-stock')?.value);
    const reason = document.getElementById('qs-reason')?.value || 'SELLER_MANUAL_UPDATE';
    const note = document.getElementById('qs-note')?.value.trim() || '';

    if (isNaN(newQty) || newQty < 0) {
      SellerToast.show('Please enter a valid non-negative quantity.', 'warning');
      return;
    }

    const btn = document.getElementById('btn-save-quick-stock');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Updating...';
    }

    try {
      let updated = false;

      // 1. Try Backend API
      try {
        const currentUser = firebase.auth().currentUser;
        if (currentUser && window.location.protocol.startsWith('http')) {
          const token = await currentUser.getIdToken();
          const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8080'
            : 'https://nari-niketan-api-997712460310.asia-south1.run.app';

          const res = await fetch(`${apiBase}/api/seller/products/${productId}/inventory`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ variantId, quantity: newQty, reason, note })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success) updated = true;
          }
        }
      } catch (apiErr) {
        console.warn('Quick stock update API fallback to Firestore:', apiErr);
      }

      // 2. Direct Firestore fallback
      if (!updated) {
        const pRef = db.collection('products').doc(productId);
        const pDoc = await pRef.get();
        if (pDoc.exists) {
          const pData = pDoc.data();
          const variants = Array.isArray(pData.variants) ? [...pData.variants] : [];
          let previousQty = 0;

          if (variants.length > 0 && variantId !== 'single') {
            const vIdx = variants.findIndex(v => v.variantId === variantId);
            if (vIdx >= 0) {
              previousQty = variants[vIdx].quantity || 0;
              variants[vIdx].quantity = newQty;
              variants[vIdx].availableQuantity = Math.max(0, newQty - (variants[vIdx].reservedQuantity || 0));
              const thresh = variants[vIdx].lowStockThreshold || 5;
              variants[vIdx].status = newQty <= 0 ? 'out_of_stock' : (newQty <= thresh ? 'low_stock' : 'in_stock');
            }
            const newTotalStock = variants.reduce((s, v) => s + (v.quantity || 0), 0);
            await pRef.update({
              variants,
              stock: newTotalStock,
              'inventory.totalQuantity': newTotalStock,
              'inventory.totalAvailableQuantity': variants.reduce((s, v) => s + (v.availableQuantity || 0), 0),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          } else {
            previousQty = pData.stock || 0;
            await pRef.update({
              stock: newQty,
              'inventory.totalQuantity': newQty,
              'inventory.totalAvailableQuantity': newQty,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }

          // Write audit log
          await db.collection('inventoryAuditLogs').add({
            sellerId: SellerGuard.currentUser.uid,
            productId,
            productName: pData.name || 'Product',
            sku: (variants.find(v => v.variantId === variantId)?.sku) || pData.sku || '',
            variantId: variantId || 'single',
            variantDetails: (variants.find(v => v.variantId === variantId)) ? `${variants.find(v => v.variantId === variantId).color} / ${variants.find(v => v.variantId === variantId).size}` : 'Standard',
            changeType: 'MANUAL_UPDATE',
            previousQuantity: previousQty,
            quantityChanged: newQty - previousQty,
            newQuantity: newQty,
            reason,
            note,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      SellerToast.show(`Stock updated to ${newQty}! Audit entry recorded. ✓`, 'success');
      this.closeQuickStockModal();
      await this.load();

    } catch (e) {
      console.error('Quick stock error:', e);
      SellerToast.show('Error updating stock: ' + e.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save Stock Update ✓';
      }
    }
  },

  async openLogsModal() {
    const modal = document.getElementById('modal-inventory-logs');
    const tbody = document.getElementById('inventory-logs-tbody');
    if (!modal) return;

    modal.classList.add('open');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1.5rem;">Loading audit trail...</td></tr>`;
    }

    try {
      let logs = [];
      // 1. Try Backend API
      try {
        const currentUser = firebase.auth().currentUser;
        if (currentUser && window.location.protocol.startsWith('http')) {
          const token = await currentUser.getIdToken();
          const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8080'
            : 'https://nari-niketan-api-997712460310.asia-south1.run.app';

          const res = await fetch(`${apiBase}/api/seller/inventory/logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) logs = data.logs || [];
          }
        }
      } catch (e) {
        console.warn('Audit logs API fallback to Firestore:', e);
      }

      // 2. Firestore Fallback
      if (!logs.length) {
        const snap = await db.collection('inventoryAuditLogs')
          .where('sellerId', '==', SellerGuard.currentUser.uid)
          .orderBy('timestamp', 'desc')
          .limit(50)
          .get();
        logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      if (!logs.length) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text-dim);">No stock changes recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(l => {
        const dateStr = l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString('en-IN') : (l.timestamp ? new Date(l.timestamp).toLocaleString('en-IN') : 'Just now');
        const diff = Number(l.quantityChanged || 0);
        const diffHtml = diff > 0
          ? `<span style="color:#81C784;font-weight:700">+${diff}</span>`
          : (diff < 0 ? `<span style="color:#EF5350;font-weight:700">${diff}</span>` : `<span style="color:#999">0</span>`);

        return `
          <tr>
            <td style="font-size:0.75rem;color:var(--text-dim);">${dateStr}</td>
            <td><strong>${l.productName || 'Product'}</strong><br><code style="font-size:0.72rem">${l.sku || ''}</code></td>
            <td style="font-size:0.75rem">${l.variantDetails || '—'}</td>
            <td>${diffHtml}</td>
            <td><strong>${l.newQuantity ?? '—'}</strong></td>
            <td><span class="badge" style="background:rgba(212,175,55,0.15);color:#FFE082;font-size:0.72rem;">${l.reason || l.changeType || 'UPDATE'}</span></td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error('Audit logs error:', err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--error);">Failed to load audit logs.</td></tr>`;
    }
  },

  closeLogsModal() {
    const modal = document.getElementById('modal-inventory-logs');
    if (modal) modal.classList.remove('open');
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
      const isPendingPickup = (o.status === 'Processing' || o.deliveryState === 'reached_store' || o.deliveryState === 'accepted') && !o.pickupVerified;

      return `
        <tr>
          <td>
            <span style="font-weight:600;font-family:monospace">#${o.id.slice(-8).toUpperCase()}</span>
            ${o.deliveryState === 'reached_store' ? `<div style="font-size:0.7rem;color:#FDE68A;font-weight:800;">🛵 Rider at Shop</div>` : ''}
          </td>
          <td>
            <div style="font-weight:600;font-size:0.87rem">${o.customerName || '—'}</div>
            <div class="td-muted">${o.customerEmail || ''}</div>
          </td>
          <td>
            <div style="font-size:0.83rem;color:var(--text-muted)">${myItems.map(i => i.name || 'Item').join(', ').slice(0, 40)}${myItems.length > 1 ? ` (+${myItems.length - 1} more)` : ''}</div>
          </td>
          <td style="font-weight:700;color:var(--accent)">${fmt(myTotal)}</td>
          <td class="td-muted">${fmtDate(o.createdAt)}</td>
          <td>
            ${statusBadge(o.status)}
            ${o.pickupVerified ? `<div style="font-size:0.7rem;color:#34D399;margin-top:2px;">✓ Rider Verified</div>` : ''}
          </td>
          <td>
            <div style="display:flex;gap:4px;align-items:center;">
              ${isPendingPickup ? `
                <button class="btn btn-accent btn-sm" onclick="SellerOrders.openHandoverModal('${o.id}')" title="Verify Delivery Agent OTP" style="padding:4px 8px;font-size:0.78rem;">
                  🔐 Handover
                </button>
              ` : ''}
              <button class="btn btn-ghost btn-sm" onclick="SellerOrders.viewDetail('${o.id}')">👁️ View</button>
            </div>
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
    const isHandedOver = o.pickupVerified || o.deliveryState === 'picked_up' || o.status === 'Shipped' || o.status === 'Delivered';

    document.getElementById('order-modal-title').textContent = `Order #${orderId.slice(-8).toUpperCase()}`;
    document.getElementById('order-modal-body').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:1rem">
        <!-- Status + Date -->
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            ${statusBadge(o.status)}
            ${o.deliveryState ? `<span class="badge" style="background:rgba(212,175,55,0.18);color:#FDE68A;border:1px solid rgba(212,175,55,0.3);margin-left:6px;">🛵 ${o.deliveryState.replace(/_/g, ' ').toUpperCase()}</span>` : ''}
          </div>
          <span style="color:var(--text-muted);font-size:0.82rem">${fmtDate(o.createdAt)}</span>
        </div>

        <!-- ─── DELIVERY AGENT HANDOVER & OTP SECTION ─── -->
        ${isHandedOver ? `
          <div style="background:rgba(16,185,129,0.12);border:1px solid #10B981;border-radius:var(--radius);padding:0.9rem 1rem;">
            <div style="display:flex;align-items:center;gap:8px;color:#34D399;font-weight:800;font-size:0.9rem;">
              <span>✅</span> Package Handed Over to Delivery Agent &amp; Verified
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.35rem;">
              ${o.deliveryPartnerName ? `Collected by rider: <strong>${o.deliveryPartnerName}</strong>` : 'Package officially in transit with delivery partner.'}
            </div>
          </div>
        ` : `
          <div style="background:linear-gradient(135deg, rgba(212,175,55,0.14), rgba(139,26,74,0.18));border:1.5px solid #D4AF37;border-radius:var(--radius);padding:1rem;">
            <div style="font-size:0.85rem;font-weight:800;color:#FFE082;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.35rem;display:flex;align-items:center;gap:6px;">
              <span>🏪</span> Delivery Agent Handover Verification
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem;line-height:1.45;">
              When the delivery agent visits your shop to take this package, enter the <strong>6-digit OTP</strong> provided by the agent to confirm physical handover:
            </p>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <input type="text" id="detail-handover-otp-${o.id}" class="form-control" placeholder="••••••" maxlength="6" inputmode="numeric" style="width:160px;text-align:center;font-family:monospace;font-size:1.15rem;font-weight:900;letter-spacing:4px;background:var(--bg-card);border:1.5px solid rgba(212,175,55,0.6);color:#FFE082;">
              <button class="btn btn-accent" id="btn-detail-verify-${o.id}" onclick="SellerOrders.verifyOrderHandover('${o.id}')" style="font-weight:700;">
                ✓ Verify &amp; Hand Over
              </button>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;font-size:0.78rem;color:var(--text-dim);margin-top:0.6rem;padding-top:0.4rem;border-top:1px dashed rgba(212,175,55,0.25);">
              <span>Store Handover Backup Code: <strong style="color:var(--accent);font-family:monospace;font-size:0.9rem;">${o.storeHandoverOtp || o.storePickupCode || o.deliveryOtp || '------'}</strong></span>
              ${o.deliveryPartnerName ? `<span>Assigned Rider: <strong style="color:#FFE082">${o.deliveryPartnerName}</strong></span>` : ''}
            </div>
          </div>
        `}

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
  },

  // ─── QUICK OTP VERIFICATION WIDGET ──────────────
  async quickVerifyRiderOtp() {
    const input = document.getElementById('seller-quick-otp-input');
    const btn = document.getElementById('btn-seller-quick-verify');
    const otp = input ? input.value.trim() : '';

    if (!otp || otp.length < 4) {
      SellerToast.show('Please enter the 6-digit OTP given by the delivery agent.', 'error');
      return;
    }

    const uid = SellerGuard.currentUser.uid;
    let originalText = '';
    if (btn) {
      btn.disabled = true;
      originalText = btn.innerHTML;
      btn.innerHTML = '⏳ Verifying...';
    }

    try {
      const res = await Store.sellerFindAndVerifyOtp(uid, otp);
      SellerToast.show(`🎉 Order #${res.orderNumber} Verified! Package handed over to delivery agent.`, 'success', 5000);
      if (input) input.value = '';
      await this.load();
    } catch (e) {
      console.error('quickVerifyRiderOtp error:', e);
      SellerToast.show(e.message || 'Verification failed. Please check the OTP with the rider.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText || '✓ Verify & Hand Over';
      }
    }
  },

  // ─── HANDOVER MODAL METHODS ─────────────────────
  openHandoverModal(orderId) {
    const o = this.allOrders.find(x => x.id === orderId);
    if (!o) return;
    const modal = document.getElementById('modal-seller-handover-otp');
    if (!modal) return;
    modal.dataset.orderId = orderId;

    const badge = document.getElementById('seller-handover-order-badge');
    if (badge) {
      badge.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
          <strong style="color:#FFE082;">Order #${orderId.slice(-8).toUpperCase()}</strong>
          <span style="color:var(--text-muted);font-size:0.75rem;">${o.customerName || 'Customer'}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-dim);">
          ${o.deliveryPartnerName ? `Assigned Rider: <strong style="color:#FFE082">${o.deliveryPartnerName}</strong>` : 'Awaiting Rider Handover'}
        </div>
      `;
    }

    const input = document.getElementById('seller-modal-otp-input');
    if (input) input.value = '';

    modal.classList.add('open');
    setTimeout(() => {
      if (input) input.focus();
    }, 200);
  },

  closeHandoverModal() {
    const modal = document.getElementById('modal-seller-handover-otp');
    if (modal) modal.classList.remove('open');
  },

  async submitModalHandoverVerification() {
    const modal = document.getElementById('modal-seller-handover-otp');
    if (!modal) return;
    const orderId = modal.dataset.orderId;
    const input = document.getElementById('seller-modal-otp-input');
    const otp = input ? input.value.trim() : '';
    const btn = document.getElementById('btn-seller-modal-verify');
    const uid = SellerGuard.currentUser.uid;

    if (!otp || otp.length < 4) {
      SellerToast.show('Please enter the 6-digit OTP from the delivery agent.', 'error');
      return;
    }

    let originalText = '';
    if (btn) {
      btn.disabled = true;
      originalText = btn.innerHTML;
      btn.innerHTML = '⏳ Verifying Handover...';
    }

    try {
      const res = await Store.sellerVerifyDeliveryAgentOtp(orderId, uid, otp);
      modal.classList.remove('open');
      SellerToast.show(`🎉 Order #${res.orderNumber} Verified! Package handed over to delivery agent.`, 'success', 5000);
      await this.load();
    } catch (e) {
      console.error('submitModalHandoverVerification error:', e);
      SellerToast.show(e.message || 'Invalid Handover OTP. Please verify with the delivery agent.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText || '✓ Confirm Package Handed Over to Agent';
      }
    }
  },

  async verifyOrderHandover(orderId) {
    const input = document.getElementById(`detail-handover-otp-${orderId}`);
    const btn = document.getElementById(`btn-detail-verify-${orderId}`);
    const otp = input ? input.value.trim() : '';
    const uid = SellerGuard.currentUser.uid;

    if (!otp || otp.length < 4) {
      SellerToast.show('Please enter the 6-digit OTP from the delivery agent.', 'error');
      return;
    }

    let originalText = '';
    if (btn) {
      btn.disabled = true;
      originalText = btn.innerHTML;
      btn.innerHTML = '⏳ Verifying...';
    }

    try {
      const res = await Store.sellerVerifyDeliveryAgentOtp(orderId, uid, otp);
      SellerToast.show(`🎉 Order #${res.orderNumber} Verified! Package handed over to delivery agent.`, 'success', 5000);
      await this.load();
      await this.viewDetail(orderId);
    } catch (e) {
      console.error('verifyOrderHandover error:', e);
      SellerToast.show(e.message || 'Invalid Handover OTP.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText || '✓ Verify & Hand Over';
      }
    }
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
