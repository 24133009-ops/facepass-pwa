import React from 'react';
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

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showBack && onBack ? (
            <button
              onClick={onBack}
              aria-label="Quay lại"
              className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors touch-target flex items-center justify-center"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
          )}

          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight truncate max-w-[180px] sm:max-w-xs">
              {title}
            </h1>
            {teacher && (
              <p className="text-xs text-slate-500 truncate max-w-[180px]">{teacher.email}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Indicator Badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
              isMock
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}
          >
            <Database className="w-3 h-3" />
            {isMock ? 'MOCK DEV' : 'AWS PROD'}
          </span>

          {teacher && (
            <button
              onClick={logout}
              title="Đăng xuất"
              className="p-2 -mr-2 text-slate-500 hover:text-red-600 active:bg-red-50 rounded-xl transition-colors touch-target flex items-center justify-center"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

