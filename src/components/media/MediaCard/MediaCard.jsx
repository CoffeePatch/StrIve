import React from "react";

export const MediaCard = ({
  media,
  onClick,
  vaultMode = false,
  cardSize = "default",
  children
}) => {
  if (!media) return null;

  const cardWidthClass = cardSize === "compact" ? "w-44" : "w-52";
  
  const handleCardClick = () => {
    if (onClick) {
      onClick(media);
    }
  };

  if (vaultMode) {
    return (
      <div
        className="cursor-pointer group transition-all duration-200 hover:scale-105 relative"
        onClick={handleCardClick}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`flex-none ${cardWidthClass} cursor-pointer group transition-all duration-300`}
      onClick={handleCardClick}
    >
      {children}
    </div>
  );
};
