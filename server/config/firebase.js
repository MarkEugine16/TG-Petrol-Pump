'use strict';

const admin = require('firebase-admin');
const logger = require('../utils/logger');

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  logger.info('Firebase Admin SDK initialized.');
}

const db = admin.firestore();

db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db };
