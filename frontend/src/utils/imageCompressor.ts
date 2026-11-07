/**
 * Image compressor utility for FacePass PWA
 * Enforces client-side optimization:
 * - Max long edge: 1280px
 * - Format: image/jpeg (quality 0.85)
 * - Zero console.log leaking image bytes or biometric data
 */

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

export async function compressImage(
  source: File | Blob | string | HTMLCanvasElement,
  maxLongEdge = 1280,
  quality = 0.85
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    // If source is already an HTMLCanvasElement
    if (source instanceof HTMLCanvasElement) {
      let { width, height } = source;

      if (width > maxLongEdge || height > maxLongEdge) {
        if (width >= height) {
          const ratio = maxLongEdge / width;
          width = maxLongEdge;
          height = Math.round(height * ratio);
        } else {
          const ratio = maxLongEdge / height;
          height = maxLongEdge;
          width = Math.round(width * ratio);
        }
      }

      const outCanvas = document.createElement('canvas');
      outCanvas.width = width;
      outCanvas.height = height;

      const ctx = outCanvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không thể khởi tạo Canvas 2D'));
        return;
      }

      ctx.drawImage(source, 0, 0, width, height);
      const dataUrl = outCanvas.toDataURL('image/jpeg', quality);

      outCanvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Nén ảnh từ canvas thất bại'));
            return;
          }
          resolve({ blob, dataUrl, width, height });
        },
        'image/jpeg',
        quality
      );
      return;
    }

    // Otherwise load as Image
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Calculate proportional dimensions capped at maxLongEdge (1280px)
      if (width > maxLongEdge || height > maxLongEdge) {
        if (width >= height) {
          const ratio = maxLongEdge / width;
          width = maxLongEdge;
          height = Math.round(height * ratio);
        } else {
          const ratio = maxLongEdge / height;
          height = maxLongEdge;
          width = Math.round(width * ratio);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không thể khởi tạo Canvas 2D'));
        return;
      }

      // Draw and compress image
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Nén ảnh thất bại'));
            return;
          }
          resolve({ blob, dataUrl, width, height });
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Không thể đọc dữ liệu ảnh để nén'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}
