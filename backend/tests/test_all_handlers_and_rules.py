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

# Ensure hermetic environment for boto3 offline presigned signing
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("AWS_SECURITY_TOKEN", "testing")
os.environ.setdefault("AWS_SESSION_TOKEN", "testing")
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

from handlers import classes_handler, students_handler, enrollment_handler, attendance_handler
from common import mailer
from common import dynamodb as db

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
        mock_del_faces.return_value = True

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

    @patch("handlers.students_handler.verify_class_ownership")
    @patch("handlers.students_handler.db.get_student")
    @patch("handlers.students_handler.db.delete_student")
    @patch("handlers.students_handler.rek.delete_student_faces_from_collection")
    def test_delete_student_empty_face_ids_skips_rekognition_and_deletes_db(
        self, mock_del_faces, mock_db_del, mock_get_st, mock_verify
    ):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {
            "studentId": "SV01",
            "faceIds": [] # No biometric faces registered
        }

        event = {
            "requestContext": {"http": {"method": "DELETE"}},
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"}
        }
        res = students_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        mock_del_faces.assert_not_called()
        mock_db_del.assert_called_with("cls-01", "SV01")

    @patch("handlers.students_handler.verify_class_ownership")
    @patch("handlers.students_handler.db.get_student")
    @patch("handlers.students_handler.db.delete_student")
    @patch("handlers.students_handler.rek.delete_student_faces_from_collection")
    def test_delete_student_collection_not_found_deletes_db_record(
        self, mock_del_faces, mock_db_del, mock_get_st, mock_verify
    ):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {
            "studentId": "SV01",
            "faceIds": ["face-id-1"]
        }
        # Rekognition returns True for ResourceNotFoundException (collection already gone)
        mock_del_faces.return_value = True

        event = {
            "requestContext": {"http": {"method": "DELETE"}},
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"}
        }
        res = students_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        mock_del_faces.assert_called_once()
        mock_db_del.assert_called_with("cls-01", "SV01")

    @patch("handlers.students_handler.verify_class_ownership")
    @patch("handlers.students_handler.db.get_student")
    @patch("handlers.students_handler.db.delete_student")
    @patch("handlers.students_handler.rek.delete_student_faces_from_collection")
    def test_delete_student_fails_with_502_when_rekognition_delete_faces_fails(
        self, mock_del_faces, mock_db_del, mock_get_st, mock_verify
    ):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {
            "studentId": "SV01",
            "faceIds": ["face-id-1"]
        }
        mock_del_faces.return_value = False  # Other AWS error occurred!

        event = {
            "requestContext": {"http": {"method": "DELETE"}},
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"}
        }
        res = students_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 502)
        self.assertIn("Không thể xóa", json.loads(res["body"])["error"])

        # Mandate: If biometric deletion failed, do NOT delete DynamoDB record!
        mock_db_del.assert_not_called()

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

    @patch("handlers.classes_handler.rek.delete_class_collection")
    @patch("handlers.classes_handler.rek.create_class_collection")
    @patch("handlers.classes_handler.db.delete_class")
    @patch("handlers.classes_handler.db.create_class")
    def test_create_class_id_collision_does_not_call_delete_collection(
        self, mock_create_class, mock_del_class, mock_create_coll, mock_del_coll
    ):
        """(i) ID collision: delete_collection MUST NOT be called for the collided collection."""
        from botocore.exceptions import ClientError
        db_collision_error = ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException", "Message": "The conditional request failed"}},
            "PutItem"
        )
        rek_collision_error = ClientError(
            {"Error": {"Code": "ResourceAlreadyExistsException", "Message": "The collection already exists"}},
            "CreateCollection"
        )

        # Attempt 1: DB ID collision (PutItem fails)
        # Attempt 2: Rekognition collection collision (CreateCollection fails) -> DB record revoked, collection NOT deleted
        # Attempt 3: Success!
        mock_create_class.side_effect = [
            db_collision_error,
            {"classId": "cls-att2", "name": "AI Class", "teacherId": "teacher@example.com"},
            {"classId": "cls-att3", "name": "AI Class", "teacherId": "teacher@example.com"}
        ]
        mock_create_coll.side_effect = [
            rek_collision_error,
            True
        ]

        event = {
            "requestContext": {
                "http": {"method": "POST"},
                "authorizer": {"jwt": {"claims": {"email": "teacher@example.com"}}}
            },
            "body": json.dumps({"name": "AI Class"})
        }

        res = classes_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 201)
        self.assertEqual(mock_create_class.call_count, 3)
        self.assertEqual(mock_create_coll.call_count, 2)
        # Mandatory: delete_collection was NEVER called because we did not create the colliding collection
        mock_del_coll.assert_not_called()
        # For attempt 2, the DB record was revoked because create_collection collided
        attempt2_class_id = mock_create_class.call_args_list[1].args[0]
        mock_del_class.assert_called_once_with(attempt2_class_id)

    @patch("handlers.classes_handler.rek.delete_class_collection")
    @patch("handlers.classes_handler.rek.create_class_collection")
    @patch("handlers.classes_handler.db.delete_class")
    @patch("handlers.classes_handler.db.create_class")
    def test_create_class_create_collection_error_revokes_db_record(
        self, mock_create_class, mock_del_class, mock_create_coll, mock_del_coll
    ):
        """(ii) create_collection error: newly written class record in DynamoDB is revoked, leaving no orphan."""
        mock_create_class.return_value = {
            "name": "Cloud Class", "teacherId": "teacher@example.com"
        }
        mock_create_coll.side_effect = RuntimeError("AWS Rekognition Service Unavailable")

        event = {
            "requestContext": {
                "http": {"method": "POST"},
                "authorizer": {"jwt": {"claims": {"email": "teacher@example.com"}}}
            },
            "body": json.dumps({"name": "Cloud Class"})
        }

        res = classes_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 500)
        # DynamoDB item was revoked with the exact generated classId
        created_class_id = mock_create_class.call_args.args[0]
        mock_del_class.assert_called_once_with(created_class_id)
        # Collection was never successfully created, so delete_collection must not be called
        mock_del_coll.assert_not_called()

    @patch("handlers.classes_handler.rek.delete_class_collection")
    @patch("handlers.classes_handler.rek.create_class_collection")
    @patch("handlers.classes_handler.db.delete_class")
    @patch("handlers.classes_handler.db.create_class")
    def test_create_class_success_happy_path(
        self, mock_create_class, mock_del_class, mock_create_coll, mock_del_coll
    ):
        """(iii) Successful creation: DB written first, collection created, no deletion calls."""
        mock_create_class.return_value = {
            "classId": "cls-success", "name": "DevOps Class", "teacherId": "teacher@example.com"
        }
        mock_create_coll.return_value = True

        event = {
            "requestContext": {
                "http": {"method": "POST"},
                "authorizer": {"jwt": {"claims": {"email": "teacher@example.com"}}}
            },
            "body": json.dumps({"name": "DevOps Class"})
        }

        res = classes_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 201)
        body = json.loads(res["body"])
        self.assertEqual(body["class"]["classId"], "cls-success")
        mock_create_class.assert_called_once()
        mock_create_coll.assert_called_once()
        mock_del_class.assert_not_called()
        mock_del_coll.assert_not_called()

    @patch("handlers.enrollment_handler.verify_class_ownership")
    @patch("handlers.enrollment_handler.db.get_student")
    def test_enrollment_presigned_url_contains_region(self, mock_get_st, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "collectionId": "facepass-cls-01"})
        mock_get_st.return_value = {"studentId": "SV01", "fullName": "Nguyen Van A"}

        event = {
            "requestContext": {
                "http": {"method": "GET"},
                "authorizer": {"jwt": {"claims": {"email": "teacher@example.com"}}}
            },
            "pathParameters": {"classId": "cls-01", "studentId": "SV01"}
        }

        with patch.dict(os.environ, {"AWS_REGION": "us-east-1", "PHOTO_BUCKET": "test-photo-bucket"}):
            res = enrollment_handler.lambda_handler(event, None)
            self.assertEqual(res["statusCode"], 200)
            body = json.loads(res["body"])
            presigned_url = body["presignedPost"]["url"]
            # SigV4 presigned URL MUST contain the region name
            self.assertIn("us-east-1", presigned_url)

    @patch("handlers.attendance_handler.verify_class_ownership")
    def test_attendance_presigned_url_contains_region(self, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})

        event = {
            "rawPath": "/api/classes/cls-01/attendance/upload-url",
            "requestContext": {
                "http": {"method": "GET"},
                "authorizer": {"jwt": {"claims": {"email": "teacher@example.com"}}}
            },
            "pathParameters": {"classId": "cls-01"}
        }

        with patch.dict(os.environ, {"AWS_REGION": "us-east-1", "PHOTO_BUCKET": "test-photo-bucket"}):
            res = attendance_handler.lambda_handler(event, None)
            self.assertEqual(res["statusCode"], 200)
            body = json.loads(res["body"])
            presigned_url = body["presignedPost"]["url"]
            # SigV4 presigned URL MUST contain the region name
            self.assertIn("us-east-1", presigned_url)
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
    @patch("handlers.attendance_handler.db.acquire_student_email_lock")
    @patch("handlers.attendance_handler.mailer.send_absence_warning")
    @patch("handlers.attendance_handler.db.update_attendance_email_status")
    def test_attendance_retry_email_success(self, mock_update, mock_send, mock_acquire_lock, mock_get_att, mock_get_sess, mock_verify):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01"}
        mock_get_att.return_value = [
            {"studentId": "SV02", "fullName": "Tran Thi B", "email": "b@student.edu.vn", "status": "absent", "emailStatus": "failed"}
        ]
        mock_acquire_lock.return_value = True
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

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_session_attendance")
    @patch("handlers.attendance_handler.db.acquire_student_email_lock")
    @patch("handlers.attendance_handler.mailer.send_absence_warning")
    @patch("handlers.attendance_handler.db.update_attendance_email_status")
    def test_retry_email_blocks_fresh_processing_and_allows_expired_processing(
        self, mock_update, mock_send, mock_acquire_lock, mock_get_att, mock_get_sess, mock_verify
    ):
        """Tests that retry-email blocks fresh processing lock (<120s) and allows reclaiming expired lock (>120s)."""
        from datetime import datetime, timedelta
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01"}
        mock_send.return_value = (True, None)
        mock_acquire_lock.return_value = True

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/retry-email",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({"studentId": "SV02"})
        }

        # Case 1: Fresh processing lock (locked 10s ago) -> BLOCKED with 409
        fresh_lock = (datetime.now() - timedelta(seconds=10)).isoformat()
        mock_get_att.return_value = [
            {"studentId": "SV02", "fullName": "Tran Thi B", "email": "b@student.edu.vn", "status": "absent", "emailStatus": "processing", "lockedAt": fresh_lock}
        ]
        res1 = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res1["statusCode"], 409)
        self.assertIn("thời hạn khóa", json.loads(res1["body"])["error"])
        mock_send.assert_not_called()

        # Case 2: Expired processing lock (locked 150s ago, Lambda died mid-execution) -> ALLOWED
        expired_lock = (datetime.now() - timedelta(seconds=150)).isoformat()
        mock_get_att.return_value = [
            {"studentId": "SV02", "fullName": "Tran Thi B", "email": "b@student.edu.vn", "status": "absent", "emailStatus": "processing", "lockedAt": expired_lock}
        ]
        res2 = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res2["statusCode"], 200)
        self.assertEqual(json.loads(res2["body"])["emailStatus"], "sent")
        mock_send.assert_called_once()
        mock_update.assert_called_once()

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_students_by_class")
    @patch("handlers.attendance_handler.db.get_session_attendance")
    @patch("handlers.attendance_handler.db.save_attendance_batch")
    @patch("handlers.attendance_handler.db.mark_session_confirmed")
    @patch("handlers.attendance_handler.db.update_attendance_email_status")
    @patch("handlers.attendance_handler.db.acquire_student_email_lock")
    @patch("handlers.attendance_handler.mailer.send_absence_warning")
    @patch("handlers.attendance_handler.mailer.create_smtp_connection")
    @patch("handlers.attendance_handler.mailer.get_gmail_credentials")
    def test_confirm_attendance_saves_status_per_student_and_resumes_without_duplicate_on_interrupt(
        self, mock_creds, mock_create_smtp, mock_send, mock_acquire_lock, mock_update, mock_mark_confirmed, mock_save_batch, mock_get_att, mock_get_st, mock_get_sess, mock_verify
    ):
        mock_creds.return_value = ("test@gmail.com", "secret")
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01", "status": "draft"}
        mock_get_st.return_value = [
            {"studentId": "SV01"},
            {"studentId": "SV02"},
            {"studentId": "SV03"}
        ]
        mock_get_att.return_value = []
        mock_smtp = MagicMock()
        mock_create_smtp.return_value = mock_smtp
        mock_acquire_lock.return_value = True
        mock_send.return_value = (True, None)

        # Student SV02 succeeds, student SV03 encounters abrupt Lambda crash (e.g. OOM/termination)
        def update_side_effect(session_id, student_id, status, error_reason=None, sent_at=None):
            if student_id == "SV03":
                raise RuntimeError("Simulated Lambda abrupt crash/OOM during SV03 execution")
            return None

        mock_update.side_effect = update_side_effect

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/confirm",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({
                "records": [
                    {"studentId": "SV01", "status": "present"},
                    {"studentId": "SV02", "status": "absent", "email": "sv02@student.edu.vn"},
                    {"studentId": "SV03", "status": "absent", "email": "sv03@student.edu.vn"}
                ]
            })
        }

        # Run 1 throws halfway inside Lambda, handler catches and returns 500
        res1 = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res1["statusCode"], 500)

        # Assert SV02 was immediately checkpointed as 'sent' in DynamoDB before SV03 crashed
        mock_update.assert_any_call("sess-01", "SV02", "sent", None, unittest.mock.ANY)

        # Run 2: Resume execution after restart. DB now returns SV02 as already sent
        mock_get_att.return_value = [
            {"studentId": "SV02", "status": "absent", "emailStatus": "sent", "emailSentAt": "2026-11-07T08:00:00Z"}
        ]
        mock_update.side_effect = None
        mock_send.side_effect = None
        mock_send.return_value = (True, None)
        mock_send.reset_mock()
        mock_update.reset_mock()

        res2 = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res2["statusCode"], 200)

        # Assert in Run 2 that SV02 was SKIPPED, only SV03 was sent! (Zero duplicate sending)
        self.assertEqual(mock_send.call_count, 1)
        _, kwargs = mock_send.call_args
        self.assertEqual(kwargs.get("student_id"), "SV03")
        mock_update.assert_called_once_with("sess-01", "SV03", "sent", None, unittest.mock.ANY)

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_students_by_class")
    @patch("handlers.attendance_handler.db.get_session_attendance")
    @patch("handlers.attendance_handler.db.save_attendance_batch")
    @patch("handlers.attendance_handler.db.mark_session_confirmed")
    @patch("handlers.attendance_handler.db.update_attendance_email_status")
    @patch("handlers.attendance_handler.db.acquire_student_email_lock")
    @patch("handlers.attendance_handler.mailer.send_absence_warning")
    @patch("handlers.attendance_handler.mailer.create_smtp_connection")
    @patch("handlers.attendance_handler.mailer.get_gmail_credentials")
    def test_confirm_attendance_skips_fresh_processing_and_reclaims_expired_processing(
        self, mock_creds, mock_create_smtp, mock_send, mock_acquire_lock, mock_update, mock_mark_confirmed, mock_save_batch, mock_get_att, mock_get_st, mock_get_sess, mock_verify
    ):
        """Lambda died mid-execution leaving students in 'processing'. Next execution skips fresh processing and reclaims expired lock, sending email exactly once."""
        mock_creds.return_value = ("test@gmail.com", "secret")
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01", "status": "draft"}
        mock_get_st.return_value = [{"studentId": "SV01"}, {"studentId": "SV02"}, {"studentId": "SV03"}]
        mock_get_att.return_value = []
        mock_smtp = MagicMock()
        mock_create_smtp.return_value = mock_smtp
        mock_send.return_value = (True, None)

        # acquire_student_email_lock returns False for SV02 (fresh processing lock <120s),
        # but returns True for SV03 (expired processing lock >120s reclaimed)
        def acquire_lock_side_effect(session_id, student_id, timeout_seconds=120):
            if student_id == "SV02":
                return False # Fresh processing lock held by active worker -> skip
            if student_id == "SV03":
                return True # Expired processing lock -> successfully reclaimed
            return False

        mock_acquire_lock.side_effect = acquire_lock_side_effect

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/confirm",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({
                "records": [
                    {"studentId": "SV01", "status": "present"},
                    {"studentId": "SV02", "status": "absent", "email": "sv02@student.edu.vn"},
                    {"studentId": "SV03", "status": "absent", "email": "sv03@student.edu.vn"}
                ]
            })
        }

        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)

        # Assert SV02 was skipped (fresh lock), and SV03 was sent exactly once!
        self.assertEqual(mock_send.call_count, 1)
        _, kwargs = mock_send.call_args
        self.assertEqual(kwargs.get("student_id"), "SV03")
        mock_update.assert_called_once_with("sess-01", "SV03", "sent", None, unittest.mock.ANY)

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_students_by_class")
    @patch("handlers.attendance_handler.db.get_session_attendance")
    @patch("handlers.attendance_handler.db.save_attendance_batch")
    @patch("handlers.attendance_handler.db.mark_session_confirmed")
    @patch("handlers.attendance_handler.db.update_attendance_email_status")
    @patch("handlers.attendance_handler.db.acquire_student_email_lock")
    @patch("handlers.attendance_handler.mailer.send_absence_warning")
    @patch("handlers.attendance_handler.mailer.create_smtp_connection")
    @patch("handlers.attendance_handler.mailer.get_gmail_credentials")
    def test_concurrent_confirm_requests_prevent_duplicate_email_via_condition_expression(
        self, mock_creds, mock_create_smtp, mock_send, mock_acquire_lock, mock_update, mock_mark_confirmed, mock_save_batch, mock_get_att, mock_get_st, mock_get_sess, mock_verify
    ):
        """Tests that two concurrent requests confirming the same session only dispatch email once per student via DynamoDB condition lock."""
        mock_creds.return_value = ("test@gmail.com", "secret")
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01", "status": "draft"}
        mock_get_st.return_value = [{"studentId": "SV01"}, {"studentId": "SV02"}]
        mock_get_att.return_value = []
        mock_smtp = MagicMock()
        mock_create_smtp.return_value = mock_smtp
        mock_send.return_value = (True, None)

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/confirm",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({
                "records": [
                    {"studentId": "SV01", "status": "present"},
                    {"studentId": "SV02", "status": "absent", "email": "sv02@student.edu.vn"}
                ]
            })
        }

        # Request 1 wins the race and acquires the lock
        mock_acquire_lock.return_value = True
        res1 = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res1["statusCode"], 200)
        self.assertEqual(mock_send.call_count, 1)

        # Request 2 runs concurrently, but acquire_student_email_lock returns False (ConditionalCheckFailedException)
        mock_acquire_lock.return_value = False
        res2 = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res2["statusCode"], 200)

        # Total email dispatches remains strictly 1 - no duplicate sending under concurrent conditions!
        self.assertEqual(mock_send.call_count, 1)

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_students_by_class")
    @patch("handlers.attendance_handler.db.get_session_attendance")
    @patch("handlers.attendance_handler.db.save_attendance_batch")
    @patch("handlers.attendance_handler.db.mark_session_confirmed")
    @patch("handlers.attendance_handler.db.update_attendance_email_status")
    @patch("handlers.attendance_handler.db.acquire_student_email_lock")
    @patch("handlers.attendance_handler.mailer.send_absence_warning")
    @patch("handlers.attendance_handler.mailer.create_smtp_connection")
    @patch("handlers.attendance_handler.mailer.get_gmail_credentials")
    def test_confirm_attendance_smtp_timeout_records_failed_status(
        self, mock_creds, mock_create_smtp, mock_send, mock_acquire_lock, mock_update, mock_mark_confirmed, mock_save_batch, mock_get_att, mock_get_st, mock_get_sess, mock_verify
    ):
        mock_creds.return_value = ("test@gmail.com", "secret")
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01", "status": "draft"}
        mock_get_st.return_value = [{"studentId": "SV01", "fullName": "Nguyen Van A", "email": "a@student.edu.vn"}]
        mock_get_att.return_value = []
        mock_acquire_lock.return_value = True
        mock_create_smtp.return_value = MagicMock()
        mock_send.return_value = (False, "Lỗi gửi SMTP: The read operation timed out")

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/confirm",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({
                "records": [
                    {"studentId": "SV01", "status": "absent", "email": "a@student.edu.vn"}
                ]
            })
        }

        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        body = json.loads(res["body"])
        self.assertEqual(body["emailsDispatched"], 0)
        self.assertEqual(body["emailsFailed"], 1)

        # Verify failed status was recorded in DynamoDB with timeout error reason
        mock_update.assert_called_with("sess-01", "SV01", "failed", "Lỗi gửi SMTP: The read operation timed out", None)

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_session_attendance")
    @patch("handlers.attendance_handler.db.acquire_student_email_lock")
    @patch("handlers.attendance_handler.db.update_attendance_email_status")
    @patch("handlers.attendance_handler.mailer.send_absence_warning")
    def test_retry_email_smtp_connection_failure_records_failed_status(
        self, mock_send, mock_update, mock_acquire_lock, mock_get_att, mock_get_sess, mock_verify
    ):
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01"}
        mock_get_att.return_value = [
            {"studentId": "SV01", "fullName": "Nguyen Van A", "email": "a@student.edu.vn", "status": "absent", "emailStatus": "failed"}
        ]
        mock_acquire_lock.return_value = True
        mock_send.return_value = (False, "Không thể kết nối và xác thực với smtp.gmail.com")

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/retry-email",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({"studentId": "SV01"})
        }

        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 502)
        mock_update.assert_called_with("sess-01", "SV01", "failed", "Không thể kết nối và xác thực với smtp.gmail.com", None)

    @patch("handlers.attendance_handler.verify_class_ownership")
    @patch("handlers.attendance_handler.db.get_session")
    @patch("handlers.attendance_handler.db.get_students_by_class")
    @patch("handlers.attendance_handler.db.get_session_attendance")
    @patch("handlers.attendance_handler.db.save_attendance_batch")
    @patch("handlers.attendance_handler.db.mark_session_confirmed")
    @patch("handlers.attendance_handler.db.update_attendance_email_status")
    @patch("handlers.attendance_handler.db.acquire_student_email_lock")
    @patch("handlers.attendance_handler.mailer.send_absence_warning")
    @patch("handlers.attendance_handler.mailer.create_smtp_connection")
    @patch("handlers.attendance_handler.mailer.get_gmail_credentials")
    def test_confirm_attendance_when_smtp_fails_saves_attendance_and_marks_failed(
        self, mock_creds, mock_create_smtp, mock_send, mock_acquire_lock, mock_update, mock_mark_confirmed, mock_save_batch, mock_get_att, mock_get_st, mock_get_sess, mock_verify
    ):
        mock_creds.return_value = ("test@gmail.com", "secret")
        mock_verify.return_value = (True, {"classId": "cls-01", "name": "Cloud Computing"})
        mock_get_sess.return_value = {"classId": "cls-01", "sessionId": "sess-01", "status": "draft"}
        mock_get_st.return_value = [{"studentId": "SV01", "fullName": "Nguyen Van A", "email": "a@student.edu.vn"}]
        mock_get_att.return_value = []
        mock_acquire_lock.return_value = True
        mock_create_smtp.return_value = None  # Failed to establish SMTP connection!
        mock_send.return_value = (False, "Không thể kết nối và xác thực với smtp.gmail.com")

        event = {
            "rawPath": "/api/classes/cls-01/attendance/sess-01/confirm",
            "requestContext": {"http": {"method": "POST"}},
            "pathParameters": {"classId": "cls-01", "sessionId": "sess-01"},
            "body": json.dumps({
                "records": [
                    {"studentId": "SV01", "status": "absent", "email": "a@student.edu.vn"}
                ]
            })
        }

        res = attendance_handler.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        body = json.loads(res["body"])
        self.assertEqual(body["sessionStatus"], "confirmed")
        self.assertEqual(body["emailsDispatched"], 0)
        self.assertEqual(body["emailsFailed"], 1)

        # Confirm that attendance was saved in DynamoDB despite SMTP failure
        mock_save_batch.assert_called_once()
        mock_mark_confirmed.assert_called_once()
        # Verify absent student was marked failed (not left processing)
        mock_update.assert_called_with("sess-01", "SV01", "failed", "Không thể kết nối và xác thực với smtp.gmail.com", None)

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

    @patch("smtplib.SMTP")
    def test_create_smtp_connection_timeout_returns_none(self, mock_smtp_cls):
        mock_smtp_cls.side_effect = TimeoutError("Connection to smtp.gmail.com timed out")
        conn = mailer.create_smtp_connection("user@gmail.com", "secret")
        self.assertIsNone(conn)

    @patch("common.mailer.get_gmail_credentials")
    def test_send_absence_warning_smtp_timeout_returns_failed(self, mock_get_creds):
        mock_get_creds.return_value = ("test@gmail.com", "secret")
        mock_server = MagicMock()
        mock_server.send_message.side_effect = TimeoutError("SMTP read/write timeout")

        ok, err = mailer.send_absence_warning(
            student_email="student@school.edu.vn",
            student_name="Nguyen Van A",
            student_id="SV01",
            class_name="Cloud Computing",
            session_time="08:00 07/11/2026",
            server=mock_server
        )
        self.assertFalse(ok)
        self.assertIn("Lỗi gửi SMTP", err)
        self.assertIn("timeout", err)

    @patch("common.mailer.get_gmail_credentials")
    def test_send_absence_warning_malicious_email_rejected(self, mock_get_creds):
        mock_get_creds.return_value = ("test@gmail.com", "secret")
        mock_server = MagicMock()

        # Malicious email containing CRLF / header injection characters must be strictly rejected
        malicious_email = "student@school.edu.vn\r\nBcc: leak@example.com"
        ok, err = mailer.send_absence_warning(
            student_email=malicious_email,
            student_name="Nguyen Van A",
            student_id="SV01",
            class_name="Cloud Computing",
            session_time="08:00 07/11/2026",
            server=mock_server
        )

        self.assertFalse(ok)
        self.assertIn("Email không hợp lệ", err)
        mock_server.send_message.assert_not_called()

    @patch("common.mailer.get_gmail_credentials")
    def test_send_absence_warning_valid_email_and_name_with_newlines(self, mock_get_creds):
        mock_get_creds.return_value = ("test@gmail.com", "secret")
        mock_server = MagicMock()

        valid_email = "student@school.edu.vn"
        malicious_class = "Cloud Computing\r\nBcc: evil@hacker.com\r\nSubject: Injected Subject"
        malicious_student = "Nguyen Van A\r\nCc: spy@example.com"

        ok, err = mailer.send_absence_warning(
            student_email=valid_email,
            student_name=malicious_student,
            student_id="SV01",
            class_name=malicious_class,
            session_time="08:00 07/11/2026",
            server=mock_server
        )

        self.assertTrue(ok)
        self.assertIsNone(err)
        mock_server.send_message.assert_called_once()

        sent_msg = mock_server.send_message.call_args[0][0]

        # 1. Verify no injected headers exist in the message object
        self.assertIsNone(sent_msg.get("Bcc"))
        self.assertIsNone(sent_msg.get("Cc"))

        # 2. Verify Subject and To headers have absolutely NO newline or carriage return characters
        self.assertNotIn("\r", str(sent_msg["Subject"]))
        self.assertNotIn("\n", str(sent_msg["Subject"]))
        self.assertNotIn("\r", str(sent_msg["To"]))
        self.assertNotIn("\n", str(sent_msg["To"]))

        # 3. Verify clean content: newlines in class_name were flattened to spaces
        self.assertIn("Cloud Computing Bcc: evil@hacker.com Subject: Injected Subject", str(sent_msg["Subject"]))
        self.assertIn("student@school.edu.vn", str(sent_msg["To"]))

