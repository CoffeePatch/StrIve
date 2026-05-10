// src/util/core/constants.js

// TMDB API Configuration
export const tmdbOptions = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${import.meta.env.VITE_TMDB_KEY}`,
  },
};

// Combined options object (keeping existing for backward compatibility)
export const options = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${import.meta.env.VITE_TMDB_KEY}`,
  },
};

export const IMG_CDN_URL = "https://image.tmdb.org/t/p/w500";
