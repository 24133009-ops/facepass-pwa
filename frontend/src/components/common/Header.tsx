import React, { useState, useEffect } from 'react';
import { LogOut, ArrowLeft, ShieldCheck, Database } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title = 'FacePass PWA', onBack, showBack = false }) => {
  const { teacher, logout } = useAuth();
  const isMock = apiService.isMockMode();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 px-4 py-3 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-md'
          : 'bg-white border-b border-slate-200 shadow-xs'
      }`}
    >
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {showBack && onBack ? (
            <button
              onClick={onBack}
              aria-label="Quay lại"
              className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors touch-target flex items-center justify-center"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-600/25">
              <ShieldCheck className="w-5 h-5" />
            </div>
          )}

          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight truncate max-w-[180px] sm:max-w-xs">
              {title}
            </h1>
            {teacher && (
              <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{teacher.email}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Indicator Badge (Only shown in Mock Mode) */}
          {isMock && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-amber-100 text-amber-800 border border-amber-300">
              <Database className="w-3 h-3" />
              MOCK DEV
            </span>
          )}

          {teacher && (
            <button
              onClick={logout}
              title="Đăng xuất"
              className="p-2 -mr-2 text-slate-400 hover:text-red-600 active:bg-red-50 rounded-xl transition-colors touch-target flex items-center justify-center"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
