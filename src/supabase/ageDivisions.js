import { supabase } from './config';

/**
 * Create a new age division
 * @param {Object} divisionData - { competition_id, name, min_age, max_age, description }
 * @returns {Object} - Created age division data
 */
export const createAgeDivision = async (divisionData) => {
  try {
    console.log('Creating age division:', divisionData);
    
    const { data, error } = await supabase
      .from('age_divisions')
      .insert([{
        competition_id: divisionData.competition_id,
        name: divisionData.name,
        min_age: divisionData.min_age || null,
        max_age: divisionData.max_age || null,
        description: divisionData.description || null
      }])
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Age division created:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error creating age division:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all age divisions for a competition
 * @param {string} competitionId - UUID of competition
 * @returns {Array} - List of age divisions
 */
export const getCompetitionAgeDivisions = async (competitionId) => {
  try {
    console.log('Fetching age divisions for competition:', competitionId);
    
    const { data, error } = await supabase
      .from('age_divisions')
      .select('*')
      .eq('competition_id', competitionId)
      .order('min_age');

    if (error) throw error;
    
    console.log('✅ Age divisions fetched:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching age divisions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get age division by ID
 * @param {string} divisionId - UUID of age division
 * @returns {Object} - Age division data
 */
export const getAgeDivision = async (divisionId) => {
  try {
    console.log('Fetching age division:', divisionId);
    
    const { data, error } = await supabase
      .from('age_divisions')
      .select('*')
      .eq('id', divisionId)
      .single();

    if (error) throw error;
    
    console.log('✅ Age division fetched:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching age division:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update age division
 * @param {string} divisionId - UUID of age division
 * @param {Object} updates - Fields to update
 * @returns {Object} - Updated age division data
 */
export const updateAgeDivision = async (divisionId, updates) => {
  try {
    console.log('Updating age division:', divisionId, updates);
    
    const { data, error } = await supabase
      .from('age_divisions')
      .update(updates)
      .eq('id', divisionId)
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Age division updated:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error updating age division:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete age division
 * @param {string} divisionId - UUID of age division
 * @returns {Object} - Success status
 */
export const deleteAgeDivision = async (divisionId) => {
  try {
    console.log('Deleting age division:', divisionId);
    
    const { error } = await supabase
      .from('age_divisions')
      .delete()
      .eq('id', divisionId);

    if (error) throw error;
    
    console.log('✅ Age division deleted');
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting age division:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk create age divisions
 * @param {Array} divisionsData - Array of age division objects
 * @returns {Array} - Created age divisions
 */
export const bulkCreateAgeDivisions = async (divisionsData) => {
  try {
    console.log('Bulk creating age divisions:', divisionsData.length);
    
    const { data, error } = await supabase
      .from('age_divisions')
      .insert(divisionsData)
      .select();

    if (error) throw error;
    
    console.log('✅ Age divisions bulk created:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error bulk creating age divisions:', error);
    return { success: false, error: error.message };
  }
};

