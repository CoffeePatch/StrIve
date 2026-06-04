import React from "react";
import { useNavigate } from "react-router-dom";
import Header from "../layout/Header";
import { MediaCard, MediaPoster, MediaBadges, MediaMetadata } from "../media/MediaCard";
import useUpcomingMedia from "../../hooks/media/useUpcomingMedia";
import usePopularMedia from "../../hooks/media/usePopularMedia";
import useTopRatedMedia from "../../hooks/media/useTopRatedMedia";
import useMediaByGenre from "../../hooks/media/useMediaByGenre";
const TVShows = () => {
  const navigate = useNavigate();

  const popularTVShows = usePopularMedia("tv");
  const topRatedTVShows = useTopRatedMedia("tv");
  const actionAdventureTVShows = useMediaByGenre("tv", 10759);
  const comedyTVShows = useMediaByGenre("tv", 35);
  const romanceTVShows = useMediaByGenre("tv", 10749);

  const onTheAirTVShows = useUpcomingMedia("tv");

  const TVShowList = ({ title, mediaItems, icon }) => {
    if (!mediaItems || mediaItems.length === 0) return null;

    return (
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-white text-2xl lg:text-3xl font-bold font-secondary flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-red-600">{icon}</span>
            {title}
          </h2>
        </div>
        <div data-horizontal-scroll="true" className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4">
          {mediaItems.map((media) => {
            if (!media) return null;
            return (
              <MediaCard 
                key={media.id} 
                media={media} 
                cardSize="compact"
                onClick={() => navigate(`/shows/${media.id}`)}
              >
                <MediaPoster media={media}>
                  <MediaBadges media={media} enableImdb={false} />
                </MediaPoster>
                <MediaMetadata media={media} />
              </MediaCard>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen premium-page">
      <Header />

      <div className="pt-24 pb-12 px-6 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <span className="material-symbols-outlined text-8xl gradient-accent leading-none">tv</span>
          </div>
          <h1 className="font-display text-6xl lg:text-7xl font-bold gradient-text mb-6">TV Shows</h1>
          <p className="text-xl text-white/60 font-secondary max-w-2xl mx-auto">
            Discover amazing TV series from around the world. Binge-watch your favorite shows anytime, anywhere.
          </p>
        </div>
      </div>

      <div className="w-full px-6 lg:px-12 pb-20">
        <TVShowList title="On The Air" mediaItems={onTheAirTVShows} icon="live_tv" />
        <TVShowList title="Popular TV Shows" mediaItems={popularTVShows} icon="trending_up" />
        <TVShowList title="Top Rated" mediaItems={topRatedTVShows} icon="star" />
        <TVShowList title="Action & Adventure" mediaItems={actionAdventureTVShows} icon="sports_martial_arts" />
        <TVShowList title="Comedy" mediaItems={comedyTVShows} icon="mood" />
        <TVShowList title="Romance" mediaItems={romanceTVShows} icon="favorite" />
      </div>
    </div>
  );
};

export default TVShows;
