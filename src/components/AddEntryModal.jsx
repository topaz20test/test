import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { createEntry, getNextEntryNumber } from '../supabase/entries';

const DANCE_CATEGORIES = [
  { name: 'Tap', type: 'dance' },
  { name: 'Jazz', type: 'dance' },
  { name: 'Ballet', type: 'dance' },
  { name: 'Lyrical/Contemporary', type: 'dance' },
  { name: 'Vocal', type: 'dance' },
  { name: 'Acting', type: 'dance' },
  { name: 'Hip Hop', type: 'dance' }
];
const VARIETY_CATEGORIES = [
  { name: 'Variety A - Song & Dance, Character, or Combination', type: 'variety' },
  { name: 'Variety B - Dance with Prop', type: 'variety' },
  { name: 'Variety C - Dance with Acrobatics', type: 'variety' },
  { name: 'Variety D - Dance with Acrobatics & Prop', type: 'variety' },
  { name: 'Variety E - Hip Hop with Floor Work & Acrobatics', type: 'variety' },
  { name: 'Variety F - Ballroom', type: 'variety' },
  { name: 'Variety G - Line Dancing', type: 'variety' }
];
const SPECIAL_CATEGORIES = [
  { name: 'Production', type: 'special' },
  { name: 'Student Choreography', type: 'special' },
  { name: 'Teacher/Student', type: 'special' }
];

function getDivisionTypeOptions(entryType) {
  if (entryType === 'solo') return ['Solo'];
  return ['Duo', 'Trio', 'Small Group (4-10)', 'Large Group (11+)', 'Production (10+)'];
}

function normalizeDivisionTypeForSave(divisionType) {
  if (!divisionType) return 'Solo';
  if (divisionType.includes('Small Group')) return 'Small Group';
  if (divisionType.includes('Large Group')) return 'Large Group';
  if (divisionType.includes('Production')) return 'Production';
  return divisionType;
}

function buildRoutineDisplayName(entry, members) {
  const typedName = entry.name?.trim();
  if (typedName) return typedName;
  if (entry.type === 'solo') return typedName;
  const memberNames = members.map((m) => m.name).filter(Boolean);
  if (memberNames.length > 0) return memberNames.join(' + ');
  return `${normalizeDivisionTypeForSave(entry.divisionType)} Routine`;
}

function getOldestMemberAge(members) {
  const ages = members.map((m) => parseInt(m.age, 10)).filter((n) => !Number.isNaN(n));
  return ages.length ? Math.max(...ages) : null;
}


function formatAgeDivisionLabel(division) {
  if (!division) return 'No matching age division';
  const name = division.name || division.label || 'Age Division';
  const minAge = division.min_age ?? division.minAge;
  const maxAge = division.max_age ?? division.maxAge;
  if (minAge != null && maxAge != null) return `${name} (${minAge}-${maxAge})`;
  return name;
}

function findMatchingAgeDivision(ageValue, ageDivisions = []) {
  const age = parseInt(ageValue, 10);
  if (!age || Number.isNaN(age)) return null;

  return ageDivisions.find((division) => {
    const minAge = parseInt(division.min_age ?? division.minAge ?? 0, 10);
    const maxAge = parseInt(division.max_age ?? division.maxAge ?? 999, 10);
    return age >= minAge && age <= maxAge;
  }) || null;
}

