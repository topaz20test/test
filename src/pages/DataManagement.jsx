import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import {
  resetAllMedalPointsGlobally,
  getTestCompetitions,
  deleteCompetition,
  archiveAllCompetitions,
  nuclearReset
} from '../supabase/dataManagement';

function DataManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null); // 'medals' | 'test' | 'archive' | 'nuclear'

  const handleResetAllMedalPoints = async () => {
    const confirmed = window.confirm(
      'Reset ALL medal points for ALL entries across ALL competitions?\n\n' +
      'This will set all medal program entries to 0 points and "None" medal level. ' +
      'Medal leaderboard will be cleared. Use at end of season after results are transferred.\n\n' +
      'This cannot be undone.'
    );
    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      'FINAL CONFIRMATION: Reset all medal points globally?'
    );
    if (!doubleConfirmed) return;

    setLoading('medals');
    try {
      const result = await resetAllMedalPointsGlobally();
      if (result.success) {
        toast.success('All medal points have been reset to 0.');
        navigate('/');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Reset medal points error:', error);
      toast.error(`Failed to reset: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteTestCompetitions = async () => {
    const confirmed = window.confirm(
      'This will permanently delete all competitions with "test" in the name.\n\n' +
      'This includes all entries, scores, and data. Continue?'
    );
    if (!confirmed) return;

    setLoading('test');
    try {
      const { success, data: competitions } = await getTestCompetitions();
      if (!success || !competitions || competitions.length === 0) {
        toast.info('No test competitions found.');
        setLoading(null);
        return;
      }

      const doubleConfirmed = window.confirm(
        `Found ${competitions.length} test competition(s):\n\n` +
        competitions.map((c) => `• ${c.name}`).join('\n') +
        '\n\nDelete all of these? This cannot be undone.'
      );
      if (!doubleConfirmed) {
        setLoading(null);
        return;
      }

      for (const comp of competitions) {
        const result = await deleteCompetition(comp.id);
        if (!result.success) throw new Error(result.error);
      }

      toast.success(`Deleted ${competitions.length} test competition(s).`);
      navigate('/');
    } catch (error) {
      console.error('Delete test competitions error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleArchiveAll = async () => {
    const confirmed = window.confirm(
      'Archive ALL active competitions?\n\n' +
      'They will move to the archive. You can restore them later. Continue?'
    );
    if (!confirmed) return;

    setLoading('archive');
    try {
      const result = await archiveAllCompetitions();
      if (result.success) {
        toast.success('All competitions have been archived.');
        navigate('/');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Archive error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleNuclearReset = async () => {
    const confirmed = window.confirm(
      '🔥 NUCLEAR RESET 🔥\n\n' +
      'This will DELETE EVERYTHING:\n' +
      '• All competitions\n' +
      '• All entries\n' +
      '• All scores\n' +
      '• All medal data\n' +
      '• All categories\n' +
      '• All admin filters\n\n' +
      'This is PERMANENT and CANNOT be undone.\n\n' +
      'Are you ABSOLUTELY sure?'
    );
    if (!confirmed) return;

    const typeConfirm = window.prompt(
      'Type "DELETE EVERYTHING" (all caps) to confirm:'
    );
    if (typeConfirm !== 'DELETE EVERYTHING') {
      toast.info('Reset cancelled.');
      return;
    }

    setLoading('nuclear');
    try {
      const result = await nuclearReset();
      if (result.success) {
        toast.success('All data has been deleted. Redirecting...');
        navigate('/');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Nuclear reset error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Layout overlayOpacity="bg-white/90">
      <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 max-w-3xl mx-auto w-full">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="self-start text-gray-600 hover:text-gray-800 font-semibold mb-6 flex items-center gap-2"
        >
          ← Back to Home
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
          ⚠️ Data Management
        </h1>
        <p className="text-gray-600 mb-8">
          Clear test data, reset medal leaderboard, or start fresh for a new season.
        </p>

        <div className="space-y-6">
          {/* Reset Medal Leaderboard */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-amber-900 mb-2">
              Reset Medal Leaderboard
            </h3>
            <p className="text-sm text-amber-800 mb-4">
              Clear all medal points for ALL entries across ALL competitions. Use at end of season after results are transferred.
            </p>
            <button
              type="button"
              onClick={handleResetAllMedalPoints}
              disabled={!!loading}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'medals' ? 'Resetting...' : 'Reset All Medal Points (Season-wide)'}
            </button>
          </div>

          {/* Delete Test Competitions */}
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-orange-900 mb-2">
              Delete Test Competitions
            </h3>
            <p className="text-sm text-orange-800 mb-4">
              Permanently delete competitions with &quot;test&quot; in the name. Includes all entries and scores.
            </p>
            <button
              type="button"
              onClick={handleDeleteTestCompetitions}
              disabled={!!loading}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'test' ? 'Deleting...' : 'Delete All Test Competitions'}
            </button>
          </div>

          {/* Archive All */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-yellow-900 mb-2">
              Archive All Competitions
            </h3>
            <p className="text-sm text-yellow-800 mb-4">
              Move all active competitions to the archive. Use to start a new season while keeping old data.
            </p>
            <button
              type="button"
              onClick={handleArchiveAll}
              disabled={!!loading}
              className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'archive' ? 'Archiving...' : 'Archive All Active Competitions'}
            </button>
          </div>

          {/* Nuclear Reset */}
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
            <h3 className="text-lg font-bold text-red-900 mb-2">
              🔥 Nuclear Reset (Delete Everything)
            </h3>
            <p className="text-sm text-red-800 font-bold mb-4">
              WARNING: This deletes ALL competitions, entries, scores, and medal data. This CANNOT be undone.
            </p>
            <button
              type="button"
              onClick={handleNuclearReset}
              disabled={!!loading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'nuclear' ? 'Deleting...' : '🔥 Delete Everything and Start Over'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default DataManagement;
