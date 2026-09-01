// =============================================
// NARI NIKETAN — Product Display Logic
// =============================================

// Instant local SVG placeholder — 0ms, zero network, works offline (replaces slow placehold.co)
const NO_IMAGE_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 520'%3E%3Crect fill='%23F5ECD8' width='400' height='520'/%3E%3Ctext x='200' y='240' font-family='Georgia%2Cserif' font-size='16' fill='%238B1A4A' text-anchor='middle'%3E%F0%9F%9B%8D%EF%B8%8F%3C/text%3E%3Ctext x='200' y='270' font-family='Georgia%2Cserif' font-size='14' fill='%238B1A4A' text-anchor='middle'%3ENo Image%3C/text%3E%3C/svg%3E";

const Products = {

  renderCard(product) {
    const fallback   = NO_IMAGE_SVG;
    const rawImage   = product.imageUrl || (product.images && product.images[0]) || product.image || '';

    // If image is still old base64 (legacy products), keep the safe setAttribute path.
    // New products uploaded after this update will have Firebase Storage https:// URLs.
    const isBase64 = rawImage.startsWith('data:');
    const imgSrc   = (rawImage && !isBase64) ? rawImage : fallback;
    if (isBase64) this._imgStore[product.id] = rawImage;

    // Discount badge: prefer stored discount%, else compute from salePrice/price
    const discount = product.discount
      || (product.salePrice && product.price > product.salePrice
          ? Math.round(((product.price - product.salePrice) / product.price) * 100)
          : (product.originalPrice && product.originalPrice > product.price
              ? Math.round((1 - product.price / product.originalPrice) * 100) : 0));
    const badge = product.featured
      ? `<span class="product-badge hot">Hot</span>`
      : discount >= 10 ? `<span class="product-badge sale">${discount}% OFF</span>` : '';
    const displayPrice    = product.salePrice || product.price;
    const originalPriceHtml = (product.salePrice && product.price > product.salePrice)
      ? `<span class="product-original-price">${App.formatPrice(product.price)}</span>` : '';
    const discountHtml    = discount > 0
      ? `<span class="product-discount">${discount}% off</span>` : '';

    return `
      <div class="product-card" data-id="${product.id}">
        <div class="product-card-img">
          ${badge}
          <img class="product-img-el" data-product-id="${product.id}"
            src="${imgSrc}"
            alt="${product.name || 'Product'}" loading="lazy"
            onerror="this.onerror=null;this.src='${fallback}'">
          <div class="product-card-overlay">
            <button class="product-quick-add" onclick="Products.quickView('${product.id}'); event.stopPropagation();">
              &#128065; Quick View
            </button>
          </div>
          <button class="product-wishlist" title="Add to Wishlist">&#9825;</button>
        </div>
        <div class="product-card-body">
          <p class="product-category">${product.category || ''}</p>
          <h3 class="product-name"><a href="product.html?id=${product.id}">${product.name}</a></h3>
          <div class="product-price-row">
            <span class="product-price">${App.formatPrice(displayPrice)}</span>
            ${originalPriceHtml}
            ${discountHtml}
          </div>
          <div class="product-rating">
            <span class="stars">${App.getStars(product.rating || 4)}</span>
            <span class="rating-count">(${product.reviews || 0})</span>
          </div>
        </div>
      </div>
    `;
  },

  // Keep _imgStore for backwards-compat with any legacy base64 products still in Firestore
  _imgStore: {},

  renderGrid(products, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!products.length) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">🛍️</div>
          <h3>No Products Found</h3>
          <p>Try adjusting your filters or search terms.</p>
          <a href="shop.html" class="btn btn-outline">Browse All</a>
        </div>`;
      return;
    }
    container.innerHTML = products.map(p => this.renderCard(p)).join('');

    // Legacy: apply base64 images via setAttribute for any old products
    container.querySelectorAll('.product-img-el[data-product-id]').forEach(img => {
      const pid = img.getAttribute('data-product-id');
      if (this._imgStore[pid]) {
        img.setAttribute('src', this._imgStore[pid]);
        delete this._imgStore[pid];
      }
    });
  },


  quickView(productId) {
    window.location.href = `product.html?id=${productId}`;
  },

  filterAndSort(products, { search, category, minPrice, maxPrice, sizes, sort }) {
    let result = [...products];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    if (category && category !== "All") {
      result = result.filter(p => p.category === category);
    }
    if (minPrice !== undefined && minPrice !== null && !isNaN(minPrice)) {
      result = result.filter(p => p.price >= minPrice);
    }
    if (maxPrice !== undefined && maxPrice !== null && !isNaN(maxPrice)) {
      result = result.filter(p => p.price <= maxPrice);
    }
    if (sizes && sizes.length) {
      result = result.filter(p =>
        p.sizes && sizes.some(s => p.sizes.includes(s))
      );
    }
    switch (sort) {
      case "price-asc": result.sort((a, b) => a.price - b.price); break;
      case "price-desc": result.sort((a, b) => b.price - a.price); break;
      case "rating": result.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      case "newest": result.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); break;
      case "name": result.sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
    }
    return result;
  }
};
