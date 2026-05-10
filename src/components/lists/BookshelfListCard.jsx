import React from "react";
import { useNavigate } from "react-router-dom";

const BookshelfListCard = ({ list, onDelete, onExport, onTogglePin, isExporting, bulkDeleteMode, onSelect }) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (bulkDeleteMode) {
      onSelect();
    } else {
      navigate(`/library/lists/${list.id}`);
    }
  };

  const handlePinToggle = (e) => {
    e.stopPropagation();
    onTogglePin(list.id, list.isPinned);
  };

  // Get top 5 posters
  const actualPosters = list.items
    ?.slice(0, 5)
    .map((item) =>
      item.poster_path
        ? item.poster_path.startsWith("http")
          ? item.poster_path
          : `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : null
    )
    .filter(Boolean) || [];

  // Always show 5 slots
  const displaySlots = Array.from({ length: 5 }, (_, index) => actualPosters[index] || null);
  const totalItems = list.items?.length || 0;

  return (
    <div
      onClick={handleCardClick}
      className="group relative w-full bg-black border border-gray-800 hover:border-red-600 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col sm:flex-row h-auto sm:h-48"
    >
      {/* Left Side - Overlapping Waterfall Posters */}
      <div className="w-full sm:w-auto bg-black relative p-6 flex items-center justify-start shrink-0">
        <div className="relative h-40" style={{ width: '250px' }}>
          {displaySlots.map((poster, index) => (
            <div
              key={index}
              className="absolute top-0 w-28 h-40 rounded-md overflow-hidden shadow-2xl border border-gray-700 transition-all duration-500 group-hover:translate-x-2"
              style={{
                left: `${index * 45}px`,
                zIndex: 50 - index,
                transform: `scale(${1 - index * 0.03})`,
              }}
            >
              {poster ? (
                <>
                  <img
                    src={poster}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {/* Dark overlay for back posters */}
                  {index > 0 && <div className="absolute inset-0 bg-black/25" />}
                </>
              ) : (
                /* Empty placeholder with gradient */
                <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center">
                  <span className="material-symbols-outlined text-gray-700 text-2xl opacity-30">
                    movie
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Info */}
      <div className="flex-1 p-6 pl-10 flex flex-col justify-center bg-black">
        <div className="flex justify-between items-start">
          <div className="w-full">
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-red-500 transition-colors line-clamp-1">
              {list.name}
            </h3>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <span className="bg-gray-800 px-3 py-1 rounded-full text-gray-300 font-medium">
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </span>
            </p>
          </div>

          {/* Action Menu */}
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4 shrink-0">
            {onTogglePin && (
              <button
                onClick={handlePinToggle}
                className={`p-1.5 hover:bg-gray-800 rounded-lg transition-all ${
                  list.isPinned ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'
                }`}
                title={list.isPinned ? "Unpin List" : "Pin List"}
              >
                <span 
                  className="material-symbols-outlined text-xl"
                  style={{ fontVariationSettings: list.isPinned ? "'FILL' 1" : "'FILL' 0" }}
                >
                  star
                </span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(list);
                }}
                className="text-gray-500 hover:text-red-500 p-1.5 hover:bg-gray-800 rounded-lg transition-all"
                title="Delete List"
              >
                <span className="material-symbols-outlined text-xl">
                  delete
                </span>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExport(list.id, list.name);
              }}
              disabled={isExporting}
              className="text-gray-500 hover:text-white p-1.5 hover:bg-gray-800 rounded-lg transition-all"
              title="Export List"
            >
              <span className="material-symbols-outlined text-xl">
                download
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookshelfListCard;
