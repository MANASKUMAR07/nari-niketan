/* ==========================================================
   NARI NIKETAN — Nari AI Ads & Promotional Ecosystem
   Version: 1.0 (Privacy-First, Zero-Hallucination Ad Engine)
   ========================================================== */

(function (window) {
  'use strict';

  const NariAIAds = {
    // ── AD TYPES CONFIGURATION ────────────────────────────────
    AD_TYPES: {
      PRODUCT_AD: 'product_ad',
      NEW_ARRIVAL: 'new_arrival',
      BESTSELLER: 'bestseller',
      DISCOUNT_DEAL: 'discount_deal',
      COLLECTION: 'collection',
      FESTIVAL: 'festival',
      SEASONAL: 'seasonal',
      PERSONALIZED_REC: 'personalized_rec',
      LIMITED_STOCK: 'limited_stock',
      TRENDING: 'trending',
      COMPLETE_LOOK: 'complete_look',
      FLASH_SALE: 'flash_sale'
    },

    // Session impression capper: max 3 views per ad per session
    _sessionImpressions: {},

    // ── NATURAL LANGUAGE CAMPAIGN PARSER ──────────────────────
    parsePromptToCampaign: function (promptText, allProducts = []) {
      const q = (promptText || '').toLowerCase();
      
      // 1. Identify Target Category
      let targetCat = null;
      if (q.includes('saree') || q.includes('sari')) targetCat = 'Sarees';
      else if (q.includes('suit') || q.includes('salwar') || q.includes('anarkali')) targetCat = 'Suits';
      else if (q.includes('lehenga') || q.includes('choli')) targetCat = 'Lehengas';
      else if (q.includes('kurta') || q.includes('kurti')) targetCat = 'Kurtas';
      else if (q.includes('jewel') || q.includes('necklace')) targetCat = 'Jewellery';
      else if (q.includes('access') || q.includes('dupatta')) targetCat = 'Accessories';

      // 2. Identify Price Limits (e.g. "under 3000", "below 5000", "under ₹2500")
      let priceMax = null;
      const priceMatch = q.match(/(?:under|below|less than|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
      if (priceMatch) {
        priceMax = parseInt(priceMatch[1], 10);
      }

      // 3. Identify Discount Minimum (e.g. "above 30%", "discount > 20%")
      let discountMin = null;
      const discMatch = q.match(/(?:discount|off|save)\s*(?:above|over|more than|greater than|>=?)?\s*(\d+)%/i);
      if (discMatch) {
        discountMin = parseInt(discMatch[1], 10);
      }

      // 4. Identify Festival / Occasion / Theme
      let theme = 'Festive';
      let themeName = 'Celebration';
      if (q.includes('durga puja') || q.includes('puja') || q.includes('pooja')) {
        theme = 'Durga Puja';
        themeName = 'Durga Puja Elegance';
      } else if (q.includes('diwali') || q.includes('deepavali')) {
        theme = 'Diwali';
        themeName = 'Diwali Festive Splendour';
      } else if (q.includes('wedding') || q.includes('bridal') || q.includes('dulhan') || q.includes('shaadi')) {
        theme = 'Wedding';
        themeName = 'Royal Wedding Edit';
      } else if (q.includes('karwa chauth')) {
        theme = 'Karwa Chauth';
        themeName = 'Karwa Chauth Special';
      } else if (q.includes('eid')) {
        theme = 'Eid';
        themeName = 'Eid Mubarak Collection';
      } else if (q.includes('new arrival') || q.includes('latest')) {
        theme = 'New Arrivals';
        themeName = 'Fresh Season Arrivals';
      } else if (q.includes('bestseller') || q.includes('trending') || q.includes('popular')) {
        theme = 'Bestsellers';
        themeName = 'Most Loved Ethnic Styles';
      }

      // 5. Filter Authentic Products from Active Database
      let matchedProducts = allProducts.filter(p => {
        if (p.active === false) return false;
        if (targetCat && p.category !== targetCat) return false;
        
        const price = p.salePrice || p.price || 0;
        if (priceMax && price > priceMax) return false;

        const mrp = p.price || 0;
        const disc = (mrp > price && price > 0) ? Math.round(((mrp - price) / mrp) * 100) : (p.discount || 0);
        if (discountMin && disc < discountMin) return false;

        return true;
      });

      // Fallback: If strict filters return fewer than 2 products, broaden match
      if (matchedProducts.length === 0 && allProducts.length > 0) {
        matchedProducts = allProducts.filter(p => p.active !== false).slice(0, 4);
      }

      const campaignId = 'camp_' + Date.now().toString(36);
      const catLabel = targetCat || 'Ethnic Collection';
      const year = new Date().getFullYear();

      // 6. Generate 3 Grounded Ad Copy Variations (Nari Niketan Signature Voice)
      const variations = [
        {
          id: 'var_a',
          label: 'Option A (Classic Luxury)',
          headline: `Celebrate ${theme} in Timeless Grace`,
          subheadline: `Discover handcrafted ${catLabel.toLowerCase()} curated for memorable festive moments.`,
          cta: `Shop ${theme} Edit`,
          badge: `${theme.toUpperCase()} SPECIAL`
        },
        {
          id: 'var_b',
          label: 'Option B (Value & Elegance)',
          headline: priceMax ? `Exquisite ${catLabel} Under ₹${priceMax.toLocaleString('en-IN')}` : `Handcrafted ${catLabel} for Every Celebration`,
          subheadline: `Authentic weaves & rich artistry delivered straight to your doorstep.`,
          cta: `Explore Collection`,
          badge: priceMax ? `UNDER ₹${priceMax}` : `BOUTIQUE PICKS`
        },
        {
          id: 'var_c',
          label: 'Option C (Festive Spotlight)',
          headline: `Drape Yourself in ${theme} Splendour`,
          subheadline: `Step out with poise in exclusive ${catLabel.toLowerCase()} designed to turn heads.`,
          cta: `Shop Now`,
          badge: `FEATURED COLLECTION`
        }
      ];

      return {
        id: campaignId,
        name: `${themeName} ${year}`,
        objective: `Promote ${targetCat ? targetCat.toLowerCase() : 'ethnic outfits'}${priceMax ? ' under ₹' + priceMax : ''} for ${theme}`,
        targetCategory: targetCat || 'All',
        priceMax,
        discountMin,
        theme,
        selectedProducts: matchedProducts.slice(0, 6),
        productIds: matchedProducts.slice(0, 6).map(p => p.id),
        adVariations: variations,
        selectedVariationId: 'var_a',
        headline: variations[0].headline,
        subheadline: variations[0].subheadline,
        cta: variations[0].cta,
        badge: variations[0].badge,
        placements: ['homepage_picks', 'category_banner', 'cart_recommendations'],
        rotationIntervalSec: 6,
        priority: 'high',
        status: 'draft',
        aiGenerated: true,
        aiPrompt: promptText,
        createdAt: new Date().toISOString()
      };
    },

    // ── TELEMETRY & TRACKING ──────────────────────────────────
    logImpression: function (campaignId, variationId, productId) {
      const key = `${campaignId}_${variationId}_${productId}`;
      const count = (this._sessionImpressions[key] || 0) + 1;
      this._sessionImpressions[key] = count;
      if (count > 3) return; // Prevent excessive session logging

      try {
        if (typeof db !== 'undefined' && db) {
          const dateStr = new Date().toISOString().slice(0, 10);
          const docRef = db.collection('adAnalytics').doc(`${campaignId}_${dateStr}`);
          docRef.set({
            campaignId,
            date: dateStr,
            impressions: firebase.firestore.FieldValue.increment(1),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true }).catch(() => {});
        }
      } catch (e) {}
    },

    logClick: function (campaignId, variationId, productId, targetUrl) {
      try {
        if (typeof db !== 'undefined' && db) {
          const dateStr = new Date().toISOString().slice(0, 10);
          const docRef = db.collection('adAnalytics').doc(`${campaignId}_${dateStr}`);
          docRef.set({
            campaignId,
            date: dateStr,
            clicks: firebase.firestore.FieldValue.increment(1),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true }).catch(() => {});
        }
      } catch (e) {}
      if (targetUrl) window.location.href = targetUrl;
    },

    // ── STOREFRONT ROTATING CAROUSEL (Nari AI Picks) ──────────
    renderPicks: async function (containerId, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const intervalSec = options.intervalSec || 6;
      let campaigns = [];

      // Fetch active campaigns or synthesize from catalog
      try {
        if (typeof db !== 'undefined' && db) {
          const snap = await db.collection('campaigns')
            .where('status', '==', 'active')
            .limit(5)
            .get();
          campaigns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (e) {
        console.warn('NariAIAds campaigns fetch fallback:', e);
      }

      // If no active campaigns, create default smart picks from Store catalog
      let products = [];
      if (typeof Store !== 'undefined' && Store.getProducts) {
        products = await Store.getProducts({ limit: 10 });
      }

      if (!campaigns.length && products.length > 0) {
        const defaultCamp = this.parsePromptToCampaign('Festive celebration new arrivals', products);
        campaigns = [defaultCamp];
      }

      // Collect slides
      const slides = [];
      campaigns.forEach(camp => {
        const prods = camp.selectedProducts && camp.selectedProducts.length ? camp.selectedProducts : products.slice(0, 4);
        prods.forEach(p => {
          const price = p.salePrice || p.price || 0;
          const mrp = p.price || 0;
          const disc = (mrp > price && price > 0) ? Math.round(((mrp - price) / mrp) * 100) : 0;
          const img = p.imageUrl || (p.images && p.images[0]) || 'https://placehold.co/400x533/8B1A4A/D4AF37?text=Nari+Niketan';

          slides.push({
            campaignId: camp.id || 'default_picks',
            variationId: camp.selectedVariationId || 'var_a',
            productId: p.id,
            productName: p.name || 'Ethnic Outfit',
            category: p.category || 'Collection',
            headline: camp.headline || `Elegant ${p.category || 'Styles'} for Every Celebration`,
            subheadline: camp.subheadline || `Discover our latest collection of handcrafted ethnic wear.`,
            badge: camp.badge || (disc > 0 ? `${disc}% OFF` : '✨ NARI AI PICK'),
            cta: camp.cta || 'Shop Now',
            price,
            mrp,
            disc,
            img,
            url: `product.html?id=${encodeURIComponent(p.id)}`
          });
        });
      });

      if (!slides.length) return;

      container.innerHTML = `
        <div class="nari-ai-picks-wrapper" id="_nai_wrapper">
          <div class="nari-ai-picks-header">
            <div class="nari-ai-picks-title">
              <span>✨ NARI AI PICKS</span>
              <span class="nari-ai-badge">Curated For You</span>
            </div>
            <span style="font-size:0.75rem;color:#D4AF37;">Handcrafted Indian Ethnic Wear</span>
          </div>

          <div class="nari-ai-slide-stage" id="_nai_stage">
            ${slides.map((s, idx) => `
              <div class="nari-ai-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
                <div class="nari-ai-slide-img-wrap" onclick="NariAIAds.logClick('${s.campaignId}', '${s.variationId}', '${s.productId}', '${s.url}')" style="cursor:pointer;">
                  ${s.badge ? `<div class="nari-ai-slide-badge">${s.badge}</div>` : ''}
                  <img src="${s.img}" alt="${s.productName}" loading="lazy">
                </div>
                <div class="nari-ai-slide-content">
                  <div class="nari-ai-campaign-tag">${s.category} &bull; Exclusive Edit</div>
                  <h2 class="nari-ai-headline">${s.headline}</h2>
                  <p class="nari-ai-subheadline">${s.subheadline}</p>
                  
                  <div class="nari-ai-price-row">
                    <span class="nari-ai-sale-price">₹${Number(s.price).toLocaleString('en-IN')}</span>
                    ${s.mrp > s.price ? `<span class="nari-ai-mrp">₹${Number(s.mrp).toLocaleString('en-IN')}</span>` : ''}
                    ${s.disc > 0 ? `<span class="nari-ai-save-badge">Save ${s.disc}%</span>` : ''}
                  </div>

                  <a href="${s.url}" class="nari-ai-cta-btn" onclick="NariAIAds.logClick('${s.campaignId}', '${s.variationId}', '${s.productId}', '${s.url}')">
                    <span>${s.cta}</span>
                    <span>→</span>
                  </a>
                </div>
              </div>
            `).join('')}

            <button class="nari-ai-nav-prev" onclick="NariAIAds._prevSlide()" title="Previous Slide">‹</button>
            <button class="nari-ai-nav-next" onclick="NariAIAds._nextSlide()" title="Next Slide">›</button>
          </div>

          <div class="nari-ai-dots-bar" id="_nai_dots">
            ${slides.map((_, idx) => `
              <div class="nari-ai-dot ${idx === 0 ? 'active' : ''}" onclick="NariAIAds._goToSlide(${idx})"></div>
            `).join('')}
          </div>
        </div>
      `;

      // Log impression for initial slide
      this.logImpression(slides[0].campaignId, slides[0].variationId, slides[0].productId);

      // Start Autoplay Rotator
      this._initRotator(slides.length, intervalSec);
    },

    _currentSlide: 0,
    _slideCount: 0,
    _rotatorTimer: null,

    _initRotator: function (count, sec) {
      this._slideCount = count;
      this._currentSlide = 0;
      clearInterval(this._rotatorTimer);

      const ms = sec * 1000;
      this._rotatorTimer = setInterval(() => {
        this._nextSlide();
      }, ms);

      // Pause on hover
      const wrap = document.getElementById('_nai_wrapper');
      if (wrap) {
        wrap.addEventListener('mouseenter', () => clearInterval(this._rotatorTimer));
        wrap.addEventListener('mouseleave', () => {
          clearInterval(this._rotatorTimer);
          this._rotatorTimer = setInterval(() => this._nextSlide(), ms);
        });
      }
    },

    _goToSlide: function (idx) {
      const slides = document.querySelectorAll('.nari-ai-slide');
      const dots = document.querySelectorAll('.nari-ai-dot');
      if (!slides.length) return;

      slides.forEach(s => s.classList.remove('active'));
      dots.forEach(d => d.classList.remove('active'));

      this._currentSlide = (idx + this._slideCount) % this._slideCount;
      if (slides[this._currentSlide]) slides[this._currentSlide].classList.add('active');
      if (dots[this._currentSlide]) dots[this._currentSlide].classList.add('active');
    },

    _nextSlide: function () {
      this._goToSlide(this._currentSlide + 1);
    },

    _prevSlide: function () {
      this._goToSlide(this._currentSlide - 1);
    },

    // ── CONTEXTUAL CATEGORY BANNER ────────────────────────────
    renderCategoryBanner: async function (categoryName, containerId) {
      const el = document.getElementById(containerId);
      if (!el || !categoryName) return;

      const catPromos = {
        'Sarees': {
          title: '✨ The Pure Silk & Festive Saree Edit',
          desc: 'Immerse in regal Banarasi, Kanjivaram & Chanderi weaves handcrafted for grand milestones.'
        },
        'Suits': {
          title: '✨ Designer Salwar Suits & Anarkalis',
          desc: 'Effortless festive charm tailored with rich embroidery, flowing dupattas & comfort.'
        },
        'Lehengas': {
          title: '✨ Royal Bridal & Sangeet Lehengas',
          desc: 'Exquisite flair, intricate zari borders and opulent silhouettes for unforgettable celebrations.'
        },
        'Kurtas': {
          title: '✨ Everyday Elegance & Festive Kurtas',
          desc: 'Breathable fabrics and modern cuts for versatile styling from daytime to evening soirees.'
        },
        'Accessories': {
          title: '✨ Traditional Dupattas & Finishing Accents',
          desc: 'Complete your ethnic statement with handcrafted accessories.'
        }
      };

      const promo = catPromos[categoryName] || {
        title: `✨ Premium ${categoryName} Collection`,
        desc: 'Discover authentic Indian ethnic fashion curated with care by Nari Niketan.'
      };

      el.innerHTML = `
        <div class="nari-ai-category-banner">
          <div class="nari-ai-cat-content">
            <h3>${promo.title}</h3>
            <p>${promo.desc}</p>
          </div>
          <a href="#products-section" class="nari-ai-cta-btn" style="white-space:nowrap;">
            Explore ${categoryName}
          </a>
        </div>
      `;
    },

    // ── COMPLETE THE LOOK / PAIR RECOMMENDATIONS ──────────────
    renderCompleteTheLook: async function (currentProduct, containerId) {
      const el = document.getElementById(containerId);
      if (!el || !currentProduct) return;

      let pairCat = 'Accessories';
      if (currentProduct.category === 'Sarees') pairCat = 'Jewellery';
      else if (currentProduct.category === 'Suits') pairCat = 'Accessories';

      let items = [];
      if (typeof Store !== 'undefined' && Store.getProducts) {
        items = await Store.getProducts({ category: pairCat, limit: 3 });
      }

      if (!items.length) return;
      const pairItem = items[0];
      const price = pairItem.salePrice || pairItem.price || 0;
      const img = pairItem.imageUrl || (pairItem.images && pairItem.images[0]) || '';

      el.innerHTML = `
        <div class="nari-ai-pair-card">
          ${img ? `<img src="${img}" alt="${pairItem.name}" class="nari-ai-pair-thumb">` : ''}
          <div style="flex:1;">
            <div style="font-size:0.72rem;font-weight:700;color:#8B1A4A;text-transform:uppercase;">✨ Complete The Look</div>
            <h4 style="font-size:0.92rem;font-weight:700;margin:2px 0 4px;color:#1A0A0F;">${pairItem.name}</h4>
            <div style="font-size:0.85rem;font-weight:800;color:#8B1A4A;">₹${Number(price).toLocaleString('en-IN')}</div>
          </div>
          <button class="btn btn-accent btn-sm" onclick="Cart.add('${pairItem.id}', '${pairItem.name.replace(/'/g,"\'")}', ${price}); this.textContent='✓ Added';">
            + Add Pair
          </button>
        </div>
      `;
    }
  };

  window.NariAIAds = NariAIAds;

})(window);
