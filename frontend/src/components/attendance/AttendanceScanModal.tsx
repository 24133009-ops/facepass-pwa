import React, { useState } from 'react';
import { ScanFace, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CompressedImageResult } from '../../utils/imageCompressor';
import { ScanResult } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CameraCapture } from '../camera/CameraCapture';

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
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCaptureClassPhoto = async (result: CompressedImageResult) => {
    if (!token) return;
    setIsScanning(true);
    setError(null);

    try {
      // 1. Get Presigned POST Upload URL for Classroom Photo
      const { presignedPost, s3Key, sessionId } = await apiService.getAttendanceUploadUrl(
        token,
        classId
      );

      // 2. Upload photo via FormData (server fields first, file last)
      await apiService.uploadToPresignedPost(presignedPost, result.blob);

      // 3. Trigger Rekognition multi-face scan
      const scanResult = await apiService.scanAttendance(token, classId, sessionId, s3Key);

      onScanComplete(scanResult);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Quét nhận diện lớp học thất bại');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Điểm Danh Khuôn Mặt Cả Lớp">
      <div className="space-y-4">
        {/* Instruction Banner */}
        <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
            <ScanFace className="w-4 h-4 text-blue-600" />
            <span>Chụp ảnh toàn cảnh lớp học: {className}</span>
          </div>
          <p className="text-xs text-blue-800 leading-relaxed">
            Sử dụng <strong>camera sau</strong> của điện thoại để bao quát toàn bộ lớp học. AI sẽ tự động phát hiện, cắt từng khuôn mặt và đối soát nhận diện đồng thời.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Camera Viewport (Rear Camera by default) */}
        <CameraCapture
          initialFacingMode="environment"
          guideType="wide"
          onCapture={handleCaptureClassPhoto}
          isLoading={isScanning}
        />

        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
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

