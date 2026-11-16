import React from 'react';
import { Users, ChevronRight, Calendar, Sparkles, CheckCircle2 } from 'lucide-react';
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

  const studentCount = classItem.studentCount ?? 0;

  return (
    <div
      onClick={() => onSelect(classItem)}
      className="group relative overflow-hidden w-full bg-white rounded-2xl pl-5 pr-4 sm:pr-5 py-4 sm:py-5 border border-slate-200/80 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.99] cursor-pointer flex flex-col justify-between"
    >
      {/* Left Gradient Accent Bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 via-indigo-600 to-violet-600 rounded-l-2xl group-hover:w-2 transition-all duration-200" />

      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-bold text-slate-900 text-lg leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
            {classItem.name}
          </h3>
          <span className="shrink-0 text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-xl border border-slate-200">
            {classItem.classId}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 mb-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-700">
              {studentCount} sinh viên
            </span>
          </div>

          {/* Enrollment Status Indicator */}
          {studentCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Đã có dữ liệu
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              Chưa có SV
            </span>
          )}

          {dateFormatted && (
            <div className="flex items-center gap-1 text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>{dateFormatted}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-blue-600 font-semibold text-sm">
        <span className="flex items-center gap-1.5 group-hover:translate-x-0.5 transition-transform">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span>Vào điểm danh & Quản lý</span>
        </span>
        <div className="w-8 h-8 rounded-full bg-blue-50 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-blue-600 transition-all">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
