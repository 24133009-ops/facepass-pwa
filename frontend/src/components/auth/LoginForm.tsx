import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { apiService } from '../../services/api';

export const LoginForm: React.FC = () => {
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isDemoExpanded, setIsDemoExpanded] = useState(false);
  const isMock = apiService.isMockMode();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    try {
      await login(email, password);
    } catch {
      // Error handled in AuthContext
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    clearError();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-sm animate-slide-down">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Đăng nhập thất bại</p>
            <p className="text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Email Giảng viên
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Mail className="w-5 h-5" />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) clearError();
            }}
            placeholder="giangvien@university.edu.vn"
            required
            className="w-full min-h-[48px] pl-11 pr-4 rounded-2xl border border-slate-200 text-base text-slate-900 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Mật khẩu
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Lock className="w-5 h-5" />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) clearError();
            }}
            placeholder="••••••••"
            required
            className="w-full min-h-[48px] pl-11 pr-4 rounded-2xl border border-slate-200 text-base text-slate-900 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="pt-1">
        <Button type="submit" isLoading={isLoading} variant="gradient" size="lg">
          Đăng Nhập Vào Hệ Thống
        </Button>
      </div>

      {/* Demo Credentials Section: Collapsible, only in Mock Mode */}
      {isMock && (
        <div className="mt-6 pt-4 border-t border-slate-200/80">
          <button
            type="button"
            onClick={() => setIsDemoExpanded(!isDemoExpanded)}
            className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Tài khoản kiểm thử nhanh (Demo)</span>
            </div>
            {isDemoExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isDemoExpanded && (
            <div className="mt-3 grid grid-cols-1 gap-2.5 animate-slide-up">
              <button
                type="button"
                onClick={() => handleQuickLogin('teacher@example.com', 'Teacher@123')}
                className="w-full p-3 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-2xl transition-all active:scale-[0.99]"
              >
                <div className="text-sm font-semibold text-slate-900">
                  1. Giảng viên chính thức (Đã đổi pass)
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  teacher@example.com | Teacher@123
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('newteacher@example.com', 'TempPass@123')}
                className="w-full p-3 text-left bg-amber-50/60 hover:bg-amber-100/70 border border-amber-200 hover:border-amber-300 rounded-2xl transition-all active:scale-[0.99]"
              >
                <div className="text-sm font-semibold text-amber-900 flex items-center justify-between">
                  <span>2. Giảng viên mới (Yêu cầu đổi pass)</span>
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                    NEW_PASSWORD
                  </span>
                </div>
                <div className="text-xs text-amber-700 font-mono mt-0.5">
                  newteacher@example.com | TempPass@123
                </div>
              </button>
            </div>
          )}
        </div>
      )}
    </form>
  );
};
