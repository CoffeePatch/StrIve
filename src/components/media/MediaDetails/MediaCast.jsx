import React from 'react';
import PersonCard from '../../ui/PersonCard';
import Carousel from '../../ui/Carousel';
import SectionHeader from '../../ui/SectionHeader';

const MediaCast = ({ cast }) => {
  if (!cast || cast.length === 0) return null;

  return (
    <div className="mb-10 lg:mb-16">
      <div className="flex justify-center mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-primary tracking-wide">
          Top Billed Cast
        </h2>
      </div>
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