export default function AddEntryModal({
  isOpen,
  onClose,
  competitionId,
  competition,
  categories = [],
  ageDivisions = [],
  onSuccess
}) {
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState({
    type: 'solo',
    name: '',
    age: '',
    categoryId: '',
    ageDivisionId: '',
    abilityLevel: 'Beginning',
    divisionType: 'Solo',
    isMedalProgram: true,
    groupMembers: [],
    studioName: '',
    teacherName: ''
  });
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAge, setNewMemberAge] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEntry({
        type: 'solo',
        name: '',
        age: '',
        categoryId: '',
        ageDivisionId: '',
        abilityLevel: 'Beginning',
        divisionType: 'Solo',
        isMedalProgram: true,
        groupMembers: [],
        studioName: '',
        teacherName: ''
      });
      setNewMemberName('');
      setNewMemberAge('');
    }
  }, [isOpen]);

  const handleAddMember = () => {
    if (!newMemberName.trim()) {
      toast.error('Enter member name');
      return;
    }
    setEntry(prev => ({
      ...prev,
      groupMembers: [...prev.groupMembers, { id: Date.now().toString(), name: newMemberName.trim(), age: newMemberAge ? parseInt(newMemberAge) : null }]
    }));
    setNewMemberName('');
    setNewMemberAge('');
  };

  const handleRemoveMember = (id) => {
    setEntry(prev => ({ ...prev, groupMembers: prev.groupMembers.filter(m => m.id !== id) }));
  };

  const validateGroupMembers = () => {
    const count = entry.groupMembers.length;
    const div = entry.divisionType;
    if (div === 'Duo') return count === 2;
    if (div === 'Trio') return count === 3;
    if (div === 'Small Group (4-10)') return count >= 4 && count <= 10;
    if (div === 'Large Group (11+)') return count >= 11;
    if (div === 'Production (10+)') return count >= 10;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!entry.name.trim() && entry.type === 'solo') {
      toast.error('Please enter dancer name');
      return;
    }
    const groupMembersForValidation = entry.type === 'group'
      ? entry.groupMembers.map(m => ({ name: m.name || '', age: m.age ? parseInt(m.age) : null }))
      : [];
    const oldestGroupAge = getOldestMemberAge(groupMembersForValidation);
    const resolvedAge = entry.type === 'group' ? (parseInt(entry.age, 10) || oldestGroupAge) : parseInt(entry.age, 10);

    if (!resolvedAge || resolvedAge < 1 || resolvedAge > 99) {
      toast.error(entry.type === 'group'
        ? 'Please enter a valid oldest-member age, or add ages for the group members.'
        : 'Please enter a valid age (1-99)'
      );
      return;
    }

    const matchingAgeDivision = findMatchingAgeDivision(resolvedAge, ageDivisions);
    if (!matchingAgeDivision) {
      toast.error(`Age ${resolvedAge} does not fit any configured age division. Please correct the age division setup before saving.`);
      return;
    }
    if (!entry.categoryId) {
      toast.error('Please select a category');
      return;
    }
    if (!entry.abilityLevel) {
      toast.error('Please select an ability level');
      return;
    }

    const category = categories.find(c => c.id === entry.categoryId);
    const categoryName = category?.name || '';

    if (categoryName.includes('Variety F - Ballroom')) {
      if (entry.type === 'solo') {
        toast.error('Variety F - Ballroom requires couples or groups of couples (2+ members). Solo entries are not allowed.');
        return;
      }
      if (entry.type === 'group' && entry.groupMembers.length < 2) {
        toast.error('Variety F - Ballroom requires at least 2 members (couples or groups of couples).');
        return;
      }
    }
    if (categoryName.includes('Variety G - Line Dancing')) {
      if (entry.type === 'solo') {
        toast.error('Variety G - Line Dancing requires at least 3 contestants. Solo entries are not allowed.');
        return;
      }
      if (entry.type === 'group' && entry.groupMembers.length < 3) {
        toast.error('Variety G - Line Dancing requires at least 3 contestants in the routine.');
        return;
      }
    }

    if (entry.type === 'group') {
      if (!validateGroupMembers()) {
        const div = entry.divisionType;
        if (div === 'Duo') toast.error('Duo must have exactly 2 members');
        else if (div === 'Trio') toast.error('Trio must have exactly 3 members');
        else if (div === 'Small Group (4-10)') toast.error('Small Group must have 4-10 members');
        else if (div === 'Large Group (11+)') toast.error('Large Group must have 11+ members');
        else if (div === 'Production (10+)') toast.error('Production must have 10+ members');
        return;
      }
    }

    setSaving(true);
    try {
      const numResult = await getNextEntryNumber(competitionId);
      const entryNumber = numResult.success ? numResult.data : 1;

      const cleanedGroupMembers = entry.type === 'group' && entry.groupMembers.length > 0
        ? entry.groupMembers.map(m => ({ name: m.name || '', age: m.age ? parseInt(m.age) : null }))
        : [];
      const savedDivisionType = normalizeDivisionTypeForSave(entry.divisionType);
      const performanceName = buildRoutineDisplayName(entry, cleanedGroupMembers);

      const entryData = {
        competition_id: competitionId,
        entry_number: entryNumber,
        competitor_name: performanceName,
        age: resolvedAge,
        category_id: entry.categoryId || null,
        age_division_id: matchingAgeDivision.id,
        ability_level: entry.abilityLevel,
        is_medal_program: entry.isMedalProgram,
        division_type: entry.type === 'solo' ? 'Solo' : savedDivisionType,
        dance_type: categoryName || savedDivisionType,
        group_members: entry.type === 'group' ? cleanedGroupMembers : null,
        photo_url: null,
        studio_name: entry.studioName?.trim() || null,
        teacher_name: entry.teacherName?.trim() || null
      };

      const result = await createEntry(entryData);
      if (!result.success) throw new Error(result.error);

      toast.success('Entry added successfully!');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error adding entry:', err);
      toast.error(err.message || 'Failed to add entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const danceCats = categories.filter(c => DANCE_CATEGORIES.some(d => d.name === c.name));
  const varietyCats = categories.filter(c => VARIETY_CATEGORIES.some(v => v.name === c.name));
  const specialCats = categories.filter(c => SPECIAL_CATEGORIES.some(s => s.name === c.name));
  const cleanedMembersForAgeLock = entry.type === 'group'
    ? entry.groupMembers.map(m => ({ name: m.name || '', age: m.age ? parseInt(m.age, 10) : null }))
    : [];
  const oldestAgeForLock = getOldestMemberAge(cleanedMembersForAgeLock);
  const lockedAge = entry.type === 'group' ? (oldestAgeForLock || parseInt(entry.age, 10)) : parseInt(entry.age, 10);
  const lockedAgeDivision = findMatchingAgeDivision(lockedAge, ageDivisions);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-xl font-bold">Add New Entry</h2>
          <button type="button" onClick={onClose} className="text-white hover:text-gray-200 text-2xl font-bold leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{competition?.name}</p>

          {/* Entry Type */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Entry Type *</label>
            <select
              value={entry.type}
              onChange={(e) => setEntry({ ...entry, type: e.target.value, divisionType: e.target.value === 'solo' ? 'Solo' : 'Duo' })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
            >
              <option value="solo">Solo</option>
              <option value="group">Group</option>
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Name *</label>
            <input
              type="text"
              value={entry.name}
              onChange={(e) => setEntry({ ...entry, name: e.target.value })}
              placeholder={entry.type === 'solo' ? 'Dancer name' : 'Group name (optional)'}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
            />
          </div>

          {/* Age */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Age * {entry.type === 'group' && '(Oldest member)'}</label>
            <input
              type="number"
              min="1"
              max="99"
              value={entry.age}
              onChange={(e) => setEntry({ ...entry, age: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Category *</label>
            <select
              value={entry.categoryId}
              onChange={(e) => setEntry({ ...entry, categoryId: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
            >
              <option value="">Select a category...</option>
              {danceCats.length > 0 && (
                <optgroup label="Performing Arts">
                  {danceCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
              {varietyCats.length > 0 && (
                <optgroup label="Variety Arts">
                  {varietyCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
              {specialCats.length > 0 && (
                <optgroup label="Special">
                  {specialCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>

          {/* Age Division - locked from age */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Age Division</label>
            <div className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-800 font-semibold">
              {lockedAge ? formatAgeDivisionLabel(lockedAgeDivision) : 'Enter age to auto-select division'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Age division is locked automatically by age{entry.type === 'group' ? ' using the oldest dancer age' : ''}.
            </p>
          </div>

          {/* Ability Level */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Ability Level *</label>
            <select
              value={entry.abilityLevel}
              onChange={(e) => setEntry({ ...entry, abilityLevel: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
            >
              <option value="Beginning">Beginning (Less than 2 years)</option>
              <option value="Intermediate">Intermediate (2-4 years)</option>
              <option value="Advanced">Advanced (5+ years)</option>
            </select>
          </div>

          {/* Division Type */}
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Division Type *</label>
            <select
              value={entry.divisionType}
              onChange={(e) => setEntry({ ...entry, divisionType: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
            >
              {getDivisionTypeOptions(entry.type).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Group Members */}
          {entry.type === 'group' && (
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Group Members ({entry.groupMembers.length})</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={newMemberAge}
                  onChange={(e) => setNewMemberAge(e.target.value)}
                  placeholder="Age"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button type="button" onClick={handleAddMember} className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600">
                  Add
                </button>
              </div>
              <ul className="space-y-1">
                {entry.groupMembers.map(m => (
                  <li key={m.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                    <span>{m.name}{m.age ? ` (${m.age})` : ''}</span>
                    <button type="button" onClick={() => handleRemoveMember(m.id)} className="text-red-600 hover:text-red-800 text-sm font-semibold">Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Medal Program */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={entry.isMedalProgram}
                onChange={(e) => setEntry({ ...entry, isMedalProgram: e.target.checked })}
                className="w-5 h-5"
              />
              <span className="text-gray-700 font-semibold">Include in Medal Program</span>
            </label>
          </div>

          {/* Studio / Teacher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Studio (optional)</label>
              <input
                type="text"
                value={entry.studioName}
                onChange={(e) => setEntry({ ...entry, studioName: e.target.value })}
                placeholder="Studio name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Teacher (optional)</label>
              <input
                type="text"
                value={entry.teacherName}
                onChange={(e) => setEntry({ ...entry, teacherName: e.target.value })}
                placeholder="Teacher name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
