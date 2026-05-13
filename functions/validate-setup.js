#!/usr/bin/env node

/**
 * Cleanup Setup Validator
 * 
 * Checks if everything is ready to run the local cleanup
 * Usage: node validate-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Database Cleanup Setup Validator');
console.log('━'.repeat(60));

const checks = [
  {
    name: 'Firebase Admin installed',
    check: () => {
      try {
        require('firebase-admin');
        return true;
      } catch (e) {
        return false;
      }
    },
    fix: 'npm install firebase-admin',
  },
  {
    name: 'Cleanup scripts compiled',
    check: () => {
      const scripts = [
        'lib/services/databaseCleanup/analyzeDatabase.js',
        'lib/services/databaseCleanup/enrichReleaseDates.js',
        'lib/services/databaseCleanup/consolidateRedundantFields.js',
        'lib/services/databaseCleanup/normalizeTracking.js',
        'lib/services/databaseCleanup/validateTvProgress.js',
      ];
      return scripts.every(script => fs.existsSync(path.join(__dirname, script)));
    },
    fix: 'npm run build',
  },
  {
    name: 'Service Account key exists',
    check: () => {
      return fs.existsSync(path.join(__dirname, 'serviceAccount.json'));
    },
    fix: 'Download from Firebase Console → Settings → Service Accounts',
  },
  {
    name: 'Cleanup runner script exists',
    check: () => {
      return fs.existsSync(path.join(__dirname, 'cleanup-runner.js'));
    },
    fix: 'Run: npm run build (in root)',
  },
];

let allPassed = true;

checks.forEach((check) => {
  const result = check.check();
  const symbol = result ? '✅' : '❌';
  console.log(`${symbol} ${check.name}`);
  if (!result) {
    console.log(`   Fix: ${check.fix}`);
    allPassed = false;
  }
});

console.log('━'.repeat(60));

if (allPassed) {
  console.log('✅ Setup is ready! Run:');
  console.log('   node cleanup-runner.js <YOUR_USER_ID> --preview');
  console.log('   node cleanup-runner.js <YOUR_USER_ID>');
} else {
  console.log('❌ Setup incomplete. Fix the issues above first.');
  process.exit(1);
}
