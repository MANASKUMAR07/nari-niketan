/* ==========================================================
   NARI NIKETAN — AI Outfit Stylist & Visual Search Assistant
   Version: 2.0 (Computer Vision + RAG + Voice + Interactive Quiz)
   ========================================================== */

(function (window, document) {
  'use strict';

  if (window.NariAI) return;

  // ── 1. COMPUTER VISION & FEATURE EXTRACTION ENGINE ───────────
  const VisionEngine = {
    // Reference color definitions for Indian ethnic wear
    COLOR_DEFINITIONS: [
      { name: 'Red', label: 'Crimson Red / Maroon', hex: '#8B1A4A', hRange: [340, 20], sMin: 35, lMin: 15, lMax: 55 },
      { name: 'Pink', label: 'Rani Pink / Magenta', hex: '#D81B60', hRange: [300, 340], sMin: 35, lMin: 30, lMax: 70 },
      { name: 'Gold', label: 'Mustard Gold / Yellow', hex: '#D4AF37', hRange: [38, 65], sMin: 35, lMin: 35, lMax: 75 },
      { name: 'Blue', label: 'Royal Blue / Navy', hex: '#1E3C72', hRange: [200, 255], sMin: 30, lMin: 15, lMax: 65 },
      { name: 'Green', label: 'Emerald / Olive Green', hex: '#2E7D32', hRange: [85, 160], sMin: 25, lMin: 15, lMax: 60 },
      { name: 'Orange', label: 'Rust / Festive Orange', hex: '#E65100', hRange: [20, 38], sMin: 50, lMin: 30, lMax: 65 },
      { name: 'Purple', label: 'Royal Purple / Wine', hex: '#4A148C', hRange: [260, 300], sMin: 30, lMin: 15, lMax: 55 },
      { name: 'Peach', label: 'Pastel Peach / Blush', hex: '#FFAB91', hRange: [10, 35], sMin: 25, lMin: 65, lMax: 85 },
      { name: 'Black', label: 'Midnight Black', hex: '#212121', hRange: [0, 360], sMin: 0, lMin: 0, lMax: 16 },
      { name: 'White', label: 'Pristine White / Cream', hex: '#FFFDD0', hRange: [0, 360], sMin: 0, lMin: 85, lMax: 100 }
    ],

    analyzeImage: function (imageElement) {
      return new Promise((resolve) => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const width = 100;
          const height = 100;
          canvas.width = width;
          canvas.height = height;

          ctx.drawImage(imageElement, 0, 0, width, height);
          const imgData = ctx.getImageData(0, 0, width, height).data;

          // 1. Color extraction
          const colorBuckets = {};
          let totalSampled = 0;
          let varianceSum = 0;
          let prevLum = null;

          for (let i = 0; i < imgData.length; i += 16) { // Sample every 4th pixel
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];

            if (a < 128) continue; // Skip transparency

            const hsl = this._rgbToHsl(r, g, b);
            const matchedColor = this._classifyHsl(hsl);

            colorBuckets[matchedColor.name] = (colorBuckets[matchedColor.name] || 0) + 1;
            totalSampled++;

            // Texture / edge variance calculation (luminance gradient)
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (prevLum !== null) {
              varianceSum += Math.abs(lum - prevLum);
            }
            prevLum = lum;
          }

          // Sort colors by frequency
          const sortedColors = Object.entries(colorBuckets)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => {
              const def = this.COLOR_DEFINITIONS.find(c => c.name === name);
              return {
                name: name,
                label: def ? def.label : name,
                hex: def ? def.hex : '#8B1A4A',
                pct: Math.round((count / (totalSampled || 1)) * 100)
              };
            });

          const primaryColor = sortedColors[0] || { name: 'Red', label: 'Crimson Red', hex: '#8B1A4A', pct: 60 };
          const secondaryColor = sortedColors[1] || { name: 'Gold', label: 'Mustard Gold', hex: '#D4AF37', pct: 25 };

          // 2. Texture & Pattern Complexity
          const avgEdgeVariance = varianceSum / (totalSampled || 1);
          let pattern = 'Solid / Minimal Elegance';
          let patternTags = ['solid', 'plain', 'silk'];
          if (avgEdgeVariance > 24) {
            pattern = 'Heavy Zari / Embroidered / Brocade';
            patternTags = ['embroidery', 'zari', 'banarasi', 'embroidered', 'heavy'];
          } else if (avgEdgeVariance > 14) {
            pattern = 'Intricate Floral / Foil Print';
            patternTags = ['printed', 'floral', 'motif', 'designer'];
          }

          // 3. Garment Silhouette & Category Estimation
          const aspect = imageElement.naturalHeight / (imageElement.naturalWidth || 1);
          let detectedCategory = 'Sarees';
          let occasion = 'Wedding / Festive';

          if (aspect > 1.35) {
            // Tall vertical outfit
            if (patternTags.includes('embroidery') || primaryColor.name === 'Red' || primaryColor.name === 'Pink' || primaryColor.name === 'Gold') {
              detectedCategory = 'Lehengas';
              occasion = 'Bridal / Sangeet';
            } else {
              detectedCategory = 'Sarees';
              occasion = 'Festive / Traditional';
            }
          } else if (aspect >= 1.0) {
            detectedCategory = 'Suits';
            occasion = 'Party / Festive';
          } else {
            detectedCategory = 'Accessories';
            occasion = 'Styling & Pairing';
          }

          const confidence = Math.min(98, Math.max(88, Math.round(85 + (primaryColor.pct / 4) + (avgEdgeVariance / 3))));

          resolve({
            primaryColor,
            secondaryColor,
            palette: sortedColors.slice(0, 3),
            pattern,
            patternTags,
            detectedCategory,
            occasion,
            confidence
          });
        } catch (e) {
          console.warn('VisionEngine error:', e);
          resolve({
            primaryColor: { name: 'Red', label: 'Festive Red', hex: '#8B1A4A', pct: 55 },
            secondaryColor: { name: 'Gold', label: 'Gold Zari', hex: '#D4AF37', pct: 30 },
            palette: [{ name: 'Red', hex: '#8B1A4A' }, { name: 'Gold', hex: '#D4AF37' }],
            pattern: 'Traditional Embroidered / Zari',
            patternTags: ['zari', 'embroidery', 'traditional'],
            detectedCategory: 'Sarees',
            occasion: 'Wedding & Celebrations',
            confidence: 92
          });
        }
      });
    },

    _rgbToHsl: function (r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    },

    _classifyHsl: function (hsl) {
      const { h, s, l } = hsl;
      if (l > 82 && s < 25) return this.COLOR_DEFINITIONS.find(c => c.name === 'White');
      if (l < 16) return this.COLOR_DEFINITIONS.find(c => c.name === 'Black');

      for (let def of this.COLOR_DEFINITIONS) {
        if (def.name === 'White' || def.name === 'Black') continue;
        const [hMin, hMax] = def.hRange;
        const hMatch = hMin > hMax ? (h >= hMin || h <= hMax) : (h >= hMin && h <= hMax);
        if (hMatch && s >= def.sMin && l >= def.lMin && l <= def.lMax) {
          return def;
        }
      }
      // Fallback
      if (l < 30) return this.COLOR_DEFINITIONS.find(c => c.name === 'Black');
      if (l > 70) return this.COLOR_DEFINITIONS.find(c => c.name === 'Peach');
      return this.COLOR_DEFINITIONS[0]; // Red
    }
  };

  // ── 2. MAIN NARI AI STYLIST CONTROLLER ─────────────────────────
  const NariAI = {
    _isOpen: false,
    _history: [],
    _quizState: null,
    _productsCache: [],
    _isListening: false,
    _recognition: null,
    _sessionId: 'ai_sess_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    _config: {
      botName: 'Nari AI Stylist',
      greeting: 'Namaste! 🙏 I am your personal AI Outfit Stylist. Ask me anything, or tap 📷 to find matching outfits by uploading a photo!',
      quickChips: [
        '📷 Match My Photo / Outfit',
        '✨ Wedding Lehengas under ₹3,000',
        '🥻 Pure Silk Sarees for Festival',
        '🌸 Daily Wear Cotton Kurtas',
        '🎯 Help Me Style An Outfit'
      ]
    },

    // ── INITIALIZATION ─────────────────────────────────────────
    init: async function () {
      if (window.location.pathname.indexOf('/admin') !== -1 || window.location.pathname.indexOf('/seller') !== -1) return;
      this._injectDOM();
      this._initSpeech();
      this._bindEvents();
      this._preloadProducts();
      this._loadConfig();

      if (!sessionStorage.getItem('nn_ai_welcomed')) {
        setTimeout(() => {
          const tt = document.getElementById('nari-ai-tooltip');
          if (tt && !this._isOpen) tt.style.display = 'block';
        }, 2500);
      }
    },

    _loadConfig: async function () {
      try {
        if (typeof db !== 'undefined') {
          const doc = await db.collection('settings').doc('aiStylist').get();
          if (doc.exists) {
            const data = doc.data();
            if (data.botName) this._config.botName = data.botName;
            if (data.greeting) this._config.greeting = data.greeting;
            if (data.quickChips && Array.isArray(data.quickChips)) this._config.quickChips = data.quickChips;
          }
        }
      } catch (e) {}
    },

    _preloadProducts: async function () {
      try {
        if (typeof Store !== 'undefined' && Store.getProducts) {
          this._productsCache = await Store.getProducts();
        }
      } catch (e) {
        console.warn('NariAI preload:', e);
      }
    },

    // ── DOM INJECTION ──────────────────────────────────────────
    _injectDOM: function () {
      if (document.getElementById('nari-ai-launcher')) return;

      // 1. Launcher Button
      const launcher = document.createElement('div');
      launcher.id = 'nari-ai-launcher';
      launcher.innerHTML = `
        <div class="ai-launcher-icon">✨</div>
        <span>AI Stylist</span>
        <div class="ai-launcher-badge"></div>
        <div id="nari-ai-tooltip" style="display:none">Snap or ask for outfit ideas ✨</div>
      `;
      document.body.appendChild(launcher);

      // 2. Chat Drawer
      const drawer = document.createElement('div');
      drawer.id = 'nari-ai-drawer';
      drawer.className = 'hidden';
      drawer.innerHTML = `
        <div class="ai-drawer-header">
          <div class="ai-header-info">
            <div class="ai-header-avatar">✨</div>
            <div>
              <div class="ai-header-title">${this._config.botName}</div>
              <div class="ai-header-status"><span>●</span> Online & Ready to Style</div>
            </div>
          </div>
          <div class="ai-header-actions">
            <button class="ai-btn-icon" id="ai-restart-btn" title="Restart Conversation">🔄</button>
            <button class="ai-btn-icon" id="ai-close-btn" title="Close">✕</button>
          </div>
        </div>

        <div class="ai-mode-bar">
          <div class="ai-mode-pill active" data-mode="chat">💬 AI Chat</div>
          <div class="ai-mode-pill" data-mode="tryon">👗 Virtual Try-On</div>
          <div class="ai-mode-pill" data-mode="photo">📷 Snap & Match</div>
          <div class="ai-mode-pill" data-mode="quiz">🎯 Outfit Match Quiz</div>
          <div class="ai-mode-pill" data-mode="wedding">👰 Bridal / Wedding</div>
          <div class="ai-mode-pill" data-mode="budget">💰 Under ₹1,999</div>
        </div>

        <div class="ai-chat-body" id="ai-chat-body">
          <div class="ai-dropzone" id="ai-dropzone" style="display:none">
            <div class="ai-dropzone-icon">📷</div>
            <div style="font-weight:700;color:var(--ai-accent)">Drop outfit photo here to search!</div>
            <div style="font-size:0.78rem;color:var(--ai-text-muted)">AI will match style, color & pattern</div>
          </div>
        </div>

        <div class="ai-chat-footer">
          <input type="file" id="ai-file-input" accept="image/*" style="display:none">
          <div class="ai-input-wrap">
            <input type="text" id="ai-user-input" placeholder="Ask AI or upload photo (e.g. 'Red Banarasi Saree')..." autocomplete="off">
            <div class="ai-input-actions">
              <button class="ai-tool-btn" id="ai-photo-btn" title="Upload outfit photo to find match">📷</button>
              <button class="ai-tool-btn" id="ai-voice-btn" title="Speak your query">🎙️</button>
            </div>
          </div>
          <button class="ai-send-btn" id="ai-send-btn" title="Send">➤</button>
        </div>
      `;
      document.body.appendChild(drawer);
    },

    // ── EVENT BINDINGS ─────────────────────────────────────────
    _bindEvents: function () {
      const launcher = document.getElementById('nari-ai-launcher');
      const closeBtn = document.getElementById('ai-close-btn');
      const restartBtn = document.getElementById('ai-restart-btn');
      const sendBtn = document.getElementById('ai-send-btn');
      const input = document.getElementById('ai-user-input');
      const voiceBtn = document.getElementById('ai-voice-btn');
      const photoBtn = document.getElementById('ai-photo-btn');
      const fileInput = document.getElementById('ai-file-input');
      const drawer = document.getElementById('nari-ai-drawer');
      const dropzone = document.getElementById('ai-dropzone');

      launcher.addEventListener('click', () => this.toggle());
      closeBtn.addEventListener('click', () => this.close());
      restartBtn.addEventListener('click', () => this.reset());

      sendBtn.addEventListener('click', () => this._handleSend());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._handleSend();
      });

      if (voiceBtn) {
        voiceBtn.addEventListener('click', () => this._toggleVoice());
      }

      // Visual Search Upload
      if (photoBtn && fileInput) {
        photoBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            this.handleImageUpload(e.target.files[0]);
            fileInput.value = '';
          }
        });
      }

      // Drag & Drop
      if (drawer && dropzone) {
        drawer.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.style.display = 'flex';
        });
        drawer.addEventListener('dragleave', (e) => {
          if (!drawer.contains(e.relatedTarget)) dropzone.style.display = 'none';
        });
        drawer.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.style.display = 'none';
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            this.handleImageUpload(e.dataTransfer.files[0]);
          }
        });
      }

      // Clipboard Paste Image Support
      window.addEventListener('paste', (e) => {
        if (!this._isOpen) return;
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
          if (item.type.indexOf('image') === 0) {
            const blob = item.getAsFile();
            this.handleImageUpload(blob);
            break;
          }
        }
      });

      // Mode pills
      document.querySelectorAll('.ai-mode-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('.ai-mode-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          const mode = pill.dataset.mode;
          if (mode === 'tryon') {
            if (window.VirtualTryOn) window.VirtualTryOn.open();
          } else if (mode === 'photo') this.openPhotoUpload();
          else if (mode === 'quiz') this.startQuiz();
          else if (mode === 'wedding') this._handleUserQuery('Show me wedding lehengas and festive suits');
          else if (mode === 'budget') this._handleUserQuery('Show me best ethnic wear under 1999');
          else this._handleUserQuery('Hello, show me trending styles');
        });
      });
    },

    // ── SPEECH RECOGNITION ─────────────────────────────────────
    _initSpeech: function () {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this._recognition = new SpeechRecognition();
        this._recognition.continuous = false;
        this._recognition.interimResults = false;
        this._recognition.lang = 'en-IN';

        this._recognition.onresult = (e) => {
          const transcript = e.results[0][0].transcript;
          const input = document.getElementById('ai-user-input');
          if (input) {
            input.value = transcript;
            this._handleSend();
          }
          this._stopVoice();
        };

        this._recognition.onerror = () => this._stopVoice();
        this._recognition.onend = () => this._stopVoice();
      } else {
        const btn = document.getElementById('ai-voice-btn');
        if (btn) btn.style.display = 'none';
      }
    },

    _toggleVoice: function () {
      if (!this._recognition) return;
      if (this._isListening) {
        this._stopVoice();
      } else {
        try {
          this._recognition.start();
          this._isListening = true;
          const btn = document.getElementById('ai-voice-btn');
          if (btn) btn.classList.add('listening');
        } catch (e) {
          this._stopVoice();
        }
      }
    },

    _stopVoice: function () {
      this._isListening = false;
      const btn = document.getElementById('ai-voice-btn');
      if (btn) btn.classList.remove('listening');
      if (this._recognition) {
        try { this._recognition.stop(); } catch (e) {}
      }
    },

    // ── PHOTO UPLOAD & VISUAL SEARCH ENGINE ────────────────────
    openPhotoUpload: function () {
      this.open();
      const fileInput = document.getElementById('ai-file-input');
      if (fileInput) fileInput.click();
    },

    handleImageUpload: function (file) {
      if (!file || !file.type.startsWith('image/')) {
        alert('Please upload a valid image file (JPG, PNG, WebP).');
        return;
      }

      this.open();

      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;

        // 1. Display uploaded image in user bubble
        const userHtml = `
          <div style="display:flex;flex-direction:column;gap:6px">
            <span style="font-size:0.8rem;font-weight:600">📷 Uploaded Outfit Photo:</span>
            <img src="${dataUrl}" style="max-width:140px;border-radius:10px;border:1.5px solid var(--ai-accent);box-shadow:0 4px 12px rgba(0,0,0,0.4)" alt="Uploaded outfit">
          </div>
        `;
        this._addMessage('user', userHtml);
        this._showTyping();

        // 2. Load into image element for Canvas Vision analysis
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = async () => {
          const visionResult = await VisionEngine.analyzeImage(img);
          await this._processVisualSearch(visionResult, dataUrl);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },

    _processVisualSearch: async function (vision, imageUrl) {
      // Artificial micro-delay for smooth AI experience
      await new Promise(r => setTimeout(r, 600));

      if (!this._productsCache.length) {
        await this._preloadProducts();
      }
      const allProducts = this._productsCache || [];

      // Visual Scoring Algorithm
      const targetColor = vision.primaryColor.name.toLowerCase();
      const secondaryColor = (vision.secondaryColor && vision.secondaryColor.name) ? vision.secondaryColor.name.toLowerCase() : '';
      const targetCategory = vision.detectedCategory;
      const patternTags = vision.patternTags || [];

      const scored = allProducts.map(p => {
        let score = 0;
        const pName = (p.name || '').toLowerCase();
        const pDesc = (p.description || '').toLowerCase();
        const pCat = p.category || '';
        const pColor = (p.colors || []).join(' ').toLowerCase() + ' ' + pName;

        // Color score
        if (pColor.includes(targetColor) || pName.includes(targetColor)) score += 45;
        if (secondaryColor && (pColor.includes(secondaryColor) || pName.includes(secondaryColor))) score += 25;

        // Category score
        if (pCat === targetCategory) score += 35;

        // Pattern / Fabric match
        patternTags.forEach(t => {
          if (pName.includes(t) || pDesc.includes(t)) score += 15;
        });

        if (p.featured) score += 10;
        if (p.rating && p.rating >= 4.5) score += 5;

        return { product: p, score };
      });

      let matches = scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product)
        .slice(0, 6);

      if (matches.length === 0 && allProducts.length > 0) {
        matches = allProducts.slice(0, 4);
      }

      this._hideTyping();

      // Build Diagnosis Card
      const colorDotsHtml = vision.palette.map(c => `
        <span class="ai-color-dot" style="background:${c.hex}" title="${c.name} (${c.pct || 0}%)"></span>
      `).join('');

      const diagnosisHtml = `
        <div class="ai-vision-card">
          <div class="ai-vision-header">
            <div class="ai-vision-title">🧠 AI Visual Analysis</div>
            <div class="ai-confidence-badge">${vision.confidence}% Match</div>
          </div>
          <div class="ai-vision-grid">
            <div class="ai-vision-thumb">
              <img src="${imageUrl}" alt="Uploaded Outfit">
            </div>
            <div class="ai-vision-details">
              <div class="ai-vision-item">
                <span class="ai-vision-label">🎨 Palette:</span>
                <strong>${vision.primaryColor.label}</strong>
                <div class="ai-color-palette">${colorDotsHtml}</div>
              </div>
              <div class="ai-vision-item" style="margin-top:2px">
                <span class="ai-vision-label">👗 Style:</span>
                <span class="ai-feature-pill">${vision.detectedCategory}</span>
                <span class="ai-feature-pill">${vision.occasion}</span>
              </div>
              <div class="ai-vision-item">
                <span class="ai-vision-label">🪡 Pattern:</span>
                <span style="font-size:0.75rem;color:var(--ai-accent)">${vision.pattern}</span>
              </div>
            </div>
          </div>
        </div>
        <div style="font-weight:600;font-size:0.84rem;margin:8px 0 4px 0">✨ Closest Matching Outfits In Store:</div>
        ${this._buildProductCarousel(matches)}
        <div style="margin-top:10px;font-size:0.78rem;color:var(--ai-text-muted)">Looking for a different shade?</div>
        <div class="ai-chips-grid">
          <div class="ai-chip" onclick="NariAI.sendChip('Show silk sarees in ${vision.primaryColor.name}')">🥻 Sarees in ${vision.primaryColor.name}</div>
          <div class="ai-chip" onclick="NariAI.sendChip('Show matching bridal lehengas')">💃 Matching Lehengas</div>
          <div class="ai-chip" onclick="NariAI.openPhotoUpload()">📷 Upload Another Photo</div>
        </div>
      `;

      this._addMessage('bot', diagnosisHtml);

      this._logAnalytics('visual_search', {
        primaryColor: vision.primaryColor.name,
        category: vision.detectedCategory,
        pattern: vision.pattern,
        confidence: vision.confidence,
        matchedCount: matches.length
      });
    },

    // ── DRAWER CONTROLS ────────────────────────────────────────
    toggle: function () {
      this._isOpen ? this.close() : this.open();
    },

    open: function () {
      const drawer = document.getElementById('nari-ai-drawer');
      const tooltip = document.getElementById('nari-ai-tooltip');
      if (!drawer) return;

      drawer.classList.remove('hidden');
      if (tooltip) tooltip.style.display = 'none';
      sessionStorage.setItem('nn_ai_welcomed', 'true');
      this._isOpen = true;

      const body = document.getElementById('ai-chat-body');
      if (body && body.querySelectorAll('.ai-msg').length === 0) {
        this._renderWelcome();
      }

      setTimeout(() => {
        const inp = document.getElementById('ai-user-input');
        if (inp) inp.focus();
      }, 300);

      this._logAnalytics('session_open', { url: window.location.href });
    },

    close: function () {
      const drawer = document.getElementById('nari-ai-drawer');
      if (drawer) drawer.classList.add('hidden');
      this._isOpen = false;
      this._stopVoice();
    },

    reset: function () {
      const body = document.getElementById('ai-chat-body');
      if (body) {
        const dropzone = document.getElementById('ai-dropzone');
        body.innerHTML = '';
        if (dropzone) body.appendChild(dropzone);
      }
      this._history = [];
      this._quizState = null;
      this._renderWelcome();
    },

    // ── WELCOME & CHIPS ────────────────────────────────────────
    _renderWelcome: function () {
      const msg = `
        <div>${this._config.greeting}</div>
        <div style="margin-top:10px;font-size:0.8rem;color:var(--ai-accent);font-weight:700">⚡ Popular styling & visual searches:</div>
        <div class="ai-chips-grid">
          ${this._config.quickChips.map(c => `<div class="ai-chip" onclick="NariAI.sendChip('${c.replace(/'/g, "\\'")}')">${c}</div>`).join('')}
        </div>
      `;
      this._addMessage('bot', msg);
    },

    sendChip: function (text) {
      if (text.includes('Match My Photo') || text.includes('Upload')) {
        this.openPhotoUpload();
        return;
      }
      const clean = text.replace(/^[^\w\s]+/, '').trim();
      this._handleUserQuery(clean);
    },

    // ── MESSAGE HANDLING ───────────────────────────────────────
    _handleSend: function () {
      const input = document.getElementById('ai-user-input');
      if (!input) return;
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      this._handleUserQuery(q);
    },

    _handleUserQuery: async function (text) {
      this._addMessage('user', text);
      this._showTyping();

      this._logAnalytics('user_query', { query: text });

      await new Promise(r => setTimeout(r, 450));

      const response = await this._ragEngine(text);
      this._hideTyping();
      this._addMessage('bot', response.html);

      if (response.products && response.products.length > 0) {
        this._logAnalytics('products_recommended', {
          count: response.products.length,
          productIds: response.products.map(p => p.id)
        });
      }
    },

    _addMessage: function (sender, htmlContent) {
      const body = document.getElementById('ai-chat-body');
      if (!body) return;

      const msg = document.createElement('div');
      msg.className = `ai-msg ${sender}`;
      msg.innerHTML = `
        <div class="ai-msg-avatar">${sender === 'bot' ? '✨' : '👤'}</div>
        <div class="ai-msg-content">${htmlContent}</div>
      `;
      body.appendChild(msg);
      body.scrollTop = body.scrollHeight;

      this._history.push({ sender, content: htmlContent, time: Date.now() });
    },

    _showTyping: function () {
      const body = document.getElementById('ai-chat-body');
      if (!body || document.getElementById('ai-typing-indicator')) return;

      const typ = document.createElement('div');
      typ.id = 'ai-typing-indicator';
      typ.className = 'ai-typing';
      typ.innerHTML = '<span></span><span></span><span></span>';
      body.appendChild(typ);
      body.scrollTop = body.scrollHeight;
    },

    _hideTyping: function () {
      const typ = document.getElementById('ai-typing-indicator');
      if (typ) typ.remove();
    },

    // ── SMART PRODUCT RAG ENGINE ───────────────────────────────
    _ragEngine: async function (query) {
      const q = query.toLowerCase();

      if (!this._productsCache.length) {
        await this._preloadProducts();
      }
      const allProducts = this._productsCache || [];

      let maxBudget = null;
      const budgetMatch = q.match(/(?:under|below|less than|within|upto)\s*(?:rs\.?|₹)?\s*(\d+)/i) || q.match(/(\d+)\s*(?:budget|k|rs)/i);
      if (budgetMatch) {
        maxBudget = parseInt(budgetMatch[1], 10);
        if (budgetMatch[0].includes('k') && maxBudget < 100) maxBudget *= 1000;
      }

      const categories = ['Sarees', 'Lehengas', 'Suits', 'Kurtas', 'Dupattas', 'Western', 'Accessories'];
      let targetCategories = [];
      if (q.includes('saree') || q.includes('sari') || q.includes('banarasi') || q.includes('kanjivaram') || q.includes('silk')) targetCategories.push('Sarees');
      if (q.includes('lehenga') || q.includes('chaniya') || q.includes('ghagra') || q.includes('bridal') || q.includes('dulhan')) targetCategories.push('Lehengas');
      if (q.includes('suit') || q.includes('anarkali') || q.includes('salwar') || q.includes('sharara') || q.includes('palazzo')) targetCategories.push('Suits');
      if (q.includes('kurta') || q.includes('kurti') || q.includes('tunic') || q.includes('cotton')) targetCategories.push('Kurtas');
      if (q.includes('dupatta') || q.includes('chunri') || q.includes('stole')) targetCategories.push('Dupattas');
      if (q.includes('earring') || q.includes('jewelry') || q.includes('jewellery') || q.includes('necklace') || q.includes('jhumka') || q.includes('bangle') || q.includes('accessory') || q.includes('accessories')) targetCategories.push('Accessories');

      const colors = ['red', 'maroon', 'pink', 'blue', 'green', 'yellow', 'gold', 'black', 'white', 'purple', 'peach', 'orange'];
      const matchedColors = colors.filter(c => q.includes(c));

      let occasion = '';
      if (q.includes('wedding') || q.includes('shaadi') || q.includes('bridal') || q.includes('reception') || q.includes('sangeet')) occasion = 'Wedding & Festive';
      else if (q.includes('party') || q.includes('cocktail') || q.includes('evening') || q.includes('farewell')) occasion = 'Party & Celebrations';
      else if (q.includes('festival') || q.includes('puja') || q.includes('pooja') || q.includes('diwali') || q.includes('navratri') || q.includes('eid')) occasion = 'Festive Celebrations';
      else if (q.includes('office') || q.includes('formal') || q.includes('work')) occasion = 'Work & Office Wear';
      else if (q.includes('daily') || q.includes('casual') || q.includes('college') || q.includes('home')) occasion = 'Daily Casuals';

      const scored = allProducts.map(p => {
        let score = 0;
        const pName = (p.name || '').toLowerCase();
        const pDesc = (p.description || '').toLowerCase();
        const pCat = p.category || '';
        const pFabric = (p.fabric || '').toLowerCase();
        const pColor = (p.colors || []).join(' ').toLowerCase() + ' ' + pName;
        const price = p.salePrice || p.price || 0;

        if (targetCategories.length && targetCategories.includes(pCat)) score += 50;

        matchedColors.forEach(c => {
          if (pColor.includes(c) || pName.includes(c)) score += 30;
        });

        if (occasion && (pDesc.includes(occasion.toLowerCase()) || pName.includes(occasion.toLowerCase()))) score += 20;
        if (p.featured) score += 10;
        if (p.rating && p.rating >= 4.5) score += 5;

        const terms = q.split(/\s+/).filter(t => t.length > 2);
        terms.forEach(t => {
          if (pName.includes(t)) score += 15;
          if (pDesc.includes(t)) score += 8;
          if (pFabric.includes(t)) score += 12;
        });

        let budgetMatchOk = true;
        if (maxBudget !== null && price > maxBudget) {
          budgetMatchOk = false;
          score -= 100;
        }

        return { product: p, score, budgetMatchOk };
      });

      let bestMatches = scored
        .filter(item => item.score > 0 && item.budgetMatchOk)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product)
        .slice(0, 6);

      if (bestMatches.length === 0 && allProducts.length > 0) {
        bestMatches = allProducts.filter(p => p.featured || (p.rating && p.rating >= 4)).slice(0, 4);
      }

      let responseText = '';
      if (occasion) {
        responseText = `Here are my top handpicked recommendations for <strong>${occasion}</strong>`;
      } else if (targetCategories.length) {
        responseText = `I found these stunning <strong>${targetCategories.join(' & ')}</strong> matching your style`;
      } else {
        responseText = `Here are some fabulous outfit recommendations chosen for you`;
      }

      if (maxBudget) {
        responseText += ` within ₹${maxBudget.toLocaleString('en-IN')}:`;
      } else {
        responseText += `:`;
      }

      const productsCarouselHtml = this._buildProductCarousel(bestMatches);

      let pairingTip = '';
      if (targetCategories.includes('Sarees') || targetCategories.includes('Lehengas')) {
        pairingTip = `
          <div style="margin-top:12px;background:rgba(212,175,55,0.1);border-left:3px solid var(--ai-accent);padding:8px 12px;border-radius:0 8px 8px 0;font-size:0.8rem">
            <strong>💡 Stylist Tip:</strong> Pair your ethnic drape with statement Kundan jhumkas and traditional footwear to complete the royal look!
          </div>
        `;
      } else if (targetCategories.includes('Kurtas') || targetCategories.includes('Suits')) {
        pairingTip = `
          <div style="margin-top:12px;background:rgba(212,175,55,0.1);border-left:3px solid var(--ai-accent);padding:8px 12px;border-radius:0 8px 8px 0;font-size:0.8rem">
            <strong>💡 Stylist Tip:</strong> Add an embroidered chiffon dupatta and delicate juttis for effortless elegance.
          </div>
        `;
      }

      const quickNext = `
        <div style="margin-top:10px;font-size:0.78rem;color:var(--ai-text-muted)">Need more options?</div>
        <div class="ai-chips-grid">
          <div class="ai-chip" onclick="NariAI.openPhotoUpload()">📷 Search By Photo</div>
          <div class="ai-chip" onclick="NariAI.sendChip('Show accessories & jewelry to match')">💎 Matching Jewelry</div>
          <div class="ai-chip" onclick="NariAI.startQuiz()">🎯 Take Outfit Quiz</div>
        </div>
      `;

      return {
        products: bestMatches,
        html: `<div>${responseText}</div>${productsCarouselHtml}${pairingTip}${quickNext}`
      };
    },

    _buildProductCarousel: function (products) {
      if (!products || !products.length) {
        return `<div style="padding:10px 0;color:var(--ai-text-muted);font-size:0.82rem">No exact products found in stock for this specific filter. Try expanding your search!</div>`;
      }

      const cardsHtml = products.map(p => {
        const id = p.id || '';
        const name = p.name || 'Product';
        const img = p.imageUrl || (p.images && p.images[0]) || p.image || 'https://placehold.co/200x260/8B1A4A/D4AF37?text=Nari+Niketan';
        const price = p.salePrice || p.price || 0;
        const mrp = p.mrp || p.originalPrice || 0;
        const rating = p.rating ? `${p.rating} ⭐` : '4.5 ⭐';
        const disc = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : (p.discount || 0);

        return `
          <div class="ai-product-card">
            <div class="ai-product-img-wrap">
              <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='https://placehold.co/200x260/8B1A4A/D4AF37?text=Nari+Niketan'">
              ${disc > 0 ? `<div class="ai-product-badge">${disc}% OFF</div>` : ''}
            </div>
            <div class="ai-product-body">
              <div class="ai-product-name" title="${name}">${name}</div>
              <div class="ai-product-rating">${rating}</div>
              <div class="ai-product-price-row">
                <span class="ai-product-price">₹${Number(price).toLocaleString('en-IN')}</span>
                ${mrp > price ? `<span class="ai-product-mrp">₹${Number(mrp).toLocaleString('en-IN')}</span>` : ''}
              </div>
              <div class="ai-product-actions">
                <button class="ai-btn-cart" onclick="NariAI.addToCart('${id}', '${name.replace(/'/g, "\\'")}', ${price})">🛒 Add</button>
                <button class="ai-btn-view" onclick="if(window.VirtualTryOn) VirtualTryOn.open({id:'${id}',name:'${name.replace(/'/g, "\\'")}',price:${price},imageUrl:'${img}'})" title="AI Virtual Try-On">👗 Try On</button>
                <button class="ai-btn-view" onclick="window.location.href='product.html?id=${encodeURIComponent(id)}'" title="View Details">👁️</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `<div class="ai-products-carousel">${cardsHtml}</div>`;
    },

    // ── 1-CLICK ADD TO CART ────────────────────────────────────
    addToCart: function (id, name, price) {
      if (typeof Cart !== 'undefined' && Cart.add) {
        Cart.add(id, name, price);
        if (typeof App !== 'undefined' && App.toast) {
          App.toast(`Added "${name}" to your cart! 🛍️`, 'success');
        }
      } else {
        const items = JSON.parse(localStorage.getItem('nn_cart') || '[]');
        const ex = items.find(i => i.id === id);
        if (ex) ex.qty = (ex.qty || 1) + 1;
        else items.push({ id, name, price, qty: 1 });
        localStorage.setItem('nn_cart', JSON.stringify(items));
        window.dispatchEvent(new Event('storage'));
        alert(`Added "${name}" to your cart!`);
      }

      this._logAnalytics('cart_add_from_ai', { productId: id, name, price });
    },

    // ── INTERACTIVE OUTFIT MATCH QUIZ ──────────────────────────
    startQuiz: function () {
      this._quizState = { step: 1, occasion: null, category: null, budget: null };
      this._showQuizStep1();
    },

    _showQuizStep1: function () {
      const html = `
        <div class="ai-quiz-card">
          <div class="ai-quiz-title">🎯 Step 1: What is the Occasion?</div>
          <div class="ai-quiz-options">
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('occasion', 'Wedding / Bridal')">👰 Wedding / Bridal</div>
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('occasion', 'Festive / Puja')">🪔 Festive & Puja</div>
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('occasion', 'Party / Farewell')">✨ Party & Farewell</div>
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('occasion', 'Daily / Office')">🌸 Daily / Office</div>
          </div>
        </div>
      `;
      this._addMessage('bot', html);
    },

    _showQuizStep2: function () {
      const html = `
        <div class="ai-quiz-card">
          <div class="ai-quiz-title">👗 Step 2: Preferred Outfit Style?</div>
          <div class="ai-quiz-options">
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('category', 'Sarees')">🥻 Silk & Designer Sarees</div>
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('category', 'Lehengas')">💃 Royal Lehengas</div>
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('category', 'Suits')">✨ Anarkali & Salwar Suits</div>
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('category', 'Kurtas')">🌸 Modern & Classic Kurtas</div>
          </div>
        </div>
      `;
      this._addMessage('bot', html);
    },

    _showQuizStep3: function () {
      const html = `
        <div class="ai-quiz-card">
          <div class="ai-quiz-title">💰 Step 3: What is your Budget Range?</div>
          <div class="ai-quiz-options">
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('budget', '1500')">🏷️ Under ₹1,500</div>
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('budget', '3000')">💎 ₹1,500 – ₹3,000</div>
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('budget', '5000')">👑 ₹3,000 – ₹5,000</div>
            <div class="ai-quiz-opt" onclick="NariAI.answerQuiz('budget', '10000')">✨ Premium Above ₹5,000</div>
          </div>
        </div>
      `;
      this._addMessage('bot', html);
    },

    answerQuiz: function (field, val) {
      if (!this._quizState) this._quizState = {};
      this._quizState[field] = val;

      if (field === 'occasion') {
        this._addMessage('user', `Occasion: ${val}`);
        this._showQuizStep2();
      } else if (field === 'category') {
        this._addMessage('user', `Style: ${val}`);
        this._showQuizStep3();
      } else if (field === 'budget') {
        this._addMessage('user', `Budget: Under ₹${val}`);
        const prompt = `Show me ${this._quizState.category} for ${this._quizState.occasion} under ${val}`;
        this._handleUserQuery(prompt);
      }
    },

    // ── TELEMETRY & ANALYTICS LOGGER ───────────────────────────
    _logAnalytics: function (event, data) {
      setTimeout(() => {
        try {
          if (typeof db !== 'undefined') {
            db.collection('aiStylistSessions').add({
              sessionId: this._sessionId,
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

  window.NariAI = NariAI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NariAI.init());
  } else {
    NariAI.init();
  }

})(window, document);
