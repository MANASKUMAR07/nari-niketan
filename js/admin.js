// =============================================
// NARI NIKETAN — Admin Dashboard Logic
// =============================================

// ===== ADMIN GUARD =====
// Verifies user is authenticated AND has isAdmin: true in Firestore
// Only owner emails (hardcoded in store.js) are granted admin access
const AdminGuard = {
  async init() {
    return new Promise((resolve) => {
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          // Not logged in → redirect to login with return URL
          window.location.href = "../login.html?redirect=" + encodeURIComponent(window.location.href);
          return;
        }
        try {
          const isAdmin = await Store.isUserAdmin(user.uid);
          if (isAdmin) {
            resolve(user);
            return;
          }
          // Authenticated but not an admin owner — show access denied
          this.showAccessDenied(user);
        } catch (e) {
          console.error("Admin guard error:", e);
          this.showAccessDenied(user);
        }
      });
    });
  },

  showAccessDenied(user) {
    document.body.innerHTML = `
      <div style="min-height:100vh;background:#0F0A12;display:flex;align-items:center;justify-content:center;font-family:sans-serif;padding:2rem;">
        <div style="background:#1E1528;border:1px solid rgba(212,175,55,0.3);border-radius:16px;max-width:420px;width:100%;padding:2.5rem;text-align:center;color:#fff;">
          <div style="font-size:3rem;margin-bottom:1rem;">🚫</div>
          <h2 style="color:#D4AF37;font-size:1.4rem;margin-bottom:0.5rem;">Access Denied</h2>
          <p style="color:#C4B8CC;font-size:0.9rem;line-height:1.6;margin-bottom:1.5rem;">
            The account <strong style="color:#fff;">${user.email || user.phoneNumber || "you're signed in with"}</strong> does not have admin privileges.
          </p>
          <div style="display:flex;flex-direction:column;gap:0.75rem;">
            <a href="../index.html" style="display:block;padding:0.85rem;background:linear-gradient(135deg,#D4AF37,#AA820A);border-radius:8px;color:#1A0A0F;font-weight:700;text-decoration:none;">
              🏪 Return to Store
            </a>
            <button onclick="auth.signOut().then(()=>window.location.href='../login.html?redirect='+encodeURIComponent('/admin/'))" style="padding:0.85rem;background:transparent;border:1px solid rgba(212,175,55,0.4);border-radius:8px;color:#D4AF37;font-weight:600;cursor:pointer;">
              🔄 Sign in with Different Account
            </button>
          </div>
        </div>
      </div>
    `;
  }
};

