import React, { useState } from 'react';
import { Lock, ShieldAlert, Check, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';

export const NewPasswordForm: React.FC = () => {
  const { completeNewPassword, logout, isLoading, error } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Password Policy Rules
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isValid = hasMinLength && hasUpper && hasLower && hasNumber && isMatch;

  const passedCount = [hasMinLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;
  const strengthPercent = (passedCount / 4) * 100;
  const strengthLabel =
    passedCount === 0 ? '' : passedCount <= 2 ? 'Yếu' : passedCount === 3 ? 'Trung bình' : 'Mạnh';
  const strengthColor =
    passedCount <= 2 ? 'bg-red-500' : passedCount === 3 ? 'bg-amber-500' : 'bg-emerald-500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!isValid) {
      if (!isMatch) {
        setValidationError('Mật khẩu xác nhận không khớp');
      } else {
        setValidationError('Mật khẩu chưa đáp ứng đầy đủ các chính sách bảo mật');
      }
      return;
    }

    try {
      await completeNewPassword(newPassword);
    } catch {
      // Error handled in AuthContext
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-950">Yêu cầu Đổi Mật Khẩu Lần Đầu</p>
          <p className="text-amber-800 text-xs mt-1 leading-relaxed">
            Tài khoản này được cấp phát bởi Quản trị viên. Theo chính sách an toàn, bạn bắt buộc
            phải thiết lập mật khẩu cá nhân mới trước khi truy cập.
          </p>
        </div>
      </div>

      {(error || validationError) && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm animate-slide-down">
          {error || validationError}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mật khẩu mới</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Lock className="w-5 h-5" />
          </div>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nhập mật khẩu mới"
            required
            className="w-full min-h-[48px] pl-11 pr-4 rounded-2xl border border-slate-200 text-base text-slate-900 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Xác nhận mật khẩu mới
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Lock className="w-5 h-5" />
          </div>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            required
            className="w-full min-h-[48px] pl-11 pr-4 rounded-2xl border border-slate-200 text-base text-slate-900 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Strength Meter */}
      {newPassword.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">Độ mạnh mật khẩu</span>
            <span
              className={`font-bold ${
                passedCount <= 2
                  ? 'text-red-600'
                  : passedCount === 3
                    ? 'text-amber-600'
                    : 'text-emerald-600'
              }`}
            >
              {strengthLabel}
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${strengthColor}`}
              style={{ width: `${strengthPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Security Checklist */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
        <p className="font-semibold text-slate-700">Quy định mật khẩu:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { met: hasMinLength, label: 'Tối thiểu 8 ký tự' },
            { met: hasUpper, label: 'Ít nhất 1 chữ hoa' },
            { met: hasLower, label: 'Ít nhất 1 chữ thường' },
            { met: hasNumber, label: 'Ít nhất 1 chữ số' },
          ].map(({ met, label }) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 transition-colors duration-200 ${
                met ? 'text-emerald-700 font-medium' : 'text-slate-500'
              }`}
            >
              {met ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <X className="w-4 h-4 text-slate-400" />
              )}
              <span>{label}</span>
            </div>
          ))}
        </div>
        {confirmPassword && (
          <div
            className={`pt-1 border-t border-slate-200 flex items-center gap-1.5 transition-colors duration-200 ${
              isMatch ? 'text-emerald-700 font-medium' : 'text-slate-500'
            }`}
          >
            {isMatch ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <X className="w-4 h-4 text-slate-400" />
            )}
            <span>Mật khẩu xác nhận {isMatch ? 'trùng khớp' : 'chưa khớp'}</span>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-2">
        <Button type="submit" isLoading={isLoading} disabled={!isValid} variant="gradient" size="lg">
          Lưu Mật Khẩu Mới & Đăng Nhập
        </Button>

        <button
          type="button"
          onClick={logout}
          className="w-full min-h-[48px] py-3 text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Hủy bỏ và quay lại trang đăng nhập</span>
        </button>
      </div>
    </form>
  );
};
