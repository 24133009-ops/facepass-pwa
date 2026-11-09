"""
Structured error logger for FacePass PWA backend.
Ensures:
- ZERO personally identifiable information (emails, student IDs, S3 keys, raw photo bytes).
- Standardized single-line JSON log for CloudWatch and monitoring.
- Preserves actionable diagnostics: event code, exception type, AWS error code, AWS operation, origin frame, requestId.
"""
import json
import traceback
from typing import Optional, Any

def log_error(event_code: str, exc: Optional[BaseException] = None, context: Any = None) -> str:
    """
    Emits a structured JSON error line to stdout without leaking sensitive PII.
    
    Fields:
    - event: event code category (e.g. 'STUDENTS_ERROR', 'ATTENDANCE_ERROR')
    - type: exception class name (e.g. 'ClientError', 'TimeoutError')
    - awsErrorCode: botocore Error.Code if available (e.g. 'ResourceNotFoundException')
    - awsOperation: operation name if available
    - origin: file:line:function of the last call frame
    - requestId: AWS request ID if available from Lambda context
    """
    error_data = {
        "event": event_code,
        "type": type(exc).__name__ if exc else "Unknown",
        "awsErrorCode": None,
        "awsOperation": None,
        "origin": None,
        "requestId": getattr(context, "aws_request_id", None) if context else None
    }

    if exc is not None:
        # Check for botocore ClientError response
        if hasattr(exc, "response") and isinstance(exc.response, dict):
            error_data["awsErrorCode"] = exc.response.get("Error", {}).get("Code")
        if hasattr(exc, "operation_name"):
            error_data["awsOperation"] = getattr(exc, "operation_name")

        # Safely extract last traceback frame belonging to project code
        tb = getattr(exc, "__traceback__", None)
        if tb:
            frames = traceback.extract_tb(tb)
            if frames:
                project_frame = None
                for f in reversed(frames):
                    norm = f.filename.replace("\\", "/")
                    is_excluded = any(p in norm for p in ("site-packages", "botocore", "unittest/mock", "unittest.mock"))
                    is_project = any(p in norm for p in ("backend/src", "handlers", "common"))
                    if is_project and not is_excluded:
                        project_frame = f
                        break
                selected_frame = project_frame or frames[-1]
                filename = selected_frame.filename.replace("\\", "/").split("/")[-1]
                error_data["origin"] = f"{filename}:{selected_frame.lineno}:{selected_frame.name}"

    log_line = json.dumps(error_data, ensure_ascii=False)
    print(log_line)
    return log_line

