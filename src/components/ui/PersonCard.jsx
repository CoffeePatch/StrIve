import React from 'react';
import BaseCard from './BaseCard';
import { IMG_CDN_URL } from '../../util/core/constants';

/**
 * PersonCard
 * Standardized component for representing a Person (Cast, Crew, Directors, etc.)
 * 
 * @param {object} person - The person object (needs name, profilePath, role/character)
 * @param {function} onClick - Click handler
 * @param {string} className - Additional classes
 */
const PersonCard = ({
  person,
  onClick,
  className = ""
}) => {
  if (!person) return null;

  const imageUrl = person.profilePath || person.profile_path
    ? `${IMG_CDN_URL}${person.profilePath || person.profile_path}`
    : null;

  // Role can come from character (cast) or job (crew)
  const role = person.character || person.job;
  const name = person.name;

  return (
    <div 
      className={`flex-none w-28 sm:w-32 md:w-36 flex flex-col items-center text-center group cursor-pointer transition-transform duration-300 hover:-translate-y-1 ${className}`}
      onClick={() => onClick && onClick(person)}
    >
      <div className="w-full aspect-square rounded-full overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors shadow-lg mb-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl font-bold bg-[#1A1A1A]">
            {name.charAt(0)}
          </div>
        )}
      </div>
      <h3 className="text-sm font-bold text-white w-full line-clamp-1 group-hover:text-white transition-colors">
        {name}
      </h3>
      {role && (
        <p className="text-xs text-[#9CA3AF] w-full line-clamp-1 mt-0.5">
          as {role}
        </p>
      )}
    </div>
  );
};

export default PersonCard;
