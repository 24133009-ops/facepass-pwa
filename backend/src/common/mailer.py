"""
SMTP Gmail Email Dispatcher for Absence Notifications via AWS SSM Parameter Store.
Guarantees:
- Reuses a single SMTP connection for the entire class to avoid TLS handshake overhead.
- Cold-start credential fetching from SSM Parameter Store (SecureString) with decryption.
- Zero secrets in code, repositories, or logs.
- Polite Vietnamese messaging with class name, session date/time, and teacher contact instructions.
- Individual sending per absent student (Zero CC/BCC leak).
"""
import os
import re
import ssl
import smtplib
import boto3
from email.message import EmailMessage
from email.headerregistry import Address
from typing import List, Dict, Any, Optional, Tuple
from common.validators import is_valid_email
from common.log_utils import log_error

ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))

SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_TIMEOUT = int(os.environ.get("SMTP_TIMEOUT", "10"))
GMAIL_USER_PARAM = os.environ.get("GMAIL_USER_PARAM", "/facepass/gmail/username")
GMAIL_APP_PASSWORD_PARAM = os.environ.get("GMAIL_APP_PASSWORD_PARAM", "/facepass/gmail/app_password")

EMAIL_TEMPLATE = """Kính gửi bạn {student_name} (MSSV: {student_id}),

Hệ thống điểm danh tự động xin thông báo: Bạn được ghi nhận VẮNG MẶT trong buổi học:
- Môn học / Lớp: {class_name}
- Thời gian buổi học: {session_time}

Lưu ý:
Nếu có sự nhầm lẫn hoặc bạn có mặt nhưng hệ thống nhận diện chưa khớp, vui lòng liên hệ trực tiếp với Giảng viên phụ trách trong vòng 24 giờ để được kiểm tra và cập nhật lại điểm danh.

Trân trọng,
Bộ môn Công nghệ Thông tin - Giảng viên phụ trách lớp.
"""

# In-memory cold-start cache
_cached_gmail_user: Optional[str] = None
_cached_gmail_password: Optional[str] = None

def get_gmail_credentials() -> Tuple[str, str]:
    """Retrieves Gmail credentials from SSM Parameter Store (SecureString) once per container."""
    global _cached_gmail_user, _cached_gmail_password
    if _cached_gmail_user and _cached_gmail_password:
        return _cached_gmail_user, _cached_gmail_password

    # Check direct environment variables (useful in local dev / unit tests)
    env_user = os.environ.get("GMAIL_USER")
    env_pass = os.environ.get("GMAIL_APP_PASSWORD")
    if env_user and env_pass:
        _cached_gmail_user = env_user
        _cached_gmail_password = env_pass
        return _cached_gmail_user, _cached_gmail_password

    try:
        res = ssm.get_parameters(
            Names=[GMAIL_USER_PARAM, GMAIL_APP_PASSWORD_PARAM],
            WithDecryption=True
        )
        params = {p["Name"]: p["Value"] for p in res.get("Parameters", [])}
        _cached_gmail_user = params.get(GMAIL_USER_PARAM, "")
        _cached_gmail_password = params.get(GMAIL_APP_PASSWORD_PARAM, "")
    except Exception as e:
        log_error("SSM_ERROR", e)
        _cached_gmail_user = ""
        _cached_gmail_password = ""

    return _cached_gmail_user, _cached_gmail_password

def create_smtp_connection(user: str, password: str) -> Optional[smtplib.SMTP]:
    """Establishes an authenticated TLS connection to smtp.gmail.com."""
    if not user or not password:
        return None

    try:
        tls_context = ssl.create_default_context()
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=SMTP_TIMEOUT)
        server.starttls(context=tls_context)
        server.login(user, password)
        return server
    except Exception as e:
        log_error("SMTP_ERROR", e)
        return None

def send_absence_warning(
    student_email: str,
    student_name: str,
    student_id: str,
    class_name: str,
    session_time: str,
    server: Optional[smtplib.SMTP] = None
) -> Tuple[bool, Optional[str]]:
    """
    Dispatches a single personalized email via Gmail SMTP.
    Can reuse an existing SMTP connection or establish a standalone connection.
    Returns (success: bool, error_reason: Optional[str]).
    """
    # 1. Strictly validate email format without modifying or stripping characters
    if not is_valid_email(student_email):
        return False, "Email không hợp lệ"

    # 2. Sanitize class name and student name (replace control chars/newlines with a single space)
    clean_class_name = re.sub(r"[\r\n\t]+", " ", str(class_name or "")).strip()
    clean_student_name = re.sub(r"[\r\n\t]+", " ", str(student_name or "")).strip()

    user, password = get_gmail_credentials()
    if not user or not password:
        return False, "Chưa cấu hình tài khoản Gmail trong SSM Parameter Store"

    should_close = False
    active_server = server
    if active_server is None:
        active_server = create_smtp_connection(user, password)
        should_close = True

    if not active_server:
        return False, "Không thể kết nối và xác thực với smtp.gmail.com"

    try:
        # Construct recipient address using email.headerregistry.Address
        to_username, to_domain = student_email.split("@", 1)
        to_addr = Address(display_name=clean_student_name, username=to_username, domain=to_domain)

        from_username, from_domain = user.split("@", 1)
        from_addr = Address(display_name="FacePass Điểm Danh", username=from_username, domain=from_domain)

        msg = EmailMessage()
        msg["From"] = from_addr
        msg["To"] = to_addr
        msg["Subject"] = f"[Thông báo Điểm danh] Cảnh báo vắng học môn {clean_class_name}"
        body_text = EMAIL_TEMPLATE.format(
            student_name=clean_student_name,
            student_id=student_id,
            class_name=clean_class_name,
            session_time=session_time
        )
        msg.set_content(body_text)
        active_server.send_message(msg)
        return True, None
    except Exception as e:
        log_error("SMTP_SEND_ERROR", e)
        return False, f"Lỗi gửi SMTP: {str(e)}"
    finally:
        if should_close and active_server:
            try:
                active_server.quit()
            except Exception:
                pass

def dispatch_batch_absence_emails(
    absent_students: List[Dict[str, Any]],
    class_name: str,
    session_time: str
) -> Dict[str, Any]:
    """
    Dispatches absence emails to all absent students using a SINGLE reused SMTP connection.
    Returns success count, failed count, and per-student details.
    """
    user, password = get_gmail_credentials()
    server = create_smtp_connection(user, password) if (user and password) else None

    success_count = 0
    fail_count = 0
    details = []

    try:
        for st in absent_students:
            email = st.get("email", "").strip()
            name = st.get("fullName", st.get("studentId"))
            st_id = st.get("studentId")

            ok, err = send_absence_warning(
                student_email=email,
                student_name=name,
                student_id=st_id,
                class_name=class_name,
                session_time=session_time,
                server=server
            )

            if ok:
                success_count += 1
                details.append({
                    "studentId": st_id,
                    "success": True,
                    "error": None
                })
            else:
                fail_count += 1
                details.append({
                    "studentId": st_id,
                    "success": False,
                    "error": err
                })
    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass

    return {
        "success": success_count,
        "failed": fail_count,
        "details": details
    }

