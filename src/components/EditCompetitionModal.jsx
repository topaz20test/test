import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { updateCompetition } from '../supabase/competitions';
import { getCompetitionCategories, createCategory, deleteCategory } from '../supabase/categories';
import { getCompetitionAgeDivisions } from '../supabase/ageDivisions';
import AddEntryModal from './AddEntryModal';

/**
 * Edit Competition Modal Component
 * Allows editing competition details after creation
 */
export default function EditCompetitionModal({ 
  competition, 
  isOpen, 
  onClose, 
  onSave,
  onEntryAdded,
  entries = [],
  scores = []
}) {
  // Form state
  const [competitionName, setCompetitionName] = useState('');
  const [competitionDate, setCompetitionDate] = useState('');
  const [venue, setVenue] = useState('');
  const [judgeCount, setJudgeCount] = useState(3);
  const [judgeNames, setJudgeNames] = useState([]);
  const [judgePins, setJudgePins] = useState([]);
  
  // Categories state
  const [existingCategories, setExistingCategories] = useState([]);
  const [existingAgeDivisions, setExistingAgeDivisions] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState({});
  
  // Add Entry modal
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState([]);
  
  // Available categories (same as CompetitionSetup - NEW STRUCTURE)
  const DANCE_CATEGORIES = [
    { name: 'Tap', color: 'blue', type: 'dance' },
    { name: 'Jazz', color: 'purple', type: 'dance' },
    { name: 'Ballet', color: 'pink', type: 'dance' },
    { name: 'Lyrical/Contemporary', color: 'teal', type: 'dance' },
    { name: 'Vocal', color: 'yellow', type: 'dance' },
    { name: 'Acting', color: 'orange', type: 'dance' },
    { name: 'Hip Hop', color: 'red', type: 'dance' }
  ];

  const VARIETY_CATEGORIES = [
    { name: 'Variety A - Song & Dance, Character, or Combination', color: 'purple', type: 'variety' },
    { name: 'Variety B - Dance with Prop', color: 'blue', type: 'variety' },
    { name: 'Variety C - Dance with Acrobatics', color: 'pink', type: 'variety' },
    { name: 'Variety D - Dance with Acrobatics & Prop', color: 'teal', type: 'variety' },
    { name: 'Variety E - Hip Hop with Floor Work & Acrobatics', color: 'red', type: 'variety' },
    { name: 'Variety F - Ballroom', color: 'indigo', type: 'variety' },
    { name: 'Variety G - Line Dancing', color: 'cyan', type: 'variety' }
  ];

  const SPECIAL_CATEGORIES = [
    { name: 'Production', color: 'gray', type: 'special', special: true },
    { name: 'Student Choreography', color: 'green', type: 'special', special: true },
    { name: 'Teacher/Student', color: 'indigo', type: 'special', special: true }
  ];

  const ALL_AVAILABLE_CATEGORIES = [...DANCE_CATEGORIES, ...VARIETY_CATEGORIES, ...SPECIAL_CATEGORIES];

  // Load competition data when modal opens
  useEffect(() => {
    if (isOpen && competition) {
      setCompetitionName(competition.name || '');
      setCompetitionDate(competition.date ? competition.date.split('T')[0] : '');
      setVenue(competition.venue || '');
      setJudgeCount(competition.judges_count || 3);
      setJudgeNames(competition.judge_names || Array(competition.judges_count || 3).fill(''));
      const jp =
        competition.judge_pins &&
        typeof competition.judge_pins === 'object' &&
        !Array.isArray(competition.judge_pins)
          ? competition.judge_pins
          : {};
      const n = competition.judges_count || 3;
      setJudgePins(
        Array.from({ length: n }, (_, i) => String(jp[String(i + 1)] ?? '').replace(/\D/g, '').slice(0, 4))
      );

      // Load existing categories
      loadCategories();
    }
  }, [isOpen, competition]);

  // Load existing categories
  const loadCategories = async () => {
    if (!competition?.id) return;
    
    try {
      const [catsResult, divsResult] = await Promise.all([
        getCompetitionCategories(competition.id),
        getCompetitionAgeDivisions(competition.id)
      ]);
      
      if (catsResult.success) {
        setExistingCategories(catsResult.data || []);
        
        // Build selectedCategories object from existing categories (NEW STRUCTURE - no variety levels)
        const selected = {};
        (catsResult.data || []).forEach(cat => {
          const categoryName = cat.name;
          const availableCat = ALL_AVAILABLE_CATEGORIES.find(ac => ac.name === categoryName);
          if (availableCat) {
            selected[categoryName] = { selected: true };
          }
        });
        setSelectedCategories(selected);
      }
      
      if (divsResult.success) {
        setExistingAgeDivisions(divsResult.data || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Handle judge count change
  const handleJudgeCountChange = (count) => {
    setJudgeCount(count);
    // Resize judgeNames array while preserving existing names
    const newNames = Array.from({ length: count }, (_, i) => judgeNames[i] || '');
    setJudgeNames(newNames);
    setJudgePins((prev) =>
      Array.from({ length: count }, (_, i) => (prev[i] != null ? prev[i] : '').replace(/\D/g, '').slice(0, 4))
    );
  };

  // Handle judge name change
  const handleJudgeNameChange = (index, name) => {
    const newNames = [...judgeNames];
    newNames[index] = name;
    setJudgeNames(newNames);
  };

  // Toggle category selection (NEW STRUCTURE - simple checkbox, no variety levels)
  const toggleCategory = (categoryName) => {
    setSelectedCategories(prev => {
      const newState = { ...prev };
      if (newState[categoryName]) {
        // Toggle off
        delete newState[categoryName];
      } else {
        // Toggle on (no variety levels needed)
        newState[categoryName] = { selected: true };
      }
      return newState;
    });
  };

  // Validate form
  const validate = async () => {
    const newErrors = {};
    const newWarnings = [];

    if (!competitionName.trim()) {
      newErrors.competitionName = 'Competition name is required';
    }

    if (!competitionDate) {
      newErrors.competitionDate = 'Competition date is required';
    }

    // Check if reducing judge count below existing scores
    if (scores && scores.length > 0) {
      const maxJudgeUsed = Math.max(...scores.map(s => s.judge_number || 0));
      if (judgeCount < maxJudgeUsed) {
        newErrors.judgeCount = `Cannot reduce judges below ${maxJudgeUsed}. Scores already entered for Judge ${maxJudgeUsed}.`;
      }
    }

    if (judgeCount < 1 || judgeCount > 10) {
      newErrors.judgeCount = 'Judge count must be between 1 and 10';
    }

    // Check for categories with entries (prevent removal)
    if (entries && entries.length > 0) {
      const selectedCategoryNames = Object.keys(selectedCategories).filter(
        name => selectedCategories[name]?.selected
      );
      const currentCategoryNames = existingCategories.map(cat => cat.name);
      const categoriesToRemove = currentCategoryNames.filter(
        name => !selectedCategoryNames.includes(name)
      );

      for (const categoryName of categoriesToRemove) {
        const category = existingCategories.find(c => c.name === categoryName);
        if (category) {
          const entriesInCategory = entries.filter(e => e.category_id === category.id);
          if (entriesInCategory.length > 0) {
            newErrors.categories = `Cannot remove "${categoryName}" category. It has ${entriesInCategory.length} entry/entries.`;
            break; // Stop at first error
          }
        }
      }
    }

    setErrors(newErrors);
    
    // Warnings for other potential issues
    if (competition?.id && Object.keys(selectedCategories).length === 0) {
      newWarnings.push('No categories selected. Competition will have no categories.');
    }

    setWarnings(newWarnings);
    return Object.keys(newErrors).length === 0;
  };

  // Save changes
  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    setLoading(true);
    try {
      // Update competition
      const pinsObj = {};
      for (let i = 0; i < judgeCount; i++) {
        const p = (judgePins[i] || '').trim().replace(/\D/g, '').slice(0, 4);
        if (p) pinsObj[String(i + 1)] = p;
      }

      const updateData = {
        name: competitionName.trim(),
        date: competitionDate,
        venue: venue.trim() || null,
        judges_count: judgeCount,
        judge_names: judgeNames.filter(name => name.trim()),
        judge_pins: pinsObj
      };

      const updateResult = await updateCompetition(competition.id, updateData);
      
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update competition');
      }

      // Update categories
      await updateCategories();

      toast.success('Competition updated successfully!');
      onSave(updateResult.data);
      onClose();
    } catch (error) {
      console.error('Error updating competition:', error);
      toast.error(`Failed to update competition: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update categories (add new, remove deleted) - NEW STRUCTURE
  const updateCategories = async () => {
    // Build list of desired categories (category name is the full name, no variety levels)
    const desiredCategoryNames = Object.keys(selectedCategories).filter(
      name => selectedCategories[name]?.selected
    );

    // Get current category names
    const currentCategoryNames = existingCategories.map(cat => cat.name);

    // Find categories to add
    const toAdd = desiredCategoryNames.filter(name => !currentCategoryNames.includes(name));
    
    // Find categories to remove (only if they have no entries)
    const toRemove = existingCategories.filter(cat => {
      if (desiredCategoryNames.includes(cat.name)) return false; // Keep this category
      
      // Check if category has entries
      const entriesInCategory = entries.filter(e => e.category_id === cat.id);
      if (entriesInCategory.length > 0) {
        console.warn(`⚠️ Skipping removal of "${cat.name}" - has ${entriesInCategory.length} entries`);
        return false; // Don't remove categories with entries
      }
      
      return true; // Safe to remove
    });

    // Add new categories
    for (const categoryName of toAdd) {
      // Find category type
      const danceCat = DANCE_CATEGORIES.find(c => c.name === categoryName);
      const varietyCat = VARIETY_CATEGORIES.find(c => c.name === categoryName);
      const specialCat = SPECIAL_CATEGORIES.find(c => c.name === categoryName);
      
      const categoryType = danceCat?.type || varietyCat?.type || specialCat?.type || 'dance';
      const isSpecial = specialCat?.special || false;
      
      await createCategory({
        competition_id: competition.id,
        name: categoryName,
        description: categoryName, // Store name in description
        is_special_category: isSpecial,
        type: categoryType
      });
    }

    // Remove deleted categories (only those without entries)
    for (const category of toRemove) {
      await deleteCategory(category.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Edit Competition Settings</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Warnings</h3>
              <ul className="list-disc list-inside text-yellow-700 text-sm">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Competition Details */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-xl font-bold text-teal-600 mb-4">Competition Details</h3>
            
            <div className="space-y-4">
              {/* Competition Name */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Competition Name *
                </label>
                <input
                  type="text"
                  value={competitionName}
                  onChange={(e) => setCompetitionName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
                  placeholder="e.g., TOPAZ Spring Championship 2025"
                />
                {errors.competitionName && (
                  <p className="text-red-500 text-sm mt-1">{errors.competitionName}</p>
                )}
              </div>

              {/* Date and Judges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Competition Date *
                  </label>
                  <input
                    type="date"
                    value={competitionDate}
                    onChange={(e) => setCompetitionDate(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
                  />
                  {errors.competitionDate && (
                    <p className="text-red-500 text-sm mt-1">{errors.competitionDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Number of Judges *
                  </label>
                  <select
                    value={judgeCount}
                    onChange={(e) => handleJudgeCountChange(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'Judge' : 'Judges'}
                      </option>
                    ))}
                  </select>
                  {errors.judgeCount && (
                    <p className="text-red-500 text-sm mt-1">{errors.judgeCount}</p>
                  )}
                </div>
              </div>

              {/* Judge Names */}
              <div className="bg-teal-50 rounded-xl p-4 border-2 border-teal-100">
                <h4 className="text-lg font-bold text-teal-700 mb-2">⚖️ Judge Names (Optional)</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Enter names to display on score sheets and results.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: judgeCount }, (_, i) => (
                    <div key={i}>
                      <label className="block text-gray-600 text-xs font-semibold mb-1 uppercase">
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
                <p className="text-sm text-gray-600 mt-4 mb-2">
                  Optional 4-digit PINs for judge devices. Leave blank to allow access without a PIN.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: judgeCount }, (_, i) => (
                    <div key={`pin-${i}`}>
                      <label className="block text-gray-600 text-xs font-semibold mb-1 uppercase">
                        Judge {i + 1} PIN (4 digits)
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={judgePins[i] || ''}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setJudgePins((prev) => {
                            const next = [...prev];
                            next[i] = v;
                            return next;
                          });
                        }}
                        placeholder="Optional"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-[#2E75B6] focus:outline-none text-sm font-mono tracking-widest"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Venue */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Venue/Location (Optional)
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
                  placeholder="e.g., City Dance Hall"
                />
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-xl font-bold text-teal-600 mb-4">Categories</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select categories for this competition. Categories are standalone (no variety levels).
            </p>

            <div className="space-y-6">
              {/* DANCE CATEGORIES */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border-2 border-purple-200">
                <h4 className="text-lg font-bold text-purple-800 mb-3">PERFORMING ARTS CATEGORIES:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {DANCE_CATEGORIES.map(category => {
                    const isSelected = selectedCategories[category.name]?.selected || false;
                    return (
                      <div key={category.name} className="bg-white rounded-lg p-3 border-2 border-gray-200 hover:border-teal-300 transition-colors">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCategory(category.name)}
                            className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                          />
                          <span className="text-sm font-semibold text-gray-800">{category.name}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* VARIETY CATEGORIES */}
              <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-5 border-2 border-pink-200">
                <h4 className="text-lg font-bold text-pink-800 mb-3">VARIETY ARTS CATEGORIES:</h4>
                <div className="space-y-3">
                  {VARIETY_CATEGORIES.map(category => {
                    const isSelected = selectedCategories[category.name]?.selected || false;
                    return (
                      <div key={category.name} className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-pink-300 transition-colors">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCategory(category.name)}
                            className="w-5 h-5 text-pink-600 rounded focus:ring-pink-500"
                          />
                          <span className="text-base font-semibold text-gray-800">{category.name}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SPECIAL CATEGORIES */}
              <div className="bg-gradient-to-r from-gray-50 to-amber-50 rounded-xl p-5 border-2 border-amber-200">
                <h4 className="text-lg font-bold text-amber-800 mb-2">SPECIAL CATEGORIES:</h4>
                <p className="text-sm text-gray-700 mb-3 font-medium">
                  (Eligible for category placements/trophies - excluded only from overall/high score awards)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SPECIAL_CATEGORIES.map(category => {
                    const isSelected = selectedCategories[category.name]?.selected || false;
                    return (
                      <div key={category.name} className="bg-white rounded-lg p-3 border-2 border-gray-200 hover:border-amber-300 transition-colors">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCategory(category.name)}
                            className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                          />
                          <span className="text-sm font-semibold text-gray-800">{category.name}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Error message for categories */}
            {errors.categories && (
              <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <p className="text-red-700 font-semibold">{errors.categories}</p>
              </div>
            )}
          </div>
        </div>

          {/* Manage Entries */}
          <div className="bg-teal-50 rounded-xl p-6 border-2 border-teal-200">
            <h3 className="text-xl font-bold text-teal-800 mb-2">Manage Entries</h3>
            <p className="text-gray-600 text-sm mb-4">Add or view entries for this competition.</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowAddEntryModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-md flex items-center gap-2"
              >
                <span>➕</span>
                Add New Entry
              </button>
              <p className="text-sm text-teal-700 self-center">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'} in this competition
              </p>
            </div>
          </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-100 p-6 rounded-b-2xl flex justify-end gap-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add Entry Modal */}
      <AddEntryModal
        isOpen={showAddEntryModal}
        onClose={() => setShowAddEntryModal(false)}
        competitionId={competition?.id}
        competition={competition}
        categories={existingCategories}
        ageDivisions={existingAgeDivisions}
        onSuccess={() => {
          onEntryAdded?.();
          setShowAddEntryModal(false);
        }}
      />
    </div>
  );
}

