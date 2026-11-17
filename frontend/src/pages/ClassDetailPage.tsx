import React, { lazy, Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  UserPlus,
  FileSpreadsheet,
  Search,
  Users,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Camera,
  ScanFace,
  History,
  Download,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ClassItem, StudentItem, ScanResult, SessionHistoryItem } from '../types';
import { apiService } from '../services/api';
import { downloadCsvFile, generateAttendanceCsv } from '../utils/csvHelper';
import { Header } from '../components/common/Header';
import { StudentItemCard } from '../components/students/StudentItem';
import { Button } from '../components/common/Button';

const AddStudentModal = lazy(() =>
  import('../components/students/AddStudentModal').then(m => ({ default: m.AddStudentModal }))
);
const ImportCsvModal = lazy(() =>
  import('../components/students/ImportCsvModal').then(m => ({ default: m.ImportCsvModal }))
);
const FaceEnrollmentModal = lazy(() =>
  import('../components/enrollment/FaceEnrollmentModal').then(m => ({ default: m.FaceEnrollmentModal }))
);
const AttendanceScanModal = lazy(() =>
  import('../components/attendance/AttendanceScanModal').then(m => ({ default: m.AttendanceScanModal }))
);
const AttendanceReviewModal = lazy(() =>
  import('../components/attendance/AttendanceReviewModal').then(m => ({ default: m.AttendanceReviewModal }))
);
const AttendanceSessionDetailModal = lazy(() =>
  import('../components/attendance/AttendanceSessionDetailModal').then(m => ({ default: m.AttendanceSessionDetailModal }))
);

interface ClassDetailPageProps {
  classItem: ClassItem;
  onBack: () => void;
}

