import useNowPlayingMedia from "../../hooks/media/useNowPlayingMedia";
import useUpcomingMedia from "../../hooks/media/useUpcomingMedia";

import usePopularMedia from "../../hooks/media/usePopularMedia";
import useTopRatedMedia from "../../hooks/media/useTopRatedMedia";
import useMediaByGenre from "../../hooks/media/useMediaByGenre";

import Header from "../layout/Header";
import MainContainer from "../layout/MainContainer";
import MediaCard from "../ui/MediaCard";
import Carousel from "../ui/Carousel";
import SectionHeader from "../ui/SectionHeader";
import { useNavigate } from "react-router-dom";

const Browse = () => {
  const navigate = useNavigate();
  const nowPlayingMovies = useNowPlayingMedia("movie");
  const upcomingMovies = useUpcomingMedia("movie");
  const onTheAirTVShows = useUpcomingMedia("tv");

  const popularMovies = usePopularMedia("movie");
  const topRatedMovies = useTopRatedMedia("movie");
  const popularTVShows = usePopularMedia("tv");
  const topRatedTVShows = useTopRatedMedia("tv");

  const actionMovies = useMediaByGenre("movie", 28);
  const adventureMovies = useMediaByGenre("movie", 12);
  const romanceMovies = useMediaByGenre("movie", 10749);
  
  const actionAdventureTVShows = useMediaByGenre("tv", 10759);
  const comedyTVShows = useMediaByGenre("tv", 35);
  const romanceTVShows = useMediaByGenre("tv", 10749);



  const MediaList = ({ title, items, icon }) => {
    if (!items || items.length === 0) return null;

    return (
      <div className="mb-12">
        <SectionHeader 
          title={title} 
          icon={<span className="material-symbols-outlined">{icon}</span>} 
        />
        <Carousel>
          {items.map((media) => {
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

  return (
    <div className="min-h-screen premium-page">
      <Header />
      <MainContainer />
      
      <div className="w-full px-6 lg:px-12 py-8">
        <MediaList
          title="Popular Movies"
          items={popularMovies}
          icon="trending_up"
        />
        
        <MediaList
          title="Top Rated Movies"
          items={topRatedMovies}
          icon="star"
        />
        
        <MediaList
          title="Upcoming Movies"
          items={upcomingMovies}
          icon="event"
        />
        <MediaList
          title="Action"
          items={actionMovies}
          icon="sports_martial_arts"
        />
        <MediaList
          title="Adventure"
          items={adventureMovies}
          icon="explore"
        />
        <MediaList
          title="Romance"
          items={romanceMovies}
          icon="favorite"
        />
        
        <MediaList
          title="On The Air TV Shows"
          items={onTheAirTVShows}
          icon="live_tv"
        />
        
        <MediaList
          title="Popular TV Shows"
          items={popularTVShows}
          icon="trending_up"
        />
        
        <MediaList
          title="Top Rated TV Shows"
          items={topRatedTVShows}
          icon="star"
        />
        <MediaList
          title="Action & Adventure"
          items={actionAdventureTVShows}
          icon="sports_martial_arts"
        />
        <MediaList
          title="Comedy"
          items={comedyTVShows}
          icon="mood"
        />
        <MediaList
          title="Romance"
          items={romanceTVShows}
          icon="favorite"
        />
      </div>
    </div>
  );
};

export default Browse;
