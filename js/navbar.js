/**
 * NARI NIKETAN - Shared E-Commerce Navbar & Footer Injector
 * js/navbar.js  v2.0  (ASCII-safe, no raw emoji in JS)
 *
 * Copyright-safe design:
 * Own brand colors (maroon #8B1A4A + gold #D4AF37)
 * Own logo, name, and tagline
 * Own typography (Playfair Display + Inter)
 * Generic e-commerce UI pattern
 * No third-party trademarks or copyrighted assets used
 */

(function () {
  'use strict';

  /* --- 1. BUILD NAVBAR HTML --- */
  function buildNavbar() {
    /* Menu links - NO raw emojis in JS strings, use HTML entities or plain text */
    var menuItems = [
      { href: 'shop.html',                label: '&#9776; All Categories', gold: false },
      { href: 'shop.html?cat=Sarees',     label: 'Sarees',                 gold: false },
      { href: 'shop.html?cat=Suits',      label: 'Suits',                  gold: false },
      { href: 'shop.html?cat=Lehengas',   label: 'Lehengas',               gold: false },
      { href: 'shop.html?cat=Kurtas',     label: 'Kurtas',                 gold: false },
      { href: 'shop.html?cat=Dupattas',   label: 'Dupattas',               gold: false },
      { href: 'shop.html',                label: '&#10084; New Arrivals',  gold: true  },
      { href: 'shop.html',                label: '&#10003; Best Deals',    gold: true  },
      { href: 'seller/index.html',        label: 'Sell on Nari Niketan',   gold: false },
    ];

    var menuLinks = menuItems.map(function(item) {
      return '<a href="' + item.href + '"' + (item.gold ? ' class="amz-menu-highlight"' : '') + '>' + item.label + '</a>';
    }).join('');

    return (
      '<header class="amz-header" id="amz-header">' +

        '<div class="amz-navbar">' +

          /* Brand Logo */
          '<a href="index.html" class="amz-logo" title="Nari Niketan Home">' +
            '<img src="images/logo-circle.png?v=4.0" alt="Nari Niketan" class="amz-logo-img" width="36" height="36">' +
            '<div class="amz-logo-text">' +
              '<span class="amz-brand-name">Nari Niketan</span>' +
              '<span class="amz-brand-tag">Elegance Redefined</span>' +
            '</div>' +
          '</a>' +

          /* Delivery Location */
          '<div class="amz-deliver">' +
            '<span class="amz-small">Deliver to</span>' +
            '<strong>India</strong>' +
          '</div>' +

          /* Search Bar */
          '<div class="amz-search-wrap">' +
            '<select class="amz-search-cat" id="nn-search-cat">' +
              '<option value="">All</option>' +
              '<option value="Sarees">Sarees</option>' +
              '<option value="Suits">Suits</option>' +
              '<option value="Lehengas">Lehengas</option>' +
              '<option value="Kurtas">Kurtas</option>' +
              '<option value="Dupattas">Dupattas</option>' +
            '</select>' +
            '<input type="text" class="amz-search-input" id="nn-search-input"' +
              ' placeholder="Search Nari Niketan..."' +
              ' onkeydown="if(event.key===\'Enter\') NNNav.search()">' +
            '<button class="amz-search-btn" onclick="NNNav.search()" aria-label="Search">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
              ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +

          /* Account & Lists */
          '<div class="amz-nav-item" id="nn-account-btn">' +
            '<span class="amz-small">Hello, <span id="nn-user-greeting">Sign in</span></span>' +
            '<strong>Account &amp; Lists &#9660;</strong>' +
            '<div class="amz-dropdown" id="nn-account-dropdown">' +
              '<div id="nn-dropdown-signed-out">' +
                '<div class="amz-dropdown-header">' +
                  '<a href="login.html" class="amz-dropdown-signin-btn">Sign In</a>' +
                  '<p>New customer? <a href="register.html">Start here.</a></p>' +
                '</div>' +
                '<div class="amz-dropdown-body">' +
                  '<h4>Your Lists</h4>' +
                  '<a href="my-orders.html">My Orders</a>' +
                  '<a href="cart.html">Shopping Cart</a>' +
                '</div>' +
              '</div>' +
              '<div id="nn-dropdown-signed-in" style="display:none">' +
                '<div class="amz-dropdown-header">' +
                  '<p class="amz-dropdown-username">Signed in as <strong id="nn-dropdown-name">User</strong></p>' +
                '</div>' +
                '<div class="amz-dropdown-body">' +
                  '<h4>Your Account</h4>' +
                  '<a href="my-account.html">My Account</a>' +
                  '<a href="my-orders.html">My Orders</a>' +
                  '<hr class="amz-dropdown-divider">' +
                  '<button onclick="if(window.App)App.signOut()" class="amz-dropdown-signout">Sign Out</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          /* Returns & Orders */
          '<div class="amz-nav-item" onclick="window.location.href=\'my-orders.html\'" style="cursor:pointer">' +
            '<span class="amz-small">Returns</span>' +
            '<strong>&amp; Orders</strong>' +
          '</div>' +

          /* Cart */
          '<a href="cart.html" class="amz-cart-btn" title="Shopping Cart">' +
            '<div class="amz-cart-icon-wrap">' +
              '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
              ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>' +
              '<line x1="3" y1="6" x2="21" y2="6"/>' +
              '<path d="M16 10a4 4 0 01-8 0"/>' +
              '</svg>' +
              '<span class="amz-cart-count" id="cart-count" style="display:none">0</span>' +
            '</div>' +
            '<strong>Cart</strong>' +
          '</a>' +

          /* Install App Button */
          '<button class="amz-install-btn pwa-install-trigger" id="navbar-install-btn"' +
            ' onclick="if(window.triggerPWAInstall)window.triggerPWAInstall()" title="Install App">' +
            'Install App' +
          '</button>' +

          /* Hamburger */
          '<button class="amz-hamburger" id="nn-hamburger" aria-label="Toggle menu">' +
            '<span></span><span></span><span></span>' +
          '</button>' +

        '</div>' +

        /* Category Menu Bar */
        '<nav class="amz-menu" id="amz-menu">' +
          menuLinks +
        '</nav>' +

      '</header>' +

      /* Mobile Drawer */
      '<div class="amz-mobile-nav" id="nn-mobile-nav">' +
        '<div class="amz-drawer-header">' +
          '<div class="amz-drawer-user">' +
            '<span class="amz-drawer-user-icon">&#128100;</span>' +
            '<span>Hello, <span id="nn-mobile-greeting" class="amz-drawer-greeting">Sign in</span></span>' +
          '</div>' +
          '<button class="amz-drawer-close" id="nn-drawer-close" aria-label="Close menu">&times;</button>' +
        '</div>' +
        '<a href="index.html">Home</a>' +
        '<a href="shop.html">Shop All</a>' +
        '<a href="shop.html?cat=Sarees">Sarees</a>' +
        '<a href="shop.html?cat=Suits">Suits</a>' +
        '<a href="shop.html?cat=Lehengas">Lehengas</a>' +
        '<a href="shop.html?cat=Kurtas">Kurtas</a>' +
        '<hr style="border-color:rgba(255,255,255,0.12);margin:0.5rem 0">' +
        '<a href="cart.html">Cart</a>' +
        '<a href="my-orders.html">My Orders</a>' +
        '<a href="login.html">Login / Register</a>' +
        '<button class="pwa-install-trigger"' +
          ' onclick="if(window.triggerPWAInstall)window.triggerPWAInstall()"' +
          ' style="background:none;border:none;color:#D4AF37;font-weight:700;padding:0.75rem 1.25rem;text-align:left;cursor:pointer;font-size:0.95rem;width:100%;">' +
          'Install App' +
        '</button>' +
      '</div>' +
      '<div class="amz-mobile-overlay" id="nn-mobile-overlay"></div>'
    );
  }

  /* --- 2. BUILD FOOTER HTML --- */
  function buildFooter() {
    return (
      '<footer class="amz-footer">' +
        '<div class="amz-back-top" onclick="window.scrollTo({top:0,behavior:\'smooth\'})">&#8593; Back to top</div>' +
        '<div class="amz-footer-main">' +

          '<div class="amz-footer-col">' +
            '<div class="amz-footer-brand">' +
              '<img src="images/logo-circle.png?v=4.0" alt="Nari Niketan" width="42" height="42">' +
              '<div>' +
                '<span class="amz-footer-brand-name">Nari Niketan</span>' +
                '<span class="amz-footer-brand-tag">Elegance Redefined</span>' +
              '</div>' +
            '</div>' +
            '<p class="amz-footer-desc">Your premier destination for authentic Indian ethnic wear. Celebrating the grace and tradition of Indian fashion.</p>' +
            '<div class="amz-footer-social">' +
              '<a href="#" aria-label="Facebook">FB</a>' +
              '<a href="#" aria-label="Instagram">IG</a>' +
              '<a href="#" aria-label="Twitter">TW</a>' +
            '</div>' +
          '</div>' +

          '<div class="amz-footer-col">' +
            '<h3>Shop</h3>' +
            '<a href="shop.html">All Products</a>' +
            '<a href="shop.html?cat=Sarees">Sarees</a>' +
            '<a href="shop.html?cat=Suits">Salwar Suits</a>' +
            '<a href="shop.html?cat=Lehengas">Lehengas</a>' +
            '<a href="shop.html?cat=Kurtas">Kurtas</a>' +
            '<a href="seller/index.html">Sell on Nari Niketan</a>' +
          '</div>' +

          '<div class="amz-footer-col">' +
            '<h3>Help &amp; Policies</h3>' +
            '<a href="my-account.html">Your Account</a>' +
            '<a href="my-orders.html">Your Orders</a>' +
            '<a href="return-policy.html">Return &amp; Refund Policy</a>' +
            '<a href="grievance-redressal.html" style="color:#D4AF37;font-weight:600">Grievance Redressal</a>' +
            '<a href="terms-and-conditions.html">Terms &amp; Conditions</a>' +
            '<a href="privacy-policy.html">Privacy Policy</a>' +
          '</div>' +

          '<div class="amz-footer-col">' +
            '<h3>Contact Us</h3>' +
            '<div class="amz-footer-contact">' +
              '<p><a href="https://maps.app.goo.gl/WCfYf5sqeQSv9ZCw9" target="_blank" rel="noopener">Nari Niketan, Rihand Nagar</a></p>' +
              '<p><a href="tel:+916307032042">+91 6307032042</a></p>' +
              '<p><a href="mailto:nariniketan07@gmail.com">nariniketan07@gmail.com</a></p>' +
              '<p><a href="grievance-redressal.html" style="color:#D4AF37">Lodge Grievance &rarr;</a></p>' +
            '</div>' +
          '</div>' +

        '</div>' +
        '<div class="amz-footer-bottom">' +
          '<span>Nari Niketan</span>' +
          '<p>&copy; 2026 Nari Niketan. All rights reserved.</p>' +
          '<p>' +
            '<a href="grievance-redressal.html">Grievance</a> &bull; ' +
            '<a href="terms-and-conditions.html">Terms</a> &bull; ' +
            '<a href="privacy-policy.html">Privacy</a> &bull; ' +
            '<a href="return-policy.html">Returns</a>' +
          '</p>' +
          '<p>Made with love in India. Created by Manas.</p>' +
        '</div>' +
      '</footer>'
    );
  }

  /* --- 3. INJECT INTO PAGE --- */
  function inject() {
    /* Remove old navbar elements */
    ['navbar', 'mobile-nav'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });

    /* Remove existing amz-header if already injected */
    var existingHeader = document.getElementById('amz-header');
    if (existingHeader) existingHeader.parentElement && existingHeader.parentElement.remove
      ? existingHeader.remove() : null;

    var existingMobileNav = document.getElementById('nn-mobile-nav');
    if (existingMobileNav) existingMobileNav.remove();

    var existingOverlay = document.getElementById('nn-mobile-overlay');
    if (existingOverlay) existingOverlay.remove();

    /* Inject navbar HTML at top of body */
    var tmp = document.createElement('div');
    tmp.innerHTML = buildNavbar();
    while (tmp.firstChild) {
      document.body.insertBefore(tmp.firstChild, document.body.firstChild);
    }

    /* Replace or append footer */
    var oldFooter = document.querySelector('footer');
    var ftmp = document.createElement('div');
    ftmp.innerHTML = buildFooter();
    var newFooter = ftmp.firstElementChild;
    if (oldFooter) {
      oldFooter.parentNode.replaceChild(newFooter, oldFooter);
    } else {
      document.body.appendChild(newFooter);
    }
  }

  /* --- 4. INIT INTERACTIONS --- */
  function initInteractions() {
    var hamburger   = document.getElementById('nn-hamburger');
    var mobileNav   = document.getElementById('nn-mobile-nav');
    var overlay     = document.getElementById('nn-mobile-overlay');
    var accountBtn  = document.getElementById('nn-account-btn');
    var dropdown    = document.getElementById('nn-account-dropdown');

    if (hamburger && mobileNav) {
      hamburger.addEventListener('click', function() {
        var open = mobileNav.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open', open);
        hamburger.classList.toggle('open', open);
      });
    }

    var closeBtn = document.getElementById('nn-drawer-close') || document.getElementById('amz-drawer-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        if (mobileNav) mobileNav.classList.remove('open');
        if (hamburger) hamburger.classList.remove('open');
        if (overlay)   overlay.classList.remove('open');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', function() {
        if (mobileNav)   mobileNav.classList.remove('open');
        if (hamburger)   hamburger.classList.remove('open');
        overlay.classList.remove('open');
      });
    }
    if (accountBtn && dropdown) {
      accountBtn.addEventListener('click', function(e) {
        dropdown.classList.toggle('open');
        e.stopPropagation();
      });
      document.addEventListener('click', function(e) {
        if (!accountBtn.contains(e.target)) dropdown.classList.remove('open');
      });
    }

    /* Sticky shadow on scroll */
    window.addEventListener('scroll', function() {
      var h = document.getElementById('amz-header');
      if (h) h.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  /* --- 5. CART COUNT --- */
  function updateCartBadge() {
    var badge = document.getElementById('cart-count');
    if (!badge) return;
    try {
      var items = JSON.parse(localStorage.getItem('nn_cart') || '[]');
      var count = items.reduce(function(s, i) { return s + (i.qty || 1); }, 0);
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? '' : 'none';
    } catch(e) { badge.style.display = 'none'; }
  }

  /* --- 6. AUTH STATE --- */
  function updateAuthUI(user) {
    var greeting    = document.getElementById('nn-user-greeting') || document.getElementById('amz-user-greeting');
    var signedIn    = document.getElementById('nn-dropdown-signed-in') || document.getElementById('amz-dropdown-signed-in');
    var signedOut   = document.getElementById('nn-dropdown-signed-out') || document.getElementById('amz-dropdown-signed-out');
    var dropName    = document.getElementById('nn-dropdown-name') || document.getElementById('amz-dropdown-name');
    var mobileNav   = document.getElementById('nn-mobile-nav') || document.getElementById('amz-mobile-nav');

    if (!greeting) return;
    if (user) {
      var name = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
      greeting.textContent = name;
      if (dropName)  dropName.textContent    = name;
      if (signedIn)  signedIn.style.display  = '';
      if (signedOut) signedOut.style.display = 'none';

      // Check if Admin/Owner and inject Admin Dashboard link
      if (window.Store && typeof Store.isUserAdmin === 'function') {
        Store.isUserAdmin(user.uid).then(function(isAdmin) {
          if (isAdmin && signedIn) {
            var body = signedIn.querySelector('.amz-dropdown-body');
            if (body && !body.querySelector('.amz-admin-link')) {
              var adminLink = document.createElement('a');
              adminLink.href = 'admin/index.html';
              adminLink.className = 'amz-admin-link';
              adminLink.innerHTML = '&#9881; Admin Dashboard';
              adminLink.style.cssText = 'color:#D4AF37!important;font-weight:700;display:block;margin-top:.4rem;padding-top:.4rem;border-top:1px dashed rgba(212,175,55,.3);';
              body.insertBefore(adminLink, body.firstChild);
            }
            if (mobileNav && !mobileNav.querySelector('.amz-mobile-admin-link')) {
              var mAdmin = document.createElement('a');
              mAdmin.href = 'admin/index.html';
              mAdmin.className = 'amz-mobile-admin-link';
              mAdmin.innerHTML = '&#9881; Admin Dashboard';
              mAdmin.style.cssText = 'color:#D4AF37!important;font-weight:700;';
              mobileNav.insertBefore(mAdmin, mobileNav.firstChild);
            }
          }
        }).catch(function(err){ console.warn('Admin check:', err); });
      }
    } else {
      greeting.textContent = 'Sign in';
      if (signedIn)  signedIn.style.display  = 'none';
      if (signedOut) signedOut.style.display = '';
      
      var oldAdmin = document.querySelector('.amz-admin-link');
      if (oldAdmin) oldAdmin.remove();
      var oldMAdmin = document.querySelector('.amz-mobile-admin-link');
      if (oldMAdmin) oldMAdmin.remove();
    }
  }

  /* --- 7. SEARCH --- */
  window.NNNav = {
    search: function() {
      var q   = (document.getElementById('nn-search-input')  || {}).value || '';
      var cat = (document.getElementById('nn-search-cat') || {}).value || '';
      var url = 'shop.html';
      var params = [];
      if (cat.trim()) params.push('cat='    + encodeURIComponent(cat.trim()));
      if (q.trim())   params.push('search=' + encodeURIComponent(q.trim()));
      if (params.length) url += '?' + params.join('&');
      window.location.href = url;
    }
  };

  /* --- 8. BOOT --- */
  function boot() {
    inject();
    initInteractions();
    updateCartBadge();
    window.addEventListener('storage', updateCartBadge);

    /* Hook into App auth when available */
    var tryCount = 0;
    function tryAuth() {
      if (window.App && typeof App.onAuthChange === 'function') {
        App.onAuthChange(updateAuthUI);
      } else if (tryCount < 20) {
        tryCount++;
        setTimeout(tryAuth, 300);
      }
    }
    tryAuth();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
