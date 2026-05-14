import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import PhotoUpload from '../components/PhotoUpload';
import PhotoUploadManager from '../components/PhotoUploadManager';
import EmptyState from '../components/EmptyState';
import AbilityBadge from '../components/AbilityBadge';
import { 
  createCompetition, 
  createCategory, 
  createAgeDivision, 
  createEntry,
  bulkCreateCategories,
  bulkCreateAgeDivisions,
  bulkCreateEntries
} from '../supabase';
import { uploadEntryPhoto } from '../supabase/photos';

function CompetitionSetup() {
  const navigate = useNavigate();

  // Logo paths
  const logoPath = '/logo.png';
  const leftImagePath = '/left-dancer.png';
  const rightImagePath = '/right-dancer.png';

  // SECTION 1: Competition Details
  const [competitionName, setCompetitionName] = useState('');
  const [competitionDate, setCompetitionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [venue, setVenue] = useState('');
  const [judgeCount, setJudgeCount] = useState(3);
  const [judgeNames, setJudgeNames] = useState(['', '', '']);
  const [isTestCompetition, setIsTestCompetition] = useState(false);

  const handleJudgeCountChange = (count) => {
    setJudgeCount(count);
    // Resize judgeNames array while preserving existing names
    const newNames = Array.from({ length: count }, (_, i) => judgeNames[i] || '');
    setJudgeNames(newNames);
  };

  const handleJudgeNameChange = (index, name) => {
    const newNames = [...judgeNames];
    newNames[index] = name;
    setJudgeNames(newNames);
  };

  // SECTION 2: Categories (Checkbox selection system with MULTIPLE variety levels)
  // selectedCategories: { categoryName: { selected: true/false, varietyLevels: ['None', 'Variety A', ...] } }
  const [selectedCategories, setSelectedCategories] = useState({});

  // SECTION 3: Age Divisions (FIXED - 4 DIVISIONS)
  const FIXED_AGE_DIVISIONS = [
    { id: 'junior_primary', name: 'Junior Primary', minAge: 3, maxAge: 7, description: 'Junior Primary (3-7 years)' },
    { id: 'junior_advanced', name: 'Junior Advanced', minAge: 8, maxAge: 12, description: 'Junior Advanced (8-12 years)' },
    { id: 'senior_youth', name: 'Senior Youth', minAge: 13, maxAge: 18, description: 'Senior Youth (13-18 years)' },
    { id: 'senior_adult', name: 'Senior Adult', minAge: 19, maxAge: 99, description: 'Senior Adult (19-99 years)' }
  ];

  const getAgeDivisionForAge = (ageValue) => {
    const age = parseInt(ageValue, 10);
    if (!age || Number.isNaN(age)) return null;
    return FIXED_AGE_DIVISIONS.find(div => age >= div.minAge && age <= div.maxAge) || null;
  };


  // SECTION 4: Entries
  const [entries, setEntries] = useState([]);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [currentEntry, setCurrentEntry] = useState({
    type: 'solo', // 'solo' or 'group'
    name: '',
    age: '', // Contestant age
    categoryId: '',
    ageDivisionId: '',
    abilityLevel: 'Beginning',
    divisionType: 'Solo',
    isMedalProgram: true,
    photoFile: null,
    groupMembers: [],
    studioName: '',
    teacherName: ''
  });
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAge, setNewMemberAge] = useState('');
  const [autoSelectedDivision, setAutoSelectedDivision] = useState(null);

  const getLockedEntryAge = () => {
    if (currentEntry.type === 'group') {
      const ages = currentEntry.groupMembers
        .map(m => parseInt(m.age, 10))
        .filter(age => !Number.isNaN(age));
      if (ages.length > 0) return Math.max(...ages);
    }
    return parseInt(currentEntry.age, 10);
  };

  const lockedEntryAge = getLockedEntryAge();
  const lockedAgeDivision = getAgeDivisionForAge(lockedEntryAge);

  // UI State
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Bulk Photo Upload State
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [showPhotoManager, setShowPhotoManager] = useState(false);
  const [savedCompetitionId, setSavedCompetitionId] = useState(null);

  // DANCE CATEGORIES - No variety levels attached
  const DANCE_CATEGORIES = [
    { name: 'Tap', color: 'blue', type: 'dance' },
    { name: 'Jazz', color: 'purple', type: 'dance' },
    { name: 'Ballet', color: 'pink', type: 'dance' },
    { name: 'Lyrical/Contemporary', color: 'teal', type: 'dance' },
    { name: 'Vocal', color: 'yellow', type: 'dance' },
    { name: 'Acting', color: 'orange', type: 'dance' },
    { name: 'Hip Hop', color: 'red', type: 'dance' }
  ];

  // VARIETY CATEGORIES - Standalone, not tied to dance categories
  const VARIETY_CATEGORIES = [
    { name: 'Variety A - Song & Dance, Character, or Combination', color: 'purple', type: 'variety' },
    { name: 'Variety B - Dance with Prop', color: 'blue', type: 'variety' },
    { name: 'Variety C - Dance with Acrobatics', color: 'pink', type: 'variety' },
    { name: 'Variety D - Dance with Acrobatics & Prop', color: 'teal', type: 'variety' },
    { name: 'Variety E - Hip Hop with Floor Work & Acrobatics', color: 'red', type: 'variety' },
    { name: 'Variety F - Ballroom', color: 'indigo', type: 'variety', description: 'For couples or groups of couples only. Lifts, gymnastics, props, and all forms of Ballroom allowed.' },
    { name: 'Variety G - Line Dancing', color: 'cyan', type: 'variety', description: 'Must include at least 3 contestants in routine. Props and gymnastics allowed.' }
  ];

  // SPECIAL CATEGORIES
  const SPECIAL_CATEGORIES = [
    { name: 'Production', color: 'gray', type: 'special', special: true },
    { name: 'Student Choreography', color: 'green', type: 'special', special: true },
    { name: 'Teacher/Student', color: 'indigo', type: 'special', special: true }
  ];

  // All categories combined (for entry form dropdown)
  const ALL_AVAILABLE_CATEGORIES = [...DANCE_CATEGORIES, ...VARIETY_CATEGORIES, ...SPECIAL_CATEGORIES];

  // Check if category is special (not eligible for high score awards)
  const isSpecialCategory = (categoryName) => {
    return SPECIAL_CATEGORIES.some(cat => cat.name === categoryName);
  };

  const varietyOptions = [
    'None', 
    'Variety A', 
    'Variety B', 
    'Variety C', 
    'Variety D', 
    'Variety E'
  ];

  // Get variety description for dropdown
  const getVarietyDescription = (variety) => {
    switch (variety) {
      case 'None':
        return 'None (straight category)';
      case 'Variety A':
        return 'Variety A (Song & Dance, Character, or Combination)';
      case 'Variety B':
        return 'Variety B (Dance with Prop)';
      case 'Variety C':
        return 'Variety C (Dance with Acrobatics)';
      case 'Variety D':
        return 'Variety D (Dance with Acrobatics & Prop)';
      case 'Variety E':
        return 'Variety E (Hip Hop with Floor Work & Acrobatics)';
      default:
        return variety;
    }
  };

  // Category colors
  const categoryColors = {
    'Tap': 'bg-blue-100 text-blue-800 border-blue-300',
    'Jazz': 'bg-purple-100 text-purple-800 border-purple-300',
    'Ballet': 'bg-pink-100 text-pink-800 border-pink-300',
    'Lyrical/Contemporary': 'bg-teal-100 text-teal-800 border-teal-300',
    'Vocal': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'Acting': 'bg-orange-100 text-orange-800 border-orange-300',
    'Hip Hop': 'bg-red-100 text-red-800 border-red-300',
    // Variety categories
    'Variety A - Song & Dance, Character, or Combination': 'bg-purple-100 text-purple-800 border-purple-300',
    'Variety B - Dance with Prop': 'bg-blue-100 text-blue-800 border-blue-300',
    'Variety C - Dance with Acrobatics': 'bg-pink-100 text-pink-800 border-pink-300',
    'Variety D - Dance with Acrobatics & Prop': 'bg-teal-100 text-teal-800 border-teal-300',
    'Variety E - Hip Hop with Floor Work & Acrobatics': 'bg-red-100 text-red-800 border-red-300',
    'Variety F - Ballroom': 'bg-indigo-100 text-indigo-800 border-indigo-300',
    'Variety G - Line Dancing': 'bg-cyan-100 text-cyan-800 border-cyan-300',
    // Special categories - gray to indicate different status
    'Production': 'bg-gray-100 text-gray-800 border-gray-400',
    'Student Choreography': 'bg-gray-100 text-gray-800 border-gray-400',
    'Teacher/Student': 'bg-gray-100 text-gray-800 border-gray-400'
  };

  // Division type options based on entry type
  const getDivisionTypeOptions = (entryType) => {
    if (entryType === 'solo') {
      return ['Solo'];
    } else {
      return ['Duo', 'Trio', 'Small Group (4-10)', 'Large Group (11+)', 'Production (10+)'];
    }
  };

  // Generate display name for category
  const generateCategoryDisplayName = (catName, varietyLevel) => {
    if (varietyLevel === 'None') {
      return catName;
    } else if (varietyLevel === 'Variety A') {
      return `${catName} Variety A - Song & Dance`;
    } else if (varietyLevel === 'Variety B') {
      return `${catName} Variety B - with Prop`;
    } else if (varietyLevel === 'Variety C') {
      return `${catName} Variety C - with Acrobatics`;
    } else if (varietyLevel === 'Variety D') {
      return `${catName} Variety D - with Acrobatics & Prop`;
    } else if (varietyLevel === 'Variety E') {
      return `${catName} Variety E - with Floor Work & Acrobatics`;
    }
    return catName;
  };

  // ===================================================================
  // CATEGORY HANDLERS (Simple Checkbox Selection - NO VARIETY LEVELS)
  // ===================================================================

  // Toggle category selection (simple checkbox - no variety levels)
  const handleToggleCategory = (categoryName) => {
    setSelectedCategories(prev => {
      const newSelection = { ...prev };
      
      if (newSelection[categoryName]?.selected) {
        // Unselect - remove category
        delete newSelection[categoryName];
      } else {
        // Select category (no variety levels needed)
        newSelection[categoryName] = {
          selected: true
        };
      }
      
      return newSelection;
    });
  };

  // Remove a category (from the summary pills)
  const handleRemoveCategory = (categoryName) => {
    setSelectedCategories(prev => {
        const newSelection = { ...prev };
        delete newSelection[categoryName];
        return newSelection;
    });
  };

  // Get list of selected categories as array (for saving to DB)
  // Returns flat list with category type
  const getSelectedCategoriesArray = () => {
    const result = [];
    
    Object.entries(selectedCategories)
      .filter(([_, data]) => data.selected)
      .forEach(([name, _]) => {
        // Find category type
        const danceCat = DANCE_CATEGORIES.find(c => c.name === name);
        const varietyCat = VARIETY_CATEGORIES.find(c => c.name === name);
        const specialCat = SPECIAL_CATEGORIES.find(c => c.name === name);
        
        const categoryType = danceCat?.type || varietyCat?.type || specialCat?.type || 'dance';
        const isSpecial = specialCat?.special || false;
        
            result.push({
              name,
          type: categoryType,
          displayName: name, // Category name is the display name (no variety levels)
          isSpecialCategory: isSpecial
        });
      });
    
    return result;
  };

  // ===================================================================
  // ENTRY HANDLERS
  // ===================================================================

  const handleOpenAddEntry = () => {
    const selectedCats = getSelectedCategoriesArray();
    const defaultCategoryId = selectedCats.length > 0 
      ? selectedCats[0].name 
      : '';
    
    setCurrentEntry({
      type: 'solo',
      name: '',
      categoryId: defaultCategoryId,
      ageDivisionId: FIXED_AGE_DIVISIONS[0].id,
      abilityLevel: 'Beginning',
      divisionType: 'Solo',
      isMedalProgram: true,
      photoFile: null,
      groupMembers: [],
      studioName: '',
      teacherName: ''
    });
    setShowAddEntryModal(true);
  };

  const handleCloseAddEntry = () => {
    setShowAddEntryModal(false);
    setCurrentEntry({
      type: 'solo',
      name: '',
      age: '',
      categoryId: '',
      ageDivisionId: '',
      abilityLevel: 'Beginning',
      divisionType: 'Solo',
      isMedalProgram: true,
      photoFile: null,
      groupMembers: [],
      studioName: '',
      teacherName: ''
    });
    setNewMemberName('');
    setNewMemberAge('');
    setAutoSelectedDivision(null);
  };

  const handleEntryTypeChange = (type) => {
    setCurrentEntry({
      ...currentEntry,
      type: type,
      divisionType: type === 'solo' ? 'Solo' : 'Duo',
      groupMembers: []
    });
  };

  // Handle age input with automatic age division assignment
  const handleAgeChange = (ageValue) => {
    const age = parseInt(ageValue);
    
    // Find matching age division
    let ageDivisionId = '';
    let autoDiv = null;
    
    if (age && !isNaN(age)) {
      const matchingDivision = FIXED_AGE_DIVISIONS.find(div => 
        age >= div.minAge && age <= div.maxAge
      );

      if (matchingDivision) {
        ageDivisionId = matchingDivision.id;
        autoDiv = matchingDivision;
      }
    }

    // FIXED: Single state update combining all changes
    setCurrentEntry(prev => ({
      ...prev,
      age: ageValue,
      ageDivisionId: ageDivisionId
    }));
    
    setAutoSelectedDivision(autoDiv);
  };

  const handleAddGroupMember = () => {
    console.log('🔵 ADD GROUP MEMBER CLICKED');
    console.log('📝 Name:', newMemberName);
    console.log('📝 Age:', newMemberAge);
    console.log('📋 Current members BEFORE:', currentEntry.groupMembers);

    if (!newMemberName.trim()) {
      toast.error('Please enter member name');
      return;
    }

    // FIXED: Safer age parsing with validation
    let parsedAge = null;
    if (newMemberAge && newMemberAge.trim() !== '') {
      const ageNum = parseInt(newMemberAge);
      // Only use age if it's a valid positive number
      if (!isNaN(ageNum) && ageNum > 0 && ageNum < 150) {
        parsedAge = ageNum;
      }
    }

    const member = {
      id: Date.now().toString(),
      name: newMemberName.trim(),
      age: parsedAge
    };

    console.log('➕ New member to add:', member);

    const updatedMembers = [...currentEntry.groupMembers, member];
    console.log('📋 Members AFTER add:', updatedMembers);
    
    // Auto-calculate oldest member age with safety checks
    try {
    const validAges = updatedMembers
      .map(m => m.age)
      .filter(a => a !== null && a !== undefined && !isNaN(a) && a > 0);
    
    const oldestAge = validAges.length > 0 ? Math.max(...validAges) : '';
    console.log('📊 Valid ages:', validAges);
    console.log('👴 Oldest age:', oldestAge);
    
    // Find matching age division
    let ageDivisionId = '';
    let autoDiv = null;
    
    if (oldestAge) {
      const matchingDivision = FIXED_AGE_DIVISIONS.find(div => 
        oldestAge >= div.minAge && oldestAge <= div.maxAge
      );
      
      if (matchingDivision) {
        ageDivisionId = matchingDivision.id;
        autoDiv = matchingDivision;
        console.log('✅ Auto-selected division:', matchingDivision.name);
      }
    }
    
    // Auto-set division type based on member count (preserve Production if already set)
    let autoDivisionType = currentEntry.divisionType;
    const newMemberCount = updatedMembers.length;
    
    // Don't auto-change if it's already Production
    if (currentEntry.divisionType === 'Production (10+)') {
      autoDivisionType = 'Production (10+)';
    } else if (newMemberCount === 2) {
      autoDivisionType = 'Duo';
    } else if (newMemberCount === 3) {
      autoDivisionType = 'Trio';
    } else if (newMemberCount >= 4 && newMemberCount <= 10) {
      autoDivisionType = 'Small Group (4-10)';
    } else if (newMemberCount >= 11) {
      autoDivisionType = 'Large Group (11+)';
    }
    
    // FIXED: Single state update combining all changes
    setCurrentEntry(prev => ({
      ...prev,
      groupMembers: updatedMembers,
      age: oldestAge || prev.age,
      ageDivisionId: ageDivisionId,
      divisionType: autoDivisionType
    }));
    
    if (autoDiv) {
      setAutoSelectedDivision(autoDiv);
      }
    } catch (error) {
      console.error('❌ Error calculating oldest age:', error);
      // Still update members even if age calculation fails
      setCurrentEntry(prev => ({
        ...prev,
        groupMembers: updatedMembers
      }));
    }

    // Clear inputs
    setNewMemberName('');
    setNewMemberAge('');
    
    console.log('✅ Add member complete!');
    toast.success(`Added: ${member.name}${member.age ? ` (Age ${member.age})` : ''}`);
  };

  const handleDeleteGroupMember = (id) => {
    console.log('🗑️ DELETE GROUP MEMBER:', id);
    
    const updatedMembers = currentEntry.groupMembers.filter(m => m.id !== id);
    console.log('📋 Members after delete:', updatedMembers);
    
    // Recalculate oldest age after deletion with safety checks
    try {
    const validAges = updatedMembers
      .map(m => m.age)
      .filter(a => a !== null && a !== undefined && !isNaN(a) && a > 0);
    
    const oldestAge = validAges.length > 0 ? Math.max(...validAges) : '';
    console.log('👴 New oldest age after delete:', oldestAge);
    
    // Find matching age division
    let ageDivisionId = '';
    let autoDiv = null;
    
    if (oldestAge) {
      const matchingDivision = FIXED_AGE_DIVISIONS.find(div => 
        oldestAge >= div.minAge && oldestAge <= div.maxAge
      );
      
      if (matchingDivision) {
        ageDivisionId = matchingDivision.id;
        autoDiv = matchingDivision;
      }
    }
    
    // Auto-set division type based on member count (preserve Production if already set)
    let autoDivisionType = currentEntry.divisionType;
    const newMemberCount = updatedMembers.length;
    
    // Don't auto-change if it's already Production
    if (currentEntry.divisionType === 'Production (10+)') {
      autoDivisionType = 'Production (10+)';
    } else if (newMemberCount === 2) {
      autoDivisionType = 'Duo';
    } else if (newMemberCount === 3) {
      autoDivisionType = 'Trio';
    } else if (newMemberCount >= 4 && newMemberCount <= 10) {
      autoDivisionType = 'Small Group (4-10)';
    } else if (newMemberCount >= 11) {
      autoDivisionType = 'Large Group (11+)';
    }
    
    // FIXED: Single state update combining all changes
    setCurrentEntry(prev => ({
      ...prev,
      groupMembers: updatedMembers,
      age: oldestAge || '',
      ageDivisionId: ageDivisionId,
      divisionType: autoDivisionType
    }));
    
    if (autoDiv) {
      setAutoSelectedDivision(autoDiv);
    } else if (!oldestAge) {
      setAutoSelectedDivision(null);
      }
    } catch (error) {
      console.error('❌ Error recalculating age after delete:', error);
      // Still update members even if age calculation fails
      setCurrentEntry(prev => ({
        ...prev,
        groupMembers: updatedMembers
      }));
    }
    
    console.log('✅ Delete member complete!');
  };

  const validateGroupMembers = () => {
    const memberCount = currentEntry.groupMembers.length;
    const divType = currentEntry.divisionType;

    if (divType === 'Duo') {
      return memberCount === 2;
    } else if (divType === 'Trio') {
      return memberCount === 3;
    } else if (divType === 'Small Group (4-10)') {
      return memberCount >= 4 && memberCount <= 10;
    } else if (divType === 'Large Group (11+)') {
      return memberCount >= 11;
    } else if (divType === 'Production (10+)') {
      return memberCount >= 10;
    }
    return true;
  };

  const handleSaveEntry = () => {
    console.log('🎯 SAVE ENTRY ATTEMPT');
    console.log('Entry details:', {
      name: currentEntry.name,
      type: currentEntry.type,
      age: currentEntry.age,
      isGroup: currentEntry.type === 'group',
      groupMembers: currentEntry.groupMembers,
      memberCount: currentEntry.groupMembers.length,
      studioName: currentEntry.studioName,
      teacherName: currentEntry.teacherName
    });

    // Validation
    if (!currentEntry.name.trim() && currentEntry.type === 'solo') {
      toast.error('Please enter dancer name');
      return;
    }

    if (!currentEntry.age || currentEntry.age < 1 || currentEntry.age > 99) {
      toast.error('Please enter a valid age (1-99)');
      return;
    }

    if (!currentEntry.categoryId) {
      toast.error('Please select a category');
      return;
    }

    if (!currentEntry.abilityLevel) {
      toast.error('Please select an ability level');
      return;
    }

    // Variety category-specific validation
    const categoryNameForValidation = currentEntry.categoryId;
    if (categoryNameForValidation && categoryNameForValidation.includes('Variety F - Ballroom')) {
      if (currentEntry.type === 'solo') {
        toast.error('Variety F - Ballroom requires couples or groups of couples (2+ members). Solo entries are not allowed.');
        return;
      }
      if (currentEntry.type === 'group' && currentEntry.groupMembers.length < 2) {
        toast.error('Variety F - Ballroom requires at least 2 members (couples or groups of couples).');
        return;
      }
    }
    if (categoryNameForValidation && categoryNameForValidation.includes('Variety G - Line Dancing')) {
      if (currentEntry.type === 'solo') {
        toast.error('Variety G - Line Dancing requires at least 3 contestants. Solo entries are not allowed.');
        return;
      }
      if (currentEntry.type === 'group' && currentEntry.groupMembers.length < 3) {
        toast.error('Variety G - Line Dancing requires at least 3 contestants in the routine.');
        return;
      }
    }

    // Lock age division from age. Entries cannot be saved outside the correct age division.
    const lockedAgeForSave = currentEntry.type === 'group'
      ? Math.max(...currentEntry.groupMembers.map(m => parseInt(m.age, 10)).filter(a => !Number.isNaN(a)), parseInt(currentEntry.age, 10) || 0)
      : parseInt(currentEntry.age, 10);
    const lockedDivisionForSave = getAgeDivisionForAge(lockedAgeForSave);
    if (!lockedDivisionForSave) {
      toast.error(`Age ${lockedAgeForSave || currentEntry.age} does not fit any age division. Please enter a valid age.`);
      return;
    }
    if (currentEntry.ageDivisionId !== lockedDivisionForSave.id) {
      setCurrentEntry(prev => ({ ...prev, ageDivisionId: lockedDivisionForSave.id, age: String(lockedAgeForSave) }));
    }

    if (currentEntry.type === 'group') {
      // Validate group member count
      if (!validateGroupMembers()) {
        const divType = currentEntry.divisionType;
        if (divType === 'Duo') {
          toast.error('Duo must have exactly 2 members');
        } else if (divType === 'Trio') {
          toast.error('Trio must have exactly 3 members');
        } else if (divType === 'Small Group (4-10)') {
          toast.error('Small Group must have 4-10 members');
        } else if (divType === 'Large Group (11+)') {
          toast.error('Large Group must have 11+ members');
        } else if (divType === 'Production (10+)') {
          toast.error('Production must have 10+ members');
        }
        return;
      }
      
      // FIXED: Make ages OPTIONAL for group members
      // Only validate if some (but not all) members have ages
      const membersWithAges = currentEntry.groupMembers.filter(m => m.age && m.age !== '');
      const membersWithoutAges = currentEntry.groupMembers.filter(m => !m.age || m.age === '');
      
      // If SOME have ages but not ALL, show warning (but don't block save)
      if (membersWithAges.length > 0 && membersWithoutAges.length > 0) {
        console.warn(`⚠️ Mixed ages: ${membersWithAges.length} with ages, ${membersWithoutAges.length} without`);
        // Still allow save - just use the ages that are provided
      }
      
      // Validate age matches oldest member (only if any ages provided)
      const ages = currentEntry.groupMembers.map(m => m.age).filter(a => a && !isNaN(a));
      if (ages.length > 0) {
        const oldestAge = Math.max(...ages);
        const entryAge = parseInt(currentEntry.age);
        
        // Only warn if there's a significant mismatch
        if (entryAge && entryAge !== oldestAge) {
          const confirmMismatch = window.confirm(
            `⚠️ Age Mismatch Detected!\n\n` +
            `Age field shows ${entryAge} but oldest member is ${oldestAge}.\n\n` +
            `The system will use ${oldestAge} for age division assignment.\n\n` +
            `Continue anyway?`
          );
          if (!confirmMismatch) {
            return;
          }
          
          // Auto-fix the age to oldest member
          setCurrentEntry(prev => ({ ...prev, age: oldestAge }));
          handleAgeChange(oldestAge.toString());
        }
      }
    }

    // Category name is the categoryId (no variety levels)
    const categoryName = currentEntry.categoryId;
    const categoryDisplayName = categoryName; // Display name is just the category name
    const ageDivision = getAgeDivisionForAge(lockedAgeForSave);

    // Clean group members data
    const cleanedGroupMembers = currentEntry.type === 'group' 
      ? currentEntry.groupMembers.map(m => ({
          id: m.id,
          name: m.name || '',
          age: m.age ? parseInt(m.age) : null
        }))
      : [];

    console.log('✅ Validation passed - creating entry object');
    console.log('Cleaned group members:', cleanedGroupMembers);

    const newEntry = {
      id: Date.now().toString(),
      number: entries.length + 1,
      type: currentEntry.type,
      name: currentEntry.name.trim() || `${currentEntry.divisionType} Group`,
      age: lockedAgeForSave,
      categoryId: currentEntry.categoryId,
      categoryName: categoryDisplayName || '',
      categoryColor: categoryColors[categoryName] || 'bg-gray-100 text-gray-800',
      ageDivisionId: ageDivision?.id || null,
      ageDivisionName: ageDivision?.name || null,
      abilityLevel: currentEntry.abilityLevel,
      divisionType: currentEntry.divisionType,
      isMedalProgram: currentEntry.isMedalProgram,
      photoFile: currentEntry.photoFile,
      photoPreview: currentEntry.photoFile ? URL.createObjectURL(currentEntry.photoFile) : null,
      groupMembers: cleanedGroupMembers,
      isExpanded: false,
      studioName: currentEntry.studioName?.trim() || '',
      teacherName: currentEntry.teacherName?.trim() || ''
    };

    console.log('📦 New entry object created:', newEntry);

    setEntries([...entries, newEntry]);
    toast.success(`Added: ${newEntry.name}`);
    handleCloseAddEntry();
  };

  const handleDeleteEntry = (id) => {
    const entry = entries.find(e => e.id === id);
    if (!window.confirm(`Are you sure you want to delete "${entry?.name}"? This cannot be undone.`)) {
      return;
    }
    const updatedEntries = entries
      .filter(e => e.id !== id)
      .map((e, index) => ({ ...e, number: index + 1 }));
    setEntries(updatedEntries);
    toast.info('Entry deleted');
  };

  const toggleExpandEntry = (id) => {
    setEntries(entries.map(e => 
      e.id === id ? { ...e, isExpanded: !e.isExpanded } : e
    ));
  };

  // ===================================================================
  // BULK PHOTO UPLOAD
  // ===================================================================

  const handleBulkPhotoUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) {
      return;
    }

    setIsBulkUploading(true);
    toast.info(`Uploading ${files.length} photos...`);

    const results = {
      success: [],
      failed: []
    };

    for (const file of files) {
      try {
        // Extract entry number from filename (e.g., "1.jpg" -> 1, "Entry_5.png" -> 5)
        const match = file.name.match(/(\d+)/);
        
        if (!match) {
          results.failed.push({ filename: file.name, reason: 'No entry number found in filename' });
          continue;
        }

        const entryNumber = parseInt(match[1]);
        
        // Find entry with this number
        const entry = entries.find(e => e.number === entryNumber);
        
        if (!entry) {
          results.failed.push({ filename: file.name, reason: `Entry #${entryNumber} not found` });
          continue;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          results.failed.push({ filename: file.name, reason: 'Not an image file' });
          continue;
        }

        // Update the entry with the photo
        const updatedEntries = entries.map(e => {
          if (e.id === entry.id) {
            return {
              ...e,
              photoFile: file,
              photoPreview: URL.createObjectURL(file)
            };
          }
          return e;
        });

        setEntries(updatedEntries);
        results.success.push({ filename: file.name, entryNumber });

      } catch (error) {
        console.error('Error processing file:', file.name, error);
        results.failed.push({ filename: file.name, reason: error.message });
      }
    }

    setIsBulkUploading(false);

    // Show results
    if (results.success.length > 0) {
      toast.success(`✅ ${results.success.length} photos uploaded successfully!`);
    }

    if (results.failed.length > 0) {
      toast.error(`❌ ${results.failed.length} photos failed to upload`);
      console.log('Failed uploads:', results.failed);
    }

    // Clear the file input
    event.target.value = '';
  };

  // ===================================================================
  // SAVE TO SUPABASE
  // ===================================================================

  const handleSaveAndContinue = async () => {
    // Validation
    const newErrors = {};

    if (!competitionName.trim()) {
      newErrors.competitionName = 'Competition name is required';
    }

    // Get selected categories as array
    const categoriesToSave = getSelectedCategoriesArray();

    if (categoriesToSave.length === 0) {
      newErrors.categories = 'Please select at least one category';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix validation errors');
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      // Step 1: Create competition
      toast.info('Creating competition...');
      
      const compData = {
        name: competitionName.trim(),
        date: competitionDate,
        venue: venue.trim() || null,
        judges_count: judgeCount,
        judge_names: judgeNames.map((name, i) => name.trim() || `Judge ${i + 1}`),
        status: 'active',
        is_test: isTestCompetition
      };

      const compResult = await createCompetition(compData);

      if (!compResult.success) {
        throw new Error(compResult.error);
      }

      const competitionId = compResult.data.id;
      console.log('✅ Competition created:', competitionId);
      
      // Store competition ID for photo manager
      setSavedCompetitionId(competitionId);

      // Step 2: Save categories
      toast.info('Saving categories...');
      const categoryMap = {}; // Map category names to Supabase IDs
      
      for (const cat of categoriesToSave) {
        const catResult = await createCategory({
          competition_id: competitionId,
          name: cat.displayName, // Category name is the display name (no variety levels)
          description: cat.name, // Store original name in description
          is_special_category: cat.isSpecialCategory || false,
          type: cat.type || 'dance' // NEW: category type (dance, variety, special)
        });

        if (!catResult.success) {
          throw new Error(catResult.error);
        }

        // Store the Supabase ID for mapping entries (use category name as key)
        categoryMap[cat.name] = catResult.data.id;
      }
      console.log('✅ Categories saved:', categoriesToSave.length);

      // Step 3: Save FIXED age divisions
        toast.info('Saving age divisions...');
      const ageDivisionMap = {}; // Map 'junior'/'senior' to Supabase IDs
      
      for (const div of FIXED_AGE_DIVISIONS) {
          const divResult = await createAgeDivision({
            competition_id: competitionId,
            name: div.name,
            min_age: div.minAge,
            max_age: div.maxAge
          });

          if (!divResult.success) {
            throw new Error(divResult.error);
          }

        ageDivisionMap[div.id] = divResult.data.id;
        }
      console.log('✅ Age divisions saved: 4');

      // Step 4: Save entries with photos
      toast.info('Saving entries...');
      for (const entry of entries) {
        // Upload photo first (if exists)
        let photoUrl = null;
        if (entry.photoFile) {
          const photoResult = await uploadEntryPhoto(
            entry.photoFile,
            entry.id, // temp ID
            competitionId
          );

          if (photoResult.success) {
            photoUrl = photoResult.url;
            console.log('✅ Photo uploaded:', photoUrl);
          } else {
            console.error('❌ Photo upload failed:', photoResult.error);
          }
        }

        // Get Supabase category ID from categoryMap
        // entry.categoryId is now just the category name (no variety levels)
        const categorySupabaseId = categoryMap[entry.categoryId] || null;

        // Get Supabase age division ID from our map
        const ageDivisionSupabaseId = ageDivisionMap[entry.ageDivisionId] || null;

        // FIXED: Clean up group members data before saving
        const cleanedGroupMembers = entry.type === 'group' && entry.groupMembers.length > 0
          ? entry.groupMembers.map(m => ({
              name: m.name || '',
              age: m.age ? parseInt(m.age) : null
            }))
          : null;

        console.log('💾 Saving entry:', {
          name: entry.name,
          type: entry.type,
          isGroup: entry.type === 'group',
          groupMembers: cleanedGroupMembers,
          studioName: entry.studioName,
          teacherName: entry.teacherName
        });

        // Create entry
        const entryData = {
          competition_id: competitionId,
          entry_number: entry.number,
          competitor_name: entry.name,
          age: entry.age,
          category_id: categorySupabaseId,
          age_division_id: ageDivisionSupabaseId,
          ability_level: entry.abilityLevel,
          is_medal_program: entry.isMedalProgram,
          dance_type: entry.divisionType,
          group_members: cleanedGroupMembers, // Send as separate field
          photo_url: photoUrl,
          studio_name: entry.studioName || null,
          teacher_name: entry.teacherName || null
        };
        
        console.log('📤 Entry data being sent to database:', entryData);
        
        const entryResult = await createEntry(entryData);

        if (!entryResult.success) {
          console.error('❌ Entry save failed:', {
            entryName: entry.name,
            error: entryResult.error,
            entryData: entryData
          });
          throw new Error(entryResult.error);
        }

        console.log('✅ Entry saved successfully:', {
          name: entry.name,
          id: entryResult.data?.id,
          studio: entryResult.data?.studio_name,
          teacher: entryResult.data?.teacher_name
        });
      }

      // Success!
      toast.success('🎉 Competition created successfully!');
      
      console.log('✅ All data saved, preparing navigation...');
      console.log('📍 Navigation state:', {
        competitionId: competitionId,
        competitionName: competitionName,
        competitionDate: competitionDate,
        venue: venue,
        judgeCount: judgeCount
      });
      
      // Navigate to judge selection
      setTimeout(() => {
        try { sessionStorage.setItem('topaz_active_competition_id', competitionId); } catch (e) { /* ignore */ }
        navigate('/judge-selection', {
          state: {
            competitionId: competitionId,
            competitionName: competitionName,
            competitionDate: competitionDate,
            venue: venue,
            judgeCount: judgeCount
          }
        });
      }, 1000);

    } catch (error) {
      console.error('❌ Error saving competition:', error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout overlayOpacity="bg-white/80">
      <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 max-w-6xl mx-auto w-full">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-800 text-base sm:text-lg font-semibold flex items-center min-h-[44px]"
          >
            ← <span className="hidden sm:inline ml-1">Back</span>
          </button>

          {/* Branding */}
          <div className="flex flex-row items-center justify-center gap-2 sm:gap-4">
            <div className="w-8 h-10 xs:w-12 xs:h-16 md:w-16 md:h-20 flex items-center justify-center">
              <img src={leftImagePath} alt="" className="w-full h-full object-contain" />
            </div>
            <div className="w-8 h-8 xs:w-10 xs:h-10 md:w-12 md:h-12 flex items-center justify-center">
              <img src={logoPath} alt="TOPAZ 2.0 Logo" className="w-full h-full object-contain" />
            </div>
            <div className="w-8 h-10 xs:w-12 xs:h-16 md:w-16 md:h-20 flex items-center justify-center">
              <img src={rightImagePath} alt="" className="w-full h-full object-contain" />
            </div>
          </div>

          <span className="text-teal-600 font-semibold text-sm sm:text-base">Step 1 of 3</span>
        </div>

        <div className="max-w-6xl mx-auto w-full">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">Competition Setup</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
            Set up your competition with categories, age divisions, and entries
          </p>

          {/* SECTION 1: COMPETITION DETAILS */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-5 sm:p-8 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-teal-600 mb-5 sm:mb-6">
              Competition Details
            </h2>

            <div className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                  Competition Name *
                </label>
                <input
                  type="text"
                  value={competitionName}
                  onChange={(e) => setCompetitionName(e.target.value)}
                  placeholder="e.g., TOPAZ Spring Championship 2025"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-base sm:text-lg min-h-[48px]"
                />
                {errors.competitionName && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.competitionName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                    Competition Date *
                  </label>
                  <input
                    type="date"
                    value={competitionDate}
                    onChange={(e) => setCompetitionDate(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-base sm:text-lg min-h-[48px]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                    Number of Judges *
                  </label>
                  <select
                    value={judgeCount}
                    onChange={(e) => handleJudgeCountChange(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-base sm:text-lg min-h-[48px]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'Judge' : 'Judges'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Judge Names Section */}
              <div className="bg-teal-50/50 rounded-xl p-4 sm:p-6 border-2 border-teal-100 mt-4">
                <h3 className="text-lg font-bold text-teal-700 mb-2 flex items-center gap-2">
                  <span>⚖️</span> Judge Names (Optional)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Enter names to display on score sheets and results. Leave blank to use "Judge 1", "Judge 2", etc.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: judgeCount }, (_, i) => (
                    <div key={i}>
                      <label className="block text-gray-600 text-xs font-semibold mb-1 uppercase tracking-wider">
                        Judge {i + 1} Name
                      </label>
                      <input
                        type="text"
                        value={judgeNames[i] || ''}
                        onChange={(e) => handleJudgeNameChange(i, e.target.value)}
                        placeholder={`e.g., Sarah Johnson`}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTestCompetition}
                    onChange={(e) => setIsTestCompetition(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-gray-700 font-semibold text-sm sm:text-base">
                    This is a test/practice competition
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Mark test competitions for easy cleanup in Data Management
                </p>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                  Venue/Location (Optional)
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g., City Dance Hall"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-base sm:text-lg min-h-[48px]"
                />
              </div>
            </div>
          </div>

          {/* BULK PHOTO UPLOAD SECTION */}
          <div className="bg-gradient-to-br from-teal-50/90 to-cyan-50/90 backdrop-blur-sm rounded-2xl shadow-lg p-5 sm:p-8 mb-6 border-2 border-teal-200">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-3xl">📸</span>
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-teal-700 mb-2">
                  Photo Upload Options
                </h2>
                <p className="text-sm sm:text-base text-gray-700 mb-4">
                  Upload photos for competition entries. Choose the method that works best for you.
                </p>
              </div>
            </div>

            {/* Photo Upload Manager Button */}
            {savedCompetitionId && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 sm:p-6 border-2 border-purple-200 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-purple-800 text-lg mb-1">📸 Photo Upload Manager</h3>
                    <p className="text-sm text-gray-700">
                      Recommended for competition day! Upload photos and automatically match them to entries.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPhotoManager(true)}
                    className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg transform hover:scale-105 min-h-[48px] whitespace-nowrap"
                  >
                    Open Photo Manager →
                  </button>
                </div>
              </div>
            )}

            {!savedCompetitionId && (
              <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200 mb-4">
                <p className="text-amber-800 text-sm font-semibold">
                  💡 Save your competition first to unlock the Photo Upload Manager
                </p>
              </div>
            )}

            {/* Original Bulk Upload */}
            <div className="bg-white/90 rounded-xl p-4 sm:p-6 border-2 border-dashed border-teal-300">
              <h3 className="font-bold text-teal-700 mb-3">Quick Bulk Upload (During Setup)</h3>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
                  multiple
                  onChange={handleBulkPhotoUpload}
                  disabled={entries.length === 0 || isBulkUploading}
                  id="bulk-photo-upload"
                  className="hidden"
                />
                <label
                  htmlFor="bulk-photo-upload"
                  className={`flex-1 cursor-pointer bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold py-3 px-6 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-300 text-center shadow-lg transform hover:scale-105 min-h-[48px] flex items-center justify-center ${
                    entries.length === 0 || isBulkUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isBulkUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                      Processing Photos...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">📤</span>
                      Select Multiple Photos
                    </>
                  )}
                </label>
              </div>

              {entries.length === 0 && (
                <p className="text-amber-600 text-sm mt-3 text-center font-semibold">
                  ⚠️ Please add entries first before uploading photos
                </p>
              )}

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-600">
                  <strong>💡 Tips:</strong>
                </p>
                <ul className="text-xs sm:text-sm text-gray-600 list-disc list-inside space-y-1 mt-2">
                  <li>Rename your photo files to match entry numbers (e.g., 1.jpg for Entry #1)</li>
                  <li>Supported formats: JPG, PNG, WEBP, GIF, HEIC, HEIF</li>
                  <li>Photos over 1MB will be automatically compressed</li>
                  <li>You can select all photos at once for faster upload</li>
                </ul>
              </div>
            </div>
          </div>

          {/* SECTION 2: CATEGORY SELECTION (Admin-Only Fixed Categories) */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-5 sm:p-8 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-teal-600 mb-2">
              Select Categories for This Competition
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              Choose which categories to include in your competition. Categories are fixed and managed by administrators.
            </p>

            <div className="space-y-6">
              {/* PERFORMING ARTS CATEGORIES */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border-2 border-purple-200">
                <h3 className="text-lg font-bold text-purple-800 mb-2">
                  PERFORMING ARTS CATEGORIES:
                </h3>
                <p className="text-sm text-gray-700 mb-4 font-medium">
                  Select which dance categories to include (check all that apply):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {DANCE_CATEGORIES.map(category => {
                    const isSelected = selectedCategories[category.name]?.selected;
                    
                    return (
                      <div key={category.name} className="bg-white rounded-lg p-3 border-2 border-gray-200 hover:border-teal-300 transition-colors">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`cat-${category.name}`}
                            checked={isSelected || false}
                            onChange={() => handleToggleCategory(category.name)}
                            className="w-5 h-5 text-teal-600 rounded focus:ring-2 focus:ring-teal-500 cursor-pointer"
                          />
                            <label 
                              htmlFor={`cat-${category.name}`}
                            className="flex-1 text-sm font-semibold text-gray-800 cursor-pointer hover:text-teal-600 transition-colors"
                            >
                              {category.name}
                            </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* VARIETY ARTS CATEGORIES */}
              <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-5 border-2 border-pink-200">
                <h3 className="text-lg font-bold text-pink-800 mb-2">
                  VARIETY ARTS CATEGORIES:
                </h3>
                <p className="text-sm text-gray-700 mb-4 font-medium">
                  These are standalone categories (not tied to specific dance styles):
                </p>
                <div className="space-y-3">
                  {VARIETY_CATEGORIES.map(category => {
                    const isSelected = selectedCategories[category.name]?.selected;
                                    
                                    return (
                      <div key={category.name} className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-pink-300 transition-colors">
                        <div className="flex items-start gap-3">
                                        <input
                                          type="checkbox"
                            id={`cat-${category.name}`}
                            checked={isSelected || false}
                            onChange={() => handleToggleCategory(category.name)}
                            className="w-5 h-5 mt-0.5 text-pink-600 rounded focus:ring-2 focus:ring-pink-500 cursor-pointer shrink-0"
                                        />
                                        <label
                            htmlFor={`cat-${category.name}`}
                            className="flex-1 text-base font-semibold text-gray-800 cursor-pointer hover:text-pink-600 transition-colors"
                          >
                            {category.name}
                            {category.description && (
                              <span className="block text-sm font-normal text-gray-600 mt-1">
                                {category.description}
                              </span>
                            )}
                                        </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SPECIAL CATEGORIES */}
              <div className="bg-gradient-to-r from-gray-50 to-amber-50 rounded-xl p-5 border-2 border-amber-200">
                <h3 className="text-lg font-bold text-amber-800 mb-2">
                  SPECIAL CATEGORIES:
                </h3>
                <p className="text-sm text-gray-700 mb-4 font-medium">
                  (Eligible for category placements/trophies - excluded only from overall/high score awards)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SPECIAL_CATEGORIES.map(category => {
                    const isSelected = selectedCategories[category.name]?.selected;
                    
                    return (
                      <div key={category.name} className="bg-white rounded-lg p-3 border-2 border-gray-200 hover:border-amber-300 transition-colors">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`cat-${category.name}`}
                            checked={isSelected || false}
                            onChange={() => handleToggleCategory(category.name)}
                            className="w-5 h-5 text-amber-600 rounded focus:ring-2 focus:ring-amber-500 cursor-pointer"
                          />
                            <label 
                              htmlFor={`cat-${category.name}`}
                            className="flex-1 text-sm font-semibold text-gray-800 cursor-pointer hover:text-amber-600 transition-colors"
                            >
                              {category.name}
                            </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Categories Summary with Remove Buttons */}
              {getSelectedCategoriesArray().length > 0 && (
                <div className="bg-teal-50 rounded-xl p-5 border-2 border-teal-200">
                  <p className="text-sm font-semibold text-teal-800 mb-3">
                    ✅ Selected Categories ({getSelectedCategoriesArray().length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getSelectedCategoriesArray().map(cat => (
                      <div
                        key={cat.name}
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 ${categoryColors[cat.name] || 'bg-gray-100 text-gray-800 border-gray-300'}`}
                      >
                        <span className="font-semibold text-sm">{cat.displayName}</span>
                        <button
                          onClick={() => handleRemoveCategory(cat.name)}
                          className="ml-1 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                          title="Remove this category"
                        >
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-teal-700 mt-3">
                    💡 Tip: Click the × to remove categories
                  </p>
                </div>
              )}

              {errors.categories && (
                <p className="text-red-500 text-sm font-semibold bg-red-50 p-3 rounded-lg border border-red-200">
                  {errors.categories}
                </p>
              )}
            </div>
          </div>

          {/* SECTION 4: ENTRIES */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-5 sm:p-8 mb-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-teal-600">
                  Dancers & Groups
                </h2>
                <p className="text-sm text-gray-600">Add entries for this competition</p>
              </div>
              <button
                onClick={handleOpenAddEntry}
                disabled={getSelectedCategoriesArray().length === 0}
                className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-4 py-2 rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-600 transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Entry
              </button>
            </div>

            {getSelectedCategoriesArray().length === 0 && (
              <p className="text-yellow-600 bg-yellow-50 border border-yellow-200 px-4 py-3 rounded-lg text-sm">
                ⚠️ Please select at least one category before adding entries
              </p>
            )}

            {/* Entries list */}
            {entries.length > 0 ? (
              <div className="space-y-3">
                {entries.map(entry => (
                  <div
                    key={entry.id}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:border-teal-300 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Photo */}
                      <div className="flex-shrink-0">
                        {entry.photoPreview ? (
                          <img
                            src={entry.photoPreview}
                            alt={`#${entry.number} ${entry.name}`}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-2xl">
                            {entry.type === 'group' ? '👥' : '💃'}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 text-lg">
                              #{entry.number} {entry.name}
                              {entry.age && entry.type === 'group' && entry.groupMembers.length > 0 
                                ? (() => {
                                    const ages = entry.groupMembers.map(m => m.age).filter(a => a);
                                    if (ages.length === 0) return ` (Age ${entry.age})`;
                                    const minAge = Math.min(...ages);
                                    const maxAge = Math.max(...ages);
                                    return ` (Ages ${minAge === maxAge ? minAge : `${minAge}-${maxAge}`} • Oldest: ${entry.age})`;
                                  })()
                                : entry.age ? ` (Age ${entry.age})` : ''
                              }
                            </span>
                            {entry.isMedalProgram && (
                              <span className="text-yellow-500 text-lg" title="Medal Program">
                                ⭐
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ×
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${entry.categoryColor}`}>
                            {entry.categoryName}
                          </span>
                          {entry.ageDivisionName && (
                            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 border-2 border-blue-300">
                              {entry.ageDivisionName}
                            </span>
                          )}
                          <AbilityBadge abilityLevel={entry.abilityLevel} size="md" />
                          <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800 border-2 border-gray-300">
                            {entry.divisionType}
                          </span>
                        </div>

                        {entry.type === 'group' && entry.groupMembers.length > 0 && (
                          <div>
                            <button
                              onClick={() => toggleExpandEntry(entry.id)}
                              className="text-sm text-teal-600 hover:text-teal-800 font-semibold"
                            >
                              {entry.isExpanded ? '▼' : '▶'} Group of {entry.groupMembers.length} members
                            </button>
                            {entry.isExpanded && (
                              <div className="mt-2 ml-4">
                                <ul className="text-sm text-gray-600 space-y-1 mb-2">
                                  {entry.groupMembers.map(member => (
                                    <li key={member.id}>
                                      • {member.name} {member.age && `(${member.age} years old)`}
                                    </li>
                                  ))}
                                </ul>
                                <p className="text-xs text-teal-600 font-semibold mt-2 px-3 py-1 bg-teal-50 rounded inline-block">
                                  Competing in {entry.ageDivisionName || 'N/A'} (based on oldest member: {entry.age} years)
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="🎭"
                title="No Entries Yet"
                description="Click the '+ Add Entry' button above to add your first dancer or group."
              />
            )}

            {errors.entries && (
              <p className="text-red-500 text-sm mt-3">{errors.entries}</p>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveAndContinue}
              disabled={isSaving}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-teal-700 hover:to-cyan-700 transition-all shadow-lg min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Continue to Judge Selection →'}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center text-sm text-gray-500 pb-8">
            <p className="font-semibold">TOPAZ 2.0 © 2025</p>
            <p className="mt-1">Heritage Since 1972 | Official Competition Setup</p>
          </div>
        </div>
      </div>

      {/* ADD ENTRY MODAL */}
      {showAddEntryModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              handleCloseAddEntry();
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 id="modal-title" className="text-2xl font-bold text-gray-800">Add Entry</h3>
              <button
                onClick={handleCloseAddEntry}
                className="text-gray-500 hover:text-gray-700 text-2xl"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="space-y-5">
              {/* Entry Type */}
              <div>
                <label className="block text-gray-700 font-semibold mb-3 text-sm sm:text-base">
                  Entry Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={currentEntry.type === 'solo'}
                      onChange={() => handleEntryTypeChange('solo')}
                      className="w-5 h-5"
                    />
                    <span className="text-lg">Solo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={currentEntry.type === 'group'}
                      onChange={() => handleEntryTypeChange('group')}
                      className="w-5 h-5"
                    />
                    <span className="text-lg">Group</span>
                  </label>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                  {currentEntry.type === 'solo' ? 'Dancer Name *' : 'Group Name (Optional)'}
                </label>
                <input
                  type="text"
                  value={currentEntry.name}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, name: e.target.value })}
                  placeholder={currentEntry.type === 'solo' ? 'Enter dancer name' : 'Enter group name or leave blank'}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none min-h-[48px]"
                />
              </div>

              {/* Age */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                  Age * {currentEntry.type === 'group' && '(Age of oldest member)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={currentEntry.age}
                  onChange={(e) => handleAgeChange(e.target.value)}
                  placeholder="Enter age"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none min-h-[48px]"
                />
                {autoSelectedDivision && (
                  <p className="text-sm text-teal-600 mt-1 font-semibold">
                    ✓ Age {currentEntry.age} → {autoSelectedDivision.name} Division (auto-selected)
                  </p>
                )}
                {currentEntry.age && !autoSelectedDivision && (
                  <p className="text-sm text-orange-600 mt-1">
                    ⚠️ Age {currentEntry.age} doesn't match any division
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                  Category *
                </label>
                {(() => {
                  const selectedCategory = getSelectedCategoriesArray().find(cat => cat.name === currentEntry.categoryId);
                  const isSpecial = selectedCategory?.isSpecialCategory || selectedCategory?.type === 'special';
                  
                  return (
                    <>
                      {isSpecial && (
                        <div className="mb-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                          <div className="flex items-start gap-2">
                            <span className="text-xl">⚠️</span>
                            <div>
                              <p className="text-sm font-bold text-yellow-800 mb-1">
                                Special Category Selected
                              </p>
                              <p className="text-xs text-yellow-700">
                                This category is judged and eligible for category placements/trophies. It is excluded only from overall/high score awards.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                <select
                  value={currentEntry.categoryId}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, categoryId: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none min-h-[48px]"
                >
                  <option value="">Select a category...</option>
                  
                  {/* Performing Arts Section */}
                  {(() => {
                    const performingArts = getSelectedCategoriesArray().filter(cat => cat.type === 'dance');
                    return performingArts.length > 0 ? (
                      <optgroup label="--- Performing Arts ---">
                        {performingArts.map(cat => (
                          <option key={cat.name} value={cat.name}>
                            {cat.displayName}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })()}
                  
                  {/* Variety Arts Section */}
                  {(() => {
                    const varietyArts = getSelectedCategoriesArray().filter(cat => cat.type === 'variety');
                    return varietyArts.length > 0 ? (
                      <optgroup label="--- Variety Arts ---">
                        {varietyArts.map(cat => (
                          <option key={cat.name} value={cat.name}>
                            {cat.displayName}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })()}
                  
                  {/* Special Categories Section */}
                  {(() => {
                    const specialCategories = getSelectedCategoriesArray().filter(cat => cat.type === 'special');
                    return specialCategories.length > 0 ? (
                      <optgroup label="--- Special Categories ---">
                        {specialCategories.map(cat => (
                          <option key={cat.name} value={cat.name}>
                            {cat.displayName}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })()}
                </select>
              </div>

              {/* Age Division - locked from age */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                    Age Division (Locked by Age)
                  </label>
                  <div className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-800 font-semibold min-h-[48px]">
                    {lockedEntryAge ? (lockedAgeDivision?.description || 'No matching age division') : 'Enter age to auto-select division'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Age division is automatically assigned from the dancer age{currentEntry.type === 'group' ? ' using the oldest dancer' : ''} and cannot be overridden.
                  </p>
                </div>

              {/* Ability Level */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                  Ability Level *
                </label>
                <select
                  value={currentEntry.abilityLevel}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, abilityLevel: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none min-h-[48px]"
                >
                  <option value="Beginning">Beginning (Less than 2 years)</option>
                  <option value="Intermediate">Intermediate (2-4 years)</option>
                  <option value="Advanced">Advanced (5+ years)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {currentEntry.type === 'group' 
                    ? '⚠️ For groups: Select the ability level of your most experienced member'
                    : 'Select based on years of training'}
                </p>
              </div>

              {/* Division Type */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                  Division Type *
                </label>
                <select
                  value={currentEntry.divisionType}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, divisionType: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none min-h-[48px]"
                >
                  {getDivisionTypeOptions(currentEntry.type).map(divType => (
                    <option key={divType} value={divType}>
                      {divType}
                    </option>
                  ))}
                </select>
              </div>

              {/* Medal Program */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentEntry.isMedalProgram}
                    onChange={(e) => setCurrentEntry({ ...currentEntry, isMedalProgram: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <span className="text-gray-700 font-semibold text-sm sm:text-base">
                    Include in Medal Program ⭐
                  </span>
                </label>
              </div>

              {/* Studio Name (Optional) */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                  Studio Name (Optional)
                </label>
                <input
                  type="text"
                  value={currentEntry.studioName || ''}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, studioName: e.target.value })}
                  placeholder="e.g., ABC Dance Studio"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none min-h-[48px]"
                />
              </div>

              {/* Teacher/Choreographer Name (Optional) */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm sm:text-base">
                  Teacher/Choreographer Name (Optional)
                </label>
                <input
                  type="text"
                  value={currentEntry.teacherName || ''}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, teacherName: e.target.value })}
                  placeholder="e.g., Jane Smith"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none min-h-[48px]"
                />
              </div>

              {/* Photo Upload */}
              <PhotoUpload
                onPhotoSelect={(file) => setCurrentEntry({ ...currentEntry, photoFile: file })}
                existingPhotoUrl={currentEntry.photoFile ? URL.createObjectURL(currentEntry.photoFile) : null}
              />

              {/* Group Members */}
              {currentEntry.type === 'group' && (
                <div className="border-t pt-5">
                  <h4 className="text-lg font-bold text-gray-800 mb-3">
                    Group Members *
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    {currentEntry.divisionType === 'Duo/Trio' && 'Add 2-3 members'}
                    {currentEntry.divisionType === 'Small Group (4-10)' && 'Add 4-10 members'}
                    {currentEntry.divisionType === 'Large Group (11+)' && 'Add 11+ members'}
                    {currentEntry.divisionType === 'Production (10+)' && 'Add 10+ members'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="Member name"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none min-h-[44px]"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={newMemberAge}
                        onChange={(e) => setNewMemberAge(e.target.value)}
                        placeholder="Age (optional)"
                        min="0"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none min-h-[44px]"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddGroupMember}
                    className="w-full bg-teal-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-teal-600 transition-colors min-h-[44px] mb-4"
                  >
                    + Add Member
                  </button>

                  {/* Members list */}
                  {currentEntry.groupMembers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">
                        Members ({currentEntry.groupMembers.length}):
                      </p>
                      <div className="space-y-2">
                        {currentEntry.groupMembers.map(member => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg"
                          >
                            <span className="text-gray-700">
                              {member.name} {member.age && `(${member.age} years)`}
                            </span>
                            <button
                              onClick={() => handleDeleteGroupMember(member.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Auto-calculated age display */}
                  {currentEntry.groupMembers.length > 0 && (() => {
                    const ages = currentEntry.groupMembers.map(m => m.age).filter(a => a && !isNaN(a));
                    if (ages.length === 0) return null;
                    
                    const oldestAge = Math.max(...ages);
                    const youngestAge = Math.min(...ages);
                    const entryAge = parseInt(currentEntry.age);
                    const hasMismatch = entryAge && entryAge !== oldestAge;
                    
                    return (
                      <div className="mt-4 space-y-3">
                        {/* Age calculation info */}
                        <div className="p-4 bg-teal-50 border-2 border-teal-300 rounded-lg">
                          <p className="font-semibold text-teal-700 flex items-center gap-2">
                            <span>✓</span>
                            <span>Age Range: {youngestAge === oldestAge ? `${youngestAge}` : `${youngestAge}-${oldestAge}`} years</span>
                          </p>
                          <p className="text-sm text-teal-600 mt-1">
                            Oldest Member: {oldestAge} years • This age will be used for division assignment
                          </p>
                        </div>
                        
                        {/* Age mismatch warning */}
                        {hasMismatch && (
                          <div className="p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                            <p className="text-yellow-800 font-semibold flex items-center gap-2">
                              <span>⚠️</span>
                              <span>Age Mismatch Detected!</span>
                            </p>
                            <p className="text-sm text-yellow-700 mt-1">
                              Age field shows <strong>{entryAge}</strong> but oldest member is <strong>{oldestAge}</strong>.
                              {' '}The system will use <strong>{oldestAge}</strong> for age division assignment.
                            </p>
                            <button
                              onClick={() => {
                                setCurrentEntry(prev => ({ ...prev, age: oldestAge }));
                                handleAgeChange(oldestAge.toString());
                              }}
                              className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-semibold hover:bg-yellow-700 transition-colors"
                            >
                              Fix Age to {oldestAge}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCloseAddEntry}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEntry}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-4 py-3 rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-600 transition-all min-h-[48px]"
                >
                  Save Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Manager Modal */}
      {showPhotoManager && savedCompetitionId && (
        <PhotoUploadManager
          competitionId={savedCompetitionId}
          onClose={() => setShowPhotoManager(false)}
        />
      )}
    </Layout>
  );
}

export default CompetitionSetup;
