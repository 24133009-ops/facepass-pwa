"""Student management handler (List students, Add, Import CSV, GDPR Delete)."""
import json
import csv
import io
from common.responses import success, error
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

    class_info = db.get_class(class_id)
    if not class_info:
        return error("Không tìm thấy lớp học", 404)

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
                for row in reader:
                    st_id = (row.get("studentId") or row.get("MSSV") or "").strip()
                    full_name = (row.get("fullName") or row.get("HoTen") or "").strip()
                    email = (row.get("email") or row.get("Email") or "").strip()
                    if st_id and full_name:
                        st_item = db.save_student(class_id, st_id, full_name, email)
                        imported.append(st_item)
                return success({"message": f"Đã nhập thành công {len(imported)} sinh viên", "imported": imported})

            # Case B: Single Student
            st_id = body.get("studentId", "").strip()
            full_name = body.get("fullName", "").strip()
            email = body.get("email", "").strip()

            if not st_id or not full_name:
                return error("Vui lòng điền MSSV và họ tên sinh viên", 400)

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
                rek.delete_student_faces_from_collection(collection_id, face_ids)

            # Delete record from DynamoDB
            db.delete_student(class_id, student_id)
            return success({"message": f"Đã xóa toàn bộ dữ liệu sinh trắc học và hồ sơ của sinh viên {student_id}"})

        return error(f"Unsupported method {http_method}", 405)

    except Exception as e:
        print(f"Error in students_handler: {str(e)}")
        return error(str(e), 500)

