/* ==========================================================
   NARI NIKETAN — AI Natural-Language Product Search Engine
   Version: 1.0 (Production Ready, Zero Hallucination, Zero Data Loss)
   ========================================================== */

(function (window, document) {
  'use strict';

  if (window.NariAISearch) return;

  const NariAISearch = {
    _context: null, // Stores active search intent for conversational follow-ups
    _cache: {},     // In-memory intent query cache
    _lastQuery: '',

    // ── ETHNIC FASHION TAXONOMY ────────────────────────────────
    TAXONOMY: {
      CATEGORIES: {
        'Sarees': ['saree', 'sari', 'sarees', 'saris', 'banarasi', 'kanjivaram', 'chanderi', 'paithani', 'patola', 'bandhani saree', 'silk saree', 'nauvari'],
        'Suits': ['suit', 'suits', 'salwar', 'anarkali', 'sharara', 'gharara', 'kurta set', 'pant set', 'palazzo set', 'patiala', 'churidar', 'suit set', 'suit piece'],
        'Lehengas': ['lehenga', 'lehengas', 'ghagra', 'choli', 'chaniya choli', 'bridal lehenga', 'party lehenga', 'crop top lehenga'],
        'Kurtas': ['kurta', 'kurtas', 'kurti', 'kurtis', 'tunic', 'tunics', 'top', 'tops', 'straight kurti', 'a-line kurti', 'short kurti', 'long kurti'],
        'Dupattas': ['dupatta', 'dupattas', 'stole', 'stoles', 'shawl', 'shawls', 'chunri', 'chunni', 'odhni']
      },

      COLORS: [
        'red', 'crimson', 'maroon', 'pink', 'magenta', 'rose', 'baby pink', 'rani pink',
        'blue', 'navy', 'navy blue', 'royal blue', 'sky blue', 'indigo',
        'green', 'bottle green', 'emerald', 'olive', 'mint', 'sage green', 'lime',
        'yellow', 'mustard', 'gold', 'golden', 'lemon yellow', 'haldi yellow',
        'orange', 'rust', 'peach', 'coral', 'tangerine',
        'purple', 'violet', 'lavender', 'wine', 'plum', 'mauve',
        'black', 'white', 'ivory', 'beige', 'cream', 'off-white',
        'silver', 'grey', 'gray', 'charcoal', 'teal', 'turquoise', 'multicolor'
      ],

      MATERIALS: [
        'silk', 'banarasi silk', 'kanjivaram silk', 'cotton', 'pure cotton', 'mulmul',
        'chanderi', 'georgette', 'chiffon', 'crepe', 'velvet', 'organza',
        'linen', 'rayon', 'satin', 'brocade', 'tussar', 'modal', 'khadi'
      ],

      OCCASIONS: {
        'wedding': ['wedding', 'shaadi', 'shadi', 'bridal', 'dulhan', 'reception', 'sangeet', 'mehendi', 'mehndi', 'haldi', 'baraat', 'roka'],
        'party': ['party', 'cocktail', 'evening', 'farewell', 'birthday', 'celebration', 'gala', 'night out'],
        'festive': ['festive', 'festival', 'puja', 'pooja', 'diwali', 'navratri', 'durga puja', 'eid', 'karwa chauth', 'rakhi', 'rakshabandhan', 'teej', 'pongal', 'onam'],
        'office': ['office', 'formal', 'work', 'corporate', 'meeting', 'professional'],
        'casual': ['casual', 'daily', 'college', 'everyday', 'home', 'travel', 'outing']
      },

      SEASONS: {
        'summer': ['summer', 'hot', 'sunny', 'breathable', 'lightweight', 'sweat', 'humidity'],
        'winter': ['winter', 'cold', 'warm', 'heavy fabric', 'cozy', 'chill'],
        'monsoon': ['monsoon', 'rain', 'rainy']
      },

      STYLES: {
        'traditional': ['traditional', 'ethnic', 'cultural', 'heritage', 'classic', 'authentic', 'desi'],
        'modern': ['modern', 'contemporary', 'indo-western', 'western', 'stylish', 'trendy', 'chic'],
        'simple': ['simple', 'sober', 'subtle', 'plain', 'minimal', 'minimalist'],
        'elegant': ['elegant', 'graceful', 'royal', 'luxurious', 'premium', 'rich'],
        'heavy': ['heavy', 'grand', 'elaborate', 'bridal wear', 'gorgeous'],
        'comfortable': ['comfortable', 'comfy', 'relaxed', 'easy', 'soft']
      },

      PATTERNS: [
        'embroidered', 'embroidery', 'zari', 'zari work', 'printed', 'floral print', 'floral',
        'bandhej', 'bandhani', 'chikankari', 'gotta patti', 'gota patti', 'sequin', 'mirror work',
        'foil print', 'woven', 'handloom', 'hand block', 'solid', 'plain'
      ]
    },

    // ── STEP 1: SANITIZATION & INTENT EXTRACTION ───────────────
    extractIntent: function (rawQuery) {
      if (!rawQuery || typeof rawQuery !== 'string') return null;

      // 1. Sanitize & Normalize
      const clean = rawQuery.toLowerCase().trim().replace(/['"`]/g, '').replace(/\s+/g, ' ');
      if (!clean) return null;

      // Cache check
      if (this._cache[clean]) {
        return JSON.parse(JSON.stringify(this._cache[clean]));
      }

      // Check if this is a conversational follow-up to previous search
      const isFollowUp = this._isFollowUpQuery(clean);
      let base = isFollowUp && this._context ? JSON.parse(JSON.stringify(this._context)) : {
        category: null,
        subcategory: null,
        colors: [],
        material: null,
        occasion: [],
        season: null,
        style: null,
        pattern: null,
        minPrice: null,
        maxPrice: null,
        keywords: [],
        sortBy: 'relevance',
        rawQuery: rawQuery
      };

      base.rawQuery = rawQuery;

      // 2. Extract Category
      for (const [catName, synonyms] of Object.entries(this.TAXONOMY.CATEGORIES)) {
        for (const syn of synonyms) {
          const regex = new RegExp(`\\b${syn}\\b`, 'i');
          if (regex.test(clean)) {
            base.category = catName;
            if (syn !== catName.toLowerCase()) {
              base.subcategory = syn;
            }
            break;
          }
        }
      }

      // 3. Extract Colors (support multi-color phrases like "pink and gold")
      this.TAXONOMY.COLORS.forEach(c => {
        const regex = new RegExp(`\\b${c}\\b`, 'i');
        if (regex.test(clean)) {
          if (!base.colors.includes(c)) base.colors.push(c);
        }
      });

      // 4. Extract Materials / Fabrics
      this.TAXONOMY.MATERIALS.forEach(m => {
        const regex = new RegExp(`\\b${m}\\b`, 'i');
        if (regex.test(clean)) {
          base.material = m;
        }
      });

      // 5. Extract Occasion
      for (const [occKey, synonyms] of Object.entries(this.TAXONOMY.OCCASIONS)) {
        for (const syn of synonyms) {
          const regex = new RegExp(`\\b${syn}\\b`, 'i');
          if (regex.test(clean)) {
            if (!base.occasion.includes(occKey)) base.occasion.push(occKey);
            break;
          }
        }
      }

      // 6. Extract Season
      for (const [seaKey, synonyms] of Object.entries(this.TAXONOMY.SEASONS)) {
        for (const syn of synonyms) {
          const regex = new RegExp(`\\b${syn}\\b`, 'i');
          if (regex.test(clean)) {
            base.season = seaKey;
            break;
          }
        }
      }

      // 7. Extract Style
      for (const [stKey, synonyms] of Object.entries(this.TAXONOMY.STYLES)) {
        for (const syn of synonyms) {
          const regex = new RegExp(`\\b${syn}\\b`, 'i');
          if (regex.test(clean)) {
            base.style = stKey;
            break;
          }
        }
      }

      // 8. Extract Pattern
      this.TAXONOMY.PATTERNS.forEach(pat => {
        const regex = new RegExp(`\\b${pat}\\b`, 'i');
        if (regex.test(clean)) {
          base.pattern = pat;
        }
      });

      // 9. Extract Price Ranges (Handles: "under 800", "below ₹1500", "between 500 and 1000", "500 to 1500", "under 2k")
      const priceLimits = this._extractPriceRange(clean);
      if (priceLimits.min !== null) base.minPrice = priceLimits.min;
      if (priceLimits.max !== null) base.maxPrice = priceLimits.max;

      // 10. Extract Sort Intent
      if (clean.includes('cheapest') || clean.includes('low to high') || clean.includes('budget friendly')) {
        base.sortBy = 'price-asc';
      } else if (clean.includes('expensive') || clean.includes('high to low') || clean.includes('premium')) {
        base.sortBy = 'price-desc';
      } else if (clean.includes('top rated') || clean.includes('best rated') || clean.includes('popular')) {
        base.sortBy = 'rating';
      } else if (clean.includes('latest') || clean.includes('new') || clean.includes('newest') || clean.includes('recent')) {
        base.sortBy = 'newest';
      }

      // Store in memory context & cache
      this._context = JSON.parse(JSON.stringify(base));
      this._cache[clean] = JSON.parse(JSON.stringify(base));
      this._lastQuery = clean;

      return base;
    },

    // ── PRICE RANGE PARSER ─────────────────────────────────────
    _extractPriceRange: function (text) {
      let min = null;
      let max = null;

      // Between X and Y or X to Y (e.g. "between 500 and 1000", "500 to 1500", "500-1000")
      const betweenMatch = text.match(/(?:between|from)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:k)?\s*(?:and|to|-)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:k)?/i);
      if (betweenMatch) {
        let v1 = parseFloat(betweenMatch[1]);
        if (text.includes(betweenMatch[1] + 'k') || text.includes(betweenMatch[1] + ' k')) v1 *= 1000;
        let v2 = parseFloat(betweenMatch[2]);
        if (text.includes(betweenMatch[2] + 'k') || text.includes(betweenMatch[2] + ' k')) v2 *= 1000;

        min = Math.min(v1, v2);
        max = Math.max(v1, v2);
        return { min, max };
      }

      // Under / Below / Less than / Upto / Max (e.g. "under 800", "under ₹1500", "below 2k", "upto 1200")
      const underMatch = text.match(/(?:under|below|less than|within|upto|up to|max(?:imum)?)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k)?/i);
      if (underMatch) {
        let val = parseFloat(underMatch[1]);
        if (underMatch[2] || text.includes(underMatch[1] + 'k')) val *= 1000;
        max = val;
        return { min, max };
      }

      // Above / More than / Over / Min (e.g. "above 1000", "more than ₹2000", "above 2k")
      const aboveMatch = text.match(/(?:above|more than|greater than|over|min(?:imum)?|starting from)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k)?/i);
      if (aboveMatch) {
        let val = parseFloat(aboveMatch[1]);
        if (aboveMatch[2] || text.includes(aboveMatch[1] + 'k')) val *= 1000;
        min = val;
        return { min, max };
      }

      return { min, max };
    },

    // ── CONVERSATIONAL DETECTOR ────────────────────────────────
    _isFollowUpQuery: function (clean) {
      if (!this._context) return false;
      const followUpTriggers = [
        'only', 'make it', 'show in', 'what about', 'in', 'under', 'below', 'instead',
        'also', 'with', 'without', 'cheaper', 'more expensive', 'different color',
        'too expensive', 'less price', 'prefer'
      ];
      return followUpTriggers.some(trigger => clean.startsWith(trigger) || clean.includes(' ' + trigger + ' '));
    },

    // ── STEP 2: SCORING & QUERYING REAL PRODUCT DATABASE ────────
    search: function (rawQuery, allProducts) {
      if (!allProducts || !Array.isArray(allProducts)) return { products: [], explanation: '', isAlternative: false };

      const intent = this.extractIntent(rawQuery);
      if (!intent) {
        // Fallback to simple keyword search
        return this._keywordFallback(rawQuery, allProducts);
      }

      const q = (intent.rawQuery || '').toLowerCase();

      // Check if it's a very simple single word query without filters (e.g. "saree")
      const hasComplexFilters = intent.colors.length > 0 || intent.material || intent.occasion.length > 0 ||
        intent.season || intent.style || intent.pattern || intent.minPrice !== null || intent.maxPrice !== null;

      // Score products
      const scored = allProducts.map(p => {
        let score = 0;
        const pName = (p.name || '').toLowerCase();
        const pDesc = (p.description || '').toLowerCase();
        const pCat = p.category || '';
        const pFabric = (p.fabric || p.material || '').toLowerCase();
        const pColor = (p.colors || []).join(' ').toLowerCase() + ' ' + pName;
        const pOccasion = (p.occasion || '').toLowerCase() + ' ' + pDesc;
        const price = Number(p.salePrice || p.price || 0);

        // 1. Category / Subcategory Match
        if (intent.category) {
          if (pCat.toLowerCase() === intent.category.toLowerCase()) {
            score += 60;
          } else {
            score -= 40; // Penalty if wrong category
          }
        }
        if (intent.subcategory && (pName.includes(intent.subcategory) || pDesc.includes(intent.subcategory))) {
          score += 35;
        }

        // 2. Color Match
        if (intent.colors.length) {
          intent.colors.forEach(c => {
            if (pColor.includes(c) || pName.includes(c)) score += 35;
            else if (pDesc.includes(c)) score += 15;
          });
        }

        // 3. Material / Fabric Match
        if (intent.material) {
          if (pFabric.includes(intent.material) || pName.includes(intent.material)) score += 30;
          else if (pDesc.includes(intent.material)) score += 15;
        }

        // 4. Occasion Match
        if (intent.occasion.length) {
          intent.occasion.forEach(occ => {
            if (pOccasion.includes(occ) || pName.includes(occ)) score += 25;
            else if (pDesc.includes(occ)) score += 15;
          });
        }

        // 5. Season & Style Match
        if (intent.season && (pDesc.includes(intent.season) || pFabric.includes('cotton') || pFabric.includes('georgette'))) {
          score += 20;
        }
        if (intent.style && (pDesc.includes(intent.style) || pName.includes(intent.style))) {
          score += 20;
        }
        if (intent.pattern && (pDesc.includes(intent.pattern) || pName.includes(intent.pattern))) {
          score += 20;
        }

        // 6. Generic Terms Match
        const terms = q.split(/\s+/).filter(t => t.length > 2);
        terms.forEach(t => {
          if (pName.includes(t)) score += 10;
          if (pDesc.includes(t)) score += 5;
        });

        // 7. Price Bound Enforcer
        let withinPrice = true;
        if (intent.minPrice !== null && price < intent.minPrice) withinPrice = false;
        if (intent.maxPrice !== null && price > intent.maxPrice) withinPrice = false;

        return { product: p, score, withinPrice };
      });

      // Filter exact matches: positive score AND within requested price bounds
      let exactMatches = scored
        .filter(item => item.score > 0 && item.withinPrice)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product);

      // Apply Sort intent
      exactMatches = this._applySort(exactMatches, intent.sortBy);

      // ── STEP 3: NO-RESULT HANDLING & GRACEFUL RELAXATION ────────
      if (exactMatches.length === 0) {
        // Try relaxing price limits or secondary filters to find close alternatives
        const alternatives = this._getAlternatives(intent, scored, allProducts);
        const explanation = this._buildExplanation(intent, 0, true);

        this._logTelemetry(rawQuery, intent, 0, false);

        return {
          products: alternatives.products,
          explanation: explanation,
          isAlternative: true,
          altMessage: alternatives.message,
          intent: intent
        };
      }

      const explanation = this._buildExplanation(intent, exactMatches.length, false);
      this._logTelemetry(rawQuery, intent, exactMatches.length, true);

      return {
        products: exactMatches,
        explanation: explanation,
        isAlternative: false,
        intent: intent
      };
    },

    // ── RELAXATION / CLOSE ALTERNATIVES ────────────────────────
    _getAlternatives: function (intent, scored, allProducts) {
      // 1. Check if products match category & color but exceeded price limit
      let closePriceMatches = scored
        .filter(item => item.score > 0 && !item.withinPrice)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product)
        .slice(0, 6);

      if (closePriceMatches.length > 0 && intent.maxPrice !== null) {
        return {
          products: closePriceMatches,
          message: `Sorry, we couldn't find exact matches under ₹${intent.maxPrice.toLocaleString('en-IN')}. Here are some stunning close alternatives:`
        };
      }

      // 2. If specific color/material was out of stock, show same category popular products
      if (intent.category) {
        const catProds = allProducts
          .filter(p => (p.category || '').toLowerCase() === intent.category.toLowerCase())
          .slice(0, 6);
        if (catProds.length > 0) {
          return {
            products: catProds,
            message: `Sorry, no exact matches for this specific combination. Here are popular ${intent.category} you might love:`
          };
        }
      }

      // 3. Fallback to featured products
      const featured = allProducts.filter(p => p.featured || (p.rating && p.rating >= 4)).slice(0, 6);
      return {
        products: featured.length ? featured : allProducts.slice(0, 6),
        message: `Sorry, we couldn't find an exact match for your search. Here are trending handpicked recommendations:`
      };
    },

    // ── RESULT EXPLANATION BADGE BUILDER ───────────────────────
    _buildExplanation: function (intent, count, isZero) {
      if (!intent) return '';

      const parts = [];

      if (intent.colors && intent.colors.length) {
        parts.push(intent.colors.join(' / '));
      }
      if (intent.material) {
        parts.push(intent.material);
      }
      if (intent.category) {
        parts.push(intent.category.toLowerCase());
      } else {
        parts.push('outfits');
      }

      let desc = parts.join(' ');

      if (intent.occasion && intent.occasion.length) {
        desc += ` for ${intent.occasion.join(' & ')}`;
      }
      if (intent.season) {
        desc += ` suitable for ${intent.season}`;
      }
      if (intent.style) {
        desc += ` with ${intent.style} elegance`;
      }

      if (intent.minPrice !== null && intent.maxPrice !== null) {
        desc += ` between ₹${intent.minPrice.toLocaleString('en-IN')} and ₹${intent.maxPrice.toLocaleString('en-IN')}`;
      } else if (intent.maxPrice !== null) {
        desc += ` under ₹${intent.maxPrice.toLocaleString('en-IN')}`;
      } else if (intent.minPrice !== null) {
        desc += ` above ₹${intent.minPrice.toLocaleString('en-IN')}`;
      }

      if (isZero) {
        return `No exact matches for ${desc}.`;
      }

      return `Showing ${desc} (${count} result${count === 1 ? '' : 's'})`;
    },

    // ── SORTING ENGINE ─────────────────────────────────────────
    _applySort: function (list, sortBy) {
      if (!list || !list.length) return [];
      const arr = [...list];
      if (sortBy === 'price-asc') {
        arr.sort((a, b) => (Number(a.salePrice || a.price) || 0) - (Number(b.salePrice || b.price) || 0));
      } else if (sortBy === 'price-desc') {
        arr.sort((a, b) => (Number(b.salePrice || b.price) || 0) - (Number(a.salePrice || a.price) || 0));
      } else if (sortBy === 'rating') {
        arr.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
      } else if (sortBy === 'newest') {
        arr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      }
      return arr;
    },

    // ── FALLBACK STANDARD KEYWORD SEARCH ───────────────────────
    _keywordFallback: function (q, allProducts) {
      const clean = (q || '').toLowerCase().trim();
      if (!clean) return { products: allProducts, explanation: '', isAlternative: false };

      const matched = allProducts.filter(p => {
        const name = (p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        return name.includes(clean) || desc.includes(clean) || cat.includes(clean);
      });

      return {
        products: matched,
        explanation: `Showing results for "${q}" (${matched.length} result${matched.length === 1 ? '' : 's'})`,
        isAlternative: false
      };
    },

    // ── RESET CONTEXT ──────────────────────────────────────────
    resetContext: function () {
      this._context = null;
      this._lastQuery = '';
    },

    // ── TELEMETRY & ANALYTICS LOGGER ───────────────────────────
    _logTelemetry: function (query, intent, count, hasExactMatch) {
      setTimeout(() => {
        try {
          if (typeof db !== 'undefined') {
            db.collection('aiStylistSessions').add({
              event: 'ai_search',
              query: query,
              intent: intent || {},
              resultCount: count,
              hasExactMatch: hasExactMatch,
              page: window.location.pathname,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              clientTime: new Date().toISOString()
            }).catch(() => {});
          }
        } catch (e) {}
      }, 100);
    }
  };

  window.NariAISearch = NariAISearch;

})(window, document);