class TestLogUtils(unittest.TestCase):
    def test_log_error_omits_pii_and_includes_diagnostics(self):
        import io
        import sys
        from common.log_utils import log_error

        captured_stdout = io.StringIO()
        old_stdout = sys.stdout
        sys.stdout = captured_stdout

        try:
            # Exception message containing raw PII: email, student ID, and S3 path
            sensitive_msg = (
                "Database error for student SV12345 (email: test.student@university.edu.vn) "
                "with photo key s3://facepass-photos-prod/enrollments/teacher_1/cls-01/SV12345.jpg"
            )
            try:
                raise ValueError(sensitive_msg)
            except ValueError as exc:
                mock_context = MagicMock()
                mock_context.aws_request_id = "req-test-uuid-9999"
                log_error("ENROLLMENT_ERROR", exc, mock_context)
        finally:
            sys.stdout = old_stdout

        output = captured_stdout.getvalue().strip()

        # 1. Verify ZERO PII leakage in the emitted log
        self.assertNotIn("test.student@university.edu.vn", output)
        self.assertNotIn("SV12345", output)
        self.assertNotIn("s3://facepass-photos-prod", output)

        # 2. Verify structured diagnostic metadata
        parsed = json.loads(output)
        self.assertEqual(parsed["event"], "ENROLLMENT_ERROR")
        self.assertEqual(parsed["type"], "ValueError")
        self.assertEqual(parsed["requestId"], "req-test-uuid-9999")
        self.assertIsNotNone(parsed["origin"])
        self.assertIn("test_all_handlers_and_rules.py", parsed["origin"])

    def test_log_error_origin_skips_mock_and_botocore_and_points_to_project_file(self):
        """Tests that when an exception is raised from within mock/botocore, origin points to project frame."""
        import io
        import sys
        from unittest.mock import MagicMock
        from common.log_utils import log_error

        captured_stdout = io.StringIO()
        old_stdout = sys.stdout
        sys.stdout = captured_stdout

        try:
            fake_mock = MagicMock()
            fake_mock.do_something.side_effect = RuntimeError("Error originating inside mock call")
            try:
                fake_mock.do_something()
            except RuntimeError as exc:
                mock_context = MagicMock()
                mock_context.aws_request_id = "req-origin-check"
                log_error("MOCK_CALL_ERROR", exc, mock_context)
        finally:
            sys.stdout = old_stdout

        output = captured_stdout.getvalue().strip()
        parsed = json.loads(output)
        self.assertEqual(parsed["event"], "MOCK_CALL_ERROR")
        self.assertEqual(parsed["type"], "RuntimeError")
        self.assertIsNotNone(parsed["origin"])
        # Origin must point to project code frame, not mock.py or unittest.mock
        self.assertNotIn("mock.py", parsed["origin"])
        self.assertIn("test_all_handlers_and_rules.py", parsed["origin"])

