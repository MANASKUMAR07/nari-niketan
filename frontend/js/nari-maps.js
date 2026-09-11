/* ==========================================================
   NARI NIKETAN — Store Pickup & Google Maps Location Engine
   Version: 1.0 (Leaflet & Google Maps Compatible + Zero Key Dependency)
   ========================================================== */

(function (window, document) {
  'use strict';

  if (window.NariLocation) return;

  const NariLocation = {
    STORE: {
      name: 'Nari Niketan Store',
      address: 'Main Market, Rihand Nagar, Sonbhadra, Uttar Pradesh 231223',
      city: 'Rihand Nagar',
      state: 'Uttar Pradesh',
      pincode: '231223',
      phone: '+91 6307032042',
      hours: 'Mon - Sun: 10:00 AM - 9:00 PM',
      lat: 24.2046,
      lng: 82.7845,
      googleMapsUrl: 'https://maps.app.goo.gl/WCfYf5sqeQSv9ZCw9'
    },

    _mapInstance: null,
    _markerInstance: null,
    _currentCoords: null,
    _leafletLoaded: false,

    // ── GOOGLE MAPS URL GENERATOR ──────────────────────────────
    getMapUrl: function (lat, lng) {
      if (!lat || !lng) return this.STORE.googleMapsUrl;
      return `https://www.google.com/maps?q=${lat},${lng}`;
    },

    getDirectionsUrl: function (lat, lng) {
      if (!lat || !lng) lat = this.STORE.lat, lng = this.STORE.lng;
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    },

    // ── BROWSER GEOLOCATION GPS ────────────────────────────────
    getCurrentLocation: function () {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser.'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            };
            resolve(coords);
          },
          (err) => {
            let msg = 'Unable to fetch your location.';
            if (err.code === 1) msg = 'Location permission was denied. You can enter your address manually or select on the map.';
            else if (err.code === 2) msg = 'Location unavailable. Please check your network or GPS.';
            else if (err.code === 3) msg = 'Location request timed out. Please try again or enter manually.';
            reject(new Error(msg));
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      });
    },

    // ── REVERSE GEOCODING (Coords &rarr; City, State, PIN, Address) ───
    reverseGeocode: async function (lat, lng) {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        if (!res.ok) throw new Error('Geocode failed');
        const data = await res.json();
        
        const addr = data.address || {};
        const road = addr.road || addr.suburb || addr.neighbourhood || addr.residential || '';
        const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
        const state = addr.state || '';
        const pincode = addr.postcode || '';
        const landmark = addr.landmark || addr.suburb || '';

        return {
          addressLine1: road ? `${road}, ${addr.suburb || city}` : data.display_name.split(',')[0],
          landmark: landmark || '',
          city: city || 'Sonbhadra',
          state: state || 'Uttar Pradesh',
          pincode: pincode || '',
          displayName: data.display_name || ''
        };
      } catch (e) {
        console.warn('Reverse geocode fallback:', e);
        return {
          addressLine1: '',
          landmark: '',
          city: '',
          state: '',
          pincode: '',
          displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        };
      }
    },

    // ── FORWARD GEOCODING (Search text &rarr; Coords) ────────────────
    forwardGeocode: async function (query) {
      try {
        const clean = encodeURIComponent(query + ', India');
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${clean}&limit=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        if (data && data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            displayName: data[0].display_name
          };
        }
        return null;
      } catch (e) {
        return null;
      }
    },

    // ── DYNAMIC LEAFLET / OSM LOADER ───────────────────────────
    _loadLeaflet: function () {
      return new Promise((resolve) => {
        if (window.L) {
          this._leafletLoaded = true;
          resolve();
          return;
        }

        // 1. Inject Leaflet CSS
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        // 2. Inject Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          this._leafletLoaded = true;
          resolve();
        };
        script.onerror = () => resolve();
        document.body.appendChild(script);
      });
    },

    // ── INTERACTIVE MAP RENDERER ───────────────────────────────
    initMap: async function (containerId, initialCoords, onLocationChange) {
      await this._loadLeaflet();

      const container = document.getElementById(containerId);
      if (!container || !window.L) {
        console.warn('Map container or Leaflet unavailable');
        return;
      }

      const defaultLat = (initialCoords && initialCoords.lat) || this.STORE.lat;
      const defaultLng = (initialCoords && initialCoords.lng) || this.STORE.lng;

      // Clean up previous instance if any
      if (this._mapInstance) {
        this._mapInstance.remove();
        this._mapInstance = null;
      }

      // Initialize Leaflet Map
      const map = L.map(containerId).setView([defaultLat, defaultLng], 15);
      this._mapInstance = map;

      // Tile Layer (OpenStreetMap standard)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Custom Luxury Pin Marker
      const customIcon = L.divIcon({
        className: 'nari-map-pin',
        html: `<div style="background:#8B1A4A;color:#FFE082;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #D4AF37;box-shadow:0 4px 12px rgba(0,0,0,0.4);"><span style="transform:rotate(45deg);font-size:14px;">📍</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      const marker = L.marker([defaultLat, defaultLng], {
        draggable: true,
        icon: customIcon
      }).addTo(map);
      this._markerInstance = marker;

      this._currentCoords = { lat: defaultLat, lng: defaultLng };

      const updatePos = async (lat, lng) => {
        this._currentCoords = { lat, lng };
        marker.setLatLng([lat, lng]);
        map.panTo([lat, lng]);

        if (typeof onLocationChange === 'function') {
          onLocationChange({ lat, lng, googleMapsUrl: this.getMapUrl(lat, lng) });
        }
      };

      // Click to place marker
      map.on('click', (e) => {
        updatePos(e.latlng.lat, e.latlng.lng);
      });

      // Drag marker
      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        updatePos(pos.lat, pos.lng);
      });

      // Invalidate size on load
      setTimeout(() => map.invalidateSize(), 200);

      return {
        updatePosition: updatePos,
        getCoords: () => this._currentCoords
      };
    }
  };

  window.NariLocation = NariLocation;

})(window, document);
