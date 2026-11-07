"""
Comprehensive unit test suite verifying all Task 4-5 security and business logic rules:
1. 403 Forbidden on ALL 4 handlers when teacher does not own the class.
2. Missing consent is blocked (403).
3. S3 photo is permanently purged after IndexFaces.
4. DeleteFaces is called when a student is deleted (GDPR Right to Erasure).
5. Confirmation is blocked (400) when any student remains in 'Uncertain' group.
6. Anti-duplicate email dispatch prevention via emailsSentAt.
7. Presigned POST enforces content-length-range <= 5MB and Content-Type: image/jpeg.
"""
import unittest
from unittest.mock import patch, MagicMock
import json
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
from handlers import classes_handler, students_handler, enrollment_handler, attendance_handler
from common import mailer

class TestAllHandlersAndRules(unittest.TestCase):

    # =========================================================================
    # 1. Ownership 403 Verification on ALL 4 Handlers
    # =========================================================================
    @patch("handlers.classes_handler.verify_class_ownership")
    def test_classes_handler_ownership_403(self, mock_verify):
        mock_verify.return_value = (False, None) # Teacher does not own class
        event = {
            "requestContext": {"http": {"method": "GET"}},
            "pathParameters": {"classId": "cls-unowned"}
        }
        res = classes_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 403)
        self.assertIn("không có quyền", json.loads(res["body"])["error"])

    @patch("handlers.students_handler.verify_class_ownership")
    def test_students_handler_ownership_403(self, mock_verify):
        mock_verify.return_value = (False, None)
        event = {
            "requestContext": {"http": {"method": "GET"}},
            "pathParameters": {"classId": "cls-unowned"}
        }
        res = students_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 403)
        self.assertIn("không có quyền", json.loads(res["body"])["error"])

    @patch("handlers.enrollment_handler.verify_class_ownership")
    def test_enrollment_handler_ownership_403(self, mock_verify):
        mock_verify.return_value = (False, None)
        event = {
            "requestContext": {"http": {"method": "GET"}},
            "pathParameters": {"classId": "cls-unowned", "studentId": "SV01"}
        }
        res = enrollment_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 403)
        self.assertIn("không có quyền", json.loads(res["body"])["error"])

    @patch("handlers.attendance_handler.verify_class_ownership")
    def test_attendance_handler_ownership_403(self, mock_verify):
        mock_verify.return_value = (False, None)
        event = {
            "requestContext": {"http": {"method": "GET"}},
            "pathParameters": {"classId": "cls-unowned"}
        }
        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 403)
        self.assertIn("không có quyền", json.loads(res["body"])["error"])

    # =========================================================================
    # 2. GDPR Right to Erasure: DeleteFaces on Student Delete
    # =========================================================================
    @patch("handlers.students_handler.verify_class_ownership")
    @patch("handlers.students_handler.db.get_student")
    @patch("handlers.students_handler.db.delete_student")
    @patch("handlers.students_handler.rek.delete_student_faces_from_collection")
    def test_delete_student_calls_delete_faces_in_rekognition(self, mock_del_faces, mock_db_del, mock_get_st, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {
            "studentId": "SV01",
            "faceIds": ["face-id-1", "face-id-2"] # Has 2 registered biometric faces
        }

        event = {
            "requestContext": {"http": {"method": "DELETE"}},
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"}
        }
        res = students_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)

        # Assert Rekognition delete_faces was called with the student's faceIds
        mock_del_faces.assert_called_with("facepass-cls-01", ["face-id-1", "face-id-2"])
        # Assert DynamoDB delete was called
        mock_db_del.assert_called_with("cls-01", "SV01")

    # =========================================================================
    # 3. Missing Consent Blocked (403) & S3 Raw Photo Purged in Finally
    # =========================================================================
    @patch("handlers.enrollment_handler.verify_class_ownership")
    @patch("handlers.enrollment_handler.db.get_student")
    def test_tampered_s3_key_prefix_rejected_403(self, mock_get_st, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {"studentId": "SV01", "fullName": "Nguyen Van A"}

        event = {
            "requestContext": {
                "http": {"method": "POST"},
                "authorizer": {"jwt": {"claims": {"email": "teacher1@example.com"}}}
            },
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"},
            "body": json.dumps({
                "consentAgreed": True,
                "consentAt": "2026-11-06T14:00:00Z",
                "s3Key": "enrollments/other_teacher/other_class/SV01.jpg" # TAMPERED PREFIX!
            })
        }
        res = enrollment_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 403)
        self.assertIn("không thuộc phạm vi", json.loads(res["body"])["error"])

    @patch("handlers.enrollment_handler.verify_class_ownership")
    @patch("handlers.enrollment_handler.db.get_student")
    @patch("handlers.enrollment_handler.rek.index_student_face")
    @patch("handlers.enrollment_handler.s3")
    def test_s3_photo_purged_in_finally_even_on_indexing_error(self, mock_s3, mock_index, mock_get_st, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {"studentId": "SV01", "fullName": "Nguyen Van A", "faceIds": []}
        mock_index.return_value = ([], "Ảnh quá mờ. Vui lòng chụp lại.") # Quality check rejected!
        mock_s3.get_object.return_value = {"Body": MagicMock(read=lambda: b"fake-jpeg-bytes")}

        teacher_id = "teacher@example.com"
        expected_key = "enrollments/teacher_example.com/cls-01/SV01.jpg"

        event = {
            "requestContext": {
                "http": {"method": "POST"},
                "authorizer": {"jwt": {"claims": {"email": teacher_id}}}
            },
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"},
            "body": json.dumps({
                "consentAgreed": True,
                "consentAt": "2026-11-06T14:00:00Z",
                "s3Key": expected_key
            })
        }
        res = enrollment_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 400)
        self.assertIn("Ảnh quá mờ", json.loads(res["body"])["error"])
        # CRITICAL: Verify s3.delete_object was still called in FINALLY block!
        mock_s3.delete_object.assert_called_with(
            Bucket=os.environ.get("PHOTO_BUCKET", ""),
            Key=expected_key
        )

    # =========================================================================
    # 3b. Classes Handler: Listing Classes Only Returns Teacher's Own Classes
    # =========================================================================
    @patch("handlers.classes_handler.db.get_classes_by_teacher")
    def test_classes_list_strictly_scoped_to_jwt_teacher(self, mock_get_classes):
        mock_get_classes.return_value = [
            {"classId": "cls-01", "name": "Class 1", "teacherId": "teacher1@example.com"}
        ]
        event = {
            "requestContext": {
                "http": {"method": "GET"},
                "authorizer": {"jwt": {"claims": {"email": "teacher1@example.com"}}}
            }
        }
        res = classes_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        classes = json.loads(res["body"])["classes"]
        self.assertEqual(len(classes), 1)
        self.assertEqual(classes[0]["teacherId"], "teacher1@example.com")
        mock_get_classes.assert_called_with("teacher1@example.com")
    @patch("handlers.enrollment_handler.verify_class_ownership")
    @patch("handlers.enrollment_handler.db.get_student")
    def test_missing_consent_is_blocked_403(self, mock_get_st, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {"studentId": "SV01", "fullName": "Nguyen Van A"}

        event = {
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"},
            "body": json.dumps({"consentAgreed": False})
        }
        res = enrollment_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 403)
        self.assertIn("đồng ý", json.loads(res["body"])["error"])

    @patch("handlers.enrollment_handler.verify_class_ownership")
    @patch("handlers.enrollment_handler.db.get_student")
    @patch("handlers.enrollment_handler.db.update_student_face_ids")
    @patch("handlers.enrollment_handler.rek.index_student_face")
    @patch("handlers.enrollment_handler.s3")
    def test_s3_photo_purged_after_indexing(self, mock_s3, mock_index, mock_update, mock_get_st, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {"studentId": "SV01", "fullName": "Nguyen Van A", "faceIds": []}
        mock_index.return_value = (["face-uuid-1"], "") # success
        mock_s3.get_object.return_value = {"Body": MagicMock(read=lambda: b"fake-jpeg-bytes")}

        teacher_id = "teacher@example.com"
        expected_key = "enrollments/teacher_example.com/cls-01/SV01.jpg"

        event = {
            "requestContext": {
                "http": {"method": "POST"},
                "authorizer": {"jwt": {"claims": {"email": teacher_id}}}
            },
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"},
            "body": json.dumps({
                "consentAgreed": True,
                "consentAt": "2026-11-06T14:00:00Z",
                "s3Key": expected_key
            })
        }
        res = enrollment_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        mock_s3.delete_object.assert_called_with(
            Bucket=os.environ.get("PHOTO_BUCKET", ""),
            Key=expected_key
        )

    # =========================================================================
    # 4. Confirmation Blocked If 'Uncertain' Group Not Empty (400)
    # =========================================================================
    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_students_by_class")
    def test_unresolved_uncertain_students_block_confirmation_400(self, mock_get_st, mock_get_sess, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01", "status": "draft"}
        mock_get_st.return_value = [{"studentId": "SV01"}, {"studentId": "SV02"}]

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/confirm",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({
                "records": [
                    {"studentId": "SV01", "status": "present"},
                    {"studentId": "SV02", "status": "uncertain"} # UNRESOLVED!
                ]
            })
        }
        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 400)
        self.assertIn("Cần xác nhận", json.loads(res["body"])["error"])

    # =========================================================================
    # 5. Anti-duplicate Email Dispatch Prevention
    # =========================================================================
    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    def test_anti_duplicate_email_dispatch_prevented(self, mock_get_sess, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {
            "classId": "cls-01",
            "sessionId": "sess-01",
            "status": "confirmed",
            "emailsSentAt": "2026-11-06T12:00:00Z" # Already sent!
        }

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/confirm",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({"records": [{"studentId": "SV01", "status": "present"}]})
        }
        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 400)
        self.assertIn("đã gửi email cảnh báo trước đó", json.loads(res["body"])["error"])

    # =========================================================================
    # 6. Presigned POST Constraint Verification (<= 5MB & image/jpeg)
    # =========================================================================
    @patch("handlers.enrollment_handler.verify_class_ownership")
    @patch("handlers.enrollment_handler.db.get_student")
    @patch("handlers.enrollment_handler.s3")
    def test_presigned_post_content_length_range_enforced(self, mock_s3, mock_get_st, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {"studentId": "SV01"}
        mock_s3.generate_presigned_post.return_value = {"url": "https://s3.amazonaws.com", "fields": {}}

        event = {
            "requestContext": {"http": {"method": "GET"}},
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"}
        }
        res = enrollment_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)

        _, kwargs = mock_s3.generate_presigned_post.call_args
        conditions = kwargs.get("Conditions", [])
        
        has_size_constraint = any(c[0] == "content-length-range" and c[2] == 5242880 for c in conditions if isinstance(c, list))
        has_jpeg_constraint = any(c.get("Content-Type") == "image/jpeg" for c in conditions if isinstance(c, dict))
        
        self.assertTrue(has_size_constraint, "Must enforce content-length-range <= 5MB")
        self.assertTrue(has_jpeg_constraint, "Must enforce Content-Type: image/jpeg")

    # =========================================================================
    # 7. Attendance Handler: S3 Prefix Generation and Tamper Prevention
    # =========================================================================
    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.s3")
    def test_attendance_upload_url_enforces_server_prefix(self, mock_s3, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_s3.generate_presigned_post.return_value = {"url": "https://s3.amazonaws.com", "fields": {}}

        teacher_id = "teacher@example.com"
        expected_prefix = "attendance/teacher_example.com/cls-01/"

        event = {
            "rawPath": "/api/classes/cls-01/attendance/upload-url",
            "requestContext": {
                "http": {"method": "GET"},
                "authorizer": {"jwt": {"claims": {"email": teacher_id}}}
            },
            "pathParameters": {"classId": "cls-01"}
        }
        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        body = json.loads(res["body"])
        self.assertTrue(body["s3Key"].startswith(expected_prefix))

        _, kwargs = mock_s3.generate_presigned_post.call_args
        conditions = kwargs.get("Conditions", [])
        has_prefix_condition = any(c[0] == "starts-with" and c[2] == expected_prefix for c in conditions if isinstance(c, list))
        self.assertTrue(has_prefix_condition, "Must enforce starts-with prefix in presigned POST conditions")

    @patch("handlers.attendance_handler.verify_class_ownership")
    def test_attendance_scan_tampered_s3_key_blocked_403(self, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})

        teacher_id = "teacher@example.com"
        event = {
            "rawPath": "/api/classes/cls-01/attendance/scan",
            "requestContext": {
                "http": {"method": "POST"},
                "authorizer": {"jwt": {"claims": {"email": teacher_id}}}
            },
            "pathParameters": {"classId": "cls-01"},
            "body": json.dumps({
                "sessionId": "sess-01",
                "s3Key": "attendance/hacker_teacher/cls-01/tampered.jpg"
            })
        }
        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 403)
        self.assertIn("không thuộc phạm vi", json.loads(res["body"])["error"])

    @patch("handlers.students_handler.verify_class_ownership")
    def test_students_invalid_email_rejected_400(self, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        event = {
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01"},
            "body": json.dumps({
                "studentId": "SV01",
                "fullName": "Nguyen Van A",
                "email": "invalid-email-format"
            })
        }
        res = students_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 400)
        self.assertIn("không đúng định dạng", json.loads(res["body"])["error"])

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_students_by_class")
    def test_confirm_attendance_rejects_unregistered_student_id_400(self, mock_get_st, mock_get_sess, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01", "status": "draft"}
        mock_get_st.return_value = [{"studentId": "SV01"}]

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/confirm",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({"records": [{"studentId": "HACKER_SV", "status": "present"}]})
        }
        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 400)
        self.assertIn("không thuộc danh sách lớp", json.loads(res["body"])["error"])

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_students_by_class")
    def test_confirm_attendance_rejects_invalid_status_400(self, mock_get_st, mock_get_sess, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01", "status": "draft"}
        mock_get_st.return_value = [{"studentId": "SV01"}]

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/confirm",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({"records": [{"studentId": "SV01", "status": "tampered_status"}]})
        }
        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 400)
        self.assertIn("không hợp lệ", json.loads(res["body"])["error"])

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_session_attendance")
    def test_retry_email_checks_ownership_and_fails_if_already_sent_400(self, mock_get_att, mock_get_sess, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01"}
        mock_get_att.return_value = [
            {"studentId": "SV02", "status": "absent", "emailStatus": "sent"}
        ]

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/retry-email",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({"studentId": "SV02"})
        }
        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 400)
        self.assertIn("đã được gửi thành công trước đó", json.loads(res["body"])["error"])

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_session_attendance")
    def test_retry_email_fails_if_not_failed_status_400(self, mock_get_att, mock_get_sess, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01"}
        mock_get_att.return_value = [
            {"studentId": "SV02", "status": "absent", "emailStatus": "none"}
        ]

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/retry-email",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({"studentId": "SV02"})
        }
        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 400)
        self.assertIn("thất bại (failed)", json.loads(res["body"])["error"])

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_session_attendance")
    @patch("handlers.attendance_handler.mailer.send_absence_warning")
    @patch("handlers.attendance_handler.db.update_attendance_email_status")
    def test_attendance_retry_email_success(self, mock_update, mock_send, mock_get_att, mock_get_sess, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01"}
        mock_get_att.return_value = [
            {"studentId": "SV02", "fullName": "Tran Thi B", "email": "b@student.edu.vn", "status": "absent", "emailStatus": "failed"}
        ]
        mock_send.return_value = (True, None)

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/retry-email",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({"studentId": "SV02"})
        }
        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        self.assertEqual(json.loads(res["body"])["emailStatus"], "sent")
        mock_send.assert_called_once()
        mock_update.assert_called_once()

