import { supabase } from './config';

/**
 * Reset all medal points globally (all entries + medal_participants)
 * Use at end of season after results transferred
 */
export const resetAllMedalPointsGlobally = async () => {
  try {
    // 1. Delete all medal_awards
    const { error: deleteAwardsError } = await supabase
      .from('medal_awards')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Match all (Supabase needs non-empty filter)

    if (deleteAwardsError) {
      console.warn('medal_awards delete:', deleteAwardsError);
      // Continue - table might not exist
    }

    // 2. Reset entries
    const { error: entriesError } = await supabase
      .from('entries')
      .update({ medal_points: 0, current_medal_level: 'None' })
      .eq('is_medal_program', true);

    if (entriesError) throw entriesError;

    // 3. Reset medal_participants
    const { error: participantsError } = await supabase
      .from('medal_participants')
      .update({ total_points: 0, current_medal_level: 'None' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (participantsError) {
      console.warn('medal_participants update:', participantsError);
      // Table might not exist
    }

    return { success: true };
  } catch (error) {
    console.error('resetAllMedalPointsGlobally error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get competitions that are test runs:
 * - is_test = true, OR
 * - name contains "test" (case-insensitive)
 */
export const getTestCompetitions = async () => {
  try {
    // Fetch all and filter client-side (Supabase or doesn't work well across columns)
    const { data: all, error } = await supabase
      .from('competitions')
      .select('id, name, date, is_test')
      .order('date', { ascending: false });

    if (error) throw error;

    const testComps = (all || []).filter(
      (c) => c.is_test === true || (c.name && c.name.toLowerCase().includes('test'))
    );
    return { success: true, data: testComps };
  } catch (error) {
    console.error('getTestCompetitions error:', error);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Delete competition by ID (cascade deletes entries, scores, categories, etc.)
 */
export const deleteCompetition = async (competitionId) => {
  try {
    const { error } = await supabase
      .from('competitions')
      .delete()
      .eq('id', competitionId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('deleteCompetition error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Archive all active competitions (set is_archived = true)
 */
export const archiveAllCompetitions = async () => {
  try {
    const { error } = await supabase
      .from('competitions')
      .update({ is_archived: true })
      .or('is_archived.is.null,is_archived.eq.false');

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('archiveAllCompetitions error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Nuclear reset - delete all data
 * Deletes competitions first; CASCADE removes entries, scores, categories, etc.
 */
export const nuclearReset = async () => {
  try {
    // Reset medal_participants first (standalone table, no competition FK)
    try {
      await supabase
        .from('medal_participants')
        .update({ total_points: 0, current_medal_level: 'None' })
        .neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {
      console.warn('medal_participants reset:', e.message);
    }

    // Get all competition IDs
    const { data: comps } = await supabase.from('competitions').select('id');
    if (comps && comps.length > 0) {
      for (const c of comps) {
        const { error } = await supabase.from('competitions').delete().eq('id', c.id);
        if (error) throw error;
      }
    }

    return { success: true };
  } catch (error) {
    console.error('nuclearReset error:', error);
    return { success: false, error: error.message };
  }
};
