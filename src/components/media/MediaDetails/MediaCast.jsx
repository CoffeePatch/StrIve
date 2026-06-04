import React from 'react';
import PersonCard from '../../ui/PersonCard';
import Carousel from '../../ui/Carousel';
import SectionHeader from '../../ui/SectionHeader';

const MediaCast = ({ cast }) => {
  if (!cast || cast.length === 0) return null;

  return (
    <div className="mb-10 lg:mb-16">
      <SectionHeader 
        title="Cast" 
        icon={<span className="material-symbols-outlined">group</span>} 
      />
      <Carousel>
        {cast.map((person) => (
          <PersonCard 
            key={person.credit_id || person.id} 
            person={person} 
            variant="carousel"
          />
        ))}
      </Carousel>
    </div>
  );
};

export default MediaCast;
