import React, { useState } from 'react';
import { User, Hash, Mail, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { isValidEmail } from '../../utils/validators';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { studentId: string; fullName: string; email: string }) => Promise<void>;
  isLoading: boolean;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  isLoading
}) => {
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !fullName.trim()) {
      setError('Vui lòng nhập đầy đủ MSSV và Họ tên sinh viên');
      return;
    }

    const finalEmail = email.trim() || `${studentId.trim().toLowerCase()}@student.edu.vn`;
    if (!isValidEmail(finalEmail)) {
      setError(`Email "${finalEmail}" không đúng định dạng chuẩn (VD: ten.sv@domain.edu.vn)`);
      return;
    }

    try {
      setError(null);
      await onAdd({
        studentId: studentId.trim(),
        fullName: fullName.trim(),
        email: finalEmail
      });
      setStudentId('');
      setFullName('');
      setEmail('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Thêm sinh viên thất bại');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm Sinh Viên Mới">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Mã Số Sinh Viên (MSSV) *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Hash className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="VD: 20110123"
              required
              className="w-full min-h-[48px] pl-11 pr-4 rounded-xl border border-slate-300 text-base text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Họ và Tên *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="VD: Nguyễn Văn Nam"
              required
              className="w-full min-h-[48px] pl-11 pr-4 rounded-xl border border-slate-300 text-base text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Email (Để nhận cảnh báo vắng SES)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-5 h-5" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="VD: nam.nguyen@student.edu.vn"
              className="w-full min-h-[48px] pl-11 pr-4 rounded-xl border border-slate-300 text-base text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="pt-3 space-y-2">
          <Button type="submit" isLoading={isLoading} size="lg">
            Lưu Sinh Viên
          </Button>
          <Button type="button" variant="outline" onClick={onClose} size="lg">
            Hủy Bỏ
          </Button>
        </div>
      </form>
    </Modal>
  );
};

