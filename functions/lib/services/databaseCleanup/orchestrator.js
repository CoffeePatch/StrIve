"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewDatabaseCleanup = exports.cleanupLibraryDatabase = void 0;
const functions = __importStar(require("firebase-functions"));
const analyzeDatabase_1 = require("./analyzeDatabase");
const enrichReleaseDates_1 = require("./enrichReleaseDates");
const consolidateRedundantFields_1 = require("./consolidateRedundantFields");
const normalizeTracking_1 = require("./normalizeTracking");
const validateTvProgress_1 = require("./validateTvProgress");
/**
 * Orchestrates the complete database cleanup process
 * Phases:
 * 1. Analysis (read-only, always runs)
 * 2. Enrichment (requires confirmation)
 * 3. Consolidation (requires confirmation)
 * 4. Normalization (requires confirmation)
 * 5. TV Progress Validation (requires confirmation)
 */
exports.cleanupLibraryDatabase = functions.https.onCall(async (data, context) => {
    var _a;
    try {
        // Verify user is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
        }
        const userId = context.auth.uid;
        const { phase = "all", skipPhases = [] } = data;
        console.log(`[CLEANUP] Starting cleanup orchestration for user: ${userId}`);
        console.log(`[CLEANUP] Requested phase: ${phase}, Skip: ${skipPhases}`);
        const report = {
            executedAt: new Date().toISOString(),
            userId,
            phase1_analysis: null,
            status: "completed",
        };
        // PHASE 1: ANALYSIS (always run, read-only)
        try {
            console.log("[CLEANUP] ===== PHASE 1: ANALYSIS =====");
            report.phase1_analysis = await (0, analyzeDatabase_1.analyzeDatabase)(userId);
            console.log("[CLEANUP] ✓ Analysis complete");
        }
        catch (error) {
            console.error("[CLEANUP] ✗ Analysis failed:", error);
            report.status = "failed";
            report.error = `Phase 1 analysis failed: ${error}`;
            return report;
        }
        // Allow preview-only mode (just analysis)
        if (phase === "analysis") {
            console.log("[CLEANUP] Analysis phase complete. Stopping.");
            return report;
        }
        // PHASE 2: ENRICHMENT (optional, API calls)
        if (!skipPhases.includes(2)) {
            try {
                console.log("[CLEANUP] ===== PHASE 2: ENRICHMENT =====");
                report.phase2_enrichment = await (0, enrichReleaseDates_1.enrichReleaseDates)(userId);
                console.log("[CLEANUP] ✓ Enrichment complete");
            }
            catch (error) {
                console.error("[CLEANUP] ✗ Enrichment failed:", error);
                report.status = "failed";
                report.error = `Phase 2 enrichment failed: ${error}`;
                return report;
            }
        }
        else {
            console.log("[CLEANUP] Phase 2 skipped");
        }
        // PHASE 3: CONSOLIDATION (remove redundant fields)
        if (!skipPhases.includes(3)) {
            try {
                console.log("[CLEANUP] ===== PHASE 3: CONSOLIDATION =====");
                report.phase3_consolidation = await (0, consolidateRedundantFields_1.consolidateRedundantFields)(userId);
                console.log("[CLEANUP] ✓ Consolidation complete");
            }
            catch (error) {
                console.error("[CLEANUP] ✗ Consolidation failed:", error);
                report.status = "failed";
                report.error = `Phase 3 consolidation failed: ${error}`;
                return report;
            }
        }
        else {
            console.log("[CLEANUP] Phase 3 skipped");
        }
        // PHASE 4: NORMALIZATION (add missing tracking fields)
        if (!skipPhases.includes(4)) {
            try {
                console.log("[CLEANUP] ===== PHASE 4: NORMALIZATION =====");
                report.phase4_normalization = await (0, normalizeTracking_1.normalizeTracking)(userId);
                console.log("[CLEANUP] ✓ Normalization complete");
            }
            catch (error) {
                console.error("[CLEANUP] ✗ Normalization failed:", error);
                report.status = "failed";
                report.error = `Phase 4 normalization failed: ${error}`;
                return report;
            }
        }
        else {
            console.log("[CLEANUP] Phase 4 skipped");
        }
        // PHASE 5: TV PROGRESS VALIDATION (ensure complete tvProgress)
        if (!skipPhases.includes(5)) {
            try {
                console.log("[CLEANUP] ===== PHASE 5: TV PROGRESS VALIDATION =====");
                report.phase5_tvProgress = await (0, validateTvProgress_1.validateTvProgress)(userId);
                console.log("[CLEANUP] ✓ TV Progress validation complete");
            }
            catch (error) {
                console.error("[CLEANUP] ✗ TV Progress validation failed:", error);
                report.status = "failed";
                report.error = `Phase 5 TV progress validation failed: ${error}`;
                return report;
            }
        }
        else {
            console.log("[CLEANUP] Phase 5 skipped");
        }
        console.log("[CLEANUP] ===== ALL PHASES COMPLETE =====");
        return report;
    }
    catch (error) {
        console.error("[CLEANUP] Unexpected error:", error);
        return {
            executedAt: new Date().toISOString(),
            userId: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid,
            status: "failed",
            error: String(error),
        };
    }
});
/**
 * Preview-only: Run analysis without making changes
 */
exports.previewDatabaseCleanup = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
    }
    console.log(`[PREVIEW] Starting analysis for user: ${context.auth.uid}`);
    const report = await (0, analyzeDatabase_1.analyzeDatabase)(context.auth.uid);
    console.log("[PREVIEW] Analysis complete");
    return report;
});
//# sourceMappingURL=orchestrator.js.map