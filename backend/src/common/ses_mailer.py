"""
Amazon SES Email Dispatcher for Absence Notifications.
Guarantees:
- Polite Vietnamese messaging with class name, session date/time, and teacher contact instructions.
- Individual sending per absent student (Zero CC/BCC leak).
- Execution audit logging (sent success / fail count).
"""
import os
import boto3
from typing import List, Dict, Any

ses = boto3.client("ses", region_name=os.environ.get("AWS_REGION", "ap-southeast-1"))
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "verified-teacher@example.com")

EMAIL_TEMPLATE = """Kính gửi bạn {student_name} (MSSV: {student_id}),

Hệ thống điểm danh tự động xin thông báo: Bạn được ghi nhận VẮNG MẶT trong buổi học:
- Môn học / Lớp: {class_name}
- Thời gian buổi học: {session_time}

Lưu ý:
Nếu có sự nhầm lẫn hoặc bạn có mặt nhưng hệ thống nhận diện chưa khớp, vui lòng liên hệ trực tiếp với Giảng viên phụ trách trong vòng 24 giờ để được kiểm tra và cập nhật lại điểm danh.

Trân trọng,
Bộ môn Công nghệ Thông tin - Giảng viên phụ trách lớp.
"""

def send_absence_warning(student_email: str, student_name: str, student_id: str, class_name: str, session_time: str) -> bool:
    """Dispatches a single personalized email via SES."""
    if not student_email or "@" not in student_email:
        print(f"Skipping invalid email for student {student_id}: {student_email}")
        return False

    body_text = EMAIL_TEMPLATE.format(
        student_name=student_name,
        student_id=student_id,
        class_name=class_name,
        session_time=session_time
    )

    try:
        ses.send_email(
            Source=SENDER_EMAIL,
            Destination={"ToAddresses": [student_email]},
            Message={
                "Subject": {
                    "Data": f"[Thông báo Điểm danh] Cảnh báo vắng học môn {class_name}",
                    "Charset": "UTF-8"
                },
                "Body": {
                    "Text": {
                        "Data": body_text,
                        "Charset": "UTF-8"
                    }
                }
            }
        )
        print(f"Successfully dispatched SES absence warning to {student_email}")
        return True
    except Exception as e:
        print(f"SES send error for {student_email}: {str(e)}")
        return False

def dispatch_batch_absence_emails(absent_students: List[Dict[str, Any]], class_name: str, session_time: str) -> Dict[str, int]:
    """
    Sends individual emails sequentially to prevent recipient exposure.
    Returns success and failed delivery counts.
    """
    success_count = 0
    fail_count = 0

    for st in absent_students:
        ok = send_absence_warning(
            student_email=st.get("email", ""),
            student_name=st.get("fullName", st.get("studentId")),
            student_id=st.get("studentId"),
            class_name=class_name,
            session_time=session_time
        )
        if ok:
            success_count += 1
        else:
            fail_count += 1

    return {"success": success_count, "failed": fail_count}

