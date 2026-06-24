import React from "react";
import { useNavigate } from "react-router-dom";
import { tmdbAdapter } from "../../../domain/media";
import MediaCard from "../../ui/MediaCard";
import Carousel from "../../ui/Carousel";
import SectionHeader from "../../ui/SectionHeader";

const MovieList = ({ title, movies, icon }) => {
  const navigate = useNavigate();

  return (
    <div className="mb-12 px-4 sm:px-8 lg:px-12">
      <SectionHeader 
        title={title} 
        icon={icon ? <span className="material-symbols-outlined text-3xl">{icon}</span> : null} 
      />
      <Carousel>
        {movies?.map((movie) => {
          const media = tmdbAdapter(movie);
          if (!media) return null;
          return (
            <MediaCard 
              key={media.id} 
              media={media}
              variant="carousel"
              onClick={() => navigate(media.mediaType === 'tv' ? `/shows/${media.id}` : `/movie/${media.id}`)}
            />
          );
        })}
      </Carousel>
    </div>
  );
};

export default MovieList;
