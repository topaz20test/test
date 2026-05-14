import { supabase } from './config';

/**
 * Create a new competition
 * @param {Object} competitionData - { name, date, venue, judges_count, status }
 * @returns {Object} - Created competition data
 */
export const createCompetition = async (competitionData) => {
  try {
    console.log('Creating competition:', competitionData);
    
    // TEMPORARY DEFENSIVE WORKAROUND
    // If the database column 'judge_names' doesn't exist yet, we try to save without it
    const insertData = {
      name: competitionData.name,
      date: competitionData.date,
      venue: competitionData.venue || null,
      judges_count: competitionData.judges_count || 3,
      judge_names: competitionData.judge_names || [],
      status: competitionData.status || 'active'
    };
    if (competitionData.is_test !== undefined) {
      insertData.is_test = competitionData.is_test;
    }
    const { data, error } = await supabase
      .from('competitions')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      // If error about missing column, retry without optional columns
      if (error.message?.includes('judge_names') || error.message?.includes('is_test')) {
        console.warn('⚠️ Optional column missing, retrying without it...');
        const fallback = { ...insertData };
        delete fallback.judge_names;
        delete fallback.is_test;
        const { data: retryData, error: retryError } = await supabase
          .from('competitions')
          .insert([fallback])
          .select()
          .single();
          
        if (retryError) throw retryError;
        return { success: true, data: retryData };
      }
      throw error;
    }
    
    console.log('✅ Competition created:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error creating competition:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get competition by ID
 * @param {string} competitionId - UUID of competition
 * @returns {Object} - Competition data
 */
export const getCompetition = async (competitionId) => {
  try {
    console.log('Fetching competition:', competitionId);
    
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', competitionId)
      .single();

    if (error) throw error;
    
    console.log('✅ Competition fetched:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching competition:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all competitions
 * @param {string} status - Filter by status (active/completed/all)
 * @param {boolean} includeArchived - Whether to include archived competitions (default: false)
 * @returns {Array} - List of competitions
 */
export const getAllCompetitions = async (status = 'all', includeArchived = false) => {
  try {
    console.log('Fetching all competitions, status:', status, 'includeArchived:', includeArchived);
    
    let query = supabase
      .from('competitions')
      .select('*')
      .order('date', { ascending: false });
    
    // Filter out archived competitions by default
    if (!includeArchived) {
      query = query.or('is_archived.is.null,is_archived.eq.false');
    }
    
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    console.log('✅ Competitions fetched:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching competitions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get only archived competitions
 * @returns {Array} - List of archived competitions
 */
export const getArchivedCompetitions = async () => {
  try {
    console.log('Fetching archived competitions');
    
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('is_archived', true)
      .order('date', { ascending: false });

    if (error) throw error;
    
    console.log('✅ Archived competitions fetched:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching archived competitions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Archive a competition (soft delete)
 * @param {string} competitionId - UUID of competition to archive
 * @returns {Object} - Success status
 */
export const archiveCompetition = async (competitionId) => {
  try {
    console.log('Archiving competition:', competitionId);
    
    const { error } = await supabase
      .from('competitions')
      .update({ is_archived: true })
      .eq('id', competitionId);

    if (error) throw error;
    
    console.log('✅ Competition archived');
    return { success: true };
  } catch (error) {
    console.error('❌ Error archiving competition:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Restore a competition from archive
 * @param {string} competitionId - UUID of competition to restore
 * @returns {Object} - Success status
 */
export const restoreCompetition = async (competitionId) => {
  try {
    console.log('Restoring competition:', competitionId);
    
    const { error } = await supabase
      .from('competitions')
      .update({ is_archived: false })
      .eq('id', competitionId);

    if (error) throw error;
    
    console.log('✅ Competition restored');
    return { success: true };
  } catch (error) {
    console.error('❌ Error restoring competition:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update competition
 * @param {string} competitionId - UUID of competition
 * @param {Object} updates - Fields to update
 * @returns {Object} - Updated competition data
 */
export const updateCompetition = async (competitionId, updates) => {
  try {
    console.log('Updating competition:', competitionId, updates);
    
    const { data, error } = await supabase
      .from('competitions')
      .update(updates)
      .eq('id', competitionId)
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Competition updated:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error updating competition:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete competition (and all related data)
 * @param {string} competitionId - UUID of competition
 * @returns {Object} - Success status
 */
export const deleteCompetition = async (competitionId) => {
  try {
    console.log('🗑️  Starting deletion of competition:', competitionId);
    
    // Step 1: Delete all photos from storage
    console.log('🗑️  Step 1: Deleting photos from storage...');
    try {
      const { data: entries } = await supabase
        .from('entries')
        .select('photo_url')
        .eq('competition_id', competitionId);
      
      if (entries && entries.length > 0) {
        const photoUrls = entries
          .filter(e => e.photo_url)
          .map(e => {
            // Extract file path from full URL
            const urlParts = e.photo_url.split('/');
            return `${competitionId}/${urlParts[urlParts.length - 1]}`;
          });
        
        if (photoUrls.length > 0) {
          const { error: storageError } = await supabase
            .storage
            .from('entry-photos')
            .remove(photoUrls);
          
          if (storageError) {
            console.warn('⚠️  Some photos may not have been deleted:', storageError);
          } else {
            console.log(`✅ Deleted ${photoUrls.length} photos`);
          }
        }
      }
    } catch (photoError) {
      console.warn('⚠️  Error deleting photos (continuing):', photoError);
    }
    
    // Step 2: Delete all scores
    console.log('🗑️  Step 2: Deleting scores...');
    const { error: scoresError } = await supabase
      .from('scores')
      .delete()
      .eq('competition_id', competitionId);
    
    if (scoresError) throw scoresError;
    console.log('✅ Scores deleted');
    
    // Step 3: Delete all entries
    console.log('🗑️  Step 3: Deleting entries...');
    const { error: entriesError } = await supabase
      .from('entries')
      .delete()
      .eq('competition_id', competitionId);
    
    if (entriesError) throw entriesError;
    console.log('✅ Entries deleted');
    
    // Step 4: Delete all age divisions
    console.log('🗑️  Step 4: Deleting age divisions...');
    const { error: divisionsError } = await supabase
      .from('age_divisions')
      .delete()
      .eq('competition_id', competitionId);
    
    if (divisionsError) throw divisionsError;
    console.log('✅ Age divisions deleted');
    
    // Step 5: Delete all categories
    console.log('🗑️  Step 5: Deleting categories...');
    const { error: categoriesError } = await supabase
      .from('categories')
      .delete()
      .eq('competition_id', competitionId);
    
    if (categoriesError) throw categoriesError;
    console.log('✅ Categories deleted');
    
    // Step 6: Finally, delete the competition itself
    console.log('🗑️  Step 6: Deleting competition...');
    const { error } = await supabase
      .from('competitions')
      .delete()
      .eq('id', competitionId);

    if (error) throw error;
    
    console.log('✅ Competition deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting competition:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete multiple competitions (bulk delete)
 * @param {Array} competitionIds - Array of competition UUIDs
 * @returns {Object} - Success status with details
 */
export const bulkDeleteCompetitions = async (competitionIds) => {
  try {
    console.log(`🗑️  Bulk deleting ${competitionIds.length} competitions...`);
    
    const results = {
      success: [],
      failed: []
    };
    
    for (const compId of competitionIds) {
      const result = await deleteCompetition(compId);
      if (result.success) {
        results.success.push(compId);
      } else {
        results.failed.push({ id: compId, error: result.error });
      }
    }
    
    console.log(`✅ Bulk delete complete: ${results.success.length} succeeded, ${results.failed.length} failed`);
    return { 
      success: true, 
      data: results,
      message: `Deleted ${results.success.length} of ${competitionIds.length} competitions`
    };
  } catch (error) {
    console.error('❌ Error in bulk delete:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete ALL competitions (danger zone)
 * @returns {Object} - Success status with count
 */
export const deleteAllCompetitions = async () => {
  try {
    console.log('🗑️  DANGER: Deleting ALL competitions...');
    
    // Get all competition IDs
    const { data: allCompetitions, error: fetchError } = await supabase
      .from('competitions')
      .select('id');
    
    if (fetchError) throw fetchError;
    
    if (!allCompetitions || allCompetitions.length === 0) {
      return { success: true, data: { count: 0 }, message: 'No competitions to delete' };
    }
    
    const competitionIds = allCompetitions.map(c => c.id);
    const result = await bulkDeleteCompetitions(competitionIds);
    
    return { 
      success: true, 
      data: { count: result.data.success.length },
      message: `Deleted ${result.data.success.length} competitions`
    };
  } catch (error) {
    console.error('❌ Error deleting all competitions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get competition statistics
 * @param {string} competitionId - UUID of competition
 * @returns {Object} - Statistics data
 */
export const getCompetitionStats = async (competitionId) => {
  try {
    console.log('Fetching competition stats:', competitionId);
    
    // Get entries count
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('id', { count: 'exact' })
      .eq('competition_id', competitionId);
    
    if (entriesError) throw entriesError;

    // Get scores count
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('id', { count: 'exact' })
      .eq('competition_id', competitionId);
    
    if (scoresError) throw scoresError;

    // Get categories count
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id', { count: 'exact' })
      .eq('competition_id', competitionId);
    
    if (categoriesError) throw categoriesError;

    const stats = {
      total_entries: entries?.length || 0,
      total_scores: scores?.length || 0,
      total_categories: categories?.length || 0
    };
    
    console.log('✅ Stats fetched:', stats);
    return { success: true, data: stats };
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    return { success: false, error: error.message };
  }
};

