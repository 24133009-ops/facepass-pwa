import {
  ClassItem,
  StudentItem,
  Teacher,
  PresignedPost,
  ScanResult,
  AttendanceRecord,
  AttendanceConfirmResult,
  SessionHistoryItem
} from '../types';
import { INITIAL_CLASSES, INITIAL_STUDENTS, INITIAL_SESSIONS } from './mockData';
import { generateAttendanceCsv } from '../utils/csvHelper';

const IS_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.VITE_USE_MOCK === true;
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const COGNITO_REGION = import.meta.env.VITE_COGNITO_REGION || 'ap-southeast-1';
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '';

// In-Memory Storage for Mock Mode (Preserved across SPA transitions)
let mockClasses: ClassItem[] = [...INITIAL_CLASSES];
let mockStudents: Record<string, StudentItem[]> = JSON.parse(JSON.stringify(INITIAL_STUDENTS));
let mockSessions: Record<string, SessionHistoryItem[]> = JSON.parse(JSON.stringify(INITIAL_SESSIONS));
let lastLoginEmail = '';

export interface LoginResult {
  isNewPasswordRequired?: boolean;
  tempSession?: string;
  token?: string;
  teacher?: Teacher;
}

export const apiService = {
  isMockMode(): boolean {
    return IS_MOCK;
  },

  // =========================================================================
  // AUTHENTICATION APIs
  // Supports both Mock and direct AWS Cognito IDP in production mode
  // =========================================================================
  async login(email: string, pass: string): Promise<LoginResult> {
    const trimmedEmail = email.trim().toLowerCase();
    lastLoginEmail = trimmedEmail;

    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 250));

      // CASE A: Force initial password change
      if (trimmedEmail === 'newteacher@example.com') {
        if (pass !== 'TempPass@123') {
          throw new Error('Mật khẩu tạm thời không đúng (Gợi ý: TempPass@123)');
        }
        return {
          isNewPasswordRequired: true,
          tempSession: 'cognito-temp-challenge-session-xyz'
        };
      }

      // CASE B: Standard Teacher Login
      if (pass.length < 6) {
        throw new Error('Mật khẩu không chính xác');
      }

      const teacherName = trimmedEmail.split('@')[0];
      return {
        token: `mock-jwt-${Date.now()}-${trimmedEmail}`,
        teacher: {
          email: trimmedEmail,
          name: teacherName.toUpperCase()
        }
      };
    }

    // PRODUCTION MODE: Direct AWS Cognito InitiateAuth (USER_PASSWORD_AUTH)
    if (COGNITO_CLIENT_ID) {
      const res = await fetch(`https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
        },
        body: JSON.stringify({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: COGNITO_CLIENT_ID,
          AuthParameters: {
            USERNAME: trimmedEmail,
            PASSWORD: pass
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Đăng nhập không thành công với tài khoản Cognito');
      }

      if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        return {
          isNewPasswordRequired: true,
          tempSession: data.Session
        };
      }

      const idToken = data.AuthenticationResult?.IdToken;
      return {
        token: idToken,
        teacher: { email: trimmedEmail }
      };
    }

    // Fallback: If custom API proxy is configured
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password: pass })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Đăng nhập không thành công');
    }

    if (data.challengeName === 'NEW_PASSWORD_REQUIRED') {
      return {
        isNewPasswordRequired: true,
        tempSession: data.session
      };
    }

    return {
      token: data.accessToken || data.idToken,
      teacher: { email: data.email || trimmedEmail }
    };
  },

  async completeNewPassword(tempSession: string, newPass: string): Promise<LoginResult> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 300));
      if (newPass.length < 8) {
        throw new Error('Mật khẩu mới phải có tối thiểu 8 ký tự');
      }
      if (!/[A-Z]/.test(newPass) || !/[a-z]/.test(newPass) || !/[0-9]/.test(newPass)) {
        throw new Error('Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số');
      }

      return {
        token: `mock-jwt-fresh-${Date.now()}`,
        teacher: {
          email: 'newteacher@example.com',
          name: 'GIẢNG VIÊN MỚI'
        }
      };
    }

    // PRODUCTION MODE: Direct AWS Cognito RespondToAuthChallenge
    if (COGNITO_CLIENT_ID) {
      const res = await fetch(`https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge'
        },
        body: JSON.stringify({
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          ClientId: COGNITO_CLIENT_ID,
          ChallengeResponses: {
            USERNAME: lastLoginEmail,
            NEW_PASSWORD: newPass
          },
          Session: tempSession
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Cập nhật mật khẩu mới Cognito thất bại');
      }

      const idToken = data.AuthenticationResult?.IdToken;
      return {
        token: idToken,
        teacher: { email: lastLoginEmail }
      };
    }

    const res = await fetch(`${API_BASE_URL}/auth/respond-new-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: tempSession, newPassword: newPass })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Cập nhật mật khẩu thất bại');
    }

    return {
      token: data.accessToken || data.idToken,
      teacher: { email: data.email }
    };
  },

  // =========================================================================
  // CLASSES APIs
  // =========================================================================
  async getClasses(token: string): Promise<ClassItem[]> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 150));
      return mockClasses.map((c) => ({
        ...c,
        studentCount: (mockStudents[c.classId] || []).length
      }));
    }

    const res = await fetch(`${API_BASE_URL}/classes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi tải danh sách lớp học');
    return data.classes || [];
  },

  async getClass(token: string, classId: string): Promise<ClassItem> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 100));
      const found = mockClasses.find((c) => c.classId === classId);
      if (!found) throw new Error('Không tìm thấy lớp học');
      return {
        ...found,
        studentCount: (mockStudents[classId] || []).length
      };
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không tìm thấy lớp học');
    return data.class;
  },

  async createClass(token: string, name: string): Promise<ClassItem> {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Tên lớp không được để trống');

    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 200));
      const classId = `cls-${String(mockClasses.length + 1).padStart(2, '0')}`;
      const newClass: ClassItem = {
        classId,
        name: trimmedName,
        teacherId: 'teacher@example.com',
        collectionId: `facepass-${classId}`,
        createdAt: new Date().toISOString(),
        studentCount: 0
      };
      mockClasses = [newClass, ...mockClasses];
      mockStudents[classId] = [];
      mockSessions[classId] = [];
      return newClass;
    }

    const res = await fetch(`${API_BASE_URL}/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: trimmedName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi tạo lớp học');
    return data.class;
  },

  // =========================================================================
  // STUDENTS APIs (With GDPR Compliance Delete)
  // =========================================================================
  async getStudents(token: string, classId: string): Promise<StudentItem[]> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 150));
      return mockStudents[classId] || [];
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/students`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi tải danh sách sinh viên');
    return data.students || [];
  },

  async addStudent(
    token: string,
    classId: string,
    student: { studentId: string; fullName: string; email: string }
  ): Promise<StudentItem> {
    const stId = student.studentId.trim();
    const fullName = student.fullName.trim();
    const email = student.email.trim();

    if (!stId || !fullName) {
      throw new Error('Vui lòng điền đủ MSSV và Họ tên sinh viên');
    }

    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 200));
      const list = mockStudents[classId] || [];
      if (list.some((s) => s.studentId === stId)) {
        throw new Error(`Sinh viên có MSSV ${stId} đã tồn tại trong lớp`);
      }

      const newStudent: StudentItem = {
        classId,
        studentId: stId,
        fullName,
        email: email || `${stId.toLowerCase()}@student.edu.vn`,
        faceIds: [],
        updatedAt: new Date().toISOString()
      };
      mockStudents[classId] = [...list, newStudent];
      return newStudent;
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ studentId: stId, fullName, email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi thêm sinh viên');
    return data.student;
  },

  async importStudentsCsv(token: string, classId: string, csvContent: string): Promise<StudentItem[]> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 300));
      const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        throw new Error('File CSV không có dữ liệu sinh viên');
      }

      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const idIdx = header.findIndex((h) => h === 'mssv' || h === 'studentid');
      const nameIdx = header.findIndex((h) => h === 'hoten' || h === 'fullname' || h === 'ho va ten');
      const emailIdx = header.findIndex((h) => h === 'email');

      if (idIdx === -1 || nameIdx === -1) {
        throw new Error('File CSV thiếu cột bắt buộc: "MSSV" (hoặc studentId) và "HoTen" (hoặc fullName)');
      }

      const currentList = mockStudents[classId] || [];
      const imported: StudentItem[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const stId = cols[idIdx];
        const name = cols[nameIdx];
        const email = emailIdx !== -1 ? cols[emailIdx] : `${stId.toLowerCase()}@student.edu.vn`;

        if (stId && name && !currentList.some((s) => s.studentId === stId)) {
          const item: StudentItem = {
            classId,
            studentId: stId,
            fullName: name,
            email,
            faceIds: [],
            updatedAt: new Date().toISOString()
          };
          currentList.push(item);
          imported.push(item);
        }
      }

      mockStudents[classId] = currentList;
      return imported;
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ csv_data: csvContent })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi nhập dữ liệu CSV');
    return data.imported || [];
  },

  async deleteStudent(token: string, classId: string, studentId: string): Promise<void> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 200));
      const list = mockStudents[classId] || [];
      mockStudents[classId] = list.filter((s) => s.studentId !== studentId);
      return;
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/students/${studentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi khi xóa sinh viên');
  },

  // =========================================================================
  // S3 PRESIGNED POST UPLOAD UTILITY
  // Strict Order: Server fields first, file field LAST
  // =========================================================================
  async uploadToPresignedPost(presignedPost: PresignedPost, fileBlob: Blob): Promise<void> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 350));
      return;
    }

    // MANDATORY S3 RULE:
    // Append all server presigned fields FIRST, followed by 'file' LAST
    const formData = new FormData();
    Object.entries(presignedPost.fields).forEach(([key, val]) => {
      formData.append(key, val);
    });
    formData.append('file', fileBlob, 'photo.jpg');

    const res = await fetch(presignedPost.url, {
      method: 'POST',
      body: formData
    });

    if (!res.ok && res.status !== 204) {
      throw new Error(`Tải ảnh lên S3 thất bại với mã lỗi HTTP ${res.status}`);
    }
  },

  // =========================================================================
  // TASK 9: FACE ENROLLMENT APIs
  // =========================================================================
  async getEnrollmentUploadUrl(
    token: string,
    classId: string,
    studentId: string
  ): Promise<{ presignedPost: PresignedPost; s3Key: string }> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 150));
      const s3Key = `enrollments/teacher_demo/${classId}/${studentId}.jpg`;
      return {
        presignedPost: {
          url: 'https://facepass-photos-mock.s3.ap-southeast-1.amazonaws.com',
          fields: {
            key: s3Key,
            'Content-Type': 'image/jpeg',
            bucket: 'facepass-photos-mock'
          }
        },
        s3Key
      };
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/students/${studentId}/enrollment-url`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi cấp URL tải ảnh sinh trắc học');
    return data;
  },

  async processEnrollment(
    token: string,
    classId: string,
    studentId: string,
    consentAgreed: boolean,
    consentAt: string,
    s3Key: string
  ): Promise<{ message: string; faceIds: string[]; rawPhotoPurged: boolean }> {
    if (!consentAgreed) {
      throw new Error('Bắt buộc sinh viên phải đồng ý trước khi đăng ký khuôn mặt.');
    }

    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 400));
      const list = mockStudents[classId] || [];
      const student = list.find((s) => s.studentId === studentId);
      if (!student) throw new Error('Không tìm thấy sinh viên trong lớp');

      // Generate 2-3 mock biometric face identifiers
      const newFaceId = `face-biometric-${Date.now().toString(36)}`;
      student.faceIds = Array.from(new Set([...(student.faceIds || []), newFaceId]));
      student.consentAt = consentAt;
      student.updatedAt = new Date().toISOString();

      return {
        message: 'Đăng ký đặc trưng khuôn mặt thành công',
        faceIds: student.faceIds,
        rawPhotoPurged: true
      };
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/students/${studentId}/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        consentAgreed,
        consentAt,
        s3Key
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi xử lý trích xuất khuôn mặt');
    return data;
  },

  // =========================================================================
  // TASK 10: ATTENDANCE SCAN & CONFIRMATION APIs
  // =========================================================================
  async getAttendanceUploadUrl(
    token: string,
    classId: string
  ): Promise<{ presignedPost: PresignedPost; s3Key: string; sessionId: string }> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 150));
      const sessId = `sess-${Date.now().toString(36).slice(-6)}`;
      const s3Key = `attendance/teacher_demo/${classId}/${sessId}.jpg`;
      return {
        presignedPost: {
          url: 'https://facepass-photos-mock.s3.ap-southeast-1.amazonaws.com',
          fields: {
            key: s3Key,
            'Content-Type': 'image/jpeg',
            bucket: 'facepass-photos-mock'
          }
        },
        s3Key,
        sessionId: sessId
      };
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/attendance/upload-url`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi cấp URL tải ảnh lớp học');
    return data;
  },

  async scanAttendance(
    token: string,
    classId: string,
    sessionId: string,
    s3Key: string,
    photoCount = 1
  ): Promise<ScanResult> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 600)); // Simulate Rekognition multi-face processing latency
      const classItem = mockClasses.find((c) => c.classId === classId);
      const allStudents = mockStudents[classId] || [];

      // Multi-photo coverage simulation:
      // More angles give higher similarity and resolve uncertain students
      const present: AttendanceRecord[] = [];
      const uncertain: AttendanceRecord[] = [];
      const absent: AttendanceRecord[] = [];

      const enrolled = allStudents.filter((s) => s.faceIds && s.faceIds.length > 0);
      const notEnrolled = allStudents.filter((s) => !s.faceIds || s.faceIds.length === 0);

      enrolled.forEach((st, idx) => {
        // If single photo: student idx 0 has 84.7% similarity (uncertain)
        // If multiple photos: additional angles boost recognition, so idx 0 reaches 93.4% (present)
        if (photoCount === 1 && idx === 0 && enrolled.length > 2) {
          uncertain.push({
            studentId: st.studentId,
            fullName: st.fullName,
            email: st.email,
            status: 'uncertain',
            similarity: 84.7,
            boundingBox: { Width: 0.12, Height: 0.16, Left: 0.25, Top: 0.3 }
          });
        } else if (idx < enrolled.length - 1 || enrolled.length <= 2) {
          const boost = photoCount > 1 ? 2.5 : 0;
          const sim = Math.min(98.8, Math.round((92 + ((idx * 2.3) % 7) + boost) * 10) / 10);
          present.push({
            studentId: st.studentId,
            fullName: st.fullName,
            email: st.email,
            status: 'present',
            similarity: sim,
            boundingBox: { Width: 0.11, Height: 0.15, Left: 0.1 + idx * 0.18, Top: 0.35 }
          });
        } else {
          absent.push({
            studentId: st.studentId,
            fullName: st.fullName,
            email: st.email,
            status: 'absent',
            similarity: 0,
            boundingBox: null
          });
        }
      });

      // Students without registered faces are placed into absent
      notEnrolled.forEach((st) => {
        absent.push({
          studentId: st.studentId,
          fullName: st.fullName,
          email: st.email,
          status: 'absent',
          similarity: 0,
          boundingBox: null
        });
      });

      return {
        sessionId,
        classId,
        className: classItem?.name || 'Lớp học',
        scannedAt: new Date().toISOString(),
        summary: {
          totalEnrolled: allStudents.length,
          presentCount: present.length,
          uncertainCount: uncertain.length,
          absentCount: absent.length,
          unknownCount: 1
        },
        present,
        uncertain,
        absent,
        unknowns: [
          {
            confidence: 88.6,
            boundingBox: { Width: 0.1, Height: 0.14, Left: 0.8, Top: 0.4 }
          }
        ]
      };
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/attendance/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ sessionId, s3Key })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi quét nhận diện khuôn mặt');
    return data;
  },

  async confirmAttendance(
    token: string,
    classId: string,
    sessionId: string,
    records: AttendanceRecord[]
  ): Promise<AttendanceConfirmResult> {
    // MANDATORY RULE: Blocks confirmation if any student is still 'uncertain'
    const uncertainRemaining = records.filter((r) => r.status === 'uncertain');
    if (uncertainRemaining.length > 0) {
      throw new Error(
        `Không thể xác nhận buổi học khi vẫn còn ${uncertainRemaining.length} sinh viên ở nhóm 'Cần xác nhận'. Vui lòng phân loại hết trước khi xác nhận.`
      );
    }

    const absentStudents = records.filter((r) => r.status === 'absent');
    const presentStudents = records.filter((r) => r.status === 'present');
    const classItem = mockClasses.find((c) => c.classId === classId);

    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 400));

      // Save confirmed session into in-memory mock history with per-student SES status
      const nowIso = new Date().toISOString();
      const updatedRecords: AttendanceRecord[] = records.map((r) => {
        if (r.status === 'absent') {
          return {
            ...r,
            emailStatus: 'sent',
            emailSentAt: nowIso
          };
        }
        return r;
      });

      const newSession: SessionHistoryItem = {
        sessionId,
        classId,
        className: classItem?.name || 'Lớp học',
        startedAt: nowIso,
        status: 'confirmed',
        totalStudents: records.length,
        presentCount: presentStudents.length,
        absentCount: absentStudents.length,
        emailsSentAt: nowIso,
        records: updatedRecords
      };

      const existingSessions = mockSessions[classId] || [];
      mockSessions[classId] = [
        newSession,
        ...existingSessions.filter((s) => s.sessionId !== sessionId)
      ];

      return {
        message: `Điểm danh buổi học ${sessionId} đã được xác nhận chính thức`,
        sessionStatus: 'confirmed',
        emailsDispatched: absentStudents.length,
        emailsFailed: 0
      };
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/attendance/${sessionId}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ records })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi xác nhận điểm danh');
    return data;
  },

  async retryAbsenceEmail(
    token: string,
    classId: string,
    sessionId: string,
    studentId: string
  ): Promise<{ success: boolean; emailStatus: 'sent' | 'failed'; emailError?: string; emailSentAt?: string }> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 400));
      const sessions = mockSessions[classId] || [];
      const session = sessions.find((s) => s.sessionId === sessionId);
      if (!session) {
        throw new Error('Không tìm thấy buổi điểm danh trong bộ nhớ');
      }

      const record = session.records.find((r) => r.studentId === studentId);
      if (!record) {
        throw new Error('Không tìm thấy sinh viên trong buổi điểm danh này');
      }

      const nowIso = new Date().toISOString();
      record.emailStatus = 'sent';
      record.emailSentAt = nowIso;
      record.emailError = undefined;

      return {
        success: true,
        emailStatus: 'sent',
        emailSentAt: nowIso
      };
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/attendance/${sessionId}/retry-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ studentId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi gửi lại email cảnh báo');
    return data;
  },

  // =========================================================================
  // TASK 11: ATTENDANCE HISTORY & SECURE CSV EXPORT APIs
  // =========================================================================
  async getClassSessions(token: string, classId: string): Promise<SessionHistoryItem[]> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 200));
      return mockSessions[classId] || [];
    }

    // In production, fetch confirmed sessions for class
    const res = await fetch(`${API_BASE_URL}/classes/${classId}/attendance/sessions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  },

  async exportAttendanceCsv(token: string, classId: string, sessionId: string): Promise<string> {
    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 150));
      const classItem = mockClasses.find((c) => c.classId === classId);
      const session = (mockSessions[classId] || []).find((s) => s.sessionId === sessionId);

      const records = session?.records || (mockStudents[classId] || []).map((st) => ({
        studentId: st.studentId,
        fullName: st.fullName,
        email: st.email,
        status: 'present' as const,
        similarity: 95.0
      }));

      // Generate RFC 4180 CSV with UTF-8 BOM and formula injection protection
      return generateAttendanceCsv({
        sessionId,
        classId,
        className: classItem?.name || classId,
        sessionTime: session?.startedAt || new Date().toISOString(),
        records
      });
    }

    const res = await fetch(`${API_BASE_URL}/classes/${classId}/attendance/${sessionId}/export`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi xuất file CSV');
    return data.csv;
  }
};
