import * as admin from "firebase-admin";

interface AnalysisReport {
  timestamp: string;
  summary: {
    totalDocuments: number;
    docsWithRedundantImdbRating: number;
    docsWithRedundantImdbVotes: number;
    docsWithoutReleaseDate: number;
    moviesWithoutWatchStatus: number;
    tvShowsWithoutTvProgress: number;
    tvShowsWithLastWatchedAtInProgress: number;
  };
  details: {
    docIdsWithRedundantImdbRating: string[];
    docIdsWithoutReleaseDate: string[];
    moviesWithoutWatchStatus: string[];
    tvShowsWithIssues: string[];
  };
}

/**
 * Analyzes the current database schema without making changes
 * Safe read-only operation
 */
export const analyzeDatabase = async (userId: string): Promise<AnalysisReport> => {
  console.log(`[ANALYZE] Starting analysis for user: ${userId}`);

  const db = admin.firestore();
  const libraryPath = `users/${userId}/library_items`;
  const snapshot = await db.collection(libraryPath).get();

  const report: AnalysisReport = {
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

  snapshot.forEach((doc: any) => {
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
      if (!data.tracking?.watchStatus && data.tracking?.watchStatus !== null) {
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
      } else {
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
