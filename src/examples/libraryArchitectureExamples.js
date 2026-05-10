// ============================================================================
// EXAMPLE: Using the New Library Architecture
// ============================================================================

import {
  updateLibraryItem,
  toggleCustomListTag,
  getLibraryItem,
  getLibraryByStatus,
  getLibraryByListId,
} from '../util/firebase/firestoreService';

// ============================================================================
// Example 1: Adding to Watchlist
// ============================================================================

const handleAddToWatchlist = async (movie, userId) => {
  try {
    // This will:
    // 1. Create the library document if new
    // 2. Fetch IMDb rating ONCE
    // 3. Set status to "plan_to_watch"
    await updateLibraryItem(userId, movie, "plan_to_watch");
    
    console.log('✅ Added to watchlist!');
  } catch (error) {
    console.error('Failed to add to watchlist:', error);
  }
};

// ============================================================================
// Example 2: Marking as Watched/Completed
// ============================================================================

const handleMarkAsWatched = async (movie, userId) => {
  try {
    // This will:
    // 1. Update existing document (or create if somehow doesn't exist)
    // 2. Set status to "completed"
    // 3. Preserve IMDb data (no refetch)
    // 4. Preserve any custom list tags
    await updateLibraryItem(userId, movie, "completed");
    
    console.log('✅ Marked as completed!');
  } catch (error) {
    console.error('Failed to mark as watched:', error);
  }
};

// ============================================================================
// Example 3: Adding to Custom List (Without Status)
// ============================================================================

const handleAddToFavorites = async (movie, userId) => {
  try {
    // This will:
    // 1. Create a "passive" library document if new (status: null)
    // 2. Add "favorites_list" to the listIds array
    // 3. Fetch IMDb data if new
    await toggleCustomListTag(userId, movie, "favorites_list", true);
    
    console.log('✅ Added to favorites!');
  } catch (error) {
    console.error('Failed to add to favorites:', error);
  }
};

// ============================================================================
// Example 4: Movie in BOTH Watchlist AND Custom List
// ============================================================================

const handleAddToWatchlistAndFavorites = async (movie, userId) => {
  try {
    // First, set the status
    await updateLibraryItem(userId, movie, "plan_to_watch");
    
    // Then, add to custom list
    await toggleCustomListTag(userId, movie, "favorites_list", true);
    
    // Result in Firestore:
    // {
    //   id: "550",
    //   status: "plan_to_watch",
    //   listIds: ["favorites_list"],
    //   imdbRating: 8.8,
    //   ...
    // }
    
    console.log('✅ Added to both watchlist and favorites!');
  } catch (error) {
    console.error('Failed:', error);
  }
};

// ============================================================================
// Example 5: Fetching User's Watchlist (for display)
// ============================================================================

const fetchWatchlist = async (userId) => {
  try {
    const watchlist = await getLibraryByStatus(userId, "plan_to_watch");
    
    // Returns array of items with status: "plan_to_watch"
    // Each item has imdbRating and imdbVotes stored as numbers!
    
    // Sort by IMDb rating (highest first)
    const sortedByRating = [...watchlist].sort((a, b) => 
      (b.imdbRating || 0) - (a.imdbRating || 0)
    );
    
    // Sort by IMDb votes (most popular first)
    const sortedByPopularity = [...watchlist].sort((a, b) => 
      (b.imdbVotes || 0) - (a.imdbVotes || 0)
    );
    
    return { watchlist, sortedByRating, sortedByPopularity };
  } catch (error) {
    console.error('Failed to fetch watchlist:', error);
    return { watchlist: [], sortedByRating: [], sortedByPopularity: [] };
  }
};

// ============================================================================
// Example 6: Fetching Custom List Items
// ============================================================================

const fetchCustomList = async (userId, listId) => {
  try {
    const items = await getLibraryByListId(userId, listId);
    
    // Returns all items where listIds contains this listId
    // Items might have different statuses or no status at all
    
    // Group by status
    const grouped = {
      watching: items.filter(item => item.status === "watching"),
      completed: items.filter(item => item.status === "completed"),
      planned: items.filter(item => item.status === "plan_to_watch"),
      passive: items.filter(item => item.status === null),
    };
    
    return { items, grouped };
  } catch (error) {
    console.error('Failed to fetch custom list:', error);
    return { items: [], grouped: {} };
  }
};

