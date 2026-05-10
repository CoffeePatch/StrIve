import React from "react";
import useLibraryHealth from "../../hooks/common/useLibraryHealth";

const HealthRow = ({ label, check }) => {
  const count = typeof check?.count === "number" ? ` (${check.count})` : "";
  const dotClass = check?.ok
    ? "bg-emerald-500 ring-4 ring-emerald-500/20"
    : "bg-red-500 ring-4 ring-red-500/20";

  return (
    <div
      className="rounded-xl p-4 border"
      style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-3 text-white font-semibold">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotClass}`} />
        <span>
          {label}
          {count}
        </span>
      </div>
      <div className="text-white/60 text-sm mt-1">{check?.message || "Unknown"}</div>
    </div>
  );
};

const LibraryHealthPanel = ({ userId }) => {
  const { loading, checks, lastRunAt, runChecks } = useLibraryHealth(userId);

  return (
    <section className="glass-effect rounded-2xl p-8">
      <h2 className="text-2xl font-bold font-display text-white flex items-center gap-3">
        <span className="material-symbols-outlined text-3xl text-white/80">
          health_and_safety
        </span>
        Library Health (Dev)
      </h2>
      <p className="text-white/60 text-sm leading-relaxed mt-2">
        Quick diagnostics for your new Firebase library stack. This verifies that
        Firestore collections are readable and the watched callable is reachable.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3">
        <HealthRow label="library_items" check={checks.libraryItems} />
        <HealthRow label="series_progress" check={checks.seriesProgress} />
        <HealthRow label="markEpisodeWatched callable" check={checks.callable} />
      </div>

      <div className="mt-6">
        <button
          className="btn-primary flex items-center gap-2"
          onClick={runChecks}
          disabled={loading || !userId}
        >
          {loading ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
              <span>Running Checks...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">fact_check</span>
              <span>Run Health Check</span>
            </>
          )}
        </button>
      </div>

      <p className="text-white/50 text-xs mt-4">
        Last run: {lastRunAt ? new Date(lastRunAt).toLocaleString() : "Never"}
      </p>
    </section>
  );
};

export default LibraryHealthPanel;
