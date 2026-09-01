// =============================================
// NARI NIKETAN - Cart & Coupon Manager (localStorage)
// =============================================

const Cart = {
  KEY: "nn_cart",
  COUPON_KEY: "nn_coupon",

  COUPONS: {
    "NARI20": { discount: 20, type: "percent", label: "20% OFF Festive Discount" },
    "WELCOME10": { discount: 10, type: "percent", label: "10% Welcome Discount" },
    "FREESHIP": { discount: 0, type: "shipping", label: "Free Shipping Coupon" }
  },

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch { return []; }
  },

  save(cart) {
    localStorage.setItem(this.KEY, JSON.stringify(cart));
    this.updateBadge();
  },

  getCoupon() {
    try {
      const raw = localStorage.getItem(this.COUPON_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  },

  removeCoupon() {
    try {
      localStorage.removeItem(this.COUPON_KEY);
    } catch(e) {
      console.warn(e);
    }
  },

  async applyCoupon(rawCode) {
    if (!rawCode) return { success: false, message: "Please enter a coupon code." };
    const code = rawCode.trim().toUpperCase();
    const sub = this.subtotal();

    if (sub === 0) {
      return { success: false, message: "Add items to your bag before applying a coupon." };
    }

    // 1. Check dynamic Firestore coupons
    try {
      if (typeof Store !== 'undefined' && Store.getCouponByCode) {
        const liveCoupon = await Store.getCouponByCode(code);
        if (liveCoupon) {
          if (liveCoupon.minOrder && sub < liveCoupon.minOrder) {
            return { 
              success: false, 
              message: `Minimum order amount for ${code} is ₹${liveCoupon.minOrder.toLocaleString('en-IN')}.` 
            };
          }
          const couponData = {
            code: liveCoupon.code,
            discount: liveCoupon.discount,
            type: liveCoupon.type,
            label: liveCoupon.label || (liveCoupon.type === 'percent' ? `${liveCoupon.discount}% OFF` : `₹${liveCoupon.discount} OFF`),
            minOrder: liveCoupon.minOrder || 0
          };
          localStorage.setItem(this.COUPON_KEY, JSON.stringify(couponData));
          return { success: true, coupon: couponData, message: `Coupon "${code}" applied successfully!` };
        }
      }
    } catch(e) {
      console.warn("Firestore coupon check fallback:", e);
    }

    // 2. Check default built-in coupons
    const coupon = this.COUPONS[code];
    if (!coupon) {
      return { success: false, message: "Invalid coupon code. Please check and try again." };
    }

    const couponData = { code, ...coupon };
    localStorage.setItem(this.COUPON_KEY, JSON.stringify(couponData));
    return { success: true, coupon: couponData, message: `Coupon "${code}" applied! ${coupon.label}` };
  },

  discountAmount() {
    const coupon = this.getCoupon();
    if (!coupon) return 0;
    const sub = this.subtotal();
    if (coupon.type === "percent") {
      return Math.round(sub * (coupon.discount / 100));
    } else if (coupon.type === "flat") {
      return Math.min(sub, Number(coupon.discount) || 0);
    }
    return 0;
  },

  add(product, size, color, qty = 1) {
    const cart = this.get();
    const key = `${product.id}_${size}_${color}`;
    const existing = cart.find(i => i.key === key);
    // Use salePrice (selling price) if available, otherwise MRP
    const sellingPrice = (product.salePrice && product.salePrice < product.price)
      ? product.salePrice : product.price;
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, product.stock || 99);
    } else {
      cart.push({
        key, productId: product.id,
        name: product.name, category: product.category,
        price: sellingPrice,           // selling price (what customer pays)
        mrp: product.price,            // original MRP (for display strikethrough)
        imageUrl: product.imageUrl || (product.images && product.images[0]) || product.image || "",
        images: product.images || [],
        size, color, qty,
        stock: product.stock || 99
      });
    }
    this.save(cart);
    return true;
  },

  remove(key) {
    const cart = this.get().filter(i => i.key !== key);
    this.save(cart);
  },

  updateQty(key, qty) {
    const cart = this.get();
    const item = cart.find(i => i.key === key);
    if (item) {
      if (qty <= 0) { this.remove(key); return; }
      item.qty = Math.min(qty, item.stock);
      this.save(cart);
    }
  },

  clear() {
    localStorage.removeItem(this.KEY);
    this.removeCoupon();
    this.updateBadge();
  },

  count() {
    return this.get().reduce((sum, i) => sum + i.qty, 0);
  },

  subtotal() {
    return this.get().reduce((sum, i) => sum + (i.price * i.qty), 0);
  },

  shipping(fulfillmentType) {
    if (fulfillmentType === "pickup") return 0;
    const coupon = this.getCoupon();
    if (coupon && coupon.type === "shipping") return 0;
    const sub = this.subtotal();
    return sub >= 999 ? 0 : 99;
  },

  total(fulfillmentType) {
    const sub = this.subtotal();
    const disc = this.discountAmount();
    const ship = this.shipping(fulfillmentType);
    return Math.max(0, sub - disc + ship);
  },

  updateBadge() {
    const badge = document.getElementById("cart-count");
    if (badge) {
      const c = this.count();
      badge.textContent = c;
      badge.style.display = c > 0 ? "flex" : "none";
    }
  },

  formatPrice(n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  }
};
