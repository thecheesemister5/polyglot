export interface ConvertResult {
  blob: Blob;
  name: string;
}

/**
 * Converts an image file (e.g., BMP, WebP) into a specified format using the canvas API.
 * @param imageFile The image file to convert.
 * @param targetMimeType The target MIME type (e.g., 'image/png', 'image/jpeg').
 * @param quality For lossy formats like JPEG and WebP, a value between 0 and 1.
 * @returns A Promise that resolves to an object containing the converted Blob and the new filename.
 */
export const convertImage = (imageFile: File, targetMimeType: string, quality: number = 0.8): Promise<ConvertResult> => {
    return new Promise((resolve, reject) => {
        if (!imageFile.type.startsWith('image/')) {
            return reject(new Error('File is not an image.'));
        }

        const img = new Image();
        const url = URL.createObjectURL(imageFile);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              URL.revokeObjectURL(url);
              return reject(new Error('Could not get canvas context'));
            }

            // For formats that don't support transparency (like JPEG), draw a white background
            if (targetMimeType === 'image/jpeg' || targetMimeType === 'image/bmp') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.drawImage(img, 0, 0);

            canvas.toBlob(blob => {
              URL.revokeObjectURL(url);
              if(blob) {
                const originalNameNoExt = imageFile.name.substring(0, imageFile.name.lastIndexOf('.')) || imageFile.name;
                const newExtension = targetMimeType.split('/')[1] || 'dat';
                const newName = `${originalNameNoExt}.${newExtension}`;
                resolve({ blob, name: newName });
              }
              else {
                reject(new Error('Canvas toBlob failed for image conversion. The target format might not be supported by the browser.'));
              }
            }, targetMimeType, quality);
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image for conversion. It might be corrupted or an unsupported format.'));
        }

        img.src = url;
    });
};
