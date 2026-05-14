import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import CategoryBadge from '../components/CategoryBadge';
import AbilityBadge from '../components/AbilityBadge';
import MedalBadge, { getMedalProgress } from '../components/MedalBadge';
import MedalLeaderboard from '../components/MedalLeaderboard';
import EditCompetitionModal from '../components/EditCompetitionModal';
import { getCompetition } from '../supabase/competitions';
import { getCompetitionCategories } from '../supabase/categories';
import { getCompetitionAgeDivisions } from '../supabase/ageDivisions';
import { getCompetitionEntries } from '../supabase/entries';
import { getCompetitionScores } from '../supabase/scores';
import { awardMedalPointsForCompetition } from '../supabase/medalParticipants';
import { subscribeToScores, unsubscribeFromChannel } from '../supabase/realtime';
import { generateScoreSheet, generateAllScorecards } from '../utils/pdfGenerator';
import { exportResultsToExcel } from '../utils/excelExport';
import { exportComprehensiveExcel, exportToJSON } from '../utils/comprehensiveExport';
import { getSeasonLeaderboard } from '../supabase/medalParticipants';
import { 
  groupByExactCombination, 
  calculateRankingsPerGroup, 
  extractVarietyLevel,
  calculateTop4Overall,
  getDivisionTypeEmoji,
  getDivisionTypeDisplayName
} from '../utils/calculations';
import { formatEntryName, groupEntries, cleanDisplayText } from '../utils/entryFilters';
import { pickReconciledJudgeScore, getScoreRowTotal } from '../utils/scoreReconciliation';

// Helper function to check if a category is special (should not get awards/medals)
const isSpecialCategory = (category) => {
  if (!category) return false;
  const categoryName = category.name || '';
  return categoryName === 'Production' || 
         categoryName === 'Student Choreography' || 
         categoryName === 'Teacher/Student' ||
         category.is_special_category === true ||
         category.type === 'special';
};

const assignPlacementRanks = (entriesToRank = []) => {
  const sorted = [...entriesToRank].sort((a, b) => b.averageScore - a.averageScore);
  let currentRank = 1;

  sorted.forEach((entry, index) => {
    if (index > 0 && entry.averageScore === sorted[index - 1].averageScore) {
      entry.rank = sorted[index - 1].rank;
    } else {
      entry.rank = currentRank;
    }
    currentRank++;
  });

  return sorted;
};

const getPlacementLabel = (rank) => {
  if (!rank) return '';
  const suffix = rank % 10 === 1 && rank % 100 !== 11 ? 'st'
    : rank % 10 === 2 && rank % 100 !== 12 ? 'nd'
    : rank % 10 === 3 && rank % 100 !== 13 ? 'rd'
    : 'th';
  return `${rank}${suffix} Place`;
};

