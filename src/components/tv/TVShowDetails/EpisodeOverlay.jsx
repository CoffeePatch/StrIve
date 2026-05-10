import React, { useEffect, useRef, useState } from "react";
import { X, Play, Clock, CheckCircle } from "lucide-react";
import { useSelector } from "react-redux";
import useMarkEpisodeWatched from "../../../hooks/tv/useMarkEpisodeWatched";

const IMG_CDN_URL = "https://image.tmdb.org/t/p";

const EpisodeOverlay = ({ episode, showDetails, onClose, allEpisodes = [] }) => {
  const overlayRef = useRef(null);
  const user = useSelector((store) => store.user?.user);
  const [showDialog, setShowDialog] = useState(false);
  const { markEpisodeWatched, loading, error, clearError } = useMarkEpisodeWatched();

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "auto";
    };
  }, [onClose]);

  const titleKey = `tmdb_tv_${showDetails?.id}`;
  const currentSeasonNumber = Number(episode?.seasonNumber ?? episode?.season_number);
  const currentEpisodeNumber = Number(episode?.episodeNumber ?? episode?.episode_number);

  const handleWatch = async () => {
    if (!user) {
      alert("Log in");
      return;
    }
    clearError();
    if (!Number.isInteger(currentSeasonNumber) || !Number.isInteger(currentEpisodeNumber)) {
      alert("Episode metadata is invalid. Reload and try again.");
      return;
    }
    setShowDialog(true);
  };

  const handleMutation = async (mode) => {
    try {
      const normalizedEpisodes = (allEpisodes || [])
        .map((ep, index) => ({
          seasonNumber: Number(ep.seasonNumber ?? ep.season_number),
          episodeNumber: Number(ep.episodeNumber ?? ep.episode_number),
          absoluteOrder:
            Number(ep.absoluteOrder) ||
            (Number(ep.seasonNumber ?? ep.season_number) * 1000 + Number(ep.episodeNumber ?? ep.episode_number)) ||
            index + 1,
          isAired: ep.isAired !== false,
        }))
        .filter((ep) => Number.isInteger(ep.seasonNumber) && Number.isInteger(ep.episodeNumber));

      const result = await markEpisodeWatched({
        titleKey,
        seasonNumber: currentSeasonNumber,
        episodeNumber: currentEpisodeNumber,
        mode,
        episodeCatalog: normalizedEpisodes,
      });

      setShowDialog(false);
      const written = result?.writtenCount ?? 0;

      if (mode === "single") {
        alert("✅ Episode marked as watched.");
      } else if (mode === "backfill_to_episode") {
        alert(`✅ Backfill complete. Updated ${written} episode(s).`);
      } else {
        alert(`✅ Season update complete. Updated ${written} episode(s).`);
      }
    } catch (err) {
      const message = err?.message || "Failed to update watched status.";
      alert(`Failed: ${message}`);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
  };

  return (<>
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90" onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="relative max-w-4xl w-full rounded-lg overflow-hidden bg-gray-900">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-black/70"><X className="w-6 h-6 text-white" /></button>
        {episode.stillPath && <div className="w-full aspect-video"><img src={`${IMG_CDN_URL}/w780${episode.stillPath}`} alt={episode.name} className="w-full h-full object-cover" /></div>}
        <div className="p-8">
          <div className="mb-4"><span className="text-red-500 text-sm font-semibold">S{currentSeasonNumber}E{currentEpisodeNumber}</span></div>
          <h2 className="text-3xl font-bold mb-4 text-white">{episode.name}</h2>
          {episode.overview && <p className="text-gray-400 mb-6">{episode.overview}</p>}
          <div className="flex gap-4 mb-6 text-sm text-gray-500">
            {episode.airDate && <span>{new Date(episode.airDate).toLocaleDateString()}</span>}
            {episode.runtime && <span><Clock className="w-4 h-4 inline" /> {episode.runtime}min</span>}
            {episode.voteAverage > 0 && <span>⭐ {episode.voteAverage.toFixed(1)}</span>}
          </div>
          {error && (
            <div className="mb-4 rounded bg-red-900/40 border border-red-500/40 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <div className="flex gap-4">
            <button className="flex items-center gap-2 px-6 py-3 rounded bg-white text-black font-semibold"><Play className="w-5 h-5" />Watch</button>
            <button onClick={handleWatch} disabled={loading} className="flex items-center gap-2 px-6 py-3 rounded bg-green-600 text-white font-semibold disabled:opacity-50"><CheckCircle className="w-5 h-5" />Add</button>
          </div>
        </div>
      </div>
    </div>
    {showDialog && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80" onClick={handleCancel}>
        <div className="bg-gray-900 rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-white">Mark Watched Options</h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-gray-300 mb-6">
            Choose how to mark watched for S{currentSeasonNumber}E{currentEpisodeNumber}.
          </p>
          {error && (
            <div className="mb-4 rounded bg-red-900/40 border border-red-500/40 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button 
              onClick={() => handleMutation("backfill_to_episode")}
              disabled={loading} 
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Backfill to This Episode"}
            </button>
            <button 
              onClick={() => handleMutation("single")}
              disabled={loading} 
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded font-semibold hover:bg-gray-600 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Only This Episode"}
            </button>
          </div>
          <div className="mt-3">
            <button
              onClick={() => handleMutation("season_all")}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : `Mark Entire Season ${currentSeasonNumber}`}
            </button>
          </div>
          <button 
            onClick={handleCancel}
            disabled={loading}
            className="w-full mt-3 px-4 py-2 text-gray-400 hover:text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    )}
  </>);
};

export default EpisodeOverlay;
