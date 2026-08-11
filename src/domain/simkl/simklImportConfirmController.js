async function getAuthHeader() {
  try {
    const { auth } = await import("../../util/firebase/firebase.js");
    const user = auth?.currentUser;
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

const CONFIRM_BATCH_SIZE = 500;

/**
 * Executes transactional confirmation for approved Simkl diffs.
 */
export async function executeSimklImportConfirmation(approvedChanges = [], options = {}) {
  const { onProgress } = options;
  const headers = await getAuthHeader();

  if (!Array.isArray(approvedChanges) || approvedChanges.length === 0) {
    return { success: true, summary: { processed: 0, imported: 0, stale: 0, failed: 0 }, results: [] };
  }

  let totalProcessed = 0;
  let totalImported = 0;
  let totalStale = 0;
  let totalFailed = 0;
  const allResults = [];

  for (let i = 0; i < approvedChanges.length; i += CONFIRM_BATCH_SIZE) {
    const chunk = approvedChanges.slice(i, i + CONFIRM_BATCH_SIZE);
    const batchNum = Math.floor(i / CONFIRM_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(approvedChanges.length / CONFIRM_BATCH_SIZE);

    if (onProgress) {
      onProgress({ currentBatch: batchNum, totalBatches, message: `Importing Batch ${batchNum} of ${totalBatches}...` });
    }

    const response = await fetch("/api/simkl/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ changes: chunk }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Confirmation batch ${batchNum} failed (HTTP ${response.status})`);
    }

    const data = await response.json();
    const summary = data.summary || {};

    totalProcessed += summary.processed || 0;
    totalImported += summary.imported || 0;
    totalStale += summary.stale || 0;
    totalFailed += summary.failed || 0;

    if (Array.isArray(data.results)) {
      allResults.push(...data.results);
    }
  }

  return {
    success: true,
    summary: {
      processed: totalProcessed,
      imported: totalImported,
      stale: totalStale,
      failed: totalFailed,
    },
    results: allResults,
  };
}