// ===== TOAST ===== 
const AdminToast = {
  show(message, type = "default", duration = 3500) {
    let container = document.getElementById("admin-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "admin-toast-container";
      document.body.appendChild(container);
    }
    const icons = { success: "✅", error: "❌", warning: "⚠️", default: "🔔" };
    const toast = document.createElement("div");
    toast.className = `admin-toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || icons.default}</span><span class="admin-toast-msg">${message}</span><button class="admin-toast-close" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }
};

// ===== CONFIRM DIALOG =====
const AdminConfirm = {
  _resolve: null,
  show(title, message, icon = "⚠️") {
    document.getElementById("confirm-icon").textContent = icon;
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-msg").textContent = message;
    document.getElementById("confirm-overlay").classList.remove("hidden");
    return new Promise(res => { this._resolve = res; });
  },
  close(result) {
    document.getElementById("confirm-overlay").classList.add("hidden");
    if (this._resolve) this._resolve(result);
    this._resolve = null;
  }
};

// ===== NAVIGATION =====
const AdminNav = {
  currentSection: "dashboard",
  pageTitles: {
    dashboard: "📊 Dashboard",
    orders:    "📦 Orders",
    products:  "🛍️ Products",
    coupons:   "🎟️ Coupons",
    refunds:   "💸 Refunds",
    returns:   "↩️ Returns"
  },
  go(section) {
    // Hide all sections
    document.querySelectorAll(".admin-section").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".sidebar-link").forEach(el => el.classList.remove("active"));

    // Show target section
    const target = document.getElementById(`section-${section}`);
    if (target) target.classList.add("active");

    // Highlight sidebar link
    const link = document.querySelector(`.sidebar-link[data-section="${section}"]`);
    if (link) link.classList.add("active");

    // Update topbar title
    const titleEl = document.getElementById("topbar-page-title");
    if (titleEl) titleEl.textContent = this.pageTitles[section] || section;

    this.currentSection = section;

    // Close mobile sidebar
    document.getElementById("admin-sidebar")?.classList.remove("open");
    document.getElementById("sidebar-overlay")?.classList.remove("open");

    // Lazy load section data
    if (section === "dashboard") AdminDashboard.load();
    if (section === "orders")    AdminOrders.load();
    if (section === "products")  AdminProducts.load();
    if (section === "coupons")   AdminCoupons.load();
    if (section === "refunds")   AdminRefunds.load();
    if (section === "returns")   AdminReturns.load();
  },
  toggleMobileSidebar() {
    document.getElementById("admin-sidebar")?.classList.toggle("open");
    document.getElementById("sidebar-overlay")?.classList.toggle("open");
  }
};

// ===== DASHBOARD =====
const AdminDashboard = {
  loaded: false,
  async load(force = false) {
    if (this.loaded && !force) return;
    this.loaded = true;

    // Stat cards
    const stats = await Store.getAdminStats();
    document.getElementById("stat-orders").textContent    = stats.orders;
    document.getElementById("stat-revenue").textContent   = "₹" + Number(stats.revenue).toLocaleString("en-IN");
    document.getElementById("stat-products").textContent  = stats.products;
    document.getElementById("stat-users").textContent     = stats.users;
    document.getElementById("stat-pending").textContent   = stats.pending;

    // Update pending badge in sidebar
    const pendingBadge = document.getElementById("pending-badge");
    if (pendingBadge) pendingBadge.textContent = stats.pending;

    // Recent orders widget
    const recentOrders = await Store.getAllOrders();
    const recentContainer = document.getElementById("recent-orders-list");
    if (recentContainer) {
      if (!recentOrders.length) {
        recentContainer.innerHTML = `<p style="font-size:0.85rem;color:var(--text-muted);text-align:center;padding:1rem">No orders yet</p>`;
      } else {
        recentContainer.innerHTML = recentOrders.slice(0, 6).map(o => `
          <div class="recent-order-row">
            <span class="recent-order-id">#${o.id.substring(0,8).toUpperCase()}</span>
            <span class="recent-order-customer">${o.customerName || o.email || "—"}</span>
            <span class="badge badge-${(o.status||"pending").toLowerCase()}">${o.status || "Pending"}</span>
            <span class="recent-order-amount">₹${Number(o.totalAmount||0).toLocaleString("en-IN")}</span>
          </div>
        `).join("");
      }
    }

    // Recent products widget
    const products = await Store.getAllProducts();
    const prodContainer = document.getElementById("recent-products-list");
    if (prodContainer) {
      if (!products.length) {
        prodContainer.innerHTML = `<p style="font-size:0.85rem;color:var(--text-muted);text-align:center;padding:1rem">No products yet</p>`;
      } else {
        prodContainer.innerHTML = products.slice(0, 6).map(p => `
          <div class="recent-order-row">
            <img src="${p.imageUrl || 'https://placehold.co/32x40/1A1225/D4AF37?text=P'}"
                 style="width:32px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;">
            <span class="recent-order-customer" style="font-weight:600">${p.name}</span>
            <span style="font-size:0.8rem;color:var(--text-muted)">${p.category}</span>
            <span class="recent-order-amount">₹${Number(p.price||0).toLocaleString("en-IN")}</span>
          </div>
        `).join("");
      }
    }

    // Load seller stats in background
    this.loadSellerStats(recentOrders, products);
  },

  async loadSellerStats(orders, products) {
    try {
      const sellersSnap = await db.collection('users').where('sellerStatus', '==', 'approved').get();
      const sellers = sellersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sellerProducts = products.filter(p => p.sellerId);

      const el = (id) => document.getElementById(id);
      if (el('stat-sellers'))    el('stat-sellers').textContent    = sellers.length;
      if (el('stat-seller-products')) el('stat-seller-products').textContent = sellerProducts.length;

      // Build productId -> sellerId map (fallback)
      const prodSellerMap = {};
      products.forEach(p => { if (p.sellerId) prodSellerMap[p.id] = p.sellerId; });

      // Aggregate per-seller revenue from orders
      const sellerMap = {};
      orders.forEach(order => {
        if (!order.items || order.status === 'Cancelled') return;
        order.items.forEach(item => {
          const sid = item.sellerId || prodSellerMap[item.productId];
          if (!sid) return;
          if (!sellerMap[sid]) sellerMap[sid] = { revenue: 0, orderIds: new Set() };
          sellerMap[sid].revenue += (Number(item.price) || 0) * (Number(item.quantity) || 1);
          sellerMap[sid].orderIds.add(order.id);
        });
      });

      const totalRev = Object.values(sellerMap).reduce((s, x) => s + x.revenue, 0);
      if (el('stat-seller-revenue')) el('stat-seller-revenue').textContent = '₹' + totalRev.toLocaleString('en-IN');

      // Store data for the detail modal
      this._sellers = sellers;
      this._sellerMap = sellerMap;
      this._sellerProducts = sellerProducts;
      this._allOrders = orders;

      const tableEl = el('seller-revenue-table');
      if (!tableEl) return;

      if (!sellers.length) {
        tableEl.innerHTML = '<p style="text-align:center;color:var(--text-dim);padding:1.5rem;font-size:.88rem">No approved sellers yet. <a onclick="AdminNav.go(\'sellers\')" style="color:var(--accent);cursor:pointer">Go to Sellers →</a></p>';
        return;
      }

      const rows = sellers.map((s, i) => {
        const d = sellerMap[s.id] || { revenue: 0, orderIds: new Set() };
        return {
          id:         s.id,
          storeName:  s.sellerProfile?.storeName || s.displayName || s.email || '—',
          category:   s.sellerProfile?.primaryCategory || '—',
          prodCount:  sellerProducts.filter(p => p.sellerId === s.id).length,
          orderCount: d.orderIds.size,
          revenue:    d.revenue
        };
      }).sort((a, b) => b.revenue - a.revenue);

      tableEl.innerHTML = `<div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:.6rem .75rem;color:var(--text-dim);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em">Store</th>
            <th style="text-align:left;padding:.6rem .75rem;color:var(--text-dim);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em">Category</th>
            <th style="text-align:right;padding:.6rem .75rem;color:var(--text-dim);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em">Products</th>
            <th style="text-align:right;padding:.6rem .75rem;color:var(--text-dim);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em">Orders</th>
            <th style="text-align:right;padding:.6rem .75rem;color:var(--text-dim);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em">Revenue</th>
            <th style="text-align:center;padding:.6rem .75rem;color:var(--text-dim);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em">Details</th>
          </tr></thead>
          <tbody>${rows.map((r, i) => `
            <tr style="border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s" onmouseenter="this.style.background='rgba(212,175,55,.06)'" onmouseleave="this.style.background=''">
              <td style="padding:.7rem .75rem;font-weight:700">
                <span style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#8B1A4A,#D4AF37);align-items:center;justify-content:center;font-size:.68rem;font-weight:800;color:#fff;margin-right:.5rem">${i+1}</span>
                ${r.storeName}
              </td>
              <td style="padding:.7rem .75rem;color:var(--text-muted)">${r.category}</td>
              <td style="padding:.7rem .75rem;text-align:right;font-weight:600">${r.prodCount}</td>
              <td style="padding:.7rem .75rem;text-align:right;font-weight:600">${r.orderCount}</td>
              <td style="padding:.7rem .75rem;text-align:right;font-weight:700;color:${r.revenue > 0 ? '#22C55E' : 'var(--text-muted)'}">
                ₹${Number(r.revenue).toLocaleString('en-IN')}
              </td>
              <td style="padding:.7rem .75rem;text-align:center">
                <button onclick="AdminDashboard.viewSellerDetail('${r.id}')"
                  style="background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.3);color:var(--accent);padding:.3rem .8rem;border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:600;transition:all .2s"
                  onmouseenter="this.style.background='rgba(212,175,55,.25)'" onmouseleave="this.style.background='rgba(212,175,55,.12)'">
                  👁️ View
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr style="border-top:2px solid var(--border)">
            <td style="padding:.7rem .75rem;text-align:right;font-weight:800;color:#22C55E;font-size:.95rem">\u20b9${totalRev.toLocaleString('en-IN')}</td>
          </tr></tfoot>
        </table></div>`;
    } catch(e) {
      console.warn('Seller stats error:', e);
      const t = document.getElementById('seller-revenue-table');
      if (t) t.innerHTML = '<p style="color:var(--text-dim);font-size:.85rem;text-align:center;padding:1rem">Could not load seller data.</p>';
    }
  },

  viewSellerDetail(sellerId) {
    const seller  = (this._sellers || []).find(s => s.id === sellerId);
    if (!seller) { AdminToast.show('Seller data not loaded yet, please refresh.', 'error'); return; }
    const sp      = seller.sellerProfile || {};
    const sData   = (this._sellerMap  || {})[sellerId] || { revenue: 0, orderIds: new Set() };
    const myProds = (this._sellerProducts || []).filter(p => p.sellerId === sellerId);
    const myOrders = (this._allOrders || []).filter(o =>
      o.items && o.items.some(i => i.sellerId === sellerId || (this._sellerProducts||[]).find(p => p.id === i.productId)?.sellerId === sellerId)
    ).slice(0, 10);

    const fmtDate = ts => {
      if (!ts) return '—';
      try { const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds*1000 : ts); return d.toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}); }
      catch(e) { return '—'; }
    };

    let overlay = document.getElementById('seller-detail-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'seller-detail-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(7px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
      overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
      document.body.appendChild(overlay);
    }

    const stMap = {Delivered:'#22C55E',Cancelled:'#EF4444',Pending:'#F59E0B',Processing:'#3B82F6'};

    overlay.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:18px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.6)">

        <div style="padding:1.4rem 1.6rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--bg-card);z-index:1;border-radius:18px 18px 0 0">
          <div>
            <div style="font-size:1.05rem;font-weight:800">${sp.storeName || seller.displayName || '—'}</div>
            <div style="font-size:.8rem;color:var(--text-dim);margin-top:.15rem">${sp.primaryCategory || 'Seller'} &bull; <span style="color:#22C55E">✅ Approved</span></div>
          </div>
          <button onclick="document.getElementById('seller-detail-overlay').remove()"
            style="background:rgba(255,255,255,.06);border:none;color:var(--text-muted);width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center">✕</button>
        </div>

        <div style="padding:1.4rem 1.6rem;display:flex;flex-direction:column;gap:1.25rem">

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem">
            <div style="background:linear-gradient(135deg,rgba(34,197,94,.12),transparent);border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:1rem;text-align:center">
              <div style="font-size:1.25rem;font-weight:800;color:#22C55E">₹${Number(sData.revenue||0).toLocaleString('en-IN')}</div>
              <div style="font-size:.72rem;color:var(--text-dim);margin-top:.2rem;text-transform:uppercase;letter-spacing:.05em">Revenue</div>
            </div>
            <div style="background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.2);border-radius:12px;padding:1rem;text-align:center">
              <div style="font-size:1.25rem;font-weight:800;color:var(--accent)">${sData.orderIds?.size || 0}</div>
              <div style="font-size:.72rem;color:var(--text-dim);margin-top:.2rem;text-transform:uppercase;letter-spacing:.05em">Orders</div>
            </div>
            <div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:1rem;text-align:center">
              <div style="font-size:1.25rem;font-weight:800;color:#818CF8">${myProds.length}</div>
              <div style="font-size:.72rem;color:var(--text-dim);margin-top:.2rem;text-transform:uppercase;letter-spacing:.05em">Products</div>
            </div>
          </div>

          <div style="background:var(--bg-card2,rgba(255,255,255,.04));border-radius:12px;padding:1rem">
            <div style="font-size:.73rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.7rem;font-weight:600">📇 Contact & Business</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.55rem;font-size:.85rem">
              <div><span style="color:var(--text-dim)">Owner: </span><strong>${seller.displayName || ((seller.firstName||'')+' '+(seller.lastName||'')).trim() || '—'}</strong></div>
              <div><span style="color:var(--text-dim)">Phone: </span><strong>${seller.phone || '—'}</strong></div>
              <div style="grid-column:span 2"><span style="color:var(--text-dim)">Email: </span><strong>${seller.email || '—'}</strong></div>
              <div><span style="color:var(--text-dim)">GSTIN: </span><strong>${sp.gstin || 'Not provided'}</strong></div>
              <div><span style="color:var(--text-dim)">Joined: </span><strong>${fmtDate(seller.createdAt)}</strong></div>
              ${sp.description ? `<div style="grid-column:span 2"><span style="color:var(--text-dim)">About: </span><span style="color:var(--text-muted)">${sp.description}</span></div>` : ''}
            </div>
          </div>

          <div>
            <div style="font-size:.73rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.6rem;font-weight:600">🛍️ Products Listed (${myProds.length})</div>
            ${myProds.length === 0
              ? '<p style="color:var(--text-dim);font-size:.85rem;text-align:center;padding:.75rem;background:var(--bg-card2,rgba(255,255,255,.04));border-radius:8px">No products listed yet</p>'
              : `<div style="display:flex;flex-direction:column;gap:.35rem;max-height:190px;overflow-y:auto">
                  ${myProds.map(p => `
                    <div style="display:flex;align-items:center;gap:.7rem;padding:.5rem .75rem;background:var(--bg-card2,rgba(255,255,255,.04));border-radius:8px">
                      <img src="${p.imageUrl||'https://placehold.co/28x36/1A1225/D4AF37?text=P'}" style="width:28px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0">
                      <div style="flex:1;min-width:0">
                        <div style="font-weight:600;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
                        <div style="font-size:.74rem;color:var(--text-dim)">${p.category} &bull; Stock: ${p.stock ?? '—'}</div>
                      </div>
                      <div style="font-weight:700;font-size:.87rem;color:var(--accent);white-space:nowrap;flex-shrink:0">₹${Number(p.price||0).toLocaleString('en-IN')}</div>
                      <span style="font-size:.7rem;padding:.18rem .45rem;border-radius:4px;flex-shrink:0;background:${p.active!==false?'rgba(34,197,94,.15)':'rgba(239,68,68,.15)'};color:${p.active!==false?'#22C55E':'#EF4444'};font-weight:600">${p.active!==false?'Live':'Hidden'}</span>
                    </div>`).join('')}
                </div>`}
          </div>

          <div>
            <div style="font-size:.73rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.6rem;font-weight:600">📦 Recent Orders (${myOrders.length})</div>
            ${myOrders.length === 0
              ? '<p style="color:var(--text-dim);font-size:.85rem;text-align:center;padding:.75rem;background:var(--bg-card2,rgba(255,255,255,.04));border-radius:8px">No orders received yet</p>'
              : `<div style="display:flex;flex-direction:column;gap:.35rem;max-height:175px;overflow-y:auto">
                  ${myOrders.map(o => {
                    const items = o.items.filter(i => i.sellerId===sellerId || myProds.find(p=>p.id===i.productId));
                    const rev   = items.reduce((s,i)=>s+(Number(i.price)||0)*(Number(i.quantity)||1),0);
                    const sc    = stMap[o.status]||'#F59E0B';
                    return `<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;background:var(--bg-card2,rgba(255,255,255,.04));border-radius:8px;font-size:.82rem">
                      <span style="font-family:monospace;color:var(--accent);font-weight:700;white-space:nowrap">#${o.id.substring(0,8).toUpperCase()}</span>
                      <span style="flex:1;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.customerName||o.email||'—'}</span>
                      <span style="padding:.18rem .45rem;border-radius:4px;font-size:.72rem;font-weight:700;background:${sc}22;color:${sc};white-space:nowrap">${o.status||'Pending'}</span>
                      <span style="font-weight:700;color:#22C55E;white-space:nowrap">₹${Number(rev).toLocaleString('en-IN')}</span>
                    </div>`;
                  }).join('')}
                </div>`}
          </div>

          <div style="display:flex;gap:.75rem;justify-content:flex-end;padding-top:.5rem;border-top:1px solid var(--border)">
            <button onclick="document.getElementById('seller-detail-overlay').remove();AdminNav.go('sellers')"
              style="background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.3);color:var(--accent);padding:.5rem 1.1rem;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:600">
              🏪 Manage Seller
            </button>
            <button onclick="document.getElementById('seller-detail-overlay').remove()"
              style="background:var(--bg-card2,rgba(255,255,255,.04));border:1px solid var(--border);color:var(--text-muted);padding:.5rem 1.1rem;border-radius:8px;cursor:pointer;font-size:.85rem">
              Close
            </button>
          </div>

        </div>
      </div>`;
  }
};

// ===== ORDERS =====
const AdminOrders = {
  allOrders: [],
  filteredOrders: [],

  async load() {
    const container = document.getElementById("orders-table-body");
    container.innerHTML = `<tr><td colspan="7" class="loading-state"><div class="spinner-admin"></div></td></tr>`;
    this.allOrders = await Store.getAllOrders();
    this.filteredOrders = [...this.allOrders];
    this.render();
  },

  filter(status) {
    const search = document.getElementById("orders-search")?.value?.toLowerCase() || "";
    this.filteredOrders = this.allOrders.filter(o => {
      const matchStatus = status === "all" || (o.status || "Pending") === status;
      const matchSearch = !search ||
        (o.id || "").toLowerCase().includes(search) ||
        (o.customerName || "").toLowerCase().includes(search) ||
        (o.email || "").toLowerCase().includes(search);
      return matchStatus && matchSearch;
    });
    this.render();
  },

  render() {
    const container = document.getElementById("orders-table-body");
    if (!this.filteredOrders.length) {
      container.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="table-empty-icon">📭</div><p>No orders found</p></div></td></tr>`;
      return;
    }
    const statusClasses = {
      Pending: "badge-pending",
      Processing: "badge-processing",
      Shipped: "badge-shipped",
      "Out for Delivery": "badge-out-for-delivery",
      "Ready for Pickup": "badge-ready-for-pickup",
      Collected: "badge-delivered",
      Delivered: "badge-delivered",
      Cancelled: "badge-cancelled"
    };
    container.innerHTML = this.filteredOrders.map(o => {
      const items = o.items || [];
      const dt = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : null;
      const dateStr = dt ? dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
      return `
        <tr>
          <td><span style="font-family:monospace;font-size:0.8rem;color:var(--accent)">#${o.id.substring(0,8).toUpperCase()}</span></td>
          <td>
            <div style="font-weight:600;font-size:0.88rem">${o.customerName || "—"}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${o.email || o.phone || ""}</div>
          </td>
          <td style="font-size:0.82rem;color:var(--text-muted)">${dateStr}</td>
          <td>
            <div style="font-size:0.8rem">${items.length} item(s)</div>
            <div style="font-weight:700;color:var(--text)">₹${Number(o.totalAmount||0).toLocaleString("en-IN")}</div>
          </td>
          <td><span class="badge ${statusClasses[o.status] || "badge-pending"}">${o.status || "Pending"}</span></td>
          <td>
            <select class="status-select" onchange="AdminOrders.updateStatus('${o.id}', this.value, this)">
              <option value="Pending"          ${(o.status||'Pending')==='Pending'          ?'selected':''}>Pending</option>
              <option value="Processing"       ${o.status==='Processing'                    ?'selected':''}>Processing</option>
              <option value="Shipped"          ${o.status==='Shipped'                       ?'selected':''}>Shipped</option>
              <option value="Out for Delivery" ${o.status==='Out for Delivery'              ?'selected':''}>🚚 Out for Delivery</option>
              <option value="Ready for Pickup" ${o.status==='Ready for Pickup'              ?'selected':''}>🏪 Ready for Pickup</option>
              <option value="Delivered"        ${o.status==='Delivered'                     ?'selected':''}>Delivered</option>
              <option value="Collected"        ${o.status==='Collected'                     ?'selected':''}>Collected (Store)</option>
              <option value="Cancelled"        ${o.status==='Cancelled'                     ?'selected':''}>Cancelled</option>
            </select>
          </td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="AdminOrders.viewDetails('${o.id}')">View</button>
          </td>
        </tr>
      `;
    }).join("");
  },

  async updateStatus(orderId, newStatus, selectEl) {
    try {
      await Store.updateOrderStatus(orderId, newStatus);
      // Update local data
      const order = this.allOrders.find(o => o.id === orderId);
      if (order) order.status = newStatus;
      AdminToast.show(`Order status updated to "${newStatus}"`, "success");
      this.render();
    } catch (e) {
      AdminToast.show("Failed to update status: " + e.message, "error");
      // Revert select
      selectEl.value = this.allOrders.find(o => o.id === orderId)?.status || "Pending";
    }
  },

  viewDetails(orderId) {
    const o = this.allOrders.find(x => x.id === orderId);
    if (!o) return;
    const items = o.items || [];
    const addr = o.address || {};
    const addrText = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
    document.getElementById("order-detail-content").innerHTML = `
      <div style="display:grid;gap:1.25rem">
        <div style="display:flex;gap:1rem;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <p style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem">Customer</p>
            <p style="font-weight:700">${o.customerName || "—"}</p>
            <p style="font-size:0.82rem;color:var(--text-muted)">${o.email || ""}</p>
            <p style="font-size:0.82rem;color:var(--text-muted)">${o.phone || ""}</p>
          </div>
          <div style="flex:1;min-width:200px">
            <p style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem">Delivery Address</p>
            <p style="font-size:0.85rem">${addrText || "—"}</p>
          </div>
          <div>
            <p style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem">Payment</p>
            <p style="font-weight:600">${(o.paymentMethod||"standard").toUpperCase()}</p>
          </div>
        </div>
        <div>
          <p style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">Items</p>
          ${items.map(i => `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid var(--border-soft)">
              <img src="${i.imageUrl||'https://placehold.co/44x54/1A1225/D4AF37?text=P'}" style="width:44px;height:54px;object-fit:cover;border-radius:6px">
              <div style="flex:1">
                <p style="font-weight:600;font-size:.88rem">${i.name}</p>
                <p style="font-size:.75rem;color:var(--text-muted)">Size: ${i.size||'—'} | Color: ${i.color||'—'} | Qty: ${i.qty||1}</p>
              </div>
              <span style="font-weight:700;color:var(--accent)">₹${Number((i.price||0)*(i.qty||1)).toLocaleString("en-IN")}</span>
            </div>
          `).join("")}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:.5rem">
          <span style="font-weight:600;color:var(--text-muted)">Total Amount</span>
          <span style="font-size:1.25rem;font-weight:800;color:var(--accent)">₹${Number(o.totalAmount||0).toLocaleString("en-IN")}</span>
        </div>
        ${o.deliveryOtp ? `
          <div style="background:rgba(245,158,11,0.12);border:1.5px dashed #F59E0B;border-radius:8px;padding:0.85rem 1rem;display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
            <div>
              <div style="font-size:0.72rem;font-weight:700;color:#F59E0B;text-transform:uppercase;letter-spacing:1px;">🔐 Customer Delivery / Pickup OTP</div>
              <div style="font-size:1.35rem;font-family:monospace;font-weight:900;color:#FDE68A;letter-spacing:3px;">${o.deliveryOtp}</div>
              <div style="font-size:0.72rem;color:${o.otpVerified ? '#10B981' : '#F59E0B'};font-weight:600;margin-top:2px;">
                ${o.otpVerified ? '✅ OTP Verified by Agent/Admin' : '⏳ Pending Customer Verification'}
              </div>
            </div>
            ${!o.otpVerified && o.status !== 'Delivered' && o.status !== 'Collected' && o.status !== 'Cancelled' ? `
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <input type="text" id="admin-verify-otp-input" placeholder="Enter Customer OTP" maxlength="6" style="width:140px;padding:6px 10px;font-size:0.85rem;border:1px solid #F59E0B;border-radius:6px;background:rgba(0,0,0,0.4);color:#fff;font-family:monospace;font-weight:700;text-align:center;">
                <button type="button" class="btn btn-accent btn-sm" onclick="AdminOrders.verifyOtp('${o.id}')" style="font-size:0.78rem;font-weight:700;">
                  Verify &amp; Deliver &rarr;
                </button>
              </div>` : ''}
          </div>` : ''}
        ${o.adminNote ? `<div style="background:rgba(212,175,55,.08);border:1px solid var(--border);border-radius:8px;padding:.75rem;font-size:.85rem"><strong>Admin Note:</strong> ${o.adminNote}</div>` : ''}
        ${o.cancellationReason ? `<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:.75rem;font-size:.85rem;color:#FCA5A5"><strong>Cancellation Reason:</strong> ${o.cancellationReason}</div>` : ''}
      </div>
    `;
    document.getElementById("order-detail-modal").classList.remove("hidden");
  },

  async verifyOtp(orderId) {
    const input = document.getElementById("admin-verify-otp-input");
    const entered = input ? input.value.trim() : "";
    if (!entered) {
      AdminToast.show("Please enter the customer OTP to verify delivery.", "warning");
      return;
    }
    try {
      const res = await Store.verifyDeliveryOtp(orderId, entered);
      if (res.success) {
        AdminToast.show(res.message, "success");
        const order = this.allOrders.find(o => o.id === orderId);
        if (order) {
          order.status = res.status;
          order.otpVerified = true;
        }
        this.render();
        this.viewDetails(orderId);
      } else {
        AdminToast.show(res.message, "error");
      }
    } catch(e) {
      AdminToast.show("Verification failed: " + e.message, "error");
    }
  }
};

// ===== PRODUCTS =====
const AdminProducts = {
  allProducts: [],
  editingId: null,

  async load() {
    const tbody = document.getElementById("products-table-body");
    tbody.innerHTML = `<tr><td colspan="7" class="loading-state"><div class="spinner-admin"></div></td></tr>`;
    this.allProducts = await Store.getAllProducts();
    this.render(this.allProducts);
  },

  filter() {
    const q = document.getElementById("products-search")?.value?.toLowerCase() || "";
    const cat = document.getElementById("products-cat-filter")?.value || "all";
    const filtered = this.allProducts.filter(p => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || (p.category||"").toLowerCase().includes(q);
      const matchCat = cat === "all" || p.category === cat;
      return matchQ && matchCat;
    });
    this.render(filtered);
  },

  render(products) {
    const tbody = document.getElementById("products-table-body");
    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="table-empty-icon">🛍️</div><p>No products found</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = products.map(p => `
      <tr>
        <td><img src="${p.imageUrl || (p.images && p.images[0]) || 'https://placehold.co/44x54/1A1225/D4AF37?text=P'}" class="product-thumb" alt="${p.name}" onerror="this.src='https://placehold.co/44x54/1A1225/D4AF37?text=P'"></td>
        <td><div class="product-name-cell" title="${p.name}">${p.name}</div></td>
        <td><span style="font-size:0.82rem;color:var(--text-muted)">${p.category||"—"}</span></td>
        <td>
          <div style="font-weight:700">₹${Number(p.salePrice || p.price || 0).toLocaleString("en-IN")}</div>
          ${p.salePrice && p.salePrice < p.price ? `<div style="font-size:.75rem;color:var(--text-dim);text-decoration:line-through">MRP ₹${Number(p.price).toLocaleString("en-IN")}</div>` : ''}
        </td>
        <td><span style="font-weight:600;color:${(p.stock||0)<5?'var(--error)':'var(--text)'}">${p.stock ?? "—"}</span></td>
        <td>
          ${p.featured ? '<span class="badge badge-featured">Featured</span>' : '<span class="badge badge-inactive">Standard</span>'}
        </td>
        <td>
          <div style="display:flex;gap:.4rem">
            <button class="btn btn-outline btn-sm btn-icon" onclick="AdminProducts.openEdit('${p.id}')" title="Edit">✏️</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="AdminProducts.confirmDelete('${p.id}', '${p.name.replace(/'/g,"\\'")}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join("");
  },

  openAdd() {
    this.editingId = null;
    document.getElementById("product-modal-title").textContent = "➕ Add New Product";
    document.getElementById("product-form").reset();
    document.getElementById("product-modal").classList.remove("hidden");
  },

  openEdit(id) {
    const p = this.allProducts.find(x => x.id === id);
    if (!p) return;
    this.editingId = id;
    document.getElementById("product-modal-title").textContent = "✏️ Edit Product";
    const f = document.getElementById("product-form");
    f["p-name"].value         = p.name || "";
    f["p-category"].value     = p.category || "Sarees";
    f["p-price"].value        = p.price || "";
    f["p-original-price"].value = p.salePrice || p.originalPrice || "";
    f["p-stock"].value        = p.stock ?? "";
    f["p-image"].value        = p.imageUrl || "";
    f["p-description"].value  = p.description || "";
    f["p-fabric"].value       = p.fabric || "";
    f["p-care"].value         = p.care || "";
    f["p-sizes"].value        = (p.sizes || []).join(", ");
    f["p-colors"].value       = (p.colors || []).join(", ");
    f["p-featured"].checked   = p.featured || false;
    f["p-rating"].value       = p.rating || "";
    document.getElementById("product-modal").classList.remove("hidden");
  },

  closeModal() {
    document.getElementById("product-modal").classList.add("hidden");
    this.editingId = null;
  },

  async save() {
    const f = document.getElementById("product-form");
    const name = f["p-name"].value.trim();
    const price = parseFloat(f["p-price"].value);
    if (!name || isNaN(price)) {
      AdminToast.show("Product name and price are required.", "error");
      return;
    }
    const salePrice = parseFloat(f["p-original-price"].value) || null;
    const data = {
      name,
      category:       f["p-category"].value,
      price:          price,
      salePrice:      salePrice,
      discount:       (salePrice && price > salePrice) ? Math.round(((price - salePrice) / price) * 100) : 0,
      stock:          parseInt(f["p-stock"].value) || 0,
      imageUrl:       f["p-image"].value.trim(),
      description:    f["p-description"].value.trim(),
      fabric:         f["p-fabric"].value.trim(),
      care:           f["p-care"].value.trim(),
      sizes:          f["p-sizes"].value.split(",").map(s => s.trim()).filter(Boolean),
      colors:         f["p-colors"].value.split(",").map(s => s.trim()).filter(Boolean),
      featured:       f["p-featured"].checked,
      rating:         parseFloat(f["p-rating"].value) || 0,
    };

    const saveBtn = document.getElementById("product-save-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    try {
      if (this.editingId) {
        await Store.updateProduct(this.editingId, data);
        AdminToast.show("Product updated successfully!", "success");
      } else {
        await Store.addProduct(data);
        AdminToast.show("Product added successfully!", "success");
      }
      this.closeModal();
      await this.load();
    } catch (e) {
      AdminToast.show("Save failed: " + e.message, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Product";
    }
  },

  async confirmDelete(id, name) {
    const confirmed = await AdminConfirm.show(
      "Delete Product",
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      "🗑️"
    );
    if (!confirmed) return;
    try {
      await Store.deleteProduct(id);
      AdminToast.show("Product deleted.", "success");
      await this.load();
    } catch (e) {
      AdminToast.show("Delete failed: " + e.message, "error");
    }
  }
};

