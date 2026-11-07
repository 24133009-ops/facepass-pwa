import { ClassItem, StudentItem, SessionHistoryItem } from '../types';

export const INITIAL_CLASSES: ClassItem[] = [
  {
    classId: 'cls-01',
    name: 'Điện toán đám mây - IT001',
    teacherId: 'teacher@example.com',
    collectionId: 'facepass-cls-01',
    createdAt: '2026-11-01T08:00:00Z',
    studentCount: 5
  },
  {
    classId: 'cls-02',
    name: 'Học máy ứng dụng - IT002',
    teacherId: 'teacher@example.com',
    collectionId: 'facepass-cls-02',
    createdAt: '2026-11-02T09:30:00Z',
    studentCount: 4
  },
  {
    classId: 'cls-03',
    name: 'An toàn bảo mật thông tin - IT003',
    teacherId: 'teacher@example.com',
    collectionId: 'facepass-cls-03',
    createdAt: '2026-11-03T13:30:00Z',
    studentCount: 3
  }
];

export const INITIAL_STUDENTS: Record<string, StudentItem[]> = {
  'cls-01': [
    {
      classId: 'cls-01',
      studentId: '20110001',
      fullName: 'Nguyễn Văn An',
      email: 'an.nguyen2011@student.edu.vn',
      faceIds: ['face-uuid-001'],
      consentAt: '2026-11-01T08:30:00Z',
      updatedAt: '2026-11-01T08:30:00Z'
    },
    {
      classId: 'cls-01',
      studentId: '20110002',
      fullName: 'Trần Thị Bích',
      email: 'bich.tran2011@student.edu.vn',
      faceIds: ['face-uuid-002'],
      consentAt: '2026-11-01T08:35:00Z',
      updatedAt: '2026-11-01T08:35:00Z'
    },
    {
      classId: 'cls-01',
      studentId: '20110003',
      fullName: 'Lê Hoàng Cường',
      email: 'cuong.le2011@student.edu.vn',
      faceIds: [], // Chưa đăng ký khuôn mặt
      consentAt: undefined,
      updatedAt: '2026-11-01T08:00:00Z'
    },
    {
      classId: 'cls-01',
      studentId: '20110004',
      fullName: 'Phạm Minh Đức',
      email: 'duc.pham2011@student.edu.vn',
      faceIds: ['face-uuid-004'],
      consentAt: '2026-11-01T08:40:00Z',
      updatedAt: '2026-11-01T08:40:00Z'
    },
    {
      classId: 'cls-01',
      studentId: '20110005',
      fullName: 'Đặng Thu Hà',
      email: 'ha.dang2011@student.edu.vn',
      faceIds: [], // Chưa đăng ký khuôn mặt
      consentAt: undefined,
      updatedAt: '2026-11-01T08:00:00Z'
    }
  ],
  'cls-02': [
    {
      classId: 'cls-02',
      studentId: '20110006',
      fullName: 'Vũ Quốc Hưng',
      email: 'hung.vu@student.edu.vn',
      faceIds: ['face-uuid-006'],
      consentAt: '2026-11-02T10:00:00Z',
      updatedAt: '2026-11-02T10:00:00Z'
    },
    {
      classId: 'cls-02',
      studentId: '20110007',
      fullName: 'Bùi Lan Hương',
      email: 'huong.bui@student.edu.vn',
      faceIds: ['face-uuid-007'],
      consentAt: '2026-11-02T10:05:00Z',
      updatedAt: '2026-11-02T10:05:00Z'
    }
  ],
  'cls-03': [
    {
      classId: 'cls-03',
      studentId: '20110008',
      fullName: 'Đỗ Tiến Khoa',
      email: 'khoa.do@student.edu.vn',
      faceIds: ['face-uuid-008'],
      consentAt: '2026-11-03T14:00:00Z',
      updatedAt: '2026-11-03T14:00:00Z'
    }
  ]
};

export const INITIAL_SESSIONS: Record<string, SessionHistoryItem[]> = {
  'cls-01': [
    {
      sessionId: 'sess-20261105-01',
      classId: 'cls-01',
      className: 'Điện toán đám mây - IT001',
      startedAt: '2026-11-05T08:00:00Z',
      status: 'confirmed',
      totalStudents: 5,
      presentCount: 4,
      absentCount: 1,
      emailsSentAt: '2026-11-05T08:15:20Z',
      records: [
        { studentId: '20110001', fullName: 'Nguyễn Văn An', email: 'an.nguyen2011@student.edu.vn', status: 'present', similarity: 96.4 },
        { studentId: '20110002', fullName: 'Trần Thị Bích', email: 'bich.tran2011@student.edu.vn', status: 'present', similarity: 93.8 },
        { studentId: '20110003', fullName: 'Lê Hoàng Cường', email: 'cuong.le2011@student.edu.vn', status: 'absent', similarity: 0 },
        { studentId: '20110004', fullName: 'Phạm Minh Đức', email: 'duc.pham2011@student.edu.vn', status: 'present', similarity: 91.2 },
        { studentId: '20110005', fullName: 'Đặng Thu Hà', email: 'ha.dang2011@student.edu.vn', status: 'present', similarity: 90.5 }
      ]
    },
    {
      sessionId: 'sess-20261101-01',
      classId: 'cls-01',
      className: 'Điện toán đám mây - IT001',
      startedAt: '2026-11-01T08:00:00Z',
      status: 'confirmed',
      totalStudents: 5,
      presentCount: 3,
      absentCount: 2,
      emailsSentAt: '2026-11-01T08:14:10Z',
      records: [
        { studentId: '20110001', fullName: 'Nguyễn Văn An', email: 'an.nguyen2011@student.edu.vn', status: 'present', similarity: 97.1 },
        { studentId: '20110002', fullName: 'Trần Thị Bích', email: 'bich.tran2011@student.edu.vn', status: 'present', similarity: 94.6 },
        { studentId: '20110003', fullName: 'Lê Hoàng Cường', email: 'cuong.le2011@student.edu.vn', status: 'absent', similarity: 0 },
        { studentId: '20110004', fullName: 'Phạm Minh Đức', email: 'duc.pham2011@student.edu.vn', status: 'present', similarity: 95.0 },
        { studentId: '20110005', fullName: 'Đặng Thu Hà', email: 'ha.dang2011@student.edu.vn', status: 'absent', similarity: 0 }
      ]
    }
  ]
};
