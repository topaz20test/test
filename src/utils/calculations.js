/**
 * Calculate average score from multiple judges
 * @param {Array} scores - Array of score objects with total field
 * @returns {number} - Average score rounded to 2 decimals
 */
export const calculateAverageScore = (scores) => {
  if (!scores || scores.length === 0) return 0;
  
  const total = scores.reduce((sum, score) => sum + (parseFloat(score.total) || 0), 0);
  const average = total / scores.length;
  
  return Math.round(average * 100) / 100; // Round to 2 decimals
};

/**
 * Calculate total score from four categories
 * @param {number} technique - Technique score (0-25)
 * @param {number} creativity - Creativity score (0-25)
 * @param {number} presentation - Presentation score (0-25)
 * @param {number} appearance - Appearance score (0-25)
 * @returns {number} - Total score (0-100)
 */
export const calculateTotal = (technique, creativity, presentation, appearance) => {
  const total = (
    parseFloat(technique || 0) +
    parseFloat(creativity || 0) +
    parseFloat(presentation || 0) +
    parseFloat(appearance || 0)
  );
  
  return Math.round(total * 100) / 100; // Round to 2 decimals
};

/**
 * Calculate rankings for entries based on average scores
 * @param {Array} entriesWithScores - Array of entries with their scores
 * @returns {Array} - Sorted array with rank property added
 */
export const calculateRankings = (entriesWithScores) => {
  if (!entriesWithScores || entriesWithScores.length === 0) return [];
  
  // Calculate average score for each entry
  const withAverages = entriesWithScores.map(entry => ({
    ...entry,
    averageScore: calculateAverageScore(entry.scores || [])
  }));
  
  // Sort by average score (highest first)
  const sorted = [...withAverages].sort((a, b) => b.averageScore - a.averageScore);
  
  // Assign ranks (handle ties)
  let currentRank = 1;
  let previousScore = null;
  let skipCount = 0;
  
  const ranked = sorted.map((entry, index) => {
    if (previousScore !== null && entry.averageScore < previousScore) {
      currentRank += skipCount;
      skipCount = 1;
    } else if (previousScore !== null && entry.averageScore === previousScore) {
      skipCount++;
    } else {
      skipCount = 1;
    }
    
    previousScore = entry.averageScore;
    
    return {
      ...entry,
      rank: currentRank
    };
  });
  
  return ranked;
};

/**
 * Group entries by category
 * @param {Array} entries - Array of entry objects
 * @returns {Object} - Object with category IDs as keys
 */
export const groupByCategory = (entries) => {
  if (!entries || entries.length === 0) return {};
  
  return entries.reduce((groups, entry) => {
    const categoryId = entry.category_id || 'uncategorized';
    const categoryName = entry.category?.name || 'Uncategorized';
    
    if (!groups[categoryId]) {
      groups[categoryId] = {
        categoryId,
        categoryName,
        entries: []
      };
    }
    
    groups[categoryId].entries.push(entry);
    return groups;
  }, {});
};

/**
 * Group entries by age division
 * @param {Array} entries - Array of entry objects
 * @returns {Object} - Object with age division IDs as keys
 */
export const groupByAgeDivision = (entries) => {
  if (!entries || entries.length === 0) return {};
  
  return entries.reduce((groups, entry) => {
    const divisionId = entry.age_division_id || 'uncategorized';
    const divisionName = entry.age_division?.name || 'Uncategorized';
    
    if (!groups[divisionId]) {
      groups[divisionId] = {
        divisionId,
        divisionName,
        entries: []
      };
    }
    
    groups[divisionId].entries.push(entry);
    return groups;
  }, {});
};

/**
 * Validate individual score (0-25 range)
 * @param {number} score - Score to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validateScore = (score) => {
  const numScore = parseFloat(score);
  
  if (isNaN(numScore)) {
    return { valid: false, error: 'Score must be a number' };
  }
  
  if (numScore < 0) {
    return { valid: false, error: 'Score cannot be negative' };
  }
  
  if (numScore > 25) {
    return { valid: false, error: 'Score cannot exceed 25' };
  }
  
  // Check for too many decimal places (max 2)
  const decimalPlaces = (numScore.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    return { valid: false, error: 'Score can have maximum 2 decimal places' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate all four category scores
 * @param {Object} scores - { technique, creativity, presentation, appearance }
 * @returns {Object} - { valid: boolean, errors: Object }
 */
