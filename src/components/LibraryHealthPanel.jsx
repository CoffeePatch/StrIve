import React from "react";
import useLibraryHealth from "../hooks/useLibraryHealth";

const HealthRow = ({ label, check }) => {
  const dotClass = check?.ok ? "health-dot health-ok" : "health-dot health-fail";
  const count = typeof check?.count === "number" ? ` (${check.count})` : "";

  return (
    <div className="health-row">
      <div className="health-row-title">
        <span className={dotClass} />
        <span>{label}{count}</span>
      </div>
      <div className="health-row-message">{check?.message || "Unknown"}</div>
    </div>
  );
};

const LibraryHealthPanel = ({ userId }) => {
  const { loading, checks, lastRunAt, runChecks } = useLibraryHealth(userId);

  return (
    <section className="settings-section glass-effect">
      <h2>Library Health (Dev)</h2>
      <p className="help-text">
        Quick diagnostics for your new Firebase library stack. This verifies that
        Firestore collections are readable and the watched callable is reachable.
      </p>

      <div className="health-grid">
        <HealthRow label="library_items" check={checks.libraryItems} />
        <HealthRow label="series_progress" check={checks.seriesProgress} />
        <HealthRow label="markEpisodeWatched callable" check={checks.callable} />
      </div>

      <div className="button-group">
        <button className="btn btn-primary" onClick={runChecks} disabled={loading || !userId}>
          {loading ? (
            <>
              <span className="spinner" />
              Running Checks...
            </>
          ) : (
            "Run Health Check"
          )}
        </button>
      </div>

      <p className="help-text">
        Last run: {lastRunAt ? new Date(lastRunAt).toLocaleString() : "Never"}
      </p>
    </section>
  );
};

export default LibraryHealthPanel;
