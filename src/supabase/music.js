import { supabase } from './config';

const BUCKET_NAME = 'entry-music';
const MAX_MP3_SIZE_MB = 25;
const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.webm'];
const ALLOWED_AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/ogg', 'audio/webm'];

const sanitizeFileName = (name = 'music.mp3') =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'music.mp3';

export const validateMusicFile = (file) => {
  if (!file) return { valid: false, error: 'No file selected' };
  const fileName = file.name || '';
  const lowerName = fileName.toLowerCase();
  const isSupportedAudio = ALLOWED_AUDIO_MIME_TYPES.includes(file.type) || ALLOWED_AUDIO_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!isSupportedAudio) {
    return { valid: false, error: 'Please upload a supported audio file: MP3, WAV, M4A, AAC, FLAC, OGG, or WEBM' };
  }
  const maxBytes = MAX_MP3_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: `Audio file must be ${MAX_MP3_SIZE_MB}MB or smaller` };
  }
  return { valid: true };
};

export const uploadEntryMusic = async (file, entryId, competitionId) => {
  try {
    const validation = validateMusicFile(file);
    if (!validation.valid) throw new Error(validation.error);

    const timestamp = Date.now();
    const safeName = sanitizeFileName(file.name || 'music.mp3');
    const fileName = `${competitionId}/${entryId}_${timestamp}_${safeName}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'audio/mpeg'
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return {
      success: true,
      url: urlData.publicUrl,
      path: fileName,
      fileName: file.name || safeName
    };
  } catch (error) {
    console.error('❌ Error uploading music:', error);
    return { success: false, error: error.message };
  }
};

export const deleteEntryMusic = async (filePath) => {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting music:', error);
    return { success: false, error: error.message };
  }
};
