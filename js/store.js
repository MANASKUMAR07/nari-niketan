// =============================================
// NARI NIKETAN — Firestore Data Layer
// =============================================

const Store = {
  // ── In-memory cache to avoid repeat Firestore reads in the same session ──
  _cache: {},

  clearCache() {
    this._cache = {};
  },

  _sortByDate(list) {
    return list.sort((a, b) => {
      const ms = p => {
        if (!p) return 0;
        if (p.createdAt && p.createdAt.toMillis) return p.createdAt.toMillis();
        if (p.createdAt && p.createdAt.seconds) return p.createdAt.seconds * 1000;
        return 0;
      };
      return ms(b) - ms(a);
    });
  },

  // ===== PRODUCTS =====
  async getProducts(filters = {}) {
    try {
      const cacheKey = JSON.stringify(filters);
      if (this._cache[cacheKey]) return this._cache[cacheKey];

      // NOTE: We don't filter active==true in Firestore because legacy products
      // may not have the 'active' field at all. We filter client-side instead.
      let query = db.collection("products");
      if (filters.category && filters.category !== "All") {
        query = query.where("category", "==", filters.category);
      }
      if (filters.featured) {
        query = query.where("featured", "==", true);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      const snap = await query.get();
      // Client-side: exclude products explicitly marked inactive (active===false)
      const list = this._sortByDate(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.active !== false)
      );
      this._cache[cacheKey] = list;
      setTimeout(() => { delete this._cache[cacheKey]; }, 5 * 60 * 1000);
      return list;
    } catch (e) {
      console.error("getProducts error:", e.code, e.message);
      return [];
    }
  },

  // ⚡ FAST LOAD: Show cached data instantly, then sync live updates in background.
  // Strategy:
  //   1. Serve from Firestore DISK CACHE immediately (0ms, no network) → renders instantly
  //   2. onSnapshot fires again from SERVER when network responds → updates silently
  //   3. Only triggers callback when product count or IDs change (avoids re-rendering
  //      on every heartbeat just because base64 images are large)
  subscribeProducts(filters = {}, callback) {
    try {
      // NOTE: We don't filter active==true in Firestore because legacy products
      // may not have the 'active' field. Filter client-side to exclude active===false.
      let query = db.collection("products");
      if (filters.category && filters.category !== "All") {
        query = query.where("category", "==", filters.category);
      }
      if (filters.featured) {
        query = query.where("featured", "==", true);
      }

      let lastSignature = null;

      return query.onSnapshot(
        { includeMetadataChanges: false },
        (snap) => {
          const signature = snap.docs.map(d => d.id + (d.data().updatedAt?.seconds || '')).join(',');
          if (signature === lastSignature) return;
          lastSignature = signature;

          // Client-side: exclude products explicitly marked inactive
          const list = this._sortByDate(
            snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(p => p.active !== false)
          );
          const cacheKey = JSON.stringify(filters);
          this._cache[cacheKey] = list;
          if (typeof callback === "function") callback(list);
        },
        (err) => { console.error("subscribeProducts error:", err.code, err.message); }
      );
    } catch (e) {
      console.error("subscribeProducts setup error:", e.code, e.message);
      return () => {};
    }
  },

  // Invalidate cache (call after adding/editing/deleting a product)
  clearCache() {
    this._cache = {};
  },

  async getProduct(id) {
    try {
      const doc = await db.collection("products").doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) {
      console.error("getProduct:", e);
      return null;
    }
  },



    // ===== COUPONS & PROMO CODES =====
  async getCoupons() {
    try {
      const snap = await db.collection("coupons").get();
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const getMs = (c) => {
          if (!c) return 0;
          if (c.createdAt && c.createdAt.toMillis) return c.createdAt.toMillis();
          if (c.createdAt && c.createdAt.seconds) return c.createdAt.seconds * 1000;
          return 0;
        };
        return getMs(b) - getMs(a);
      });
      return list;
    } catch (e) {
      console.error("getCoupons error:", e);
      return [];
    }
  },

  async getCouponByCode(code) {
    try {
      if (!code) return null;
      const snap = await db.collection("coupons")
        .where("code", "==", code.toUpperCase().trim())
        .get();
      if (snap.empty) return null;
      const validDoc = snap.docs.find(d => d.data().active !== false);
      if (!validDoc) return null;
      return { id: validDoc.id, ...validDoc.data() };
    } catch (e) {
      console.error("getCouponByCode error:", e);
      return null;
    }
  },

  // ===== ORDERS =====
  async addOrder(data) {
    const deliveryOtp = data.deliveryOtp || String(Math.floor(100000 + Math.random() * 900000));
    const ref = await db.collection("orders").add({
      ...data,
      deliveryOtp,
      otpVerified: false,
      status: "Pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    try {
      db.collection("settings").doc("stats").set({
        totalOrders: firebase.firestore.FieldValue.increment(1),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch(e) {}
    return ref;
  },

  async getUserOrders(uid) {
    try {
      // Query without composite index requirement
      const snap = await db.collection("orders")
        .where("userId", "==", uid)
        .get();
      
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Also check by email if uid query returned 0 (in case of legacy/session mismatch)
      if (list.length === 0 && auth.currentUser && auth.currentUser.email) {
        const emailSnap = await db.collection("orders")
          .where("email", "==", auth.currentUser.email)
          .get();
        list = emailSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      // Sort client-side by date descending
      list.sort((a, b) => {
        const getMs = (item) => {
          if (!item) return 0;
          if (item.createdAt && item.createdAt.toMillis) return item.createdAt.toMillis();
          if (item.createdAt && item.createdAt.seconds) return item.createdAt.seconds * 1000;
          if (item.clientCreatedAt) return new Date(item.clientCreatedAt).getTime();
          return 0;
        };
        return getMs(b) - getMs(a);
      });

      return list;
    } catch (e) {
      console.error("getUserOrders error:", e);
      return [];
    }
  },

  async cancelOrder(id, reason = "") {
    return db.collection("orders").doc(id).update({
      status: "Cancelled",
      cancellationReason: reason,
      cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async getOrder(id) {
    try {
      const doc = await db.collection("orders").doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) {
      return null;
    }
  },

  // ===== REFUNDS =====
  async submitRefundRequest(orderId, refundData) {
    return db.collection("refunds").doc(orderId).set({
      ...refundData,
      orderId,
      status: "Pending",
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  async getRefundRequest(orderId) {
    try {
      const doc = await db.collection("refunds").doc(orderId).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) {
      return null;
    }
  },

  // ===== ADMIN — REFUNDS =====
  async getAllRefunds() {
    try {
      const snap = await db.collection("refunds").get();
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ms = (x) => {
          if (x.submittedAt && x.submittedAt.toMillis) return x.submittedAt.toMillis();
          if (x.submittedAt && x.submittedAt.seconds) return x.submittedAt.seconds * 1000;
          return 0;
        };
        return ms(b) - ms(a);
      });
      return list;
    } catch (e) {
      console.error("getAllRefunds error:", e);
      return [];
    }
  },

  async updateRefundStatus(orderId, status, adminNote = "") {
    return db.collection("refunds").doc(orderId).update({
      status,
      adminNote,
      processedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  // ===== RETURNS =====
  async submitReturnRequest(orderId, returnData) {
    // Also update the order status to "Return Requested"
    await db.collection("orders").doc(orderId).update({
      status: "Return Requested",
      returnRequestedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return db.collection("returns").doc(orderId).set({
      ...returnData,
      orderId,
      status: "Pending",
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  async getReturnRequest(orderId) {
    try {
      const doc = await db.collection("returns").doc(orderId).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) {
      return null;
    }
  },

  // ===== ADMIN — RETURNS =====
  async getAllReturns() {
    try {
      const snap = await db.collection("returns").get();
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ms = (x) => {
          if (x.submittedAt && x.submittedAt.toMillis) return x.submittedAt.toMillis();
          if (x.submittedAt && x.submittedAt.seconds) return x.submittedAt.seconds * 1000;
          return 0;
        };
        return ms(b) - ms(a);
      });
      return list;
    } catch (e) {
      console.error("getAllReturns error:", e);
      return [];
    }
  },

  async updateReturnStatus(orderId, status, adminNote = "") {
    // Update return doc
    await db.collection("returns").doc(orderId).update({
      status,
      adminNote,
      processedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Mirror status on the order document
    const orderStatus = status === "Approved" ? "Return Approved"
      : status === "Rejected" ? "Delivered"
      : status === "Completed" ? "Returned"
      : "Return Requested";
    return db.collection("orders").doc(orderId).update({ status: orderStatus });
  },

  // ===== USERS =====
  async getUserProfile(uid) {
    try {
      const doc = await db.collection("users").doc(uid).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (e) {
      return null;
    }
  },

  async createUserProfile(uid, data) {
    return db.collection("users").doc(uid).set({
      ...data,
      isAdmin: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  async updateUserProfile(uid, data) {
    return db.collection("users").doc(uid).update(data);
  },

  // Admin: Update seller status + sync isSeller flag so security rules work correctly
  async updateSellerStatus(uid, newStatus) {
    const update = {
      sellerStatus: newStatus,
      sellerStatusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    // When approved, set isSeller:true so Firestore security rules allow product writes
    if (newStatus === 'approved' || newStatus === 'Approved') {
      update.isSeller = true;
    } else if (newStatus === 'rejected' || newStatus === 'Rejected' || newStatus === 'suspended') {
      update.isSeller = false;
    }
    return db.collection("users").doc(uid).update(update);
  },

  async isUserAdmin(uid) {
    try {
      const user = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
      // Permanent Owner emails — always have admin access
      const ownerEmails = [
        'manasku2007@gmail.com',
        'nariniketan07@gmail.com'
      ];
      if (user && user.email && ownerEmails.includes(user.email.toLowerCase())) {
        // Ensure Firestore has isAdmin: true saved
        db.collection("users").doc(uid).set({ isAdmin: true, email: user.email }, { merge: true }).catch(()=>{});
        return true;
      }
      const profile = await this.getUserProfile(uid);
      return profile ? profile.isAdmin === true : false;
    } catch (e) {
      console.warn("isUserAdmin check:", e);
      return false;
    }
  },


  // ===== ADMIN — ORDERS =====
  async getAllOrders(statusFilter = "all") {
    try {
      let query = db.collection("orders");
      if (statusFilter && statusFilter !== "all") {
        query = query.where("status", "==", statusFilter);
      }
      const snap = await query.get();
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ms = (x) => {
          if (x.createdAt && x.createdAt.toMillis) return x.createdAt.toMillis();
          if (x.createdAt && x.createdAt.seconds) return x.createdAt.seconds * 1000;
          if (x.clientCreatedAt) return new Date(x.clientCreatedAt).getTime();
          return 0;
        };
        return ms(b) - ms(a);
      });
      return list;
    } catch (e) {
      console.error("getAllOrders error:", e);
      return [];
    }
  },

  async updateOrderStatus(id, status, note = "") {
    const update = {
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (note) update.adminNote = note;

    if (status === "Delivered" || status === "Collected") {
      update.deliveredAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    if (status === "Out for Delivery" || status === "out_for_delivery" || status === "Ready for Pickup" || status === "ready_for_pickup") {
      try {
        const doc = await db.collection("orders").doc(id).get();
        if (doc.exists && !doc.data().deliveryOtp) {
          update.deliveryOtp = String(Math.floor(100000 + Math.random() * 900000));
          update.otpGeneratedAt = firebase.firestore.FieldValue.serverTimestamp();
        }
      } catch(e) {}
    }

    return db.collection("orders").doc(id).update(update);
  },

  async verifyDeliveryOtp(orderId, enteredOtp) {
    try {
      const doc = await db.collection("orders").doc(orderId).get();
      if (!doc.exists) {
        return { success: false, message: "Order not found." };
      }
      const data = doc.data();
      const expectedOtp = String(data.deliveryOtp || "").trim();
      const cleanEntered = String(enteredOtp || "").trim();

      if (!expectedOtp) {
        return { success: false, message: "No verification OTP found for this order." };
      }

      if (cleanEntered !== expectedOtp) {
        return { success: false, message: "Invalid OTP. Please ask the customer to check their My Orders screen." };
      }

      const isPickup = data.fulfillmentType === "pickup";
      const newStatus = isPickup ? "Collected" : "Delivered";

      await db.collection("orders").doc(orderId).update({
        status: newStatus,
        otpVerified: true,
        otpVerifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deliveredAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        message: `OTP Verified! Order #${orderId.substring(0,8).toUpperCase()} marked as ${newStatus}.`,
        status: newStatus
      };
    } catch(e) {
      console.error("verifyDeliveryOtp error:", e);
      return { success: false, message: "Error verifying OTP: " + e.message };
    }
  },

  async deleteOrder(id) {
    return db.collection("orders").doc(id).delete();
  },

  async clearCancelledOrders() {
    const snap = await db.collection("orders").where("status", "==", "Cancelled").get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return snap.size;
  },

  async deleteAllOrders() {
    const snap = await db.collection("orders").get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return snap.size;
  },

  // ===== ADMIN — PRODUCTS =====
  async addProduct(data) {
    const ref = await db.collection("products").add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref;
  },

  async updateProduct(id, data) {
    return db.collection("products").doc(id).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  // Admin: get ALL products regardless of active status (for admin dashboard)
  async getAllProducts() {
    try {
      const snap = await db.collection("products").get();
      return this._sortByDate(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("getAllProducts error:", e.code, e.message);
      return [];
    }
  },

  async deleteProduct(id) {
    return db.collection("products").doc(id).delete();
  },

  // ===== ADMIN — COUPONS =====
  async addCoupon(data) {
    const ref = await db.collection("coupons").add({
      ...data,
      code: (data.code || "").toUpperCase().trim(),
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref;
  },

  async updateCoupon(id, data) {
    return db.collection("coupons").doc(id).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async deleteCoupon(id) {
    return db.collection("coupons").doc(id).delete();
  },

  // ===== ADMIN — DASHBOARD STATS =====
  async getAdminStats() {
    try {
      const [prodSnap, orderSnap, userSnap] = await Promise.all([
        db.collection("products").get(),
        db.collection("orders").get(),
        db.collection("users").get()
      ]);
      const orders = orderSnap.docs.map(d => d.data());
      const totalRevenue = orders
        .filter(o => o.status !== "Cancelled")
        .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      const pending = orders.filter(o => !o.status || o.status === "Pending").length;
      return {
        products: prodSnap.size,
        orders: orderSnap.size,
        users: userSnap.size,
        revenue: totalRevenue,
        pending
      };
    } catch (e) {
      console.error("getAdminStats error:", e);
      return { products: 0, orders: 0, users: 0, revenue: 0, pending: 0 };
    }
  },

  // ===== SAMPLE DATA =====
  async initSampleData() {
    const existing = await db.collection("products").limit(1).get();
    if (!existing.empty) return;

    const sampleProducts = [
      {
        name: "Royal Silk Banarasi Saree",
        description: "Handwoven pure silk Banarasi saree with intricate gold zari border. Perfect for weddings, festivals, and special occasions. Comes with matching blouse piece.",
        price: 2999,
        originalPrice: 4500,
        category: "Sarees",
        sizes: ["Free Size"],
        colors: ["Red", "Navy Blue", "Bottle Green"],
        imageUrl: "https://placehold.co/400x520/8B1A4A/D4AF37?text=Silk+Saree",
        stock: 20,
        featured: true,
        rating: 4.8,
        reviews: 42,
        fabric: "Pure Silk",
        care: "Dry Clean Only"
      },
      {
        name: "Anarkali Embroidered Suit",
        description: "Stunning floor-length Anarkali suit with heavy embroidery work. Comes with matching churidar and dupatta. Ideal for festive occasions.",
        price: 1999,
        originalPrice: 3200,
        category: "Suits",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Peach", "Sky Blue", "Mint"],
        imageUrl: "https://placehold.co/400x520/B5265F/F0D060?text=Anarkali+Suit",
        stock: 15,
        featured: true,
        rating: 4.6,
        reviews: 28,
        fabric: "Georgette",
        care: "Gentle Hand Wash"
      },
      {
        name: "Bridal Lehenga Choli",
        description: "Exquisite bridal lehenga with mirror work and thread embroidery. Heavy dupatta included. This is the outfit for your special day!",
        price: 5999,
        originalPrice: 8500,
        category: "Lehengas",
        sizes: ["S", "M", "L", "XL", "Custom"],
        colors: ["Red", "Pink", "Maroon"],
        imageUrl: "https://placehold.co/400x520/C8374B/FFD700?text=Bridal+Lehenga",
        stock: 8,
        featured: true,
        rating: 4.9,
        reviews: 16,
        fabric: "Velvet & Net",
        care: "Dry Clean Only"
      },
      {
        name: "Casual Printed Kurta",
        description: "Comfortable everyday kurta with vibrant block print. Pairs perfectly with leggings or palazzos. A wardrobe essential.",
        price: 599,
        originalPrice: 999,
        category: "Kurtas",
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Yellow", "Orange", "Purple"],
        imageUrl: "https://placehold.co/400x520/D4AF37/1A0A0F?text=Printed+Kurta",
        stock: 50,
        featured: false,
        rating: 4.3,
        reviews: 67,
        fabric: "Cotton",
        care: "Machine Wash"
      },
      {
        name: "Embroidered Dupatta",
        description: "Gorgeous dupatta with hand-embroidered border. Can be paired with any ethnic outfit to add an elegant touch.",
        price: 499,
        originalPrice: 799,
        category: "Dupattas",
        sizes: ["Free Size"],
        colors: ["Gold", "Silver", "Multicolor"],
        imageUrl: "https://placehold.co/400x520/6B1238/D4AF37?text=Embroidered+Dupatta",
        stock: 30,
        featured: false,
        rating: 4.5,
        reviews: 19,
        fabric: "Chiffon",
        care: "Hand Wash"
      },
      {
        name: "Palazzo Suit Set",
        description: "Trendy palazzo suit set with matching dupatta. Perfect blend of traditional and contemporary fashion. Very comfortable for all-day wear.",
        price: 1299,
        originalPrice: 1899,
        category: "Suits",
        sizes: ["S", "M", "L", "XL", "XXL"],
        colors: ["Teal", "Coral", "Lavender"],
        imageUrl: "https://placehold.co/400x520/388E3C/FFFFFF?text=Palazzo+Set",
        stock: 25,
        featured: false,
        rating: 4.4,
        reviews: 35,
        fabric: "Rayon",
        care: "Machine Wash"
      },
      {
        name: "Georgette Party Saree",
        description: "Lightweight georgette saree with digital print. Easy to drape and carry. Perfect for parties and casual events.",
        price: 1499,
        originalPrice: 2200,
        category: "Sarees",
        sizes: ["Free Size"],
        colors: ["Wine", "Black", "Royal Blue"],
        imageUrl: "https://placehold.co/400x520/3D0820/F0D060?text=Party+Saree",
        stock: 18,
        featured: true,
        rating: 4.5,
        reviews: 31,
        fabric: "Georgette",
        care: "Dry Clean"
      },
      {
        name: "Designer Kurti with Pants",
        description: "Stylish designer kurti paired with matching pants. Contemporary design with traditional feel. Office, casual or light festive wear.",
        price: 999,
        originalPrice: 1499,
        category: "Kurtas",
        sizes: ["XS", "S", "M", "L", "XL"],
        colors: ["Beige", "Sky Blue", "Dusty Pink"],
        imageUrl: "https://placehold.co/400x520/B8962D/FFFFFF?text=Designer+Kurti",
        stock: 35,
        featured: false,
        rating: 4.2,
        reviews: 48,
        fabric: "Cotton Blend",
        care: "Machine Wash"
      }
    ];

    const batch = db.batch();
    sampleProducts.forEach(p => {
      const ref = db.collection("products").doc();
      batch.set(ref, { ...p, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();
    console.log("Sample products initialized!");
  },

  // ===== ADMIN — ALL USERS =====
  async getAllUsers() {
    try {
      const snap = await db.collection("users").get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => {
          const ms = x => x.createdAt?.toMillis?.() || x.createdAt?.seconds*1000 || 0;
          return ms(b) - ms(a);
        });
    } catch(e) { console.error("getAllUsers:", e); return []; }
  },

  async deleteUser(uid) {
    try {
      await db.collection("users").doc(uid).delete();
    } catch(e) { console.error("deleteUser:", e); }
  },

  async setUserAdmin(uid, isAdmin) {
    return db.collection("users").doc(uid).update({ isAdmin, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  async blockUser(uid, blocked) {
    return db.collection("users").doc(uid).update({ blocked, blockedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  // ===== ADMIN — CATEGORIES =====
  async getCategories() {
    try {
      const snap = await db.collection("categories").orderBy("order").get().catch(() => db.collection("categories").get());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error("getCategories:", e); return []; }
  },

  async addCategory(data) {
    return db.collection("categories").add({ ...data, active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  async updateCategory(id, data) {
    return db.collection("categories").doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  async deleteCategory(id) {
    return db.collection("categories").doc(id).delete();
  },

  // ===== ADMIN — BANNERS =====
  async getBanners() {
    try {
      const snap = await db.collection("banners").get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (a.order||99) - (b.order||99));
    } catch(e) { console.error("getBanners:", e); return []; }
  },

  async addBanner(data) {
    return db.collection("banners").add({ ...data, active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  async updateBanner(id, data) {
    return db.collection("banners").doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  async deleteBanner(id) {
    return db.collection("banners").doc(id).delete();
  },

  // ===== ADMIN — REVIEWS =====
  async getAllReviews() {
    try {
      const snap = await db.collection("reviews").get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => {
          const ms = x => x.createdAt?.toMillis?.() || x.createdAt?.seconds*1000 || 0;
          return ms(b) - ms(a);
        });
    } catch(e) { console.error("getAllReviews:", e); return []; }
  },

  async updateReviewStatus(id, status) {
    return db.collection("reviews").doc(id).update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  async deleteReview(id) {
    return db.collection("reviews").doc(id).delete();
  },

  // ===== ADMIN — COMPLAINTS & GRIEVANCES =====
  async getAllComplaints() {
    try {
      const [gSnap, cSnap] = await Promise.all([
        db.collection("grievances").get().catch(() => ({ docs: [] })),
        db.collection("complaints").get().catch(() => ({ docs: [] }))
      ]);
      const gList = gSnap.docs.map(d => ({ id: d.id, ...d.data(), _col: 'grievances' }));
      const cList = cSnap.docs.map(d => ({ id: d.id, ...d.data(), _col: 'complaints' }));
      const all = [...gList, ...cList];
      return all.sort((a,b) => {
        const ms = x => x.submittedAt?.toMillis?.() || x.submittedAt?.seconds*1000 || (x.createdAt ? new Date(x.createdAt).getTime() : 0);
        return ms(b) - ms(a);
      });
    } catch(e) { console.error("getAllComplaints:", e); return []; }
  },

  async updateComplaintStatus(id, status, adminNote = "") {
    const update = { status, adminNote, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    try {
      await db.collection("grievances").doc(id).update(update);
    } catch (e) {
      await db.collection("complaints").doc(id).update(update);
    }
  },

  // ===== ADMIN — SHIPPING =====
  async updateOrderTracking(orderId, trackingData) {
    return db.collection("orders").doc(orderId).update({
      ...trackingData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  // ===== ADMIN — NOTIFICATIONS =====
  async getNotifications() {
    try {
      const snap = await db.collection("notifications").orderBy("createdAt", "desc").limit(50).get()
        .catch(() => db.collection("notifications").get());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error("getNotifications:", e); return []; }
  },

  async addNotification(data) {
    return db.collection("notifications").add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  // ===== ADMIN — AUDIT LOG =====
  async logAdminAction(action, details = "") {
    try {
      const user = auth.currentUser;
      return db.collection("auditLogs").add({
        action,
        details,
        adminEmail: user?.email || "unknown",
        adminUid: user?.uid || "unknown",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) { /* silent */ }
  },

  async getAuditLogs() {
    try {
      const snap = await db.collection("auditLogs").orderBy("timestamp", "desc").limit(100).get()
        .catch(() => db.collection("auditLogs").get());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  },

  // ===== ADMIN — SITE SETTINGS =====
  async getSiteSettings() {
    try {
      const doc = await db.collection("settings").doc("site").get();
      return doc.exists ? doc.data() : {};
    } catch(e) { return {}; }
  },

  async saveSiteSettings(data) {
    return db.collection("settings").doc("site").set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
};
