import * as admin from 'firebase-admin';
export * from './handlers';

// Initialize the Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

