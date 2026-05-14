import { supabase } from './config';
import imageCompression from 'browser-image-compression';

const BUCKET_NAME = 'entry-photos';

/**
 * Compress image before upload
 * @param {File} imageFile - Original image file
 * @returns {File} - Compressed image file
 */
export const compressImage = async (imageFile) => {
  try {
    console.log('Original image size:', imageFile.size / 1024 / 1024, 'MB');
    
    const options = {
      maxSizeMB: 1, // Max 1MB
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg'
    };
    
    const compressedFile = await imageCompression(imageFile, options);
    console.log('Compressed image size:', compressedFile.size / 1024 / 1024, 'MB');
    
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
};

/**
 * Upload entry photo to Supabase storage
 * @param {File} file - Image file to upload
 * @param {string} entryId - UUID of entry
 * @param {string} competitionId - UUID of competition
 * @returns {Object} - Public URL of uploaded photo
 */
export const uploadEntryPhoto = async (file, entryId, competitionId) => {
  try {
    console.log('Uploading photo for entry:', entryId);
    
    // Compress image
    const compressedFile = await compressImage(file);
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `${competitionId}/${entryId}_${timestamp}.${fileExt}`;
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: compressedFile.type
      });

    if (error) throw error;
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);
    
    console.log('✅ Photo uploaded:', urlData.publicUrl);
    return { success: true, url: urlData.publicUrl, path: fileName };
  } catch (error) {
    console.error('❌ Error uploading photo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete entry photo from storage
 * @param {string} filePath - Path to file in storage (e.g., 'competition-id/entry-id_timestamp.jpg')
 * @returns {Object} - Success status
 */
export const deleteEntryPhoto = async (filePath) => {
  try {
    console.log('Deleting photo:', filePath);
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) throw error;
    
    console.log('✅ Photo deleted');
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting photo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk upload photos for multiple entries
 * @param {Array} files - Array of { file: File, entryId: string }
 * @param {string} competitionId - UUID of competition
 * @returns {Array} - Array of upload results
 */
export const bulkUploadPhotos = async (files, competitionId) => {
  try {
    console.log('Bulk uploading photos:', files.length);
    
    const uploadPromises = files.map(({ file, entryId }) => 
      uploadEntryPhoto(file, entryId, competitionId)
    );
    
    const results = await Promise.allSettled(uploadPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const failed = results.filter(r => r.status === 'rejected' || !r.value.success);
    
    console.log('✅ Bulk upload complete:', successful.length, 'success,', failed.length, 'failed');
    
    return {
      success: true,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }),
      summary: {
        total: files.length,
        successful: successful.length,
        failed: failed.length
      }
    };
  } catch (error) {
    console.error('❌ Error bulk uploading photos:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all photos for a competition
 * @param {string} competitionId - UUID of competition
 * @returns {Array} - List of photo URLs
 */
export const getCompetitionPhotos = async (competitionId) => {
  try {
    console.log('Fetching photos for competition:', competitionId);
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(competitionId);

    if (error) throw error;
    
    // Generate public URLs for all photos
    const photos = data.map(file => {
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(`${competitionId}/${file.name}`);
      
      return {
        name: file.name,
        url: urlData.publicUrl,
        path: `${competitionId}/${file.name}`,
        size: file.metadata?.size,
        created_at: file.created_at
      };
    });
    
    console.log('✅ Competition photos fetched:', photos.length);
    return { success: true, data: photos };
  } catch (error) {
    console.error('❌ Error fetching competition photos:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update entry photo URL in database
 * @param {string} entryId - UUID of entry
 * @param {string} photoUrl - Public URL of photo
 * @returns {Object} - Success status
 */
export const updateEntryPhotoUrl = async (entryId, photoUrl) => {
  try {
    console.log('Updating entry photo URL:', entryId);
    
    const { error } = await supabase
      .from('entries')
      .update({ photo_url: photoUrl })
      .eq('id', entryId);

    if (error) throw error;
    
    console.log('✅ Entry photo URL updated');
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating entry photo URL:', error);
    return { success: false, error: error.message };
  }
};

