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

/**
 * Sequential Client Simkl Import Analyzer (Read-Only)
 * Calls /api/simkl/analyze sequentially for movies and shows to produce a diff preview.
 */
export async function executeSimklImportAnalysis(options = {}) {
  const { onProgress } = options;
  const headers = await getAuthHeader();

  const types = ["movies", "shows"];
  const combinedDiffs = [];
  const combinedSummary = {
    simklItems: 0,
    matched: 0,
    simklOnly: 0,
    watchDifferences: 0,
    ratingDifferences: 0,
    unmatched: 0,
  };

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    if (onProgress) {
      onProgress({ currentStep: i + 1, totalSteps: types.length, message: `Analyzing Simkl ${type}...` });
    }

    const response = await fetch("/api/simkl/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ type }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        throw new Error(`Simkl API rate limit reached (${errData?.error?.message || "HTTP 429"}). Analysis paused.`);
      }
      if (response.status === 401) {
        throw new Error("Simkl authorization expired or revoked. Please reconnect Simkl in Settings.");
      }
      throw new Error(errData?.error?.message || `Failed to analyze Simkl ${type} (HTTP ${response.status})`);
    }

    const data = await response.json();
    const summary = data.summary || {};

    combinedSummary.simklItems += summary.simklItems || 0;
    combinedSummary.matched += summary.matched || 0;
    combinedSummary.simklOnly += summary.simklOnly || 0;
    combinedSummary.watchDifferences += summary.watchDifferences || 0;
    combinedSummary.ratingDifferences += summary.ratingDifferences || 0;
    combinedSummary.unmatched += summary.unmatched || 0;

    if (Array.isArray(data.diffs)) {
      combinedDiffs.push(...data.diffs);
    }
  }

  return {
    success: true,
    summary: combinedSummary,
    diffs: combinedDiffs,
    readOnly: true,
  };
}
