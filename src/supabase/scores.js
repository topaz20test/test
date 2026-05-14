import { supabase } from './config';

/**
 * Create a new score
 * @param {Object} scoreData - { competition_id, entry_id, judge_number, technique, creativity, presentation, appearance, notes }
 * @returns {Object} - Created score data
 */
export const createScore = async (scoreData) => {
  try {
    console.log('Creating score:', scoreData);
    
    // Calculate total
    const total = (
      parseFloat(scoreData.technique || 0) +
      parseFloat(scoreData.creativity || 0) +
      parseFloat(scoreData.presentation || 0) +
      parseFloat(scoreData.appearance || 0)
    );

    const { data, error } = await supabase
      .from('scores')
      .insert([{
        competition_id: scoreData.competition_id,
        entry_id: scoreData.entry_id,
        judge_number: scoreData.judge_number,
        technique: parseFloat(scoreData.technique),
        creativity: parseFloat(scoreData.creativity),
        presentation: parseFloat(scoreData.presentation),
        appearance: parseFloat(scoreData.appearance),
        total_score: total,
        notes: scoreData.notes || null
      }])
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Score created:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error creating score:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all scores for an entry
 * @param {string} entryId - UUID of entry
 * @returns {Array} - List of scores from all judges
 */
export const getEntryScores = async (entryId) => {
  try {
    console.log('Fetching scores for entry:', entryId);
    
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .eq('entry_id', entryId)
      .order('judge_number');

    if (error) throw error;
    
    console.log('✅ Entry scores fetched:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching entry scores:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all scores for a competition
 * @param {string} competitionId - UUID of competition
 * @returns {Array} - List of all scores with entry info
 */
export const getCompetitionScores = async (competitionId) => {
  try {
    console.log('Fetching all scores for competition:', competitionId);
    
    const { data, error } = await supabase
      .from('scores')
      .select(`
        *,
        entry:entries(
          id,
          entry_number,
          competitor_name,
          category_id,
          age_division_id
        )
      `)
      .eq('competition_id', competitionId)
      .order('entry_id')
      .order('judge_number');

    if (error) throw error;
    
    console.log('✅ Competition scores fetched:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching competition scores:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get scores by judge
 * @param {string} competitionId - UUID of competition
 * @param {number} judgeNumber - Judge number (1-10)
 * @returns {Array} - List of scores from specific judge
 */
export const getJudgeScores = async (competitionId, judgeNumber) => {
  try {
    console.log('Fetching scores for judge:', judgeNumber);
    
    const { data, error } = await supabase
      .from('scores')
      .select(`
        *,
        entry:entries(
          id,
          entry_number,
          competitor_name,
          category_id,
          age_division_id
        )
      `)
      .eq('competition_id', competitionId)
      .eq('judge_number', judgeNumber)
      .order('entry_id');

    if (error) throw error;
    
    console.log('✅ Judge scores fetched:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching judge scores:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update score
 * @param {string} scoreId - UUID of score
 * @param {Object} updates - Fields to update (including notes)
 * @returns {Object} - Updated score data
 */
export const updateScore = async (scoreId, updates) => {
  try {
    console.log('Updating score:', scoreId, updates);
    
    // Recalculate total if any score component changed
    if (updates.technique !== undefined || 
        updates.creativity !== undefined || 
        updates.presentation !== undefined || 
        updates.appearance !== undefined) {
      
      // Get current score first
      const { data: currentScore, error: fetchError } = await supabase
        .from('scores')
        .select('*')
        .eq('id', scoreId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const total = (
        parseFloat(updates.technique ?? currentScore.technique) +
        parseFloat(updates.creativity ?? currentScore.creativity) +
        parseFloat(updates.presentation ?? currentScore.presentation) +
        parseFloat(updates.appearance ?? currentScore.appearance)
      );
      
      updates.total_score = total;
    }

    const { data, error } = await supabase
      .from('scores')
      .update(updates)
      .eq('id', scoreId)
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Score updated:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error updating score:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete score
 * @param {string} scoreId - UUID of score
 * @returns {Object} - Success status
 */
export const deleteScore = async (scoreId) => {
  try {
    console.log('Deleting score:', scoreId);
    
    const { error } = await supabase
      .from('scores')
      .delete()
      .eq('id', scoreId);

    if (error) throw error;
    
    console.log('✅ Score deleted');
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting score:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if judge has already scored an entry
 * @param {string} entryId - UUID of entry
 * @param {number} judgeNumber - Judge number
 * @returns {Object} - Existing score or null
 */
export const checkExistingScore = async (entryId, judgeNumber) => {
  try {
    console.log('Checking existing score:', entryId, judgeNumber);
    
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .eq('entry_id', entryId)
      .eq('judge_number', judgeNumber)
      .maybeSingle();

    if (error) throw error;
    
    console.log('✅ Existing score check:', data ? 'Found' : 'Not found');
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error checking existing score:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Insert or update this judge's score for an entry (unique on entry_id + judge_number).
 */
export const upsertJudgeScore = async (scoreData) => {
  try {
    const {
      competition_id,
      entry_id,
      judge_number,
      technique,
      creativity,
      presentation,
      appearance,
      notes
    } = scoreData;

    const existing = await checkExistingScore(entry_id, judge_number);
    if (!existing.success) throw new Error(existing.error);

    const techniqueN = parseFloat(technique);
    const creativityN = parseFloat(creativity);
    const presentationN = parseFloat(presentation);
    const appearanceN = parseFloat(appearance);

    const payload = {
      technique: techniqueN,
      creativity: creativityN,
      presentation: presentationN,
      appearance: appearanceN,
      notes: notes || null
    };

    if (existing.data?.id) {
      return updateScore(existing.data.id, payload);
    }

    return createScore({
      competition_id,
      entry_id,
      judge_number,
      ...payload
    });
  } catch (error) {
    console.error('❌ Error upserting judge score:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk create scores
 * @param {Array} scoresData - Array of score objects (including notes)
 * @returns {Array} - Created scores
 */
export const bulkCreateScores = async (scoresData) => {
  try {
    console.log('Bulk creating scores:', scoresData.length);
    
    // Calculate totals for each score
    const scoresWithTotals = scoresData.map(score => ({
      ...score,
      total_score: (
        parseFloat(score.technique || 0) +
        parseFloat(score.creativity || 0) +
        parseFloat(score.presentation || 0) +
        parseFloat(score.appearance || 0)
      ),
      notes: score.notes || null
    }));

    const { data, error } = await supabase
      .from('scores')
      .insert(scoresWithTotals)
      .select();

    if (error) throw error;
    
    console.log('✅ Scores bulk created:', data?.length);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error bulk creating scores:', error);
    return { success: false, error: error.message };
  }
};

