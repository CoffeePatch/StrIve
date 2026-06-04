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
    <div className={`flex-none w-32 sm:w-40 md:w-44 ${className}`}>
      <BaseCard
        imageUrl={imageUrl}
        imageAlt={name}
        aspectRatio="2/3"
        onClick={() => onClick && onClick(person)}
        fallbackText={name}
      >
        <h3 className="text-sm font-bold text-white truncate group-hover:text-[var(--color-accent-primary)] transition-colors mt-1">
          {name}
        </h3>
        {role && (
          <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
            {role}
          </p>
        )}
      </BaseCard>
    </div>
  );
};

export default PersonCard;