function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateId = location.state?.competitionId;
  const savedId = (() => {
    try { return sessionStorage.getItem('topaz_active_competition_id'); } catch (e) { return null; }
  })();
  const competitionId = stateId || savedId || null;

  // Special Categories
  const specialCategoryNames = ['Production', 'Student Choreography', 'Teacher/Student'];

  // State
  const [competition, setCompetition] = useState(null);
  const [categories, setCategories] = useState([]);
  const [ageDivisions, setAgeDivisions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('overall');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedAgeDivision, setSelectedAgeDivision] = useState(null);
  const [selectedAbilityLevel, setSelectedAbilityLevel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [awardingPoints, setAwardingPoints] = useState(false);
  const [showMedalStandings, setShowMedalStandings] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [printProgress, setPrintProgress] = useState({ current: 0, total: 0 });
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'filtered'
  const [showEditModal, setShowEditModal] = useState(false);
  const [medalLeaderboardData, setMedalLeaderboardData] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Redirect if no competitionId; persist for recovery on refresh
  useEffect(() => {
    if (competitionId) {
      try { sessionStorage.setItem('topaz_active_competition_id', competitionId); } catch (e) { /* ignore */ }
    } else {
      toast.error('No competition selected');
      navigate('/');
    }
  }, [competitionId, navigate]);

  // Load data function (extracted for reuse)
  const loadAllData = async () => {
    if (!competitionId) return;

    try {
      setLoading(true);
      const [compResult, catsResult, divsResult, entriesResult, scoresResult] = await Promise.all([
        getCompetition(competitionId),
        getCompetitionCategories(competitionId),
        getCompetitionAgeDivisions(competitionId),
        getCompetitionEntries(competitionId),
        getCompetitionScores(competitionId)
      ]);

      if (!compResult.success) throw new Error(compResult.error);

      setCompetition(compResult.data);
      setCategories(catsResult.success ? catsResult.data : []);
      setAgeDivisions(divsResult.success ? divsResult.data : []);
      setEntries(entriesResult.success ? entriesResult.data : []);
      setScores(scoresResult.success ? scoresResult.data : []);
      
      // Load medal leaderboard data if available
      try {
        const medalResult = await getSeasonLeaderboard(100);
        if (medalResult.success && medalResult.data) {
          setMedalLeaderboardData(medalResult.data);
        }
      } catch (medalError) {
        console.log('Medal data not available:', medalError);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading results:', error);
      toast.error(`Failed to load results: ${error.message}`);
      setLoading(false);
    }
  };

  // Load data
  useEffect(() => {
    loadAllData();
  }, [competitionId]);

  // Handle competition update
  const handleCompetitionUpdated = (updatedCompetition) => {
    setCompetition(updatedCompetition);
    // Reload categories in case they changed
    loadAllData();
  };

  // Real-time updates
  useEffect(() => {
    if (!competitionId) return;

    const channel = subscribeToScores(competitionId, async () => {
        const scoresResult = await getCompetitionScores(competitionId);
        if (scoresResult.success) {
          setScores(scoresResult.data);
          toast.info('Scores updated!', { autoClose: 2000 });
      }
    });

    return () => unsubscribeFromChannel(channel);
  }, [competitionId]);

  // Collapse duo/trio/group/production rows into one routine for results.
  // Scores saved on older sibling rows are reconciled by judge, but each routine appears once.
  const routineEntriesData = useMemo(() => {
    const { primary, siblingMap } = groupEntries(entries);
    return { primary, siblingMap };
  }, [entries]);

  const getRoutineScores = (entry) => {
    const routineRows = [entry, ...(routineEntriesData.siblingMap.get(entry.id) || [])];
    const byJudge = new Map();

    for (const row of routineRows) {
      const rowScores = scores.filter((s) => s.entry_id === row.id);
      for (const score of rowScores) {
        const judge = score.judge_number ?? 'unknown';
        if (!byJudge.has(judge)) byJudge.set(judge, []);
        byJudge.get(judge).push({ entry: row, score });
      }
    }

    return [...byJudge.values()]
      .map((candidates) => pickReconciledJudgeScore(candidates, entry.id))
      .filter(Boolean);
  };

  // Calculate ranked results (EXCLUDE SPECIAL CATEGORIES from rankings)
  const rankedResults = useMemo(() => {
    if (routineEntriesData.primary.length === 0 || scores.length === 0) return [];

    const entriesWithAverages = routineEntriesData.primary.map(entry => {
      const entryScores = getRoutineScores(entry);
      if (entryScores.length === 0) {
        return { ...entry, averageScore: 0, judgeCount: 0, hasScores: false, scores: [] };
      }

      const avgScore = entryScores.reduce((sum, s) => sum + getScoreRowTotal(s), 0) / entryScores.length;
      const category = categories.find(c => c.id === entry.category_id);
      
      return {
        ...entry,
        averageScore: parseFloat(avgScore.toFixed(2)),
        judgeCount: entryScores.length,
        hasScores: true,
        scores: entryScores,
        category: category // Store category for filtering
      };
    });

    // Filter out special categories before ranking
    const eligibleEntries = entriesWithAverages.filter(e => {
      if (!e.hasScores) return false;
      const category = categories.find(c => c.id === e.category_id);
      return !isSpecialCategory(category);
    });

    // Separate special categories. They receive category placement trophies,
    // but are excluded from Overall/High Score winner trophies.
    const specialCategoryEntries = entriesWithAverages.filter(e => {
      if (!e.hasScores) return false;
      const category = categories.find(c => c.id === e.category_id);
      return isSpecialCategory(category);
    });

    // Regular categories rank overall as before.
    const rankedEligibleEntries = assignPlacementRanks(eligibleEntries);

    // Special categories rank only within their own exact category/age/ability/division group.
    const specialGroups = groupByExactCombination(specialCategoryEntries, categories, ageDivisions);
    const rankedSpecialEntries = [];
    Object.values(specialGroups).forEach((group) => {
      assignPlacementRanks(group.entries).forEach((entry) => {
        entry.isSpecialCategory = true;
        entry.specialPlacementOnly = true;
        rankedSpecialEntries.push(entry);
      });
    });

    // Return both: regular ranked results + special placement-only results.
    return [...rankedEligibleEntries, ...rankedSpecialEntries];
  }, [routineEntriesData, scores, categories, ageDivisions]);

  // Separate special categories from regular results
  const specialCategoryResults = useMemo(() => {
    return rankedResults.filter(entry => {
      const category = categories.find(c => c.id === entry.category_id);
      return isSpecialCategory(category);
    });
  }, [rankedResults, categories]);

  // Filter results (exclude special categories from regular filtering)
  const filteredResults = useMemo(() => {
    let filtered = [...rankedResults].filter(entry => {
      const category = categories.find(c => c.id === entry.category_id);
      return !isSpecialCategory(category); // Exclude special categories from regular results
    });

    if (selectedCategory) {
      filtered = filtered.filter(e => e.category_id === selectedCategory);
    }
    if (selectedAgeDivision) {
      filtered = filtered.filter(e => e.age_division_id === selectedAgeDivision);
    }
    if (selectedAbilityLevel) {
      filtered = filtered.filter(e => e.ability_level === selectedAbilityLevel);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        formatEntryName(e).toLowerCase().includes(query) ||
        cleanDisplayText(e.competitor_name, '').toLowerCase().includes(query) ||
        e.entry_number.toString().includes(query)
      );
    }

    return filtered;
  }, [rankedResults, selectedCategory, selectedAgeDivision, selectedAbilityLevel, searchQuery, categories]);

  // Calculate grouped rankings by exact combination (EXCLUDE SPECIAL CATEGORIES)
  const groupedRankings = useMemo(() => {
    if (rankedResults.length === 0) return {};

    // Filter out special categories before grouping
    const eligibleResults = rankedResults.filter(entry => {
      const category = categories.find(c => c.id === entry.category_id);
      return !isSpecialCategory(category);
    });

    if (eligibleResults.length === 0) return {};

    // Group entries by exact combination (NOW INCLUDING DIVISION TYPE)
    const groups = groupByExactCombination(eligibleResults, categories, ageDivisions);
    
    // Calculate rankings per group
    const rankedGroups = calculateRankingsPerGroup(groups);
    
    return rankedGroups;
  }, [rankedResults, categories, ageDivisions]);

  // Calculate Top 4 Overall Highest Scores (EXCLUDE SPECIAL CATEGORIES)
  const top4Overall = useMemo(() => {
    if (rankedResults.length === 0) return [];
    
    // Filter out special categories
    const eligibleResults = rankedResults.filter(entry => {
      const category = categories.find(c => c.id === entry.category_id);
      return !isSpecialCategory(category);
    });
    
    return calculateTop4Overall(eligibleResults);
  }, [rankedResults, categories]);

  // Medal Program Results - Top 4 per category combination
  const medalProgramResults = useMemo(() => {
    if (selectedFilter !== 'medal') return [];

    const medalGroups = [];
    
    // Iterate through grouped rankings
    Object.keys(groupedRankings).forEach(key => {
      const group = groupedRankings[key];
      
      // Filter only medal program entries
      const medalEntries = group.entries.filter(e => e.is_medal_program);
      
      if (medalEntries.length > 0) {
        // Skip special categories
        const category = categories.find(c => c.id === group.categoryId);
        if (category && specialCategoryNames.includes(category.name)) return;
        
        medalGroups.push({
          key: key,
          category: group.category,
          variety: group.variety,
          ageDivision: group.ageDivision,
          abilityLevel: group.abilityLevel,
          results: medalEntries.slice(0, 4) // Top 4
        });
      }
    });

    return medalGroups;
  }, [groupedRankings, categories, selectedFilter]);

  const handleAwardMedalPoints = async () => {
    if (!window.confirm('Award medal points to all 1st place Medal Program winners?\n\nNote: Each group member will receive individual points!')) return;

    try {
      setAwardingPoints(true);
      
      // Use new medal participants system
      const result = await awardMedalPointsForCompetition(competitionId);
      
      if (result.success) {
        toast.success(
          `✅ Successfully awarded points to ${result.totalAwarded} participants ` +
          `from ${result.firstPlaceCount} first-place entries!`,
          { autoClose: 5000 }
        );
        
        // Reload entries so medal_points and current_medal_level display immediately
        await loadAllData();
        
        // Show summary if available
        if (result.summary && result.summary.length > 0) {
          console.log('Medal Points Summary:', result.summary);
        }
      } else {
        throw new Error(result.error || 'Failed to award medal points');
      }
    } catch (error) {
      console.error('Error awarding medal points:', error);
      toast.error(`Failed to award points: ${error.message}`);
    } finally {
      setAwardingPoints(false);
    }
  };

  // Generate all scorecards in one PDF
  const handleGenerateAllScorecards = async () => {
    if (!window.confirm(`Generate scorecards for all ${entries.length} entries?\n\nThis may take a few minutes.`)) return;

    try {
      setGeneratingPdf(true);
      setPrintProgress({ current: 0, total: entries.length });
      toast.info('Generating all scorecards... Please wait.');

      const result = await generateAllScorecards(
        entries,
        scores,
        categories,
        ageDivisions,
        competition,
        (current, total) => {
          setPrintProgress({ current, total });
        }
      );

      if (result.success) {
        toast.success(`✅ Generated ${result.count} scorecards successfully!`);
      } else {
        throw new Error(result.error || 'Failed to generate scorecards');
      }
    } catch (error) {
      console.error('Error generating all scorecards:', error);
      toast.error(`Failed to generate scorecards: ${error.message}`);
    } finally {
      setGeneratingPdf(false);
      setPrintProgress({ current: 0, total: 0 });
    }
  };

  // Helper functions
  const getCategoryName = (categoryId) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getAgeDivisionName = (divisionId) => {
    return ageDivisions.find(d => d.id === divisionId)?.name || '';
  };

  const getRankColor = (rank) => {
    if (rank === 1) return 'from-yellow-400 via-yellow-500 to-yellow-600';
    if (rank === 2) return 'from-gray-300 via-gray-400 to-gray-500';
    if (rank === 3) return 'from-orange-400 via-orange-500 to-orange-600';
    return 'from-teal-500 to-cyan-500';
  };

  const getRankBorderColor = (rank) => {
    if (rank === 1) return 'border-yellow-400';
    if (rank === 2) return 'border-gray-300';
    if (rank === 3) return 'border-orange-400';
    return 'border-gray-200';
  };

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  const getScoreColor = (score) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const toggleExpanded = (entryId) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
      } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const handlePrintScoreSheet = async (entry) => {
    try {
      setGeneratingPdf(true);
      console.log('📄 Starting PDF generation for:', formatEntryName(entry));
      
      const category = categories.find(c => c.id === entry.category_id);
      const ageDivision = ageDivisions.find(d => d.id === entry.age_division_id);
      
      console.log('📊 Entry Scores:', entry.scores);
      if (!entry.scores || entry.scores.length === 0) {
        toast.error('No scores found for this entry');
        return;
      }
      
      const result = await generateScoreSheet(entry, entry.scores, category, ageDivision, competition);
      
      if (result.success) {
        toast.success('Score sheet generated successfully!');
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Failed to generate PDF:', error);
      toast.error(`Failed to generate score sheet: ${error.message}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExport = () => {
    const category = selectedCategory ? categories.find(c => c.id === selectedCategory) : null;
    const ageDivision = selectedAgeDivision ? ageDivisions.find(d => d.id === selectedAgeDivision) : null;
    exportResultsToExcel(filteredResults, categories, ageDivisions, competition, category, ageDivision);
    toast.success('Results exported to Excel!');
  };

  const handleComprehensiveExcelExport = async () => {
    if (!competition || !entries.length) {
      toast.error('No data to export');
      return;
    }

    setExporting(true);
    try {
      const result = await exportComprehensiveExcel(
        competition,
        categories,
        ageDivisions,
        entries,
        scores,
        rankedResults,
        medalLeaderboardData
      );

      if (result.success) {
        toast.success(`Complete results exported to ${result.fileName}!`);
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleJSONExport = () => {
    if (!competition || !entries.length) {
      toast.error('No data to export');
      return;
    }

    try {
      const result = exportToJSON(
        competition,
        categories,
        ageDivisions,
        entries,
        scores,
        rankedResults,
        medalLeaderboardData
      );

      if (result.success) {
        toast.success(`JSON data exported to ${result.fileName}!`);
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      console.error('JSON export error:', error);
      toast.error(`JSON export failed: ${error.message}`);
    }
  };

  const handlePrintAll = () => {
    window.print();
  };

  // Loading state
  if (loading) {
    return (
      <Layout overlayOpacity="bg-gradient-to-br from-cyan-50 via-white to-teal-50">
        <div className="min-h-screen flex flex-col items-center justify-center gap-6">
          <div className="w-16 h-16 border-6 border-gray-200 border-t-teal-500 rounded-full animate-spin"></div>
          <p className="text-lg text-gray-600 font-semibold">Loading Championship Results...</p>
        </div>
      </Layout>
    );
  }

  // No competition
  if (!competition) {
    return (
      <Layout overlayOpacity="bg-white/90">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-xl text-gray-600 mb-4">Competition not found</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600"
            >
              Back to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout overlayOpacity="bg-gradient-to-br from-cyan-50 via-white to-teal-50">
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          
          {/* CHAMPIONSHIP HEADER */}
          <div className="text-center mb-12">
            {/* Logos */}
            <div className="flex items-center justify-center gap-8 mb-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24">
                <img src="/left-dancer.png" alt="" className="w-full h-full object-contain" />
              </div>
              <div className="w-16 h-16 sm:w-20 sm:h-20">
                <img src="/logo.png" alt="TOPAZ 2.0" className="w-full h-full object-contain" />
              </div>
              <div className="w-20 h-20 sm:w-24 sm:h-24">
                <img src="/right-dancer.png" alt="" className="w-full h-full object-contain" />
              </div>
          </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent tracking-wider mb-3">
              TOPAZ 2.0 DANCE COMPETITION
          </h1>
          
            {/* Decorative Divider */}
            <div className="w-48 h-1 bg-gradient-to-r from-cyan-500 to-teal-500 mx-auto mb-4"></div>
            
            {/* Subtitle */}
            <h2 className="text-xl sm:text-2xl font-bold text-gray-700 tracking-widest mb-6">
              OFFICIAL COMPETITION RESULTS
            </h2>

            {/* Competition Info Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-3xl mx-auto mb-8">
              <h3 className="text-3xl font-bold text-teal-600 mb-2">{competition.name}</h3>
              <p className="text-lg text-gray-600 mb-4">{new Date(competition.date).toLocaleDateString()}</p>
              <p className="text-gray-500">
                {rankedResults.length} total entries • {competition.judges_count} judges • {categories.length} categories
              </p>
            </div>
          </div>

          {/* NAVIGATION & ACTION BUTTONS */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <button
              type="button"
              onClick={() => navigate('/judge-selection', { state: { competitionId } })}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white text-base font-semibold rounded-xl shadow transition-all"
            >
              ← Back to Judge Selection
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-400 hover:bg-gray-500 text-white text-base font-semibold rounded-xl shadow transition-all"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin', { state: { competitionId } })}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:from-orange-600 hover:to-orange-700 hover:scale-105 hover:shadow-2xl transition-all duration-300"
            >
              <span className="text-xl">🎛️</span>
              <span>Admin Control Panel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:from-purple-600 hover:to-purple-700 hover:scale-105 hover:shadow-2xl transition-all duration-300"
            >
              <span className="text-xl">⚙️</span>
              <span>Edit Competition</span>
            </button>

            <button
              type="button"
              onClick={handlePrintAll}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:from-blue-600 hover:to-blue-700 hover:scale-105 hover:shadow-2xl transition-all duration-300"
            >
              <span className="text-xl">🖨</span>
              <span>Print Results</span>
            </button>
            
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white text-lg font-semibold rounded-xl shadow-lg hover:from-green-600 hover:to-green-700 hover:scale-105 hover:shadow-2xl transition-all duration-300"
            >
              <span className="text-xl">📊</span>
              <span>Export to Excel</span>
            </button>

            {/* Comprehensive Export Section */}
            <div className="w-full border-t-2 border-gray-200 pt-6 mt-6">
              <h3 className="text-xl font-bold text-gray-700 mb-4 text-center">
                📦 Complete Results Package
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={handleComprehensiveExcelExport}
                  disabled={exporting || !competition}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:from-emerald-600 hover:to-emerald-700 hover:scale-105 hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-lg">📊</span>
                  <span>{exporting ? 'Exporting...' : 'Download Excel (Full Data)'}</span>
                </button>

                <button
                  onClick={handleJSONExport}
                  disabled={!competition}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:from-indigo-600 hover:to-indigo-700 hover:scale-105 hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-lg">📄</span>
                  <span>Download JSON (For Website)</span>
                </button>
              </div>
              <p className="text-sm text-gray-600 text-center mt-3">
                Excel includes all data across multiple sheets • JSON format for website integration
              </p>
            </div>

            <button
              onClick={handleGenerateAllScorecards}
              disabled={generatingPdf}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-lg font-semibold rounded-xl shadow-lg hover:from-purple-600 hover:to-indigo-600 hover:scale-105 hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {generatingPdf ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating {printProgress.current}/{printProgress.total}...</span>
                </>
              ) : (
                <>
                  <span className="text-xl">📄</span>
                  <span>Print All Scorecards</span>
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/setup')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-lg font-semibold rounded-xl shadow-lg hover:from-cyan-600 hover:to-teal-600 hover:scale-105 hover:shadow-2xl transition-all duration-300"
            >
              <span className="text-xl">➕</span>
              <span>New Competition</span>
            </button>
          </div>

          {/* FILTERS & SEARCH */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-6">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or entry number..."
                  className="w-full pl-14 pr-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:border-teal-500 focus:outline-none transition-colors"
                />
          </div>
        </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              <span className="text-sm font-semibold text-gray-600">CATEGORY:</span>
              
            <button
              onClick={() => {
                setSelectedFilter('overall');
                setSelectedCategory(null);
                }}
                className={`px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
                  !selectedCategory
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Categories
            </button>

            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                    if (selectedFilter === 'overall') setSelectedFilter('category');
                  }}
                  className={`px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
                    selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
            </div>

            {/* Age Division Filter Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              <span className="text-sm font-semibold text-gray-600">AGE GROUP:</span>

              <button
                onClick={() => setSelectedAgeDivision(null)}
                className={`px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
                  !selectedAgeDivision
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Ages
              </button>

              {ageDivisions.map(div => (
                <button
                  key={div.id}
                  onClick={() => setSelectedAgeDivision(div.id)}
                  className={`px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
                    selectedAgeDivision === div.id
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {div.name} ({div.min_age}-{div.max_age === 99 ? '13+' : div.max_age})
              </button>
            ))}
            </div>

            {/* Ability Level Filter Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
              <span className="text-sm font-semibold text-gray-600">EXPERIENCE:</span>

              <button
                onClick={() => setSelectedAbilityLevel(null)}
                className={`px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
                  !selectedAbilityLevel
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Levels
              </button>

              {['Beginning', 'Intermediate', 'Advanced'].map(level => (
                <button
                  key={level}
                  onClick={() => setSelectedAbilityLevel(level)}
                  className={`px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
                    selectedAbilityLevel === level
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>

            {/* Medal Program and Season Leaderboard Toggle */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
              <span className="text-sm font-semibold text-gray-600">PROGRAMS:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedFilter(selectedFilter === 'medal' ? 'overall' : 'medal');
                  // Clear other filters when entering medal view for clarity
                  if (selectedFilter !== 'medal') {
                  setSelectedCategory(null);
                  setSelectedAgeDivision(null);
                    setSelectedAbilityLevel(null);
                  }
                }}
                className={`px-8 py-2 rounded-full font-bold text-sm transition-all duration-200 flex items-center gap-2 ${
                  selectedFilter === 'medal'
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-600 text-white shadow-lg scale-105'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-2 border-amber-200'
                }`}
              >
                <span>⭐</span>
                <span>Medal Program View</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setSelectedFilter(selectedFilter === 'leaderboard' ? 'overall' : 'leaderboard');
                  // Clear other filters
                  if (selectedFilter !== 'leaderboard') {
                    setSelectedCategory(null);
                    setSelectedAgeDivision(null);
                    setSelectedAbilityLevel(null);
                  }
                }}
                className={`px-8 py-2 rounded-full font-bold text-sm transition-all duration-200 flex items-center gap-2 ${
                  selectedFilter === 'leaderboard'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg scale-105'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-2 border-purple-200'
                }`}
              >
                <span>🏅</span>
                <span>Season Leaderboard</span>
              </button>
          </div>

            {/* Results Count */}
            <p className="text-center text-sm text-gray-500">
              Showing {filteredResults.length} of {rankedResults.length} results
            </p>
          </div>

          {/* MEDAL PROGRAM VIEW */}
          {selectedFilter === 'medal' && (
            <div className="space-y-12">
              {/* SEASON LEADERBOARD */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-8 border-2 border-purple-200 shadow-xl">
                <h2 className="text-4xl font-black text-purple-800 text-center mb-8 flex items-center justify-center gap-3">
                  <span>👑</span> SEASON LEADERBOARD - TOP 10
                </h2>
                
                {(() => {
                  const medalEntries = rankedResults
                    .filter(e => e.is_medal_program && (e.medal_points || 0) > 0)
                    .sort((a, b) => (b.medal_points || 0) - (a.medal_points || 0))
                    .slice(0, 10);
                  
                  return medalEntries.length === 0 ? (
                    <div className="bg-white/40 p-12 rounded-2xl text-center italic text-purple-700">
                      No medal points awarded yet. Award points to 1st place winners below!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {medalEntries.map((entry, index) => (
                        <div key={entry.id} className={`flex items-center gap-4 p-4 rounded-xl shadow-md transition-all hover:scale-[1.02] ${
                          index === 0 ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-2 border-yellow-400' :
                          index === 1 ? 'bg-gradient-to-r from-gray-100 to-slate-100 border-2 border-gray-400' :
                          index === 2 ? 'bg-gradient-to-r from-orange-100 to-amber-100 border-2 border-orange-400' :
                          'bg-white'
                        }`}>
                          {/* Rank */}
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl ${
                            index === 0 ? 'bg-yellow-400 text-white' :
                            index === 1 ? 'bg-gray-400 text-white' :
                            index === 2 ? 'bg-orange-400 text-white' :
                            'bg-purple-100 text-purple-600'
                          }`}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </div>
                          
                          {/* Photo */}
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md">
                            {entry.photo_url ? (
                              <img src={entry.photo_url} alt={formatEntryName(entry)} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-purple-100 flex items-center justify-center text-2xl">
                                👤
                              </div>
                            )}
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-gray-800 truncate">{formatEntryName(entry)}</h3>
                            <p className="text-sm text-gray-600">
                              {getCategoryName(entry.category_id)} • {entry.ability_level}
                            </p>
                          </div>
                          
                          {/* Medal Info */}
                          <div className="text-center">
                            <p className="text-3xl font-black text-purple-600">
                              {entry.medal_points || 0}
                            </p>
                            <p className="text-xs font-bold text-gray-500 uppercase">Points</p>
                            <div className="mt-1">
                              {entry.current_medal_level === 'Gold' && <span className="text-lg">🥇</span>}
                              {entry.current_medal_level === 'Silver' && <span className="text-lg">🥈</span>}
                              {entry.current_medal_level === 'Bronze' && <span className="text-lg">🥉</span>}
                              {entry.current_medal_level === 'None' && <span className="text-lg">⭐</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* COMPETITION RESULTS */}
              <div className="bg-gradient-to-br from-yellow-50 to-amber-100 rounded-3xl p-8 border-2 border-amber-200 shadow-xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 text-center md:text-left">
                  <div>
                    <h2 className="text-3xl font-black text-amber-800 flex items-center justify-center md:justify-start gap-3">
                      <span>🏆</span> THIS COMPETITION - MEDAL PROGRAM RESULTS
                    </h2>
                    <p className="text-amber-700 font-semibold mt-2 italic">
                      Top 4 per category combination • Only 1st place earns points
          </p>
        </div>

                  <button
                    onClick={handleAwardMedalPoints}
                    disabled={awardingPoints}
                    className="px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-bold rounded-xl shadow-lg hover:from-amber-600 hover:to-yellow-700 hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {awardingPoints ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span>⭐</span>
                    )}
                    <span>Award Points to 1st Place Winners</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-white/60 p-4 rounded-xl text-center">
                    <span className="text-2xl mb-1 block">🥉</span>
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-widest">Bronze</span>
                    <p className="text-lg font-black text-amber-900">25 Points</p>
                  </div>
                  <div className="bg-white/60 p-4 rounded-xl text-center">
                    <span className="text-2xl mb-1 block">🥈</span>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Silver</span>
                    <p className="text-lg font-black text-gray-800">35 Points</p>
                  </div>
                  <div className="bg-white/60 p-4 rounded-xl text-center">
                    <span className="text-2xl mb-1 block">🥇</span>
                    <span className="text-xs font-bold text-yellow-600 uppercase tracking-widest">Gold</span>
                    <p className="text-lg font-black text-yellow-700">50 Points</p>
                  </div>
                </div>

                {medalProgramResults.length === 0 ? (
                  <div className="bg-white/40 p-12 rounded-2xl text-center italic text-amber-800">
                    No medal program entries found for this competition.
                  </div>
                ) : (
                  <div className="space-y-8">
                    {medalProgramResults.map((group) => (
                      <div key={group.key} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-amber-100 shadow-md">
                        <h3 className="text-xl font-bold text-amber-900 mb-2 border-b-2 border-amber-100 pb-3 flex items-center gap-2">
                          <span>✨</span> {group.category} {group.variety !== 'None' ? group.variety : ''} - Top 4
                        </h3>
                        <p className="text-sm text-amber-700 mb-4 flex gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-amber-50 rounded">📅 {group.ageDivision}</span>
                          <span className="px-2 py-1 bg-amber-50 rounded">⭐ {group.abilityLevel}</span>
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {group.results.map((entry) => (
                            <div key={entry.id} className="relative bg-white rounded-xl p-4 border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
                              {/* Rank Badge - Use categoryRank */}
                              <div className={`absolute -top-3 -left-3 w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md border-2 border-white ${
                                entry.categoryRank === 1 ? 'bg-yellow-400 text-white' : 
                                entry.categoryRank === 2 ? 'bg-gray-300 text-white' :
                                entry.categoryRank === 3 ? 'bg-orange-400 text-white' :
                                'bg-teal-500 text-white'
                              }`}>
                                {entry.categoryRank}
                              </div>

                              {/* 1st Place Winner Badge */}
                              {entry.categoryRank === 1 && (
                                <div className="absolute -top-2 -right-2 text-2xl animate-pulse">
                                  🏆
                                </div>
                              )}

                              <div className="flex flex-col items-center text-center">
                                <div className="w-20 h-20 rounded-full overflow-hidden mb-3 border-2 border-amber-100">
                                  {entry.photo_url ? (
                                    <img src={entry.photo_url} alt={formatEntryName(entry)} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-amber-50 flex items-center justify-center text-2xl text-amber-200">
                                      👤
                                    </div>
                                  )}
                                </div>
                                <h4 className="font-bold text-gray-800 line-clamp-1">{formatEntryName(entry)}</h4>
                                <div className="text-amber-600 font-black text-lg mb-2">
                                  {entry.averageScore.toFixed(2)}
                                </div>
                                
                                <div className="w-full pt-3 border-t border-gray-100 mt-2">
                                  <div className="flex items-center justify-center gap-1 mb-1">
                                    <MedalBadge medalLevel={entry.current_medal_level} size="sm" />
                                    <span className="text-xs font-bold text-gray-500 uppercase">{entry.medal_points || 0} PTS</span>
                                  </div>
                                  <p className="text-[10px] text-amber-700 font-semibold uppercase leading-tight">
                                    {getMedalProgress(entry.medal_points || 0)}
                                  </p>
                                  
                                  {/* Points Earned This Competition */}
                                  {entry.categoryRank === 1 && (
                                    <p className="text-[10px] text-green-600 font-bold mt-1">
                                      +1 pt for 1st place!
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW MODE TABS */}
          {selectedFilter !== 'medal' && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center gap-2 ${
                    viewMode === 'grouped'
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>🏆</span>
                  <span>By Category Combination</span>
                </button>
                <button
                  onClick={() => setViewMode('filtered')}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center gap-2 ${
                    viewMode === 'filtered'
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>🔍</span>
                  <span>Custom Filter</span>
                </button>
              </div>
              <p className="text-center text-sm text-gray-500 mt-4">
                {viewMode === 'grouped' 
                  ? 'Viewing rankings by exact category combination + division type (each group has its own 1st, 2nd, 3rd place)'
                  : 'Viewing overall rankings with custom filters'}
              </p>
            </div>
          )}

          {/* TOP 4 OVERALL HIGHEST SCORES */}
          {selectedFilter !== 'medal' && viewMode === 'grouped' && top4Overall.length > 0 && (
            <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 rounded-3xl shadow-2xl p-8 mb-12 border-4 border-yellow-400">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600 mb-2">
                  🏆 TOP 4 HIGHEST OVERALL SCORES
                </h2>
                <p className="text-lg text-gray-700 font-semibold">
                  Entire Competition - All Categories, All Divisions
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {top4Overall.map((entry, index) => {
                  const rankColors = [
                    'from-yellow-400 to-amber-500',
                    'from-gray-300 to-gray-400',
                    'from-orange-400 to-orange-500',
                    'from-teal-400 to-cyan-500'
                  ];
                  const borderColors = [
                    'border-yellow-500',
                    'border-gray-400',
                    'border-orange-500',
                    'border-teal-500'
                  ];
                  const medals = ['🥇', '🥈', '🥉', '🏅'];
                  const labels = ['1st Overall', '2nd Overall', '3rd Overall', '4th Overall'];
                  
                  return (
                    <div 
                      key={entry.id}
                      className={`bg-white rounded-2xl shadow-xl overflow-hidden border-4 ${borderColors[index]} transform hover:scale-105 transition-all duration-300`}
                    >
                      <div className={`bg-gradient-to-r ${rankColors[index]} p-4 text-center`}>
                        <div className="text-5xl mb-2">{medals[index]}</div>
                        <div className="text-white font-black text-lg">{labels[index]}</div>
                      </div>
                      
                      <div className="p-4">
                        <div className="flex flex-col items-center text-center mb-3">
                          <div className="w-20 h-20 rounded-full overflow-hidden mb-3 border-4 border-gray-200">
                            {entry.photo_url ? (
                              <img src={entry.photo_url} alt={formatEntryName(entry)} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-3xl">
                                {entry.dance_type && entry.dance_type.includes('Solo') ? '👤' : '👥'}
                              </div>
                            )}
                          </div>
                          
                          <h3 className="text-xl font-bold text-gray-800 mb-1 line-clamp-2">
                            {formatEntryName(entry)}
                          </h3>
                          
                          <p className="text-sm text-gray-600 mb-2">
                            {getDivisionTypeDisplayName(entry.dance_type)}
                          </p>
                          
                          <div className="w-full h-px bg-gray-200 my-2"></div>
                          
                          <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-600">
                            {entry.averageScore.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500 font-semibold">AVERAGE SCORE</div>
                        </div>
                        
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>📂 {getCategoryName(entry.category_id)}</div>
                          <div>🎂 {getAgeDivisionName(entry.age_division_id) || 'N/A'}</div>
                          <div>⭐ {entry.ability_level}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GROUPED RESULTS VIEW */}
          {selectedFilter !== 'medal' && viewMode === 'grouped' && (
            Object.keys(groupedRankings).length === 0 ? (
              <div className="bg-white rounded-3xl shadow-lg p-20 text-center">
                <div className="text-6xl mb-6">🏆</div>
                <h3 className="text-3xl font-bold text-gray-800 mb-3">No Results Yet</h3>
                <p className="text-gray-600">Results will appear here once judges complete scoring.</p>
              </div>
            ) : (
              <div className="space-y-12">
                {Object.keys(groupedRankings).map((key) => {
                  const group = groupedRankings[key];
                  
                  return (
                    <div key={key} className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-gray-200">
                      {/* Group Header */}
                      <div className="bg-gradient-to-r from-teal-600 via-cyan-500 to-teal-600 p-8">
                        <h2 className="text-3xl font-extrabold text-white mb-3 drop-shadow-lg">
                          🏆 {group.category}
                          {group.variety !== 'None' && ` ${group.variety}`}
                        </h2>
                        <div className="flex flex-wrap gap-3 mb-3">
                          <span className="px-4 py-2 bg-white/30 backdrop-blur rounded-full text-sm font-bold text-white">
                            📅 {group.ageDivision}
                          </span>
                          <span className="px-4 py-2 bg-white/30 backdrop-blur rounded-full text-sm font-bold text-white">
                            ⭐ {group.abilityLevel}
                          </span>
                          <span className="px-4 py-2 bg-yellow-400/90 backdrop-blur rounded-full text-sm font-black text-gray-800 border-2 border-yellow-500">
                            {getDivisionTypeEmoji(group.divisionType)} {getDivisionTypeDisplayName(group.divisionType)}
                          </span>
                        </div>
                        <p className="text-white/90 text-lg font-semibold">
                          {group.entries.length} competitor{group.entries.length !== 1 ? 's' : ''} in this division
                        </p>
                      </div>

                      {/* Rankings Within This Group */}
                      <div className="p-6 space-y-4">
                        {group.entries.map((entry) => {
                          const isExpanded = expandedEntries.has(entry.id);
                          const categoryName = getCategoryName(entry.category_id);
                          const ageDivisionName = getAgeDivisionName(entry.age_division_id);

                          return (
                            <div
                              key={entry.id}
                              className={`bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-md border-2 ${getRankBorderColor(entry.categoryRank)} overflow-hidden hover:shadow-xl transition-all duration-300`}
                            >
                              {/* Entry Header */}
                              <div className={`bg-gradient-to-r ${getRankColor(entry.categoryRank)} p-4 flex items-center gap-4 flex-wrap`}>
                                {/* Rank Badge */}
                                <div className="relative">
                                  <div className="w-16 h-16 bg-white rounded-full flex flex-col items-center justify-center shadow-lg">
                                    <span className={`text-2xl font-extrabold ${entry.categoryRank <= 3 ? getScoreColor(100) : 'text-teal-600'}`}>
                                      {entry.categoryRank}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                      {entry.categoryRank === 1 ? 'st' : entry.categoryRank === 2 ? 'nd' : entry.categoryRank === 3 ? 'rd' : 'th'}
                                    </span>
                                  </div>
                                  {entry.categoryRank <= 3 && (
                                    <span className="absolute -top-1 -right-1 text-2xl">
                                      {getMedalEmoji(entry.categoryRank)}
                                    </span>
                                  )}
                                </div>

                                {/* Entry Photo */}
                                <div className="w-20 h-20 rounded-xl overflow-hidden border-3 border-white shadow-lg">
                                  {entry.photo_url ? (
                                    <LazyLoadImage
                                      src={entry.photo_url}
                                      alt={formatEntryName(entry)}
                                      effect="blur"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                      <span className="text-3xl text-gray-400">👤</span>
                                    </div>
                                  )}
                                </div>

                                {/* Entry Info */}
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-xl sm:text-2xl font-extrabold text-white drop-shadow-lg mb-2">
                                    {formatEntryName(entry)}
                                  </h3>
                                  <div className="flex items-center gap-3">
                                    <span className="px-3 py-1 bg-white/30 backdrop-blur rounded-full text-xs font-bold text-white">
                                      Age {entry.age}
                                    </span>
                                    {entry.is_medal_program && (
                                      <span className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold">
                                        ⭐ MEDAL PROGRAM
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Score Badge */}
                                <div className="bg-white rounded-2xl px-6 py-3 shadow-lg text-center">
                                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Score</div>
                                  <div className={`text-3xl font-extrabold ${getScoreColor(entry.averageScore)}`}>
                                    {entry.averageScore.toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">out of 100</div>
                                </div>
                              </div>

                              {/* Expand Button */}
                              <button
                                onClick={() => toggleExpanded(entry.id)}
                                className="w-full p-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-sm font-semibold text-gray-600"
                              >
                                <span>{isExpanded ? '▲' : '▼'}</span>
                                <span>{isExpanded ? 'Hide Details' : 'View Score Details'}</span>
                              </button>

                              {/* Expanded Score Details */}
                              {isExpanded && entry.scores && entry.scores.length > 0 && (
                                <div className="p-6 bg-gray-50 border-t-2 border-gray-200">
                                  {/* Studio and Teacher Info */}
                                  {(cleanDisplayText(entry.studio_name, '') || cleanDisplayText(entry.teacher_name, '')) && (
                                    <div className="mb-4 p-4 bg-white rounded-xl border-2 border-teal-100">
                                      <h4 className="text-sm font-bold text-teal-600 mb-2 uppercase tracking-wider">Studio & Teacher</h4>
                                      <div className="space-y-1">
                                        {cleanDisplayText(entry.studio_name, '') && (
                                          <p className="text-gray-700">
                                            <span className="font-semibold">Studio:</span> {cleanDisplayText(entry.studio_name, '')}
                                          </p>
                                        )}
                                        {cleanDisplayText(entry.teacher_name, '') && (
                                          <p className="text-gray-700">
                                            <span className="font-semibold">Teacher/Choreographer:</span> {cleanDisplayText(entry.teacher_name, '')}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <h4 className="text-lg font-bold text-gray-800 mb-4">Judge Scores</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {entry.scores.map((score) => (
                                      <div key={score.id} className="bg-white rounded-xl p-4 border-2 border-gray-200 shadow-sm">
                                        <h5 className="font-bold text-teal-600 mb-3">Judge {score.judge_number}</h5>
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Technique:</span>
                                            <span className="font-bold">{score.technique}/25</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Creativity:</span>
                                            <span className="font-bold">{score.creativity}/25</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Presentation:</span>
                                            <span className="font-bold">{score.presentation}/25</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-gray-600">Appearance:</span>
                                            <span className="font-bold">{score.appearance}/25</span>
                                          </div>
                                          <div className="flex justify-between pt-2 border-t-2 border-gray-200">
                                            <span className="font-bold text-teal-600">Total:</span>
                                            <span className="font-bold text-teal-600">{score.total_score}/100</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => handlePrintScoreSheet(entry)}
                                    disabled={generatingPdf}
                                    className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all flex items-center gap-2 mx-auto"
                                  >
                                    <span>🖨</span>
                                    <span>Print Score Sheet</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* FILTERED RESULTS VIEW (ORIGINAL) */}
          {selectedFilter !== 'medal' && viewMode === 'filtered' && (
            filteredResults.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-lg p-20 text-center">
              <div className="text-6xl mb-6">🏆</div>
              <h3 className="text-3xl font-bold text-gray-800 mb-3">No Results Yet</h3>
              <p className="text-gray-600">Results will appear here once judges complete scoring.</p>
        </div>
          ) : (
            <div className="space-y-6">
              {filteredResults.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id);
                const categoryName = getCategoryName(entry.category_id);
                const ageDivisionName = getAgeDivisionName(entry.age_division_id);

              return (
                <div
                  key={entry.id}
                    className={`bg-white rounded-3xl shadow-xl border-3 ${getRankBorderColor(entry.rank)} overflow-hidden hover:shadow-2xl hover:scale-[1.01] transition-all duration-300`}
                >
                    {/* CARD HEADER */}
                    <div className={`bg-gradient-to-r ${getRankColor(entry.rank)} p-6 flex items-center gap-6 flex-wrap`}>
                      {/* Rank Badge */}
                      <div className="relative">
                        <div className="w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center shadow-lg">
                          <span className={`text-3xl font-extrabold ${entry.rank <= 3 ? getScoreColor(100) : 'text-teal-600'}`}>
                            {entry.rank}
                          </span>
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            {entry.rank === 1 ? 'st' : entry.rank === 2 ? 'nd' : entry.rank === 3 ? 'rd' : 'th'}
                          </span>
                        </div>
                        {entry.rank <= 3 && (
                          <span className="absolute -top-2 -right-2 text-3xl">
                            {getMedalEmoji(entry.rank)}
                          </span>
                        )}
                      </div>

                      {/* Entry Photo */}
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                        {entry.photo_url ? (
                          <LazyLoadImage
                            src={entry.photo_url}
                            alt={formatEntryName(entry)}
                            effect="blur"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <span className="text-4xl text-gray-400">👤</span>
                          </div>
                        )}
                      </div>

                      {/* Entry Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-2xl sm:text-3xl font-extrabold text-white drop-shadow-lg">
                              {formatEntryName(entry)}
                          </h3>
                          {entry.is_medal_program && (
                            <div className="flex items-center gap-2">
                              <span className="bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter border border-yellow-200 shadow-sm">
                                ⭐ MEDAL PROGRAM
                              </span>
                              <MedalBadge medalLevel={entry.current_medal_level} size="sm" />
                              <span className="text-white/90 text-xs font-bold font-mono">
                                [{entry.medal_points} PTS]
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-4 py-1.5 bg-white/30 backdrop-blur rounded-full text-sm font-bold text-white">
                            {categoryName}
                          </span>
                          {ageDivisionName && (
                            <span className="px-4 py-1.5 bg-white/30 backdrop-blur rounded-full text-sm font-bold text-white">
                              🎂 {ageDivisionName}
                            </span>
                          )}
                          <span className="px-4 py-1.5 bg-white/30 backdrop-blur rounded-full text-sm font-bold text-white border border-white/20">
                            ⭐ {entry.ability_level}
                          </span>
                          {entry.is_medal_program && (
                            <span className="px-4 py-1.5 bg-yellow-400/20 backdrop-blur rounded-full text-[10px] font-black text-yellow-200 border border-yellow-400/30 uppercase tracking-widest">
                              🏆 {getMedalProgress(entry.medal_points)}
                            </span>
                          )}
                        </div>
                      </div>
                        </div>

                    {/* CARD BODY */}
                    <div className="p-8">
                        {/* Judge Scores */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
                        {entry.scores.map((score) => (
                          <div key={score.id} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 text-center border-2 border-gray-200 shadow-sm">
                            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                              Judge {score.judge_number}
                            </div>
                            <div className={`text-4xl font-extrabold ${getScoreColor(score.total_score)}`}>
                              {score.total_score.toFixed(1)}
                            </div>
                            <div className="text-sm text-gray-400">/ 100</div>
                            </div>
                          ))}
                        </div>

                        {/* Average Score */}
                      <div className="bg-gradient-to-r from-cyan-500 to-teal-500 rounded-2xl p-6 text-center mb-6">
                        <div className="text-sm font-bold text-white/80 uppercase tracking-widest mb-2">
                          Average Score
                        </div>
                        <div className="text-5xl font-black text-white drop-shadow-lg">
                          {entry.averageScore.toFixed(2)}
                      </div>
                        <div className="text-xl text-white/80">/ 100</div>
                    </div>

                      {/* Expand Button */}
                      <button
                        onClick={() => toggleExpanded(entry.id)}
                        className="w-full py-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-600 font-semibold hover:bg-gray-100 hover:border-teal-400 hover:text-teal-600 transition-all duration-200"
                      >
                        <span>{isExpanded ? '▲' : '▼'}</span>
                        <span>{isExpanded ? 'Hide Breakdown' : 'View Detailed Breakdown'}</span>
                      </button>

                      {/* EXPANDED BREAKDOWN */}
                  {isExpanded && (
                        <div className="mt-6 pt-6 border-t-2 border-gray-200 bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6">
                          {/* Studio and Teacher Info */}
                          {(cleanDisplayText(entry.studio_name, '') || cleanDisplayText(entry.teacher_name, '')) && (
                            <div className="mb-6 p-5 bg-white rounded-xl border-2 border-teal-200 shadow-sm">
                              <h4 className="text-lg font-bold text-teal-600 mb-3 flex items-center gap-2">
                                <span>🏫</span>
                                <span>Studio & Teacher Information</span>
                              </h4>
                              <div className="space-y-2">
                                {cleanDisplayText(entry.studio_name, '') && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-gray-500 font-semibold min-w-[100px]">Studio:</span>
                                    <span className="text-gray-800 font-medium">{cleanDisplayText(entry.studio_name, '')}</span>
                                  </div>
                                )}
                                {cleanDisplayText(entry.teacher_name, '') && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-gray-500 font-semibold min-w-[100px]">Teacher:</span>
                                    <span className="text-gray-800 font-medium">{cleanDisplayText(entry.teacher_name, '')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <h4 className="text-xl font-bold text-teal-600 mb-6">Detailed Score Breakdown</h4>
                          
                          {entry.scores.map((score) => {
                            const judgeName = competition?.judge_names?.[score.judge_number - 1] || `Judge ${score.judge_number}`;
                            return (
                              <div key={score.id} className="mb-6 p-6 bg-white rounded-2xl border-2 border-gray-200 shadow-sm">
                                <div className="flex items-center gap-3 mb-4 pb-4 border-b-2 border-gray-200">
                                  <div className="w-8 h-8 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">J{score.judge_number}</span>
                                  </div>
                                  <h5 className="text-lg font-bold text-gray-800">{judgeName}</h5>
                                </div>

                              <div className="grid gap-3 mb-4">
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                  <span className="font-semibold text-gray-700 flex items-center gap-2">
                                    <span>🎯</span> Technique
                                  </span>
                                  <span className={`text-xl font-bold ${getScoreColor(score.technique)}`}>
                                    {score.technique} / 25
                                  </span>
                            </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                  <span className="font-semibold text-gray-700 flex items-center gap-2">
                                    <span>✨</span> Creativity
                                  </span>
                                  <span className={`text-xl font-bold ${getScoreColor(score.creativity)}`}>
                                    {score.creativity} / 25
                                  </span>
                            </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                  <span className="font-semibold text-gray-700 flex items-center gap-2">
                                    <span>🎭</span> Presentation
                                  </span>
                                  <span className={`text-xl font-bold ${getScoreColor(score.presentation)}`}>
                                    {score.presentation} / 25
                                  </span>
                            </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                  <span className="font-semibold text-gray-700 flex items-center gap-2">
                                    <span>👗</span> Appearance
                                  </span>
                                  <span className={`text-xl font-bold ${getScoreColor(score.appearance)}`}>
                                    {score.appearance} / 25
                                  </span>
                            </div>
                          </div>

                              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl">
                                <span className="text-lg font-bold text-white uppercase">Total</span>
                                <span className="text-3xl font-extrabold text-white">
                                  {score.total_score.toFixed(1)} / 100
                                </span>
                          </div>

                          {score.notes && (
                                <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span>📝</span>
                                    <span className="text-sm font-bold text-yellow-800 uppercase tracking-wider">
                                      Judge Notes
                                    </span>
                                  </div>
                                  <p className="text-yellow-900 italic leading-relaxed">{score.notes}</p>
                            </div>
                          )}
                        </div>
                            );
                          })}

                      {/* Overall Average */}
                          <div className="p-8 bg-gradient-to-r from-cyan-600 to-teal-600 rounded-2xl text-center shadow-lg">
                            <div className="text-lg font-bold text-white/80 uppercase tracking-widest mb-3">
                              Final Average
                            </div>
                            <div className="text-6xl font-black text-white drop-shadow-xl">
                              {entry.averageScore.toFixed(2)} / 100
                            </div>
                      </div>
                    </div>
                  )}
                    </div>

                    {/* CARD FOOTER */}
                    <div className="px-8 py-5 bg-gray-50 border-t-2 border-gray-200 flex justify-end">
                      <button
                        onClick={() => handlePrintScoreSheet(entry)}
                        disabled={generatingPdf}
                        className={`inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 ${
                          generatingPdf 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-teal-500 to-cyan-500'
                        }`}
                      >
                        {generatingPdf ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <span>🖨</span>
                            <span>Print Score Sheet</span>
                          </>
                        )}
                      </button>
                    </div>
                </div>
              );
            })}
            </div>
          ))}

          {/* SEASON LEADERBOARD VIEW */}
          {selectedFilter === 'leaderboard' && (
            <div className="space-y-6">
              <MedalLeaderboard />
              
              {/* Info Section */}
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6 border-2 border-teal-200">
                <h3 className="text-lg font-bold text-teal-800 mb-3">
                  💡 How the Season Leaderboard Works
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold">•</span>
                    <span><strong>Individual Tracking:</strong> Each performer earns points individually (not per entry)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold">•</span>
                    <span><strong>Group Credits:</strong> In group entries, EACH member receives 1 point for a 1st place win</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold">•</span>
                    <span><strong>Multiple Entries:</strong> Same performer can earn points from solo AND group entries in one competition</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold">•</span>
                    <span><strong>Medal Levels:</strong> Bronze (25+ pts), Silver (35+ pts), Gold (50+ pts)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 font-bold">•</span>
                    <span><strong>Season Long:</strong> Points accumulate across ALL competitions throughout the season</span>
                  </li>
                </ul>
              </div>

              {/* Award Points Button */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-6 border-2 border-amber-300 text-center">
                <p className="text-gray-700 font-semibold mb-4">
                  Competition scored? Award medal points to 1st place Medal Program winners!
                </p>
                <button
                  onClick={handleAwardMedalPoints}
                  disabled={awardingPoints}
                  className="px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-bold rounded-xl shadow-lg hover:from-amber-600 hover:to-yellow-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {awardingPoints ? (
                    <>
                      <div className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Awarding Points...
                    </>
                  ) : (
                    '🏆 Award Medal Points for This Competition'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* SPECIAL CATEGORIES SECTION (Placement Trophy Only) */}
          {specialCategoryResults.length > 0 && (
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl shadow-2xl p-8 mb-12 border-4 border-gray-300">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-black text-gray-700 mb-3">
                  🎭 Special Categories
                </h2>
                <p className="text-lg text-gray-600 font-semibold bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 inline-block">
                  Category Awards Eligible - Excluded Only from Overall/High Score Awards
                </p>
              </div>

              <div className="space-y-6">
                {specialCategoryResults.map((entry) => {
                  const category = categories.find(c => c.id === entry.category_id);
                  const categoryName = category?.name || 'Unknown';
                  const ageDivisionName = getAgeDivisionName(entry.age_division_id);

                  return (
                    <div
                      key={entry.id}
                      className="bg-white rounded-2xl shadow-lg border-2 border-gray-300 p-6"
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Entry Photo */}
                        <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-gray-300">
                          {entry.photo_url ? (
                            <LazyLoadImage
                              src={entry.photo_url}
                              alt={formatEntryName(entry)}
                              className="w-full h-full object-cover"
                              effect="blur"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-2xl">
                              {entry.dance_type && entry.dance_type.includes('Solo') ? '👤' : '👥'}
                            </div>
                          )}
                        </div>

                        {/* Entry Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-2xl font-bold text-gray-800 mb-2">
                            {formatEntryName(entry)}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-gray-200 rounded-full text-sm font-semibold text-gray-700">
                              {categoryName}
                            </span>
                            {ageDivisionName && (
                              <span className="px-3 py-1 bg-gray-200 rounded-full text-sm font-semibold text-gray-700">
                                🎂 {ageDivisionName}
                              </span>
                            )}
                            <span className="px-3 py-1 bg-gray-200 rounded-full text-sm font-semibold text-gray-700">
                              ⭐ {entry.ability_level}
                            </span>
                            <span className="px-3 py-1 bg-gray-200 rounded-full text-sm font-semibold text-gray-700">
                              {getDivisionTypeDisplayName(entry.dance_type)}
                            </span>
                          </div>
                        </div>

                        {/* Special placement + average score */}
                        <div className="text-center">
                          {entry.rank && (
                            <div className="mb-2 px-4 py-2 bg-yellow-100 border-2 border-yellow-400 rounded-xl text-yellow-800 font-black">
                              🏆 {getPlacementLabel(entry.rank)}
                            </div>
                          )}
                          <div className="text-3xl font-black text-gray-700">
                            {entry.averageScore.toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-500 font-semibold">Average Score</div>
                        </div>
                      </div>

                      {/* Judge Scores */}
                      {entry.scores && entry.scores.length > 0 && (
                        <div className="mt-4 pt-4 border-t-2 border-gray-200">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {entry.scores.map((score) => (
                              <div key={score.id} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
                                <div className="text-xs font-semibold text-gray-600 mb-1">
                                  Judge {score.judge_number}
                                </div>
                                <div className="text-2xl font-bold text-gray-700">
                                  {score.total_score.toFixed(1)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div className="mt-16 pt-8 border-t-2 border-gray-200 text-center">
            <p className="text-sm font-semibold text-gray-600 mb-2">TOPAZ 2.0 © 2025</p>
            <p className="text-xs text-gray-500">Heritage Since 1972 | Official Competition Results</p>
          </div>
        </div>
      </div>

      {/* Edit Competition Modal */}
      <EditCompetitionModal
        competition={competition}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleCompetitionUpdated}
        onEntryAdded={loadAllData}
        entries={entries}
        scores={scores}
      />
    </Layout>
  );
}

export default ResultsPage;
