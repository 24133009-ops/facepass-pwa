"""Unit tests for teacher class ownership verification (403 Forbidden enforcement)."""
import unittest
from unittest.mock import patch
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
from common.auth import get_teacher_id, verify_class_ownership

class TestAuthAndOwnership(unittest.TestCase):
    def test_extract_teacher_id_from_cognito_jwt(self):
        event = {
            "requestContext": {
                "authorizer": {
                    "jwt": {
                        "claims": {
                            "email": "teacher.smith@university.edu.vn",
                            "sub": "uuid-1234-abcd"
                        }
                    }
                }
            }
        }
        teacher_id = get_teacher_id(event)
        self.assertEqual(teacher_id, "teacher.smith@university.edu.vn")

    @patch("common.dynamodb.get_class")
    def test_verify_class_ownership_authorized(self, mock_get_class):
        mock_get_class.return_value = {
            "classId": "cls-01",
            "name": "Cloud Computing",
            "teacherId": "teacher.smith@university.edu.vn"
        }
        is_owner, class_info = verify_class_ownership("teacher.smith@university.edu.vn", "cls-01")
        self.assertTrue(is_owner)
        self.assertIsNotNone(class_info)
        self.assertEqual(class_info["classId"], "cls-01")

    @patch("common.dynamodb.get_class")
    def test_verify_class_ownership_forbidden_different_teacher(self, mock_get_class):
        mock_get_class.return_value = {
            "classId": "cls-01",
            "name": "Cloud Computing",
            "teacherId": "teacher.jones@university.edu.vn" # Different teacher
        }
        # teacher.smith tries to access teacher.jones's class
        is_owner, class_info = verify_class_ownership("teacher.smith@university.edu.vn", "cls-01")
        self.assertFalse(is_owner)
        self.assertIsNone(class_info)

    @patch("common.dynamodb.get_class")
    def test_verify_class_ownership_class_not_found(self, mock_get_class):
        mock_get_class.return_value = None
        is_owner, class_info = verify_class_ownership("teacher.smith@university.edu.vn", "non-existent")
        self.assertFalse(is_owner)
        self.assertIsNone(class_info)

if __name__ == "__main__":
    unittest.main()

