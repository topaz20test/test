import * as XLSX from 'xlsx';

/**
 * Export comprehensive competition data to Excel with multiple sheets
 */
export const exportComprehensiveExcel = async (
  competition,
  categories,
  ageDivisions,
  entries,
  scores,
  rankings,
  medalData = null
) => {
  try {
    const workbook = XLSX.utils.book_new();
    
    // ============================================================================
    // SHEET 1: Competition Info
    // ============================================================================
    const competitionInfo = [
      ['TOPAZ 2.0 Competition Results - Complete Export'],
      [''],
      ['COMPETITION INFORMATION'],
      [''],
      ['Competition Name:', competition.name || 'N/A'],
      ['Date:', competition.date ? new Date(competition.date).toLocaleDateString() : 'N/A'],
      ['Venue:', competition.venue || 'N/A'],
      ['Number of Judges:', competition.judges_count || 'N/A'],
      [''],
      ['JUDGES'],
      ['Judge Number', 'Judge Name']
    ];
    
    // Add judge names
    const judgeNames = competition.judge_names || [];
    for (let i = 0; i < (competition.judges_count || 0); i++) {
      competitionInfo.push([
        i + 1,
        judgeNames[i] || `Judge ${i + 1}`
      ]);
    }
    
    competitionInfo.push(['']);
    competitionInfo.push(['CATEGORIES']);
    competitionInfo.push(['Category Name', 'Variety Level', 'Special Category']);
    
    categories.forEach(cat => {
      const parts = cat.name.split(' - ');
      const categoryName = parts[0];
      const varietyLevel = parts[1] || 'None';
      competitionInfo.push([
        categoryName,
        varietyLevel,
        cat.is_special_category ? 'Yes' : 'No'
      ]);
    });
    
    competitionInfo.push(['']);
    competitionInfo.push(['AGE DIVISIONS']);
    competitionInfo.push(['Division Name', 'Min Age', 'Max Age']);
    
    ageDivisions.forEach(div => {
      competitionInfo.push([
        div.name,
        div.min_age || 'N/A',
        div.max_age || 'N/A'
      ]);
    });
    
    competitionInfo.push(['']);
    competitionInfo.push(['EXPORT INFORMATION']);
    competitionInfo.push(['Generated:', new Date().toLocaleString()]);
    competitionInfo.push(['Total Entries:', entries.length]);
    competitionInfo.push(['Total Scores:', scores.length]);
    competitionInfo.push(['Total Categories:', categories.length]);
    competitionInfo.push(['Total Age Divisions:', ageDivisions.length]);
    
    const competitionSheet = XLSX.utils.aoa_to_sheet(competitionInfo);
    competitionSheet['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, competitionSheet, 'Competition Info');
    
    // ============================================================================
    // SHEET 2: All Entries
    // ============================================================================
    const entriesData = entries.map(entry => {
      const category = categories.find(c => c.id === entry.category_id);
      const ageDivision = ageDivisions.find(d => d.id === entry.age_division_id);
      
      // Parse group members
      let groupMembers = '';
      if (entry.group_members && Array.isArray(entry.group_members)) {
        groupMembers = entry.group_members
          .map(m => m.age ? `${m.name} (age ${m.age})` : m.name)
          .join('; ');
      }
      
      return {
        'Entry Number': entry.entry_number,
        'Competitor Name': entry.competitor_name,
        'Age': entry.age || 'N/A',
        'Category': category ? category.name : 'Unknown',
        'Age Division': ageDivision ? ageDivision.name : 'N/A',
        'Ability Level': entry.ability_level || 'N/A',
        'Division Type': entry.dance_type || 'N/A',
        'Studio Name': entry.studio_name || '',
        'Teacher Name': entry.teacher_name || '',
        'Is Medal Program': entry.is_medal_program ? 'Yes' : 'No',
        'Medal Points': entry.is_medal_program ? (entry.medal_points || 0) : 'N/A',
        'Current Medal Level': entry.is_medal_program ? (entry.current_medal_level || 'None') : 'N/A',
        'Group Members': groupMembers,
        'Photo URL': entry.photo_url || '',
        'Entry ID': entry.id
      };
    });
    
    const entriesSheet = XLSX.utils.json_to_sheet(entriesData);
    entriesSheet['!cols'] = [
      { wch: 12 }, // Entry Number
      { wch: 30 }, // Competitor Name
      { wch: 8 },  // Age
      { wch: 25 }, // Category
      { wch: 20 }, // Age Division
      { wch: 15 }, // Ability Level
      { wch: 20 }, // Division Type
      { wch: 25 }, // Studio Name
      { wch: 25 }, // Teacher Name
      { wch: 15 }, // Is Medal Program
      { wch: 12 }, // Medal Points
      { wch: 15 }, // Current Medal Level
      { wch: 50 }, // Group Members
      { wch: 60 }, // Photo URL
      { wch: 36 }  // Entry ID
    ];
    XLSX.utils.book_append_sheet(workbook, entriesSheet, 'All Entries');
    
    // ============================================================================
    // SHEET 3: All Scores
    // ============================================================================
    const scoresData = scores.map(score => {
      const entry = entries.find(e => e.id === score.entry_id);
      const judgeName = competition.judge_names?.[score.judge_number - 1] || `Judge ${score.judge_number}`;
      
      return {
        'Entry Number': entry ? entry.entry_number : 'N/A',
        'Entry Name': entry ? entry.competitor_name : 'N/A',
        'Judge Number': score.judge_number,
        'Judge Name': judgeName,
        'Technique': score.technique,
        'Creativity': score.creativity,
        'Presentation': score.presentation,
        'Appearance': score.appearance,
        'Total Score': score.total_score,
        'Notes': score.notes || '',
        'Score ID': score.id,
        'Entry ID': score.entry_id
      };
    });
    
    const scoresSheet = XLSX.utils.json_to_sheet(scoresData);
    scoresSheet['!cols'] = [
      { wch: 12 }, // Entry Number
      { wch: 30 }, // Entry Name
      { wch: 12 }, // Judge Number
      { wch: 25 }, // Judge Name
      { wch: 12 }, // Technique
      { wch: 12 }, // Creativity
      { wch: 15 }, // Presentation
      { wch: 12 }, // Appearance
      { wch: 12 }, // Total Score
      { wch: 50 }, // Notes
      { wch: 36 }, // Score ID
      { wch: 36 }  // Entry ID
    ];
    XLSX.utils.book_append_sheet(workbook, scoresSheet, 'All Scores');
    
    // ============================================================================
    // SHEET 4: Rankings by Division
    // ============================================================================
    const rankingsData = rankings.map((entry, index) => {
      const category = categories.find(c => c.id === entry.category_id);
      const ageDivision = ageDivisions.find(d => d.id === entry.age_division_id);
      const entryScores = scores.filter(s => s.entry_id === entry.id);
      const avgScore = entryScores.length > 0
        ? entryScores.reduce((sum, s) => sum + s.total_score, 0) / entryScores.length
        : 0;
      
      return {
        'Rank': index + 1,
        'Entry Number': entry.entry_number,
        'Competitor Name': entry.competitor_name,
        'Average Score': avgScore.toFixed(2),
        'Category': category ? category.name : 'Unknown',
        'Age Division': ageDivision ? ageDivision.name : 'N/A',
        'Ability Level': entry.ability_level || 'N/A',
        'Division Type': entry.dance_type || 'N/A',
        'Age': entry.age || 'N/A',
        'Studio Name': entry.studio_name || '',
        'Total Judges': entryScores.length
      };
    });
    
    const rankingsSheet = XLSX.utils.json_to_sheet(rankingsData);
    rankingsSheet['!cols'] = [
      { wch: 8 },  // Rank
      { wch: 12 }, // Entry Number
      { wch: 30 }, // Competitor Name
      { wch: 15 }, // Average Score
      { wch: 25 }, // Category
      { wch: 20 }, // Age Division
      { wch: 15 }, // Ability Level
      { wch: 20 }, // Division Type
      { wch: 8 },  // Age
      { wch: 25 }, // Studio Name
      { wch: 12 }  // Total Judges
    ];
    XLSX.utils.book_append_sheet(workbook, rankingsSheet, 'Rankings');
    
    // ============================================================================
    // SHEET 5: Medal Points (if applicable)
    // ============================================================================
    if (medalData && medalData.length > 0) {
      const medalPointsData = medalData.map(participant => ({
        'Participant Name': participant.participant_name || participant.name,
        'Total Points': participant.total_points || 0,
        'Current Medal Level': participant.current_medal_level || 'None',
        'Rank': participant.rank || 'N/A'
      }));
      
      const medalSheet = XLSX.utils.json_to_sheet(medalPointsData);
      medalSheet['!cols'] = [
        { wch: 30 }, // Participant Name
        { wch: 12 }, // Total Points
        { wch: 15 }, // Current Medal Level
        { wch: 8 }   // Rank
      ];
      XLSX.utils.book_append_sheet(workbook, medalSheet, 'Medal Points');
    }
    
    // ============================================================================
    // Generate filename and save
    // ============================================================================
    const competitionName = (competition.name || 'Competition')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    const fileName = `${competitionName} - Complete Results.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
    
    return { success: true, fileName };
  } catch (error) {
    console.error('Comprehensive Excel export error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Export competition data to JSON format for website integration
 */
export const exportToJSON = (
  competition,
  categories,
  ageDivisions,
  entries,
  scores,
  rankings,
  medalData = null
) => {
  try {
    // Build complete JSON structure
    const exportData = {
      export_info: {
        version: '1.0',
        generated_at: new Date().toISOString(),
        competition_id: competition.id,
        competition_name: competition.name
      },
      competition: {
        id: competition.id,
        name: competition.name,
        date: competition.date,
        venue: competition.venue,
        judges_count: competition.judges_count,
        judge_names: competition.judge_names || [],
        status: competition.status,
        created_at: competition.created_at,
        updated_at: competition.updated_at
      },
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        is_special_category: cat.is_special_category,
        competition_id: cat.competition_id
      })),
      age_divisions: ageDivisions.map(div => ({
        id: div.id,
        name: div.name,
        min_age: div.min_age,
        max_age: div.max_age,
        description: div.description,
        competition_id: div.competition_id
      })),
      entries: entries.map(entry => ({
        id: entry.id,
        entry_number: entry.entry_number,
        competitor_name: entry.competitor_name,
        age: entry.age,
        category_id: entry.category_id,
        age_division_id: entry.age_division_id,
        ability_level: entry.ability_level,
        dance_type: entry.dance_type,
        studio_name: entry.studio_name,
        teacher_name: entry.teacher_name,
        is_medal_program: entry.is_medal_program,
        medal_points: entry.medal_points,
        current_medal_level: entry.current_medal_level,
        group_members: entry.group_members,
        photo_url: entry.photo_url,
        created_at: entry.created_at,
        updated_at: entry.updated_at
      })),
      scores: scores.map(score => ({
        id: score.id,
        entry_id: score.entry_id,
        judge_number: score.judge_number,
        technique: score.technique,
        creativity: score.creativity,
        presentation: score.presentation,
        appearance: score.appearance,
        total_score: score.total_score,
        notes: score.notes,
        created_at: score.created_at,
        updated_at: score.updated_at
      })),
      rankings: rankings.map((entry, index) => {
        const entryScores = scores.filter(s => s.entry_id === entry.id);
        const avgScore = entryScores.length > 0
          ? entryScores.reduce((sum, s) => sum + s.total_score, 0) / entryScores.length
          : 0;
        
        return {
          rank: index + 1,
          entry_id: entry.id,
          entry_number: entry.entry_number,
          competitor_name: entry.competitor_name,
          average_score: parseFloat(avgScore.toFixed(2)),
          category_id: entry.category_id,
          age_division_id: entry.age_division_id,
          ability_level: entry.ability_level,
          division_type: entry.division_type || entry.dance_type
        };
      })
    };
    
    // Add medal data if available
    if (medalData && medalData.length > 0) {
      exportData.medal_points = medalData.map(participant => ({
        participant_name: participant.participant_name || participant.name,
        total_points: participant.total_points || 0,
        current_medal_level: participant.current_medal_level || 'None',
        rank: participant.rank || null
      }));
    }
    
    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const competitionName = (competition.name || 'Competition')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    link.download = `${competitionName} - Data Export.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return { success: true, fileName: `${competitionName} - Data Export.json` };
  } catch (error) {
    console.error('JSON export error:', error);
    return { success: false, error: error.message };
  }
};

