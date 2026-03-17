import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ShelfCard = ({ list, onDelete, onExport, onTogglePin, isExporting, bulkDeleteMode, onSelect }) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const handleCardClick = () => {
    if (bulkDeleteMode) {
      onSelect();
    } else {
      navigate(`/library/lists/${list.id}`);
    }
  };

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    onDelete(list);
  };

  const handleExport = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    onExport(list.id, list.name);
  };

  const handlePinToggle = (e) => {
    e.stopPropagation();
    onTogglePin(list.id, list.isPinned);
  };

  const itemCount = list.items?.length || 0;
  
  // Get up to 4 poster images for collage
  const previewImages = list.items
    ?.slice(0, 4)
    .map(item => item.poster_path)
    .filter(Boolean)
    .map(path => path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w500${path}`)
    || [];

  return (
    <div
      className="relative overflow-hidden rounded-lg cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl bg-gray-900"
      onClick={handleCardClick}
      style={{ aspectRatio: '2/3' }}
    >
      {/* Poster Collage Grid */}
      <div className="absolute inset-0">
        {previewImages.length > 0 ? (
          <div className={`grid h-full w-full gap-0.5 ${
            previewImages.length === 1 ? 'grid-cols-1 grid-rows-1' :
            previewImages.length === 2 ? 'grid-cols-2 grid-rows-1' :
            previewImages.length === 3 ? 'grid-cols-2 grid-rows-2' :
            'grid-cols-2 grid-rows-2'
          }`}>
            {previewImages.map((poster, index) => (
              <div
                key={index}
                className={`relative overflow-hidden ${
                  previewImages.length === 3 && index === 0 ? 'col-span-2' : ''
                }`}
              >
                <img
                  src={poster}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/10" />
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-red-900/40 to-black flex items-center justify-center">
            <span className="material-symbols-outlined text-6xl text-white/10">
              collections_bookmark
            </span>
          </div>
        )}
      </div>

      {/* Dark Gradient Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />

      {/* Top Bar - Actions */}
      <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-start z-20">
        {/* Three-dot Menu - Top Left */}
        {onDelete && (
          <div className="relative">
            <button
              onClick={handleMenuToggle}
              className="bg-black/60 backdrop-blur-sm p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/80"
              aria-label="List options"
            >
              <span className="material-symbols-outlined text-white text-base">
                more_vert
              </span>
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute top-10 left-0 bg-black/95 backdrop-blur-md rounded-lg overflow-hidden shadow-xl min-w-[120px] border border-white/10">
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full px-3 py-2 text-left text-white hover:bg-white/20 transition-colors flex items-center gap-2 text-xs font-secondary"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span>{isExporting ? 'Exporting...' : 'Export'}</span>
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full px-3 py-2 text-left text-red-400 hover:bg-red-600/20 transition-colors flex items-center gap-2 text-xs font-secondary"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pin Button - Top Right */}
        {onTogglePin && (
          <button
            onClick={handlePinToggle}
            className="bg-black/60 backdrop-blur-sm p-1.5 rounded-full transition-all duration-300 hover:bg-black/80"
            aria-label={list.isPinned ? "Unpin list" : "Pin list"}
          >
            <span className={`material-symbols-outlined text-base transition-colors ${
              list.isPinned 
                ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' 
                : 'text-white/60 hover:text-white'
            }`} style={{ fontVariationSettings: list.isPinned ? "'FILL' 1" : "'FILL' 0" }}>
              star
            </span>
          </button>
        )}
      </div>

      {/* Bottom Bar - Title and Count */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
        <div className="flex items-end justify-between gap-2">
          <h3 className="text-white text-sm font-bold font-display line-clamp-2 drop-shadow-lg leading-tight flex-1">
            {list.name}
          </h3>
          <div className="bg-red-600 px-2 py-0.5 rounded-full shrink-0">
            <span className="text-white text-xs font-bold font-secondary">
              {itemCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShelfCard;
