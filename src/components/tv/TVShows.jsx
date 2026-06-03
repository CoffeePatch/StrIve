import React from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Header from "../layout/Header";
import { tmdbAdapter } from "../../domain/media";
import { MediaCard, MediaPoster, MediaBadges, MediaMetadata } from "../media/MediaCard";
import usePopularTVShows from "../../hooks/tv/usePopularTVShows";
import useTopRatedTVShows from "../../hooks/tv/useTopRatedTVShows";
import useOnTheAirTVShows from "../../hooks/tv/useOnTheAirTVShows";
import useTVShowsByGenre from "../../hooks/tv/useTVShowsByGenre";

const TVShows = () => {
  const tvShows = useSelector((store) => store.tvShows);
  const navigate = useNavigate();

  usePopularTVShows();
  useTopRatedTVShows();
  useOnTheAirTVShows();

  useTVShowsByGenre(10759); // Action & Adventure
  useTVShowsByGenre(35); // Comedy
  useTVShowsByGenre(10749); // Romance

  const TVShowList = ({ title, shows, icon }) => {
    if (!shows || shows.length === 0) return null;

    return (
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-white text-2xl lg:text-3xl font-bold font-secondary flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-red-600">{icon}</span>
            {title}
          </h2>
        </div>
        <div data-horizontal-scroll="true" className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4">
          {shows.map((tvShow) => {
            const media = tmdbAdapter(tvShow);
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
        <TVShowList title="On The Air" shows={tvShows.onTheAirTVShows} icon="live_tv" />
        <TVShowList title="Popular TV Shows" shows={tvShows.popularTVShows} icon="trending_up" />
        <TVShowList title="Top Rated" shows={tvShows.topRatedTVShows} icon="star" />
        <TVShowList title="Action & Adventure" shows={tvShows.genreTVShows?.[10759]} icon="sports_martial_arts" />
        <TVShowList title="Comedy" shows={tvShows.genreTVShows?.[35]} icon="mood" />
        <TVShowList title="Romance" shows={tvShows.genreTVShows?.[10749]} icon="favorite" />
      </div>
    </div>
  );
};

export default TVShows;
