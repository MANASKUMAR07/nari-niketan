// =============================================
// NARI NIKETAN — Firebase Admin SDK Initialiser
// =============================================
// This module is the ONLY place where privileged Firebase credentials are used.
// Credentials come from environment variables — never from committed files.

'use strict';

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'nari-niketan';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;

  let credential;
  if (clientEmail && privateKey) {
    credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  } else {
    // When running inside Google Cloud (Cloud Run / App Engine), ADC is automatically available
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'nari-niketan.firebasestorage.app',
  });
}

const db      = admin.firestore();
const auth    = admin.auth();
const storage = admin.storage();
const bucket  = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || 'nari-niketan.firebasestorage.app');

module.exports = { admin, db, auth, storage, bucket };
