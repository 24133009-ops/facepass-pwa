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
import smtplib
import boto3
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any, Optional, Tuple

ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "ap-southeast-1"))

SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
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
        print(f"Error fetching Gmail credentials from SSM: {str(e)}")
        _cached_gmail_user = ""
        _cached_gmail_password = ""

    return _cached_gmail_user, _cached_gmail_password

def create_smtp_connection(user: str, password: str) -> Optional[smtplib.SMTP]:
    """Establishes an authenticated TLS connection to smtp.gmail.com."""
    if not user or not password:
        print("Missing Gmail credentials for SMTP connection")
        return None

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10)
        server.starttls()
        server.login(user, password)
        return server
    except Exception as e:
        print(f"SMTP connection error: {str(e)}")
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
    if not student_email or "@" not in student_email:
        return False, "Email không hợp lệ hoặc bị trống"

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
        msg = MIMEMultipart()
        msg["From"] = f"FacePass Điểm Danh <{user}>"
        msg["To"] = student_email
        msg["Subject"] = f"[Thông báo Điểm danh] Cảnh báo vắng học môn {class_name}"
        body_text = EMAIL_TEMPLATE.format(
            student_name=student_name,
            student_id=student_id,
            class_name=class_name,
            session_time=session_time
        )
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        active_server.send_message(msg)
        return True, None
    except Exception as e:
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

