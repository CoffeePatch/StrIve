import React, { createContext, useContext } from 'react';

export const LibraryFiltersContext = createContext(null);

export const useLibraryFiltersContext = () => {
  const context = useContext(LibraryFiltersContext);
  if (!context) {
    throw new Error('useLibraryFiltersContext must be used within a LibraryFiltersProvider');
  }
  return context;
};
