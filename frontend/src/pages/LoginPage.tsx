import React from 'react';
import { ShieldCheck, Lock, Fingerprint, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/auth/LoginForm';
import { NewPasswordForm } from '../components/auth/NewPasswordForm';
import { apiService } from '../services/api';

export const LoginPage: React.FC = () => {
  const { isNewPasswordRequired } = useAuth();
  const isMock = apiService.isMockMode();

  return (
    <div className="min-h-screen relative flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-brand-animated" />

      {/* Decorative floating orbs */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-400/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        {/* App Branding */}
        <div className="flex justify-center mb-5 animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center text-white shadow-glow-blue-lg border border-white/30 animate-glow-pulse">
            <ShieldCheck className="w-11 h-11" />
          </div>
        </div>

        <h2 className="text-center text-3xl sm:text-4xl font-extrabold text-white tracking-tight animate-fade-in">
          FacePass
        </h2>
        <p className="mt-1.5 text-center text-sm text-blue-100/90 animate-fade-in">
          Điểm danh lớp học bằng AI nhận diện khuôn mặt
        </p>

        {isMock && (
          <div className="mt-3 flex justify-center animate-slide-up">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-100 border border-amber-300/30 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
              Chế độ Demo (Mock API)
            </span>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-6 sm:mx-auto sm:w-full sm:max-w-md animate-slide-up">
        {/* Glass Card Form */}
        <div className="bg-white/95 backdrop-blur-xl py-7 px-6 sm:px-8 shadow-glass-lg rounded-3xl border border-white/60">
          {isNewPasswordRequired ? <NewPasswordForm /> : <LoginForm />}
        </div>

        {/* Architecture & Security Footer */}
        <div className="mt-6 text-center space-y-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="inline-flex items-center gap-1.5 text-xs text-blue-100/80">
            <Lock className="w-3.5 h-3.5" />
            <span>Token lưu an toàn trong Memory • Không ghi vào LocalStorage</span>
          </div>
          <div className="flex justify-center gap-4">
            {[
              { icon: Cpu, label: 'Lambda' },
              { icon: Fingerprint, label: 'Rekognition' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1 text-[11px] text-blue-200/60">
                <Icon className="w-3 h-3" />
                <span>{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 text-[11px] text-blue-200/60">
              <span>DynamoDB</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-blue-200/60">
              <span>S3</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
