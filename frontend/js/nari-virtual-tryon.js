/* ==========================================================
   NARI NIKETAN — AI Virtual Try-On Studio
   Version: 1.0 (Canvas Compositor + Garment Segmentation + Split Slider)
   ========================================================== */

(function (window, document) {
  'use strict';

  if (window.VirtualTryOn) return;

  const VirtualTryOn = {
    _isOpen: false,
    _product: null,
    _userImageSrc: null,
    _scale: 1.0,
    _offsetY: 0,
    _offsetX: 0,
    _opacity: 0.95,
    _sliderPos: 50,
    _isDraggingSlider: false,

    _sampleAvatars: [
      { id: 'av1', label: 'Model 1', img: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80' },
      { id: 'av2', label: 'Model 2', img: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=400&q=80' },
      { id: 'av3', label: 'Model 3', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80' },
      { id: 'av4', label: 'Model 4', img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80' }
    ],

    // ── INITIALIZATION ─────────────────────────────────────────
    init: function () {
      if (window.location.pathname.indexOf('/admin') !== -1 || window.location.pathname.indexOf('/seller') !== -1) return;
      this._injectDOM();
      this._bindEvents();
      this._userImageSrc = this._sampleAvatars[0].img;
    },

    // ── DOM INJECTION ──────────────────────────────────────────
    _injectDOM: function () {
      if (document.getElementById('nari-tryon-modal')) return;

      const modal = document.createElement('div');
      modal.id = 'nari-tryon-modal';
      modal.className = 'hidden';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="tryon-box">
          <div class="tryon-header">
            <div class="tryon-header-title">
              👗 AI Virtual Try-On Studio <span>BETA</span>
            </div>
            <button class="tryon-close-btn" id="tryon-close-btn" title="Close Studio">✕</button>
          </div>

          <div class="tryon-body">
            <!-- Left: Interactive Comparison Viewport -->
            <div class="tryon-viewport-wrap">
              <div class="tryon-compare-container" id="tryon-compare-box">
                <!-- Before Layer (Original Model / Customer Photo) -->
                <div class="tryon-layer-before">
                  <img id="tryon-before-img" src="${this._sampleAvatars[0].img}" alt="Original Photo">
                </div>

                <!-- After Layer (AI Try-On Composite) -->
                <div class="tryon-layer-after" id="tryon-after-layer">
                  <canvas id="tryon-composite-canvas" width="400" height="520"></canvas>
                </div>

                <!-- Split Divider Slider -->
                <div class="tryon-split-handle" id="tryon-split-handle">
                  <div class="tryon-split-button">⬌</div>
                </div>

                <div class="tryon-tag before">Original Photo</div>
                <div class="tryon-tag after">✨ Virtual Try-On</div>
              </div>
              <div class="tryon-slider-tip">
                <span>⬌ Drag slider to compare Original vs AI Outfit Fit</span>
              </div>
            </div>

            <!-- Right: Controls & Actions -->
            <div class="tryon-controls-wrap">
              <!-- Product Summary -->
              <div class="tryon-product-card" id="tryon-product-summary">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" id="tryon-prod-img" class="tryon-product-thumb" alt="Outfit">
                <div class="tryon-product-info">
                  <div class="tryon-product-name" id="tryon-prod-name">Selected Outfit</div>
                  <div class="tryon-product-price" id="tryon-prod-price">₹0</div>
                </div>
              </div>

              <!-- Customer Photo Options -->
              <div>
                <div class="tryon-section-label">📸 Step 1: Your Photo or Model Avatar</div>
                <input type="file" id="tryon-file-input" accept="image/*" style="display:none">
                <button class="tryon-upload-btn" id="tryon-upload-trigger">
                  <span>📷 Upload Your Full Photo / Selfie</span>
                  <span style="font-size:0.72rem;color:#FFE082">Works best with front-facing portraits</span>
                </button>
              </div>

              <div>
                <div style="font-size:0.75rem;color:#BFAEA4;margin-bottom:6px">Or pick a sample model pose:</div>
                <div class="tryon-avatar-grid">
                  ${this._sampleAvatars.map((av, idx) => `
                    <div class="tryon-avatar-item ${idx === 0 ? 'active' : ''}" data-img="${av.img}" onclick="VirtualTryOn.selectAvatar(this, '${av.img}')">
                      <img src="${av.img}" alt="${av.label}">
                      <span>${av.label}</span>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Fit Adjustments -->
              <div class="tryon-adjustments">
                <div class="tryon-section-label" style="margin-bottom:4px">📐 Step 2: Fit &amp; Drape Adjustments</div>
                <div class="tryon-slider-row">
                  <span>Garment Scale:</span>
                  <input type="range" id="tryon-scale-slider" min="0.75" max="1.35" step="0.02" value="1.0">
                </div>
                <div class="tryon-slider-row">
                  <span>Vertical Position:</span>
                  <input type="range" id="tryon-pos-slider" min="-60" max="60" step="2" value="0">
                </div>
                <div class="tryon-slider-row">
                  <span>Fabric Opacity:</span>
                  <input type="range" id="tryon-opacity-slider" min="0.7" max="1.0" step="0.02" value="0.95">
                </div>
              </div>

              <!-- Purchase & Share Actions -->
              <div class="tryon-actions">
                <button class="tryon-btn-cart" id="tryon-add-cart-btn">
                  🛒 Add This Look To Cart
                </button>
                <button class="tryon-btn-share" id="tryon-share-btn">
                  📲 Share On WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    },

    // ── EVENT BINDINGS ─────────────────────────────────────────
    _bindEvents: function () {
      const closeBtn = document.getElementById('tryon-close-btn');
      const uploadTrigger = document.getElementById('tryon-upload-trigger');
      const fileInput = document.getElementById('tryon-file-input');
      const cartBtn = document.getElementById('tryon-add-cart-btn');
      const shareBtn = document.getElementById('tryon-share-btn');
      const compareBox = document.getElementById('tryon-compare-box');

      // Fit adjustment sliders
      const scaleSlider = document.getElementById('tryon-scale-slider');
      const posSlider = document.getElementById('tryon-pos-slider');
      const opacitySlider = document.getElementById('tryon-opacity-slider');

      if (closeBtn) closeBtn.addEventListener('click', () => this.close());
      if (uploadTrigger && fileInput) {
        uploadTrigger.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            this._handleFileUpload(e.target.files[0]);
          }
        });
      }

      if (cartBtn) cartBtn.addEventListener('click', () => this._handleAddToCart());
      if (shareBtn) shareBtn.addEventListener('click', () => this._handleShare());

      if (scaleSlider) {
        scaleSlider.addEventListener('input', (e) => {
          this._scale = parseFloat(e.target.value);
          this._renderComposite();
        });
      }
      if (posSlider) {
        posSlider.addEventListener('input', (e) => {
          this._offsetY = parseInt(e.target.value, 10);
          this._renderComposite();
        });
      }
      if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
          this._opacity = parseFloat(e.target.value);
          this._renderComposite();
        });
      }

      // Comparison Split Slider Drag Handling
      if (compareBox) {
        const handleMove = (clientX) => {
          const rect = compareBox.getBoundingClientRect();
          let x = clientX - rect.left;
          x = Math.max(0, Math.min(x, rect.width));
          const pct = (x / rect.width) * 100;
          this._setSliderPosition(pct);
        };

        compareBox.addEventListener('mousedown', (e) => {
          this._isDraggingSlider = true;
          handleMove(e.clientX);
        });

        window.addEventListener('mousemove', (e) => {
          if (this._isDraggingSlider) handleMove(e.clientX);
        });

        window.addEventListener('mouseup', () => {
          this._isDraggingSlider = false;
        });

        // Touch support for mobile
        compareBox.addEventListener('touchstart', (e) => {
          this._isDraggingSlider = true;
          if (e.touches[0]) handleMove(e.touches[0].clientX);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
          if (this._isDraggingSlider && e.touches[0]) handleMove(e.touches[0].clientX);
        }, { passive: true });

        window.addEventListener('touchend', () => {
          this._isDraggingSlider = false;
        });
      }
    },

    _setSliderPosition: function (pct) {
      this._sliderPos = pct;
      const afterLayer = document.getElementById('tryon-after-layer');
      const handle = document.getElementById('tryon-split-handle');
      if (afterLayer) afterLayer.style.clipPath = `inset(0 0 0 ${pct}%)`;
      if (handle) handle.style.left = `${pct}%`;
    },

    // ── PUBLIC OPEN / CLOSE ────────────────────────────────────
    open: async function (productData) {
      this.init();

      if (!productData) {
        // Fallback default product if launched generally
        if (typeof Store !== 'undefined' && Store.getProducts) {
          const prods = await Store.getProducts();
          productData = prods[0] || {
            id: 'sample_1',
            name: 'Royal Banarasi Silk Saree',
            price: 2499,
            imageUrl: 'https://placehold.co/400x500/8B1A4A/D4AF37?text=Nari+Niketan+Saree'
          };
        }
      }

      this._product = productData;

      // Update UI fields
      const modal = document.getElementById('nari-tryon-modal');
      const nameEl = document.getElementById('tryon-prod-name');
      const priceEl = document.getElementById('tryon-prod-price');
      const imgEl = document.getElementById('tryon-prod-img');

      if (nameEl) nameEl.textContent = this._product.name || 'Ethnic Outfit';
      if (priceEl) priceEl.textContent = `₹${Number(this._product.salePrice || this._product.price || 0).toLocaleString('en-IN')}`;
      if (imgEl) imgEl.src = this._product.imageUrl || (this._product.images && this._product.images[0]) || '';

      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
      this._isOpen = true;
      this._setSliderPosition(50);

      this._renderComposite();

      this._logAnalytics('tryon_opened', { productId: this._product.id, name: this._product.name });
    },

    close: function () {
      const modal = document.getElementById('nari-tryon-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
      this._isOpen = false;
    },

    // ── AVATAR & PHOTO SELECTION ───────────────────────────────
    selectAvatar: function (el, imgUrl) {
      document.querySelectorAll('.tryon-avatar-item').forEach(i => i.classList.remove('active'));
      if (el) el.classList.add('active');
      this._userImageSrc = imgUrl;

      const beforeImg = document.getElementById('tryon-before-img');
      if (beforeImg) beforeImg.src = imgUrl;

      this._renderComposite();
    },

    _handleFileUpload: function (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        this._userImageSrc = dataUrl;

        const beforeImg = document.getElementById('tryon-before-img');
        if (beforeImg) beforeImg.src = dataUrl;

        document.querySelectorAll('.tryon-avatar-item').forEach(i => i.classList.remove('active'));
        this._renderComposite();
      };
      reader.readAsDataURL(file);
    },

    // ── AI COMPOSITING & GARMENT DRAPE PIPELINE ────────────────
    _renderComposite: function () {
      const canvas = document.getElementById('tryon-composite-canvas');
      if (!canvas || !this._userImageSrc || !this._product) return;

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      // 1. Load User Base Image
      const userImg = new Image();
      userImg.crossOrigin = 'anonymous';
      userImg.onload = () => {
        ctx.clearRect(0, 0, width, height);

        // Draw User Photo
        ctx.drawImage(userImg, 0, 0, width, height);

        // 2. Load and Segment Garment Product Image
        const prodImg = new Image();
        prodImg.crossOrigin = 'anonymous';
        prodImg.onload = () => {
          this._composeGarmentOnCanvas(ctx, prodImg, width, height);
        };
        prodImg.src = this._product.imageUrl || (this._product.images && this._product.images[0]) || '';
      };
      userImg.src = this._userImageSrc;
    },

    _composeGarmentOnCanvas: function (ctx, garmentImg, canvasW, canvasH) {
      // Offscreen canvas for garment chroma/background segmentation
      const offCanvas = document.createElement('canvas');
      const offCtx = offCanvas.getContext('2d');
      const gW = garmentImg.naturalWidth || 300;
      const gH = garmentImg.naturalHeight || 400;
      offCanvas.width = gW;
      offCanvas.height = gH;

      offCtx.drawImage(garmentImg, 0, 0, gW, gH);
      const imgData = offCtx.getImageData(0, 0, gW, gH);
      const d = imgData.data;

      // Simple chroma & luminance background removal (removes studio white/light gray backdrop)
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const isNearWhite = (r > 235 && g > 235 && b > 235);
        const isNearBlack = (r < 15 && g < 15 && b < 15 && i < gW * 4 * 15); // only top margin black

        if (isNearWhite || isNearBlack) {
          d[i + 3] = 0; // Transparent
        } else if (r > 215 && g > 215 && b > 215) {
          d[i + 3] = Math.round(d[i + 3] * 0.4); // Feather edge
        }
      }
      offCtx.putImageData(imgData, 0, 0);

      // Category-aware Drape Positioning
      const cat = (this._product.category || '').toLowerCase();
      let targetW = canvasW * 0.85 * this._scale;
      let targetH = canvasH * 0.78 * this._scale;
      let targetX = (canvasW - targetW) / 2 + this._offsetX;
      let targetY = (canvasH * 0.26) + this._offsetY; // aligns with shoulder line

      if (cat.includes('saree')) {
        targetW = canvasW * 0.88 * this._scale;
        targetH = canvasH * 0.82 * this._scale;
        targetY = (canvasH * 0.24) + this._offsetY;
      } else if (cat.includes('lehenga')) {
        targetW = canvasW * 0.92 * this._scale;
        targetH = canvasH * 0.85 * this._scale;
        targetY = (canvasH * 0.22) + this._offsetY;
      } else if (cat.includes('kurta')) {
        targetW = canvasW * 0.78 * this._scale;
        targetH = canvasH * 0.72 * this._scale;
        targetY = (canvasH * 0.28) + this._offsetY;
      }

      ctx.save();
      ctx.globalAlpha = this._opacity;

      // Soft shadow under garment for photorealism
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 8;

      ctx.drawImage(offCanvas, targetX, targetY, targetW, targetH);
      ctx.restore();
    },

    // ── CART & SHARING ─────────────────────────────────────────
    _handleAddToCart: function () {
      if (!this._product) return;

      const id = this._product.id || '';
      const name = this._product.name || 'Outfit';
      const price = this._product.salePrice || this._product.price || 0;

      if (typeof Cart !== 'undefined' && Cart.add) {
        Cart.add(id, name, price);
        if (typeof App !== 'undefined' && App.toast) {
          App.toast(`Added "${name}" to your cart! 🛍️`, 'success');
        }
      } else {
        const items = JSON.parse(localStorage.getItem('nn_cart') || '[]');
        items.push({ id, name, price, qty: 1 });
        localStorage.setItem('nn_cart', JSON.stringify(items));
        alert(`Added "${name}" to your cart!`);
      }

      this._logAnalytics('tryon_cart_add', { productId: id, name, price });
      this.close();
    },

    _handleShare: function () {
      if (!this._product) return;
      const url = `https://nari-niketan.web.app/product.html?id=${encodeURIComponent(this._product.id || '')}`;
      const msg = `✨ Check out how the "${this._product.name}" looks with Nari Niketan AI Virtual Try-On! Discover your elegance here: ${url}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
      this._logAnalytics('tryon_whatsapp_share', { productId: this._product.id });
    },

    // ── TELEMETRY LOGGER ───────────────────────────────────────
    _logAnalytics: function (event, data) {
      setTimeout(() => {
        try {
          if (typeof db !== 'undefined') {
            db.collection('aiStylistSessions').add({
              event: event,
              data: data || {},
              page: window.location.pathname,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              clientTime: new Date().toISOString()
            }).catch(() => {});
          }
        } catch (e) {}
      }, 100);
    }
  };

  window.VirtualTryOn = VirtualTryOn;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VirtualTryOn.init());
  } else {
    VirtualTryOn.init();
  }

})(window, document);