export const validateAllScores = (scores) => {
  const errors = {};
  let isValid = true;
  
  // Validate each category
  ['technique', 'creativity', 'presentation', 'appearance'].forEach(category => {
    const validation = validateScore(scores[category]);
    if (!validation.valid) {
      errors[category] = validation.error;
      isValid = false;
    }
  });
  
  // Check if any field is empty
  Object.entries(scores).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) {
      errors[key] = 'This field is required';
      isValid = false;
    }
  });
  
  // Check total doesn't exceed 100
  const total = calculateTotal(
    scores.technique,
    scores.creativity,
    scores.presentation,
    scores.appearance
  );
  
  if (total > 100) {
    errors.total = 'Total score cannot exceed 100';
    isValid = false;
  }
  
  return { valid: isValid, errors };
};

/**
 * Format score for display (2 decimal places)
 * @param {number} score - Score to format
 * @returns {string} - Formatted score
 */
export const formatScore = (score) => {
  const numScore = parseFloat(score);
  if (isNaN(numScore)) return '0.00';
  return numScore.toFixed(2);
};

/**
 * Get medal type based on rank
 * @param {number} rank - Rank position
 * @returns {string} - Medal type (gold/silver/bronze/none)
 */
export const getMedalType = (rank) => {
  switch (rank) {
    case 1:
      return 'gold';
    case 2:
      return 'silver';
    case 3:
      return 'bronze';
    default:
      return 'none';
  }
};

/**
 * Get medal emoji based on rank
 * @param {number} rank - Rank position
 * @returns {string} - Medal emoji
 */
export const getMedalEmoji = (rank) => {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '';
  }
};

/**
 * Calculate completion percentage for scoring
 * @param {number} completedScores - Number of scores submitted
 * @param {number} totalEntries - Total number of entries
 * @returns {number} - Percentage (0-100)
 */
export const calculateCompletionPercentage = (completedScores, totalEntries) => {
  if (totalEntries === 0) return 0;
  return Math.round((completedScores / totalEntries) * 100);
};

/**
 * Sort entries by entry number
 * @param {Array} entries - Array of entry objects
 * @returns {Array} - Sorted entries
 */
export const sortByEntryNumber = (entries) => {
  return [...entries].sort((a, b) => a.entry_number - b.entry_number);
};

/**
 * Get category breakdown for all judges
 * @param {Array} scores - Array of score objects from all judges
 * @returns {Object} - Breakdown by category
 */
export const getCategoryBreakdown = (scores) => {
  if (!scores || scores.length === 0) {
    return {
      technique: { total: 0, average: 0, scores: [] },
      creativity: { total: 0, average: 0, scores: [] },
      presentation: { total: 0, average: 0, scores: [] },
      appearance: { total: 0, average: 0, scores: [] }
    };
  }
  
  const breakdown = {
    technique: { total: 0, average: 0, scores: [] },
    creativity: { total: 0, average: 0, scores: [] },
    presentation: { total: 0, average: 0, scores: [] },
    appearance: { total: 0, average: 0, scores: [] }
  };
  
  scores.forEach(score => {
    breakdown.technique.scores.push(score.technique);
    breakdown.technique.total += score.technique;
    
    breakdown.creativity.scores.push(score.creativity);
    breakdown.creativity.total += score.creativity;
    
    breakdown.presentation.scores.push(score.presentation);
    breakdown.presentation.total += score.presentation;
    
    breakdown.appearance.scores.push(score.appearance);
    breakdown.appearance.total += score.appearance;
  });
  
  // Calculate averages
  Object.keys(breakdown).forEach(category => {
    breakdown[category].average = breakdown[category].total / scores.length;
    breakdown[category].average = Math.round(breakdown[category].average * 100) / 100;
  });
  
  return breakdown;
};

/**
 * Extract variety level from category description
 * @param {string} description - Category description (e.g., "Jazz | Variety A")
 * @returns {string} - Variety level or "None"
 */
export const extractVarietyLevel = (description) => {
  if (!description) return 'None';
  
  // Description format: "CategoryName | VarietyLevel"
  const parts = description.split('|');
  if (parts.length > 1) {
    return parts[1].trim();
  }
  
  return 'None';
};

/**
 * Group entries by exact combination
 * CRITICAL CHANGE: Variety levels compete ACROSS categories, not within them
 * - Variety A/B/C/D/E: All compete together regardless of base category
 * - Straight categories (None variety): Compete within their category
 * 
 * Grouping:
 * - Variety levels: Variety{Level}|Age|Ability|DivisionType (no category)
 * - Straight: Category|Age|Ability|DivisionType (with category)
 * 
 * @param {Array} entries - Array of entry objects with averageScore
 * @param {Array} categories - Array of category objects
 * @param {Array} ageDivisions - Array of age division objects
 * @returns {Object} - Object with combination keys mapping to group data
 */
