"""
Attendance scan, manual review confirmation, SES email dispatch, and CSV export.
Key Technical Implementations:
1. Enforces teacher class ownership (403 Forbidden).
2. Generates presigned POST with content-length-range <= 5MB and Content-Type image/jpeg.
3. Detects and crops each face using Pillow with +20% padding.
4. SearchFacesByImage for each cropped face.
5. Groups into Present (>=90%), Uncertain (80-90%), Absent, and Unknowns.
6. Deduplicates by studentId.
7. Confirmation rule: BLOCKS confirmation if any student is still in 'Uncertain' group.
8. Anti-duplicate check: Prevents repeated email sending if emailsSentAt is already set.
9. On confirm: sends SES email warnings to absent students and locks session.
"""
import json
import os
import uuid
import boto3
from datetime import datetime
from common.responses import success, error
from common.auth import get_teacher_id, verify_class_ownership
from common import dynamodb as db
from common import rekognition as rek
from common import ses_mailer as mailer

s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ap-southeast-1"))
PHOTO_BUCKET = os.environ.get("PHOTO_BUCKET", "")

def get_expected_prefix(teacher_id: str, class_id: str) -> str:
    safe_teacher = "".join(c if c.isalnum() or c in "-_." else "_" for c in teacher_id)
    return f"attendance/{safe_teacher}/{class_id}/"

