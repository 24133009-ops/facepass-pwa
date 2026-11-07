import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, Trash2, Sparkles } from 'lucide-react';
import { StudentItem } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CompressedImageResult } from '../../utils/imageCompressor';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CameraCapture } from '../camera/CameraCapture';

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentItem | null;
  classId: string;
  onSuccess: () => void;
}

export const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({
  isOpen,
  onClose,
  student,
  classId,
  onSuccess
}) => {
  const { token } = useAuth();

  // Biometric Consent State
  const [consentAgreed, setConsentAgreed] = useState<boolean>(false);
  const [capturedPhotos, setCapturedPhotos] = useState<CompressedImageResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !student) return null;

  const handleCapturePhoto = (result: CompressedImageResult) => {
    setError(null);
    if (capturedPhotos.length >= 3) {
      setError('Đã chụp đủ tối đa 3 ảnh mẫu cho sinh viên');
      return;
    }
    setCapturedPhotos((prev) => [...prev, result]);
  };

  const handleRemovePhoto = (index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleCompleteEnrollment = async () => {
    if (!token) return;
    if (!consentAgreed) {
      setError('Bắt buộc phải đồng ý với cam kết sinh trắc học trước khi đăng ký.');
      return;
    }
    if (capturedPhotos.length < 2) {
      setError('Vui lòng chụp tối thiểu 2 góc ảnh khuôn mặt để đảm bảo độ chính xác nhận diện.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const consentTimestamp = new Date().toISOString();

      // 1. Get Presigned POST Upload URL
      const { presignedPost, s3Key } = await apiService.getEnrollmentUploadUrl(
        token,
        classId,
        student.studentId
      );

      // 2. Upload primary compressed JPEG image using FormData (Server fields first, 'file' last)
      const primaryPhoto = capturedPhotos[0];
      await apiService.uploadToPresignedPost(presignedPost, primaryPhoto.blob);

      // 3. Process Face Indexing & Purge Raw Photo
      const res = await apiService.processEnrollment(
        token,
        classId,
        student.studentId,
        consentAgreed,
        consentTimestamp,
        s3Key
      );

      setSuccessMessage(
        `${res.message}. Vector đặc trưng đã được lưu vào Rekognition và ảnh gốc đã được hủy an toàn khỏi S3.`
      );

      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng ký khuôn mặt thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setConsentAgreed(false);
    setCapturedPhotos([]);
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Đăng Ký Khuôn Mặt Sinh Viên">
      <div className="space-y-4">
        {/* Student Target Banner */}
        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-700 font-semibold">Đăng ký sinh trắc học cho:</p>
            <p className="text-sm font-bold text-blue-950">
              {student.fullName} <span className="font-mono text-xs text-blue-700">({student.studentId})</span>
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-1 bg-white text-blue-700 rounded-lg border border-blue-200">
            {capturedPhotos.length}/3 ảnh
          </span>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed">{successMessage}</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Biometric Privacy & Consent Checkbox */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Cam Kết Đồng Ý Xử Lý Dữ Liệu Sinh Trắc Học</span>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consentAgreed}
              onChange={(e) => setConsentAgreed(e.target.checked)}
              disabled={isSubmitting}
              className="w-5 h-5 mt-0.5 rounded-md text-blue-600 border-slate-300 focus:ring-blue-500 shrink-0 cursor-pointer"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              Tôi xác nhận sinh viên <strong>đủ 18 tuổi</strong> (hoặc đã có sự đồng ý của người giám hộ), 
              <strong> tự nguyện đồng ý</strong> cho hệ thống trích xuất và lưu trữ đặc trưng khuôn mặt (vector embedding) 
              để phục vụ điểm danh tự động, và hiểu rõ <strong>có thể yêu cầu xóa vĩnh viễn dữ liệu</strong> bất kỳ lúc nào theo chuẩn GDPR.
            </span>
          </label>
        </div>

        {/* Photo Gallery Thumbnails (2-3 photos) */}
        {capturedPhotos.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
              <span>ẢNH ĐÃ CHỤP ({capturedPhotos.length}/3)</span>
              <span className="text-emerald-600">
                {capturedPhotos.length >= 2 ? 'Đủ điều kiện đăng ký' : 'Cần thêm ít nhất 1 ảnh'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {capturedPhotos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative aspect-[4/5] bg-slate-100 rounded-xl overflow-hidden border border-slate-300 shadow-xs group"
                >
                  <img
                    src={photo.dataUrl}
                    alt={`Ảnh ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    title="Xóa ảnh này"
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md shadow-md opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Camera Capture Module */}
        {capturedPhotos.length < 3 ? (
          <div className="space-y-2">
            {!consentAgreed && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Vui lòng tích chọn cam kết đồng ý ở trên để mở khóa camera chụp ảnh.</span>
              </div>
            )}

            <div className={consentAgreed ? '' : 'opacity-40 pointer-events-none'}>
              <CameraCapture
                initialFacingMode="user"
                guideType="portrait"
                onCapture={handleCapturePhoto}
                isLoading={isSubmitting}
              />
            </div>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-center text-xs space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
            <p className="font-bold text-emerald-950">Đã chụp đủ 3 ảnh góc chụp khác nhau!</p>
            <p>Nhấn nút bên dưới để hoàn tất lưu đặc trưng khuôn mặt.</p>
          </div>
        )}

        {/* Final Registration Action Button */}
        <div className="pt-2 space-y-2">
          <Button
            type="button"
            onClick={handleCompleteEnrollment}
            isLoading={isSubmitting}
            disabled={!consentAgreed || capturedPhotos.length < 2}
            size="lg"
            className="shadow-md shadow-blue-600/20"
          >
            <Sparkles className="w-5 h-5 mr-1.5" />
            <span>Hoàn Tất Đăng Ký Khuôn Mặt</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            size="lg"
          >
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};
