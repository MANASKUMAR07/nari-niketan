// =============================================
// NARI NIKETAN — Admin: Sellers Management
// =============================================
// This script extends the admin panel with
// seller application approval/rejection flow.

const AdminSellers = {
  allSellers: [],

  // Inject section HTML into admin-main
  injectSection() {
    const main = document.querySelector('.admin-main');
    if (!main || document.getElementById('section-sellers')) return;

    const section = document.createElement('section');
    section.className = 'admin-section';
    section.id = 'section-sellers';
    section.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">Sellers</h2>
          <p class="section-subtitle">Review and manage seller applications</p>
        </div>
        <button class="btn btn-outline" onclick="AdminSellers.load()">🔄 Refresh</button>
      </div>

      <!-- Filter Bar -->
      <div style="display:flex;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <input type="text" id="seller-search" placeholder="🔍 Search seller or store name…"
          style="flex:1;min-width:200px;padding:.6rem 1rem;background:var(--bg-card2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:.88rem;outline:none;"
          oninput="AdminSellers.filter()">
        <select id="seller-status-filter"
          style="padding:.6rem .9rem;background:var(--bg-card2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:.86rem;cursor:pointer;outline:none;"
          onchange="AdminSellers.filter()">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div class="table-wrapper" style="background:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border);overflow:hidden">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Seller / Store</th>
              <th>Category</th>
              <th>Contact</th>
              <th>GSTIN</th>
              <th>Applied On</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="sellers-tbody">
            <tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-dim)">Loading…</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Seller Detail Modal -->
      <div class="modal-overlay hidden" id="seller-detail-modal" style="display:flex;align-items:center;justify-content:center">
        <div class="modal-box" style="max-width:540px;width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:16px;max-height:90vh;overflow-y:auto">
          <div class="modal-header" style="padding:1.2rem 1.5rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--bg-card);z-index:1">
            <h3 id="seller-modal-title" style="font-size:1rem;font-weight:700">Seller Details</h3>
            <button onclick="AdminSellers.closeModal()" style="background:rgba(255,255,255,.06);border:none;color:var(--text-muted);width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem">✕</button>
          </div>
          <div class="modal-body" style="padding:1.5rem" id="seller-modal-body"></div>
          <div style="padding:1rem 1.5rem;border-top:1px solid var(--border);display:flex;gap:.75rem;justify-content:flex-end;position:sticky;bottom:0;background:var(--bg-card)" id="seller-modal-footer"></div>
        </div>
      </div>
    `;
    main.appendChild(section);

    // Register in AdminNav
    if (window.AdminNav) {
      AdminNav.pageTitles['sellers'] = '🏪 Sellers';
    }
  },

  async load() {
    this.injectSection();
    const tbody = document.getElementById('sellers-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-dim)">Loading…</td></tr>`;
    try {
      const snap = await db.collection('users')
        .where('sellerStatus', 'in', ['pending', 'approved', 'rejected', 'inactive'])
        .get();
      this.allSellers = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const t = u => u.createdAt?.toMillis?.() || u.createdAt?.seconds * 1000 || 0;
        return t(b) - t(a);
      });

      // Update pending badge
      const pending = this.allSellers.filter(s => s.sellerStatus === 'pending').length;
      const badge = document.getElementById('pending-sellers-badge');
      if (badge) {
        badge.textContent = pending;
        badge.style.display = pending > 0 ? 'inline-flex' : 'none';
      }

      this.renderTable(this.allSellers);
    } catch(e) {
      console.error('Sellers load:', e);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--error)">Failed to load sellers. Check Firestore rules.</td></tr>`;
    }
  },

  filter() {
    const q    = document.getElementById('seller-search')?.value.toLowerCase() || '';
    const stat = document.getElementById('seller-status-filter')?.value || '';
    const filtered = this.allSellers.filter(s => {
      const name  = ((s.displayName || '') + ' ' + (s.sellerProfile?.storeName || '')).toLowerCase();
      const matchQ  = !q    || name.includes(q) || (s.email || '').toLowerCase().includes(q);
      const matchSt = !stat || s.sellerStatus === stat;
      return matchQ && matchSt;
    });
    this.renderTable(filtered);
  },

  renderTable(sellers) {
    const tbody = document.getElementById('sellers-tbody');
    if (!sellers.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-dim)">No sellers found.</td></tr>`;
      return;
    }
    const stMap = { pending: 'status-pending', approved: 'status-delivered', rejected: 'status-cancelled', inactive: 'status-cancelled' };
    const fmtDate = ts => {
      if (!ts) return '—';
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    tbody.innerHTML = sellers.map(s => `
      <tr>
        <td>
          <div style="font-weight:600;font-size:.88rem">${s.sellerProfile?.storeName || '—'}</div>
          <div style="font-size:.78rem;color:var(--text-dim)">${s.displayName || s.email || ''}</div>
        </td>
        <td style="color:var(--text-muted);font-size:.84rem">${s.sellerProfile?.primaryCategory || '—'}</td>
        <td style="font-size:.82rem;color:var(--text-muted)">${s.email || '—'}<br>${s.phone || ''}</td>
        <td style="font-size:.82rem;color:var(--text-muted)">${s.sellerProfile?.gstin || '—'}</td>
        <td style="font-size:.82rem;color:var(--text-muted)">${fmtDate(s.createdAt)}</td>
        <td><span class="status-badge ${stMap[s.sellerStatus] || 'status-pending'}">${(s.sellerStatus || 'pending').charAt(0).toUpperCase() + (s.sellerStatus || 'pending').slice(1)}</span></td>
        <td>
          <div style="display:flex;gap:.4rem">
            <button class="btn btn-outline btn-sm" onclick="AdminSellers.viewDetail('${s.id}')">👁️ View</button>
            ${s.sellerStatus === 'pending' ? `
              <button class="btn btn-accent btn-sm" onclick="AdminSellers.approve('${s.id}')">✅ Approve</button>
              <button class="btn btn-danger btn-sm" onclick="AdminSellers.reject('${s.id}')">❌ Reject</button>
            ` : s.sellerStatus === 'approved' ? `
              <button class="btn btn-danger btn-sm" onclick="AdminSellers.revoke('${s.id}')">🚫 Revoke</button>
            ` : s.sellerStatus === 'rejected' || s.sellerStatus === 'inactive' ? `
              <button class="btn btn-accent btn-sm" onclick="AdminSellers.approve('${s.id}')">✅ Re-Approve</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  },

  viewDetail(uid) {
    const s = this.allSellers.find(x => x.id === uid);
    if (!s) return;
    const sp = s.sellerProfile || {};
    const fmtDate = ts => {
      if (!ts) return '—';
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    document.getElementById('seller-modal-title').textContent = sp.storeName || 'Seller Details';
    document.getElementById('seller-modal-body').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
          <div style="background:var(--bg-card2);border-radius:10px;padding:.9rem">
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.4rem">Store Name</div>
            <div style="font-weight:700">${sp.storeName || '—'}</div>
          </div>
          <div style="background:var(--bg-card2);border-radius:10px;padding:.9rem">
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.4rem">Category</div>
            <div style="font-weight:600">${sp.primaryCategory || '—'}</div>
          </div>
          <div style="background:var(--bg-card2);border-radius:10px;padding:.9rem">
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.4rem">Owner Name</div>
            <div style="font-weight:600">${s.displayName || (s.firstName + ' ' + s.lastName) || '—'}</div>
          </div>
          <div style="background:var(--bg-card2);border-radius:10px;padding:.9rem">
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.4rem">Phone</div>
            <div style="font-weight:600">${s.phone || '—'}</div>
          </div>
          <div style="background:var(--bg-card2);border-radius:10px;padding:.9rem">
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.4rem">Email</div>
            <div style="font-weight:600;word-break:break-all">${s.email || '—'}</div>
          </div>
          <div style="background:var(--bg-card2);border-radius:10px;padding:.9rem">
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.4rem">GSTIN</div>
            <div style="font-weight:600">${sp.gstin || 'Not provided'}</div>
          </div>
        </div>
        <div style="background:var(--bg-card2);border-radius:10px;padding:.9rem">
          <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.4rem">Business Description</div>
          <div style="font-size:.88rem;color:var(--text-muted);line-height:1.6">${sp.description || '—'}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
          <div style="background:var(--bg-card2);border-radius:10px;padding:.9rem">
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.4rem">Applied On</div>
            <div style="font-weight:600">${fmtDate(s.createdAt)}</div>
          </div>
          <div style="background:var(--bg-card2);border-radius:10px;padding:.9rem">
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin-bottom:.4rem">Status</div>
            <div style="font-weight:700;color:${s.sellerStatus === 'approved' ? '#22C55E' : s.sellerStatus === 'pending' ? '#F59E0B' : '#EF4444'}">${(s.sellerStatus || '').toUpperCase()}</div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('seller-modal-footer').innerHTML = `
      <button class="btn btn-outline" onclick="AdminSellers.closeModal()">Close</button>
      ${s.sellerStatus === 'pending' ? `
        <button class="btn btn-danger" onclick="AdminSellers.reject('${s.id}');AdminSellers.closeModal()">❌ Reject</button>
        <button class="btn btn-accent" onclick="AdminSellers.approve('${s.id}');AdminSellers.closeModal()">✅ Approve</button>
      ` : s.sellerStatus === 'approved' ? `
        <button class="btn btn-danger" onclick="AdminSellers.revoke('${s.id}');AdminSellers.closeModal()">🚫 Revoke Approval</button>
      ` : `
        <button class="btn btn-accent" onclick="AdminSellers.approve('${s.id}');AdminSellers.closeModal()">✅ Re-Approve</button>
      `}
    `;
    const modal = document.getElementById('seller-detail-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  },

  closeModal() {
    const modal = document.getElementById('seller-detail-modal');
    if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
  },

  async approve(uid) {
    const confirmed = await AdminConfirm.show('Approve Seller?', 'This seller will be able to list products on the store.', '✅');
    if (!confirmed) return;
    try {
      await db.collection('users').doc(uid).update({
        sellerStatus: 'approved',
        isSeller: true,
        sellerApprovedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      const s = this.allSellers.find(x => x.id === uid);
      if (s) { s.sellerStatus = 'approved'; s.isSeller = true; }
      this.renderTable(this.allSellers);
      // Update products to reflect approved status
      await db.collection('products').where('sellerId', '==', uid).get().then(snap => {
        const batch = db.batch();
        snap.docs.forEach(d => batch.update(d.ref, { sellerStatus: 'approved' }));
        return batch.commit();
      });
      AdminToast.show('Seller approved successfully!', 'success');
    } catch(e) {
      console.error('Approve seller error:', e);
      AdminToast.show('Failed to approve seller', 'error');
    }
  },

  async reject(uid) {
    const confirmed = await AdminConfirm.show('Reject Seller?', 'The seller application will be rejected and their products hidden.', '❌');
    if (!confirmed) return;
    try {
      await db.collection('users').doc(uid).update({
        sellerStatus: 'rejected',
        isSeller: false,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      const s = this.allSellers.find(x => x.id === uid);
      if (s) { s.sellerStatus = 'rejected'; s.isSeller = false; }
      // Hide their products
      await db.collection('products').where('sellerId', '==', uid).get().then(snap => {
        const batch = db.batch();
        snap.docs.forEach(d => batch.update(d.ref, { active: false, sellerStatus: 'rejected' }));
        return batch.commit();
      });
      this.renderTable(this.allSellers);
      AdminToast.show('Seller rejected.', 'warning');
    } catch(e) {
      AdminToast.show('Failed to reject seller', 'error');
    }
  },

  async revoke(uid) {
    const confirmed = await AdminConfirm.show('Revoke Seller Approval?', 'This seller will lose their ability to list products. Their products will be hidden.', '🚫');
    if (!confirmed) return;
    try {
      await db.collection('users').doc(uid).update({
        sellerStatus: 'inactive',
        isSeller: false,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      const s = this.allSellers.find(x => x.id === uid);
      if (s) { s.sellerStatus = 'inactive'; s.isSeller = false; }
      await db.collection('products').where('sellerId', '==', uid).get().then(snap => {
        const batch = db.batch();
        snap.docs.forEach(d => batch.update(d.ref, { active: false }));
        return batch.commit();
      });
      this.renderTable(this.allSellers);
      AdminToast.show('Seller approval revoked.', 'warning');
    } catch(e) {
      AdminToast.show('Failed to revoke seller', 'error');
    }
  }
};

// Hook into AdminNav to load sellers when navigating
document.addEventListener('DOMContentLoaded', () => {
  // Inject section immediately
  AdminSellers.injectSection();

  // Patch AdminNav.go to handle 'sellers'
  const origGo = AdminNav.go.bind(AdminNav);
  AdminNav.go = function(section) {
    origGo(section);
    if (section === 'sellers') AdminSellers.load();
  };

  // Register in pageTitles
  AdminNav.pageTitles['sellers'] = '🏪 Sellers';

  // Load pending count for badge after admin guard passes
  auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    try {
      const snap = await db.collection('users').where('sellerStatus', '==', 'pending').get();
      const badge = document.getElementById('pending-sellers-badge');
      if (badge && snap.size > 0) { badge.textContent = snap.size; badge.style.display = 'inline-flex'; }
    } catch(e) { /* ignore */ }
  });
});
