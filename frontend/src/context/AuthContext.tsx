import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Teacher } from '../types';
import { apiService } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  teacher: Teacher | null;
  token: string | null;
  isNewPasswordRequired: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  completeNewPassword: (newPass: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // CRITICAL SECURITY RULE:
  // Tokens and teacher identity are stored STRICTLY in React memory state.
  // NEVER persisted to localStorage or sessionStorage to prevent XSS credential exfiltration.
  const [token, setToken] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [isNewPasswordRequired, setIsNewPasswordRequired] = useState<boolean>(false);
  const [tempSession, setTempSession] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiService.login(email, pass);

      // Handle Admin-created force password change challenge
      if (res.isNewPasswordRequired && res.tempSession) {
        setIsNewPasswordRequired(true);
        setTempSession(res.tempSession);
        return;
      }

      if (res.token && res.teacher) {
        setToken(res.token);
        setTeacher(res.teacher);
        setIsNewPasswordRequired(false);
        setTempSession(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập không thành công';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const completeNewPassword = async (newPass: string) => {
    if (!tempSession) {
      setError('Phiên đổi mật khẩu đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await apiService.completeNewPassword(tempSession, newPass);
      if (res.token && res.teacher) {
        setToken(res.token);
        setTeacher(res.teacher);
        setIsNewPasswordRequired(false);
        setTempSession(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cập nhật mật khẩu thất bại';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Purges memory state completely
    setToken(null);
    setTeacher(null);
    setIsNewPasswordRequired(false);
    setTempSession(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        teacher,
        token,
        isNewPasswordRequired,
        isLoading,
        error,
        login,
        completeNewPassword,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

