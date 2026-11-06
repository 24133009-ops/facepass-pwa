"""DynamoDB repository layer for Classes, Students, Sessions, and Attendance."""
import os
import boto3
from datetime import datetime
from typing import List, Dict, Optional, Any

dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "ap-southeast-1"))

CLASSES_TABLE_NAME = os.environ.get("CLASSES_TABLE", "facepass-classes-prod")
STUDENTS_TABLE_NAME = os.environ.get("STUDENTS_TABLE", "facepass-students-prod")
SESSIONS_TABLE_NAME = os.environ.get("SESSIONS_TABLE", "facepass-sessions-prod")
ATTENDANCE_TABLE_NAME = os.environ.get("ATTENDANCE_TABLE", "facepass-attendance-prod")

classes_tbl = dynamodb.Table(CLASSES_TABLE_NAME)
students_tbl = dynamodb.Table(STUDENTS_TABLE_NAME)
sessions_tbl = dynamodb.Table(SESSIONS_TABLE_NAME)
attendance_tbl = dynamodb.Table(ATTENDANCE_TABLE_NAME)

# -----------------------------------------------------------------------------
# Classes Repository
# -----------------------------------------------------------------------------
def get_classes_by_teacher(teacher_id: str) -> List[Dict[str, Any]]:
    # Scan with filter on teacherId (small dataset per school)
    response = classes_tbl.scan(
        FilterExpression="teacherId = :t",
        ExpressionAttributeValues={":t": teacher_id}
    )
    return response.get("Items", [])

def get_class(class_id: str) -> Optional[Dict[str, Any]]:
    res = classes_tbl.get_item(Key={"classId": class_id})
    return res.get("Item")

def create_class(class_id: str, name: str, teacher_id: str, collection_id: str) -> Dict[str, Any]:
    item = {
        "classId": class_id,
        "name": name,
        "teacherId": teacher_id,
        "collectionId": collection_id,
        "createdAt": datetime.now().isoformat()
    }
    classes_tbl.put_item(Item=item)
    return item

# -----------------------------------------------------------------------------
# Students Repository
# -----------------------------------------------------------------------------
def get_students_by_class(class_id: str) -> List[Dict[str, Any]]:
    res = students_tbl.query(
        KeyConditionExpression="classId = :c",
        ExpressionAttributeValues={":c": class_id}
    )
    return res.get("Items", [])

def get_student(class_id: str, student_id: str) -> Optional[Dict[str, Any]]:
    res = students_tbl.get_item(Key={"classId": class_id, "studentId": student_id})
    return res.get("Item")

def save_student(class_id: str, student_id: str, full_name: str, email: str, consent_at: Optional[str] = None) -> Dict[str, Any]:
    item = {
        "classId": class_id,
        "studentId": student_id,
        "fullName": full_name,
        "email": email,
        "faceIds": [],
        "consentAt": consent_at or datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat()
    }
    students_tbl.put_item(Item=item)
    return item

def update_student_face_ids(class_id: str, student_id: str, face_ids: List[str]):
    students_tbl.update_item(
        Key={"classId": class_id, "studentId": student_id},
        UpdateExpression="SET faceIds = :f, updatedAt = :u",
        ExpressionAttributeValues={
            ":f": face_ids,
            ":u": datetime.now().isoformat()
        }
    )

def delete_student(class_id: str, student_id: str):
    students_tbl.delete_item(Key={"classId": class_id, "studentId": student_id})

# -----------------------------------------------------------------------------
# Sessions & Attendance Repository
# -----------------------------------------------------------------------------
def save_session(class_id: str, session_id: str, status: str = "draft") -> Dict[str, Any]:
    item = {
        "classId": class_id,
        "sessionId": session_id,
        "startedAt": datetime.now().isoformat(),
        "status": status,
        "emailsSentAt": None
    }
    sessions_tbl.put_item(Item=item)
    return item

def get_session(class_id: str, session_id: str) -> Optional[Dict[str, Any]]:
    res = sessions_tbl.get_item(Key={"classId": class_id, "sessionId": session_id})
    return res.get("Item")

def mark_session_confirmed(class_id: str, session_id: str, emails_sent_at: Optional[str] = None):
    sessions_tbl.update_item(
        Key={"classId": class_id, "sessionId": session_id},
        UpdateExpression="SET #st = :s, emailsSentAt = :e",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={
            ":s": "confirmed",
            ":e": emails_sent_at or datetime.now().isoformat()
        }
    )

def save_attendance_batch(session_id: str, records: List[Dict[str, Any]]):
    with attendance_tbl.batch_writer() as batch:
        for r in records:
            batch.put_item(Item={
                "sessionId": session_id,
                "studentId": r["studentId"],
                "fullName": r.get("fullName", ""),
                "email": r.get("email", ""),
                "status": r.get("status", "absent"),
                "similarity": str(r.get("similarity", 0)),
                "confirmedBy": r.get("confirmedBy", "system"),
                "updatedAt": datetime.now().isoformat()
            })

def get_session_attendance(session_id: str) -> List[Dict[str, Any]]:
    res = attendance_tbl.query(
        KeyConditionExpression="sessionId = :s",
        ExpressionAttributeValues={":s": session_id}
    )
    return res.get("Items", [])

