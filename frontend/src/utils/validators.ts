/**
 * Email and CSV validation utilities for FacePass PWA
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const isValidEmail = (email: string): boolean => {
  if (!email) return false;
  return EMAIL_REGEX.test(email.trim());
};

export interface CsvRowValidation {
  rowNumber: number;
  studentId: string;
  fullName: string;
  email: string;
  isValid: boolean;
  errors: string[];
}

export interface CsvValidationResult {
  totalRows: number;
  validRows: CsvRowValidation[];
  invalidRows: CsvRowValidation[];
}

/**
 * Validates CSV content line by line, ensuring MSSV, Full Name, and Email are correct.
 * Flags exact line numbers of invalid emails or missing data.
 */
export const validateCsvContent = (content: string): CsvValidationResult => {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const validRows: CsvRowValidation[] = [];
  const invalidRows: CsvRowValidation[] = [];

  lines.forEach((line, index) => {
    const rowNumber = index + 1;
    const lower = line.toLowerCase();

    // Skip standard CSV header row
    if (
      index === 0 &&
      (lower.includes('mssv') ||
        lower.includes('email') ||
        lower.includes('ho ten') ||
        lower.includes('hoten') ||
        lower.includes('student'))
    ) {
      return;
    }

    // Split by comma, semicolon or tab, trimming quotes
    const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
    const studentId = parts[0] || '';
    const fullName = parts[1] || '';
    const email = parts[2] || '';

    const errors: string[] = [];

    if (!studentId) {
      errors.push('Thiếu MSSV');
    }
    if (!fullName) {
      errors.push('Thiếu Họ và Tên');
    }
    if (!email) {
      errors.push('Thiếu địa chỉ Email');
    } else if (!isValidEmail(email)) {
      errors.push(`Email "${email}" không đúng định dạng chuẩn`);
    }

    const rowObj: CsvRowValidation = {
      rowNumber,
      studentId,
      fullName,
      email,
      isValid: errors.length === 0,
      errors
    };

    if (errors.length === 0) {
      validRows.push(rowObj);
    } else {
      invalidRows.push(rowObj);
    }
  });

  return {
    totalRows: validRows.length + invalidRows.length,
    validRows,
    invalidRows
  };
};

