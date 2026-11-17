import React, { useState } from 'react';
import { Trash2, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react';
import { StudentItem } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface StudentItemProps {
  student: StudentItem;
  onDelete: (studentId: string) => Promise<void>;
  onEnroll?: (student: StudentItem) => void;
}

export const StudentItemCard: React.FC<StudentItemProps> = ({ student, onDelete, onEnroll }) => {
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasFace = Boolean(student.faceIds && student.faceIds.length > 0);

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'SV';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(student.fullName);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(student.studentId);
      setIsConfirmDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="group relative p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-blue-200 shadow-xs hover:shadow-card transition-all duration-200 flex items-center justify-between gap-3 overflow-hidden">
        {/* Left Avatar with Initials */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-xs tracking-wider shadow-sm transition-transform duration-200 group-hover:scale-105 ${
              hasFace
                ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-blue-500/20'
                : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 border border-slate-300/70'
            }`}
            aria-hidden="true"
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200/80">
                {student.studentId}
              </span>
              <span className="font-bold text-slate-900 text-sm sm:text-base truncate">
                {student.fullName}
              </span>
            </div>

            <p className="text-xs text-slate-500 truncate mb-1.5">{student.email}</p>

            {/* Enrollment Status Badge */}
            <div className="flex items-center gap-2">
              {hasFace ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-0.5 rounded-full shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>Đã đăng ký ({student.faceIds.length})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Chưa đăng ký mặt</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions & Mobile Visual Hint */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!hasFace && onEnroll && (
            <button
              onClick={() => onEnroll(student)}
              className="px-3 min-h-[40px] text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 active:bg-blue-200/80 rounded-xl transition-all border border-blue-200 flex items-center gap-1 shadow-sm active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Chụp mặt</span>
            </button>
          )}

          <button
            onClick={() => setIsConfirmDeleteOpen(true)}
            aria-label={`Xóa sinh viên ${student.fullName}`}
            className="p-2.5 text-slate-400 hover:text-red-600 active:bg-red-50 rounded-xl transition-colors touch-target flex items-center justify-center"
            title="Xóa hồ sơ & dữ liệu sinh trắc học (GDPR)"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Purely decorative visual swipe hint on mobile */}
          <div
            className="hidden sm:flex flex-col gap-0.5 pl-0.5 text-slate-300 select-none opacity-40 group-hover:opacity-70 transition-opacity"
            aria-hidden="true"
            title="Vuốt để xem thao tác"
          >
            <div className="w-1 h-1 rounded-full bg-slate-400" />
            <div className="w-1 h-1 rounded-full bg-slate-400" />
            <div className="w-1 h-1 rounded-full bg-slate-400" />
          </div>
        </div>
      </div>

      {/* GDPR Right to Erasure Confirmation Modal */}
      <Modal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        title="Xác Nhận Xóa Dữ Liệu Sinh Trắc Học"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1.5">
              <p className="font-bold text-red-950 text-sm">
                Quyền được lãng quên (GDPR Right to Erasure)
              </p>
              <p className="leading-relaxed">
                Hành động này sẽ xóa vĩnh viễn sinh viên <strong className="font-semibold text-red-950">{student.fullName} ({student.studentId})</strong> khỏi danh sách lớp, đồng thời gọi lệnh <code className="bg-red-100 px-1 py-0.5 rounded font-mono font-bold">DeleteFaces</code> để hủy toàn bộ vector sinh trắc học đã lưu trong Amazon Rekognition.
              </p>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
              size="lg"
            >
              Tôi Hiểu & Đồng Ý Xóa Vĩnh Viễn
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDeleteOpen(false)}
              disabled={isDeleting}
              size="lg"
            >
              Hủy Bỏ
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

