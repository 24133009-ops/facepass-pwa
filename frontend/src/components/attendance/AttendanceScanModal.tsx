import React, { useState } from 'react';
import { ScanFace, AlertCircle, AlertTriangle, Trash2, Sparkles } from 'lucide-react';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CompressedImageResult } from '../../utils/imageCompressor';
import { ScanResult } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CameraCapture } from '../camera/CameraCapture';
import { ThumbnailImage } from '../common/ThumbnailImage';

interface AttendanceScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  onScanComplete: (result: ScanResult) => void;
}

export const AttendanceScanModal: React.FC<AttendanceScanModalProps> = ({
  isOpen,
  onClose,
  classId,
  className,
  onScanComplete
}) => {
  const { token } = useAuth();
  const [capturedPhotos, setCapturedPhotos] = useState<CompressedImageResult[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCaptureClassPhoto = (result: CompressedImageResult) => {
    setError(null);
    if (capturedPhotos.length >= 4) {
      setError('Đã chụp tối đa 4 ảnh góc chụp cho buổi học này.');
      return;
    }
    setCapturedPhotos((prev) => [...prev, result]);
  };

  const handleRemovePhoto = (idx: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleProcessScan = async () => {
    if (!token || capturedPhotos.length === 0) return;
    setIsScanning(true);
    setError(null);

    try {
      // 1. Get Presigned POST Upload URL for Classroom Photo Session
      const { presignedPost, s3Key, sessionId } = await apiService.getAttendanceUploadUrl(
        token,
        classId
      );

      // 2. Upload first photo (or primary photo)
      await apiService.uploadToPresignedPost(presignedPost, capturedPhotos[0].blob);

      // 3. Trigger Rekognition multi-face scan with multi-photo count support
      const scanResult = await apiService.scanAttendance(
        token,
        classId,
        sessionId,
        s3Key,
        capturedPhotos.length // Pass count of captured photos for multi-photo merge
      );

      onScanComplete(scanResult);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Quét nhận diện lớp học thất bại');
    } finally {
      setIsScanning(false);
    }
  };

  const handleClose = () => {
    setCapturedPhotos([]);
    setError(null);
    onClose();
  };

  // Check if any of the captured photos has a longest edge < 1920px
  const lowResPhoto = capturedPhotos.find((p) => p.isResolutionLow);
  const captureProgress = (capturedPhotos.length / 4) * 100;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Điểm Danh Khuôn Mặt Cả Lớp">
      <div className="space-y-4">
        {/* Instruction Banner */}
        <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
              <ScanFace className="w-4 h-4 text-blue-600" />
              <span>Chụp ảnh toàn cảnh: {className}</span>
            </div>
            <span className="text-xs font-mono font-bold bg-white text-blue-700 px-2 py-0.5 rounded-lg border border-blue-200">
              {capturedPhotos.length}/4 ảnh
            </span>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">
            Bạn có thể chụp <strong>1 hoặc nhiều góc ảnh</strong> (dãy trái, dãy phải, phía sau). AI sẽ tự động gộp kết quả và loại trùng sinh viên theo độ tương đồng cao nhất.
          </p>
          <div className="pt-2" aria-label={`Tiến độ chụp ${capturedPhotos.length} trên 4 góc ảnh`}>
            <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 mb-1.5">
              <span>Tiến độ thu thập góc chụp</span>
              <span>{capturedPhotos.length === 0 ? 'Sẵn sàng quét' : `${capturedPhotos.length}/4 góc`}</span>
            </div>
            <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-[width] duration-300"
                style={{ width: `${captureProgress}%` }}
              />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((step) => (
                <span
                  key={step}
                  className={`h-1.5 rounded-full ${
                    step <= capturedPhotos.length ? 'bg-blue-600' : 'bg-blue-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Low Resolution Warning (if any photo has longest edge < 1920px) */}
        {lowResPhoto && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-amber-950">Cảnh báo độ phân giải thấp:</strong> Có ảnh chụp cạnh dài dưới 1920px ({lowResPhoto.width}x{lowResPhoto.height}px). Độ phân giải thấp có thể làm giảm khả năng nhận diện các sinh viên ở hàng ghế xa. Bạn nên tiến lại gần hơn hoặc chụp bổ sung góc cận.
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Captured Photos Strip */}
        {capturedPhotos.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
              <span>CÁC GÓC ẢNH ĐÃ CHỤP ({capturedPhotos.length})</span>
              <span className="text-blue-600 text-[11px]">Có thể chụp thêm góc khác</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {capturedPhotos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-300 shadow-xs group"
                >
                  <ThumbnailImage
                    src={photo.dataUrl}
                    alt={`Góc ảnh ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Góc #{idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    title="Xóa góc này"
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md shadow-md opacity-90 hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Camera Viewport (Rear Camera by default, purpose: attendance -> max 2560px) */}
        {capturedPhotos.length < 4 && (
          <CameraCapture
            initialFacingMode="environment"
            guideType="wide"
            purpose="attendance"
            onCapture={handleCaptureClassPhoto}
            isLoading={isScanning}
            capturedCount={capturedPhotos.length}
            maxCaptures={4}
          />
        )}

        {/* Scan Trigger Button */}
        <div className="pt-2 space-y-2">
          {capturedPhotos.length > 0 && (
            <Button
              type="button"
              onClick={handleProcessScan}
              isLoading={isScanning}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/30 font-bold"
            >
              <Sparkles className="w-5 h-5 mr-1.5" />
              <span>Tiến Hành Quét AI ({capturedPhotos.length} Góc Ảnh)</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isScanning}
            size="lg"
          >
            Hủy Bỏ
          </Button>
        </div>
      </div>
    </Modal>
  );
};