def lambda_handler(event, context):
    http = event.get("requestContext", {}).get("http", {})
    http_method = http.get("method", "")
    path = event.get("rawPath", "")
    path_params = event.get("pathParameters", {}) or {}
    class_id = path_params.get("classId")
    session_id = path_params.get("sessionId")

    if not class_id:
        return error("Thiếu classId", 400)

    # 1. Enforce class ownership by teacher (Return 403 Forbidden if mismatched)
    teacher_id = get_teacher_id(event)
    is_owner, class_info = verify_class_ownership(teacher_id, class_id)
    if not is_owner:
        return error("Bạn không có quyền truy cập hoặc lớp học không tồn tại", 403)

    collection_id = class_info.get("collectionId", f"facepass-{class_id}")
    class_name = class_info.get("name", "Lớp học")

    try:
        expected_prefix = get_expected_prefix(teacher_id, class_id)

        # 1. GET Presigned POST Upload URL for Group Photo (<=5MB, image/jpeg)
        if path.endswith("/upload-url") and http_method == "GET":
            sess_uuid = str(uuid.uuid4())[:8]
            s3_key = f"{expected_prefix}{sess_uuid}.jpg"
            presigned_post = s3.generate_presigned_post(
                Bucket=PHOTO_BUCKET,
                Key=s3_key,
                Fields={
                    "Content-Type": "image/jpeg"
                },
                Conditions=[
                    ["content-length-range", 1000, 5242880], # Max 5MB
                    {"Content-Type": "image/jpeg"},
                    ["starts-with", "$key", expected_prefix]
                ],
                ExpiresIn=300
            )
            return success({
                "presignedPost": presigned_post,
                "s3Key": s3_key,
                "sessionId": sess_uuid
            })

        # 2. POST Scan Attendance Group Photo
        elif path.endswith("/scan") and http_method == "POST":
            body = json.loads(event.get("body", "{}"))
            s3_key = body.get("s3Key")
            sess_id = body.get("sessionId") or str(uuid.uuid4())[:8]

            if not s3_key:
                return error("Thiếu s3Key ảnh lớp học", 400)

            # Enforce S3 prefix ownership
            if not s3_key.startswith(expected_prefix):
                return error("Khóa ảnh s3Key không hợp lệ hoặc không thuộc phạm vi lớp học được phân quyền", 403)

            # Retrieve group photo bytes from S3
            try:
                s3_obj = s3.get_object(Bucket=PHOTO_BUCKET, Key=s3_key)
                group_photo_bytes = s3_obj["Body"].read()
            except Exception as e:
                return error(f"Không thể đọc ảnh lớp học từ S3: {str(e)}", 404)

            # Step 1: Detect all faces and crop with +20% padding using Pillow
            cropped_faces = rek.detect_and_crop_all_faces(group_photo_bytes, padding_ratio=0.20)

            # Step 2: Retrieve all enrolled students in class
            all_students = db.get_students_by_class(class_id)
            student_dict = {st["studentId"]: st for st in all_students}

            # Step 3: Match each cropped face against Rekognition Collection
            detected_matches = {} # studentId -> best match object
            unknown_faces = []

            for face in cropped_faces:
                match = rek.search_face_in_collection(collection_id, face["croppedBytes"], threshold=80.0)
                if match:
                    st_id = match["studentId"]
                    sim = match["similarity"]
                    # Deduplicate: if duplicate detection, keep higher similarity
                    if st_id not in detected_matches or sim > detected_matches[st_id]["similarity"]:
                        detected_matches[st_id] = {
                            "studentId": st_id,
                            "similarity": sim,
                            "boundingBox": face["boundingBox"]
                        }
                else:
                    unknown_faces.append({
                        "boundingBox": face["boundingBox"],
                        "confidence": face["confidence"]
                    })

            # Step 4: Classify into Present (>=90%), Uncertain (80-90%), and Absent
            present_list = []
            uncertain_list = []
            matched_ids = set()

            for st_id, match_data in detected_matches.items():
                st_info = student_dict.get(st_id, {})
                full_name = st_info.get("fullName", st_id)
                email = st_info.get("email", "")
                sim = match_data["similarity"]
                matched_ids.add(st_id)

                record = {
                    "studentId": st_id,
                    "fullName": full_name,
                    "email": email,
                    "similarity": sim,
                    "boundingBox": match_data["boundingBox"]
                }

                if sim >= 90.0:
                    record["status"] = "present"
                    present_list.append(record)
                else:
                    record["status"] = "uncertain"
                    uncertain_list.append(record)

            # Absent: enrolled students not matched
            absent_list = []
            for st in all_students:
                st_id = st["studentId"]
                if st_id not in matched_ids:
                    absent_list.append({
                        "studentId": st_id,
                        "fullName": st.get("fullName", st_id),
                        "email": st.get("email", ""),
                        "status": "absent",
                        "similarity": 0.0,
                        "boundingBox": None
                    })

            # Save draft session in DynamoDB
            db.save_session(class_id, sess_id, status="draft")

            return success({
                "sessionId": sess_id,
                "classId": class_id,
                "className": class_name,
                "scannedAt": datetime.now().isoformat(),
                "summary": {
                    "totalEnrolled": len(all_students),
                    "presentCount": len(present_list),
                    "uncertainCount": len(uncertain_list),
                    "absentCount": len(absent_list),
                    "unknownCount": len(unknown_faces)
                },
                "present": present_list,
                "uncertain": uncertain_list,
                "absent": absent_list,
                "unknowns": unknown_faces
            })

        # 3. POST Confirm Attendance & Dispatch SES Emails
        elif "/confirm" in path and http_method == "POST":
            if not session_id:
                return error("Thiếu sessionId", 400)

            session_info = db.get_session(class_id, session_id)
            if not session_info:
                return error("Không tìm thấy buổi học", 404)

            # Anti-duplicate check: prevent duplicate email dispatches
            if session_info.get("status") == "confirmed" and session_info.get("emailsSentAt"):
                return error("Buổi học này đã được xác nhận và đã gửi email cảnh báo trước đó.", 400)

            body = json.loads(event.get("body", "{}"))
            confirmed_records = body.get("records", [])
            if not confirmed_records:
                return error("Danh sách xác nhận không được để trống", 400)

            # MANDATORY RULE: Must resolve all 'uncertain' students before confirming
            uncertain_records = [r for r in confirmed_records if r.get("status") == "uncertain"]
            if uncertain_records:
                return error(
                    f"Không thể xác nhận buổi học khi vẫn còn {len(uncertain_records)} sinh viên ở nhóm 'Cần xác nhận'. "
                    "Giảng viên vui lòng phân loại hết sang 'Có mặt' hoặc 'Vắng mặt' trước khi gửi thông báo.",
                    400
                )

            # Save confirmed attendance in DynamoDB
            db.save_attendance_batch(session_id, confirmed_records)

            # Filter absent students for SES dispatch
            absent_students = [r for r in confirmed_records if r.get("status") == "absent"]
            session_time_str = datetime.now().strftime("%H:%M ngày %d/%m/%Y")

            dispatch_res = mailer.dispatch_batch_absence_emails(
                absent_students=absent_students,
                class_name=class_name,
                session_time=session_time_str
            )

            # Mark session confirmed and record email dispatch timestamp
            now_iso = datetime.now().isoformat()
            db.mark_session_confirmed(class_id, session_id, emails_sent_at=now_iso)

            return success({
                "message": f"Điểm danh buổi học {session_id} đã được xác nhận chính thức",
                "sessionStatus": "confirmed",
                "emailsDispatched": dispatch_res["success"],
                "emailsFailed": dispatch_res["failed"]
            })

        # 4. GET Export Attendance to CSV
        elif "/export" in path and http_method == "GET":
            if not session_id:
                return error("Thiếu sessionId", 400)

            records = db.get_session_attendance(session_id)
            csv_lines = ["MSSV,Ho va Ten,Email,Trang Thai,Do Tuong Dong,Xac Nhan Boi,Thoi Gian"]
            for r in records:
                st_id = r.get("studentId", "")
                name = r.get("fullName", "")
                email = r.get("email", "")
                st = r.get("status", "")
                sim = r.get("similarity", "0")
                conf_by = r.get("confirmedBy", "")
                ts = r.get("updatedAt", "")
                csv_lines.append(f'"{st_id}","{name}","{email}","{st}","{sim}%","{conf_by}","{ts}"')

            return success({
                "sessionId": session_id,
                "csv": "\n".join(csv_lines)
            })

        return error(f"Unsupported path or method {http_method} {path}", 404)

    except Exception as e:
        print(f"Error in attendance_handler: {str(e)}")
        return error(str(e), 500)
