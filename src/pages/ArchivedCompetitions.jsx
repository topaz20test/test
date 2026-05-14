import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Archive, RefreshCw, Trash2, Loader, Eye } from 'lucide-react';
import Layout from '../components/Layout';
import { getArchivedCompetitions, restoreCompetition, deleteCompetition } from '../supabase/competitions';
import { supabase } from '../supabase/config';

function ArchivedCompetitions() {
  const navigate = useNavigate();
  const [archivedCompetitions, setArchivedCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Ready-made image paths
  const logoPath = '/logo.png';
  const leftImagePath = '/left-dancer.png';
  const rightImagePath = '/right-dancer.png';

  useEffect(() => {
    loadArchivedCompetitions();
  }, []);

  const loadArchivedCompetitions = async () => {
    try {
      setLoading(true);
      
      const result = await getArchivedCompetitions();
      
      if (result.success) {
        // Get entry counts for each competition
        const compsWithCounts = await Promise.all(
          (result.data || []).map(async (comp) => {
            const { count, error: countError } = await supabase
              .from('entries')
              .select('*', { count: 'exact', head: true })
              .eq('competition_id', comp.id);

            if (countError) {
              console.error('Error counting entries:', countError);
              return { ...comp, entry_count: 0 };
            }

            return { ...comp, entry_count: count || 0 };
          })
        );

        setArchivedCompetitions(compsWithCounts);
        console.log('✅ Loaded archived competitions:', compsWithCounts.length);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Error loading archived competitions:', error);
      toast.error('Failed to load archived competitions');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (comp) => {
    const confirmed = window.confirm(
      `🔄 RESTORE "${comp.name}"?\n\n` +
      `This will move the competition back to your active list.\n` +
      `All ${comp.entry_count || 0} entries and data will be restored.\n\n` +
      `Continue?`
    );
    
    if (!confirmed) return;
    
    try {
      setRestoringId(comp.id);
      
      const result = await restoreCompetition(comp.id);
      
      if (result.success) {
        toast.success(`"${comp.name}" restored successfully!`);
        loadArchivedCompetitions();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('An error occurred while restoring');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (comp) => {
    const firstConfirm = window.confirm(
      `⚠️ PERMANENTLY DELETE "${comp.name}"?\n\n` +
      `This will PERMANENTLY delete:\n` +
      `• ${comp.entry_count || 0} entries\n` +
      `• All scores and results\n` +
      `• All photos and data\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Are you absolutely sure?`
    );
    
    if (!firstConfirm) return;
    
    const secondConfirm = window.confirm(
      `🚨 FINAL WARNING 🚨\n\n` +
      `You are about to PERMANENTLY delete "${comp.name}".\n\n` +
      `This is your last chance to cancel!\n\n` +
      `Type OK to confirm deletion.`
    );
    
    if (!secondConfirm) return;
    
    try {
      setDeletingId(comp.id);
      
      const result = await deleteCompetition(comp.id);
      
      if (result.success) {
        toast.success(`"${comp.name}" permanently deleted`);
        loadArchivedCompetitions();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('An error occurred while deleting');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewResults = (comp) => {
    try {
      sessionStorage.setItem('topaz_active_competition_id', comp.id);
    } catch (e) { /* ignore */ }
    navigate('/results', {
      state: {
        competitionId: comp.id,
        competitionName: comp.name
      }
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <Layout overlayOpacity="bg-white/80">
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        {/* Branding Header */}
        <div className="flex flex-row items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-8">
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

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-teal-500 mb-4 text-center">
          📦 Archived Competitions
        </h1>
        <p className="text-gray-600 text-sm sm:text-base mb-8 text-center max-w-2xl">
          These competitions have been archived to keep your main page clean. You can restore them anytime or permanently delete them.
        </p>

        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-6 px-4 py-2 text-teal-600 hover:text-teal-700 font-semibold text-sm flex items-center gap-2"
        >
          ← Back to Active Competitions
        </button>

        {/* Archived Competitions List */}
        {loading ? (
          <div className="flex items-center gap-3 text-gray-600">
            <Loader className="animate-spin" size={24} />
            <span>Loading archived competitions...</span>
          </div>
        ) : archivedCompetitions.length > 0 ? (
          <div className="w-full max-w-4xl">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6">
              <div className="space-y-4">
                {archivedCompetitions.map((comp) => (
                  <div
                    key={comp.id}
                    className="bg-gray-50 rounded-xl p-5 border-2 border-gray-200 hover:border-gray-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                          {comp.name}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            📅 {formatDate(comp.date)}
                          </span>
                          {comp.venue && (
                            <span className="flex items-center gap-1">
                              📍 {comp.venue}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-gray-700">{comp.entry_count}</span> entries
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-gray-700">{comp.judges_count}</span> judges
                          </span>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
                        📦 Archived
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleRestore(comp)}
                        disabled={restoringId === comp.id}
                        className="px-4 py-2 bg-teal-500 text-white text-sm font-bold rounded-lg hover:bg-teal-600 disabled:bg-gray-400 flex items-center gap-2 transition-all"
                      >
                        {restoringId === comp.id ? (
                          <>
                            <Loader className="animate-spin" size={16} />
                            Restoring...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={16} />
                            Restore
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleViewResults(comp)}
                        className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 flex items-center gap-2 transition-all"
                      >
                        <Eye size={16} />
                        View Results
                      </button>

                      <button
                        onClick={() => handlePermanentDelete(comp)}
                        disabled={deletingId === comp.id}
                        className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 disabled:bg-gray-400 flex items-center gap-2 transition-all"
                      >
                        {deletingId === comp.id ? (
                          <>
                            <Loader className="animate-spin" size={16} />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 size={16} />
                            Permanently Delete
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl px-4">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 text-center border-2 border-dashed border-gray-300">
              <div className="text-4xl mb-3">📦</div>
              <p className="text-gray-600 font-semibold mb-2">No Archived Competitions</p>
              <p className="text-sm text-gray-500">Your archive is empty. Archived competitions will appear here.</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-xs sm:text-sm text-gray-500">
          <p className="font-semibold">TOPAZ 2.0 © 2025</p>
          <p className="mt-1">Heritage Since 1972</p>
        </div>
      </div>
    </Layout>
  );
}

export default ArchivedCompetitions;













