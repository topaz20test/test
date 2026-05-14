import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import LoadingSpinner from './LoadingSpinner';
import { getCompetitionEntries, updateEntry } from '../supabase/entries';
import { uploadEntryMusic } from '../supabase/music';
import { formatEntryName, getEntryDivisionType, getGroupMemberNamesLabel, cleanDisplayText } from '../utils/entryFilters';

function MusicUploadManager({ competitionId, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});
  const [search, setSearch] = useState('');

  const loadEntries = async () => {
    try {
      setLoading(true);
      const result = await getCompetitionEntries(competitionId);
      if (result.success) {
        setEntries(result.data || []);
      } else {
        toast.error('Failed to load entries');
      }
    } catch (error) {
      console.error('Error loading entries for music:', error);
      toast.error('Error loading entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [competitionId]);

  const handleUpload = async (entry, file) => {
    if (!file) return;
    setUploading((prev) => ({ ...prev, [entry.id]: true }));
    try {
      const uploadResult = await uploadEntryMusic(file, entry.id, competitionId);
      if (!uploadResult.success) {
        toast.error(uploadResult.error || 'Music upload failed');
        return;
      }

      const updateResult = await updateEntry(entry.id, {
        music_url: uploadResult.url,
        music_file_name: uploadResult.fileName
      });

      if (!updateResult.success) {
        toast.error(updateResult.error || 'Music uploaded but entry update failed');
        return;
      }

      toast.success(`Audio uploaded for ${formatEntryName(entry)}`);
      await loadEntries();
    } catch (error) {
      console.error('Music upload error:', error);
      toast.error(error.message || 'Music upload failed');
    } finally {
      setUploading((prev) => ({ ...prev, [entry.id]: false }));
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const text = [
      entry.entry_number,
      formatEntryName(entry),
      entry.competitor_name,
      entry.studio_name,
      entry.teacher_name,
      getGroupMemberNamesLabel(entry)
    ].filter(Boolean).join(' ').toLowerCase();
    return text.includes(q);
  });

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <LoadingSpinner />
          <p className="text-center text-gray-600 mt-4">Loading entries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-indigo-700 to-purple-600 p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">🎵 Music Upload Manager</h2>
              <p className="text-white/90">Upload or replace audio files for each entry</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              aria-label="Close music upload manager"
            >
              <span className="text-3xl">×</span>
            </button>
          </div>
        </div>

        <div className="bg-purple-50 border-b-2 border-purple-200 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-black text-purple-700">{entries.length}</div>
              <div className="text-sm text-gray-600 font-semibold">Total Entries</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-black text-orange-600">{entries.filter(e => !e.music_url).length}</div>
              <div className="text-sm text-gray-600 font-semibold">Missing Music</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-3xl font-black text-green-600">{entries.filter(e => e.music_url).length}</div>
              <div className="text-sm text-gray-600 font-semibold">Music Uploaded</div>
            </div>
          </div>
          <p className="text-sm text-purple-800 mt-4 font-semibold">
            Supported audio: MP3, WAV, M4A, AAC, FLAC, OGG, WEBM. Maximum file size: 25MB. Existing music will be replaced.
          </p>
        </div>

        <div className="p-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by entry number, routine, dancer, studio, or teacher..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 mb-6"
          />

          <div className="space-y-4">
            {filteredEntries.map((entry) => {
              const musicLabel = cleanDisplayText(entry.music_file_name || entry.music_url, 'No music uploaded');
              return (
                <div key={entry.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-black">
                          #{entry.entry_number ?? '?'}
                        </span>
                        <span className="font-bold text-gray-900 text-lg truncate">
                          {formatEntryName(entry)}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                          {getEntryDivisionType(entry)}
                        </span>
                      </div>
                      {getGroupMemberNamesLabel(entry) && (
                        <p className="text-sm text-gray-700 font-medium">Dancers: {getGroupMemberNamesLabel(entry)}</p>
                      )}
                      <p className={`text-sm font-semibold mt-2 ${entry.music_url ? 'text-green-700' : 'text-orange-700'}`}>
                        {entry.music_url ? `🎵 ${musicLabel}` : '⚠️ No audio uploaded'}
                      </p>
                      {entry.music_url && (
                        <audio controls src={entry.music_url} className="w-full mt-3" preload="metadata">
                          Your browser does not support audio playback.
                        </audio>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      <label className={`inline-flex items-center justify-center px-4 py-3 rounded-lg font-bold text-white cursor-pointer transition-colors ${uploading[entry.id] ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
                        {uploading[entry.id] ? 'Uploading...' : entry.music_url ? 'Replace Audio' : 'Upload Audio'}
                        <input
                          type="file"
                          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave,audio/mp4,audio/aac,audio/flac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.flac,.ogg,.webm"
                          className="hidden"
                          disabled={uploading[entry.id]}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) handleUpload(entry, file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredEntries.length === 0 && (
              <div className="text-center py-12 text-gray-500 font-semibold">
                No entries match your search.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MusicUploadManager;
