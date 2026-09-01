// ============================================================================
// NARI NIKETAN — PWA Install & Service Worker Controller
// ============================================================================

(function () {
  'use strict';

  let deferredInstallPrompt = null;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  // 1. REGISTER SERVICE WORKER
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Relative path to sw.js based on current root
      const swPath = window.location.pathname.includes('/admin/') || window.location.pathname.includes('/seller/') 
        ? '../sw.js' 
        : './sw.js';

      navigator.serviceWorker.register(swPath)
        .then((reg) => {
          console.log('[NariNiketan PWA] Service Worker registered with scope:', reg.scope);

          // Auto-check for updates whenever mobile app comes to foreground
          document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
              reg.update().catch(() => {});
            }
          });

          // Listen for available updates
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showUpdateToast(reg);
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[NariNiketan PWA] Service Worker registration failed:', err);
        });
    });
  }

  // 2. CAPTURE BEFOREINSTALLPROMPT
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.deferredPWAInstallPrompt = e;
    console.log('[NariNiketan PWA] beforeinstallprompt captured');

    // Buttons are already visible — no need to show them here
    // Check if dismissed recently (in last 24 hours)
    const lastDismissed = localStorage.getItem('nari_pwa_banner_dismissed');
    const now = Date.now();
    if (!lastDismissed || (now - parseInt(lastDismissed, 10)) > 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        showFloatingInstallBanner();
      }, 4000);
    }
  });

  // 3. LISTEN FOR SUCCESSFUL APP INSTALLATION
  window.addEventListener('appinstalled', () => {
    console.log('[NariNiketan PWA] Application installed successfully');
    deferredInstallPrompt = null;
    hideFloatingInstallBanner();
    document.querySelectorAll('.pwa-install-btn, .pwa-install-trigger').forEach((btn) => {
      btn.style.display = 'none';
    });
    showNetworkToast('🎉 Nari Niketan App installed successfully!', 'online');
  });

  // 4. MAIN INSTALL TRIGGER FUNCTION
  window.triggerPWAInstall = async function () {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log('[NariNiketan PWA] User choice outcome:', outcome);
        if (outcome === 'accepted') {
          hideFloatingInstallBanner();
        }
        deferredInstallPrompt = null;
      } catch (err) {
        console.error('[NariNiketan PWA] Error invoking install prompt:', err);
      }
    } else if (isIOS) {
      showIOSInstallModal();
    } else if (isStandalone) {
      showNetworkToast('✨ You are already using the installed Nari Niketan App!', 'online');
    } else {
      // Prompt not available yet — show instructions for all browsers
      showBrowserInstallInstructions();
    }
  };

  // 5. FLOATING INSTALL PROMPT BANNER
  function createInstallBannerDOM() {
    if (document.getElementById('pwa-install-banner') || isStandalone) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <img src="images/icons/icon-192x192.png" alt="Nari Niketan App" class="pwa-banner-icon">
      <div class="pwa-banner-info">
        <div class="pwa-banner-title">Nari Niketan App</div>
        <div class="pwa-banner-desc">Install for instant shopping & exclusive offers</div>
      </div>
      <div class="pwa-banner-actions">
        <button class="pwa-btn-install-now" onclick="window.triggerPWAInstall()">Install</button>
        <button class="pwa-btn-dismiss" onclick="dismissPWAInstallBanner()" aria-label="Close">✕</button>
      </div>
    `;
    document.body.appendChild(banner);
  }

  function showFloatingInstallBanner() {
    if (isStandalone) return;
    createInstallBannerDOM();
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.classList.add('visible');
  }

  function hideFloatingInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.classList.remove('visible');
  }

  window.dismissPWAInstallBanner = function () {
    hideFloatingInstallBanner();
    localStorage.setItem('nari_pwa_banner_dismissed', Date.now().toString());
  };

  // 6. iOS INSTALLATION GUIDE MODAL
  function showIOSInstallModal() {
    let overlay = document.getElementById('pwa-ios-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pwa-ios-modal-overlay';
      overlay.className = 'pwa-ios-modal-overlay';
      overlay.innerHTML = `
        <div class="pwa-ios-modal">
          <div class="pwa-ios-drag-handle"></div>
          <div class="pwa-ios-header">
            <img src="images/icons/icon-192x192.png" alt="Nari Niketan" class="pwa-ios-logo">
            <div class="pwa-ios-title">Install on iPhone / iPad</div>
          </div>
          <div class="pwa-ios-steps">
            <div class="pwa-ios-step">
              <span class="pwa-ios-step-num">1</span>
              <span>Tap the <span class="pwa-ios-icon-badge">⎋ Share</span> button in Safari's bottom toolbar.</span>
            </div>
            <div class="pwa-ios-step">
              <span class="pwa-ios-step-num">2</span>
              <span>Scroll down and tap <span class="pwa-ios-icon-badge">➕ Add to Home Screen</span>.</span>
            </div>
            <div class="pwa-ios-step">
              <span class="pwa-ios-step-num">3</span>
              <span>Tap <span class="pwa-ios-icon-badge">Add</span> in the top right corner.</span>
            </div>
          </div>
          <button class="pwa-ios-close-btn" onclick="closeIOSModal()">Got It, Thanks!</button>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeIOSModal();
      });
    }

    setTimeout(() => overlay.classList.add('active'), 50);
  }

  window.closeIOSModal = function () {
    const overlay = document.getElementById('pwa-ios-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  };

  function showDesktopInstructions() {
    showNetworkToast('💡 Tip: Click the install icon (⊕ or 📲) in your browser address bar to install!', 'online');
  }

  function showBrowserInstallInstructions() {
    // Show a rich modal with browser-specific instructions
    let overlay = document.getElementById('pwa-browser-install-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pwa-browser-install-modal';
      overlay.className = 'pwa-ios-modal-overlay';
      overlay.innerHTML = `
        <div class="pwa-ios-modal">
          <div class="pwa-ios-drag-handle"></div>
          <div class="pwa-ios-header">
            <img src="images/icons/icon-192x192.png" alt="Nari Niketan" class="pwa-ios-logo">
            <div class="pwa-ios-title">Install Nari Niketan App</div>
          </div>
          <div class="pwa-ios-steps">
            <div class="pwa-ios-step">
              <span class="pwa-ios-step-num">🌐</span>
              <span><strong>Chrome / Edge (Android & Desktop):</strong> Tap the <span class="pwa-ios-icon-badge">⋮ Menu</span> → <span class="pwa-ios-icon-badge">Add to Home Screen</span> or look for the <span class="pwa-ios-icon-badge">📲 install icon</span> in the address bar.</span>
            </div>
            <div class="pwa-ios-step">
              <span class="pwa-ios-step-num">🍎</span>
              <span><strong>Safari (iPhone/iPad):</strong> Tap <span class="pwa-ios-icon-badge">⎋ Share</span> → <span class="pwa-ios-icon-badge">Add to Home Screen</span> → <span class="pwa-ios-icon-badge">Add</span>.</span>
            </div>
            <div class="pwa-ios-step">
              <span class="pwa-ios-step-num">💡</span>
              <span>If the button above doesn't open automatically, try <strong>refreshing the page</strong> and clicking Install again after a moment.</span>
            </div>
          </div>
          <button class="pwa-ios-close-btn" onclick="document.getElementById('pwa-browser-install-modal').classList.remove('active')">Got It!</button>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    }
    setTimeout(() => overlay.classList.add('active'), 50);
  }

  // 7. NETWORK STATUS NOTIFICATIONS
  function showNetworkToast(message, type) {
    let toast = document.getElementById('pwa-network-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pwa-network-toast';
      toast.className = 'pwa-network-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `pwa-network-toast visible ${type || ''}`;
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 4000);
  }

  window.addEventListener('online', () => {
    showNetworkToast('✅ Back Online! Connected to Nari Niketan.', 'online');
  });

  window.addEventListener('offline', () => {
    showNetworkToast('⚠️ You are offline. Browsing cached store.', 'offline');
  });

  // 8. UPDATE NOTIFIER
  function showUpdateToast(reg) {
    const toast = document.createElement('div');
    toast.className = 'pwa-install-banner visible';
    toast.style.zIndex = '100005';
    toast.innerHTML = `
      <img src="images/icons/icon-96x96.png" class="pwa-banner-icon" alt="Update">
      <div class="pwa-banner-info">
        <div class="pwa-banner-title">New Update Available!</div>
        <div class="pwa-banner-desc">Tap reload to get the latest collection & features.</div>
      </div>
      <div class="pwa-banner-actions">
        <button class="pwa-btn-install-now" id="pwa-reload-update-btn">Reload</button>
      </div>
    `;
    document.body.appendChild(toast);

    document.getElementById('pwa-reload-update-btn').addEventListener('click', () => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    });
  }

  // Auto-init DOM buttons if iOS on load
  document.addEventListener('DOMContentLoaded', () => {
    if (isStandalone) {
      // Already installed — hide all install UI
      document.body.classList.add('pwa-standalone');
      document.querySelectorAll('.pwa-install-btn, .pwa-install-trigger').forEach(el => el.style.display = 'none');
      const getAppSection = document.getElementById('get-app-section');
      if (getAppSection) getAppSection.style.display = 'none';
    }
    // On non-standalone: buttons are visible by default (no hiding needed)
    // beforeinstallprompt will fire and capture the prompt for one-click install
  });

})();
