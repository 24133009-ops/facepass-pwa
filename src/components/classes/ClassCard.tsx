import React from 'react';
import { Users, ChevronRight, Calendar, Sparkles } from 'lucide-react';
import { ClassItem } from '../../types';

interface ClassCardProps {
  classItem: ClassItem;
  onSelect: (classItem: ClassItem) => void;
}

export const ClassCard: React.FC<ClassCardProps> = ({ classItem, onSelect }) => {
  const dateFormatted = classItem.createdAt
    ? new Date(classItem.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : '';

  return (
    <div
      onClick={() => onSelect(classItem)}
      className="w-full bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-bold text-slate-900 text-lg leading-snug line-clamp-2">
            {classItem.name}
          </h3>
          <span className="shrink-0 text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg border border-slate-200">
            {classItem.classId}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-700">
              {classItem.studentCount ?? 0} sinh viên
            </span>
          </div>

          {dateFormatted && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{dateFormatted}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-blue-600 font-semibold text-sm">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          <span>Vào điểm danh & Quản lý</span>
        </span>
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

