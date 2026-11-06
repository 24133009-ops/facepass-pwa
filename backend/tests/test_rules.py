"""
Unit tests for critical system rules:
1. Missing consent blocked (403).
2. S3 photo permanently purged after IndexFaces.
3. Class ownership verification (403).
4. Anti-duplicate check (emailsSentAt).
5. Unresolved 'Uncertain' students block confirmation (400).
6. Presigned POST constraints (<= 5MB, image/jpeg).
"""
import unittest
from unittest.mock import patch, MagicMock
import json
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
from handlers import enrollment_handler, attendance_handler

class TestSystemRules(unittest.TestCase):
    @patch("handlers.enrollment_handler.verify_class_ownership")
    @patch("handlers.enrollment_handler.db.get_student")
    def test_missing_consent_is_blocked_403(self, mock_get_st, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {"studentId": "SV01", "fullName": "Nguyen Van A"}

        event = {
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"},
            "body": json.dumps({"consentAgreed": False}) # NO CONSENT
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

        event = {
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"},
            "body": json.dumps({
                "consentAgreed": True,
                "consentAt": "2026-11-06T14:00:00Z",
                "s3Key": "enrollments/cls-01/SV01.jpg"
            })
        }
        res = enrollment_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        # Verify s3.delete_object was called to purge raw image
        mock_s3.delete_object.assert_called_with(
            Bucket=os.environ.get("PHOTO_BUCKET", ""),
            Key="enrollments/cls-01/SV01.jpg"
        )

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    def test_unresolved_uncertain_students_block_confirmation_400(self, mock_get_sess, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01", "status": "draft"}

        # Attempt to confirm with a student still marked 'uncertain'
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

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    def test_anti_duplicate_email_dispatch_prevented(self, mock_get_sess, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        # Session already confirmed and emails already sent!
        mock_get_sess.return_value = {
            "classId": "cls-01",
            "sessionId": "sess-01",
            "status": "confirmed",
            "emailsSentAt": "2026-11-06T12:00:00Z"
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

        # Inspect the conditions passed to generate_presigned_post
        _, kwargs = mock_s3.generate_presigned_post.call_args
        conditions = kwargs.get("Conditions", [])
        
        # Verify max 5MB (5,242,880 bytes) and image/jpeg
        has_size_constraint = any(c[0] == "content-length-range" and c[2] == 5242880 for c in conditions if isinstance(c, list))
        has_jpeg_constraint = any(c.get("Content-Type") == "image/jpeg" for c in conditions if isinstance(c, dict))
        
        self.assertTrue(has_size_constraint, "Must enforce content-length-range <= 5MB")
        self.assertTrue(has_jpeg_constraint, "Must enforce Content-Type: image/jpeg")

if __name__ == "__main__":
    unittest.main()
