"""Student management handler (List students, Add, Import CSV, GDPR Delete)."""
import json
import csv
import io
from common.responses import success, error
from common.auth import get_teacher_id, verify_class_ownership
from common.validators import is_valid_email
from common.log_utils import log_error
from common import dynamodb as db
from common import rekognition as rek

def lambda_handler(event, context):
    http = event.get("requestContext", {}).get("http", {})
    http_method = http.get("method", "")
    path_params = event.get("pathParameters", {}) or {}
    class_id = path_params.get("classId")
    student_id = path_params.get("studentId")

    if not class_id:
        return error("Thiếu classId", 400)

    # 1. Enforce class ownership by teacher (Return 403 Forbidden if mismatched)
    teacher_id = get_teacher_id(event)
    is_owner, class_info = verify_class_ownership(teacher_id, class_id)
    if not is_owner:
        return error("Bạn không có quyền truy cập hoặc lớp học không tồn tại", 403)

    collection_id = class_info.get("collectionId", f"facepass-{class_id}")

    try:
        # 1. GET Students
        if http_method == "GET":
            students = db.get_students_by_class(class_id)
            return success({"students": students})

        # 2. POST Add Student or Import CSV
        elif http_method == "POST":
            body = json.loads(event.get("body", "{}"))

            # Case A: Batch CSV Import
            csv_data = body.get("csv_data")
            if csv_data:
                reader = csv.DictReader(io.StringIO(csv_data))
                imported = []
                invalid_rows = []
                row_idx = 2
                for row in reader:
                    st_id = (row.get("studentId") or row.get("MSSV") or "").strip()
                    full_name = (row.get("fullName") or row.get("HoTen") or "").strip()
                    email = (row.get("email") or row.get("Email") or "").strip()
                    if not st_id or not full_name:
                        invalid_rows.append(f"Dòng {row_idx}: Thiếu MSSV hoặc Họ tên")
                    elif email and not is_valid_email(email):
                        invalid_rows.append(f"Dòng {row_idx}: Email '{email}' không đúng định dạng")
                    else:
                        st_item = db.save_student(class_id, st_id, full_name, email)
                        imported.append(st_item)
                    row_idx += 1

                if invalid_rows and not imported:
                    return error(f"Nhập thất bại do lỗi định dạng: {'; '.join(invalid_rows)}", 400)

                return success({
                    "message": f"Đã nhập thành công {len(imported)} sinh viên",
                    "imported": imported,
                    "warnings": invalid_rows
                })

            # Case B: Single Student
            st_id = body.get("studentId", "").strip()
            full_name = body.get("fullName", "").strip()
            email = body.get("email", "").strip()

            if not st_id or not full_name:
                return error("Vui lòng điền MSSV và họ tên sinh viên", 400)

            if email and not is_valid_email(email):
                return error(f"Email '{email}' không đúng định dạng chuẩn", 400)

            st_item = db.save_student(class_id, st_id, full_name, email)
            return success({"message": "Thêm sinh viên thành công", "student": st_item}, 201)

        # 3. DELETE Student (Right to Erasure / GDPR Compliance)
        elif http_method == "DELETE":
            if not student_id:
                return error("Thiếu studentId cần xóa", 400)

            st_info = db.get_student(class_id, student_id)
            if not st_info:
                return error("Không tìm thấy sinh viên", 404)

            face_ids = st_info.get("faceIds", [])
            # Delete biometric vectors from Rekognition collection
            if face_ids:
                deleted = rek.delete_student_faces_from_collection(collection_id, face_ids)
                if not deleted:
                    return error("Không thể xóa đặc trưng sinh trắc học khuôn mặt từ Amazon Rekognition", 502)

            # Delete record from DynamoDB
            db.delete_student(class_id, student_id)
            return success({"message": f"Đã xóa toàn bộ dữ liệu sinh trắc học và hồ sơ của sinh viên {student_id}"})

        return error(f"Unsupported method {http_method}", 405)

    except Exception as e:
        log_error("STUDENTS_ERROR", e, context)
        return error(str(e), 500)
