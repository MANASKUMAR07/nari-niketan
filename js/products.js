// =============================================
// NARI NIKETAN — Product Display & Dedicated Image CDN Logic
// =============================================

// Instant local SVG placeholder — 0ms, zero network, works offline (replaces slow placehold.co)
const NO_IMAGE_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 520'%3E%3Crect fill='%23F5ECD8' width='400' height='520'/%3E%3Ctext x='200' y='240' font-family='Georgia%2Cserif' font-size='16' fill='%238B1A4A' text-anchor='middle'%3E%F0%9F%9B%8D%EF%B8%8F%3C/text%3E%3Ctext x='200' y='270' font-family='Georgia%2Cserif' font-size='14' fill='%238B1A4A' text-anchor='middle'%3ENo Image%3C/text%3E%3C/svg%3E";

const Products = {

  // Dedicated Global Image CDN proxy (backed by Cloudflare Edge Network)
  cdnUrl(rawUrl, options = {}) {
    if (!rawUrl || typeof rawUrl !== 'string') return NO_IMAGE_SVG;
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;
    if (rawUrl.includes('wsrv.nl')) return rawUrl; // already CDN

    const width   = options.width || (options.size === 'large' ? 1200 : options.size === 'medium' ? 800 : 400);
    const height  = options.height ? `&h=${options.height}` : '';
    const quality = options.quality || (options.size === 'large' ? 85 : 80);
    const format  = options.format || 'webp';
    const fit     = options.fit || 'cover';

    return `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&w=${width}${height}&fit=${fit}&output=${format}&q=${quality}&we=1`;
  },

  // Get raw direct origin URL (Firebase Storage)
  getRawImageUrl(product, size = 'thumbnail') {
    if (!product) return '';
    const firstImg = Array.isArray(product.images) && product.images[0];
    if (firstImg && typeof firstImg === 'object') {
      if (size === 'thumbnail') return firstImg.thumbnail || firstImg.medium || firstImg.large || firstImg.original || '';
      if (size === 'medium') return firstImg.medium || firstImg.large || firstImg.thumbnail || firstImg.original || '';
      if (size === 'large') return firstImg.large || firstImg.medium || firstImg.original || firstImg.thumbnail || '';
      return firstImg.original || firstImg.large || firstImg.medium || '';
    }
    return product.thumbnail || product.imageUrl || product.image || '';
  },

  // Extract optimized URL (Direct pre-generated WebP from Google Storage or Global CDN)
  getImageUrl(product, size = 'thumbnail', useCdn = false) {
    if (!product) return NO_IMAGE_SVG;

    const rawUrl = this.getRawImageUrl(product, size);
    if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.includes('placehold.co')) {
      return NO_IMAGE_SVG;
    }

    if (useCdn && rawUrl.startsWith('http')) {
      return this.cdnUrl(rawUrl, { size });
    }

    return rawUrl;
  },

  // Generate responsive CDN srcset for multi-density displays
  getImageSrcset(product) {
    if (!product) return '';
    const rawUrl = this.getRawImageUrl(product, 'large') || this.getRawImageUrl(product, 'thumbnail');
    if (!rawUrl || !rawUrl.startsWith('http')) return '';

    return `${this.cdnUrl(rawUrl, { width: 320, quality: 78 })} 320w, ${this.cdnUrl(rawUrl, { width: 480, quality: 80 })} 480w, ${this.cdnUrl(rawUrl, { width: 800, quality: 82 })} 800w`;
  },

  renderCard(product, index = 0) {
    const fallback     = NO_IMAGE_SVG;
    const rawDirectUrl = this.getRawImageUrl(product, 'thumbnail') || fallback;
    const thumbUrl     = this.getImageUrl(product, 'thumbnail', true);
    const srcset       = this.getImageSrcset(product);
    const isLcp        = index === 0;

    // Discount badge: prefer stored discount%, else compute from salePrice/price
    const discount = product.discount
      || (product.salePrice && product.price > product.salePrice
          ? Math.round(((product.price - product.salePrice) / product.price) * 100)
          : (product.originalPrice && product.originalPrice > product.price
              ? Math.round((1 - product.price / product.originalPrice) * 100) : 0));
    const badge = product.featured
      ? `<span class="product-badge hot">Hot</span>`
      : discount >= 10 ? `<span class="product-badge sale">${discount}% OFF</span>` : '';
    const displayPrice      = product.salePrice || product.price;
    const originalPriceHtml = (product.salePrice && product.price > product.salePrice)
      ? `<span class="product-original-price">${App.formatPrice(product.price)}</span>` : '';
    const discountHtml      = discount > 0
      ? `<span class="product-discount">${discount}% off</span>` : '';

    return `
      <div class="product-card" data-id="${product.id}">
        <div class="product-card-img" style="aspect-ratio:3/4;position:relative;overflow:hidden;background:var(--cream-dark,#F5ECD8);">
          ${badge}
          <img class="product-img-el" data-product-id="${product.id}"
            src="${thumbUrl}"
            ${srcset ? `srcset="${srcset}" sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 280px"` : ''}
            alt="${product.name || 'Product'}"
            width="300" height="400"
            loading="${isLcp ? 'eager' : 'lazy'}"
            ${isLcp ? 'fetchpriority="high"' : ''}
            decoding="async"
            style="width:100%;height:100%;object-fit:cover;display:block;"
            onerror="if(!this.dataset.fallbackApplied){this.dataset.fallbackApplied='1';this.removeAttribute('srcset');this.src='${rawDirectUrl}';}else{this.src='${fallback}';}">
          <div class="product-card-overlay">
            <button class="product-quick-add" onclick="Products.quickView('${product.id}'); event.stopPropagation();">
              &#128065; Quick View
            </button>
          </div>
          <button class="product-wishlist" data-id="${product.id}" title="Add to Wishlist" onclick="if(window.Wishlist)Wishlist.toggleCard('${product.id}',event);event.stopPropagation();">&#9825;</button>
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
    container.innerHTML = products.map((p, i) => this.renderCard(p, i)).join('');

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
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.fabric && p.fabric.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    if (category && category !== "All") {
      result = result.filter(p => p.category === category);
    }
    if (minPrice) {
      result = result.filter(p => (p.salePrice || p.price) >= Number(minPrice));
    }
    if (maxPrice) {
      result = result.filter(p => (p.salePrice || p.price) <= Number(maxPrice));
    }
    if (sizes && sizes.length) {
      result = result.filter(p => p.sizes && sizes.some(s => p.sizes.includes(s)));
    }
    if (sort === "price-asc") {
      result.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
    } else if (sort === "price-desc") {
      result.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
    } else if (sort === "rating") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === "newest") {
      result.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }
    return result;
  }
};
