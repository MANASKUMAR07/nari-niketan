/* ==========================================================
   NARI NIKETAN — Wishlist + AI Style Quiz Engine  v1.0
   localStorage-based, zero backend required.
   ========================================================== */
(function (window) {
  'use strict';

  /* ─── STORAGE KEY ──────────────────────────────────────────── */
  var WL_KEY = 'nn_wishlist';

  /* ─── WISHLIST CORE ────────────────────────────────────────── */
  var Wishlist = {
    _items: [],

    /* Load from localStorage */
    _load: function () {
      try { this._items = JSON.parse(localStorage.getItem(WL_KEY)) || []; }
      catch (e) { this._items = []; }
    },

    /* Persist to localStorage */
    _save: function () {
      localStorage.setItem(WL_KEY, JSON.stringify(this._items));
      this.updateBadge();
      window.dispatchEvent(new Event('nn-wishlist-changed'));
    },

    /* Get all items */
    getAll: function () {
      this._load();
      return this._items;
    },

    /* Check if item exists */
    has: function (productId) {
      this._load();
      return this._items.some(function (i) { return i.id === productId; });
    },

    /* Add item */
    add: function (product) {
      this._load();
      if (!this.has(product.id)) {
        this._items.push({
          id: product.id,
          name: product.name || '',
          category: product.category || '',
          price: product.salePrice || product.price || 0,
          originalPrice: product.price || 0,
          image: (product.images && product.images[0])
            ? (product.images[0].thumbnail || product.images[0].medium || product.images[0].large || product.imageUrl || '')
            : (product.imageUrl || product.thumbnail || ''),
          addedAt: Date.now()
        });
        this._save();
        return true;
      }
      return false;
    },

    /* Remove item */
    remove: function (productId) {
      this._load();
      var len = this._items.length;
      this._items = this._items.filter(function (i) { return i.id !== productId; });
      if (this._items.length !== len) { this._save(); return true; }
      return false;
    },

    /* Toggle add/remove */
    toggle: function (product) {
      if (this.has(product.id)) {
        this.remove(product.id);
        return false; // removed
      } else {
        this.add(product);
        return true; // added
      }
    },

    /* Called from product card heart button */
    toggleCard: function (productId, event) {
      if (event) event.stopPropagation();

      // Try to get product data from window.allLoadedProducts (shop.html) or Store cache
      var product = null;
      if (window.allLoadedProducts) {
        product = window.allLoadedProducts.find(function (p) { return p.id === productId; });
      }
      if (!product && window.Store && typeof Store.getCachedProducts === 'function') {
        var cached = Store.getCachedProducts();
        product = cached.find(function (p) { return p.id === productId; });
      }
      if (!product) {
        product = { id: productId, name: productId };
      }

      var added = this.toggle(product);

      // Update heart button visual
      var btn = event ? event.currentTarget : null;
      if (!btn) {
        btn = document.querySelector('.product-wishlist[data-id="' + productId + '"]');
      }
      if (btn) {
        btn.classList.toggle('nn-wl-active', added);
        btn.classList.remove('nn-wl-bounce');
        // Force reflow for re-animation
        void btn.offsetWidth;
        btn.classList.add('nn-wl-bounce');
        btn.setAttribute('title', added ? 'Remove from Wishlist' : 'Add to Wishlist');
      }

      // Toast
      if (window.App && App.toast) {
        App.toast(added ? '\u2764\uFE0F Saved to Wishlist!' : 'Removed from Wishlist', added ? 'success' : 'info', 2000);
      }
    },

    /* Move single item to cart and remove from wishlist */
    moveToCart: function (productId) {
      var item = this.getAll().find(function (i) { return i.id === productId; });
      if (!item) return;

      if (window.Cart && Cart.add) {
        // Minimal product object for Cart.add
        Cart.add({ id: item.id, name: item.name, price: item.price, salePrice: item.price, stock: 99 }, null, null, 1);
      } else {
        var items = JSON.parse(localStorage.getItem('nn_cart') || '[]');
        var ex = items.find(function (i) { return i.key === item.id + '_default_default'; });
        if (ex) ex.qty++;
        else items.push({ key: item.id + '_default_default', id: item.id, name: item.name, price: item.price, qty: 1 });
        localStorage.setItem('nn_cart', JSON.stringify(items));
        window.dispatchEvent(new Event('storage'));
      }
      this.remove(productId);
      this.renderDrawerBody();

      if (window.App && App.toast) {
        App.toast('\uD83D\uDED2 Moved to Cart!', 'success', 2000);
      }
    },

    /* Move all wishlist items to cart */
    moveAllToCart: function () {
      var items = this.getAll();
      if (!items.length) return;
      items.forEach(function (item) {
        if (window.Cart && Cart.add) {
          Cart.add({ id: item.id, name: item.name, price: item.price, salePrice: item.price, stock: 99 }, null, null, 1);
        } else {
          var cart = JSON.parse(localStorage.getItem('nn_cart') || '[]');
          var ex = cart.find(function (c) { return c.key === item.id + '_default_default'; });
          if (ex) ex.qty++;
          else cart.push({ key: item.id + '_default_default', id: item.id, name: item.name, price: item.price, qty: 1 });
          localStorage.setItem('nn_cart', JSON.stringify(cart));
        }
      });
      window.dispatchEvent(new Event('storage'));
      this._items = [];
      this._save();
      this.renderDrawerBody();
      if (window.App && App.toast) {
        App.toast('\uD83D\uDED2 All items moved to Cart!', 'success', 2500);
      }
    },

    /* Share wishlist via WhatsApp */
    shareOnWhatsApp: function () {
      var items = this.getAll();
      if (!items.length) return;
      var lines = ['Hey! Look at these beautiful outfits I found on Nari Niketan \uD83D\uDED9\uFE0F\n'];
      items.slice(0, 5).forEach(function (item, i) {
        lines.push((i + 1) + '. ' + item.name + ' \u2014 \u20B9' + Number(item.price).toLocaleString('en-IN'));
      });
      lines.push('\n\uD83D\uDED2 Shop here: ' + window.location.origin + '/shop.html');
      lines.push('\nWhat do you think? \uD83D\uDE0D');
      var text = encodeURIComponent(lines.join('\n'));
      window.open('https://api.whatsapp.com/send?text=' + text, '_blank');
    },

    /* Update wishlist badge counts in all header buttons */
    updateBadge: function () {
      this._load();
      var count = this._items.length;
      // Drawer count badge
      var countBadge = document.getElementById('nn-wl-drawer-count');
      if (countBadge) countBadge.textContent = count;
      // Header badge (uses nn-cart-count style — controlled by display)
      var headerBadge = document.getElementById('nn-wl-badge-header');
      if (headerBadge) {
        headerBadge.textContent = count > 99 ? '99+' : count;
        headerBadge.style.display = count > 0 ? 'inline-flex' : 'none';
      }
      // Any other badges using nn-wl-nav-badge class
      document.querySelectorAll('.nn-wl-nav-badge:not(#nn-wl-badge-header)').forEach(function (b) {
        b.textContent = count > 99 ? '99+' : count;
        b.classList.toggle('visible', count > 0);
      });
    },

    /* Sync heart states of all visible product cards */
    syncCardStates: function () {
      var self = this;
      document.querySelectorAll('.product-wishlist[data-id]').forEach(function (btn) {
        var pid = btn.getAttribute('data-id');
        var isInWl = self.has(pid);
        btn.classList.toggle('nn-wl-active', isInWl);
        btn.setAttribute('title', isInWl ? 'Remove from Wishlist' : 'Add to Wishlist');
      });
    },

    /* ── DRAWER HTML INJECTION ──────────────────────────────── */
    injectDrawer: function () {
      if (document.getElementById('nn-wl-backdrop')) return; // already injected

      var backdrop = document.createElement('div');
      backdrop.id = 'nn-wl-backdrop';
      backdrop.className = 'nn-wl-backdrop';
      backdrop.addEventListener('click', function () { Wishlist.closeDrawer(); });

      var drawer = document.createElement('div');
      drawer.id = 'nn-wl-drawer';
      drawer.className = 'nn-wl-drawer';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-label', 'My Wishlist');
      drawer.innerHTML =
        '<div class="nn-wl-header">' +
          '<div class="nn-wl-header-left">' +
            '<span style="font-size:1.2rem">\u2764\uFE0F</span>' +
            '<h2>My Wishlist</h2>' +
            '<span class="nn-wl-count-badge" id="nn-wl-drawer-count">0</span>' +
          '</div>' +
          '<button class="nn-wl-close-btn" id="nn-wl-close-btn" aria-label="Close Wishlist">&times;</button>' +
        '</div>' +
        '<div class="nn-wl-body" id="nn-wl-body"></div>' +
        '<div class="nn-wl-footer" id="nn-wl-footer" style="display:none">' +
          '<div class="nn-wl-footer-title">Quick Actions</div>' +
          '<button class="nn-wl-move-all-btn" onclick="Wishlist.moveAllToCart()">' +
            '\uD83D\uDED2 Move All to Cart' +
          '</button>' +
          '<button class="nn-wl-wa-share-btn" onclick="Wishlist.shareOnWhatsApp()">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
            'Share with Family' +
          '</button>' +
        '</div>';

      document.body.appendChild(backdrop);
      document.body.appendChild(drawer);

      document.getElementById('nn-wl-close-btn').addEventListener('click', function () {
        Wishlist.closeDrawer();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') Wishlist.closeDrawer();
      });

      this.renderDrawerBody();
    },

    renderDrawerBody: function () {
      var body = document.getElementById('nn-wl-body');
      var footer = document.getElementById('nn-wl-footer');
      if (!body) return;

      var items = this.getAll();
      var countEl = document.getElementById('nn-wl-drawer-count');
      if (countEl) countEl.textContent = items.length;

      if (!items.length) {
        if (footer) footer.style.display = 'none';
        body.innerHTML =
          '<div class="nn-wl-empty">' +
            '<div class="nn-wl-empty-icon">\uD83D\uDC9B</div>' +
            '<h3>Your Wishlist is Empty</h3>' +
            '<p>Save sarees, lehengas and suits you love while browsing — so you can share or buy them later.</p>' +
            '<a href="shop.html" class="nn-wl-explore-btn">\uD83D\uDECD\uFE0F Explore Collections</a>' +
          '</div>';
        return;
      }

      if (footer) footer.style.display = 'flex';
      var NO_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 74 98'%3E%3Crect fill='%23F5ECD8' width='74' height='98'/%3E%3C/svg%3E";

      body.innerHTML = items.map(function (item) {
        var hasSale = item.originalPrice && item.originalPrice > item.price;
        var origHtml = hasSale
          ? '<span class="nn-wl-item-orig">\u20B9' + Number(item.originalPrice).toLocaleString('en-IN') + '</span>'
          : '';
        return '<div class="nn-wl-item" id="nn-wl-item-' + item.id + '">' +
          '<img class="nn-wl-item-img" src="' + (item.image || NO_IMG) + '" alt="' + item.name + '" loading="lazy" onerror="this.src=\'' + NO_IMG + '\'">' +
          '<div class="nn-wl-item-info">' +
            '<span class="nn-wl-item-cat">' + (item.category || '') + '</span>' +
            '<div class="nn-wl-item-name" title="' + item.name + '">' + item.name + '</div>' +
            '<div>' +
              '<span class="nn-wl-item-price">\u20B9' + Number(item.price).toLocaleString('en-IN') + '</span>' +
              origHtml +
            '</div>' +
            '<div class="nn-wl-item-actions">' +
              '<button class="nn-wl-add-cart-btn" onclick="Wishlist.moveToCart(\'' + item.id + '\')">\uD83D\uDED2 Add to Bag</button>' +
              '<a href="product.html?id=' + item.id + '" class="nn-wl-view-btn">View</a>' +
            '</div>' +
          '</div>' +
          '<button class="nn-wl-remove-btn" onclick="Wishlist.remove(\'' + item.id + '\');Wishlist.renderDrawerBody();Wishlist.syncCardStates();" aria-label="Remove">&times;</button>' +
        '</div>';
      }).join('');
    },

    openDrawer: function () {
      this.renderDrawerBody();
      var backdrop = document.getElementById('nn-wl-backdrop');
      var drawer = document.getElementById('nn-wl-drawer');
      if (backdrop) backdrop.classList.add('open');
      if (drawer) drawer.classList.add('open');
      document.body.style.overflow = 'hidden';
    },

    closeDrawer: function () {
      var backdrop = document.getElementById('nn-wl-backdrop');
      var drawer = document.getElementById('nn-wl-drawer');
      if (backdrop) backdrop.classList.remove('open');
      if (drawer) drawer.classList.remove('open');
      document.body.style.overflow = '';
    },

    /* ── INIT ──────────────────────────────────────────────────── */
    init: function () {
      var self = this;
      this.injectDrawer();
      this.updateBadge();

      // Listen for storage changes from other tabs
      window.addEventListener('nn-wishlist-changed', function () {
        self.updateBadge();
        if (document.getElementById('nn-wl-drawer') &&
            document.getElementById('nn-wl-drawer').classList.contains('open')) {
          self.renderDrawerBody();
        }
        self.syncCardStates();
      });

      // Sync when products are rendered (observe DOM)
      var observer = new MutationObserver(function (mutations) {
        var shouldSync = mutations.some(function (m) {
          return Array.from(m.addedNodes).some(function (n) {
            return n.nodeType === 1 && (n.classList.contains('product-wishlist') || n.querySelector && n.querySelector('.product-wishlist'));
          });
        });
        if (shouldSync) self.syncCardStates();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  window.Wishlist = Wishlist;

  /* ─── AI OCCASION STYLIST QUIZ ──────────────────────────────── */
  var StyleQuiz = {
    _state: { occasion: null, color: null, category: null, budget: null },
    _step: 0,
    _products: [],

    STEPS: [
      {
        id: 'occasion',
        title: '\uD83C\uDFAF What is the Occasion?',
        sub: 'Choose the event you\'re dressing up for',
        options: [
          { emoji: '\uD83D\uDC70', label: 'Wedding & Bridal',      value: 'Wedding' },
          { emoji: '\uD83E\uDE94', label: 'Festive & Puja',         value: 'Festive' },
          { emoji: '\u2728',        label: 'Party & Sangeet',        value: 'Party' },
          { emoji: '\uD83C\uDF38', label: 'Everyday & Office',      value: 'Casual' }
        ]
      },
      {
        id: 'color',
        title: '\uD83C\uDFA8 Pick Your Color Vibe',
        sub: 'What palette speaks to your soul?',
        options: [
          { emoji: '\uD83D\uDC51', label: 'Royal Maroon & Gold',      value: 'maroon' },
          { emoji: '\uD83C\uDF38', label: 'Pastel Blush & Peach',     value: 'pastel' },
          { emoji: '\uD83D\uDC8E', label: 'Royal Blue & Wine',        value: 'blue' },
          { emoji: '\uD83C\uDF3F', label: 'Emerald & Mehendi Green',  value: 'green' },
          { emoji: '\u2600\uFE0F', label: 'Haldi Yellow & Mustard',   value: 'yellow' }
        ]
      },
      {
        id: 'category',
        title: '\uD83D\uDC57 Your Preferred Silhouette',
        sub: 'Which style makes you feel most like yourself?',
        options: [
          { emoji: '🥻', label: 'Silk & Designer Sarees',  value: 'Sarees' },
          { emoji: '\uD83D\uDC83', label: 'Royal Lehengas',           value: 'Lehengas' },
          { emoji: '\u2728',        label: 'Anarkali & Salwar Suits',  value: 'Suits' },
          { emoji: '\uD83C\uDF38', label: 'Modern Kurtas',            value: 'Kurtas' }
        ]
      },
      {
        id: 'budget',
        title: '\uD83D\uDCB0 What is Your Budget?',
        sub: 'We\'ll find the best in your range',
        options: [
          { emoji: '\uD83C\uDFF7\uFE0F', label: 'Under \u20B91,500',          value: 1500 },
          { emoji: '\uD83D\uDC8E',        label: '\u20B91,500 \u2013 \u20B93,000', value: 3000 },
          { emoji: '\uD83D\uDC51',        label: '\u20B93,000 \u2013 \u20B95,000', value: 5000 },
          { emoji: '\u2728',              label: 'Premium Above \u20B95,000', value: 99999 }
        ]
      }
    ],

    _colorKeywords: {
      maroon: ['red', 'maroon', 'wine', 'crimson', 'rani', 'magenta', 'pink', 'rose', 'gold', 'orange'],
      pastel:  ['peach', 'blush', 'cream', 'ivory', 'off-white', 'lavender', 'lilac', 'mint', 'light'],
      blue:    ['blue', 'navy', 'royal', 'teal', 'indigo', 'cerulean', 'cobalt'],
      green:   ['green', 'emerald', 'olive', 'forest', 'bottle', 'mehendi', 'sage'],
      yellow:  ['yellow', 'mustard', 'haldi', 'saffron', 'turmeric', 'marigold', 'golden', 'amber']
    },

    open: function () {
      this._state = { occasion: null, color: null, category: null, budget: null };
      this._step = 0;
      this._products = (window.allLoadedProducts || []).slice();
      this._ensureModal();
      this._renderStep(0);
      var overlay = document.getElementById('nn-quiz-overlay');
      if (overlay) overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    },

    close: function () {
      var overlay = document.getElementById('nn-quiz-overlay');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
    },

    _ensureModal: function () {
      if (document.getElementById('nn-quiz-overlay')) return;
      var overlay = document.createElement('div');
      overlay.id = 'nn-quiz-overlay';
      overlay.className = 'nn-quiz-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'Style Quiz');
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) StyleQuiz.close();
      });

      overlay.innerHTML =
        '<div class="nn-quiz-modal" id="nn-quiz-modal">' +
          '<div class="nn-quiz-modal-header">' +
            '<div>' +
              '<h2>\u2728 AI Occasion Stylist Quiz</h2>' +
              '<p>Find your perfect outfit in 30 seconds</p>' +
            '</div>' +
            '<button class="nn-quiz-close" aria-label="Close" onclick="StyleQuiz.close()">&times;</button>' +
          '</div>' +
          '<div class="nn-quiz-progress" id="nn-quiz-progress"></div>' +
          '<div id="nn-quiz-steps-wrap"></div>' +
          '<div id="nn-quiz-results" class="nn-quiz-results"></div>' +
        '</div>';
      document.body.appendChild(overlay);
    },

    _renderStep: function (stepIndex) {
      var self = this;
      var stepsWrap = document.getElementById('nn-quiz-steps-wrap');
      var results = document.getElementById('nn-quiz-results');
      if (!stepsWrap) return;

      results.classList.remove('active');

      var step = this.STEPS[stepIndex];
      var optionsHtml = step.options.map(function (opt) {
        return '<button class="nn-quiz-option" onclick="StyleQuiz._selectOption(\'' + step.id + '\',' +
          (typeof opt.value === 'number' ? opt.value : '\'' + opt.value + '\'') + ',this)">' +
          '<span class="nn-quiz-option-emoji">' + opt.emoji + '</span>' +
          opt.label +
          '</button>';
      }).join('');

      stepsWrap.innerHTML =
        '<div class="nn-quiz-step active">' +
          '<div class="nn-quiz-step-title">' + step.title + '</div>' +
          '<div class="nn-quiz-step-sub">' + step.sub + '</div>' +
          '<div class="nn-quiz-options">' + optionsHtml + '</div>' +
        '</div>';

      // Progress dots
      var progress = document.getElementById('nn-quiz-progress');
      if (progress) {
        progress.innerHTML = this.STEPS.map(function (_, i) {
          var cls = i < stepIndex ? 'done' : (i === stepIndex ? 'active' : '');
          return '<div class="nn-quiz-dot ' + cls + '"></div>';
        }).join('');
      }
    },

    _selectOption: function (field, value, btn) {
      var self = this;
      // Visual feedback
      if (btn) {
        var siblings = btn.closest('.nn-quiz-options').querySelectorAll('.nn-quiz-option');
        siblings.forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      }
      this._state[field] = value;

      // Small delay for visual feedback, then advance
      setTimeout(function () {
        self._step++;
        if (self._step < self.STEPS.length) {
          self._renderStep(self._step);
        } else {
          self._showResults();
        }
      }, 280);
    },

    _showResults: function () {
      var self = this;
      var stepsWrap = document.getElementById('nn-quiz-steps-wrap');
      var results = document.getElementById('nn-quiz-results');
      if (!results) return;

      // Hide progress + steps
      stepsWrap.innerHTML = '';
      var progress = document.getElementById('nn-quiz-progress');
      if (progress) progress.innerHTML = '';

      // Filter products
      var products = this._products;

      // Filter by category
      if (this._state.category) {
        var catFiltered = products.filter(function (p) { return p.category === self._state.category; });
        if (catFiltered.length >= 2) products = catFiltered;
      }

      // Filter by budget
      if (this._state.budget) {
        var budget = Number(this._state.budget);
        var budgetFiltered = products.filter(function (p) {
          var price = p.salePrice || p.price || 0;
          return price <= budget;
        });
        if (budgetFiltered.length >= 2) products = budgetFiltered;
      }

      // Score by color vibe
      var colorKws = this._colorKeywords[this._state.color] || [];
      products = products.map(function (p) {
        var score = Math.floor(Math.random() * 8) + 88; // Base 88-95%
        var nameAndDesc = ((p.name || '') + ' ' + (p.description || '') + ' ' + (p.fabric || '') + ' ' + (p.colors || []).join(' ')).toLowerCase();
        colorKws.forEach(function (kw) {
          if (nameAndDesc.includes(kw)) score = Math.min(99, score + 2);
        });
        if (p.featured) score = Math.min(99, score + 2);
        p._quizScore = score;
        return p;
      }).sort(function (a, b) { return b._quizScore - a._quizScore; });

      var topProducts = products.slice(0, 4);

      var NO_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 62 82'%3E%3Crect fill='%23F5ECD8' width='62' height='82'/%3E%3C/svg%3E";

      var cardsHtml = '';
      if (topProducts.length) {
        cardsHtml = topProducts.map(function (p) {
          var displayPrice = p.salePrice || p.price || 0;
          var imgSrc = '';
          if (p.images && p.images[0]) {
            imgSrc = (typeof p.images[0] === 'object')
              ? (p.images[0].thumbnail || p.images[0].medium || p.images[0].large || '')
              : p.images[0];
          }
          imgSrc = imgSrc || p.imageUrl || p.thumbnail || NO_IMG;
          return '<div class="nn-quiz-result-card">' +
            '<img class="nn-quiz-result-img" src="' + imgSrc + '" alt="' + p.name + '" loading="lazy" onerror="this.src=\'' + NO_IMG + '\'">' +
            '<div class="nn-quiz-result-info">' +
              '<span class="nn-quiz-result-match">' + p._quizScore + '% Match</span>' +
              '<div class="nn-quiz-result-name" title="' + p.name + '">' + p.name + '</div>' +
              '<div class="nn-quiz-result-price">\u20B9' + Number(displayPrice).toLocaleString('en-IN') + '</div>' +
              '<div class="nn-quiz-result-actions">' +
                '<button class="nn-quiz-cart-btn" onclick="StyleQuiz._addToCart(\'' + p.id + '\',\'' + p.name.replace(/'/g, "\\'") + '\',' + displayPrice + ')">\uD83D\uDED2 Add to Bag</button>' +
                '<button class="nn-quiz-wl-btn" onclick="StyleQuiz._saveToWishlist(\'' + p.id + '\')">\u2764 Save</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      } else {
        cardsHtml = '<p style="text-align:center;color:#888;font-size:0.9rem;">No exact matches found \u2014 try relaxing your budget or category!</p>';
      }

      var catSlug = this._state.category || '';
      var browsUrl = catSlug ? 'shop.html?cat=' + catSlug : 'shop.html';

      results.innerHTML =
        '<div class="nn-quiz-results-title">\uD83C\uDF89 Your Perfect Match is Here!</div>' +
        '<div class="nn-quiz-results-sub">Curated especially for your ' + (this._state.occasion || 'occasion') + ' look \u2728</div>' +
        '<div class="nn-quiz-result-cards">' + cardsHtml + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.75rem;">' +
          '<button class="nn-quiz-retake-btn" onclick="StyleQuiz.open()">\uD83D\uDD04 Retake Quiz</button>' +
          '<a href="' + browsUrl + '" class="nn-quiz-browse-btn">Browse All Matching Outfits &rarr;</a>' +
        '</div>';
      results.classList.add('active');
    },

    _addToCart: function (id, name, price) {
      if (window.Cart && Cart.add) {
        Cart.add({ id: id, name: name, price: price, salePrice: price, stock: 99 }, null, null, 1);
      } else {
        var items = JSON.parse(localStorage.getItem('nn_cart') || '[]');
        var ex = items.find(function (i) { return i.key === id + '_default_default'; });
        if (ex) ex.qty++;
        else items.push({ key: id + '_default_default', id: id, name: name, price: price, qty: 1 });
        localStorage.setItem('nn_cart', JSON.stringify(items));
        window.dispatchEvent(new Event('storage'));
      }
      if (window.App && App.toast) App.toast('\uD83D\uDED2 Added to Cart!', 'success', 2000);
    },

    _saveToWishlist: function (productId) {
      var p = (window.allLoadedProducts || []).find(function (p) { return p.id === productId; });
      if (p && window.Wishlist) {
        var added = Wishlist.toggle(p);
        if (window.App && App.toast) {
          App.toast(added ? '\u2764\uFE0F Saved to Wishlist!' : 'Removed from Wishlist', added ? 'success' : 'info', 1800);
        }
      }
    }
  };

  window.StyleQuiz = StyleQuiz;

  /* ─── INIT ON DOM READY ─────────────────────────────────────── */
  function boot() {
    Wishlist.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window);

