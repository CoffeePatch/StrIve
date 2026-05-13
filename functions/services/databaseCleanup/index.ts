/**
 * Database Cleanup Module
 * 
 * This module contains all scripts needed to clean up the Firestore database schema
 * and migrate from the messy state to the clean canonical schema.
 * 
 * Only the public cleanup entrypoints are exported here. The individual
 * phase implementations remain internal to the orchestrator.
 */

export { cleanupLibraryDatabase, previewDatabaseCleanup } from "./orchestrator";