class TestRekognitionDirect(unittest.TestCase):
    @patch("common.rekognition.rekognition")
    def test_delete_student_faces_empty_returns_true(self, mock_rek):
        from common.rekognition import delete_student_faces_from_collection
        res = delete_student_faces_from_collection("facepass-cls-01", [])
        self.assertTrue(res)
        mock_rek.delete_faces.assert_not_called()

    @patch("common.rekognition.rekognition")
    def test_delete_student_faces_resource_not_found_returns_true(self, mock_rek):
        from botocore.exceptions import ClientError
        from common.rekognition import delete_student_faces_from_collection
        mock_rek.delete_faces.side_effect = ClientError(
            {"Error": {"Code": "ResourceNotFoundException", "Message": "The collection does not exist"}},
            "DeleteFaces"
        )
        res = delete_student_faces_from_collection("facepass-cls-01", ["face-01"])
        self.assertTrue(res, "ResourceNotFoundException must be treated as clean and return True")

    @patch("common.rekognition.rekognition")
    def test_delete_student_faces_other_error_returns_false(self, mock_rek):
        from botocore.exceptions import ClientError
        from common.rekognition import delete_student_faces_from_collection
        mock_rek.delete_faces.side_effect = ClientError(
            {"Error": {"Code": "AccessDeniedException", "Message": "User is not authorized"}},
            "DeleteFaces"
        )
        res = delete_student_faces_from_collection("facepass-cls-01", ["face-01"])
        self.assertFalse(res, "Other AWS errors must return False")

