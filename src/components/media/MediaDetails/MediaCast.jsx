import React from 'react';

const IMG_CDN_URL = "https://image.tmdb.org/t/p";

const MediaCast = ({ cast }) => {
  if (!cast || cast.length === 0) return null;

  return (
    <div className="mb-10 lg:mb-16">
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <h2 className="text-2xl lg:text-3xl font-bold font-display flex items-center gap-3" style={{ color: 'var(--color-text-primary)' }}>
          <span className="material-symbols-outlined text-3xl lg:text-4xl text-red-600">group</span>
          Cast
        </h2>
      </div>
      <div
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide hide-horizontal-scrollbar"
        data-horizontal-scroll="true"
      >
        {cast.map((person) => (
          <div key={person.credit_id || person.id} className="flex-none w-28 sm:w-32 lg:w-40 text-center lg:text-left">
            <div className="premium-card overflow-hidden h-full hidden lg:block">
              {person.profile_path ? (
                <img
                  src={`${IMG_CDN_URL}/w185${person.profile_path}`}
                  alt={person.name}
                  className="w-full h-52 object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-52 bg-white/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-white/20">person</span>
                </div>
              )}
              <div className="p-3">
                <p className="text-white font-semibold text-sm truncate font-secondary">
                  {person.name}
                </p>
                {person.character && (
                  <p className="text-white/60 text-xs truncate">
                    {person.character}
                  </p>
                )}
              </div>
            </div>

            {/* Mobile/Tablet circular style (TV style) fallback for smaller screens */}
            <div className="lg:hidden mx-auto h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden border border-white/10 bg-white/5">
              {person.profile_path ? (
                <img
                  src={`${IMG_CDN_URL}/w185${person.profile_path}`}
                  alt={person.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl text-white/40">person</span>
                </div>
              )}
            </div>
            <p className="lg:hidden mt-2 text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {person.name}
            </p>
            {person.character && (
              <p className="lg:hidden text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                {person.character}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MediaCast;
