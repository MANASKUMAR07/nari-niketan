// =============================================
// NARI NIKETAN — Firebase Configuration
// =============================================

const firebaseConfig = {
  apiKey: "AIzaSyDL7GDKSZPcRyhEYAPRPTStRvnM3_VkKOk",
  authDomain: "nari-niketan.firebaseapp.com",
  projectId: "nari-niketan",
  storageBucket: "nari-niketan.firebasestorage.app",
  messagingSenderId: "997712460310",
  appId: "1:997712460310:web:92fc7614ebcf450ab31337",
  measurementId: "G-BK5WPV1EDW"
};

// Initialize Firebase
if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();

// Firebase Storage — used for seller product image uploads
// Only initialize if the Storage SDK is loaded (seller pages load it; storefront pages don't need it)
const storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;

// ── Firestore offline persistence (loads instantly from cache on repeat visits) ──
db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED });
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
    console.warn('Firestore persistence warning:', err.code);
  }
});

// Persistence - keep user logged in
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
