// =======================================================
// NARI NIKETAN — Delivery Partner Client Logic & State Engine
// =======================================================

const DeliveryGuard = {
  currentUser: null,
  partnerData: null,

  async init() {
    return new Promise((resolve) => {
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          window.location.replace('login.html');
          return;
        }

        try {
          const doc = await db.collection('users').doc(user.uid).get();
          if (!doc.exists) {
            window.location.replace('login.html');
            return;
          }

          const data = doc.data();

          // Role validation: strictly Delivery Partner
          if (!data.isDeliveryPartner && data.deliveryPartnerStatus !== 'approved' && data.deliveryPartnerStatus !== 'active') {
            await auth.signOut();
            window.location.replace('login.html');
            return;
          }

          this.currentUser = user;
          this.partnerData = data;

          // Remove flash-prevention guard style if present
          const s = document.getElementById('delivery-auth-guard-style');
          if (s) s.remove();

          resolve({ user, data });
        } catch (e) {
          console.error('DeliveryGuard initialization error:', e);
          window.location.replace('login.html');
        }
      });
    });
  }
};

// ─── TOAST NOTIFICATIONS ──────────────────────────────
const DeliveryToast = {
  show(message, type = 'default', duration = 3500) {
    const container = document.getElementById('delivery-toast-container');
    if (!container) return;
    const icons = { success: '✅', error: '❌', warning: '⚠️', default: '🔔' };
    const toast = document.createElement('div');
    toast.className = `delivery-toast ${type}`;
    toast.innerHTML = `
      <span>${icons[type] || icons.default}</span>
      <span style="flex:1;">${message}</span>
      <button style="background:transparent;border:none;color:#fff;cursor:pointer;font-size:1rem;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast && toast.parentElement) toast.remove();
    }, duration);
  }
};

// ─── NAVIGATION MANAGER ───────────────────────────────
const DeliveryNav = {
  currentSection: 'dashboard',

  go(section) {
    document.querySelectorAll('.delivery-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetSection = document.getElementById(`section-${section}`);
    if (targetSection) targetSection.classList.add('active');

    const navBtn = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (navBtn) navBtn.classList.add('active');

    this.currentSection = section;

    // Trigger data refreshes
    if (section === 'dashboard') DeliveryDashboard.load();
    if (section === 'deliveries') DeliveryQueue.load();
    if (section === 'active') DeliveryActive.load();
    if (section === 'earnings') DeliveryEarnings.load();
    if (section === 'profile') DeliveryProfile.load();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// ─── SHIFT & AVAILABILITY STATUS ──────────────────────
const DeliveryShift = {
  currentStatus: 'offline',

  init(status = 'available') {
    this.currentStatus = status;
    this.render();
  },

  render() {
    const pill = document.getElementById('shift-status-pill');
    const label = document.getElementById('shift-status-text');
    if (!pill || !label) return;

    pill.className = `shift-status-pill ${this.currentStatus}`;
    if (this.currentStatus === 'available' || this.currentStatus === 'online') {
      label.textContent = 'Available';
    } else if (this.currentStatus === 'on_delivery') {
      label.textContent = 'On Delivery';
    } else {
      label.textContent = 'Offline';
    }
  },

  async toggle() {
    const next = (this.currentStatus === 'available' || this.currentStatus === 'online') ? 'offline' : 'available';
    this.currentStatus = next;
    this.render();

    try {
      if (DeliveryGuard.currentUser) {
        await db.collection('users').doc(DeliveryGuard.currentUser.uid).update({
          shiftStatus: next,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        DeliveryToast.show(`Status updated to ${next.toUpperCase()}`, 'success');
      }
    } catch (e) {
      console.error('Error toggling shift status:', e);
      DeliveryToast.show('Failed to sync status online', 'error');
    }
  }
};

// ─── DASHBOARD MODULE ─────────────────────────────────
const DeliveryDashboard = {
  async load() {
    if (!DeliveryGuard.currentUser) return;
    const partnerId = DeliveryGuard.currentUser.uid;
    const profile = DeliveryGuard.partnerData;

    // Greeting
    const nameEl = document.getElementById('dashboard-greeting-name');
    if (nameEl) nameEl.textContent = profile.displayName || profile.firstName || 'Partner';

    try {
      const orders = await Store.getAssignedDeliveries(partnerId);
      const earnings = await Store.getDeliveryPartnerEarnings(partnerId);

      let pendingCount = 0;
      let outCount = 0;
      let completedToday = 0;
      let activeOrder = null;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      orders.forEach(o => {
        const state = o.deliveryState || 'assigned';
        if (state === 'assigned' || state === 'accepted' || state === 'reached_store' || state === 'picked_up') {
          pendingCount++;
          if (!activeOrder && state !== 'assigned') activeOrder = o;
        }
        if (state === 'out_for_delivery' || state === 'reached_customer') {
          outCount++;
          activeOrder = o; // Prioritize out for delivery order
        }
        if (o.status === 'Delivered') {
          const dMs = o.deliveredAt?.toMillis?.() || (o.deliveredAt?.seconds ? o.deliveredAt.seconds * 1000 : 0);
          if (dMs >= startOfDay) completedToday++;
        }
      });

      // Update UI counts
      const elToday = document.getElementById('stat-today-deliveries');
      const elPending = document.getElementById('stat-pending-deliveries');
      const elOut = document.getElementById('stat-out-deliveries');
      const elCompleted = document.getElementById('stat-completed-deliveries');
      const elEarnings = document.getElementById('stat-today-earnings');
      const navBadge = document.getElementById('nav-badge-deliveries');

      if (elToday) elToday.textContent = orders.length;
      if (elPending) elPending.textContent = pendingCount;
      if (elOut) elOut.textContent = outCount;
      if (elCompleted) elCompleted.textContent = completedToday;
      if (elEarnings) elEarnings.textContent = `₹${earnings.todayEarnings || 0}`;

      if (navBadge) {
        const unhandled = pendingCount + outCount;
        navBadge.textContent = unhandled;
        navBadge.style.display = unhandled > 0 ? 'inline-block' : 'none';
      }

      // Render Active Delivery Hero Card
      const heroBox = document.getElementById('dashboard-active-hero');
      if (heroBox) {
        if (activeOrder) {
          heroBox.style.display = 'block';
          heroBox.innerHTML = `
            <div class="active-delivery-card">
              <div class="active-delivery-header">
                <div>
                  <span class="active-order-id">#${activeOrder.id.substring(0,8).toUpperCase()}</span>
                  <div style="font-size:0.75rem; color:var(--text-muted);">Assigned Delivery</div>
                </div>
                <span class="delivery-badge badge-${activeOrder.deliveryState || 'assigned'}">${(activeOrder.deliveryState || 'assigned').replace('_', ' ')}</span>
              </div>
              <div class="customer-name">👤 ${activeOrder.shippingAddress?.fullName || activeOrder.customerName || 'Customer'}</div>
              <div class="customer-address">📍 ${activeOrder.shippingAddress?.addressLine || activeOrder.shippingAddress?.address || 'Address provided on file'}, ${activeOrder.shippingAddress?.city || ''} (${activeOrder.shippingAddress?.pincode || ''})</div>
              
              <div class="cod-badge-box">
                <span class="cod-badge-label">Payment Method: ${activeOrder.paymentMethod === 'cod' ? '💵 Cash on Delivery' : '💳 Prepaid (Online)'}</span>
                <span class="cod-badge-amount">₹${activeOrder.totalAmount || 0}</span>
              </div>

              <button class="btn-delivery btn-delivery-primary" onclick="DeliveryActive.selectOrder('${activeOrder.id}')">
                ⚡ Process Delivery Order →
              </button>
            </div>
          `;
        } else {
          heroBox.style.display = 'none';
        }
      }
    } catch (e) {
      console.error('Error loading dashboard stats:', e);
    }
  }
};

// ─── QUEUE MODULE ─────────────────────────────────────
const DeliveryQueue = {
  currentTab: 'all',
  allOrders: [],

  async load() {
    if (!DeliveryGuard.currentUser) return;
    const partnerId = DeliveryGuard.currentUser.uid;
    const container = document.getElementById('queue-orders-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Loading your deliveries...</div>';

    try {
      this.allOrders = await Store.getAssignedDeliveries(partnerId);
      this.render();
    } catch (e) {
      console.error('Error loading queue:', e);
      container.innerHTML = '<div style="text-align:center; padding:2rem; color:#F87171;">Failed to load deliveries.</div>';
    }
  },

  setTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.queue-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    this.render();
  },

  render() {
    const container = document.getElementById('queue-orders-list');
    if (!container) return;

    let filtered = this.allOrders;
    if (this.currentTab === 'new') {
      filtered = this.allOrders.filter(o => o.deliveryState === 'assigned');
    } else if (this.currentTab === 'accepted') {
      filtered = this.allOrders.filter(o => ['accepted', 'reached_store', 'picked_up'].includes(o.deliveryState));
    } else if (this.currentTab === 'out') {
      filtered = this.allOrders.filter(o => ['out_for_delivery', 'reached_customer'].includes(o.deliveryState));
    } else if (this.currentTab === 'completed') {
      filtered = this.allOrders.filter(o => o.status === 'Delivered' || o.deliveryState === 'delivered');
    } else if (this.currentTab === 'failed') {
      filtered = this.allOrders.filter(o => ['failed', 'customer_unavailable', 'wrong_address', 'customer_cancelled', 'rejected', 'returned_to_store'].includes(o.deliveryState));
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">📦</div>
          <div style="font-weight:700; color:#fff;">No deliveries in this section</div>
          <div style="font-size:0.8rem; margin-top:0.25rem;">Orders assigned to you will show up here immediately.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(o => {
      const state = o.deliveryState || 'assigned';
      const isCod = o.paymentMethod === 'cod';
      const itemsCount = (o.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

      return `
        <div class="delivery-card">
          <div class="delivery-card-header">
            <span style="font-family:monospace; font-weight:800; color:var(--gold);">#${o.id.substring(0,8).toUpperCase()}</span>
            <span class="delivery-badge badge-${state}">${state.replace(/_/g, ' ')}</span>
          </div>

          <div style="font-size:1rem; font-weight:800; color:#fff; margin-bottom:0.25rem;">
            👤 ${o.shippingAddress?.fullName || o.customerName || 'Customer'}
          </div>

          <div style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.5rem; line-height:1.4;">
            📍 ${o.shippingAddress?.addressLine || o.shippingAddress?.address || 'Address on file'}, ${o.shippingAddress?.city || ''} (${o.shippingAddress?.pincode || ''})
          </div>

          <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); border-top:1px solid rgba(255,255,255,0.06); padding-top:0.5rem; margin-bottom:0.75rem;">
            <span>📦 ${itemsCount} Item${itemsCount !== 1 ? 's' : ''}</span>
            <span style="font-weight:700; color:${isCod ? '#FBBF24' : '#34D399'};">
              ${isCod ? `💵 COD: ₹${o.totalAmount || 0}` : `💳 Prepaid: ₹${o.totalAmount || 0}`}
            </span>
          </div>

          ${state === 'assigned' ? `
            <div class="action-row">
              <button class="btn-delivery btn-delivery-success" onclick="DeliveryActive.acceptOrder('${o.id}')">
                ✓ Accept
              </button>
              <button class="btn-delivery btn-delivery-danger" onclick="DeliveryActive.openRejectModal('${o.id}')">
                ✕ Decline
              </button>
            </div>
          ` : `
            <button class="btn-delivery btn-delivery-primary" onclick="DeliveryActive.selectOrder('${o.id}')">
              Open Delivery Details →
            </button>
          `}
        </div>
      `;
    }).join('');
  }
};

// ─── ACTIVE DELIVERY EXECUTION ENGINE ─────────────────
const DeliveryActive = {
  currentOrder: null,

  async selectOrder(orderId) {
    DeliveryNav.go('active');
    await this.loadOrder(orderId);
  },

  async load() {
    if (!this.currentOrder && DeliveryGuard.currentUser) {
      const orders = await Store.getAssignedDeliveries(DeliveryGuard.currentUser.uid);
      const active = orders.find(o => !['delivered', 'rejected', 'returned_to_store'].includes(o.deliveryState));
      if (active) {
        await this.loadOrder(active.id);
      } else {
        this.renderEmpty();
      }
    }
  },

  async loadOrder(orderId) {
    const wrap = document.getElementById('active-order-content');
    if (!wrap) return;

    wrap.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Loading delivery order...</div>';

    try {
      const doc = await db.collection('orders').doc(orderId).get();
      if (!doc.exists) {
        this.renderEmpty();
        return;
      }

      this.currentOrder = { id: doc.id, ...doc.data() };
      this.render();
    } catch (e) {
      console.error('Error loading order:', e);
      wrap.innerHTML = '<div style="text-align:center; padding:2rem; color:#F87171;">Failed to load order.</div>';
    }
  },

  renderEmpty() {
    const wrap = document.getElementById('active-order-content');
    if (!wrap) return;
    wrap.innerHTML = `
      <div style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted);">
        <div style="font-size:3rem; margin-bottom:0.75rem;">🛵</div>
        <h3 style="font-size:1.15rem; color:#fff; font-weight:800; margin-bottom:0.35rem;">No Active Delivery</h3>
        <p style="font-size:0.85rem; margin-bottom:1.5rem;">Select an assigned order from your Deliveries queue to begin.</p>
        <button class="btn-delivery btn-delivery-primary" onclick="DeliveryNav.go('deliveries')">
          View Deliveries Queue
        </button>
      </div>
    `;
  },

  render() {
    const wrap = document.getElementById('active-order-content');
    if (!wrap || !this.currentOrder) return;

    const o = this.currentOrder;
    const state = o.deliveryState || 'assigned';
    const isCod = o.paymentMethod === 'cod';
    const phone = o.shippingAddress?.phone || o.customerPhone || '';
    const fullAddress = `${o.shippingAddress?.addressLine || o.shippingAddress?.address || ''}, ${o.shippingAddress?.city || ''}, ${o.shippingAddress?.state || ''} - ${o.shippingAddress?.pincode || ''}`;

    wrap.innerHTML = `
      <div class="active-delivery-card" style="margin-top:0.5rem;">
        <div class="active-delivery-header">
          <div>
            <span class="active-order-id">#${o.id.substring(0,8).toUpperCase()}</span>
            <div style="font-size:0.75rem; color:var(--text-muted);">Order Target</div>
          </div>
          <span class="delivery-badge badge-${state}">${state.replace(/_/g, ' ')}</span>
        </div>

        <div style="font-size:1.1rem; font-weight:800; color:#fff; margin-bottom:0.25rem;">
          👤 ${o.shippingAddress?.fullName || o.customerName || 'Customer'}
        </div>

        <div style="font-size:0.88rem; color:var(--text-muted); margin-bottom:0.85rem; line-height:1.45;">
          📍 ${fullAddress}
        </div>

        <!-- CONTACT & NAVIGATION ACTIONS -->
        <div class="action-row" style="margin-bottom:1rem;">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}" target="_blank" rel="noopener" class="btn-delivery btn-delivery-outline">
            🧭 Navigate in Maps
          </a>
          <a href="tel:${phone}" class="btn-delivery btn-delivery-outline">
            📞 Call Customer
          </a>
        </div>

        <!-- PAYMENT STATUS -->
        <div class="cod-badge-box">
          <div>
            <div class="cod-badge-label">Payment: ${isCod ? '💵 CASH ON DELIVERY' : '💳 ONLINE PREPAID'}</div>
            ${isCod ? `<div style="font-size:0.72rem; color:${o.codCollected ? '#34D399' : '#FDE68A'};">${o.codCollected ? '✅ Payment Already Collected' : '⚠️ Collect exact cash from customer'}</div>` : ''}
          </div>
          <div class="cod-badge-amount">₹${o.totalAmount || 0}</div>
        </div>

        <!-- ITEMS BREAKDOWN -->
        <div style="background:rgba(0,0,0,0.3); border-radius:var(--radius-sm); padding:0.75rem; margin-bottom:1.25rem;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--gold); text-transform:uppercase; margin-bottom:0.5rem;">Package Items (${(o.items || []).length})</div>
          ${(o.items || []).map(i => `
            <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:0.35rem; color:#fff;">
              <span>${i.name || i.title || 'Ethnic Product'} × ${i.quantity || 1}</span>
              <span style="font-weight:700; color:var(--gold);">₹${(i.price || 0) * (i.quantity || 1)}</span>
            </div>
          `).join('')}
        </div>

        <!-- STATE TRANSITION ACTIONS -->
        <div style="display:flex; flex-direction:column; gap:0.65rem;">
          ${state === 'assigned' ? `
            <button class="btn-delivery btn-delivery-success" onclick="DeliveryActive.acceptOrder('${o.id}')">
              ✓ Accept Delivery Assignment
            </button>
            <button class="btn-delivery btn-delivery-danger" onclick="DeliveryActive.openRejectModal('${o.id}')">
              ✕ Decline Assignment
            </button>
          ` : ''}

          ${state === 'accepted' ? `
            <button class="btn-delivery btn-delivery-warning" onclick="DeliveryActive.updateState('${o.id}', 'reached_store')">
              🏪 Reached Store / Merchant
            </button>
          ` : ''}

          ${state === 'reached_store' ? `
            <button class="btn-delivery btn-delivery-primary" onclick="DeliveryActive.updateState('${o.id}', 'picked_up')">
              📦 Confirm Package Picked Up
            </button>
          ` : ''}

          ${state === 'picked_up' ? `
            <button class="btn-delivery btn-delivery-primary" onclick="DeliveryActive.updateState('${o.id}', 'out_for_delivery')">
              🛵 Start Journey (Out for Delivery)
            </button>
          ` : ''}

          ${state === 'out_for_delivery' ? `
            <button class="btn-delivery btn-delivery-warning" onclick="DeliveryActive.updateState('${o.id}', 'reached_customer')">
              📍 Reached Customer Doorstep
            </button>
          ` : ''}

          ${state === 'reached_customer' || state === 'out_for_delivery' ? `
            <button class="btn-delivery btn-delivery-success" onclick="DeliveryActive.openOtpKeypad('${o.id}', ${isCod})">
              🔐 Verify Customer OTP & Complete Delivery
            </button>
            <button class="btn-delivery btn-delivery-danger" onclick="DeliveryActive.openFailureModal('${o.id}')">
              ⚠️ Report Delivery Issue / Unavailable
            </button>
          ` : ''}

          ${state === 'delivered' ? `
            <div style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.4); border-radius:var(--radius-md); padding:1rem; text-align:center; color:#34D399; font-weight:800;">
              🎉 Order Successfully Delivered & Verified
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  async acceptOrder(orderId) {
    try {
      await Store.updateDeliveryState(orderId, DeliveryGuard.currentUser.uid, 'accepted');
      DeliveryToast.show('Order accepted! Proceed to pickup store.', 'success');
      await this.loadOrder(orderId);
      DeliveryDashboard.load();
    } catch (e) {
      DeliveryToast.show(e.message || 'Failed to accept order', 'error');
    }
  },

  async updateState(orderId, nextState, metadata = {}) {
    try {
      await Store.updateDeliveryState(orderId, DeliveryGuard.currentUser.uid, nextState, metadata);
      DeliveryToast.show(`Status updated to ${nextState.replace(/_/g, ' ').toUpperCase()}`, 'success');
      await this.loadOrder(orderId);
      DeliveryDashboard.load();
    } catch (e) {
      DeliveryToast.show(e.message || 'State update failed', 'error');
    }
  },

  openRejectModal(orderId) {
    const modal = document.getElementById('modal-reject-reason');
    if (modal) {
      modal.dataset.orderId = orderId;
      modal.classList.add('open');
    }
  },

  async confirmReject() {
    const modal = document.getElementById('modal-reject-reason');
    const orderId = modal.dataset.orderId;
    const reason = document.getElementById('reject-reason-select').value;
    
    try {
      await Store.updateDeliveryState(orderId, DeliveryGuard.currentUser.uid, 'rejected', { reason });
      modal.classList.remove('open');
      DeliveryToast.show('Order assignment declined.', 'warning');
      this.currentOrder = null;
      DeliveryNav.go('deliveries');
    } catch (e) {
      DeliveryToast.show(e.message || 'Failed to decline order', 'error');
    }
  },

  openFailureModal(orderId) {
    const modal = document.getElementById('modal-failure-reason');
    if (modal) {
      modal.dataset.orderId = orderId;
      modal.classList.add('open');
    }
  },

  async confirmFailure() {
    const modal = document.getElementById('modal-failure-reason');
    const orderId = modal.dataset.orderId;
    const reason = document.getElementById('failure-reason-select').value;
    const notes = document.getElementById('failure-notes').value;

    try {
      await Store.updateDeliveryState(orderId, DeliveryGuard.currentUser.uid, 'failed', { reason, notes });
      modal.classList.remove('open');
      DeliveryToast.show('Delivery issue recorded.', 'warning');
      await this.loadOrder(orderId);
      DeliveryDashboard.load();
    } catch (e) {
      DeliveryToast.show(e.message || 'Failed to record issue', 'error');
    }
  },

  openOtpKeypad(orderId, isCod) {
    const modal = document.getElementById('modal-otp-keypad');
    if (!modal) return;
    modal.dataset.orderId = orderId;
    modal.dataset.isCod = isCod ? '1' : '0';
    document.getElementById('otp-code-input').value = '';
    const codBox = document.getElementById('otp-cod-confirm-box');
    if (codBox) codBox.style.display = isCod ? 'block' : 'none';
    modal.classList.add('open');
    setTimeout(() => {
      document.getElementById('otp-code-input').focus();
    }, 200);
  },

  async submitOtpVerification() {
    const modal = document.getElementById('modal-otp-keypad');
    const orderId = modal.dataset.orderId;
    const isCod = modal.dataset.isCod === '1';
    const otp = document.getElementById('otp-code-input').value.trim();
    const codCheckbox = document.getElementById('otp-cod-collected-checkbox');

    if (!otp || otp.length < 4) {
      DeliveryToast.show('Please enter the 6-digit OTP from customer', 'error');
      return;
    }

    if (isCod && codCheckbox && !codCheckbox.checked) {
      DeliveryToast.show('Please confirm Cash on Delivery payment has been collected', 'warning');
      return;
    }

    try {
      await Store.updateDeliveryState(orderId, DeliveryGuard.currentUser.uid, 'delivered', {
        enteredOtp: otp,
        codCollected: isCod
      });

      modal.classList.remove('open');
      DeliveryToast.show('🎉 Order Verified & Delivered successfully!', 'success');
      await this.loadOrder(orderId);
      DeliveryDashboard.load();
    } catch (e) {
      DeliveryToast.show(e.message || 'Invalid OTP. Please recheck with customer.', 'error');
    }
  }
};

// ─── EARNINGS MODULE ──────────────────────────────────
const DeliveryEarnings = {
  async load() {
    if (!DeliveryGuard.currentUser) return;
    const partnerId = DeliveryGuard.currentUser.uid;

    try {
      const stats = await Store.getDeliveryPartnerEarnings(partnerId);
      const payouts = await Store.getDeliveryPartnerPayouts(partnerId);

      const elToday = document.getElementById('earn-today');
      const elWeek = document.getElementById('earn-week');
      const elMonth = document.getElementById('earn-month');
      const elTotal = document.getElementById('earn-total');
      const elCod = document.getElementById('earn-cod-collected');
      const elDeliveries = document.getElementById('earn-total-trips');
      const payoutList = document.getElementById('earn-payouts-list');

      if (elToday) elToday.textContent = `₹${stats.todayEarnings || 0}`;
      if (elWeek) elWeek.textContent = `₹${stats.weekEarnings || 0}`;
      if (elMonth) elMonth.textContent = `₹${stats.monthEarnings || 0}`;
      if (elTotal) elTotal.textContent = `₹${stats.totalEarnings || 0}`;
      if (elCod) elCod.textContent = `₹${stats.totalCodCollected || 0}`;
      if (elDeliveries) elDeliveries.textContent = stats.totalOrders || 0;

      if (payoutList) {
        if (payouts.length === 0) {
          payoutList.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No past payouts recorded yet. Payouts are processed weekly.</div>';
        } else {
          payoutList.innerHTML = payouts.map(p => {
            const dateStr = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('en-IN') : 'Recent';
            return `
              <div style="background:var(--bg-card); border:1px solid var(--border-soft); border-radius:var(--radius-sm); padding:0.75rem 1rem; margin-bottom:0.5rem; display:flex; align-items:center; justify-content:space-between;">
                <div>
                  <div style="font-weight:800; color:#fff; font-size:0.9rem;">₹${p.amount || 0}</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">${p.notes || 'Weekly Payout'} • ${dateStr}</div>
                </div>
                <span class="delivery-badge badge-delivered">Processed</span>
              </div>
            `;
          }).join('');
        }
      }
    } catch (e) {
      console.error('Error loading earnings:', e);
    }
  }
};

// ─── PROFILE MODULE ───────────────────────────────────
const DeliveryProfile = {
  load() {
    if (!DeliveryGuard.partnerData) return;
    const p = DeliveryGuard.partnerData;
    const dp = p.deliveryProfile || {};

    const nameEl = document.getElementById('profile-name');
    const phoneEl = document.getElementById('profile-phone');
    const emailEl = document.getElementById('profile-email');
    const vehicleEl = document.getElementById('profile-vehicle');
    const zoneEl = document.getElementById('profile-zone');
    const ratingEl = document.getElementById('profile-rating');

    if (nameEl) nameEl.textContent = p.displayName || p.firstName || 'Partner';
    if (phoneEl) phoneEl.textContent = p.phone || 'N/A';
    if (emailEl) emailEl.textContent = p.email || 'N/A';
    if (vehicleEl) vehicleEl.textContent = `${dp.vehicleType || 'Vehicle'} (${dp.vehicleNumber || 'Registered'})`;
    if (zoneEl) zoneEl.textContent = dp.zone || 'Sonbhadra Zone';
    if (ratingEl) ratingEl.textContent = `⭐ ${dp.rating || '5.0'}`;
  },

  async logout() {
    try {
      await auth.signOut();
      window.location.replace('login.html');
    } catch (e) {
      console.error('Logout error:', e);
    }
  }
};

// Auto-initialize upon script load
document.addEventListener('DOMContentLoaded', async () => {
  const authRes = await DeliveryGuard.init();
  if (authRes) {
    DeliveryShift.init(authRes.data.shiftStatus || 'available');
    DeliveryNav.go('dashboard');
  }
});