class TestMailerSmtpAndSsm(unittest.TestCase):
    @patch("common.mailer.ssm")
    def test_get_gmail_credentials_from_ssm(self, mock_ssm):
        mailer._cached_gmail_user = None
        mailer._cached_gmail_password = None
        mock_ssm.get_parameters.return_value = {
            "Parameters": [
                {"Name": "/facepass/gmail/username", "Value": "test@gmail.com"},
                {"Name": "/facepass/gmail/app_password", "Value": "abcd-efgh-ijkl-mnop"}
            ]
        }
        user, pwd = mailer.get_gmail_credentials()
        self.assertEqual(user, "test@gmail.com")
        self.assertEqual(pwd, "abcd-efgh-ijkl-mnop")
        mock_ssm.get_parameters.assert_called_once()

    @patch("common.mailer.get_gmail_credentials")
    @patch("smtplib.SMTP")
    def test_dispatch_batch_absence_emails_reuses_connection(self, mock_smtp_cls, mock_get_creds):
        mock_get_creds.return_value = ("test@gmail.com", "abcd-efgh-ijkl-mnop")
        mock_smtp_inst = MagicMock()
        mock_smtp_cls.return_value = mock_smtp_inst

        absent_list = [
            {"studentId": "SV01", "fullName": "Nguyen Van A", "email": "a@student.edu.vn"},
            {"studentId": "SV02", "fullName": "Tran Thi B", "email": "b@student.edu.vn"}
        ]

        res = mailer.dispatch_batch_absence_emails(absent_list, "IT001", "08:00 07/11/2026")
        self.assertEqual(res["success"], 2)
        self.assertEqual(res["failed"], 0)

        mock_smtp_cls.assert_called_once_with("smtp.gmail.com", 587, timeout=10)
        mock_smtp_inst.starttls.assert_called_once()
        mock_smtp_inst.login.assert_called_once_with("test@gmail.com", "abcd-efgh-ijkl-mnop")
        self.assertEqual(mock_smtp_inst.send_message.call_count, 2)
        mock_smtp_inst.quit.assert_called_once()

if __name__ == "__main__":
    unittest.main()

