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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 pb-[env(safe-area-inset-bottom)] shadow-elevated">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {items.map(({ id, icon: Icon, label }) => {
          const isActive = currentPage === id || (id === 'classes' && currentPage === 'classDetail');
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex flex-col items-center justify-center gap-0.5 w-20 h-full transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-[10px] font-semibold ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute top-0 w-10 h-0.5 bg-blue-600 rounded-b-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