class TestDynamoDbConcurrencyLock(unittest.TestCase):
    @patch("common.dynamodb.attendance_tbl")
    def test_acquire_student_email_lock_conditional_check_failed(self, mock_tbl):
        from botocore.exceptions import ClientError
        mock_tbl.update_item.side_effect = ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException", "Message": "The conditional request failed"}},
            "UpdateItem"
        )
        lock_acquired = db.acquire_student_email_lock("sess-01", "SV01")
        self.assertFalse(lock_acquired)
        mock_tbl.update_item.assert_called_once()
        _, kwargs = mock_tbl.update_item.call_args
        self.assertIn("ConditionExpression", kwargs)
        self.assertIn("emailStatus", kwargs["ConditionExpression"])

    @patch("common.dynamodb.attendance_tbl")
    def test_acquire_student_email_lock_success(self, mock_tbl):
        mock_tbl.update_item.return_value = {}
        lock_acquired = db.acquire_student_email_lock("sess-01", "SV01", timeout_seconds=120)
        self.assertTrue(lock_acquired)
        mock_tbl.update_item.assert_called_once()
        _, kwargs = mock_tbl.update_item.call_args
        self.assertIn("lockedAt = :now", kwargs["UpdateExpression"])
        self.assertIn("lockedAt < :cutoff", kwargs["ConditionExpression"])
        self.assertIn(":cutoff", kwargs["ExpressionAttributeValues"])

if __name__ == "__main__":
    unittest.main()

