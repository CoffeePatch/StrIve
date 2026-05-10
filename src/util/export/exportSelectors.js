/**
 * Utility to verify and log the Redux state structure for export data
 * @param {Object} state - Redux state object
 */
export const verifyExportDataStructure = (state) => {
  console.log('=== Export Data Structure Verification ===');
  
  // Check if lists slice exists
  if (!state.lists) {
    console.error('ERROR: Lists slice not found in Redux state');
    return false;
  }
  
  // Check if customLists exists
  if (!state.lists.customLists) {
    console.error('ERROR: customLists not found in lists slice');
    return false;
  }
  
  // Check if lists array exists
  if (!Array.isArray(state.lists.customLists.lists)) {
    console.error('ERROR: customLists.lists is not an array');
    return false;
  }
  
  console.log(`✓ Found ${state.lists.customLists.lists.length} lists in customLists`);
  
  // Verify each list has required properties
  let validLists = 0;
  state.lists.customLists.lists.forEach((list, index) => {
    console.log(`List ${index + 1}: ${list.name || 'Unnamed List'}`);
    
    // Check list ID
    if (!list.id) {
      console.warn(`  ⚠ Warning: List ${index + 1} missing ID`);
    } else {
      console.log(`  ✓ ID: ${list.id}`);
    }
    
    // Check list name
    if (!list.name) {
      console.warn(`  ⚠ Warning: List ${index + 1} missing name`);
    } else {
      console.log(`  ✓ Name: ${list.name}`);
    }
    
    // Check items
    if (!list.items) {
      console.warn(`  ⚠ Warning: List ${index + 1} missing items array`);
    } else if (!Array.isArray(list.items)) {
      console.warn(`  ⚠ Warning: List ${index + 1} items is not an array`);
    } else {
      console.log(`  ✓ Items: ${list.items.length}`);
      
      // Check first few items for required fields
      const sampleItems = list.items.slice(0, 3);
      sampleItems.forEach((item, itemIndex) => {
        console.log(`    Item ${itemIndex + 1}:`);
        
        // Check TMDB ID
        if (!item.id) {
          console.warn(`      ⚠ Warning: Missing TMDB ID`);
        } else {
          console.log(`      ✓ TMDB ID: ${item.id}`);
        }
        
        // Check title/name
        const title = item.title || item.name;
        if (!title) {
          console.warn(`      ⚠ Warning: Missing title/name`);
        } else {
          console.log(`      ✓ Title: ${title}`);
        }
        
        // Check other useful fields
        if (item.release_date) {
          console.log(`      ✓ Release Date: ${item.release_date}`);
        }
        if (item.media_type) {
          console.log(`      ✓ Media Type: ${item.media_type}`);
        }
        if (item.vote_average !== undefined) {
          console.log(`      ✓ Rating: ${item.vote_average}`);
        }
      });
      
      validLists++;
    }
  });
  
  console.log(`=== Verification Complete: ${validLists}/${state.lists.customLists.lists.length} lists have valid structure ===`);
  return validLists > 0;
};

/**
 * Selector to get custom lists data for export
 * @param {Object} state - Redux state
 * @returns {Array} Array of list objects ready for export
 */
export const selectCustomListsForExport = (state) => {
  if (!state.lists || !state.lists.customLists || !Array.isArray(state.lists.customLists.lists)) {
    return [];
  }
  
  // Return the lists array as-is (already in correct format for export)
  return state.lists.customLists.lists;
};