export const ClassDetailPage: React.FC<ClassDetailPageProps> = ({ classItem, onBack }) => {
  const { token } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<'students' | 'history'>('students');

  // Students Data
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // History Sessions Data
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<SessionHistoryItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Modals Controls
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Task 9: Biometric Face Enrollment State
  const [selectedEnrollStudent, setSelectedEnrollStudent] = useState<StudentItem | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);

  // Task 10: Attendance Scan & Review State
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);

  const fetchStudents = async () => {
    if (!token) return;
    setIsLoadingStudents(true);
    setError(null);
    try {
      const data = await apiService.getStudents(token, classItem.classId);
      setStudents(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi tải danh sách sinh viên');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const fetchSessions = async () => {
    if (!token) return;
    setIsLoadingSessions(true);
    try {
      const data = await apiService.getClassSessions(token, classItem.classId);
      setSessions(data);
    } catch {
      // Ignore background session fetch errors
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchSessions();
  }, [token, classItem.classId]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleAddStudent = async (studentData: {
    studentId: string;
    fullName: string;
    email: string;
  }) => {
    if (!token) return;
    setIsActionLoading(true);
    try {
      const created = await apiService.addStudent(token, classItem.classId, studentData);
      setStudents((prev) => [...prev, created]);
      showToast(`Đã thêm sinh viên ${created.fullName}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleImportCsv = async (csvContent: string) => {
    if (!token) return;
    setIsActionLoading(true);
    try {
      const imported = await apiService.importStudentsCsv(token, classItem.classId, csvContent);
      setStudents((prev) => [...prev, ...imported]);
      showToast(`Đã nhập thành công ${imported.length} sinh viên từ file CSV`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!token) return;
    try {
      await apiService.deleteStudent(token, classItem.classId, studentId);
      setStudents((prev) => prev.filter((s) => s.studentId !== studentId));
      showToast(`Đã xóa vĩnh viễn hồ sơ và dữ liệu sinh trắc học của sinh viên ${studentId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xóa sinh viên thất bại');
      throw err;
    }
  };

  const handleOpenEnrollModal = (student: StudentItem) => {
    setSelectedEnrollStudent(student);
    setIsEnrollModalOpen(true);
  };

  const handleEnrollSuccess = () => {
    fetchStudents();
    showToast('Đăng ký khuôn mặt thành công');
  };

  const handleScanComplete = (result: ScanResult) => {
    setScanResult(result);
    setIsReviewModalOpen(true);
  };

  const handleAttendanceConfirmed = () => {
    fetchStudents();
    fetchSessions();
    setActiveTab('history');
    showToast('Điểm danh đã được xác nhận và thông báo đã gửi tới máy chủ mail');
  };

  const handleSessionUpdated = (updatedSession: SessionHistoryItem) => {
    setSessions((prev) =>
      prev.map((s) => (s.sessionId === updatedSession.sessionId ? updatedSession : s))
    );
    setSelectedSessionDetail(updatedSession);
  };

  const handleExportSessionCsv = (session: SessionHistoryItem) => {
    const timeFormatted = new Date(session.startedAt).toLocaleString('vi-VN');
    const csvContent = generateAttendanceCsv({
      sessionId: session.sessionId,
      classId: session.classId,
      className: session.className,
      sessionTime: timeFormatted,
      records: session.records
    });
    const filename = `DiemDanh_${session.classId}_${session.sessionId}.csv`;
    downloadCsvFile(filename, csvContent);
    showToast(`Đã tải file ${filename} (BOM UTF-8)`);
  };

  const enrolledCount = students.filter((s) => s.faceIds && s.faceIds.length > 0).length;
  const missingFaceCount = students.length - enrolledCount;

  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Header title={classItem.name} showBack onBack={onBack} />

      {/* Floating Success Toast with Framer-motion & Auto-dismiss Progress Bar */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4 pointer-events-none"
          >
            <div className="relative overflow-hidden bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="flex-1">{successToast}</span>
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 3.5, ease: 'linear' }}
                className="absolute bottom-0 left-0 h-1 bg-white/40"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="page-content" tabIndex={-1} className="flex-1 max-w-md md:max-w-5xl w-full mx-auto p-4 space-y-4 pb-28 lg:pb-8">
        {/* Class Overview Hero Banner with Gradient & Metrics */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-700 rounded-3xl p-5 border border-blue-500/50 shadow-card">
          <div
            className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-white/10 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="absolute -left-14 bottom-0 w-32 h-32 rounded-full bg-indigo-300/20 blur-2xl"
            aria-hidden="true"
          />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-white/15 text-white rounded-xl border border-white/20">
                Mã lớp: {classItem.classId}
              </span>
              <span className="text-xs text-blue-100 font-medium">
                Collection: {classItem.collectionId}
              </span>
            </div>

            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] text-blue-100 uppercase">
                Không gian lớp học
              </p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-white">{classItem.name}</h1>
            </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="bg-white/90 backdrop-blur-xs p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mb-1">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Sĩ số</span>
              </div>
              <div className="text-xl font-black text-slate-900">{students.length}</div>
            </div>

            <div className="bg-emerald-50/90 backdrop-blur-xs p-3 rounded-2xl border border-emerald-200/80 shadow-2xs">
              <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã nạp mặt</span>
              </div>
              <div className="text-xl font-black text-emerald-700">{enrolledCount}</div>
            </div>

            <div className="bg-amber-50/90 backdrop-blur-xs p-3 rounded-2xl border border-amber-200/80 shadow-2xs">
              <div className="flex items-center justify-center gap-1 text-amber-700 text-xs mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Chưa có mặt</span>
              </div>
              <div className="text-xl font-black text-amber-700">{missingFaceCount}</div>
            </div>
          </div>

          {/* Interactive Action Cards */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* Điểm danh AI Trigger */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-blue-600/5 border border-blue-200/90 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center gap-1.5 text-blue-900 text-xs font-bold mb-1">
                  <ScanFace className="w-4 h-4 text-blue-600" />
                  <span>Điểm Danh AI</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-snug mb-3">
                  Chụp ảnh lớp học, AI đối soát 3 nhóm & gửi mail cảnh báo.
                </p>
              </div>
              <Button
                size="md"
                variant="gradient"
                onClick={() => setIsScanModalOpen(true)}
                className="text-xs min-h-[42px] py-2 font-bold shadow-xs active:scale-95"
              >
                <span>Bắt Đầu Quét</span>
              </Button>
            </div>

            {/* Đăng ký mặt Trigger */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-emerald-600/5 border border-emerald-200/90 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center gap-1.5 text-emerald-900 text-xs font-bold mb-1">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Đăng Ký Mặt</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-snug mb-3">
                  Chụp ảnh chân dung kèm cam kết đồng ý sinh trắc học.
                </p>
              </div>
              <Button
                size="md"
                variant="outline"
                onClick={() => {
                  const firstWithoutFace = students.find(
                    (s) => !s.faceIds || s.faceIds.length === 0
                  );
                  if (firstWithoutFace) {
                    handleOpenEnrollModal(firstWithoutFace);
                  } else if (students.length > 0) {
                    handleOpenEnrollModal(students[0]);
                  } else {
                    setIsAddModalOpen(true);
                  }
                }}
                className="text-xs min-h-[42px] py-2 border-emerald-300 text-emerald-800 font-bold hover:bg-emerald-50 active:scale-95"
              >
                <span>Chụp Chân Dung</span>
              </Button>
            </div>
          </div>
          </div>
        </div>

        {/* Tab Navigation with Animated Framer-Motion Indicator */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 border border-slate-200/90 shadow-xs relative">
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`relative py-2.5 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'students' ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {activeTab === 'students' && (
              <motion.div
                layoutId="classDetailTabIndicator"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 35 }
                }
                className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
              />
            )}
            <Users className="w-4 h-4" />
            <span>Sinh Viên ({students.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`relative py-2.5 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'history' ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {activeTab === 'history' && (
              <motion.div
                layoutId="classDetailTabIndicator"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 35 }
                }
                className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
              />
            )}
            <History className="w-4 h-4" />
            <span>Lịch Sử ({sessions.length})</span>
          </button>
        </div>

        {/* TAB 1: STUDENTS MANAGEMENT */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            {/* Action Buttons for Students Management */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => setIsAddModalOpen(true)}
                size="lg"
                variant="primary"
                className="shadow-sm"
              >
                <UserPlus className="w-5 h-5 mr-1.5" />
                <span>+ Thêm SV</span>
              </Button>

              <Button
                onClick={() => setIsCsvModalOpen(true)}
                size="lg"
                variant="outline"
                className="shadow-sm"
              >
                <FileSpreadsheet className="w-5 h-5 mr-1.5 text-emerald-600" />
                <span>Nhập File CSV</span>
              </Button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm MSSV, họ tên, email..."
                className="w-full min-h-[48px] pl-11 pr-4 rounded-2xl border border-slate-300 text-base text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
              />
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
                <span>{error}</span>
                <button onClick={fetchStudents} className="text-red-700 font-semibold p-1 hover:underline">
                  Thử lại
                </button>
              </div>
            )}

            {/* Student List */}
            {isLoadingStudents ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 skeleton rounded-2xl shrink-0" />
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex gap-2">
                          <div className="w-16 h-4 skeleton rounded-md" />
                          <div className="w-28 h-4 skeleton rounded-md" />
                        </div>
                        <div className="w-36 h-3 skeleton rounded-md" />
                        <div className="w-24 h-4 skeleton rounded-full" />
                      </div>
                    </div>
                    <div className="w-8 h-8 skeleton rounded-xl shrink-0" />
                  </div>
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-900 text-lg mb-1">
                  {searchQuery ? 'Không tìm thấy sinh viên' : 'Chưa có sinh viên nào'}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                  {searchQuery
                    ? 'Không có sinh viên nào khớp với từ khóa tìm kiếm.'
                    : 'Thêm sinh viên lẻ hoặc nhập file CSV để bắt đầu quản lý danh sách lớp.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
                  <span>DANH SÁCH SINH VIÊN ({filteredStudents.length})</span>
                  <button
                    onClick={fetchStudents}
                    className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Làm mới</span>
                  </button>
                </div>

                {filteredStudents.map((student) => (
                  <StudentItemCard
                    key={student.studentId}
                    student={student}
                    onDelete={handleDeleteStudent}
                    onEnroll={handleOpenEnrollModal}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ATTENDANCE HISTORY & SECURE CSV EXPORT (TASK 11) */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
              <span>LỊCH SỬ CÁC BUỔI ĐIỂM DANH ({sessions.length})</span>
              <button
                onClick={fetchSessions}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Làm mới</span>
              </button>
            </div>

            {isLoadingSessions ? (
              <div className="space-y-3 pl-6 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="relative p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
                  >
                    <div className="absolute -left-[29px] top-4 w-4 h-4 rounded-full skeleton ring-4 ring-white" />
                    <div className="flex justify-between items-center">
                      <div className="w-32 h-4 skeleton rounded-md" />
                      <div className="w-16 h-4 skeleton rounded-full" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-12 skeleton rounded-xl" />
                      <div className="h-12 skeleton rounded-xl" />
                      <div className="h-12 skeleton rounded-xl" />
                    </div>
                    <div className="h-10 skeleton rounded-xl" />
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-900 text-lg mb-1">Chưa có buổi điểm danh nào</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4 leading-relaxed">
                  Bấm nút <strong>"Điểm Danh AI"</strong> ở trên để chụp ảnh lớp học và tạo buổi điểm danh đầu tiên.
                </p>
                <Button onClick={() => setIsScanModalOpen(true)} size="md" className="max-w-[200px] mx-auto">
                  <span>Bắt Đầu Điểm Danh</span>
                </Button>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-indigo-300 before:to-slate-200">
                {sessions.map((sess) => {
                  const dateStr = new Date(sess.startedAt).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  });

                  const presentPct =
                    sess.totalStudents > 0
                      ? Math.round((sess.presentCount / sess.totalStudents) * 100)
                      : 0;
                  const isConfirmed = sess.status === 'confirmed';

                  return (
                    <div
                      key={sess.sessionId}
                      className="relative group p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-300 hover:shadow-card transition-all duration-200 space-y-3"
                    >
                      {/* Timeline node */}
                      <div className="absolute -left-[29px] top-4 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-white shadow-xs group-hover:scale-110 transition-transform" />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200/80">
                            #{sess.sessionId}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{dateStr}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                            isConfirmed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                          }`}
                        >
                          {isConfirmed ? 'Đã chốt' : 'Bản nháp'}
                        </span>
                      </div>

                      {/* Donut Chart & Counts */}
                      <div className="flex items-center gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                        {/* Mini Donut Chart */}
                        <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-slate-200"
                              stroke="currentColor"
                              strokeWidth="3.5"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className="text-emerald-500 transition-all duration-500"
                              stroke="currentColor"
                              strokeWidth="3.5"
                              strokeDasharray={`${presentPct}, 100`}
                              strokeLinecap="round"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <div className="absolute text-[10px] font-black text-slate-800">
                            {presentPct}%
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 flex-1 text-center text-xs">
                          <div className="p-1.5 bg-white rounded-lg border border-slate-200/70">
                            <span className="text-slate-500 text-[10px]">Sĩ số</span>
                            <p className="font-extrabold text-slate-800 text-sm">{sess.totalStudents}</p>
                          </div>
                          <div className="p-1.5 bg-emerald-50/70 rounded-lg border border-emerald-200/70">
                            <span className="text-emerald-700 text-[10px]">Có mặt</span>
                            <p className="font-extrabold text-emerald-800 text-sm">{sess.presentCount}</p>
                          </div>
                          <div className="p-1.5 bg-rose-50/70 rounded-lg border border-rose-200/70">
                            <span className="text-rose-700 text-[10px]">Vắng</span>
                            <p className="font-extrabold text-rose-800 text-sm">{sess.absentCount}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: Download CSV & View Details */}
                      <div className="pt-0.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportSessionCsv(sess)}
                          title="Tải báo cáo CSV có UTF-8 BOM và chống CSV injection"
                          className="flex-1 min-h-[42px] py-2 px-3 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 flex items-center justify-center gap-1.5 transition-colors touch-target shadow-2xs"
                        >
                          <Download className="w-4 h-4 text-emerald-700" />
                          <span>Xuất CSV (BOM UTF-8)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSessionDetail(sess);
                            setIsDetailModalOpen(true);
                          }}
                          className="min-h-[42px] px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors touch-target flex items-center gap-1 shadow-2xs"
                        >
                          <span>Chi tiết</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals for Task 8, 9, 10, 11 */}
      <Suspense fallback={null}>
        {isAddModalOpen && (
          <AddStudentModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onAdd={handleAddStudent}
            isLoading={isActionLoading}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {isCsvModalOpen && (
          <ImportCsvModal
            isOpen={isCsvModalOpen}
            onClose={() => setIsCsvModalOpen(false)}
            onImport={handleImportCsv}
            isLoading={isActionLoading}
          />
        )}
      </Suspense>

      {/* Task 9: Biometric Face Enrollment Modal */}
      <Suspense fallback={null}>
        {isEnrollModalOpen && (
          <FaceEnrollmentModal
            isOpen={isEnrollModalOpen}
            onClose={() => setIsEnrollModalOpen(false)}
            student={selectedEnrollStudent}
            classId={classItem.classId}
            onSuccess={handleEnrollSuccess}
          />
        )}
      </Suspense>

      {/* Task 10: Attendance Camera Scan Modal */}
      <Suspense fallback={null}>
        {isScanModalOpen && (
          <AttendanceScanModal
            isOpen={isScanModalOpen}
            onClose={() => setIsScanModalOpen(false)}
            classId={classItem.classId}
            className={classItem.name}
            onScanComplete={handleScanComplete}
          />
        )}
      </Suspense>

      {/* Task 10: Attendance 3-Group Review Modal */}
      <Suspense fallback={null}>
        {isReviewModalOpen && (
          <AttendanceReviewModal
            isOpen={isReviewModalOpen}
            onClose={() => setIsReviewModalOpen(false)}
            scanResult={scanResult}
            classId={classItem.classId}
            onConfirmed={handleAttendanceConfirmed}
          />
        )}
      </Suspense>

      {/* Task 11: Attendance Session Detail Modal */}
      <Suspense fallback={null}>
        {isDetailModalOpen && (
          <AttendanceSessionDetailModal
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            session={selectedSessionDetail}
            onSessionUpdated={handleSessionUpdated}
          />
        )}
      </Suspense>
    </div>
  );
};
