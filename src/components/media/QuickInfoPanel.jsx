import React from "react";
import { Star, ExternalLink } from "lucide-react";

const formatVoteCount = (count) => {
  if (!count) return '';
  
  if (count >= 1000000) {
    const millions = count / 1000000;
    return millions % 1 === 0 ? `${millions}m` : `${millions.toFixed(1)}m`;
  }
  
  if (count >= 1000) {
    const thousands = count / 1000;
    return thousands % 1 === 0 ? `${thousands}k` : `${thousands.toFixed(1)}k`;
  }
  
  return count.toString();
};

const QuickInfoPanel = ({ showDetails }) => {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(showDetails.name + ' TV show')}`;

  return (
    <div className="rounded-lg p-6"
      style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
      <h3 className="text-lg font-semibold mb-4"
        style={{ color: 'var(--color-text-primary)' }}>
        Quick Info
      </h3>

      <div className="space-y-3 text-sm">
        {/* TMDB Rating */}
        {showDetails.voteAverage && (
          <div>
            <div className="font-medium mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}>
              TMDB Rating
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span style={{ color: 'var(--color-text-primary)' }} className="font-semibold">
                {showDetails.voteAverage.toFixed(1)}/10
              </span>
              {showDetails.voteCount && (
                <span style={{ color: 'var(--color-text-tertiary)' }}>
                  ({formatVoteCount(showDetails.voteCount)} votes)
                </span>
              )}
            </div>
          </div>
        )}

        {/* IMDb Rating */}
        {showDetails.imdbRating && (
          <div>
            <div className="font-medium mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}>
              IMDb Rating
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span style={{ color: 'var(--color-text-primary)' }} className="font-semibold">
                {showDetails.imdbRating}/10
              </span>
              {showDetails.imdbVotes && (
                <span style={{ color: 'var(--color-text-tertiary)' }}>
                  ({formatVoteCount(showDetails.imdbVotes)} votes)
                </span>
              )}
            </div>
          </div>
        )}

        {/* First Air Date */}
        {showDetails.firstAirDate && (
          <div>
            <div className="font-medium mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}>
              First Aired
            </div>
            <div style={{ color: 'var(--color-text-primary)' }}>
              {new Date(showDetails.firstAirDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        )}

        {/* Seasons & Episodes */}
        <div>
          <div className="font-medium mb-1"
            style={{ color: 'var(--color-text-tertiary)' }}>
            Content
          </div>
          <div style={{ color: 'var(--color-text-primary)' }}>
            {showDetails.numberOfSeasons} Season{showDetails.numberOfSeasons !== 1 ? 's' : ''} • {' '}
            {showDetails.numberOfEpisodes} Episode{showDetails.numberOfEpisodes !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Status */}
        {showDetails.status && (
          <div>
            <div className="font-medium mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}>
              Status
            </div>
            <div style={{ color: 'var(--color-text-primary)' }}>
              {showDetails.status}
            </div>
          </div>
        )}

        {/* Networks */}
        {showDetails.networks && showDetails.networks.length > 0 && (
          <div>
            <div className="font-medium mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}>
              Networks
            </div>
            <div className="flex flex-wrap gap-2">
              {showDetails.networks.map((network) => (
                <span key={network.id}
                  style={{ color: 'var(--color-text-primary)' }}>
                  {network.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* External Search */}
        <div className="pt-2 border-t"
          style={{ borderColor: 'var(--color-bg-surface)' }}>
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-medium hover:underline focus-accent"
            style={{ color: 'var(--color-accent-primary)' }}
          >
            <ExternalLink className="w-4 h-4" />
            Search on Google
          </a>
        </div>
      </div>
    </div>
  );
};

export default QuickInfoPanel;
