/**
 * server/config/firebase.js
 * Firebase Admin SDK — Firestore + Auth only.
 * Storage is handled by Cloudinary — no storageBucket here.
 */

'use strict';

const admin = require('firebase-admin');
const path  = require('path');
const logger = require('../utils/logger');

let serviceAccount;
try {
  const keyPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  serviceAccount = require(keyPath);
} catch (err) {
  logger.error('Firebase service account key not found. Check FIREBASE_SERVICE_ACCOUNT_KEY in .env');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // No storageBucket — Cloudinary handles all media uploads
  });
  logger.info('Firebase Admin SDK initialized (Firestore + Auth).');
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db };