export const groupByExactCombination = (entries, categories = [], ageDivisions = []) => {
  if (!entries || entries.length === 0) return {};
  
  const groups = {};
  
  entries.forEach(entry => {
    // Get category info
    const category = categories.find(c => c.id === entry.category_id);
    const categoryName = category?.name || 'Unknown';
    const categoryType = category?.type || 'dance'; // NEW: category type (dance, variety, special)
    
    // Get age division info
    const ageDivision = ageDivisions.find(d => d.id === entry.age_division_id);
    const ageDivisionName = ageDivision?.name || 'No Division';
    
    // Get ability level
    const abilityLevel = entry.ability_level || 'Unknown';
    
    // Get division type (Solo, Duo, Trio, Small Group, etc.)
    const divisionType = entry.dance_type || 'Solo';
    
    // NEW STRUCTURE: All categories compete within themselves (no cross-category competition)
    // Key: Category|Age|Ability|DivisionType
    const key = `${categoryName}|${ageDivisionName}|${abilityLevel}|${divisionType}`;
    const displayName = `${categoryName} - ${ageDivisionName} - ${abilityLevel} - ${divisionType}`;
    
    if (!groups[key]) {
      groups[key] = {
        key: key,
        displayName: displayName,
        category: categoryName,
        categoryId: entry.category_id,
        categoryType: categoryType, // NEW: store category type
        ageDivision: ageDivisionName,
        ageDivisionId: entry.age_division_id,
        abilityLevel: abilityLevel,
        divisionType: divisionType,
        entries: []
      };
    }
    
    groups[key].entries.push(entry);
  });
  
  return groups;
};

/**
 * Calculate rankings per group (each group gets its own 1st, 2nd, 3rd place)
 * @param {Object} groups - Groups object from groupByExactCombination
 * @returns {Object} - Groups with rankings assigned to each entry
 */
export const calculateRankingsPerGroup = (groups) => {
  const rankedGroups = {};
  
  Object.keys(groups).forEach(key => {
    const group = { ...groups[key] };
    
    // Sort entries by average score (descending)
    const sortedEntries = [...group.entries].sort((a, b) => b.averageScore - a.averageScore);
    
    // Assign ranks within this group (handle ties)
    let currentRank = 1;
    let previousScore = null;
    let skipCount = 0;
    
    const rankedEntries = sortedEntries.map((entry, index) => {
      if (previousScore !== null && entry.averageScore < previousScore) {
        currentRank += skipCount;
        skipCount = 1;
      } else if (previousScore !== null && entry.averageScore === previousScore) {
        skipCount++;
      } else {
        skipCount = 1;
      }
      
      previousScore = entry.averageScore;
      
      return {
        ...entry,
        categoryRank: currentRank // Rank within this specific category combination
      };
    });
    
    group.entries = rankedEntries;
    rankedGroups[key] = group;
  });
  
  return rankedGroups;
};

/**
 * Calculate top 4 highest overall scores across the entire competition
 * @param {Array} entries - Array of all entries with averageScore
 * @returns {Array} - Top 4 entries sorted by score
 * NOTE: Special categories should be filtered out before calling this function
 */
export const calculateTop4Overall = (entries) => {
  if (!entries || entries.length === 0) return [];
  
  // Sort all entries by average score (descending)
  const sorted = [...entries].sort((a, b) => b.averageScore - a.averageScore);
  
  // Return top 4 (or fewer if less than 4 entries)
  return sorted.slice(0, 4);
};

/**
 * Get division type emoji
 * @param {string} divisionType - Division type (Solo, Duo/Trio, etc.)
 * @returns {string} - Emoji representing the division type
 */
export const getDivisionTypeEmoji = (divisionType) => {
  if (!divisionType) return '👤';
  
  const type = divisionType.toLowerCase();
  
  if (type.includes('solo')) {
    return '👤';
  } else if (type.includes('duo')) {
    return '👥';
  } else if (type.includes('trio')) {
    return '👥👥';
  } else if (type.includes('small group')) {
    return '👥👥';
  } else if (type.includes('large group')) {
    return '👥👥👥';
  } else if (type.includes('production')) {
    return '🎭';
  }
  
  return '👥';
};

/**
 * Get division type display name
 * @param {string} divisionType - Division type from database
 * @returns {string} - Clean display name
 */
export const getDivisionTypeDisplayName = (divisionType) => {
  if (!divisionType) return 'Solo';
  
  // Clean up the division type for display
  if (divisionType.includes('Solo')) return 'Solo';
  if (divisionType.includes('Duo') && !divisionType.includes('Trio')) return 'Duo';
  if (divisionType.includes('Trio')) return 'Trio';
  if (divisionType.includes('Small Group')) return 'Small Group';
  if (divisionType.includes('Large Group')) return 'Large Group';
  if (divisionType.includes('Production')) return 'Production';
  
  return divisionType;
};

