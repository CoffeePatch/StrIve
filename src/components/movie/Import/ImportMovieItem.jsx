import React from 'react';
import { IMG_CDN_URL } from '../../../util/core/constants';

const ImportMovieItem = ({ movie, type }) => {
  const { title, release_date, poster_path } = movie;

  const year = release_date ? new Date(release_date).getFullYear() : 'N/A';

  const typeStyles = {
    matched: 'border-green-500',
    duplicate: 'border-red-500 bg-red-900/20',
  };

  const currentTypeStyle = typeStyles[type] || 'border-gray-500';

  return (
    <div className={`flex items-center p-3 bg-gray-700/50 rounded-lg border ${currentTypeStyle}`}>
      <div className="w-16 h-24 flex-shrink-0 mr-4">
        {poster_path ? (
          <img
            src={`${IMG_CDN_URL}${poster_path}`}
            alt={title}
            className="w-full h-full object-cover rounded"
          />
        ) : (
          <div className="w-full h-full bg-gray-600 rounded flex items-center justify-center">
            <span className="text-gray-400 text-xs text-center px-1">No Image</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-white font-medium truncate">{title}</h3>
        <p className="text-gray-400 text-sm">{year}</p>
        {type === 'duplicate' && (
          <span className="inline-block mt-1 px-2 py-1 bg-red-700/50 text-red-300 text-xs rounded">
            Already in list
          </span>
        )}
      </div>
    </div>
  );
};

export default ImportMovieItem;
