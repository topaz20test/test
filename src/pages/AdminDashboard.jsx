import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import PhotoUploadManager from '../components/PhotoUploadManager';
import MusicUploadManager from '../components/MusicUploadManager';
import { getCompetition } from '../supabase/competitions';
import { getCompetitionCategories } from '../supabase/categories';
import { getCompetitionAgeDivisions } from '../supabase/ageDivisions';
import { getCompetitionEntries } from '../supabase/entries';
import { getAdminFilters, updateAdminFilters, clearAdminFilters, subscribeToAdminFilters } from '../supabase/adminFilters';
import { resetMedalPointsForCompetition } from '../supabase/medalParticipants';
import {
  ageFilterMatchesEntry,
  abilitiesMatch,
  entryMatchesCategoryId,
  getDisplayCategoryName,
  getEntryAgeGroupLabel,
  getEntryDivisionType,
  matchesDivisionTypeFilter,
  matchesSpecialCategoryDivisionFilter,
  groupEntries,
  formatEntryName,
  getAbilityLevel,
  getGroupMemberNamesLabel
} from '../utils/entryFilters';

function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateId = location.state?.competitionId;
  const savedId = (() => {
    try { return sessionStorage.getItem('topaz_active_competition_id'); } catch (e) { return null; }
  })();
  const competitionId = stateId || savedId || null;

  // Persist for recovery on refresh
  useEffect(() => {
    if (competitionId) {
      try { sessionStorage.setItem('topaz_active_competition_id', competitionId); } catch (e) { /* ignore */ }
    }
  }, [competitionId]);

  // State
  const [competition, setCompetition] = useState(null);
  const [categories, setCategories] = useState([]);
  const [ageDivisions, setAgeDivisions] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Admin filter state
  const [adminFilters, setAdminFilters] = useState({
    category_filter: null,
    division_type_filter: 'all',
    age_division_filter: null,
    ability_filter: 'all'
  });
  
  const [saving, setSaving] = useState(false);
  const [resettingMedalPoints, setResettingMedalPoints] = useState(false);
  const [showPhotoManager, setShowPhotoManager] = useState(false);
  const [showMusicManager, setShowMusicManager] = useState(false);

  // Redirect if no competitionId
  useEffect(() => {
    if (!competitionId) {
      toast.error('No competition selected');
      navigate('/');
    }
  }, [competitionId, navigate]);

  // Load competition data
  useEffect(() => {
    const loadData = async () => {
      if (!competitionId) return;

      try {
        setLoading(true);
        const [compResult, catsResult, divsResult, entriesResult, filtersResult] = await Promise.all([
          getCompetition(competitionId),
          getCompetitionCategories(competitionId),
          getCompetitionAgeDivisions(competitionId),
          getCompetitionEntries(competitionId),
          getAdminFilters(competitionId)
        ]);

        if (!compResult.success) throw new Error(compResult.error);

        setCompetition(compResult.data);
        setCategories(catsResult.success ? catsResult.data : []);
        setAgeDivisions(divsResult.success ? divsResult.data : []);
        setAllEntries(entriesResult.success ? entriesResult.data : []);
        
        if (filtersResult.success && filtersResult.data) {
          const rawDiv = filtersResult.data.division_type_filter;
          const divFilter =
            rawDiv == null || rawDiv === '' || String(rawDiv).toLowerCase() === 'all'
              ? 'all'
              : rawDiv;
          setAdminFilters({
            category_filter: filtersResult.data.category_filter || null,
            division_type_filter: divFilter,
            age_division_filter: filtersResult.data.age_division_filter || null,
            ability_filter: filtersResult.data.ability_filter || 'all'
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading admin dashboard:', error);
        toast.error(`Failed to load data: ${error.message}`);
        setLoading(false);
      }
    };

    loadData();
  }, [competitionId]);

  // Subscribe to filter changes (for real-time updates from other admins)
  useEffect(() => {
    if (!competitionId) return;

    const channel = subscribeToAdminFilters(competitionId, (newFilters) => {
      console.log('🔔 Admin panel received filter sync:', newFilters);
      const rawDiv = newFilters.division_type_filter;
      const divFilter =
        rawDiv == null || rawDiv === '' || String(rawDiv).toLowerCase() === 'all'
          ? 'all'
          : rawDiv;
      setAdminFilters({
        category_filter: newFilters.category_filter ?? null,
        division_type_filter: divFilter,
        age_division_filter: newFilters.age_division_filter ?? null,
        ability_filter: newFilters.ability_filter ?? 'all'
      });
      // No toast - admin sees their own success message; other tabs get silent sync
    });

    return () => {
      channel.unsubscribe();
    };
  }, [competitionId]);

  // Calculate filtered entries (preview what judges see)
  const filteredEntries = (() => {
    let filtered = [...allEntries];

    // Filter by category (UUID + normalized style for website-synced rows)
    if (adminFilters.category_filter) {
      filtered = filtered.filter((e) =>
        entryMatchesCategoryId(e, adminFilters.category_filter, categories)
      );
    }

    // Filter by division type. Special Category options match by category, not routine division.
    if (adminFilters.division_type_filter && adminFilters.division_type_filter !== 'all') {
      filtered = filtered.filter((e) =>
        matchesDivisionTypeFilter(e, adminFilters.division_type_filter) ||
        matchesSpecialCategoryDivisionFilter(e, adminFilters.division_type_filter, categories)
      );
    }

    // Filter by age division
    if (adminFilters.age_division_filter) {
      filtered = filtered.filter((e) =>
        ageFilterMatchesEntry(e, adminFilters.age_division_filter, ageDivisions)
      );
    }

    // Filter by ability level
    if (adminFilters.ability_filter && adminFilters.ability_filter !== 'all') {
      filtered = filtered.filter((e) => abilitiesMatch(e.ability_level, adminFilters.ability_filter));
    }

    // Match the judge screen: show one scoring card per routine.
    // Duo/Trio/Group/Production entries may have multiple participant rows,
    // but admins and judges should see one performance entry for filtering/scoring.
    const { primary } = groupEntries(filtered);
    return primary.sort((a, b) => (a.entry_number || 0) - (b.entry_number || 0));
  })();

  // Update a single filter
  const handleFilterChange = async (filterType, value) => {
    console.log('🎛️ Admin filter change:', { filterType, value });
    const newFilters = {
      ...adminFilters,
      [filterType]: value === 'all' ? null : value
    };
    // Special handling for division_type and ability (they use 'all' string)
    if (filterType === 'division_type_filter' || filterType === 'ability_filter') {
      newFilters[filterType] = value;
    }

    setAdminFilters(newFilters);
    setSaving(true);

    try {
      const result = await updateAdminFilters(competitionId, newFilters);
      if (result.success) {
        console.log('🎛️ Filters saved successfully, judges will receive via realtime');
        toast.success('Filters updated! Judge screens will update within 1–2 seconds.', { autoClose: 2500 });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('🎛️ Filter update failed:', error);
      toast.error(`Failed to update filters: ${error.message}`);
      setAdminFilters(adminFilters); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  // Reset medal points for this competition (test competitions)
  const handleResetMedalPoints = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset ALL medal points for this competition?\n\n' +
      'This will set all medal program entries to 0 points and "None" medal level. ' +
      'Medal award records for this competition will be removed so you can re-award points.\n\n' +
      'This cannot be undone.'
    );
    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      'FINAL CONFIRMATION: Reset all medal points to 0 for this competition?'
    );
    if (!doubleConfirmed) return;

    setResettingMedalPoints(true);
    try {
      const result = await resetMedalPointsForCompetition(competitionId);
      if (result.success) {
        toast.success(`Successfully reset medal points for ${result.resetCount || 0} entries. You can now re-award points.`, { autoClose: 5000 });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error resetting medal points:', error);
      toast.error(`Failed to reset medal points: ${error.message}`);
    } finally {
      setResettingMedalPoints(false);
    }
  };

  // Clear all filters (no confirmation — quick reset for stuck admin/judge views)
  const handleClearFilters = async () => {
    setSaving(true);
    try {
      const result = await clearAdminFilters(competitionId);
      if (result.success) {
        setAdminFilters({
          category_filter: null,
          division_type_filter: 'all',
          age_division_filter: null,
          ability_filter: 'all'
        });
        toast.success('All filters cleared! All judges will see all entries.', { autoClose: 2000 });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error clearing filters:', error);
      toast.error(`Failed to clear filters: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const refreshEntries = async () => {
    if (!competitionId) return;
    const entriesResult = await getCompetitionEntries(competitionId);
    if (entriesResult.success) {
      setAllEntries(entriesResult.data || []);
    }
  };

  if (loading) {
    return (
      <Layout overlayOpacity="bg-white/80">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading admin dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!competition) {
    return (
      <Layout overlayOpacity="bg-white/80">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 text-lg mb-4">Competition not found</p>
          <button
            type="button"
            onClick={() => navigate('/')}
              className="px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
            >
              Back to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout overlayOpacity="bg-white/90">
      <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate('/judge-selection', { state: { competitionId } })}
              className="text-gray-600 hover:text-gray-800 text-base sm:text-lg font-semibold flex items-center min-h-[44px] px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              ← Back to Competition
            </button>

            <div className="text-center flex-1 px-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                🎛️ Admin Control Panel
              </h1>
              <p className="text-teal-600 font-semibold text-sm sm:text-base">
                {competition.name}
              </p>
            </div>

            <div className="w-36"></div> {/* Spacer for centering */}
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            {Array.from({ length: competition?.judges_count || 3 }, (_, i) => i + 1).map((judgeNum) => {
              const judgeName = competition?.judge_names?.[judgeNum - 1] || `Judge ${judgeNum}`;
              return (
                <button
                  key={judgeNum}
                  type="button"
                  onClick={() => navigate('/scoring', { state: { competitionId, judgeNumber: judgeNum } })}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  View {judgeName}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowPhotoManager(true)}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              📸 Manage Entry Photos
            </button>
            <button
              type="button"
              onClick={() => setShowMusicManager(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              🎵 Manage Entry Music
            </button>
            <button
              type="button"
              onClick={() => navigate('/results', {
                state: {
                  competitionId,
                  isAdmin: true,
                  competition,
                  categories,
                  ageDivisions,
                  entries: allEntries
                }
              })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              📊 Admin View
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="text-lg font-bold text-blue-800 mb-2">ℹ️ How This Works</h3>
          <p className="text-sm text-blue-700">
            These filters control what <strong>ALL judges</strong> see on their scoring screens. 
            Changes apply immediately and update all judge screens in real-time. 
            Judges cannot change these filters themselves.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Filter Controls for All Judges</h2>
            <button
              onClick={handleClearFilters}
              disabled={saving}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold disabled:opacity-50"
            >
              Clear All Filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Filter by Category
              </label>
              <select
                value={adminFilters.category_filter || 'all'}
                onChange={(e) => handleFilterChange('category_filter', e.target.value)}
                disabled={saving}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none disabled:opacity-50"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Division Type Filter */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Filter by Division Type
              </label>
              <select
                value={adminFilters.division_type_filter || 'all'}
                onChange={(e) => handleFilterChange('division_type_filter', e.target.value)}
                disabled={saving}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none disabled:opacity-50"
              >
                <option value="all">All Division Types</option>
                <option value="Solo">Solo</option>
                <option value="Duo">Duo</option>
                <option value="Trio">Trio</option>
                <option value="Small Group">Small Group</option>
                <option value="Large Group">Large Group</option>
                <option value="Production">Production</option>
                <option value="Student Choreography">Student Choreography</option>
                <option value="Teacher/Student">Teacher/Student</option>
              </select>
            </div>

            {/* Age Division Filter */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Filter by Age Division
              </label>
              <select
                value={adminFilters.age_division_filter || 'all'}
                onChange={(e) => handleFilterChange('age_division_filter', e.target.value)}
                disabled={saving}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none disabled:opacity-50"
              >
                <option value="all">All Ages</option>
                {ageDivisions.map(div => (
                  <option key={div.id} value={div.id}>
                    {div.name} ({div.min_age}-{div.max_age === 99 ? '13+' : div.max_age})
                  </option>
                ))}
              </select>
            </div>

            {/* Ability Level Filter */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Filter by Ability Level
              </label>
              <select
                value={adminFilters.ability_filter || 'all'}
                onChange={(e) => handleFilterChange('ability_filter', e.target.value)}
                disabled={saving}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none disabled:opacity-50"
              >
                <option value="all">All Levels</option>
                <option value="Beginning">Beginning</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>

          {saving && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 text-teal-600">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent"></div>
                <span className="text-sm font-semibold">Updating filters...</span>
              </div>
            </div>
          )}
        </div>

        {/* Medal Points Management */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-amber-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Medal Points Management</h2>
          <p className="text-sm text-gray-600 mb-4">
            Reset medal points for this competition. Use this to clear test data. Entries will be set to 0 points and &quot;None&quot; medal level. You can then re-award points.
          </p>
          <button
            type="button"
            onClick={handleResetMedalPoints}
            disabled={resettingMedalPoints}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {resettingMedalPoints ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Resetting...
              </>
            ) : (
              <>
                <span>⚠️</span>
                Reset Medal Points for This Competition
              </>
            )}
          </button>
        </div>

        {/* Preview Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Current View (What Judges See)</h2>
          
          <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-teal-800">
                  Showing {filteredEntries.length} of {allEntries.length} entries
                </p>
                <p className="text-sm text-teal-700 mt-1">
                  All judges will see these {filteredEntries.length} entries on their scoring screens
                </p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          {/* Entry List Preview */}
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-gray-600 text-lg">No entries match the current filters</p>
              <p className="text-gray-500 text-sm mt-2">Judges will see an empty list</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {filteredEntries.slice(0, 50).map(entry => (
                  <div
                    key={entry.id}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-gray-800">
                        {formatEntryName(entry)}
                      </span>
                      <div className="text-sm text-gray-600 mt-1">
                        {getDisplayCategoryName(entry, categories)} • 
                        {getEntryDivisionType(entry)} • 
                        {getEntryAgeGroupLabel(entry, ageDivisions)} •{' '}
                        {getAbilityLevel(entry)}
                      </div>
                      {getEntryDivisionType(entry) !== 'Solo' && getGroupMemberNamesLabel(entry) && (
                        <div className="text-sm text-gray-700 mt-1 font-medium">
                          Dancers: {getGroupMemberNamesLabel(entry)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredEntries.length > 50 && (
                  <div className="text-center text-gray-500 text-sm py-2">
                    ... and {filteredEntries.length - 50} more entries
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {showPhotoManager && (
        <PhotoUploadManager
          competitionId={competitionId}
          onClose={async () => {
            setShowPhotoManager(false);
            await refreshEntries();
          }}
        />
      )}
      {showMusicManager && (
        <MusicUploadManager
          competitionId={competitionId}
          onClose={async () => {
            setShowMusicManager(false);
            await refreshEntries();
          }}
        />
      )}
    </Layout>
  );
}

export default AdminDashboard;

