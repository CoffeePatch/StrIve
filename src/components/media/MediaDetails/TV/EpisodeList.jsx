import React from "react";
import EpisodeMatrixView from "../../../tv/TVShowDetails/EpisodeMatrixView";
import EpisodeListItem from "../../../tv/TVShowDetails/EpisodeListItem";
import EpisodeCard from "../../../ui/EpisodeCard";

const EpisodeList = ({
  viewMode,
  isLoadingMatrix,
  allSeasonsData,
  showDetails,
  setSelectedSeason,
  handleEpisodeClick,
  episodesLoading,
  seasonData,
  watchedSet,
  handleToggleEpisodeWatched,
  markWatchedLoading,
}) => {
  return (
    <div className="mt-6" role="region" aria-label="Episodes">
      {viewMode === 'matrix' && (
        isLoadingMatrix ? (
          <div className="flex justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 mx-auto" style={{ borderColor: 'var(--color-accent-primary)' }}></div>
              <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>Loading all season data...</p>
            </div>
          </div>
        ) : allSeasonsData ? (
          <EpisodeMatrixView
            seasonsData={allSeasonsData}
            baseSeasonInfo={showDetails?.seasons || []}
            onEpisodeClick={(episode, seasonNumber) => {
              setSelectedSeason(seasonNumber);
              handleEpisodeClick(episode);
            }}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-red-500">Could not load matrix data.</p>
          </div>
        )
      )}

      {viewMode !== 'matrix' && episodesLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4" style={{ borderColor: 'var(--color-accent-primary)' }}></div>
        </div>
      )}

      {viewMode !== 'matrix' && !episodesLoading && seasonData?.episodes && seasonData.episodes.length > 0 && (
        viewMode === 'list' ? (
          <div className="grid grid-cols-1 gap-4">
            {seasonData.episodes.map((episode) => (
              <EpisodeListItem
                key={episode.id}
                episode={episode}
                onClick={() => handleEpisodeClick(episode)}
                isWatched={watchedSet.has(`${episode.seasonNumber}:${episode.episodeNumber}`)}
                onToggleWatched={handleToggleEpisodeWatched}
                watchLoading={markWatchedLoading}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5 xl:gap-6">
            {seasonData.episodes.map((episode) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                showName={showDetails?.name}
                onClick={() => handleEpisodeClick(episode)}
                isWatched={watchedSet.has(`${episode.seasonNumber}:${episode.episodeNumber}`)}
                onToggleWatched={handleToggleEpisodeWatched}
                watchLoading={markWatchedLoading}
              />
            ))}
          </div>
        )
      )}

      {viewMode !== 'matrix' && !episodesLoading && (!seasonData?.episodes || seasonData.episodes.length === 0) && (
        <div className="text-center py-12">
          <p style={{ color: 'var(--color-text-secondary)' }}>No episodes available for this season</p>
        </div>
      )}
    </div>
  );
};

export default EpisodeList;
