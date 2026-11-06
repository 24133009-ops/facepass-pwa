"""
Authentication & Authorization utilities.
Mandate:
Every handler must enforce that the teacherId from Cognito JWT claims
owns the classId being queried or modified. Returns 403 Forbidden otherwise.
"""
from typing import Tuple, Optional, Dict, Any
from common import dynamodb as db

def get_teacher_id(event: dict) -> str:
    """
    Extracts teacher identity from Cognito JWT Authorizer claims.
    Priority: email -> username -> sub -> fallback for offline dev.
    """
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer", {})
    jwt_claims = authorizer.get("jwt", {}).get("claims", {})
    
    teacher_id = jwt_claims.get("email") or jwt_claims.get("username") or jwt_claims.get("sub")
    if not teacher_id:
        teacher_id = event.get("headers", {}).get("x-dev-teacher-id", "teacher@example.com")
        
    return teacher_id

def verify_class_ownership(teacher_id: str, class_id: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Verifies that the requested class exists and belongs to the authenticated teacher.
    Returns (True, class_info) if authorized, or (False, None) if 403 Forbidden / 404 Not Found.
    """
    if not class_id or not teacher_id:
        return False, None

    class_info = db.get_class(class_id)
    if not class_info:
        return False, None

    if class_info.get("teacherId") != teacher_id:
        return False, None

    return True, class_info
