import React from "react";
import { useNavigate } from "react-router-dom";
import useSimilarShows from "../../../hooks/tv/useSimilarShows";
import Carousel from "../../ui/Carousel";
import MediaCard from "../../ui/MediaCard";

const SimilarShowsPanel = ({ tvId }) => {
  const { data: similarShows, loading, error } = useSimilarShows(tvId);
  const navigate = useNavigate();

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
    <Carousel>
      {similarShows.map((show) => (
        <MediaCard
          key={show.id}
          media={show}
          variant="recommendation"
          onClick={() => {
            navigate(`/shows/${show.id}`);
            window.scrollTo(0, 0);
          }}
        />
      ))}
    </Carousel>
  );
};

export default SimilarShowsPanel;
