import React, { useState } from 'react';
import { Trash2, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
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
  const hasFace = student.faceIds && student.faceIds.length > 0;

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
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
              {student.studentId}
            </span>
            <span className="font-bold text-slate-900 text-base truncate">
              {student.fullName}
            </span>
          </div>

          <p className="text-xs text-slate-500 truncate mb-2">{student.email}</p>

          <div className="flex items-center gap-2">
            {hasFace ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã nạp khuôn mặt ({student.faceIds.length})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Chưa đăng ký mặt</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!hasFace && onEnroll && (
            <button
              onClick={() => onEnroll(student)}
              className="px-3 min-h-[44px] text-xs font-semibold text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-xl transition-colors border border-blue-200"
            >
              Chụp mặt
            </button>
          )}

          <button
            onClick={() => setIsConfirmDeleteOpen(true)}
            aria-label={`Xóa sinh viên ${student.fullName}`}
            className="p-2.5 text-slate-400 hover:text-red-600 active:bg-red-50 rounded-xl transition-colors touch-target flex items-center justify-center"
            title="Xóa hồ sơ & dữ liệu sinh trắc học (GDPR)"
          >
            <Trash2 className="w-5 h-5" />
          </button>
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