// ===== COUPONS =====
const AdminCoupons = {
  allCoupons: [],

  async load() {
    const tbody = document.getElementById("coupons-table-body");
    tbody.innerHTML = `<tr><td colspan="6" class="loading-state"><div class="spinner-admin"></div></td></tr>`;
    this.allCoupons = await Store.getCoupons();
    this.render();
  },

  render() {
    const tbody = document.getElementById("coupons-table-body");
    if (!this.allCoupons.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="table-empty-icon">🎟️</div><p>No coupons found</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = this.allCoupons.map(c => `
      <tr>
        <td><span style="font-family:monospace;font-weight:700;font-size:.88rem;color:var(--accent)">${c.code}</span></td>
        <td><span style="font-size:.85rem">${c.discountType === "percent" ? c.discountValue + "% off" : "₹" + c.discountValue + " off"}</span></td>
        <td><span style="font-size:.85rem">₹${c.minOrder || 0}</span></td>
        <td>${c.active !== false ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-inactive">Inactive</span>'}</td>
        <td>
          <button class="btn btn-sm ${c.active !== false ? 'btn-outline' : 'btn-success'}" onclick="AdminCoupons.toggleActive('${c.id}', ${c.active !== false})">
            ${c.active !== false ? "Deactivate" : "Activate"}
          </button>
        </td>
        <td>
          <button class="btn btn-danger btn-sm btn-icon" onclick="AdminCoupons.confirmDelete('${c.id}', '${c.code}')">🗑️</button>
        </td>
      </tr>
    `).join("");
  },

  openAdd() {
    document.getElementById("coupon-form").reset();
    document.getElementById("coupon-modal").classList.remove("hidden");
  },

  closeModal() {
    document.getElementById("coupon-modal").classList.add("hidden");
  },

  async save() {
    const f = document.getElementById("coupon-form");
    const code = f["c-code"].value.trim().toUpperCase();
    const discountValue = parseFloat(f["c-value"].value);
    if (!code || isNaN(discountValue)) {
      AdminToast.show("Coupon code and discount value are required.", "error");
      return;
    }
    const data = {
      code,
      discountType:  f["c-type"].value,
      discountValue: discountValue,
      minOrder:      parseFloat(f["c-min"].value) || 0,
      active:        true
    };
    const saveBtn = document.getElementById("coupon-save-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    try {
      await Store.addCoupon(data);
      AdminToast.show(`Coupon "${code}" created!`, "success");
      this.closeModal();
      await this.load();
    } catch (e) {
      AdminToast.show("Save failed: " + e.message, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Coupon";
    }
  },

  async toggleActive(id, currentlyActive) {
    try {
      await Store.updateCoupon(id, { active: !currentlyActive });
      AdminToast.show(`Coupon ${!currentlyActive ? "activated" : "deactivated"}.`, "success");
      await this.load();
    } catch (e) {
      AdminToast.show("Update failed: " + e.message, "error");
    }
  },

  async confirmDelete(id, code) {
    const confirmed = await AdminConfirm.show("Delete Coupon", `Delete coupon "${code}"?`, "🎟️");
    if (!confirmed) return;
    try {
      await Store.deleteCoupon(id);
      AdminToast.show("Coupon deleted.", "success");
      await this.load();
    } catch (e) {
      AdminToast.show("Delete failed: " + e.message, "error");
    }
  }
};

// ===== REFUNDS =====
const AdminRefunds = {
  allRefunds: [],

  async load() {
    const tbody = document.getElementById('refunds-table-body');
    tbody.innerHTML = `<tr><td colspan="8" class="loading-state"><div class="spinner-admin"></div></td></tr>`;
    this.allRefunds = await Store.getAllRefunds();
    // Update sidebar badge
    const pending = this.allRefunds.filter(r => r.status === 'Pending').length;
    const badge = document.getElementById('pending-refunds-badge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'inline-flex' : 'none';
    }
    this.render(this.allRefunds);
  },

  filter() {
    const q = (document.getElementById('refunds-search')?.value || '').toLowerCase();
    const status = document.getElementById('refunds-status-filter')?.value || 'all';
    const filtered = this.allRefunds.filter(r => {
      const matchStatus = status === 'all' || r.status === status;
      const matchQ = !q ||
        (r.orderId || '').toLowerCase().includes(q) ||
        (r.userEmail || '').toLowerCase().includes(q);
      return matchStatus && matchQ;
    });
    this.render(filtered);
  },

  render(list) {
    const tbody = document.getElementById('refunds-table-body');
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><div class="table-empty-icon">💸</div><p>No refund requests found</p></div></td></tr>`;
      return;
    }
    const statusBadge = {
      Pending:   'badge-pending',
      Processed: 'badge-delivered',
      Rejected:  'badge-cancelled'
    };
    tbody.innerHTML = list.map(r => {
      // Method label & details
      let methodIcon = '', methodLabel = '', detailText = '';
      if (r.method === 'upi') {
        methodIcon = '📱'; methodLabel = 'UPI';
        detailText = r.upiId || '—';
      } else if (r.method === 'bank') {
        methodIcon = '🏦'; methodLabel = 'Bank Transfer';
        detailText = `${r.accountHolder || ''} | ${r.accountNumber || ''} | IFSC: ${r.ifscCode || ''}`;
      } else if (r.method === 'credit') {
        methodIcon = '🎁'; methodLabel = 'Store Credit';
        detailText = r.email || '—';
      } else {
        methodLabel = r.method || '—';
      }

      const dt = r.submittedAt
        ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt))
        : null;
      const dateStr = dt ? dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

      return `<tr>
        <td><span style="font-family:monospace;font-size:.8rem;color:var(--accent)">#${(r.orderId||'').substring(0,8).toUpperCase()}</span></td>
        <td>
          <div style="font-size:.85rem;font-weight:600">${r.userEmail || '—'}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${r.userId ? r.userId.substring(0,8)+'...' : ''}</div>
        </td>
        <td><span style="font-weight:700;color:var(--accent)">\u20b9${Number(r.amount||0).toLocaleString('en-IN')}</span></td>
        <td><span style="font-size:.82rem">${methodIcon} ${methodLabel}</span></td>
        <td>
          <div style="font-size:.78rem;color:var(--text-muted);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${detailText}">${detailText}</div>
          ${r.adminNote ? `<div style="font-size:.72rem;color:var(--accent);margin-top:.2rem">Note: ${r.adminNote}</div>` : ''}
        </td>
        <td style="font-size:.82rem;color:var(--text-muted)">${dateStr}</td>
        <td><span class="badge ${statusBadge[r.status] || 'badge-pending'}">${r.status || 'Pending'}</span></td>
        <td>
          <select class="status-select" onchange="AdminRefunds.updateStatus('${r.orderId}', this.value, this)">
            <option value="Pending"   ${r.status==='Pending'  ?'selected':''}>Pending</option>
            <option value="Processed" ${r.status==='Processed'?'selected':''}>Processed</option>
            <option value="Rejected"  ${r.status==='Rejected' ?'selected':''}>Rejected</option>
          </select>
        </td>
      </tr>`;
    }).join('');
  },

  async updateStatus(orderId, newStatus, selectEl) {
    try {
      await Store.updateRefundStatus(orderId, newStatus);
      const r = this.allRefunds.find(x => x.orderId === orderId);
      if (r) r.status = newStatus;
      AdminToast.show(`Refund marked as "${newStatus}"`, 'success');
      this.render(this.allRefunds);
      // Refresh badge
      const pending = this.allRefunds.filter(x => x.status === 'Pending').length;
      const badge = document.getElementById('pending-refunds-badge');
      if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline-flex' : 'none'; }
    } catch (e) {
      AdminToast.show('Update failed: ' + e.message, 'error');
      selectEl.value = this.allRefunds.find(x => x.orderId === orderId)?.status || 'Pending';
    }
  }
};

// ===== RETURNS =====
const AdminReturns = {
  allReturns: [],

  async load() {
    const tbody = document.getElementById('returns-table-body');
    tbody.innerHTML = `<tr><td colspan="7" class="loading-state"><div class="spinner-admin"></div></td></tr>`;
    this.allReturns = await Store.getAllReturns();
    // Update sidebar badge
    const pending = this.allReturns.filter(r => r.status === 'Pending').length;
    const badge = document.getElementById('pending-returns-badge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'inline-flex' : 'none';
    }
    this.render(this.allReturns);
  },

  filter() {
    const q = (document.getElementById('returns-search')?.value || '').toLowerCase();
    const status = document.getElementById('returns-status-filter')?.value || 'all';
    const filtered = this.allReturns.filter(r => {
      const matchStatus = status === 'all' || r.status === status;
      const matchQ = !q ||
        (r.orderId || '').toLowerCase().includes(q) ||
        (r.userEmail || '').toLowerCase().includes(q);
      return matchStatus && matchQ;
    });
    this.render(filtered);
  },

  render(list) {
    const tbody = document.getElementById('returns-table-body');
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="table-empty-icon">↩️</div><p>No return requests found</p></div></td></tr>`;
      return;
    }
    const statusBadge = {
      Pending:   'badge-pending',
      Approved:  'badge-shipped',
      Rejected:  'badge-cancelled',
      Completed: 'badge-delivered'
    };
    tbody.innerHTML = list.map(r => {
      const dt = r.submittedAt
        ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt))
        : null;
      const dateStr = dt ? dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

      return `<tr>
        <td><span style="font-family:monospace;font-size:.8rem;color:var(--accent)">#${(r.orderId||'').substring(0,8).toUpperCase()}</span></td>
        <td>
          <div style="font-size:.85rem;font-weight:600">${r.userEmail || '—'}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${r.userId ? r.userId.substring(0,8)+'...' : ''}</div>
        </td>
        <td><span style="font-size:.82rem;font-weight:600;color:var(--text)">${r.reason || '—'}</span></td>
        <td>
          <div style="font-size:.78rem;color:var(--text-muted);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${(r.description||'').replace(/"/g,'&quot;')}">${r.description || '—'}</div>
          ${r.adminNote ? `<div style="font-size:.72rem;color:var(--accent);margin-top:.2rem">Note: ${r.adminNote}</div>` : ''}
        </td>
        <td style="font-size:.82rem;color:var(--text-muted)">${dateStr}</td>
        <td><span class="badge ${statusBadge[r.status] || 'badge-pending'}">${r.status || 'Pending'}</span></td>
        <td>
          <select class="status-select" onchange="AdminReturns.updateStatus('${r.orderId}', this.value, this)">
            <option value="Pending"   ${r.status==='Pending'  ?'selected':''}>Pending</option>
            <option value="Approved"  ${r.status==='Approved' ?'selected':''}>Approved</option>
            <option value="Rejected"  ${r.status==='Rejected' ?'selected':''}>Rejected</option>
            <option value="Completed" ${r.status==='Completed'?'selected':''}>Completed</option>
          </select>
        </td>
      </tr>`;
    }).join('');
  },

  async updateStatus(orderId, newStatus, selectEl) {
    try {
      await Store.updateReturnStatus(orderId, newStatus);
      const r = this.allReturns.find(x => x.orderId === orderId);
      if (r) r.status = newStatus;
      AdminToast.show(`Return marked as "${newStatus}"`, 'success');
      this.render(this.allReturns);
      // Refresh badge
      const pending = this.allReturns.filter(x => x.status === 'Pending').length;
      const badge = document.getElementById('pending-returns-badge');
      if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline-flex' : 'none'; }
    } catch (e) {
      AdminToast.show('Update failed: ' + e.message, 'error');
      selectEl.value = this.allReturns.find(x => x.orderId === orderId)?.status || 'Pending';
    }
  }
};

// ===== BOOT =====
document.addEventListener("DOMContentLoaded", async () => {
  // Run admin guard first — will redirect if not admin
  const user = await AdminGuard.init();

  // Set sidebar user info
  document.getElementById("sidebar-user-name").textContent = user.displayName || user.email || "Admin";
  document.getElementById("sidebar-avatar-letter").textContent = (user.displayName || user.email || "A")[0].toUpperCase();

  // Initial section
  AdminNav.go("dashboard");
});
