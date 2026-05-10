import React from "react";
import useSimilarShows from "../../../hooks/tv/useSimilarShows";
import SimilarShowsCard from "./SimilarShowsCard";

const SimilarShowsPanel = ({ tvId }) => {
  const { data: similarShows, loading, error } = useSimilarShows(tvId);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-accent-primary)' }}></div>
      </div>
    );
  }

  if (error || !similarShows || similarShows.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        No similar shows found
      </p>
    );
  }

  return (
    <div
      data-horizontal-scroll="true"
      className="flex overflow-x-auto scrollbar-hide hide-horizontal-scrollbar gap-4 py-2 px-2 overflow-y-hidden max-w-full"
      role="list"
    >
      {similarShows.map((show) => (
        <div role="listitem" key={show.id} className="flex-none w-48 sm:w-56">
          <SimilarShowsCard show={show} />
        </div>
      ))}
    </div>
  );
};

export default SimilarShowsPanel;
