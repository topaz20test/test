import { supabase } from './config';

/**
 * Create a new entry
 * @param {Object} entryData - { competition_id, competitor_name, category_id, age_division_id, age, dance_type, ability_level, medal_points, current_medal_level, photo_url }
 * @returns {Object} - Created entry data
 */
export const createEntry = async (entryData) => {
  try {
    console.log('Creating entry:', entryData);
    
    // Build entry object with fallback for is_medal_program column
    const entryToInsert = {
      competition_id: entryData.competition_id,
      entry_number: entryData.entry_number,
      competitor_name: entryData.competitor_name,
      category_id: entryData.category_id || null,
      age_division_id: entryData.age_division_id || null,
      age: entryData.age || null,
      division_type: entryData.division_type || null,
      dance_type: entryData.dance_type || null,
      ability_level: entryData.ability_level || null,
      medal_points: entryData.medal_points || 0,
      current_medal_level: entryData.current_medal_level || 'None',
      photo_url: entryData.photo_url || null,
      studio_name: entryData.studio_name || null,
      teacher_name: entryData.teacher_name || null
    };

    // Try to include is_medal_program if provided
    // If the column doesn't exist, the insert will still work without it
    if (entryData.is_medal_program !== undefined) {
      entryToInsert.is_medal_program = entryData.is_medal_program;
    }

    // FIXED: Add group_members as JSONB if provided
    if (entryData.group_members !== undefined) {
      // Clean up group members data - convert ages to numbers or null
      const cleanedMembers = Array.isArray(entryData.group_members) 
        ? entryData.group_members.map(m => ({
            name: m.name || '',
            age: m.age ? parseInt(m.age) : null
          }))
        : null;
      
      entryToInsert.group_members = cleanedMembers;
      console.log('📦 Group members being saved:', cleanedMembers);
    }

    const { data, error } = await supabase
      .from('entries')
      .insert([entryToInsert])
      .select()
      .single();

    if (error) {
      // If error is about is_medal_program column, try without it
      if (error.message && error.message.includes('is_medal_program')) {
        console.warn('⚠️ is_medal_program column not found, saving without it...');
        delete entryToInsert.is_medal_program;
        
        const { data: retryData, error: retryError } = await supabase
          .from('entries')
          .insert([entryToInsert])
          .select()
          .single();
        
        if (retryError) throw retryError;
        
        console.log('✅ Entry created (without is_medal_program):', retryData);
        return { success: true, data: retryData };
      }
      
      throw error;
    }
    
    console.log('✅ Entry created:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error creating entry:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all entries for a competition
 * @param {string} competitionId - UUID of competition
 * @returns {Array} - List of entries with category and age division info
 */
export const getCompetitionEntries = async (competitionId) => {
  try {
    console.log('Fetching entries for competition:', competitionId);
    
    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        category:categories(id, name),
        age_division:age_divisions(id, name, min_age, max_age)
      `)
      .eq('competition_id', competitionId)
      .order('entry_number');

    if (error) throw error;
    
    console.log('✅ Entries fetched:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching entries:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get entry by ID
 * @param {string} entryId - UUID of entry
 * @returns {Object} - Entry data with related info
 */
export const getEntry = async (entryId) => {
  try {
    console.log('Fetching entry:', entryId);
    
    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        category:categories(id, name),
        age_division:age_divisions(id, name, min_age, max_age)
      `)
      .eq('id', entryId)
      .single();

    if (error) throw error;
    
    console.log('✅ Entry fetched:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching entry:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get entries by category
 * @param {string} categoryId - UUID of category
 * @returns {Array} - List of entries in category
 */
export const getEntriesByCategory = async (categoryId) => {
  try {
    console.log('Fetching entries for category:', categoryId);
    
    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        age_division:age_divisions(id, name)
      `)
      .eq('category_id', categoryId)
      .order('entry_number');

    if (error) throw error;
    
    console.log('✅ Category entries fetched:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching category entries:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get entries by age division
 * @param {string} ageDivisionId - UUID of age division
 * @returns {Array} - List of entries in age division
 */
export const getEntriesByAgeDivision = async (ageDivisionId) => {
  try {
    console.log('Fetching entries for age division:', ageDivisionId);
    
    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        category:categories(id, name)
      `)
      .eq('age_division_id', ageDivisionId)
      .order('entry_number');

    if (error) throw error;
    
    console.log('✅ Age division entries fetched:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching age division entries:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update entry
 * @param {string} entryId - UUID of entry
 * @param {Object} updates - Fields to update
 * @returns {Object} - Updated entry data
 */
export const updateEntry = async (entryId, updates) => {
  try {
    console.log('Updating entry:', entryId, updates);
    
    const { data, error } = await supabase
      .from('entries')
      .update(updates)
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Entry updated:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error updating entry:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete entry
 * @param {string} entryId - UUID of entry
 * @returns {Object} - Success status
 */
export const deleteEntry = async (entryId) => {
  try {
    console.log('Deleting entry:', entryId);
    
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', entryId);

    if (error) throw error;
    
    console.log('✅ Entry deleted');
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting entry:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk create entries
 * @param {Array} entriesData - Array of entry objects
 * @returns {Array} - Created entries
 */
export const bulkCreateEntries = async (entriesData) => {
  try {
    console.log('Bulk creating entries:', entriesData.length);
    
    const { data, error } = await supabase
      .from('entries')
      .insert(entriesData)
      .select();

    if (error) throw error;
    
    console.log('✅ Entries bulk created:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error bulk creating entries:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get next available entry number
 * @param {string} competitionId - UUID of competition
 * @returns {number} - Next entry number
 */
export const getNextEntryNumber = async (competitionId) => {
  try {
    console.log('Getting next entry number for competition:', competitionId);
    
    const { data, error } = await supabase
      .from('entries')
      .select('entry_number')
      .eq('competition_id', competitionId)
      .order('entry_number', { ascending: false })
      .limit(1);

    if (error) throw error;
    
    const nextNumber = data && data.length > 0 ? data[0].entry_number + 1 : 1;
    console.log('✅ Next entry number:', nextNumber);
    return { success: true, data: nextNumber };
  } catch (error) {
    console.error('❌ Error getting next entry number:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update medal points for an entry
 * @param {string} entryId - UUID of entry
 * @param {number} pointsToAdd - Points to add (usually 1 for 1st place)
 * @returns {Object} - Updated entry data
 */
export const addMedalPoints = async (entryId, pointsToAdd = 1) => {
  try {
    console.log('Adding medal points:', entryId, pointsToAdd);
    
    // Get current entry
    const { data: currentEntry, error: fetchError } = await supabase
      .from('entries')
      .select('medal_points')
      .eq('id', entryId)
      .single();

    if (fetchError) throw fetchError;

    const newPoints = (currentEntry.medal_points || 0) + pointsToAdd;
    
    // Determine medal level based on new total
    let medalLevel = 'None';
    if (newPoints >= 50) {
      medalLevel = 'Gold';
    } else if (newPoints >= 35) {
      medalLevel = 'Silver';
    } else if (newPoints >= 25) {
      medalLevel = 'Bronze';
    }

    // Update entry
    const { data, error } = await supabase
      .from('entries')
      .update({
        medal_points: newPoints,
        current_medal_level: medalLevel
      })
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Medal points updated:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error updating medal points:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Award medal points to 1st place winners in a competition
 * @param {string} competitionId - UUID of competition
 * @param {Array} firstPlaceWinners - Array of entry IDs that got 1st place
 * @returns {Object} - Results of point awards
 */
export const awardMedalPointsToWinners = async (competitionId, firstPlaceWinners) => {
  try {
    console.log('Awarding medal points to winners:', firstPlaceWinners);
    
    const results = {
      success: [],
      failed: []
    };

    for (const entryId of firstPlaceWinners) {
      const result = await addMedalPoints(entryId, 1);
      
      if (result.success) {
        results.success.push(entryId);
      } else {
        results.failed.push({ entryId, error: result.error });
      }
    }

    console.log('✅ Medal points awarded:', results);
    return { 
      success: true, 
      data: results,
      totalAwarded: results.success.length,
      totalFailed: results.failed.length
    };
  } catch (error) {
    console.error('❌ Error awarding medal points:', error);
    return { success: false, error: error.message };
  }
};

