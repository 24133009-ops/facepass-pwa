export interface Teacher {
  email: string;
  name?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  teacher: Teacher | null;
  token: string | null; // Stored exclusively in MEMORY, NEVER in localStorage
  isNewPasswordRequired: boolean;
  tempSession: string | null;
}

export interface ClassItem {
  classId: string;
  name: string;
  teacherId: string;
  collectionId: string;
  createdAt: string;
  studentCount?: number;
}

export interface StudentItem {
  classId: string;
  studentId: string;
  fullName: string;
  email: string;
  faceIds: string[];
  consentAt?: string;
  updatedAt?: string;
}

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

export interface AttendanceRecord {
  studentId: string;
  fullName: string;
  email: string;
  status: 'present' | 'uncertain' | 'absent';
  similarity: number;
  boundingBox?: {
    Width: number;
    Height: number;
    Left: number;
    Top: number;
  } | null;
}

export interface UnknownFace {
  confidence: number;
  boundingBox?: {
    Width: number;
    Height: number;
    Left: number;
    Top: number;
  } | null;
}

export interface AttendanceSession {
  sessionId: string;
  classId: string;
  className: string;
  startedAt?: string;
  status: 'draft' | 'confirmed';
  emailsSentAt?: string | null;
}

export interface ScanResult {
  sessionId: string;
  classId: string;
  className: string;
  scannedAt: string;
  summary: {
    totalEnrolled: number;
    presentCount: number;
    uncertainCount: number;
    absentCount: number;
    unknownCount: number;
  };
  present: AttendanceRecord[];
  uncertain: AttendanceRecord[];
  absent: AttendanceRecord[];
  unknowns: UnknownFace[];
}

export interface AttendanceConfirmResult {
  message: string;
  sessionStatus: string;
  emailsDispatched: number;
  emailsFailed: number;
}
