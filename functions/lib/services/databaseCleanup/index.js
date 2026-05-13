"use strict";
/**
 * Database Cleanup Module
 *
 * This module contains all scripts needed to clean up the Firestore database schema
 * and migrate from the messy state to the clean canonical schema.
 *
 * Only the public cleanup entrypoints are exported here. The individual
 * phase implementations remain internal to the orchestrator.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewDatabaseCleanup = exports.cleanupLibraryDatabase = void 0;
var orchestrator_1 = require("./orchestrator");
Object.defineProperty(exports, "cleanupLibraryDatabase", { enumerable: true, get: function () { return orchestrator_1.cleanupLibraryDatabase; } });
Object.defineProperty(exports, "previewDatabaseCleanup", { enumerable: true, get: function () { return orchestrator_1.previewDatabaseCleanup; } });
//# sourceMappingURL=index.js.map