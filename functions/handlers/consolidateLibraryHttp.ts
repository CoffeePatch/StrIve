/**
 * Cloud Function Example: Migration HTTP Endpoint
 * 
 * Deploy with:
 *   firebase deploy --only functions:consolidateLibraryAdmin
 * 
 * Usage:
 *   curl -X POST https://region-project.cloudfunctions.net/consolidateLibraryAdmin \
 *     -H "Content-Type: application/json" \
 *     -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
 *     -d '{
 *       "userId": "user123",
 *       "cleanup": true,
 *       "dryRun": false
 *     }'
 */

import * as functions from "firebase-functions";
import { consolidateLibraryTyped } from "../services/consolidateLibrary";

/**
 * HTTP Endpoint for admin-triggered library consolidation
 * Requires Firebase Authentication (admin)
 */
export const consolidateLibraryAdmin = functions.https.onRequest(
  async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    try {
      // Verify authentication (in production, check custom claims for 'admin' role)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ error: "Unauthorized. Missing auth header." });
        return;
      }

      const { userId, cleanup = false, dryRun = false } = req.body;

      if (!userId || typeof userId !== "string") {
        res
          .status(400)
          .json({ error: "Missing or invalid userId in request body" });
        return;
      }

      console.log(
        `[consolidateLibraryAdmin] Starting migration for userId: ${userId}`
      );
      console.log(
        `[consolidateLibraryAdmin] Options: cleanup=${cleanup}, dryRun=${dryRun}`
      );

      const result = await consolidateLibraryTyped(userId, {
        cleanup,
        dryRun,
        verbose: true,
      });

      res.json({
        success: true,
        status: result.status,
        stats: result.stats,
        completedAt: result.completedAt,
      });
    } catch (error) {
      console.error("[consolidateLibraryAdmin] Error:", error);
      res.status(500).json({
        error: "Migration failed",
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Callable Cloud Function for consolidated library migration
 * 
 * Usage from client:
 *   const consolidate = firebase.functions().httpsCallable('consolidateLibrary');
 *   const result = await consolidate({
 *     userId: 'user123',
 *     cleanup: true
 *   });
 */
export const consolidateLibrary = functions.https.onCall(
  async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const userId = data?.userId || context.auth.uid;
    const cleanup = data?.cleanup ?? false;
    const dryRun = data?.dryRun ?? false;

    // Optional: Verify user is admin or is migrating their own account
    // if (context.auth.uid !== userId && !isAdmin(context.auth)) {
    //   throw new functions.https.HttpsError('permission-denied', 'User does not have permission to migrate this account');
    // }

    try {
      console.log(
        `[consolidateLibrary] Starting migration for userId: ${userId}`
      );

      const result = await consolidateLibraryTyped(userId, {
        cleanup,
        dryRun,
        verbose: true,
      });

      return {
        success: true,
        status: result.status,
        stats: result.stats,
        completedAt: result.completedAt,
      };
    } catch (error) {
      console.error("[consolidateLibrary] Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Migration failed: ${(error as Error).message}`
      );
    }
  }
);

/**
 * Scheduled Cloud Function to migrate multiple users
 * Deploy with:
 *   firebase deploy --only functions:scheduledMigration
 * 
 * In firebase.json:
 *   "functions": {
 *     "scheduledMigration": {
 *       "schedule": "every day 02:00",
 *       "timeZone": "America/New_York"
 *     }
 *   }
 */
export const scheduledMigration = functions.pubsub
  .schedule("every sunday 02:00")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    console.log("[scheduledMigration] Starting batch migration");

    // Example: Get list of users to migrate from Firestore config
    // const config = await db.collection('config').doc('migration').get();
    // const userIds = config.data()?.pendingMigrations || [];

    // For demo, we'll just log
    console.log(
      "[scheduledMigration] No users configured for batch migration"
    );
    console.log(
      "[scheduledMigration] Add pending users to Firestore config to enable batch migration"
    );

    return null;
  });
