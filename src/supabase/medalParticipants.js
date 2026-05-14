import { supabase } from './config';

/**
 * Get or create a medal participant by name
 * @param {string} participantName - Name of participant
 * @returns {Object} - Participant record
 */
export const getOrCreateParticipant = async (participantName) => {
  try {
    // Normalize name (trim whitespace)
    const normalizedName = participantName.trim();
    
    if (!normalizedName) {
      return { success: false, error: 'Participant name is required' };
    }

    // Try to get existing participant
    const { data: existing, error: fetchError } = await supabase
      .from('medal_participants')
      .select('*')
      .eq('participant_name', normalizedName)
      .single();

    if (existing) {
      return { success: true, data: existing };
    }

    // Create new participant if doesn't exist
    const { data: newParticipant, error: createError } = await supabase
      .from('medal_participants')
      .insert({
        participant_name: normalizedName,
        total_points: 0,
        current_medal_level: 'None'
      })
      .select()
      .single();

    if (createError) throw createError;

    console.log('✅ Created new medal participant:', normalizedName);
    return { success: true, data: newParticipant };
  } catch (error) {
    console.error('❌ Error getting/creating participant:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Award medal point to a participant
 * @param {string} participantName - Name of participant
 * @param {string} competitionId - UUID of competition
 * @param {string} entryId - UUID of entry
 * @returns {Object} - Success status
 */
export const awardPointToParticipant = async (participantName, competitionId, entryId) => {
  try {
    const normalizedName = participantName.trim();

    if (!normalizedName) {
      console.error('❌ ERROR: Empty participant name');
      return { success: false, error: 'Participant name is required' };
    }

    console.log(`      🎯 Awarding to: "${normalizedName}"`);

    // Get or create participant
    const participantResult = await getOrCreateParticipant(normalizedName);
    if (!participantResult.success) {
      console.error(`      ❌ Failed to get/create participant: ${participantResult.error}`);
      throw new Error(participantResult.error);
    }

    const participant = participantResult.data;
    console.log(`      📊 Current status: ${participant.total_points} points, ${participant.current_medal_level} medal`);

    // Check if award already exists (prevent duplicates)
    const { data: existingAward, error: checkError } = await supabase
      .from('medal_awards')
      .select('id, awarded_at')
      .eq('competition_id', competitionId)
      .eq('entry_id', entryId)
      .eq('participant_name', normalizedName)
      .maybeSingle();

    if (checkError) {
      console.error(`      ❌ Error checking for existing award: ${checkError.message}`);
      throw checkError;
    }

    if (existingAward) {
      console.log(`      ⚠️ DUPLICATE PREVENTED: Award already exists (awarded at ${existingAward.awarded_at})`);
      return { success: true, data: participant, alreadyAwarded: true };
    }

    // Create medal award record
    console.log(`      💾 Creating award record...`);
    const { data: newAward, error: awardError } = await supabase
      .from('medal_awards')
      .insert({
        competition_id: competitionId,
        entry_id: entryId,
        participant_name: normalizedName,
        points_awarded: 1
      })
      .select()
      .single();

    if (awardError) {
      console.error(`      ❌ Failed to create award record: ${awardError.message}`);
      throw awardError;
    }
    
    console.log(`      ✅ Award record created: ${newAward.id}`);

    // Update participant points
    const newTotalPoints = participant.total_points + 1;
    
    // Determine medal level
    let medalLevel = 'None';
    let levelUp = false;
    const oldLevel = participant.current_medal_level;
    
    if (newTotalPoints >= 50) {
      medalLevel = 'Gold';
    } else if (newTotalPoints >= 35) {
      medalLevel = 'Silver';
    } else if (newTotalPoints >= 25) {
      medalLevel = 'Bronze';
    }
    
    if (medalLevel !== oldLevel) {
      levelUp = true;
    }

    // Update participant
    console.log(`      💾 Updating participant record...`);
    const { data: updatedParticipant, error: updateError } = await supabase
      .from('medal_participants')
      .update({
        total_points: newTotalPoints,
        current_medal_level: medalLevel
      })
      .eq('id', participant.id)
      .select()
      .single();

    if (updateError) {
      console.error(`      ❌ Failed to update participant: ${updateError.message}`);
      throw updateError;
    }

    if (levelUp) {
      console.log(`      🎉 LEVEL UP! ${oldLevel} → ${medalLevel}`);
    }
    console.log(`      ✅ Point awarded! New total: ${newTotalPoints} points (${medalLevel})`);
    
    return { success: true, data: updatedParticipant, levelUp };
  } catch (error) {
    console.error(`      ❌ CRITICAL ERROR awarding point to "${participantName}":`, error.message);
    console.error(`      Error details:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Update a specific entry's medal_points directly
 * @param {string} entryId - UUID of entry to update
 * @param {number} totalPoints - New total points
 * @param {string} medalLevel - New medal level
 * @returns {Object} - Success status
 */
const updateEntryMedalPointsDirectly = async (entryId, totalPoints, medalLevel) => {
  try {
    console.log(`      🔄 DB UPDATE: entries SET medal_points=${totalPoints}, current_medal_level='${medalLevel}' WHERE id=${entryId}`);
    const { error } = await supabase
      .from('entries')
      .update({
        medal_points: totalPoints,
        current_medal_level: medalLevel
      })
      .eq('id', entryId);

    if (error) {
      console.error(`      ❌ DB ERROR updating entry ${entryId}:`, error.message, error.code);
      return { success: false, error: error.message };
    }

    console.log(`      ✅ Entry ${entryId} updated: medal_points=${totalPoints}, current_medal_level=${medalLevel}`);
    return { success: true };
  } catch (error) {
    console.error(`      ❌ Exception in updateEntryMedalPointsDirectly:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Update solo entries' medal_points when a group member wins
 * Finds all solo entries matching the participant name and awards them 1 point
 * @param {string} participantName - Name of the group member
 * @param {string} competitionId - UUID of competition (to search within same competition)
 * @returns {Object} - Success status with count of updated entries
 */
const updateSoloEntryMedalPoints = async (participantName, competitionId) => {
  try {
    const normalizedName = participantName.trim();
    
    if (!normalizedName) {
      console.log(`      ⚠️ Empty participant name, skipping solo entry update`);
      return { success: true, updated: 0 };
    }

    console.log(`      🔍 Searching for solo entries for: "${normalizedName}"`);

    // Find all solo entries with this competitor name in the same competition
    // Solo entries are those where dance_type contains "Solo" or doesn't contain "Group"
    const { data: soloEntries, error: searchError } = await supabase
      .from('entries')
      .select('id, entry_number, competitor_name, medal_points, current_medal_level, dance_type, is_medal_program')
      .eq('competition_id', competitionId)
      .eq('competitor_name', normalizedName)
      .eq('is_medal_program', true);

    if (searchError) {
      console.error(`      ⚠️ Error searching for solo entries: ${searchError.message}`);
      return { success: false, error: searchError.message, updated: 0 };
    }

    if (!soloEntries || soloEntries.length === 0) {
      console.log(`      ℹ️ No solo entries found for "${normalizedName}" (this is OK - they may only compete in groups)`);
      return { success: true, updated: 0 };
    }

    // Filter to only actual solo entries (not groups)
    const actualSolos = soloEntries.filter(entry => {
      const divisionType = entry.dance_type || '';
      const isSolo = divisionType.toLowerCase().includes('solo') || 
                     (!divisionType.toLowerCase().includes('group') && 
                      !divisionType.toLowerCase().includes('duo') && 
                      !divisionType.toLowerCase().includes('trio') &&
                      !divisionType.toLowerCase().includes('production'));
      return isSolo;
    });

    if (actualSolos.length === 0) {
      console.log(`      ℹ️ No actual solo entries found for "${normalizedName}" (only group entries exist)`);
      return { success: true, updated: 0 };
    }

    console.log(`      ✅ Found ${actualSolos.length} solo entry/entries for "${normalizedName}"`);

    // Get participant's current total points (already updated by awardPointToParticipant)
    const { data: participant, error: participantError } = await supabase
      .from('medal_participants')
      .select('total_points, current_medal_level')
      .eq('participant_name', normalizedName)
      .maybeSingle();

    if (participantError || !participant) {
      console.log(`      ⚠️ Could not find participant record for "${normalizedName}", using entry points + 1`);
    }

    // Update each solo entry to match participant's total
    let updatedCount = 0;
    for (const soloEntry of actualSolos) {
      const currentPoints = soloEntry.medal_points || 0;
      
      // Use participant's total if available, otherwise add 1 to entry's current
      const newPoints = participant ? participant.total_points : (currentPoints + 1);
      const medalLevel = participant ? participant.current_medal_level : (
        newPoints >= 50 ? 'Gold' : 
        newPoints >= 35 ? 'Silver' : 
        newPoints >= 25 ? 'Bronze' : 'None'
      );

      const { error: updateError } = await supabase
        .from('entries')
        .update({
          medal_points: newPoints,
          current_medal_level: medalLevel
        })
        .eq('id', soloEntry.id);

      if (updateError) {
        console.error(`      ⚠️ Error updating solo entry ${soloEntry.id}: ${updateError.message}`);
      } else {
        const entryLabel = soloEntry.entry_number ? `#${soloEntry.entry_number}` : `ID:${soloEntry.id}`;
        console.log(`      ✅ Updated solo entry ${entryLabel}: ${currentPoints} → ${newPoints} points (${medalLevel})`);
        updatedCount++;
      }
    }

    return { success: true, updated: updatedCount };
  } catch (error) {
    console.error(`      ⚠️ Error in updateSoloEntryMedalPoints: ${error.message}`);
    return { success: false, error: error.message, updated: 0 };
  }
};

/**
 * Award medal points for a single entry (handles solos and groups)
 * @param {Object} entry - Entry object with name and group_members
 * @param {string} competitionId - UUID of competition
 * @returns {Object} - Success status with awards details
 */
export const awardMedalPointsForEntry = async (entry, competitionId) => {
  try {
    const entryName = entry.competitor_name;
    console.log(`   🎯 Processing "${entryName}" (ID: ${entry.id})`);
    const awards = [];

    // Determine if group - check divisionType field (new schema)
    const divisionType = entry.divisionType || entry.division_type || entry.dance_type || 'Solo';
    const isGroup = !divisionType.toLowerCase().includes('solo') && 
                    !divisionType.toLowerCase().includes('duo') &&
                    !divisionType.toLowerCase().includes('trio');
    
    console.log(`      • Division Type: ${divisionType}`);
    console.log(`      • Is Group Entry: ${isGroup}`);
    console.log(`      • Group Members: ${entry.group_members ? entry.group_members.length : 0}`);

    if (isGroup && entry.group_members && entry.group_members.length > 0) {
      console.log(`      📋 GROUP ENTRY: Awarding to ${entry.group_members.length} members`);
      
      // Award point to EACH group member
      let memberIdx = 1;
      let lastParticipant = null; // Track for group entry update
      for (const member of entry.group_members) {
        if (member.name && member.name.trim()) {
          console.log(`\n      👥 Member ${memberIdx}/${entry.group_members.length}: ${member.name}`);
          
          // 1. Award to medal_participants table (existing system)
          const result = await awardPointToParticipant(
            member.name,
            competitionId,
            entry.id
          );
          
          if (result.success) {
            lastParticipant = result.data;
            if (!result.alreadyAwarded) {
              awards.push({
                name: member.name,
                points: result.data.total_points,
                level: result.data.current_medal_level,
                levelUp: result.levelUp || false
              });
              // 2. ALSO update solo entries for this member
              await updateSoloEntryMedalPoints(member.name, competitionId);
            } else {
              console.log(`      ⚠️ Already awarded to ${member.name} (syncing solo entries)`);
              await updateSoloEntryMedalPoints(member.name, competitionId);
            }
          }
          memberIdx++;
        } else {
          console.log(`      ⚠️ Skipping group member with empty name`);
        }
      }
      // 3. Update the GROUP ENTRY's medal_points so scorecard shows points
      if (lastParticipant && entry.is_medal_program) {
        console.log(`      📝 Updating group entry ${entry.id} with ${lastParticipant.total_points} points (${lastParticipant.current_medal_level})`);
        await updateEntryMedalPointsDirectly(entry.id, lastParticipant.total_points, lastParticipant.current_medal_level);
      }
    } else if (divisionType.toLowerCase().includes('duo') || divisionType.toLowerCase().includes('trio')) {
      // Duo/Trio - treat similar to groups
      console.log(`      👥 DUO/TRIO ENTRY`);
      
      if (entry.group_members && entry.group_members.length > 0) {
        console.log(`      📋 Awarding to ${entry.group_members.length} members`);
        let memberIdx = 1;
        let lastParticipant = null;
        for (const member of entry.group_members) {
          if (member.name && member.name.trim()) {
            console.log(`\n      👥 Member ${memberIdx}/${entry.group_members.length}: ${member.name}`);
            const result = await awardPointToParticipant(
              member.name,
              competitionId,
              entry.id
            );
            if (result.success) {
              lastParticipant = result.data;
              if (!result.alreadyAwarded) {
                awards.push({
                  name: member.name,
                  points: result.data.total_points,
                  level: result.data.current_medal_level,
                  levelUp: result.levelUp || false
                });
                await updateSoloEntryMedalPoints(member.name, competitionId);
              } else {
                console.log(`      ⚠️ Already awarded to ${member.name} (syncing solo entries)`);
                await updateSoloEntryMedalPoints(member.name, competitionId);
              }
            }
            memberIdx++;
          }
        }
        // Update the DUO/TRIO entry's medal_points so scorecard shows points
        if (lastParticipant && entry.is_medal_program) {
          console.log(`      📝 Updating duo/trio entry ${entry.id} with ${lastParticipant.total_points} points (${lastParticipant.current_medal_level})`);
          await updateEntryMedalPointsDirectly(entry.id, lastParticipant.total_points, lastParticipant.current_medal_level);
        }
      } else {
        // Fallback to competitor_name if no group_members
        console.log(`      ⚠️ No group_members defined, awarding to entry name`);
        const result = await awardPointToParticipant(
          entryName,
          competitionId,
          entry.id
        );
        if (result.success) {
          if (!result.alreadyAwarded) {
            awards.push({
              name: entryName,
              points: result.data.total_points,
              level: result.data.current_medal_level,
              levelUp: result.levelUp || false
            });
          }
          // Update entry for duo/trio without group_members (fallback)
          if (entry.is_medal_program) {
            await updateEntryMedalPointsDirectly(entry.id, result.data.total_points, result.data.current_medal_level);
          }
        }
      }
    } else {
      // Award point to solo performer
      console.log(`      👤 SOLO ENTRY: "${entryName}"`);
      
      const result = await awardPointToParticipant(
        entryName,
        competitionId,
        entry.id
      );
      if (result.success) {
        if (!result.alreadyAwarded) {
          awards.push({
            name: entryName,
            points: result.data.total_points,
            level: result.data.current_medal_level,
            levelUp: result.levelUp || false
          });
        }
        // ALWAYS update solo entry's medal_points (handles alreadyAwarded sync if previous update failed)
        if (entry.is_medal_program && result.data) {
          console.log(`      📝 Updating solo entry ${entry.id}: ${result.data.total_points} points (${result.data.current_medal_level})${result.alreadyAwarded ? ' [sync from participant]' : ''}`);
          await updateEntryMedalPointsDirectly(entry.id, result.data.total_points, result.data.current_medal_level);
        }
        if (result.alreadyAwarded) {
          console.log(`      ⚠️ Points already awarded to ${entryName} - entry synced with participant total`);
        }
      }
    }

    console.log(`   ✅ Awards for this entry: ${awards.length}`);
    return { success: true, awards };
  } catch (error) {
    console.error(`   ❌ ERROR awarding medal points for entry:`, error.message);
    console.error(`   Error details:`, error);
    return { success: false, error: error.message, awards: [] };
  }
};

/**
 * Award medal points for all 1st place medal program entries in a competition
 * @param {string} competitionId - UUID of competition
 * @returns {Object} - Success status with summary
 */
export const awardMedalPointsForCompetition = async (competitionId) => {
  try {
    console.log('🏅 ========================================');
    console.log('🏅 MEDAL POINTS AWARD PROCESS STARTING');
    console.log('🏅 ========================================');
    console.log(`📋 Competition ID: ${competitionId}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

    // Get all medal program entries with their scores
    console.log('\n🔍 Step 1: Fetching medal program entries...');
    console.log('📋 Query: SELECT id, competitor_name, dance_type, is_medal_program, group_members, category_id, age_division_id, ability_level FROM entries WHERE competition_id = ? AND is_medal_program = true');
    
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select(`
        id,
        competitor_name,
        dance_type,
        is_medal_program,
        group_members,
        category_id,
        age_division_id,
        ability_level
      `)
      .eq('competition_id', competitionId)
      .eq('is_medal_program', true);

    if (entriesError) {
      console.error('❌ ERROR fetching entries:', entriesError);
      console.error('❌ Error code:', entriesError.code);
      console.error('❌ Error message:', entriesError.message);
      console.error('❌ Error details:', JSON.stringify(entriesError, null, 2));
      throw entriesError;
    }

    console.log(`📊 Total medal program entries found: ${entries?.length || 0}`);
    
    if (entries && entries.length > 0) {
      console.log('📋 Sample entry structure:', {
        id: entries[0].id,
        competitor_name: entries[0].competitor_name,
        dance_type: entries[0].dance_type,
        has_group_members: !!entries[0].group_members,
        is_medal_program: entries[0].is_medal_program
      });
    }

    if (!entries || entries.length === 0) {
      console.log('⚠️ WARNING: No medal program entries found');
      console.log('💡 TIP: Make sure entries have is_medal_program = true');
      return { 
        success: true, 
        message: 'No medal program entries found', 
        totalAwarded: 0,
        firstPlaceCount: 0
      };
    }

    // Log sample entry for debugging
    console.log('\n📝 Sample entry structure:');
    console.log(JSON.stringify(entries[0], null, 2));

    // Get all scores for these entries
    console.log('\n🔍 Step 2: Fetching scores...');
    const { data: allScores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .eq('competition_id', competitionId);

    if (scoresError) {
      console.error('❌ ERROR fetching scores:', scoresError);
      console.error('❌ Error details:', JSON.stringify(scoresError, null, 2));
      throw scoresError;
    }

    console.log(`📈 Total scores found: ${allScores?.length || 0}`);

    if (!allScores || allScores.length === 0) {
      console.log('⚠️ WARNING: No scores found for this competition');
      console.log('💡 TIP: Judges must score entries before awarding points');
      return {
        success: false,
        error: 'No scores found. Please ensure judges have scored the competition.',
        totalAwarded: 0,
        firstPlaceCount: 0
      };
    }

    // Calculate average score for each entry
    console.log('\n📊 Step 3: Calculating average scores...');
    const entriesWithScores = entries.map(entry => {
      const entryScores = allScores.filter(s => s.entry_id === entry.id);
      
      if (entryScores.length === 0) {
        console.log(`   ⚠️ No scores for: ${entry.competitor_name}`);
        return { ...entry, averageScore: 0, hasScores: false };
      }

      const total = entryScores.reduce((sum, score) => sum + (score.total_score || 0), 0);
      const averageScore = total / entryScores.length;
      
      console.log(`   📊 "${entry.competitor_name}": ${entryScores.length} judge(s), avg: ${averageScore.toFixed(2)}`);
      
      return { ...entry, averageScore, hasScores: true };
    });

    // Filter out entries without scores
    const scoredEntries = entriesWithScores.filter(e => e.hasScores && e.averageScore > 0);
    console.log(`   ✅ Entries with valid scores: ${scoredEntries.length}`);

    if (scoredEntries.length === 0) {
      console.log('⚠️ WARNING: No entries have scores');
      return {
        success: false,
        error: 'No scored entries found. Please ensure judges have completed scoring.',
        totalAwarded: 0,
        firstPlaceCount: 0
      };
    }

    // Get categories to check for special categories
    console.log('\n🔍 Step 3.5: Fetching categories to filter special categories...');
    const { data: allCategories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, is_special_category, type')
      .eq('competition_id', competitionId);

    if (categoriesError) {
      console.error('⚠️ Warning: Could not fetch categories:', categoriesError);
    }

    // Helper function to check if category is special
    const isSpecialCategory = (categoryId) => {
      if (!allCategories) return false;
      const category = allCategories.find(c => c.id === categoryId);
      if (!category) return false;
      const categoryName = category.name || '';
      return categoryName === 'Production' || 
             categoryName === 'Student Choreography' || 
             categoryName === 'Teacher/Student' ||
             category.is_special_category === true ||
             category.type === 'special';
    };

    // Filter out special categories BEFORE grouping
    console.log('\n🚫 Filtering out special categories from medal points...');
    const eligibleEntries = scoredEntries.filter(entry => {
      const isSpecial = isSpecialCategory(entry.category_id);
      if (isSpecial) {
        console.log(`   ⚠️ Excluding special category entry: "${entry.competitor_name}" (${entry.category_id})`);
      }
      return !isSpecial;
    });

    console.log(`   ✅ Eligible entries for medal points: ${eligibleEntries.length} (excluded ${scoredEntries.length - eligibleEntries.length} special category entries)`);

    if (eligibleEntries.length === 0) {
      console.log('⚠️ WARNING: No eligible entries after filtering special categories');
      return {
        success: true,
        message: 'No eligible entries for medal points (all entries are in special categories)',
        totalAwarded: 0,
        firstPlaceCount: 0
      };
    }

    // Group by category/age/ability/divisionType to determine 1st place
    console.log('\n🎯 Step 4: Grouping entries by category combination...');
    const groupedEntries = {};
    
    for (const entry of eligibleEntries) {
      const divisionType = entry.divisionType || entry.division_type || entry.dance_type || 'Solo';
      const key = `${entry.category_id}_${entry.age_division_id}_${entry.ability_level}_${divisionType}`;
      
      if (!groupedEntries[key]) {
        groupedEntries[key] = {
          category_id: entry.category_id,
          age_division_id: entry.age_division_id,
          ability_level: entry.ability_level,
          divisionType: divisionType,
          entries: []
        };
      }
      
      groupedEntries[key].entries.push(entry);
    }

    const groupCount = Object.keys(groupedEntries).length;
    console.log(`   🎯 Total groups formed: ${groupCount}`);
    
    // Log each group
    let groupIdx = 1;
    for (const key in groupedEntries) {
      const group = groupedEntries[key];
      console.log(`   Group ${groupIdx}/${groupCount}: ${group.entries.length} entries (${group.divisionType}, ${group.ability_level})`);
      groupIdx++;
    }

    // Find 1st place in each group
    console.log('\n🏆 Step 5: Identifying 1st place winners...');
    const firstPlaceEntries = [];
    let winnerIdx = 1;
    
    for (const key in groupedEntries) {
      const group = groupedEntries[key];
      console.log(`\n   🏆 Group ${winnerIdx}/${groupCount}: ${group.entries.length} competitors (key: ${key})`);
      
      // Sort by score descending
      group.entries.sort((a, b) => b.averageScore - a.averageScore);
      
      // First entry is 1st place
      if (group.entries.length > 0) {
        const winner = group.entries[0];
        const winnerName = winner.competitor_name;
        console.log(`      🥇 1st Place: "${winnerName}" (Entry ID: ${winner.id}) - Score: ${winner.averageScore.toFixed(2)}`);
        console.log(`         • is_medal_program: ${winner.is_medal_program}`);
        console.log(`         • Category: ${winner.category_id}`);
        console.log(`         • Age Division: ${winner.age_division_id}`);
        console.log(`         • Ability: ${winner.ability_level}`);
        console.log(`         • Division Type: ${group.divisionType}`);
        console.log(`         • Is Group: ${!group.divisionType.toLowerCase().includes('solo')}`);
        if (winner.group_members && winner.group_members.length > 0) {
          console.log(`         • Group Members: ${winner.group_members.length}`);
          winner.group_members.forEach((m, idx) => {
            console.log(`            ${idx + 1}. ${m.name} (age ${m.age || 'N/A'})`);
          });
        }
        firstPlaceEntries.push(winner);
      }
      
      winnerIdx++;
    }

    console.log(`\n   ✅ Total 1st place winners: ${firstPlaceEntries.length}`);

    if (firstPlaceEntries.length === 0) {
      console.log('⚠️ WARNING: No 1st place winners identified');
      return {
        success: false,
        error: 'No 1st place winners found.',
        totalAwarded: 0,
        firstPlaceCount: 0
      };
    }

    // Award points for each first place entry
    console.log('\n💎 Step 6: AWARDING MEDAL POINTS');
    console.log('═════════════════════════════════════════════════');
    let totalParticipantsAwarded = 0;
    let totalPointsDistributed = 0;
    const awardSummary = [];

    for (const entry of firstPlaceEntries) {
      const entryName = entry.competitor_name;
      console.log(`\n🎖️ Processing entry: "${entryName}"`);
      console.log(`   Entry ID: ${entry.id}`);
      
      const result = await awardMedalPointsForEntry(entry, competitionId);
      
      if (result.success && result.awards && result.awards.length > 0) {
        totalParticipantsAwarded += result.awards.length;
        totalPointsDistributed += result.awards.length; // 1 point per award
        awardSummary.push({
          entry: entryName,
          awards: result.awards
        });
        console.log(`   ✅ Successfully awarded ${result.awards.length} participant(s):`);
        result.awards.forEach((award, idx) => {
          console.log(`      ${idx + 1}. ${award.name}: Now ${award.points} total points (${award.level})`);
        });
      } else if (result.success && (!result.awards || result.awards.length === 0)) {
        console.log(`   ⚠️ No NEW awards given (points may have already been awarded)`);
      } else {
        console.log(`   ❌ ERROR awarding points: ${result.error || 'Unknown error'}`);
      }
    }

    console.log('\n🏅 ========================================');
    console.log(`✅ AWARD PROCESS COMPLETE!`);
    console.log(`   • Participants awarded: ${totalParticipantsAwarded}`);
    console.log(`   • Total points distributed: ${totalPointsDistributed}`);
    console.log(`   • First-place entries: ${firstPlaceEntries.length}`);
    console.log('🏅 ========================================\n');

    return {
      success: true,
      totalAwarded: totalParticipantsAwarded,
      firstPlaceCount: firstPlaceEntries.length,
      summary: awardSummary
    };
  } catch (error) {
    console.error('❌ ========================================');
    console.error('❌ CRITICAL ERROR awarding medal points:', error);
    console.error('❌ ========================================');
    return { success: false, error: error.message };
  }
};

/**
 * Reset medal points for all entries in a competition (for test competitions)
 * Sets medal_points=0 and current_medal_level='None' for medal program entries.
 * Also deletes medal_awards for this competition so re-awarding works.
 * @param {string} competitionId - UUID of competition
 * @returns {Object} - Success status with resetCount
 */
export const resetMedalPointsForCompetition = async (competitionId) => {
  try {
    // 1. Delete medal_awards for this competition (allows re-awarding)
    const { error: deleteError } = await supabase
      .from('medal_awards')
      .delete()
      .eq('competition_id', competitionId);

    if (deleteError) {
      console.error('Error deleting medal_awards:', deleteError);
      throw deleteError;
    }

    // 2. Reset entries: medal_points=0, current_medal_level='None'
    const { data: updatedEntries, error: updateError } = await supabase
      .from('entries')
      .update({ medal_points: 0, current_medal_level: 'None' })
      .eq('competition_id', competitionId)
      .eq('is_medal_program', true)
      .select('id');

    if (updateError) {
      console.error('Error resetting entries:', updateError);
      throw updateError;
    }

    const resetCount = updatedEntries?.length || 0;
    console.log(`✅ Reset medal points for ${resetCount} entries in competition ${competitionId}`);
    return { success: true, resetCount };
  } catch (error) {
    console.error('Error resetting medal points:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get season leaderboard (top participants)
 * @param {number} limit - Number of participants to return (default 20)
 * @returns {Object} - Leaderboard data
 */
export const getSeasonLeaderboard = async (limit = 20) => {
  try {
    const { data, error } = await supabase
      .from('medal_participants')
      .select('*')
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Calculate points to next level for each participant
    const leaderboard = data.map((participant, index) => {
      let pointsToNext = 0;
      let nextLevel = '';

      if (participant.current_medal_level === 'None') {
        pointsToNext = 25 - participant.total_points;
        nextLevel = 'Bronze';
      } else if (participant.current_medal_level === 'Bronze') {
        pointsToNext = 35 - participant.total_points;
        nextLevel = 'Silver';
      } else if (participant.current_medal_level === 'Silver') {
        pointsToNext = 50 - participant.total_points;
        nextLevel = 'Gold';
      } else {
        pointsToNext = 0;
        nextLevel = 'Gold (Max)';
      }

      return {
        ...participant,
        rank: index + 1,
        pointsToNext,
        nextLevel
      };
    });

    return { success: true, data: leaderboard };
  } catch (error) {
    console.error('❌ Error fetching season leaderboard:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get medal awards for a specific competition
 * @param {string} competitionId - UUID of competition
 * @returns {Object} - Awards data
 */
export const getCompetitionMedalAwards = async (competitionId) => {
  try {
    const { data, error } = await supabase
      .from('medal_awards')
      .select(`
        *,
        entries (
          competitor_name,
          dance_type,
          category_id,
          age_division_id
        )
      `)
      .eq('competition_id', competitionId)
      .order('awarded_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('❌ Error fetching competition medal awards:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get participant details including all their awards
 * @param {string} participantName - Name of participant
 * @returns {Object} - Participant data with awards history
 */
export const getParticipantDetails = async (participantName) => {
  try {
    const { data: participant, error: participantError } = await supabase
      .from('medal_participants')
      .select('*')
      .eq('participant_name', participantName)
      .single();

    if (participantError) throw participantError;

    const { data: awards, error: awardsError } = await supabase
      .from('medal_awards')
      .select(`
        *,
        entries (
          competitor_name,
          dance_type
        ),
        competitions (
          name,
          date
        )
      `)
      .eq('participant_name', participantName)
      .order('awarded_at', { ascending: false });

    if (awardsError) throw awardsError;

    return {
      success: true,
      data: {
        ...participant,
        awards
      }
    };
  } catch (error) {
    console.error('❌ Error fetching participant details:', error);
    return { success: false, error: error.message };
  }
};




