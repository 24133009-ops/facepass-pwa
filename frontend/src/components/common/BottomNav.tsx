import React from 'react';
import { Home, BookOpen } from 'lucide-react';

interface BottomNavProps {
  currentPage: 'dashboard' | 'classes' | 'classDetail';
  onNavigate: (page: 'dashboard' | 'classes') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentPage, onNavigate }) => {
  const items = [
    { id: 'dashboard' as const, icon: Home, label: 'Tổng quan' },
    { id: 'classes' as const, icon: BookOpen, label: 'Lớp học' },
  ];

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 pb-[env(safe-area-inset-bottom)] shadow-elevated lg:top-0 lg:right-auto lg:w-64 lg:border-t-0 lg:border-r lg:pt-[env(safe-area-inset-top)] lg:shadow-none"
    >
      <a href="#page-content" className="sr-only focus:not-sr-only focus:block focus:p-4 focus:text-blue-700">Đến nội dung chính</a>
      <div className="hidden lg:flex items-center gap-3 px-6 py-8">
        <img src="/favicon.svg" alt="" className="h-11 w-11 rounded-xl" />
        <span className="text-xl font-extrabold text-slate-900">FacePass</span>
      </div>
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 lg:h-auto lg:flex-col lg:items-stretch lg:gap-2 lg:px-4">
        {items.map(({ id, icon: Icon, label }) => {
          const isActive = currentPage === id || (id === 'classes' && currentPage === 'classDetail');
          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 w-20 h-full transition-colors lg:flex-row lg:justify-start lg:gap-3 lg:w-full lg:h-12 lg:px-4 lg:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isActive ? 'text-blue-600 lg:bg-blue-50' : 'text-slate-400 hover:text-slate-600 lg:hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-[10px] lg:text-sm font-semibold ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute top-0 w-10 h-0.5 bg-blue-600 rounded-b-full lg:hidden" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
