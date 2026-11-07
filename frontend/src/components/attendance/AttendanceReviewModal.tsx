import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Send,
  Mail,
  Users
} from 'lucide-react';
import { ScanResult, AttendanceRecord } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface AttendanceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanResult: ScanResult | null;
  classId: string;
  onConfirmed: () => void;
}

export const AttendanceReviewModal: React.FC<AttendanceReviewModalProps> = ({
  isOpen,
  onClose,
  scanResult,
  classId,
  onConfirmed
}) => {
  const { token } = useAuth();

  // Local state for interactive 3-group categorization
  const [presentList, setPresentList] = useState<AttendanceRecord[]>([]);
  const [uncertainList, setUncertainList] = useState<AttendanceRecord[]>([]);
  const [absentList, setAbsentList] = useState<AttendanceRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'uncertain' | 'present' | 'absent'>('uncertain');

  // Confirmation modal controls
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<{
    emailsDispatched: number;
    message: string;
  } | null>(null);

  // Initialize lists when scanResult changes
  React.useEffect(() => {
    if (scanResult) {
      setPresentList(scanResult.present);
      setUncertainList(scanResult.uncertain);
      setAbsentList(scanResult.absent);

      // Default active tab: focus on 'uncertain' if students exist, else 'present'
      if (scanResult.uncertain.length > 0) {
        setActiveTab('uncertain');
      } else {
        setActiveTab('present');
      }
    }
  }, [scanResult]);

  if (!isOpen || !scanResult) return null;

  // One-Touch State Transitions
  const moveToPresent = (record: AttendanceRecord) => {
    setUncertainList((prev) => prev.filter((r) => r.studentId !== record.studentId));
    setAbsentList((prev) => prev.filter((r) => r.studentId !== record.studentId));
    setPresentList((prev) => [
      ...prev.filter((r) => r.studentId !== record.studentId),
      { ...record, status: 'present' }
    ]);
  };

  const moveToAbsent = (record: AttendanceRecord) => {
    setUncertainList((prev) => prev.filter((r) => r.studentId !== record.studentId));
    setPresentList((prev) => prev.filter((r) => r.studentId !== record.studentId));
    setAbsentList((prev) => [
      ...prev.filter((r) => r.studentId !== record.studentId),
      { ...record, status: 'absent' }
    ]);
  };

  const isUncertainEmpty = uncertainList.length === 0;

  const handleConfirmAndSend = async () => {
    if (!token) return;
    if (!isUncertainEmpty) {
      setError('Vui lòng phân loại hết sinh viên ở nhóm Cần xác nhận trước khi chốt buổi học.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const allRecords: AttendanceRecord[] = [
      ...presentList,
      ...uncertainList,
      ...absentList
    ];

    try {
      const res = await apiService.confirmAttendance(
        token,
        classId,
        scanResult.sessionId,
        allRecords
      );

      setConfirmResult({
        emailsDispatched: res.emailsDispatched,
        message: res.message
      });

      setTimeout(() => {
        setIsConfirmDialogOpen(false);
        onConfirmed();
        onClose();
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xác nhận điểm danh thất bại');
      setIsConfirmDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Đối Soát Kết Quả Nhận Diện AI">
        <div className="space-y-4">
          {/* Top Session Metric Card */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-mono font-semibold">Buổi học: #{scanResult.sessionId}</span>
              <span>{scanResult.className}</span>
            </div>

            {/* Unknown Faces Warning Box */}
            {scanResult.unknowns.length > 0 && (
              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold">
                  <HelpCircle className="w-4 h-4 text-purple-600" />
                  <span>Phát hiện {scanResult.unknowns.length} khuôn mặt lạ</span>
                </div>
                <span className="text-[11px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                  Ngoài danh sách lớp
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">
              {error}
            </div>
          )}

          {/* 3 Groups Segmented Tab Controls */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-200/80 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('uncertain')}
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                activeTab === 'uncertain'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Cần duyệt</span>
              </div>
              <span className="text-[11px] font-mono">({uncertainList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('present')}
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                activeTab === 'present'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Có mặt</span>
              </div>
              <span className="text-[11px] font-mono">({presentList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('absent')}
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                activeTab === 'absent'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Vắng mặt</span>
              </div>
              <span className="text-[11px] font-mono">({absentList.length})</span>
            </button>
          </div>

          {/* Active Tab Content & One-Touch Item Rows */}
          <div className="min-h-[220px] max-h-[340px] overflow-y-auto space-y-2 pr-1">
            {/* Tab 1: Uncertain Group */}
            {activeTab === 'uncertain' && (
              <>
                {uncertainList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    <p className="font-bold text-slate-700">Đã phân loại hết!</p>
                    <p>Không còn sinh viên nào ở nhóm cần xác nhận.</p>
                  </div>
                ) : (
                  uncertainList.map((record) => (
                    <div
                      key={record.studentId}
                      className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-amber-800">
                            {record.studentId}
                          </span>
                          <span className="font-bold text-slate-900 text-sm truncate">
                            {record.fullName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-amber-700">
                          <span>Độ tương đồng: <strong>{record.similarity}%</strong></span>
                        </div>
                      </div>

                      {/* One-Touch Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveToPresent(record)}
                          title="Chuyển sang Có mặt"
                          className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 touch-target"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Có mặt</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => moveToAbsent(record)}
                          title="Chuyển sang Vắng mặt"
                          className="px-2.5 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 touch-target"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Vắng</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Tab 2: Present Group */}
            {activeTab === 'present' && (
              <>
                {presentList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    Chưa có sinh viên nào trong nhóm Có mặt.
                  </div>
                ) : (
                  presentList.map((record) => (
                    <div
                      key={record.studentId}
                      className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs hover:border-emerald-300"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {record.studentId}
                          </span>
                          <span className="font-bold text-slate-900 text-sm truncate">
                            {record.fullName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Khớp: {record.similarity}%
                        </div>
                      </div>

                      {/* One-touch toggle to absent */}
                      <button
                        type="button"
                        onClick={() => moveToAbsent(record)}
                        title="Đổi sang Vắng mặt"
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors touch-target flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Đổi Vắng</span>
                      </button>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Tab 3: Absent Group */}
            {activeTab === 'absent' && (
              <>
                {absentList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    Lớp đi học đầy đủ 100%!
                  </div>
                ) : (
                  absentList.map((record) => (
                    <div
                      key={record.studentId}
                      className="p-3 bg-red-50/40 border border-red-200/80 rounded-2xl flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                            {record.studentId}
                          </span>
                          <span className="font-bold text-slate-900 text-sm truncate">
                            {record.fullName}
                          </span>
                        </div>
                        <div className="text-[11px] text-red-600 mt-0.5">
                          Ghi nhận vắng mặt
                        </div>
                      </div>

                      {/* One-touch toggle to present */}
                      <button
                        type="button"
                        onClick={() => moveToPresent(record)}
                        title="Đổi sang Có mặt"
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-300 transition-colors touch-target flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Có mặt</span>
                      </button>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

          {/* Mandatory Locking Rule Banner */}
          {!isUncertainEmpty && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                <strong>Khóa nút xác nhận:</strong> Còn <strong>{uncertainList.length}</strong> sinh viên ở nhóm <em>"Cần xác nhận"</em>. Vui lòng phân loại hết sang <em>Có mặt</em> hoặc <em>Vắng</em> trước khi gửi.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <Button
              type="button"
              onClick={() => setIsConfirmDialogOpen(true)}
              disabled={!isUncertainEmpty}
              size="lg"
              className={
                isUncertainEmpty
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/30 font-bold'
                  : 'bg-slate-300 cursor-not-allowed'
              }
            >
              <Send className="w-5 h-5 mr-1.5" />
              <span>Xác Nhận & Gửi Thông Báo ({absentList.length} Vắng)</span>
            </Button>

            <Button type="button" variant="outline" onClick={onClose} size="lg">
              Đóng
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog before SES Email Dispatch */}
      <Modal
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        title="Xác Nhận Chốt Buổi Học & Gửi Email Cảnh Báo"
      >
        <div className="space-y-4">
          {confirmResult ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold text-emerald-950 text-sm">Điểm danh đã được khóa thành công!</p>
              <p className="text-xs text-emerald-800">
                Đã gửi thông báo cảnh báo qua Amazon SES tới <strong>{confirmResult.emailsDispatched}</strong> sinh viên vắng mặt.
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Tổng kết điểm danh lớp học</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500">Sĩ số</span>
                    <p className="text-base font-extrabold text-slate-900 mt-0.5">
                      {presentList.length + absentList.length}
                    </p>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-emerald-700">Có mặt</span>
                    <p className="text-base font-extrabold text-emerald-700 mt-0.5">
                      {presentList.length}
                    </p>
                  </div>
                  <div className="p-2.5 bg-red-50 rounded-xl border border-red-200">
                    <span className="text-red-700">Vắng</span>
                    <p className="text-base font-extrabold text-red-700 mt-0.5">
                      {absentList.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-amber-950">Lưu ý về gửi thông báo SES:</strong> Hệ thống sẽ tự động gửi email cảnh báo vắng học cá nhân hóa tới <strong>{absentList.length} sinh viên vắng mặt</strong> (mỗi email gửi riêng lẻ, chống rò rỉ danh sách).
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConfirmAndSend}
                  isLoading={isSubmitting}
                  size="lg"
                  className="font-bold shadow-md shadow-blue-600/30"
                >
                  <Send className="w-5 h-5 mr-1.5" />
                  <span>Đồng Ý & Gửi Email Cảnh Báo</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmDialogOpen(false)}
                  disabled={isSubmitting}
                  size="lg"
                >
                  Kiểm Tra Lại
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};
