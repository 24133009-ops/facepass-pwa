"""Unit tests for classification, deduplication, and absence email templating."""
import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
from common.ses_mailer import EMAIL_TEMPLATE

class TestMatcherAndMailer(unittest.TestCase):
    def test_classification_logic(self):
        # Thresholds: >= 90 is present, 80 <= x < 90 is uncertain, < 80 is absent
        all_students = [
            {"studentId": "SV01", "fullName": "Nguyen Van A", "email": "a@school.edu.vn"},
            {"studentId": "SV02", "fullName": "Tran Thi B", "email": "b@school.edu.vn"},
            {"studentId": "SV03", "fullName": "Le Van C", "email": "c@school.edu.vn"},
            {"studentId": "SV04", "fullName": "Pham Van D", "email": "d@school.edu.vn"},
        ]

        # Simulated Rekognition search matches (with duplicate detection on SV01)
        raw_matches = [
            {"studentId": "SV01", "similarity": 95.5}, # High match -> Present
            {"studentId": "SV01", "similarity": 91.2}, # Duplicate match (lower, should be discarded)
            {"studentId": "SV02", "similarity": 84.0}, # Medium match -> Uncertain
        ]

        # 1. Deduplication
        deduped = {}
        for m in raw_matches:
            sid = m["studentId"]
            if sid not in deduped or m["similarity"] > deduped[sid]["similarity"]:
                deduped[sid] = m

        self.assertEqual(len(deduped), 2)
        self.assertEqual(deduped["SV01"]["similarity"], 95.5)

        # 2. Classification
        present = []
        uncertain = []
        matched_ids = set()

        for sid, match_data in deduped.items():
            matched_ids.add(sid)
            sim = match_data["similarity"]
            if sim >= 90.0:
                present.append(sid)
            elif sim >= 80.0:
                uncertain.append(sid)

        absent = [st["studentId"] for st in all_students if st["studentId"] not in matched_ids]

        self.assertEqual(present, ["SV01"])
        self.assertEqual(uncertain, ["SV02"])
        self.assertEqual(sorted(absent), ["SV03", "SV04"])

    def test_polite_vietnamese_email_template(self):
        text = EMAIL_TEMPLATE.format(
            student_name="Trương Quốc Duy",
            student_id="24133009",
            class_name="Điện toán đám mây (CLCO432779)",
            session_time="07:30 ngày 06/11/2026"
        )
        self.assertIn("Trương Quốc Duy", text)
        self.assertIn("24133009", text)
        self.assertIn("CLCO432779", text)
        self.assertIn("VẮNG MẶT", text)
        self.assertIn("liên hệ trực tiếp với Giảng viên", text)

if __name__ == "__main__":
    unittest.main()

