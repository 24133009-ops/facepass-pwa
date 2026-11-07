import { ClassItem, StudentItem, Teacher } from '../types';
import { INITIAL_CLASSES, INITIAL_STUDENTS } from './mockData';

const IS_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.VITE_USE_MOCK === true;
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// In-Memory Storage for Mock Mode (Preserved across SPA transitions)
let mockClasses: ClassItem[] = [...INITIAL_CLASSES];
let mockStudents: Record<string, StudentItem[]> = JSON.parse(JSON.stringify(INITIAL_STUDENTS));

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
  // =========================================================================
  async login(email: string, pass: string): Promise<LoginResult> {
    const trimmedEmail = email.trim().toLowerCase();

    if (IS_MOCK) {
      // Simulate network latency (250ms)
      await new Promise((r) => setTimeout(r, 250));

      // CASE A: User created by admin requiring initial password change (NEW_PASSWORD_REQUIRED)
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

    // Real AWS Cognito Auth Endpoint
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
      // Enforce Cognito Password Policy: min 8 chars, 1 uppercase, 1 lowercase, 1 number
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

    // Real API triggers GDPR DeleteFaces in Rekognition & DynamoDB delete
    const res = await fetch(`${API_BASE_URL}/classes/${classId}/students/${studentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi khi xóa sinh viên');
  }
};

