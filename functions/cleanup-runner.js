#!/usr/bin/env node

/**
 * Local Database Cleanup Runner
 * 
 * Usage: node cleanup-runner.js <userId> [--preview]
 * 
 * Examples:
 *   node cleanup-runner.js "user123"                    # Run full cleanup
 *   node cleanup-runner.js "user123" --preview          # Preview only
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Load local env values for cleanup auth (functions/.env first, then project root .env)
loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '..', '.env'));

// Map frontend key name to backend-friendly names if needed
if (!process.env.TMDB_BEARER_TOKEN && process.env.VITE_TMDB_KEY) {
  process.env.TMDB_BEARER_TOKEN = process.env.VITE_TMDB_KEY;
}

// Import cleanup functions
const { analyzeDatabase } = require('./lib/services/databaseCleanup/analyzeDatabase');
const { enrichReleaseDates } = require('./lib/services/databaseCleanup/enrichReleaseDates');
const { consolidateRedundantFields } = require('./lib/services/databaseCleanup/consolidateRedundantFields');
const { normalizeTracking } = require('./lib/services/databaseCleanup/normalizeTracking');
const { validateTvProgress } = require('./lib/services/databaseCleanup/validateTvProgress');

// Get userId from command line arguments
const args = process.argv.slice(2);
const userId = args[0];
const previewOnly = args.includes('--preview');

if (!userId) {
  console.error('❌ Error: userId is required');
  console.error('Usage: node cleanup-runner.js <userId> [--preview]');
  process.exit(1);
}

console.log('🔧 Database Cleanup Runner');
console.log(`📋 User ID: ${userId}`);
console.log(`📌 Mode: ${previewOnly ? 'PREVIEW ONLY (no changes)' : 'FULL CLEANUP'}`);
console.log('━'.repeat(60));

// Initialize Firebase Admin
function initializeFirebase() {
  try {
    // Look for serviceAccount.json in the functions directory
    const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('❌ Error: serviceAccount.json not found in functions/');
      console.error(`Expected path: ${serviceAccountPath}`);
      process.exit(1);
    }

    const serviceAccount = require(serviceAccountPath);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase initialized');
    return admin.firestore();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

// Format results for display
function formatResult(result) {
  return JSON.stringify(result, null, 2);
}

// Main cleanup orchestration
async function runCleanup() {
  const db = initializeFirebase();
  const startTime = Date.now();

  try {
    console.log('\n📊 PHASE 1: Analyzing Database');
    console.log('─'.repeat(60));
    const analysis = await analyzeDatabase(userId);
    console.log('Analysis Results:', formatResult(analysis));

    if (previewOnly) {
      console.log('\n🔍 Preview mode: Stopping after analysis');
      console.log('No changes were made to the database.');
      return;
    }

    // Phase 2: Enrichment
    console.log('\n🌍 PHASE 2: Enriching Release Dates');
    console.log('─'.repeat(60));
    const enrichment = await enrichReleaseDates(userId);
    console.log('Enrichment Results:', formatResult(enrichment));

    // Phase 3: Consolidation
    console.log('\n🗂️  PHASE 3: Consolidating Redundant Fields');
    console.log('─'.repeat(60));
    const consolidation = await consolidateRedundantFields(userId);
    console.log('Consolidation Results:', formatResult(consolidation));

    // Phase 4: Normalization
    console.log('\n✏️  PHASE 4: Normalizing Tracking Fields');
    console.log('─'.repeat(60));
    const normalization = await normalizeTracking(userId);
    console.log('Normalization Results:', formatResult(normalization));

    // Phase 5: TV Progress Validation
    console.log('\n📺 PHASE 5: Validating TV Progress Structures');
    console.log('─'.repeat(60));
    const tvValidation = await validateTvProgress(userId);
    console.log('TV Progress Results:', formatResult(tvValidation));

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '━'.repeat(60));
    console.log('✅ CLEANUP COMPLETED SUCCESSFULLY');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('━'.repeat(60));

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error('\n❌ CLEANUP FAILED');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error(`⏱️  Duration: ${duration}s`);
    process.exit(1);
  }
}

// Run the cleanup
runCleanup().finally(() => {
  process.exit(0);
});
