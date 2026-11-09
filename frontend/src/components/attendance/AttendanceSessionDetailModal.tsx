import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Download,
  Calendar,
  AlertTriangle,
  RefreshCw,
  MailCheck,
  Clock
} from 'lucide-react';
import { SessionHistoryItem, AttendanceRecord } from '../../types';
import { downloadCsvFile, generateAttendanceCsv } from '../../utils/csvHelper';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface AttendanceSessionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionHistoryItem | null;
  onSessionUpdated?: (updatedSession: SessionHistoryItem) => void;
}

export const AttendanceSessionDetailModal: React.FC<AttendanceSessionDetailModalProps> = ({
  isOpen,
  onClose,
  session,
  onSessionUpdated
}) => {
  const { token } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    if (session) {
      setRecords(session.records || []);
      setNotification(null);
    }
  }, [session]);

  if (!isOpen || !session) return null;

  const dateFormatted = new Date(session.startedAt).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const handleDownloadCsv = () => {
    const csvContent = generateAttendanceCsv({
      sessionId: session.sessionId,
      classId: session.classId,
      className: session.className,
      sessionTime: dateFormatted,
      records
    });

    const safeFilename = `DiemDanh_${session.classId}_${session.sessionId}.csv`;
    downloadCsvFile(safeFilename, csvContent);
  };

  const handleRetryEmail = async (studentId: string, studentName: string) => {
    if (!token) return;

    try {
      setRetryingId(studentId);
      setNotification(null);

      const res = await apiService.retryAbsenceEmail(
        token,
        session.classId,
        session.sessionId,
        studentId
      );

      // Dynamically update record in local state
      const updatedRecords = records.map((r) => {
        if (r.studentId === studentId) {
          return {
            ...r,
            emailStatus: res.emailStatus,
            emailSentAt: res.emailSentAt,
            emailError: undefined
          };
        }
        return r;
      });

      setRecords(updatedRecords);

      // Notify parent to preserve changes in history list
      if (onSessionUpdated) {
        onSessionUpdated({
          ...session,
          records: updatedRecords
        });
      }

      setNotification({
        type: 'success',
        message: `Đã gửi lại email thành công cho sinh viên ${studentName}!`
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi gửi lại email';
      setNotification({
        type: 'error',
        message: errMsg
      });
    } finally {
      setRetryingId(null);
    }
  };

  const presentRecords = records.filter((r) => r.status === 'present');
  const absentRecords = records.filter((r) => r.status === 'absent');

  // Strict email metrics: only count 'sent' if confirmed by email provider
  const confirmedSentCount = absentRecords.filter((r) => r.emailStatus === 'sent').length;
  const failedEmailCount = absentRecords.filter((r) => r.emailStatus === 'failed').length;
  const pendingEmailCount = absentRecords.filter(
    (r) => !r.emailStatus || r.emailStatus === 'pending'
  ).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi Tiết Buổi Điểm Danh">
      <div className="space-y-4">
        {/* Toast inside modal */}
        {notification && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-red-50 border-red-300 text-red-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Session Summary Card */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              #{session.sessionId}
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Đã xác nhận chính thức
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Thời gian: {dateFormatted}</span>
          </div>

          {/* Email Delivery Status Banner (Strictly truthful status) */}
          {absentRecords.length > 0 && (
            <div className="pt-1">
              {failedEmailCount > 0 ? (
                <div className="p-2.5 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      Phát hiện {failedEmailCount} email cảnh báo vắng gửi thất bại
                    </span>
                    <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">
                      Nguyên nhân có thể do SES Sandbox (email người nhận chưa verify) hoặc địa chỉ
                      không tồn tại. Giảng viên có thể nhấn nút <strong>Gửi lại</strong> bên dưới.
                    </p>
                  </div>
                </div>
              ) : confirmedSentCount > 0 && pendingEmailCount === 0 ? (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <MailCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Đã gửi thành công tới máy chủ mail cho {confirmedSentCount} sinh viên vắng mặt.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Đang đồng bộ trạng thái gửi mail ({confirmedSentCount}/{absentRecords.length} đã
                    xác nhận).
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
            <div className="p-2 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-500">Sĩ số</span>
              <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                {records.length}
              </p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-emerald-700">Có mặt</span>
              <p className="font-extrabold text-emerald-700 text-sm mt-0.5">
                {presentRecords.length}
              </p>
            </div>
            <div className="p-2 bg-red-50 rounded-xl border border-red-200">
              <span className="text-red-700">Vắng</span>
              <p className="font-extrabold text-red-700 text-sm mt-0.5">
                {absentRecords.length}
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Attendance List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
            <span>DANH SÁCH CHI TIẾT ({records.length})</span>
            <span className="text-emerald-600 font-normal">
              Tỷ lệ có mặt:{' '}
              {records.length > 0
                ? Math.round((presentRecords.length / records.length) * 100)
                : 0}
              %
            </span>
          </div>

          <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
            {/* Present Students */}
            {presentRecords.map((st) => (
              <div
                key={st.studentId}
                className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-emerald-700">{st.studentId}</span>
                    <span className="font-bold text-slate-800">{st.fullName}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{st.email}</p>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px] bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{st.similarity}%</span>
                </div>
              </div>
            ))}

            {/* Absent Students */}
            {absentRecords.map((st) => (
              <div
                key={st.studentId}
                className={`p-3 rounded-xl border text-xs space-y-2 ${
                  st.emailStatus === 'failed'
                    ? 'bg-red-50/70 border-red-300'
                    : 'bg-red-50/30 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-red-700">{st.studentId}</span>
                      <span className="font-bold text-slate-800">{st.fullName}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{st.email}</p>
                  </div>
                  <div className="flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Vắng mặt</span>
                  </div>
                </div>

                {/* Per-student Email Delivery Status & Retry Action */}
                <div className="flex items-center justify-between pt-1 border-t border-red-200/60">
                  <div>
                    {st.emailStatus === 'sent' ? (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đã gửi tới máy chủ mail</span>
                        {st.emailSentAt && (
                          <span className="text-[10px] text-emerald-600 font-normal">
                            (
                            {new Date(st.emailSentAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            )
                          </span>
                        )}
                      </div>
                    ) : st.emailStatus === 'failed' ? (
                      <div className="text-[11px] text-red-700 font-medium space-y-0.5">
                        <div className="flex items-center gap-1 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>Gửi mail thất bại</span>
                        </div>
                        {st.emailError && (
                          <p className="text-[10px] text-red-600 max-w-[200px] truncate" title={st.emailError}>
                            {st.emailError}
                          </p>
                        )}
                      </div>
                    ) : st.emailStatus === 'processing' ? (
                      <div className="flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                        <span>Đang xử lý</span>
                        {(!st.lockedAt || (Date.now() - new Date(st.lockedAt).getTime() > 120 * 1000)) && (
                          <span className="text-[10px] text-amber-600 font-semibold">(quá hạn)</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Chờ xác nhận</span>
                      </div>
                    )}
                  </div>

                  {/* Retry Button: visible when failed or when processing lock has expired (>120s) */}
                  {(st.emailStatus === 'failed' || (st.emailStatus === 'processing' && (!st.lockedAt || (Date.now() - new Date(st.lockedAt).getTime() > 120 * 1000)))) && (
                    <button
                      type="button"
                      disabled={retryingId === st.studentId}
                      onClick={() => handleRetryEmail(st.studentId, st.fullName)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          retryingId === st.studentId ? 'animate-spin' : ''
                        }`}
                      />
                      <span>{retryingId === st.studentId ? 'Đang gửi...' : 'Gửi Lại'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          <Button
            type="button"
            onClick={handleDownloadCsv}
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 font-bold"
          >
            <Download className="w-5 h-5 mr-1.5" />
            <span>Tải Báo Cáo CSV (BOM UTF-8)</span>
          </Button>

          <Button type="button" variant="outline" onClick={onClose} size="lg">
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};
