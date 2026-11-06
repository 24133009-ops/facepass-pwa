import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/auth/LoginForm';
import { NewPasswordForm } from '../components/auth/NewPasswordForm';
import { apiService } from '../services/api';

export const LoginPage: React.FC = () => {
  const { isNewPasswordRequired } = useAuth();
  const isMock = apiService.isMockMode();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* App Branding */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <ShieldCheck className="w-10 h-10" />
          </div>
        </div>

        <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          FacePass PWA
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Điểm danh lớp học bằng AI nhận diện khuôn mặt
        </p>

        <div className="mt-2 flex justify-center">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isMock
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {isMock ? 'Chế độ Demo (Mock API Active)' : 'Kết nối AWS Production'}
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-5 sm:px-8 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-200/80">
          {isNewPasswordRequired ? <NewPasswordForm /> : <LoginForm />}
        </div>

        {/* Security & Architecture Guarantees Footer */}
        <div className="mt-6 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Token lưu an toàn trong Memory • Không ghi vào LocalStorage</span>
          </div>
          <p className="text-[11px] text-slate-400">
            AWS Serverless Architecture: Cognito • Lambda • Rekognition • DynamoDB • SES
          </p>
        </div>
      </div>
    </div>
  );
};

