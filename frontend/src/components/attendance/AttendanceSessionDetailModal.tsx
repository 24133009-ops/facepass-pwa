import React from 'react';
import { CheckCircle2, XCircle, Download, Calendar, Mail } from 'lucide-react';
import { SessionHistoryItem } from '../../types';
import { downloadCsvFile, generateAttendanceCsv } from '../../utils/csvHelper';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface AttendanceSessionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionHistoryItem | null;
}

export const AttendanceSessionDetailModal: React.FC<AttendanceSessionDetailModalProps> = ({
  isOpen,
  onClose,
  session
}) => {
  if (!isOpen || !session) return null;

  const dateFormatted = new Date(session.startedAt).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const handleDownloadCsv = () => {
    // Generate CSV with UTF-8 BOM and anti-injection protection
    const csvContent = generateAttendanceCsv({
      sessionId: session.sessionId,
      classId: session.classId,
      className: session.className,
      sessionTime: dateFormatted,
      records: session.records
    });

    const safeFilename = `DiemDanh_${session.classId}_${session.sessionId}.csv`;
    downloadCsvFile(safeFilename, csvContent);
  };

  const presentRecords = session.records.filter((r) => r.status === 'present');
  const absentRecords = session.records.filter((r) => r.status === 'absent');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi Tiết Buổi Điểm Danh">
      <div className="space-y-4">
        {/* Session Summary Card */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              #{session.sessionId}
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Đã xác nhận
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Thời gian: {dateFormatted}</span>
          </div>

          {session.emailsSentAt && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50/70 p-2 rounded-xl border border-amber-200">
              <Mail className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Đã gửi email cảnh báo SES cho {session.absentCount} sinh viên vắng mặt.</span>
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
            <div className="p-2 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-500">Sĩ số</span>
              <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                {session.totalStudents}
              </p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-emerald-700">Có mặt</span>
              <p className="font-extrabold text-emerald-700 text-sm mt-0.5">
                {session.presentCount}
              </p>
            </div>
            <div className="p-2 bg-red-50 rounded-xl border border-red-200">
              <span className="text-red-700">Vắng</span>
              <p className="font-extrabold text-red-700 text-sm mt-0.5">
                {session.absentCount}
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Attendance List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
            <span>DANH SÁCH CHI TIẾT ({session.records.length})</span>
            <span className="text-emerald-600 font-normal">
              Tỷ lệ: {Math.round((session.presentCount / session.totalStudents) * 100)}%
            </span>
          </div>

          <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
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
                <div className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{st.similarity}%</span>
                </div>
              </div>
            ))}

            {/* Absent Students */}
            {absentRecords.map((st) => (
              <div
                key={st.studentId}
                className="p-2.5 bg-red-50/40 rounded-xl border border-red-200/80 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-red-700">{st.studentId}</span>
                    <span className="font-bold text-slate-800">{st.fullName}</span>
                  </div>
                  <p className="text-[11px] text-red-600">{st.email}</p>
                </div>
                <div className="flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Vắng mặt</span>
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
