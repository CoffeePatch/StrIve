import React from 'react';

const RatingLegend = () => {
  const legendItems = [
    { label: 'Awesome', range: '9.0+', color: 'bg-green-500', textColor: 'text-black' },
    { label: 'Great', range: '8.0-8.9', color: 'bg-lime-500', textColor: 'text-black' },
    { label: 'Good', range: '7.0-7.9', color: 'bg-yellow-400', textColor: 'text-black' },
    { label: 'Regular', range: '6.0-6.9', color: 'bg-orange-500', textColor: 'text-black' },
    { label: 'Bad', range: '5.0-5.9', color: 'bg-red-500', textColor: 'text-white' },
    { label: 'Garbage', range: '< 5.0', color: 'bg-purple-500', textColor: 'text-white' },
  ];

  return (
    <div role="group" aria-label="Rating color legend" className="flex flex-wrap gap-3 mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
      <span className="text-sm font-semibold mr-2" style={{ color: 'var(--color-text-primary)' }}>Rating Legend:</span>
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded ${item.color} ${item.textColor} flex items-center justify-center text-xs font-bold`}>★</div>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="font-semibold">{item.label}</span> ({item.range})
          </span>
        </div>
      ))}
    </div>
  );
};

export default RatingLegend;
