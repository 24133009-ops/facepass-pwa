import React, { useState, useMemo } from 'react';
import { UploadCloud, FileText, CheckCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { validateCsvContent } from '../../utils/validators';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (csvContent: string) => Promise<void>;
  isLoading: boolean;
}

const SAMPLE_CSV = `MSSV,HoTen,Email
20110020,Phan Đình Phùng,phung.phan@student.edu.vn
20110021,Lê Thị Riêng,rieng.le@student.edu.vn
20110022,Nguyễn Tri Phương,phuong.nguyen@student.edu.vn`;

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  isOpen,
  onClose,
  onImport,
  isLoading
}) => {
  const [csvContent, setCsvContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvContent(text);
        setError(null);
      }
    };
    reader.onerror = () => {
      setError('Lỗi đọc file CSV từ thiết bị');
    };
    reader.readAsText(file);
  };

  const handleInsertSample = () => {
    setCsvContent(SAMPLE_CSV);
    setError(null);
  };

  const validation = useMemo(() => {
    if (!csvContent.trim()) {
      return { totalRows: 0, validRows: [], invalidRows: [] };
    }
    return validateCsvContent(csvContent);
  }, [csvContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) {
      setError('Vui lòng chọn file CSV hoặc dán nội dung CSV');
      return;
    }

    if (validation.invalidRows.length > 0) {
      setError(
        `Phát hiện ${validation.invalidRows.length} dòng có lỗi định dạng email hoặc thiếu thông tin. Vui lòng sửa lại trước khi nhập.`
      );
      return;
    }

    if (validation.validRows.length === 0) {
      setError('Không tìm thấy dữ liệu sinh viên hợp lệ trong file CSV');
      return;
    }

    try {
      setError(null);
      await onImport(csvContent);
      setCsvContent('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nhập CSV thất bại');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nhập Danh Sách Từ File CSV">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            1. Chọn file CSV từ máy tính / điện thoại
          </label>
          <label className="flex flex-col items-center justify-center w-full min-h-[96px] border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 rounded-2xl cursor-pointer transition-colors p-4 text-center">
            <UploadCloud className="w-8 h-8 text-blue-600 mb-1" />
            <span className="text-sm font-semibold text-slate-800">
              Nhấn để chọn file .csv
            </span>
            <span className="text-xs text-slate-500 mt-0.5">Hỗ trợ mã UTF-8 có dấu tiếng Việt</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="block text-sm font-semibold text-slate-700">
            2. Hoặc dán trực tiếp nội dung CSV
          </label>
          <button
            type="button"
            onClick={handleInsertSample}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mẫu demo</span>
          </button>
        </div>

        <div>
          <textarea
            rows={5}
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            placeholder="MSSV,HoTen,Email&#10;20110001,Nguyen Van A,a@student.edu.vn"
            className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 leading-relaxed"
          />
        </div>

        {validation.invalidRows.length > 0 && (
          <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-red-700">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Phát hiện {validation.invalidRows.length} dòng có lỗi định dạng:</span>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] pl-1 pr-1">
              {validation.invalidRows.map((row) => (
                <div key={row.rowNumber} className="bg-white/80 p-1.5 rounded border border-red-200/60">
                  <span className="font-bold text-red-700">Dòng {row.rowNumber}:</span>{' '}
                  <span className="text-slate-700">{row.errors.join('; ')}</span>{' '}
                  <span className="text-slate-400">({row.studentId || 'Trống MSSV'}, {row.email || 'Trống Email'})</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-red-600 italic">
              Vui lòng sửa các dòng trên (đặc biệt định dạng email) để đảm bảo sinh viên nhận được thông báo vắng học.
            </p>
          </div>
        )}

        {validation.validRows.length > 0 && validation.invalidRows.length === 0 && (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Đã kiểm tra hợp lệ {validation.validRows.length} sinh viên (MSSV, Họ tên, Email chuẩn)
            </span>
          </div>
        )}

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
          <div className="flex items-center gap-1 font-semibold text-slate-700">
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Định dạng cột hỗ trợ:</span>
          </div>
          <p className="font-mono text-[11px] text-slate-700">
            MSSV, HoTen, Email
          </p>
        </div>

        <div className="pt-2 space-y-2">
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!csvContent.trim() || validation.invalidRows.length > 0 || validation.validRows.length === 0}
            size="lg"
          >
            {validation.invalidRows.length > 0
              ? `Vui Lòng Sửa ${validation.invalidRows.length} Dòng Lỗi`
              : `Xác Nhận Nhập ${validation.validRows.length > 0 ? `${validation.validRows.length} Sinh Viên` : ''}`}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} size="lg">
            Hủy Bỏ
          </Button>
        </div>
      </form>
    </Modal>
  );
};

