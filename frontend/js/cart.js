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

    // Server-side authoritative coupon validation
    try {
      if (typeof Store !== "undefined" && Store.validateCouponViaApi) {
        const res = await Store.validateCouponViaApi(code, sub);
        if (res && res.valid) {
          const couponData = {
            code: res.couponCode || code,
            discount: res.discountAmount || 0,
            discountAmount: res.discountAmount || 0,
            type: res.discountType || "flat",
            freeShipping: res.freeShipping === true,
            label: res.label || `Coupon ${code}`
          };
          localStorage.setItem(this.COUPON_KEY, JSON.stringify(couponData));
          return { success: true, coupon: couponData, message: res.message || `Coupon "${code}" applied successfully!` };
        } else {
          return { success: false, message: (res && res.error) || "Invalid coupon code." };
        }
      }
    } catch(e) {
      return { success: false, message: e.message || "Failed to validate coupon code." };
    }

    return { success: false, message: "Unable to connect to verification server." };
  },

  discountAmount() {
    const coupon = this.getCoupon();
    if (!coupon) return 0;
    const sub = this.subtotal();
    if (typeof coupon.discountAmount === "number") {
      return Math.min(sub, coupon.discountAmount);
    }
    if (coupon.type === "percent") {
      return Math.round(sub * (coupon.discount / 100));
    } else if (coupon.type === "flat") {
      return Math.min(sub, Number(coupon.discount) || 0);
    }
    return 0;
  },

  add(product, size, color, qty = 1, variantId = null, sku = null, variantStock = null, variantPrice = null) {
    const cart = this.get();
    const effectiveVariantId = variantId || `${size || 'default'}_${color || 'default'}`;
    const key = `${product.id}_${effectiveVariantId}`;
    const existing = cart.find(i => i.key === key);

    // Determine variant-specific or product-level stock limit
    let maxStock = 99;
    if (typeof variantStock === 'number') {
      maxStock = variantStock;
    } else if (typeof product.stock === 'number') {
      maxStock = product.stock;
    }

    if (maxStock <= 0) {
      if (typeof App !== 'undefined' && App.toast) {
        App.toast('Selected variant is out of stock.', 'error');
      }
      return false;
    }

    // Use variant price if provided, otherwise salePrice or price
    let sellingPrice = (product.salePrice && product.salePrice < product.price)
      ? product.salePrice : product.price;
    if (typeof variantPrice === 'number' && variantPrice > 0) {
      sellingPrice = variantPrice;
    }

    if (existing) {
      existing.qty = Math.min(existing.qty + qty, maxStock);
      existing.stock = maxStock;
      if (variantId) existing.variantId = variantId;
      if (sku) existing.sku = sku;
    } else {
      cart.push({
        key,
        productId: product.id,
        variantId: variantId || null,
        sku: sku || product.sku || '',
        name: product.name,
        category: product.category,
        price: sellingPrice,           // selling price (what customer pays)
        mrp: product.price,            // original MRP (for display strikethrough)
        thumbnail: (typeof Products !== 'undefined' && Products.getImageUrl) ? Products.getImageUrl(product, 'thumbnail') : (product.thumbnail || (typeof product.images?.[0] === 'object' ? product.images[0].thumbnail : (product.imageUrl || product.images?.[0] || ''))),
        imageUrl: (typeof Products !== 'undefined' && Products.getImageUrl) ? Products.getImageUrl(product, 'thumbnail') : (product.imageUrl || (product.images && product.images[0]) || product.image || ""),
        images: product.images || [],
        size: size || '',
        color: color || '',
        qty: Math.min(qty, maxStock),
        stock: maxStock
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
