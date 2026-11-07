import React, { useState, useEffect } from 'react';
import { Plus, Search, BookOpen, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ClassItem } from '../types';
import { apiService } from '../services/api';
import { Header } from '../components/common/Header';
import { ClassCard } from '../components/classes/ClassCard';
import { CreateClassModal } from '../components/classes/CreateClassModal';
import { Button } from '../components/common/Button';

interface ClassesPageProps {
  onSelectClass: (classItem: ClassItem) => void;
}

export const ClassesPage: React.FC<ClassesPageProps> = ({ onSelectClass }) => {
  const { token } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.getClasses(token);
      setClasses(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách lớp học');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [token]);

  const handleCreateClass = async (name: string) => {
    if (!token) return;
    setIsCreating(true);
    try {
      const created = await apiService.createClass(token, name);
      setClasses((prev) => [created, ...prev]);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredClasses = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.classId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Header title="Lớp Học Của Tôi" />

      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 pb-24">
        {/* Top Control Bar: Search & Create */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm môn học, mã lớp..."
              className="w-full min-h-[48px] pl-11 pr-4 rounded-2xl border border-slate-300 text-base text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
            />
          </div>

          <Button
            onClick={() => setIsModalOpen(true)}
            size="lg"
            className="shadow-md shadow-blue-600/20"
          >
            <Plus className="w-5 h-5 mr-1.5" />
            <span>Tạo Lớp Học Mới</span>
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchClasses} className="text-red-700 font-semibold p-1 hover:underline">
              Thử lại
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Đang tải danh sách lớp học...</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs mt-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-900 text-lg mb-1">
              {searchQuery ? 'Không tìm thấy lớp học' : 'Chưa có lớp học nào'}
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mb-5 leading-relaxed">
              {searchQuery
                ? 'Không có kết quả nào phù hợp với từ khóa tìm kiếm của bạn.'
                : 'Bắt đầu bằng việc tạo một lớp học mới để quản lý danh sách sinh viên và đối soát điểm danh.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsModalOpen(true)} variant="primary" size="lg">
                <Plus className="w-5 h-5 mr-1" />
                <span>Tạo Lớp Đầu Tiên</span>
              </Button>
            )}
          </div>
        ) : (
          /* Class List */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
              <span>DANH SÁCH LỚP ({filteredClasses.length})</span>
              <button
                onClick={fetchClasses}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Làm mới</span>
              </button>
            </div>

            {filteredClasses.map((item) => (
              <ClassCard key={item.classId} classItem={item} onSelect={onSelectClass} />
            ))}
          </div>
        )}
      </main>

      <CreateClassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateClass}
        isLoading={isCreating}
      />
    </div>
  );
};

