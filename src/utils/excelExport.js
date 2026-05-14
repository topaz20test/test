import * as XLSX from 'xlsx';

export const exportResultsToExcel = (entries, allScores, competition, categories, ageDivisions) => {
  try {
    // Prepare data for Excel
    const excelData = entries.map(entry => {
      // Get category info
      const category = categories.find(c => c.id === entry.category_id);
      const categoryName = category ? category.name : 'Unknown';
      
      // Parse variety level from category description
      let varietyLevel = 'None';
      if (category && category.description) {
        const match = category.description.match(/\| (.+)$/);
        if (match) {
          varietyLevel = match[1];
        }
      }
      
      // Get age division info
      const ageDivision = ageDivisions.find(d => d.id === entry.age_division_id);
      const ageDivisionName = ageDivision ? ageDivision.name : 'N/A';
      
      // Get ability level info
      const abilityLevel = entry.ability_level || 'N/A';
      const abilityDescription = {
        'Beginning': 'Beginning (Less than 2 years)',
        'Intermediate': 'Intermediate (2-4 years)',
        'Advanced': 'Advanced (5+ years)'
      };
      const abilityLevelFull = abilityLevel !== 'N/A' ? abilityDescription[abilityLevel] || abilityLevel : 'N/A';
      
      // Parse entry type and division type from dance_type
      let entryType = 'Solo';
      let divisionType = 'Solo';
      let isMedalProgram = 'No';
      let groupMembers = '';
      
      if (entry.dance_type) {
        // Division type (first part before |)
        const divisionMatch = entry.dance_type.match(/^([^|]+)/);
        if (divisionMatch) {
          divisionType = divisionMatch[1].trim();
        }
        
        // Entry type (group or solo)
        if (entry.dance_type.includes('group')) {
          entryType = 'Group';
        }
        
        // Medal program
        if (entry.dance_type.includes('Medal: true')) {
          isMedalProgram = 'Yes';
        }
        
        // Group members
        const membersMatch = entry.dance_type.match(/Members: (\[.*?\])/);
        if (membersMatch) {
          try {
            const members = JSON.parse(membersMatch[1]);
            groupMembers = members.map(m => {
              return m.age ? `${m.name} (${m.age})` : m.name;
            }).join(', ');
          } catch (e) {
            console.error('Error parsing group members:', e);
          }
        }
      }
      
      // Get all scores for this entry
      const entryScores = allScores.filter(s => s.entry_id === entry.id);
      
      // Calculate average
      const avgScore = entryScores.length > 0
        ? entryScores.reduce((sum, s) => sum + s.total_score, 0) / entryScores.length
        : 0;
      
      // Build row object
      const row = {
        'Entry Number': entry.entry_number,
        'Name': entry.competitor_name,
        'Age': entry.age || 'N/A',
        'Type': entryType,
        'Studio Name': entry.studio_name || '',
        'Teacher/Choreographer': entry.teacher_name || '',
        'Category': categoryName,
        'Variety Level': varietyLevel,
        'Age Division': ageDivisionName,
        'Ability Level': abilityLevelFull,
        'Division Type': divisionType,
        'Medal Program': isMedalProgram,
        'Medal Points': isMedalProgram === 'Yes' ? (entry.medal_points || 0) : 'N/A',
        'Medal Level': isMedalProgram === 'Yes' ? (entry.current_medal_level || 'None') : 'N/A'
      };
      
      // Add each judge's scores
      entryScores.forEach(score => {
        const judgePrefix = `Judge ${score.judge_number}`;
        row[`${judgePrefix} - Technique`] = score.technique;
        row[`${judgePrefix} - Creativity`] = score.creativity;
        row[`${judgePrefix} - Presentation`] = score.presentation;
        row[`${judgePrefix} - Appearance`] = score.appearance;
        row[`${judgePrefix} - Total`] = score.total_score;
        row[`${judgePrefix} - Notes`] = score.notes || '';
      });
      
      // Add average score
      row['Average Score'] = avgScore.toFixed(2);
      
      // Add overall rank (if available)
      row['Overall Rank'] = entry.rank || 'N/A';
      
      // Add category combination rank (if available) - NEW
      row['Category Combination Rank'] = entry.categoryRank || 'N/A';
      
      // Add group members if applicable
      if (entryType === 'Group') {
        row['Group Members'] = groupMembers;
      }
      
      return row;
    });
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const columnWidths = [
      { wch: 12 }, // Entry Number
      { wch: 25 }, // Name
      { wch: 8 },  // Age
      { wch: 10 }, // Type
      { wch: 25 }, // Studio Name
      { wch: 25 }, // Teacher/Choreographer
      { wch: 20 }, // Category
      { wch: 15 }, // Variety Level
      { wch: 15 }, // Age Division
      { wch: 30 }, // Ability Level
      { wch: 20 }, // Division Type
      { wch: 14 }, // Medal Program
      { wch: 12 }, // Medal Points
      { wch: 12 }, // Medal Level
    ];
    
    // Add widths for judge columns (will be dynamic based on number of judges)
    const maxJudges = Math.max(...entries.map(e => 
      allScores.filter(s => s.entry_id === e.id).length
    ));
    
    for (let i = 0; i < maxJudges; i++) {
      columnWidths.push(
        { wch: 15 }, // Technique
        { wch: 15 }, // Creativity
        { wch: 15 }, // Presentation
        { wch: 15 }, // Appearance
        { wch: 12 }, // Total
        { wch: 40 }  // Notes
      );
    }
    
    columnWidths.push({ wch: 14 }); // Average Score
    columnWidths.push({ wch: 50 }); // Group Members
    
    worksheet['!cols'] = columnWidths;
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    
    // Add a summary sheet
    const summaryData = [
      ['TOPAZ 2.0 Competition Results'],
      [''],
      ['Competition Name:', competition.name || 'N/A'],
      ['Date:', competition.date ? new Date(competition.date).toLocaleDateString() : 'N/A'],
      ['Venue:', competition.venue || 'N/A'],
      ['Number of Judges:', competition.judges_count || 'N/A'],
      ['Total Entries:', entries.length],
      [''],
      ['Generated:', new Date().toLocaleString()],
      [''],
      ['Heritage Since 1972']
    ];
    
    const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWorksheet['!cols'] = [{ wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
    
    // Generate filename
    const competitionName = (competition.name || 'Competition').replace(/\s+/g, '_');
    const date = competition.date 
      ? new Date(competition.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const fileName = `TOPAZ_Results_${competitionName}_${date}.xlsx`;
    
    // Write file
    XLSX.writeFile(workbook, fileName);
    
    return { success: true, fileName };
  } catch (error) {
    console.error('Excel export error:', error);
    return { success: false, error: error.message };
  }
};


