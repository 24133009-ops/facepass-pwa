import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, AlertCircle, UploadCloud, FlipHorizontal } from 'lucide-react';
import { compressImage, CompressedImageResult } from '../../utils/imageCompressor';
import { Button } from '../common/Button';

interface CameraCaptureProps {
  initialFacingMode?: 'user' | 'environment';
  guideType?: 'portrait' | 'wide';
  onCapture: (result: CompressedImageResult) => void;
  isLoading?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  initialFacingMode = 'user',
  guideType = 'portrait',
  onCapture,
  isLoading = false
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacingMode);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Stop current active video tracks
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start video stream with specified facingMode
  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    stopStream();
    setCameraError(null);

    // Verify browser support for getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ truy cập camera trực tiếp. Vui lòng chụp hoặc tải ảnh bằng phương án dự phòng.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      if (errorObj.name === 'NotAllowedError' || errorObj.name === 'PermissionDeniedError') {
        setCameraError(
          'Quyền truy cập Camera đã bị từ chối trên thiết bị. Bạn có thể cấp lại quyền trong cài đặt trình duyệt hoặc sử dụng phương án chụp dự phòng bên dưới.'
        );
      } else if (errorObj.name === 'NotFoundError' || errorObj.name === 'DevicesNotFoundError') {
        setCameraError('Không tìm thấy thiết bị camera khả dụng trên máy.');
      } else {
        setCameraError('Không thể mở camera (Yêu cầu HTTPS hoặc localhost). Vui lòng dùng phương án dự phòng.');
      }
      setIsCameraActive(false);
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopStream();
    };
  }, [facingMode, startCamera, stopStream]);

  // Capture frame from live video
  const handleCaptureVideoFrame = async () => {
    if (!videoRef.current || !isCameraActive || isProcessing || isLoading) return;

    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D');

      // If front camera, mirror image for natural selfie feel
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Compress client-side (max 1280px, JPEG 0.85)
      const compressed = await compressImage(canvas);
      onCapture(compressed);
    } catch {
      setCameraError('Không thể chụp ảnh từ video frame. Vui lòng thử lại hoặc chọn ảnh dự phòng.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Fallback: handle file input selection or device native camera capture
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const compressed = await compressImage(file);
      onCapture(compressed);
    } catch {
      setCameraError('Lỗi khi nén ảnh tải lên.');
    } finally {
      setIsProcessing(false);
      // Reset input value to allow re-selection
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
  };

  return (
    <div className="space-y-4">
      {/* Video Viewport Container */}
      <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center">
        {/* Live Video */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            isCameraActive ? 'opacity-100' : 'opacity-0'
          } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Viewfinder Overlay Guides */}
        {isCameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
            {guideType === 'portrait' ? (
              // Portrait Oval Guide for Individual Face Enrollment
              <div className="w-56 h-72 border-2 border-dashed border-white/70 rounded-[100px] shadow-lg flex items-center justify-center">
                <div className="text-[11px] text-white/90 bg-black/40 px-3 py-1 rounded-full backdrop-blur-xs">
                  Căn chỉnh khuôn mặt vào khung
                </div>
              </div>
            ) : (
              // Wide Classroom Guide for Group Attendance Scan
              <div className="w-full h-full border-2 border-dashed border-white/60 rounded-2xl flex items-center justify-center p-4">
                <div className="text-[11px] text-white/90 bg-black/40 px-3 py-1 rounded-full backdrop-blur-xs">
                  Chụp góc rộng toàn cảnh lớp học
                </div>
              </div>
            )}
          </div>
        )}

        {/* Camera Inactive / Permission Denied Placeholder */}
        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-900">
            {cameraError ? (
              <div className="space-y-3 max-w-xs">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/10 text-white hover:bg-white/20 border border-white/20 min-h-[44px]"
                >
                  <UploadCloud className="w-4 h-4 mr-1.5" />
                  <span>Dùng Phương Án Dự Phòng</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-xs">Đang khởi động camera...</span>
              </div>
            )}
          </div>
        )}

        {/* Floating Flip Camera Button */}
        {isCameraActive && (
          <button
            type="button"
            onClick={toggleFacingMode}
            title="Đổi camera trước / sau"
            className="absolute top-3 right-3 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-colors touch-target flex items-center justify-center shadow-lg active:scale-95"
          >
            <FlipHorizontal className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Primary Capture Action Buttons */}
      <div className="space-y-2.5">
        {isCameraActive ? (
          <Button
            type="button"
            onClick={handleCaptureVideoFrame}
            isLoading={isProcessing || isLoading}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md shadow-blue-600/30 font-bold"
          >
            <Camera className="w-6 h-6 mr-2" />
            <span>Chụp Ảnh Ngay</span>
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            isLoading={isProcessing || isLoading}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md shadow-blue-600/30"
          >
            <UploadCloud className="w-5 h-5 mr-2" />
            <span>Chụp / Chọn Ảnh Từ Thiết Bị (Dự Phòng)</span>
          </Button>
        )}

        {/* Fallback File Picker Button (Always available as secondary alternative) */}
        {isCameraActive && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Hoặc chọn file ảnh có sẵn từ thư viện</span>
          </button>
        )}

        {/* Hidden Fallback File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture={facingMode === 'user' ? 'user' : 'environment'}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};

