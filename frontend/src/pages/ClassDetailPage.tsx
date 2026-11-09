import React, { useState, useEffect } from 'react';
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
import { AddStudentModal } from '../components/students/AddStudentModal';
import { ImportCsvModal } from '../components/students/ImportCsvModal';
import { FaceEnrollmentModal } from '../components/enrollment/FaceEnrollmentModal';
import { AttendanceScanModal } from '../components/attendance/AttendanceScanModal';
import { AttendanceReviewModal } from '../components/attendance/AttendanceReviewModal';
import { AttendanceSessionDetailModal } from '../components/attendance/AttendanceSessionDetailModal';
import { Button } from '../components/common/Button';

interface ClassDetailPageProps {
  classItem: ClassItem;
  onBack: () => void;
}

export const ClassDetailPage: React.FC<ClassDetailPageProps> = ({ classItem, onBack }) => {
  const { token } = useAuth();
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

      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full px-4 animate-in fade-in slide-in-from-top duration-300">
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successToast}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 pb-28">
        {/* Class Overview Banner */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
              Mã lớp: {classItem.classId}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Collection: {classItem.collectionId}
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mb-1">
                <Users className="w-3.5 h-3.5" />
                <span>Sĩ số</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900">{students.length}</div>
            </div>

            <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200">
              <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã nạp mặt</span>
              </div>
              <div className="text-xl font-extrabold text-emerald-700">{enrolledCount}</div>
            </div>

            <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200">
              <div className="flex items-center justify-center gap-1 text-amber-700 text-xs mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Chưa có mặt</span>
              </div>
              <div className="text-xl font-extrabold text-amber-700">{missingFaceCount}</div>
            </div>
          </div>

          {/* Interactive Action Cards: Task 9 & Task 10 */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* Task 10 Trigger */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center gap-1.5 text-blue-900 text-xs font-bold mb-1">
                  <ScanFace className="w-4 h-4 text-blue-600" />
                  <span>Điểm Danh AI</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-snug mb-3">
                  Chụp 1 hoặc nhiều góc ảnh toàn cảnh lớp học, AI đối soát 3 nhóm & gửi mail cảnh báo.
                </p>
              </div>
              <Button
                size="md"
                variant="primary"
                onClick={() => setIsScanModalOpen(true)}
                className="text-xs min-h-[42px] py-2 font-bold shadow-xs"
              >
                <span>Bắt Đầu Quét</span>
              </Button>
            </div>

            {/* Task 9 Trigger */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/70 border border-emerald-200 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center gap-1.5 text-emerald-900 text-xs font-bold mb-1">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Đăng Ký Mặt</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-snug mb-3">
                  Chụp 2-3 ảnh chân dung kèm cam kết đồng ý sinh trắc học.
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
                className="text-xs min-h-[42px] py-2 border-emerald-300 text-emerald-800 font-bold hover:bg-emerald-50"
              >
                <span>Chụp Chân Dung</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation: Sinh viên vs Lịch sử điểm danh (Task 11) */}
        <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'students'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Sinh Viên ({students.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
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
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium">Đang tải danh sách sinh viên...</p>
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
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium">Đang tải lịch sử buổi học...</p>
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
              <div className="space-y-3">
                {sessions.map((sess) => {
                  const dateStr = new Date(sess.startedAt).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  });

                  return (
                    <div
                      key={sess.sessionId}
                      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            #{sess.sessionId}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">
                            {dateStr}
                          </span>
                        </div>

                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Đã chốt
                        </span>
                      </div>

                      {/* Counts */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 bg-slate-50 rounded-xl">
                          <span className="text-slate-500 text-[11px]">Sĩ số</span>
                          <p className="font-bold text-slate-800 text-sm">{sess.totalStudents}</p>
                        </div>
                        <div className="p-2 bg-emerald-50/70 rounded-xl">
                          <span className="text-emerald-700 text-[11px]">Có mặt</span>
                          <p className="font-bold text-emerald-800 text-sm">{sess.presentCount}</p>
                        </div>
                        <div className="p-2 bg-red-50/70 rounded-xl">
                          <span className="text-red-700 text-[11px]">Vắng</span>
                          <p className="font-bold text-red-800 text-sm">{sess.absentCount}</p>
                        </div>
                      </div>

                      {/* Action buttons: Download CSV & View Details */}
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportSessionCsv(sess)}
                          title="Tải báo cáo CSV có UTF-8 BOM và chống CSV injection"
                          className="flex-1 min-h-[44px] py-2 px-3 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 flex items-center justify-center gap-1.5 transition-colors touch-target"
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
                          className="min-h-[44px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors touch-target flex items-center gap-1"
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
      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddStudent}
        isLoading={isActionLoading}
      />

      <ImportCsvModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImport={handleImportCsv}
        isLoading={isActionLoading}
      />

      {/* Task 9: Biometric Face Enrollment Modal */}
      <FaceEnrollmentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        student={selectedEnrollStudent}
        classId={classItem.classId}
        onSuccess={handleEnrollSuccess}
      />

      {/* Task 10: Attendance Camera Scan Modal */}
      <AttendanceScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        classId={classItem.classId}
        className={classItem.name}
        onScanComplete={handleScanComplete}
      />

      {/* Task 10: Attendance 3-Group Review Modal */}
      <AttendanceReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        scanResult={scanResult}
        classId={classItem.classId}
        onConfirmed={handleAttendanceConfirmed}
      />

      {/* Task 11: Attendance Session Detail Modal */}
      <AttendanceSessionDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        session={selectedSessionDetail}
        onSessionUpdated={handleSessionUpdated}
      />
    </div>
  );
};
