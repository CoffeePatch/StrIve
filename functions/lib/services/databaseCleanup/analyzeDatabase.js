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
exports.analyzeDatabase = void 0;
const admin = __importStar(require("firebase-admin"));
/**
 * Analyzes the current database schema without making changes
 * Safe read-only operation
 */
const analyzeDatabase = async (userId) => {
    console.log(`[ANALYZE] Starting analysis for user: ${userId}`);
    const db = admin.firestore();
    const libraryPath = `users/${userId}/library_items`;
    const snapshot = await db.collection(libraryPath).get();
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalDocuments: 0,
            docsWithRedundantImdbRating: 0,
            docsWithRedundantImdbVotes: 0,
            docsWithoutReleaseDate: 0,
            moviesWithoutWatchStatus: 0,
            tvShowsWithoutTvProgress: 0,
            tvShowsWithLastWatchedAtInProgress: 0,
        },
        details: {
            docIdsWithRedundantImdbRating: [],
            docIdsWithoutReleaseDate: [],
            moviesWithoutWatchStatus: [],
            tvShowsWithIssues: [],
        },
    };
    snapshot.forEach((doc) => {
        var _a, _b;
        const data = doc.data();
        const docId = doc.id;
        report.summary.totalDocuments++;
        // Check for redundant top-level fields
        if (data.imdbRating !== undefined) {
            report.summary.docsWithRedundantImdbRating++;
            if (report.details.docIdsWithRedundantImdbRating.length < 10) {
                report.details.docIdsWithRedundantImdbRating.push(docId);
            }
        }
        if (data.imdbVotes !== undefined) {
            report.summary.docsWithRedundantImdbVotes++;
        }
        // Check for missing releaseDate
        if (!data.releaseDate) {
            report.summary.docsWithoutReleaseDate++;
            if (report.details.docIdsWithoutReleaseDate.length < 10) {
                report.details.docIdsWithoutReleaseDate.push(docId);
            }
        }
        // Check movies for watchStatus
        if (data.mediaType === "movie") {
            if (!((_a = data.tracking) === null || _a === void 0 ? void 0 : _a.watchStatus) && ((_b = data.tracking) === null || _b === void 0 ? void 0 : _b.watchStatus) !== null) {
                report.summary.moviesWithoutWatchStatus++;
                if (report.details.moviesWithoutWatchStatus.length < 10) {
                    report.details.moviesWithoutWatchStatus.push(docId);
                }
            }
        }
        // Check TV shows for complete tvProgress
        if (data.mediaType === "tv") {
            const issues = [];
            if (!data.tvProgress) {
                issues.push("missing tvProgress object");
            }
            else {
                if (data.tvProgress.lastWatchedAt !== undefined) {
                    report.summary.tvShowsWithLastWatchedAtInProgress++;
                    issues.push("has redundant tvProgress.lastWatchedAt");
                }
                if (data.tvProgress.totalEpisodes === undefined) {
                    issues.push("missing totalEpisodes");
                }
                if (data.tvProgress.watchedEpisodes === undefined) {
                    issues.push("missing watchedEpisodes");
                }
                if (data.tvProgress.completionPercent === undefined) {
                    issues.push("missing completionPercent");
                }
            }
            if (issues.length > 0) {
                report.summary.tvShowsWithoutTvProgress++;
                if (report.details.tvShowsWithIssues.length < 10) {
                    report.details.tvShowsWithIssues.push(`${docId}: ${issues.join(", ")}`);
                }
            }
        }
    });
    console.log(`[ANALYZE] Complete. Report:`, JSON.stringify(report, null, 2));
    return report;
};
exports.analyzeDatabase = analyzeDatabase;
//# sourceMappingURL=analyzeDatabase.js.map