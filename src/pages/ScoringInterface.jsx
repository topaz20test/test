import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import Layout from '../components/Layout';
import EmptyState from '../components/EmptyState';
import AbilityBadge from '../components/AbilityBadge';
import { getEntryScores, upsertJudgeScore } from '../supabase/scores';
import { validateScore } from '../utils/calculations';
import { getAdminFilters, subscribeToAdminFilters } from '../supabase/adminFilters';
import { getCompetition } from '../supabase/competitions';
import { getCompetitionCategories } from '../supabase/categories';
import { getCompetitionAgeDivisions } from '../supabase/ageDivisions';
import { getCompetitionEntries } from '../supabase/entries';
import { unlockJudgeMode, verifyAdminPassword } from '../utils/accessControl';
import {
  ageFilterMatchesEntry,
  abilitiesMatch,
  entryMatchesCategoryId,
  getDisplayCategoryName,
  getEntryDivisionType,
  getEntryAgeGroupLabel,
  matchesDivisionTypeFilter,
  matchesSpecialCategoryDivisionFilter,
  groupEntries,
  formatEntryName,
  getAbilityLevel,
  entryMatchesSearchQuery,
  getMemberCount,
  getGroupMemberNamesLabel,
  cleanDisplayText
} from '../utils/entryFilters';
import { pickReconciledJudgeScore } from '../utils/scoreReconciliation';

