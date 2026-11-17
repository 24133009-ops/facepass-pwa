import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Users,
  CheckCircle2,
  Mail,
  Plus,
  Camera,
  ChevronRight,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ClassItem, SessionHistoryItem } from '../types';
import { apiService } from '../services/api';
import { Header } from '../components/common/Header';
import { StatCard } from '../components/dashboard/StatCard';
import { Button } from '../components/common/Button';

interface DashboardPageProps {
  onNavigateClasses: () => void;
  onSelectClass: (cls: ClassItem) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateClasses,
  onSelectClass,
}) => {
  const { token, teacher } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [averageAttendance, setAverageAttendance] = useState(0);
  const [totalEmailsSent, setTotalEmailsSent] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      if (!token) return;
      setIsLoading(true);
      try {
        const classList = await apiService.getClasses(token);
        setClasses(classList);

        let stuCount = 0;
        let allSessions: SessionHistoryItem[] = [];

        for (const cls of classList) {
          stuCount += cls.studentCount ?? 0;
          try {
            const classSessions = await apiService.getClassSessions(token, cls.classId);
            allSessions = [...allSessions, ...classSessions];
          } catch {
            // Ignore session fetch errors
          }
        }

        setTotalStudents(stuCount);
        setSessions(allSessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));

        // Calculate average attendance
        if (allSessions.length > 0) {
          let totalPresent = 0;
          let totalRecords = 0;
          let emailsSent = 0;

          for (const sess of allSessions) {
            if (sess.records) {
              totalRecords += sess.records.length;
              totalPresent += sess.records.filter((r) => r.status === 'present').length;
              emailsSent += sess.records.filter((r) => r.emailStatus === 'sent').length;
            }
          }

          setAverageAttendance(totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0);
          setTotalEmailsSent(emailsSent);
        }
      } catch {
        // Ignore errors
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [token]);

  const greetingName = teacher?.name || teacher?.email?.split('@')[0] || 'Giảng viên';
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const dateFormatted = now.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const recentClasses = classes.slice(0, 3);
  const recentSessions = sessions.slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header title="FacePass PWA" />

      <main id="page-content" tabIndex={-1} className="flex-1 max-w-lg md:max-w-5xl w-full mx-auto p-4 space-y-5 pb-24 lg:pb-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 rounded-3xl p-5 text-white shadow-glow-blue animate-fade-in">
          <p className="text-sm text-blue-100/80">{greeting},</p>
          <h2 className="text-xl font-bold mt-0.5 capitalize">{greetingName}</h2>
          <p className="text-xs text-blue-200/70 mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {dateFormatted}
          </p>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 animate-slide-up">
            <StatCard
              icon={<BookOpen className="w-5 h-5" />}
              label="Lớp học"
              value={classes.length}
              color="blue"
            />
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Sinh viên"
              value={totalStudents}
              color="violet"
            />
            <StatCard
              icon={<CheckCircle2 className="w-5 h-5" />}
              label="Tỷ lệ đi học"
              value={averageAttendance}
              color="emerald"
              suffix="%"
            />
            <StatCard
              icon={<Mail className="w-5 h-5" />}
              label="Email đã gửi"
              value={totalEmailsSent}
              color="amber"
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={onNavigateClasses}
            className="flex-col gap-1 !py-4 !rounded-2xl"
          >
            <Plus className="w-5 h-5 text-blue-600" />
            <span className="text-xs text-slate-700">Tạo lớp mới</span>
          </Button>
          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={onNavigateClasses}
            className="flex-col gap-1 !py-4 !rounded-2xl"
          >
            <Camera className="w-5 h-5 text-indigo-600" />
            <span className="text-xs text-slate-700">Quét điểm danh</span>
          </Button>
        </div>

        {/* Recent Classes */}
        {recentClasses.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Lớp học gần đây</h3>
              <button
                onClick={onNavigateClasses}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
              >
                Xem tất cả
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {recentClasses.map((cls) => (
                <button
                  key={cls.classId}
                  onClick={() => onSelectClass(cls)}
                  className="w-full flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-100 shadow-card hover:shadow-card-hover transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                      {cls.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900 line-clamp-1">{cls.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {cls.studentCount ?? 0} sinh viên • {cls.classId}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {recentSessions.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Hoạt động gần đây
            </h3>
            <div className="space-y-2">
              {recentSessions.map((sess) => {
                const presentCount = sess.records?.filter((r) => r.status === 'present').length ?? 0;
                const totalCount = sess.records?.length ?? 0;
                const timeFormatted = new Date(sess.startedAt).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                });

                return (
                  <div
                    key={sess.sessionId}
                    className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-card"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{sess.className}</p>
                      <p className="text-[11px] text-slate-500">
                        {timeFormatted} • {presentCount}/{totalCount} có mặt
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
