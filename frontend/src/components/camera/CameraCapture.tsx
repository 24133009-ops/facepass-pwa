import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RefreshCw, AlertCircle, UploadCloud, FlipHorizontal, X } from 'lucide-react';
import { compressImage, CompressedImageResult, ImagePurpose } from '../../utils/imageCompressor';
import { Button } from '../common/Button';

interface CameraCaptureProps {
  initialFacingMode?: 'user' | 'environment';
  guideType?: 'portrait' | 'wide';
  purpose?: ImagePurpose;
  onCapture: (result: CompressedImageResult) => void;
  isLoading?: boolean;
  capturedCount?: number;
  maxCaptures?: number;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  initialFacingMode = 'user',
  guideType = 'portrait',
  purpose = 'enrollment',
  onCapture,
  isLoading = false,
  capturedCount,
  maxCaptures
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef<number>(0);
  const countdownTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const captureLockRef = useRef<boolean>(false);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacingMode);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isViewfinderOpen, setIsViewfinderOpen] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashVisible, setIsFlashVisible] = useState<boolean>(false);
  const [isCaptureSaved, setIsCaptureSaved] = useState<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
    };
  }, []);

  const showCaptureSaved = () => {
    if (!isMountedRef.current) return;
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current);
    }
    setIsCaptureSaved(true);
    savedTimerRef.current = window.setTimeout(() => {
      setIsCaptureSaved(false);
      savedTimerRef.current = null;
    }, 1500);
  };

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    captureLockRef.current = false;
  }, []);

  const clearFlash = useCallback(() => {
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    setIsFlashVisible(false);
  }, []);

  // Stop current active video tracks
  const stopStream = useCallback(() => {
    cameraRequestIdRef.current += 1;
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
    const requestId = cameraRequestIdRef.current;

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

      if (cameraRequestIdRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (cameraRequestIdRef.current !== requestId) return;
        setIsCameraActive(true);
      } else {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraError('Không thể khởi tạo khung xem trước camera. Vui lòng thử lại hoặc chọn ảnh dự phòng.');
      }
    } catch (err: unknown) {
      if (cameraRequestIdRef.current !== requestId) return;

      stopStream();
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
    if (!isViewfinderOpen) {
      stopStream();
      return undefined;
    }

    void startCamera(facingMode);
    return () => {
      stopStream();
      clearCountdown();
      clearFlash();
    };
  }, [facingMode, isViewfinderOpen, startCamera, stopStream, clearCountdown, clearFlash]);

  // Capture frame from live video
  const handleCaptureVideoFrame = async () => {
    if (!videoRef.current || !isCameraActive || isProcessing || isLoading) {
      captureLockRef.current = false;
      return;
    }

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

      // Compress client-side (enrollment: 1280px, attendance: 2560px, JPEG)
      const compressed = await compressImage(canvas, purpose);
      await onCapture(compressed);
      showCaptureSaved();
    } catch {
      setCameraError('Không thể chụp ảnh từ video frame. Vui lòng thử lại hoặc chọn ảnh dự phòng.');
    } finally {
      setIsProcessing(false);
      captureLockRef.current = false;
    }
  };

  const beginCountdown = () => {
    if (!isCameraActive || isProcessing || isLoading || captureLockRef.current) return;

    captureLockRef.current = true;
    const tick = (value: number) => {
      setCountdown(value);

      if (value > 1) {
        countdownTimerRef.current = window.setTimeout(() => tick(value - 1), 1000);
        return;
      }

      countdownTimerRef.current = window.setTimeout(() => {
        countdownTimerRef.current = null;
        setCountdown(null);
        setIsFlashVisible(true);
        flashTimerRef.current = window.setTimeout(() => {
          setIsFlashVisible(false);
          flashTimerRef.current = null;
        }, 180);
        void handleCaptureVideoFrame();
      }, 650);
    };

    tick(3);
  };

  // Fallback: handle file input selection or device native camera capture
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const compressed = await compressImage(file, purpose);
      await onCapture(compressed);
      showCaptureSaved();
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

  const closeViewfinder = () => {
    clearCountdown();
    clearFlash();
    stopStream();
    setIsViewfinderOpen(false);
  };

  return (
    <>
      {isViewfinderOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] bg-slate-950 text-white overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label={guideType === 'portrait' ? 'Camera đăng ký khuôn mặt' : 'Camera điểm danh lớp học'}
            >
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                  isCameraActive ? 'opacity-100' : 'opacity-0'
                } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />

              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-6 pb-36 pt-20">
                  <div
                    className={`relative ${
                      guideType === 'portrait' ? 'w-56 h-[min(70vh,22rem)] max-h-[72vw]' : 'w-full h-full max-w-2xl'
                    }`}
                  >
                    <div className="absolute inset-x-4 h-px bg-gradient-to-r from-transparent via-cyan-200 to-transparent shadow-[0_0_16px_rgba(103,232,249,0.95)] animate-scan-line motion-reduce:animate-none" />
                    <span className="absolute -top-1 -left-1 h-8 w-8 border-l-2 border-t-2 border-cyan-100 drop-shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
                    <span className="absolute -top-1 -right-1 h-8 w-8 border-r-2 border-t-2 border-cyan-100 drop-shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
                    <span className="absolute -bottom-1 -left-1 h-8 w-8 border-b-2 border-l-2 border-cyan-100 drop-shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
                    <span className="absolute -bottom-1 -right-1 h-8 w-8 border-b-2 border-r-2 border-cyan-100 drop-shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
                      <span className="inline-flex rounded-full bg-slate-950/55 px-3 py-1 text-[11px] font-medium text-white/95 backdrop-blur-xs">
                        {guideType === 'portrait'
                          ? 'Căn chỉnh khuôn mặt vào khung'
                          : 'Chụp góc rộng toàn cảnh lớp học'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950">
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
                      <RefreshCw className="w-8 h-8 animate-spin motion-reduce:animate-none text-blue-400" />
                      <span className="text-xs">Đang khởi động camera...</span>
                    </div>
                  )}
                </div>
              )}

              <div
                className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4 bg-gradient-to-b from-slate-950/80 to-transparent"
                style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
              >
                <div>
                  <p className="text-xs font-bold">{guideType === 'portrait' ? 'Đăng ký khuôn mặt' : 'Quét điểm danh'}</p>
                  <p className="text-[11px] text-slate-300">Giữ thiết bị ổn định để ảnh rõ nét</p>
                </div>
                <div className="flex items-center gap-2">
                  {capturedCount !== undefined && maxCaptures !== undefined && (
                    <span className="shrink-0 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold tabular-nums whitespace-nowrap backdrop-blur-md">
                      Đã chụp {capturedCount}/{maxCaptures}
                    </span>
                  )}
                  {isCameraActive && (
                    <button
                      type="button"
                      onClick={toggleFacingMode}
                      title="Đổi camera trước / sau"
                      className="p-3 rounded-full bg-black/45 hover:bg-black/70 text-white backdrop-blur-md transition-colors touch-target flex items-center justify-center active:scale-95"
                    >
                      <FlipHorizontal className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeViewfinder}
                    title="Đóng giao diện camera"
                    className="p-3 rounded-full bg-black/45 hover:bg-black/70 text-white backdrop-blur-md transition-colors touch-target flex items-center justify-center active:scale-95"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25 pointer-events-none">
                  <span className="w-24 h-24 rounded-full border-2 border-white/80 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center text-6xl font-black tabular-nums animate-scale-in motion-reduce:animate-none">
                    {countdown}
                  </span>
                </div>
              )}
              <div
                className={`absolute inset-0 bg-white pointer-events-none transition-opacity ${
                  isFlashVisible ? 'opacity-90' : 'opacity-0'
                }`}
                aria-hidden="true"
              />

              <div
                className="absolute inset-x-0 bottom-0 p-4 pt-12 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent"
                style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
              >
                <p role="status" className="mb-2 min-h-5 text-center text-sm font-semibold text-emerald-300">
                  {isCaptureSaved ? 'Đã lưu ảnh' : ''}
                </p>
                {countdown !== null ? (
                  <Button type="button" onClick={clearCountdown} size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                    Hủy đếm ngược
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={beginCountdown}
                    isLoading={isProcessing || isLoading}
                    disabled={!isCameraActive || isProcessing || isLoading}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-lg shadow-blue-950/40 font-bold"
                  >
                    <Camera className="w-6 h-6 mr-2" />
                    <span>Chụp sau 3 giây</span>
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing || isLoading}
                  className="w-full py-3 text-xs text-slate-200 hover:text-white disabled:text-slate-500 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Chọn ảnh có sẵn từ thiết bị</span>
                </button>
              </div>
            </div>,
            document.body
          )
        : (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center space-y-3">
              <p role="status" className="text-sm font-semibold text-emerald-700">
                {isCaptureSaved ? 'Đã lưu ảnh' : ''}
              </p>
              <Camera className="w-7 h-7 text-blue-600 mx-auto" />
              <div>
                <p className="text-sm font-bold text-blue-950">Camera đang tạm dừng</p>
                <p className="mt-1 text-xs text-blue-800">Mở lại camera hoặc chọn ảnh có sẵn để tiếp tục.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="md" onClick={() => setIsViewfinderOpen(true)}>
                  Mở Camera
                </Button>
                <Button type="button" size="md" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Chọn Ảnh
                </Button>
              </div>
            </div>
          )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture={facingMode === 'user' ? 'user' : 'environment'}
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
};

