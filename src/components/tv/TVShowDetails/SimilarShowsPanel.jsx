import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MediaCard from "../../ui/MediaCard";

const TMDB_API_KEY = import.meta.env.VITE_TMDB_KEY;

const SimilarShowsPanel = ({ tvId }) => {
  const [activeTab, setActiveTab] = useState("recommended");
  const [shows, setShows] = useState({ recommended: [], similar: [] });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchShows = async () => {
      if (!tvId) return;
      setLoading(true);
      try {
        const [recRes, simRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/tv/${tvId}/recommendations?page=1`, { 
            headers: { Authorization: `Bearer ${TMDB_API_KEY}`, accept: 'application/json' } 
          }),
          fetch(`https://api.themoviedb.org/3/tv/${tvId}/similar?page=1`, { 
            headers: { Authorization: `Bearer ${TMDB_API_KEY}`, accept: 'application/json' } 
          })
        ]);
        
        const recData = await recRes.json();
        const simData = await simRes.json();

        const mapShow = show => ({
          id: show.id,
          name: show.name,
          posterPath: show.poster_path,
          voteAverage: show.vote_average,
          firstAirDate: show.first_air_date,
          mediaType: 'tv'
        });

        const recommended = (recData.results || []).map(mapShow);
        const similar = (simData.results || []).map(mapShow);

        setShows({ recommended, similar });
        
        // Auto-switch tab if the default is empty
        if (recommended.length === 0 && similar.length > 0) {
          setActiveTab("similar");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchShows();
  }, [tvId]);

  const activeShows = shows[activeTab] || [];

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E50914]"></div>
      </div>
    );
  }

  if (shows.recommended.length === 0 && shows.similar.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-12 lg:mb-16">
      {/* Tabs */}
      <div className="flex items-center gap-6 mb-8 border-b border-white/10 pb-2">
        {shows.recommended.length > 0 && (
          <button 
            onClick={() => setActiveTab('recommended')}
            className={`text-lg md:text-xl font-bold pb-2 border-b-2 transition-colors ${activeTab === 'recommended' ? 'border-[#E50914] text-white' : 'border-transparent text-[#9CA3AF] hover:text-white'}`}
          >
            Recommended
          </button>
        )}
        {shows.similar.length > 0 && (
          <button 
            onClick={() => setActiveTab('similar')}
            className={`text-lg md:text-xl font-bold pb-2 border-b-2 transition-colors ${activeTab === 'similar' ? 'border-[#E50914] text-white' : 'border-transparent text-[#9CA3AF] hover:text-white'}`}
          >
            Similar Shows
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
        {activeShows.map((show) => (
          <MediaCard
            key={show.id}
            media={{...show, title: show.name}}
            variant="grid"
            onClick={() => {
              navigate(`/shows/${show.id}`);
              window.scrollTo(0, 0);
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default SimilarShowsPanel;
