import { 
  MAX_PINNED_LISTS, 
  MAX_LISTS_PER_USER, 
  MIN_LIST_NAME_LENGTH, 
  MAX_LIST_NAME_LENGTH, 
  RESERVED_LIST_NAMES 
} from './listConstants';

export const validateListName = (name, existingLists = []) => {
  if (!name) return "List name is required.";
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < MIN_LIST_NAME_LENGTH) {
    return "List name cannot be empty.";
  }
  
  if (trimmedName.length > MAX_LIST_NAME_LENGTH) {
    return `List name cannot exceed ${MAX_LIST_NAME_LENGTH} characters.`;
  }
  
  const lowerName = trimmedName.toLowerCase();
  
  if (RESERVED_LIST_NAMES.includes(lowerName)) {
    return `"${trimmedName}" is a reserved system name.`;
  }
  
  const isDuplicate = existingLists.some(
    list => list.name && list.name.trim().toLowerCase() === lowerName
  );
  
  if (isDuplicate) {
    return "A list with this name already exists.";
  }
  
  return null; // Valid
};

export const canPinMoreLists = (pinnedCount) => {
  return pinnedCount < MAX_PINNED_LISTS;
};

export const canCreateMoreLists = (totalCount) => {
  return totalCount < MAX_LISTS_PER_USER;
};