// ============================================================================
// Example 7: Checking if Movie is in User's Library
// ============================================================================

const checkLibraryStatus = async (tmdbId, userId) => {
  try {
    const item = await getLibraryItem(userId, String(tmdbId));
    
    if (!item) {
      return {
        inLibrary: false,
        status: null,
        customLists: [],
      };
    }
    
    return {
      inLibrary: true,
      status: item.status, // "watching", "completed", etc.
      customLists: item.listIds || [],
      imdbRating: item.imdbRating,
      imdbVotes: item.imdbVotes,
    };
  } catch (error) {
    console.error('Failed to check library status:', error);
    return { inLibrary: false, status: null, customLists: [] };
  }
};

// ============================================================================
// Example 8: Removing from Custom List (Keep in Watchlist)
// ============================================================================

const handleRemoveFromFavorites = async (movie, userId) => {
  try {
    // This will:
    // 1. Remove "favorites_list" from listIds array
    // 2. Keep the document (with its status intact)
    await toggleCustomListTag(userId, movie, "favorites_list", false);
    
    console.log('✅ Removed from favorites (but still in library)!');
  } catch (error) {
    console.error('Failed to remove from favorites:', error);
  }
};

// ============================================================================
// Example 9: Complete Flow - Movie Card Actions
// ============================================================================

const MovieCardActions = ({ movie, userId }) => {
  const [libraryStatus, setLibraryStatus] = React.useState(null);
  
  // Load current status
  React.useEffect(() => {
    checkLibraryStatus(movie.id, userId).then(setLibraryStatus);
  }, [movie.id, userId]);
  
  const handleAddToWatchlist = async () => {
    await updateLibraryItem(userId, movie, "plan_to_watch");
    // Refresh status
    const newStatus = await checkLibraryStatus(movie.id, userId);
    setLibraryStatus(newStatus);
  };
  
  const handleMarkWatching = async () => {
    await updateLibraryItem(userId, movie, "watching");
    const newStatus = await checkLibraryStatus(movie.id, userId);
    setLibraryStatus(newStatus);
  };
  
  const handleMarkCompleted = async () => {
    await updateLibraryItem(userId, movie, "completed");
    const newStatus = await checkLibraryStatus(movie.id, userId);
    setLibraryStatus(newStatus);
  };
  
  const handleToggleFavorites = async () => {
    const isInFavorites = libraryStatus?.customLists?.includes("favorites_list");
    await toggleCustomListTag(userId, movie, "favorites_list", !isInFavorites);
    const newStatus = await checkLibraryStatus(movie.id, userId);
    setLibraryStatus(newStatus);
  };
  
  return (
    <div>
      {/* Status Buttons */}
      <button onClick={handleAddToWatchlist}>
        {libraryStatus?.status === "plan_to_watch" ? "✓ In Watchlist" : "+ Watchlist"}
      </button>
      
      <button onClick={handleMarkWatching}>
        {libraryStatus?.status === "watching" ? "✓ Watching" : "Mark Watching"}
      </button>
      
      <button onClick={handleMarkCompleted}>
        {libraryStatus?.status === "completed" ? "✓ Completed" : "Mark Completed"}
      </button>
      
      {/* Custom List Toggle */}
      <button onClick={handleToggleFavorites}>
        {libraryStatus?.customLists?.includes("favorites_list") 
          ? "★ Favorited" 
          : "☆ Add to Favorites"}
      </button>
      
      {/* Display IMDb Rating if available */}
      {libraryStatus?.imdbRating && (
        <div>
          IMDb: {libraryStatus.imdbRating} ({libraryStatus.imdbVotes?.toLocaleString()} votes)
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Example 10: Batch Operations
// ============================================================================

const batchAddToCustomList = async (movies, userId, listId) => {
  try {
    const promises = movies.map(movie => 
      toggleCustomListTag(userId, movie, listId, true)
    );
    
    await Promise.all(promises);
    console.log(`✅ Added ${movies.length} movies to ${listId}`);
  } catch (error) {
    console.error('Batch operation failed:', error);
  }
};

export {
  handleAddToWatchlist,
  handleMarkAsWatched,
  handleAddToFavorites,
  fetchWatchlist,
  fetchCustomList,
  checkLibraryStatus,
  MovieCardActions,
  batchAddToCustomList,
};
