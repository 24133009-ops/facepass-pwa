/**
 * CSV Helper Utility for FacePass PWA
 * Guarantees:
 * 1. UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility with Vietnamese characters.
 * 2. Anti-CSV Injection (Formula Injection Prevention):
 *    Prefixes dangerous characters (=, +, -, @, \t, \r, \n) with a single quote (').
 * 3. Proper double-quote escaping.
 */

import { AttendanceRecord } from '../types';

/**
 * Sanitizes a single cell value against CSV formula injection
 * Rule: If cell begins with =, +, -, @, tab, \r, or \n, prepend a single quote (').
 */
export function sanitizeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Check if string begins with any injection triggers
  const firstChar = str.charAt(0);
  if (['=', '+', '-', '@', '\t', '\r', '\n'].includes(firstChar)) {
    str = `'${str}`;
  }

  // Escape internal double quotes by doubling them: " -> ""
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export interface SessionCsvData {
  sessionId: string;
  classId: string;
  className: string;
  sessionTime: string;
  records: AttendanceRecord[];
}

/**
 * Generates RFC 4180 compliant CSV string with UTF-8 BOM and anti-injection protection.
 */
export function generateAttendanceCsv(data: SessionCsvData): string {
  const BOM = '\uFEFF'; // UTF-8 BOM for Microsoft Excel

  const headers = [
    'MSSV',
    'Ho va Ten',
    'Email',
    'Trang Thai',
    'Do Tuong Dong AI',
    'Mon Hoc',
    'Ma Lop',
    'Ma Buoi Hoc',
    'Thoi Gian Diem Danh'
  ];

  const headerLine = headers.map(sanitizeCsvField).join(',');

  const rows = data.records.map((r) => {
    const statusText =
      r.status === 'present'
        ? 'Có mặt'
        : r.status === 'uncertain'
        ? 'Cần xác nhận'
        : 'Vắng mặt';

    const similarityText =
      r.status === 'present' || r.status === 'uncertain'
        ? `${r.similarity}%`
        : '0%';

    return [
      sanitizeCsvField(r.studentId),
      sanitizeCsvField(r.fullName),
      sanitizeCsvField(r.email),
      sanitizeCsvField(statusText),
      sanitizeCsvField(similarityText),
      sanitizeCsvField(data.className),
      sanitizeCsvField(data.classId),
      sanitizeCsvField(data.sessionId),
      sanitizeCsvField(data.sessionTime)
    ].join(',');
  });

  return `${BOM}${headerLine}\r\n${rows.join('\r\n')}`;
}

/**
 * Initiates browser file download for generated CSV
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

