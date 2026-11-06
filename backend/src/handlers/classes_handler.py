"""Class management handler (Create class, List classes, Get class details)."""
import json
import uuid
from common.responses import success, error
from common.auth import get_teacher_id, verify_class_ownership
from common import dynamodb as db
from common import rekognition as rek

def lambda_handler(event, context):
    http_method = event.get("requestContext", {}).get("http", {}).get("method", "")
    path_params = event.get("pathParameters", {}) or {}
    class_id = path_params.get("classId")
    teacher_id = get_teacher_id(event)

    try:
        # If accessing a specific class, strictly verify ownership
        if class_id:
            is_owner, class_info = verify_class_ownership(teacher_id, class_id)
            if not is_owner:
                return error("Bạn không có quyền truy cập hoặc lớp học không tồn tại", 403)

            if http_method == "GET":
                return success({"class": class_info})
            return error(f"Unsupported method {http_method}", 405)

        # Collection operations for teacher's own classes
        if http_method == "GET":
            classes = db.get_classes_by_teacher(teacher_id)
            return success({"classes": classes})

        elif http_method == "POST":
            body = json.loads(event.get("body", "{}"))
            class_name = body.get("name", "").strip()
            if not class_name:
                return error("Tên lớp học không được để trống", 400)

            class_id = str(uuid.uuid4())[:8]
            collection_id = f"facepass-{class_id}"

            # 1. Create class-specific Rekognition collection
            rek.create_class_collection(collection_id)

            # 2. Save class record in DynamoDB
            created_item = db.create_class(class_id, class_name, teacher_id, collection_id)
            return success({"message": "Tạo lớp học thành công", "class": created_item}, 201)

        return error(f"Unsupported method {http_method}", 405)

    except Exception as e:
        print(f"Error in classes_handler: {str(e)}")
        return error(str(e), 500)
