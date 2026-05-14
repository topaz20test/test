import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import { getCompetition } from '../supabase/competitions';
import { getCompetitionCategories } from '../supabase/categories';
import { getCompetitionAgeDivisions } from '../supabase/ageDivisions';
import { getCompetitionEntries } from '../supabase/entries';
import { entryMatchesCategory } from '../utils/entryFilters';
import { lockJudgeMode } from '../utils/accessControl';

function JudgeSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const stateId = location.state?.competitionId;
  const savedId = (() => {
    try { return sessionStorage.getItem('topaz_active_competition_id'); } catch (e) { return null; }
  })();
  const competitionId = stateId || savedId || null;

  // Ready-made image paths
  const logoPath = '/logo.png';
  const leftImagePath = '/left-dancer.png';
  const rightImagePath = '/right-dancer.png';

  // State
  const [competition, setCompetition] = useState(null);
  const [categories, setCategories] = useState([]);
  const [ageDivisions, setAgeDivisions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedJudgeNumber, setSelectedJudgeNumber] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Persist competitionId for recovery on refresh
  useEffect(() => {
    if (competitionId) {
      try { sessionStorage.setItem('topaz_active_competition_id', competitionId); } catch (e) { /* ignore */ }
    }
  }, [competitionId]);

  // Redirect if no competitionId
  useEffect(() => {
    if (!competitionId) {
      toast.error('No competition selected');
      navigate('/setup');
    }
  }, [competitionId, navigate]);

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      if (!competitionId) {
        console.warn('⚠️ No competitionId, skipping data load');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log('📡 Loading competition data:', competitionId);

        // Load all data in parallel
        const [compResult, catsResult, divsResult, entriesResult] = await Promise.all([
          getCompetition(competitionId),
          getCompetitionCategories(competitionId),
          getCompetitionAgeDivisions(competitionId),
          getCompetitionEntries(competitionId)
        ]);

        console.log('📥 Raw results:', {
          competition: compResult,
          categories: catsResult,
          divisions: divsResult,
          entries: entriesResult
        });

        if (!compResult.success) {
          throw new Error(compResult.error || 'Failed to load competition');
        }

        setCompetition(compResult.data);
        setCategories(catsResult.success ? catsResult.data : []);
        setAgeDivisions(divsResult.success ? divsResult.data : []);
        setEntries(entriesResult.success ? entriesResult.data : []);

        console.log('✅ Data loaded successfully:', {
          competition: compResult.data,
          categoriesCount: catsResult.data?.length || 0,
          ageDivisionsCount: divsResult.data?.length || 0,
          entriesCount: entriesResult.data?.length || 0
        });

        setLoading(false);
      } catch (error) {
        console.error('❌ Error loading competition data:', error);
        setError(error.message);
        toast.error(`Failed to load competition: ${error.message}`);
        setLoading(false);
        // Navigate back after showing error
        setTimeout(() => navigate('/setup'), 3000);
      }
    };

    loadData();
  }, [competitionId, navigate]);

  // Loading state
  if (loading) {
    return (
      <Layout overlayOpacity="bg-white/80">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading competition...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // No competition data - show error state
  if (!competition) {
    return (
      <Layout overlayOpacity="bg-white/80">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Competition Found</h2>
            <p className="text-gray-600 mb-2">Unable to load competition data.</p>
            {error && (
              <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">
                Error: {error}
              </p>
            )}
            {!competitionId && (
              <p className="text-orange-600 text-sm mb-4 bg-orange-50 p-3 rounded-lg">
                No competition ID provided. Please start from the Competition Setup page.
              </p>
            )}
            <button
              type="button"
              onClick={() => navigate('/setup')}
              className="px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 transition-colors"
            >
              Back to Setup
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const navigateToScoring = (judgeNum) => {
    try {
      sessionStorage.setItem('topaz_active_competition_id', competitionId);
      sessionStorage.setItem('topaz_active_judge_number', String(judgeNum));
    } catch (e) { /* ignore */ }
    lockJudgeMode();
    navigate('/scoring', {
      state: {
        competitionId,
        judgeNumber: judgeNum,
        competition,
        categories,
        ageDivisions,
        entries
      }
    });
  };

  const getJudgePinsObject = () => {
    const raw = competition?.judge_pins;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    return {};
  };

  // Handle judge selection (PIN gate when judge_pins[judge] is set)
  const handleJudgeSelect = (judgeNum) => {
    const pins = getJudgePinsObject();
    const pinForJudge = pins[String(judgeNum)] ?? '';
    if (pinForJudge.trim() === '') {
      navigateToScoring(judgeNum);
      return;
    }
    setSelectedJudgeNumber(judgeNum);
    setPinInput('');
    setPinError(false);
    setShowPinModal(true);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (selectedJudgeNumber == null) return;
    const pins = getJudgePinsObject();
    const correct = pins[String(selectedJudgeNumber)] ?? '';
    if (pinInput === String(correct)) {
      setShowPinModal(false);
      navigateToScoring(selectedJudgeNumber);
      return;
    }
    setPinError(true);
    setPinInput('');
  };

  // Handle admin view
  const handleAdminView = () => {
    navigate('/results', {
      state: {
        competitionId,
        isAdmin: true,
        competition,
        categories,
        ageDivisions,
        entries
      }
    });
  };

  // Get entry count for a category (includes website-synced rows matched by dance_type style)
  const getCategoryEntryCount = (categoryId) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return 0;
    return entries.filter((e) => entryMatchesCategory(e, cat)).length;
  };

  // Get entry count for an age division
  const getAgeDivisionEntryCount = (divisionId) => {
    return entries.filter(e => e.age_division_id === divisionId).length;
  };

  return (
    <Layout overlayOpacity="bg-white/80">
      <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8">
        {/* Header - Integrated with full branding logos */}
        <div className="flex items-center justify-between mb-10 max-w-5xl mx-auto w-full">
          <button
            type="button"
            onClick={() => navigate('/setup')}
            className="text-gray-600 hover:text-gray-800 text-base sm:text-lg font-semibold flex items-center min-h-[44px] z-20"
          >
            ← <span className="hidden sm:inline ml-1">Back</span>
          </button>
          
          {/* Header Branding - Horizontal Three Logos */}
          <div className="flex flex-row items-center justify-center gap-3 sm:gap-6 animate-fade-in flex-1 px-4">
            <div className="w-10 h-14 sm:w-12 sm:h-16 flex items-center justify-center">
              <img 
                src={leftImagePath} 
                alt="" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const parent = e.target.parentNode;
                  if (parent) {
                    parent.innerHTML = '<span class="text-2xl sm:text-3xl opacity-40">🩰</span>';
                  }
                }}
              />
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
              <img 
                src={logoPath} 
                alt="Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const parent = e.target.parentNode;
                  if (parent) {
                    parent.innerHTML = '<span class="text-3xl sm:text-4xl opacity-40">🎭</span>';
                  }
                }}
              />
            </div>
            <div className="w-10 h-14 sm:w-12 sm:h-16 flex items-center justify-center">
              <img 
                src={rightImagePath} 
                alt="" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const parent = e.target.parentNode;
                  if (parent) {
                    parent.innerHTML = '<span class="text-2xl sm:text-3xl opacity-40">💃</span>';
                  }
                }}
              />
            </div>
          </div>
          
          <div className="text-right z-20">
            <span className="text-teal-600 font-bold text-sm sm:text-base whitespace-nowrap">Step 2 / 3</span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto text-center w-full">
          {/* Competition Info */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2 px-4">Judge Selection</h1>
            <p className="text-lg sm:text-xl text-teal-600 font-semibold px-4 line-clamp-2">
              {competition?.name}
            </p>
            <p className="text-sm sm:text-base text-gray-600 mt-2 px-4">
              {entries.length} total {entries.length === 1 ? 'entry' : 'entries'} • {competition?.judges_count} {competition?.judges_count === 1 ? 'judge' : 'judges'}
            </p>
          </div>

          {/* Category Breakdown */}
          {categories.length > 0 && (
            <div className="mb-6 px-4">
              <p className="text-gray-700 text-sm sm:text-base">
                {categories.map((cat, index) => {
                  const catEntries = getCategoryEntryCount(cat.id);
                  return (
                    <span key={cat.id}>
                      {catEntries} {cat.name}
                      {index < categories.length - 1 && ' • '}
                    </span>
                  );
                })}
              </p>
            </div>
          )}

          {/* Age Division Breakdown */}
          {ageDivisions.length > 0 && (
            <div className="mb-6 px-4">
              <p className="text-gray-700 text-sm sm:text-base">
                <span className="font-semibold">Age Divisions: </span>
                {ageDivisions.map((div, index) => {
                  const divEntries = getAgeDivisionEntryCount(div.id);
                  return (
                    <span key={div.id}>
                      {divEntries} {div.name}
                      {index < ageDivisions.length - 1 && ' • '}
                    </span>
                  );
                })}
              </p>
            </div>
          )}

          <h2 className="text-xl sm:text-2xl text-gray-700 mb-6 sm:mb-8">Who will be scoring?</h2>

          {/* Judge Buttons Grid - 1 col for tiny screens, 2 for mobile/small tablet, 3 for iPad/Desktop */}
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 px-4">
            {Array.from({ length: competition?.judges_count || 3 }, (_, i) => i + 1).map((judgeNum) => {
              const judgeName = competition?.judge_names?.[judgeNum - 1] || `Judge ${judgeNum}`;
              return (
                <button
                  type="button"
                  key={judgeNum}
                  onClick={() => handleJudgeSelect(judgeNum)}
                  className="aspect-[4/3] sm:aspect-square bg-gradient-to-br from-cyan-400 to-teal-500 rounded-2xl 
                             flex flex-col items-center justify-center p-4 sm:p-6
                             hover:from-cyan-500 hover:to-teal-600 active:scale-95 
                             transition-all shadow-xl hover:shadow-2xl min-h-[120px]"
                >
                  <span className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-3">🎭</span>
                  <span className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight">{judgeName}</span>
                </button>
              );
            })}
          </div>

          {/* Admin Section - Responsive sizing and padding */}
          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t-2 border-gray-200 px-4">
            <p className="text-sm sm:text-base text-gray-600 mb-4">Competition Administrator</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center max-w-2xl mx-auto">
              <button
                type="button"
                onClick={handleAdminView}
                className="w-full sm:flex-1 py-4 sm:py-5 bg-gradient-to-r from-blue-600 to-blue-800 
                           text-white text-lg sm:text-xl font-bold rounded-xl 
                           hover:from-blue-700 hover:to-blue-900 active:scale-95 
                           transition-all shadow-lg flex items-center justify-center gap-3 min-h-[56px]"
              >
                <span className="text-xl sm:text-2xl">📊</span>
                <span>Admin View</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin', { state: { competitionId } })}
                className="w-full sm:flex-1 py-4 sm:py-5 bg-gradient-to-r from-indigo-600 to-indigo-800 
                           text-white text-lg sm:text-xl font-bold rounded-xl 
                           hover:from-indigo-700 hover:to-indigo-900 active:scale-95 
                           transition-all shadow-lg flex items-center justify-center gap-3 min-h-[56px]"
              >
                <span className="text-xl sm:text-2xl">🎛️</span>
                <span>Admin Control Panel</span>
              </button>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-3">View scores & results, or control judge filters</p>
          </div>

          {/* Guidelines Section - Optimized for small screens */}
          <div className="mt-8 sm:mt-12 mb-8 bg-white/60 backdrop-blur-sm rounded-xl p-4 sm:p-6 max-w-2xl mx-auto border-2 border-teal-200">
            <p className="text-teal-800 text-sm sm:text-base text-left">
              <span className="inline-block mr-1">👉</span> <strong>Judges:</strong> Select your judge number to begin scoring.
            </p>
            <p className="text-teal-800 text-sm sm:text-base mt-2 text-left">
              <span className="inline-block mr-1">👉</span> <strong>Admin View:</strong> See rankings and results.
            </p>
            <p className="text-teal-800 text-sm sm:text-base mt-2 text-left">
              <span className="inline-block mr-1">👉</span> <strong>Admin Control Panel:</strong> Control what judges see (filters apply to all judge screens).
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-500 pb-8">
            <p className="font-semibold">TOPAZ 2.0 © 2025</p>
            <p className="mt-1">Heritage Since 1972 | Judge Selection</p>
          </div>
        </div>
      </div>

      {showPinModal && selectedJudgeNumber != null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border-2 border-gray-200">
            <h2 id="pin-modal-title" className="text-xl font-bold text-gray-800 mb-1">
              Judge {selectedJudgeNumber} — Enter PIN
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {competition?.judge_names?.[selectedJudgeNumber - 1] || `Judge ${selectedJudgeNumber}`}
            </p>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label htmlFor="judge-pin-input" className="sr-only">
                  PIN
                </label>
                <input
                  id="judge-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="one-time-code"
                  value={pinInput}
                  onChange={(ev) => {
                    setPinInput(ev.target.value.replace(/\D/g, '').slice(0, 4));
                    setPinError(false);
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-center text-2xl tracking-widest font-mono focus:border-[#2E75B6] focus:outline-none min-h-[52px]"
                  placeholder="••••"
                />
                {pinError && (
                  <p className="text-red-600 text-sm font-semibold mt-2">Incorrect PIN. Try again.</p>
                )}
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-white bg-[#2E75B6] hover:bg-[#256499] min-h-[48px] transition-colors"
              >
                Enter
              </button>
              <button
                type="button"
                className="w-full py-2 text-gray-600 font-semibold text-sm hover:text-gray-800"
                onClick={() => {
                  setShowPinModal(false);
                  setPinInput('');
                  setPinError(false);
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default JudgeSelection;