function ScoringInterface() {
  const navigate = useNavigate();
  const location = useLocation();

  const stateData = location.state || {};
  const stateId = stateData.competitionId;
  const stateJudge = stateData.judgeNumber;
  const savedId = (() => {
    try { return sessionStorage.getItem('topaz_active_competition_id'); } catch (e) { return null; }
  })();
  const savedJudge = (() => {
    try { const n = sessionStorage.getItem('topaz_active_judge_number'); return n ? parseInt(n, 10) : null; } catch (e) { return null; }
  })();

  const competitionId = stateId || savedId || null;
  const judgeNumber = stateJudge ?? savedJudge ?? null;

  // Data from state (when navigating from Judge Selection) or loaded from API (after refresh)
  const [loadedCompetition, setLoadedCompetition] = useState(null);
  const [loadedCategories, setLoadedCategories] = useState([]);
  const [loadedAgeDivisions, setLoadedAgeDivisions] = useState([]);
  const [loadedEntries, setLoadedEntries] = useState([]);

  const competition = stateData.competition || loadedCompetition;
  const categories = stateData.categories?.length ? stateData.categories : loadedCategories;
  const ageDivisions = stateData.ageDivisions?.length ? stateData.ageDivisions : loadedAgeDivisions;
  const allEntries = stateData.entries?.length ? stateData.entries : loadedEntries;

  console.log('🎯 ScoringInterface render - State:', { 
    competitionId, 
    judgeNumber, 
    hasCompetition: !!competition,
    categoriesCount: categories.length,
    ageDivisionsCount: ageDivisions.length,
    entriesCount: allEntries.length
  });

  // Logo paths
  const logoPath = '/logo.png';
  const leftImagePath = '/left-dancer.png';
  const rightImagePath = '/right-dancer.png';

  // State - Entries and Filtering
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentEntry, setCurrentEntry] = useState(null);

  // State - Admin Filters (controlled by admin, not judge)
  const [adminFilters, setAdminFilters] = useState({
    category_filter: null,
    division_type_filter: 'all',
    age_division_filter: null,
    ability_filter: 'all'
  });
  
  // Search query (only filter judges can control)
  const [searchQuery, setSearchQuery] = useState('');

  // State - Scoring Form
  const [technique, setTechnique] = useState('');
  const [creativity, setCreativity] = useState('');
  const [presentation, setPresentation] = useState('');
  const [appearance, setAppearance] = useState('');
  const [notes, setNotes] = useState('');
  const [total, setTotal] = useState(0);

  // State - Tracking
  const [scoredEntries, setScoredEntries] = useState(new Set());
  const [existingScoreId, setExistingScoreId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // State - UI
  const [showEntryList, setShowEntryList] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(false);

  const siblingMapRef = useRef(new Map());

  // Load competition data from API when state is empty (e.g. after refresh)
  useEffect(() => {
    if (!competitionId || stateData.competition || loadedCompetition) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [compRes, catsRes, divsRes, entriesRes] = await Promise.all([
          getCompetition(competitionId),
          getCompetitionCategories(competitionId),
          getCompetitionAgeDivisions(competitionId),
          getCompetitionEntries(competitionId)
        ]);
        if (cancelled) return;
        if (compRes.success && compRes.data) setLoadedCompetition(compRes.data);
        if (catsRes.success && catsRes.data) setLoadedCategories(catsRes.data);
        if (divsRes.success && divsRes.data) setLoadedAgeDivisions(divsRes.data);
        if (entriesRes.success && entriesRes.data) setLoadedEntries(entriesRes.data);
      } catch (e) {
        if (!cancelled) console.error('Failed to load competition data:', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [competitionId, stateData.competition, loadedCompetition]);

  // Load admin filters and subscribe to changes
  useEffect(() => {
    if (!competitionId) return;

    // Load initial admin filters
    const loadFilters = async () => {
      try {
        const result = await getAdminFilters(competitionId);
        if (result.success && result.data) {
          const rawDiv = result.data.division_type_filter;
          const divFilter =
            rawDiv == null || rawDiv === '' || String(rawDiv).toLowerCase() === 'all'
              ? 'all'
              : rawDiv;
          setAdminFilters({
            category_filter: result.data.category_filter || null,
            division_type_filter: divFilter,
            age_division_filter: result.data.age_division_filter || null,
            ability_filter: result.data.ability_filter || 'all'
          });
        }
      } catch (error) {
        console.error('Error loading admin filters:', error);
      }
    };

    loadFilters();

    // Subscribe to real-time filter changes
    const channel = subscribeToAdminFilters(competitionId, (newFilters) => {
      console.log('🔔 Judge screen received filter update:', newFilters);
      const rawDiv = newFilters.division_type_filter;
      const divFilter =
        rawDiv == null || rawDiv === '' || String(rawDiv).toLowerCase() === 'all'
          ? 'all'
          : rawDiv;
      const updated = {
        category_filter: newFilters.category_filter ?? null,
        division_type_filter: divFilter,
        age_division_filter: newFilters.age_division_filter ?? null,
        ability_filter: newFilters.ability_filter ?? 'all'
      };
      setAdminFilters(updated);
      console.log('🔔 Judge filters applied, filtered count will update');
      toast.info('Filters updated by admin', { autoClose: 2000 });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [competitionId]);

  // Redirect if missing ids; otherwise collapse group routines to primary rows only
  useEffect(() => {
    if (!competitionId || !judgeNumber) {
      toast.error('Missing competition data. Please start from the home page.');
      setTimeout(() => {
        navigate('/judge-selection', { state: { competitionId: competitionId || undefined } });
      }, 1500);
      return;
    }
    const raw = Array.isArray(allEntries) ? allEntries : [];
    const { primary, siblingMap } = groupEntries(raw);
    siblingMapRef.current = siblingMap;
    setEntries(primary);
    setLoading(false);
  }, [competitionId, judgeNumber, allEntries, navigate]);

  // Debug: Log all unique division types in entries
  useEffect(() => {
    if (entries.length > 0) {
      const uniqueTypes = [...new Set(entries.map(e => {
        const raw = e.dance_type || 'Solo';
        const normalized = getEntryDivisionType(e);
        return `${raw} -> ${normalized}`;
      }))];
      console.log('📊 All unique division types in entries:', uniqueTypes);
    }
  }, [entries]);

  // Filter primary entries using admin filters + search (entries are already one row per routine)
  useEffect(() => {
    let filtered = [...entries];

    if (adminFilters.category_filter) {
      filtered = filtered.filter((e) =>
        entryMatchesCategoryId(e, adminFilters.category_filter, categories)
      );
    }

    if (adminFilters.division_type_filter && adminFilters.division_type_filter !== 'all') {
      filtered = filtered.filter((e) =>
        matchesDivisionTypeFilter(e, adminFilters.division_type_filter) ||
        matchesSpecialCategoryDivisionFilter(e, adminFilters.division_type_filter, categories)
      );
    }

    if (adminFilters.age_division_filter) {
      filtered = filtered.filter((e) =>
        ageFilterMatchesEntry(e, adminFilters.age_division_filter, ageDivisions)
      );
    }

    if (adminFilters.ability_filter && adminFilters.ability_filter !== 'all') {
      filtered = filtered.filter((e) => abilitiesMatch(e.ability_level, adminFilters.ability_filter));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => entryMatchesSearchQuery(e, query));
    }

    filtered.sort((a, b) => (a.entry_number || 0) - (b.entry_number || 0));

    setFilteredEntries(filtered);
    setCurrentIndex(0);
    setCurrentEntry(filtered[0] || null);
  }, [adminFilters, searchQuery, entries, categories, ageDivisions]);

  // Auto-calculate total
  useEffect(() => {
    const t = parseFloat(technique) || 0;
    const c = parseFloat(creativity) || 0;
    const p = parseFloat(presentation) || 0;
    const a = parseFloat(appearance) || 0;
    setTotal(t + c + p + a);
  }, [technique, creativity, presentation, appearance]);

  // Load existing score for current entry (merged routines: reconcile conflicting rows per judge)
  useEffect(() => {
    const loadExistingScore = async () => {
      if (!currentEntry) return;

      const routineGroup = [
        currentEntry,
        ...(siblingMapRef.current.get(currentEntry.id) || [])
      ];

      try {
        const candidates = [];

        for (const ent of routineGroup) {
          const result = await getEntryScores(ent.id);
          if (!result.success || !result.data) continue;
          const judgeScore = result.data.find((s) => s.judge_number === judgeNumber);
          if (judgeScore) {
            candidates.push({ entry: ent, score: judgeScore });
          }
        }

        if (candidates.length === 0) {
          clearForm();
          return;
        }

        const judgeScore = pickReconciledJudgeScore(candidates, currentEntry.id);

        setTechnique(judgeScore.technique.toString());
        setCreativity(judgeScore.creativity.toString());
        setPresentation(judgeScore.presentation.toString());
        setAppearance(judgeScore.appearance.toString());
        setNotes(judgeScore.notes || '');
        setExistingScoreId(judgeScore.id);

        setScoredEntries((prev) => {
          const next = new Set(prev);
          routineGroup.forEach((e) => next.add(e.id));
          return next;
        });
      } catch (error) {
        console.error('Error loading existing score:', error);
        clearForm();
      }
    };

    loadExistingScore();
  }, [currentEntry, judgeNumber, entries]);

  // Clear form
  const clearForm = () => {
    setTechnique('');
    setCreativity('');
    setPresentation('');
    setAppearance('');
    setNotes('');
    setExistingScoreId(null);
  };

  // Validate scores
  const validateScores = () => {
    // Check if all fields have values
    if (!technique || !creativity || !presentation || !appearance) {
      toast.error('Please enter all scores (Technique, Creativity, Presentation, Appearance)');
      return false;
    }

    // Validate each score is in range 0-25
    const errors = [];
    const techValidation = validateScore(technique);
    if (!techValidation.valid) errors.push(`Technique: ${techValidation.error}`);
    
    const creatValidation = validateScore(creativity);
    if (!creatValidation.valid) errors.push(`Creativity: ${creatValidation.error}`);
    
    const presValidation = validateScore(presentation);
    if (!presValidation.valid) errors.push(`Presentation: ${presValidation.error}`);
    
    const appearValidation = validateScore(appearance);
    if (!appearValidation.valid) errors.push(`Appearance: ${appearValidation.error}`);

    if (errors.length > 0) {
      toast.error(`Invalid scores:\n${errors.join('\n')}`);
      return false;
    }

    // Check total doesn't exceed 100
    if (total > 100) {
      toast.error('Total score cannot exceed 100');
      return false;
    }

    return true;
  };

  // Save score to Supabase
  const handleSave = async (moveNext = true) => {
    if (!validateScores()) return false;

    if (!currentEntry) {
      toast.error('No entry selected');
      return false;
    }

    try {
      setSaving(true);

      const scorePayload = {
        competition_id: competitionId,
        judge_number: judgeNumber,
        technique: parseFloat(technique),
        creativity: parseFloat(creativity),
        presentation: parseFloat(presentation),
        appearance: parseFloat(appearance),
        notes: notes.trim() || null
      };

      // Groups/duos/trios are scored as ONE performance entry.
      // Sibling rows may exist from older imports, but the canonical saved score
      // belongs only to the primary/current entry to avoid duplicate score rows.
      const result = await upsertJudgeScore({
        ...scorePayload,
        entry_id: currentEntry.id
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      setExistingScoreId(result.data?.id ?? null);

      toast.success('Score saved!');
      
      setScoredEntries((prev) => {
        const next = new Set(prev);
        next.add(currentEntry.id);
        return next;
      });

      // Move to next entry if requested
      if (moveNext) {
        moveToNextEntry();
      }

      setSaving(false);
      return true;
    } catch (error) {
      console.error('❌ Save error:', error);
      toast.error(`Failed to save: ${error.message}`);
      setSaving(false);
      return false;
    }
  };

  // Navigation functions
  const moveToNextEntry = () => {
    if (currentIndex < filteredEntries.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentEntry(filteredEntries[currentIndex + 1]);
    }
  };

  const moveToPreviousEntry = async () => {
    // Save current entry first
    const saved = await handleSave(false);
    if (saved && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setCurrentEntry(filteredEntries[currentIndex - 1]);
    }
  };

  const jumpToEntry = async (index) => {
    // Save current entry first if scores entered
    if (technique || creativity || presentation || appearance) {
      await handleSave(false);
    }
    setCurrentIndex(index);
    setCurrentEntry(filteredEntries[index]);
    setShowEntryList(false);
  };

  // Handle finish
  const handleFinish = async () => {
    // Save current entry first
    const saved = await handleSave(false);
    if (!saved) return;

    if (window.confirm('Submit all scores and view results?')) {
      navigate('/results', {
        state: {
          competitionId,
          competition,
          categories,
          ageDivisions,
          entries: Array.isArray(allEntries) ? allEntries : entries
        }
      });
    }
  };

  const getCategoryNameForEntry = (entry) => getDisplayCategoryName(entry, categories);

  const getEntryAgeLabel = (entry) => getEntryAgeGroupLabel(entry, ageDivisions);

  const getScoringSidebarLine = (entry) => {
    const base = formatEntryName(entry);
    const div = getEntryDivisionType(entry);
    if (!div || div === 'Solo') return base;
    const names = getGroupMemberNamesLabel(entry);
    const memberCount = getMemberCount(entry);
    const memberPart = names || (memberCount > 0 ? `${memberCount} members` : '');
    return memberPart ? `${base} (${div} • ${memberPart})` : `${base} (${div})`;
  };

  const isNonSoloDivision = (entry) => getEntryDivisionType(entry) !== 'Solo';

  const displayValue = (value) => cleanDisplayText(value, 'N/A');

  const getStudioName = (entry) => displayValue(entry?.studio_name || entry?.studio || entry?.school_name);
  const getTeacherName = (entry) => displayValue(entry?.teacher_name || entry?.teacher || entry?.instructor_name);
  const getEntryAgeValue = (entry) => displayValue(entry?.age ?? entry?.participant_age);

  // Calculate progress
  const calculateProgress = () => {
    const scored = filteredEntries.filter(e => scoredEntries.has(e.id)).length;
    const total = filteredEntries.length;
    const percentage = total > 0 ? (scored / total) * 100 : 0;
    return { scored, total, percentage };
  };

  // Get color for total score
  const getTotalColor = () => {
    if (total >= 85) return 'text-green-600';
    if (total >= 70) return 'text-yellow-600';
    return 'text-orange-600';
  };

  // Parse group members from legacy dance_type field
  const parseGroupMembersFromDanceType = (danceType) => {
    if (danceType == null || danceType === '') return [];
    try {
      const match = String(danceType).match(/Members: (\[.*?\])/);
      if (match) {
        return JSON.parse(match[1]);
      }
    } catch (e) {
      console.error('Error parsing group members:', e);
    }
    return [];
  };

  const parseGroupMembersFromEntry = (entry) => {
    const gm = entry?.group_members;
    if (Array.isArray(gm) && gm.length > 0) {
      return gm.map((m) =>
        typeof m === 'string'
          ? { name: cleanDisplayText(m, '') }
          : { name: cleanDisplayText(m?.name, ''), age: cleanDisplayText(m?.age, '') }
      );
    }
    return parseGroupMembersFromDanceType(entry?.dance_type);
  };

  if (loading) {
    return (
      <Layout overlayOpacity="bg-white/80">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading entries...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Loading competition data (e.g. after refresh)
  if (competitionId && judgeNumber && !competition && !stateData.competition) {
    return (
      <Layout overlayOpacity="bg-white/80">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading competition data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Missing required data - show error
  if (!competitionId || !judgeNumber || !competition) {
    return (
      <Layout overlayOpacity="bg-white/80">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Missing Competition Data</h2>
            <p className="text-gray-600 mb-4">
              Competition information could not be loaded. This can happen if you opened this page directly or refreshed.
            </p>
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 font-semibold mb-2">How to fix:</p>
              <p className="text-sm text-yellow-700">
                1. Go to the home page<br/>
                2. Select a competition to continue<br/>
                3. Choose a judge to begin scoring
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 transition-colors"
              >
                Back to Home
              </button>
              {competitionId && (
                <button
                  type="button"
                  onClick={() => navigate('/judge-selection', { state: { competitionId } })}
                  className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Select Judge
                </button>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!currentEntry) {
    return (
      <Layout overlayOpacity="bg-white/80">
        <div className="flex-1 flex items-center justify-center p-4">
          <EmptyState
            icon="🎭"
            title="No Entries to Score"
            description="No entries match the current filters. Try adjusting your category or age division filters."
            action={{
              label: "Back to Judge Selection",
              onClick: () => navigate('/judge-selection', { state: { competitionId } })
            }}
          />
        </div>
      </Layout>
    );
  }

  const progress = calculateProgress();
  const showGroupMemberList =
    getEntryDivisionType(currentEntry) !== 'Solo' &&
    Array.isArray(currentEntry.group_members) &&
    currentEntry.group_members.length > 0;
  const groupMembers = showGroupMemberList ? parseGroupMembersFromEntry(currentEntry) : [];

  return (
    <Layout overlayOpacity="bg-white/90">
      <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
        {/* HEADER SECTION */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => {
              const password = prompt('Admin password required to exit judge mode');
              if (verifyAdminPassword(password)) {
                unlockJudgeMode();
                navigate('/');
              } else {
                alert('Incorrect admin password');
              }
            }}
            className="text-red-600 hover:text-red-800 text-base sm:text-lg font-semibold flex items-center min-h-[44px]"
          >
            Exit Judge Mode
          </button>

          <div className="text-center flex-1 px-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {competition?.name}
            </h1>
            <p className="text-teal-600 font-semibold text-sm sm:text-base">
              {competition?.judge_names?.[judgeNumber - 1] || `Judge ${judgeNumber}`} Scoring
            </p>
          </div>

          <span className="text-teal-600 font-semibold text-sm sm:text-base whitespace-nowrap">
            Step 3 / 3
          </span>
        </div>

        {/* FILTER & PROGRESS SECTION */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-md p-4 mb-6">
          {/* Admin Filter Notice */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎛️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800">
                  Filters are controlled by Admin
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  The entries you see are filtered by the competition administrator. 
                  Changes will update automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Search Box (Only filter judges can control) */}
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2 text-sm">
              Search Entry
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or entry number..."
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none min-h-[44px] pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-700">
                Showing {filteredEntries.length} of {entries.length} entries
                {adminFilters.category_filter && ` (filtered by admin)`}
              </p>
              <p className="text-sm font-semibold text-teal-600">
                Scored {progress.scored} of {progress.total}
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
          {/* ENTRY NAVIGATION PANEL - Desktop */}
          <div className="hidden lg:block lg:col-span-1 bg-white/90 backdrop-blur-sm rounded-xl shadow-md p-4 max-h-[600px] overflow-y-auto">
            <h3 className="font-bold text-gray-800 mb-3">Entries</h3>
            <div className="space-y-2">
              {filteredEntries.map((entry, index) => (
                <button
                  key={entry.id}
                  onClick={() => jumpToEntry(index)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    index === currentIndex
                      ? 'bg-teal-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {scoredEntries.has(entry.id) ? '✓' : '○'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {getScoringSidebarLine(entry)}
                      </p>
                      <p className="text-xs truncate opacity-80">
                        {getCategoryNameForEntry(entry)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ENTRY NAVIGATION - Mobile Dropdown */}
          <div className="lg:hidden">
            <button
              onClick={() => setShowEntryList(!showEntryList)}
              className="w-full bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-4 py-3 text-left flex items-center justify-between"
            >
              <span className="font-semibold text-gray-800">
                Entry #{currentEntry.entry_number ?? '?'} of {filteredEntries.length}
              </span>
              <span className="text-teal-600">{showEntryList ? '▲' : '▼'}</span>
            </button>

            {showEntryList && (
              <div className="mt-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3 max-h-64 overflow-y-auto">
                {filteredEntries.map((entry, index) => (
                  <button
                    key={entry.id}
                    onClick={() => jumpToEntry(index)}
                    className={`w-full text-left px-3 py-2 rounded-lg mb-1 ${
                      index === currentIndex
                        ? 'bg-teal-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <span className="mr-2">{scoredEntries.has(entry.id) ? '✓' : '○'}</span>
                    {getScoringSidebarLine(entry)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* MAIN SCORING AREA */}
          <div className="lg:col-span-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-md p-6 overflow-y-auto max-h-[800px]">
            {/* ENTRY DISPLAY */}
            <div className="mb-6 pb-6 border-b-2 border-gray-200">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {/* Photo */}
                <div className="flex-shrink-0">
                  {currentEntry.photo_url ? (
                    <LazyLoadImage
                      src={currentEntry.photo_url}
                      alt={formatEntryName(currentEntry)}
                      effect="blur"
                      className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-lg border-2 border-gray-300"
                      placeholder={
                        <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-200 rounded-lg flex items-center justify-center text-5xl animate-pulse">
                          {isNonSoloDivision(currentEntry) ? '👥' : '💃'}
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-200 rounded-lg flex items-center justify-center text-5xl">
                      {isNonSoloDivision(currentEntry) ? '👥' : '💃'}
                    </div>
                  )}
                </div>

                {/* Entry Info */}
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-1">
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                        {formatEntryName(currentEntry)}
                      </h2>
                      {getEntryDivisionType(currentEntry) !== 'Solo' && getGroupMemberNamesLabel(currentEntry) && (
                        <p className="text-base sm:text-lg text-gray-700 font-semibold mb-3">
                          Dancers: {getGroupMemberNamesLabel(currentEntry)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                          {getCategoryNameForEntry(currentEntry)}
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                          {getEntryAgeLabel(currentEntry)}
                        </span>
                        <AbilityBadge abilityLevel={getAbilityLevel(currentEntry)} size="md" />
                        <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                          {getEntryDivisionType(currentEntry)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <p className="text-xs uppercase tracking-wide text-gray-500 font-bold">Age</p>
                          <p className="text-gray-800 font-semibold">{getEntryAgeValue(currentEntry)}</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <p className="text-xs uppercase tracking-wide text-gray-500 font-bold">Teacher</p>
                          <p className="text-gray-800 font-semibold truncate" title={getTeacherName(currentEntry)}>{getTeacherName(currentEntry)}</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <p className="text-xs uppercase tracking-wide text-gray-500 font-bold">Studio</p>
                          <p className="text-gray-800 font-semibold truncate" title={getStudioName(currentEntry)}>{getStudioName(currentEntry)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group members (non-Solo with group_members from sync) */}
                  {showGroupMemberList && groupMembers.length > 0 && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setExpandedGroup(!expandedGroup)}
                        className="text-teal-600 hover:text-teal-800 font-semibold text-sm flex items-center gap-1"
                      >
                        {expandedGroup ? '▼' : '▶'} Group of {groupMembers.length} members
                      </button>
                      {expandedGroup && (
                        <ul className="mt-2 ml-4 space-y-1">
                          {groupMembers.map((member, idx) => (
                            <li key={idx} className="text-sm text-gray-600">
                              • {cleanDisplayText(member.name, 'Dancer')} {cleanDisplayText(member.age, '') && `(${cleanDisplayText(member.age, '')} years)`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SCORING FORM */}
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-gray-800">Score this Performance</h3>

              {/* Score Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Technique */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Technique
                    <span className="text-sm text-gray-500 ml-2">(0-25 points)</span>
                  </label>
                  <input
                    type="number"
                    value={technique}
                    onChange={(e) => setTechnique(e.target.value)}
                    min="0"
                    max="25"
                    step="0.5"
                    placeholder="0.0"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-lg min-h-[60px]"
                    aria-label="Technique score (0-25 points)"
                  />
                </div>

                {/* Creativity & Choreography */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Creativity & Choreography
                    <span className="text-sm text-gray-500 ml-2">(0-25 points)</span>
                  </label>
                  <input
                    type="number"
                    value={creativity}
                    onChange={(e) => setCreativity(e.target.value)}
                    min="0"
                    max="25"
                    step="0.5"
                    placeholder="0.0"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-lg min-h-[60px]"
                    aria-label="Creativity and choreography score (0-25 points)"
                  />
                </div>

                {/* Presentation */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Presentation
                    <span className="text-sm text-gray-500 ml-2">(0-25 points)</span>
                  </label>
                  <input
                    type="number"
                    value={presentation}
                    onChange={(e) => setPresentation(e.target.value)}
                    min="0"
                    max="25"
                    step="0.5"
                    placeholder="0.0"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-lg min-h-[60px]"
                    aria-label="Presentation score (0-25 points)"
                  />
                </div>

                {/* Appearance & Costume */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Appearance & Costume
                    <span className="text-sm text-gray-500 ml-2">(0-25 points)</span>
                  </label>
                  <input
                    type="number"
                    value={appearance}
                    onChange={(e) => setAppearance(e.target.value)}
                    min="0"
                    max="25"
                    step="0.5"
                    placeholder="0.0"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-lg min-h-[60px]"
                    aria-label="Appearance and costume score (0-25 points)"
                  />
                </div>
              </div>

              {/* TOTAL SCORE DISPLAY */}
              <div className="bg-gradient-to-r from-gray-50 to-teal-50 border-2 border-teal-300 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600 mb-1">TOTAL SCORE</p>
                <p className={`text-4xl sm:text-5xl font-bold ${getTotalColor()}`}>
                  {total.toFixed(1)} / 100
                </p>
              </div>

              {/* JUDGE NOTES */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Judge Notes (Optional but Recommended)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Notes are important for tie-breaking
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setNotes(e.target.value);
                    }
                  }}
                  placeholder="Comments about this performance..."
                  maxLength={500}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-base min-h-[150px] resize-none"
                ></textarea>
                <p className="text-xs text-gray-500 text-right mt-1">
                  {notes.length} / 500 characters
                </p>
              </div>

              {/* NAVIGATION BUTTONS */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={moveToPreviousEntry}
                  disabled={currentIndex === 0 || saving}
                  className="flex-1 py-3 px-6 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[56px]"
                >
                  ← Previous Entry
                </button>

                {currentIndex < filteredEntries.length - 1 ? (
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="flex-1 py-3 px-6 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 transition-all shadow-lg min-h-[56px]"
                  >
                    {saving ? 'Saving...' : 'Save & Next Entry →'}
                  </button>
                ) : (
                  <button
                    onClick={handleFinish}
                    disabled={saving}
                    className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-900 disabled:opacity-50 transition-all shadow-lg min-h-[56px]"
                  >
                    {saving ? 'Saving...' : 'Submit All & Finish'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 pb-8">
          <p className="font-semibold">TOPAZ 2.0 © 2025</p>
          <p className="mt-1">Heritage Since 1972 | Judge Scoring Interface</p>
        </div>
      </div>
    </Layout>
  );
}

export default ScoringInterface;
