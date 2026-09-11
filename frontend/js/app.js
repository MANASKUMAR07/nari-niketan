// =============================================
// NARI NIKETAN — App Utilities & Shared Logic
// =============================================

const App = {
  currentUser: null,
  userProfile: null,
  authListeners: [],

  onAuthChange(cb) {
    if (typeof cb === 'function') {
      this.authListeners.push(cb);
      if (this.currentUser !== null || (window.auth && auth.currentUser)) {
        cb(this.currentUser || auth.currentUser);
      }
    }
  },

  init() {
    this.initNavbar();
    this.initToastContainer();
    
    // Listen to Firebase Auth state
    auth.onAuthStateChanged(async user => {
      this.currentUser = user;
      this.updateNavUser(); // Update navbar immediately
      this.notifyAuthListeners(user);

      if (user) {
        try {
          this.userProfile = await Store.getUserProfile(user.uid);
          if (!this.userProfile) {
            await Store.createUserProfile(user.uid, {
              name: user.displayName || "",
              email: user.email || "",
              phone: user.phoneNumber || ""
            });
            this.userProfile = await Store.getUserProfile(user.uid);
          }
        } catch (err) {
          console.warn("User profile fetch/create error:", err);
        }
        this.updateNavUser(); // Re-update with full profile data if available
        this.notifyAuthListeners(user);
      } else {
        this.userProfile = null;
        this.updateNavUser();
        this.notifyAuthListeners(null);
      }
    });

    Cart.updateBadge();
    this.initScrollEffect();
    // Init sample data only once (skip on repeat visits to avoid competing Firestore reads)
    if (!localStorage.getItem('nn_sample_seeded')) {
      Store.initSampleData().then(() => {
        localStorage.setItem('nn_sample_seeded', '1');
      }).catch(console.error);
    }
  },

  initNavbar() {
    // Mobile menu toggle
    const hamburger = document.getElementById("hamburger");
    const mobileNav = document.getElementById("mobile-nav");
    if (hamburger && mobileNav) {
      hamburger.addEventListener("click", () => {
        hamburger.classList.toggle("open");
        mobileNav.classList.toggle("open");
      });
    }
    // Close mobile nav on link click
    document.querySelectorAll(".mobile-nav a, .mobile-nav button").forEach(el => {
      el.addEventListener("click", () => {
        if (hamburger) hamburger.classList.remove("open");
        if (mobileNav) mobileNav.classList.remove("open");
      });
    });
    // User dropdown toggle
    const avatar = document.getElementById("nav-avatar");
    const dropdown = document.getElementById("user-dropdown");
    if (avatar && dropdown) {
      avatar.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
      });
      document.addEventListener("click", () => dropdown.classList.remove("open"));
    }
    // Active link highlight
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a, .mobile-nav a").forEach(link => {
      const href = link.getAttribute("href") || "";
      if (href === currentPage || (currentPage === "index.html" && href === "./") || href.includes(currentPage.replace(".html",""))) {
        link.classList.add("active");
      }
    });
  },

  initScrollEffect() {
    const navbar = document.querySelector(".navbar");
    if (!navbar) return;
    const onScroll = () => {
      navbar.classList.toggle("scrolled", window.scrollY > 50);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  },

  notifyAuthListeners(user) {
    if (Array.isArray(this.authListeners)) {
      this.authListeners.forEach(cb => {
        try { cb(user); } catch(e) { console.warn("auth listener error:", e); }
      });
    }
  },

  async updateNavUser() {
    const loginBtn = document.getElementById("nav-login-btn");
    const userMenu = document.getElementById("nav-user-menu");
    const avatarEl = document.getElementById("nav-avatar");
    const userNameEl = document.getElementById("nav-user-name");
    const dropdown = document.getElementById("user-dropdown");

    // Nari Niketan navbar elements (index.html & navbar.js)
    const nnGreeting = document.getElementById("nn-user-greeting");
    const nnSignedIn = document.getElementById("nn-dropdown-signed-in");
    const nnSignedOut = document.getElementById("nn-dropdown-signed-out");
    const nnDropName = document.getElementById("nn-dropdown-name");

    if (this.currentUser) {
      const name = this.userProfile?.name || this.currentUser.displayName || (this.currentUser.email ? this.currentUser.email.split('@')[0] : "User");
      
      if (loginBtn) loginBtn.style.display = "none";
      if (userMenu) userMenu.style.display = "flex";
      if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
      if (userNameEl) userNameEl.textContent = name;

      // Update Nari Niketan navbar
      if (nnGreeting) nnGreeting.textContent = name;
      if (nnDropName) nnDropName.textContent = name;
      if (nnSignedIn) nnSignedIn.style.display = "";
      if (nnSignedOut) nnSignedOut.style.display = "none";

      // Inject Admin Panel link for admin users (only once)
      if (dropdown && !dropdown.querySelector(".admin-panel-link")) {
        try {
          const isAdmin = await Store.isUserAdmin(this.currentUser.uid);
          if (isAdmin) {
            const adminLink = document.createElement("a");
            adminLink.href = "admin/index.html";
            adminLink.className = "admin-panel-link";
            adminLink.innerHTML = "🔧 Admin Panel";
            adminLink.style.cssText = "color:var(--accent,#D4AF37)!important;font-weight:700;";
            const firstDivider = dropdown.querySelector(".dropdown-divider");
            if (firstDivider) {
              dropdown.insertBefore(adminLink, firstDivider);
            } else {
              dropdown.appendChild(adminLink);
            }
          }
        } catch (e) {
          console.warn("Admin check failed:", e);
        }
      }

    } else {
      if (loginBtn) loginBtn.style.display = "flex";
      if (userMenu) userMenu.style.display = "none";
      
      if (nnGreeting) nnGreeting.textContent = "Sign in";
      if (nnSignedIn) nnSignedIn.style.display = "none";
      if (nnSignedOut) nnSignedOut.style.display = "";
    }
  },


  // Guard: redirect to login if not authenticated
  requireAuth(redirectBack = true) {
    return new Promise((resolve) => {
      auth.onAuthStateChanged(user => {
        if (!user) {
          const back = redirectBack ? `?redirect=${encodeURIComponent(window.location.href)}` : "";
          window.location.href = `login.html${back}`;
        } else {
          resolve(user);
        }
      });
    });
  },

  // Toast notifications
  initToastContainer() {
    if (!document.getElementById("toast-container")) {
      const el = document.createElement("div");
      el.id = "toast-container";
      document.body.appendChild(el);
    }
  },

  toast(message, type = "default", duration = 3500) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const icons = { success: "✅", error: "❌", warning: "⚠️", default: "🔔" };
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || icons.default}</span><span class="toast-msg">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  },

  showLoader(show = true) {
    let overlay = document.getElementById("loading-overlay");
    if (show) {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "loading-overlay";
        overlay.className = "loading-overlay";
        overlay.innerHTML = `<img src="images/logo-circle.png" alt="Nari Niketan" style="width:60px;height:60px;border-radius:50%;border:2px solid var(--accent);box-shadow:0 4px 15px rgba(0,0,0,.2);margin-bottom:0.75rem;background:#FFF8F0"><div class="spinner"></div><span class="loading-brand">Nari Niketan</span>`;
        document.body.appendChild(overlay);
      }
    } else if (overlay) {
      overlay.remove();
    }
  },

  formatPrice(n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  },

  formatDate(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  },

  formatDateTime(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  },

  getStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return "★".repeat(full) + (half ? "☆" : "") + "☆".repeat(empty);
  },

  debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  async signOut() {
    try {
      await auth.signOut();
      window.location.href = "index.html";
    } catch (e) {
      this.toast("Error signing out. Please try again.", "error");
    }
  }
};

// Auto-init when DOM ready
document.addEventListener("DOMContentLoaded", () => App.init());

