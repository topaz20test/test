import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { toast } from 'react-toastify';

function PhotoUpload({ onPhotoSelect, existingPhotoUrl = null }) {
  const [preview, setPreview] = useState(existingPhotoUrl);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(file.type)) {
      toast.error('Supported photo formats: JPG, PNG, WEBP, GIF, HEIC, HEIF');
      return;
    }

    try {
      setIsProcessing(true);
      let processedFile = file;

      // Check file size and compress if needed
      const fileSizeInMB = file.size / (1024 * 1024);
      
      if (fileSizeInMB > 1) {
        toast.info('Compressing image...');
        
        const options = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
          fileType: 'image/jpeg'
        };

        try {
          processedFile = await imageCompression(file, options);
          const compressedSizeInMB = processedFile.size / (1024 * 1024);
          toast.success(`Image compressed from ${fileSizeInMB.toFixed(2)}MB to ${compressedSizeInMB.toFixed(2)}MB`);
        } catch (compressionError) {
          console.error('Compression error:', compressionError);
          toast.warning('Could not compress image, using original');
          processedFile = file;
        }
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(processedFile);

      // Call parent callback with processed file
      if (onPhotoSelect) {
        onPhotoSelect(processedFile);
      }

      setIsProcessing(false);
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image');
      setIsProcessing(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onPhotoSelect) {
      onPhotoSelect(null);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        Entry Photo (Optional)
      </label>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Preview */}
        {preview && (
          <div className="relative">
            <img
              src={preview}
              alt="Entry preview"
              className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600"
              aria-label="Remove photo"
            >
              ✕
            </button>
          </div>
        )}

        {/* Upload Button */}
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isProcessing}
          />
          
          <button
            type="button"
            onClick={handleButtonClick}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg font-semibold text-white min-h-[44px] transition-colors ${
              isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-teal-500 hover:bg-teal-600'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⚙️</span>
                Processing...
              </span>
            ) : preview ? (
              '📷 Change Photo'
            ) : (
              '📷 Upload Photo'
            )}
          </button>

          <p className="text-xs text-gray-500 mt-2">
            Max size: 1MB • Formats: JPG, PNG, WEBP, GIF, HEIC, HEIF • Auto-compressed if needed
          </p>
        </div>
      </div>
    </div>
  );
}

export default PhotoUpload;
