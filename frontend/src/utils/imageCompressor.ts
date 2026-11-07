/**
 * Image compressor utility for FacePass PWA
 * Rules:
 * - Enrollment photos (portrait): Max long edge 1280px
 * - Attendance photos (classroom): Max long edge 2560px
 * - JPEG format
 * - If compressed size > 4.5MB: progressively reduce quality (0.85 -> 0.70) without reducing dimensions
 * - Detects if classroom group photo has longest edge < 1920px to show UI warning
 * - Zero console.log leaking image bytes or biometric PII
 */

export type ImagePurpose = 'enrollment' | 'attendance';

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  isResolutionLow: boolean;
  qualityUsed: number;
  sizeBytes: number;
}

export async function compressImage(
  source: File | Blob | string | HTMLCanvasElement,
  purpose: ImagePurpose = 'enrollment'
): Promise<CompressedImageResult> {
  const maxLongEdge = purpose === 'attendance' ? 2560 : 1280;

  return new Promise((resolve, reject) => {
    const processCanvas = (
      inputCanvas: HTMLCanvasElement | HTMLImageElement,
      origW: number,
      origH: number
    ) => {
      let width = origW;
      let height = origH;

      // Scale proportionally down to maxLongEdge if larger
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

      ctx.drawImage(inputCanvas, 0, 0, width, height);

      // Warning check: for attendance photos, longest edge < 1920px may hurt recognition of distant faces
      const longestOriginalEdge = Math.max(origW, origH);
      const isResolutionLow = purpose === 'attendance' && longestOriginalEdge < 1920;

      // Progressive quality reduction loop: 0.85 -> 0.70 if > 4.5MB (4.5 * 1024 * 1024 bytes)
      const MAX_SIZE_BYTES = 4.5 * 1024 * 1024; // 4.5MB limit
      let quality = 0.85;

      const attemptBlobGeneration = (currentQuality: number) => {
        outCanvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Nén ảnh thất bại'));
              return;
            }

            // If still > 4.5MB and quality > 0.70, decrease quality without decreasing dimensions
            if (blob.size > MAX_SIZE_BYTES && currentQuality > 0.70) {
              const nextQuality = Math.max(0.70, Math.round((currentQuality - 0.05) * 100) / 100);
              attemptBlobGeneration(nextQuality);
              return;
            }

            const dataUrl = outCanvas.toDataURL('image/jpeg', currentQuality);

            resolve({
              blob,
              dataUrl,
              width,
              height,
              originalWidth: origW,
              originalHeight: origH,
              isResolutionLow,
              qualityUsed: currentQuality,
              sizeBytes: blob.size
            });
          },
          'image/jpeg',
          currentQuality
        );
      };

      attemptBlobGeneration(quality);
    };

    // Case A: source is already HTMLCanvasElement
    if (source instanceof HTMLCanvasElement) {
      processCanvas(source, source.width, source.height);
      return;
    }

    // Case B: source is File / Blob / Object URL
    const img = new Image();
    img.onload = () => {
      processCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
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
