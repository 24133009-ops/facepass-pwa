import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  isLoading: boolean;
}

export const CreateClassModal: React.FC<CreateClassModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên lớp học');
      return;
    }

    try {
      setError(null);
      await onCreate(name);
      setName('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tạo lớp thất bại');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo Lớp Học Mới">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Tên môn học / Lớp học
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="VD: Lập trình Di động PWA - Nhóm 01"
              required
              autoFocus
              className="w-full min-h-[48px] pl-11 pr-4 rounded-xl border border-slate-300 text-base text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Hệ thống sẽ tự động khởi tạo Rekognition Collection riêng biệt để đối soát khuôn mặt.
          </p>
        </div>

        <div className="pt-3 space-y-2">
          <Button type="submit" isLoading={isLoading} size="lg">
            Xác Nhận Tạo Lớp
          </Button>
          <Button type="button" variant="outline" onClick={onClose} size="lg">
            Hủy Bỏ
          </Button>
        </div>
      </form>
    </Modal>
  );
};

