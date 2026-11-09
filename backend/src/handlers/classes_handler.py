"""Class management handler (Create class, List classes, Get class details)."""
import json
import uuid
from common.responses import success, error
from common.auth import get_teacher_id, verify_class_ownership
from common.log_utils import log_error
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

            # Retry up to 3 times if class_id collision occurs
            created_item = None
            max_attempts = 3
            for attempt in range(max_attempts):
                class_id = str(uuid.uuid4())[:8]
                collection_id = f"facepass-{class_id}"
                created_db = False
                created_collection = False

                # (a) Ghi bản ghi lớp vào DynamoDB với ConditionExpression attribute_not_exists(classId) TRƯỚC
                try:
                    created_item = db.create_class(class_id, class_name, teacher_id, collection_id)
                    created_db = True
                except Exception as db_err:
                    is_db_collision = False
                    if hasattr(db_err, "response") and db_err.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                        is_db_collision = True
                    elif "ConditionalCheckFailedException" in str(db_err):
                        is_db_collision = True

                    if is_db_collision:
                        if attempt == max_attempts - 1:
                            raise RuntimeError("Không thể tạo mã lớp học sau 3 lần thử do trùng lặp ID")
                        continue
                    else:
                        # Ghi DB lỗi không phải trùng ID thì KHÔNG tạo collection
                        raise db_err

                # (b) Mới gọi create_collection
                try:
                    rek.create_class_collection(collection_id)
                    created_collection = True
                    break # Thành công cả DB và Rekognition
                except Exception as rek_err:
                    is_rek_collision = False
                    if hasattr(rek_err, "response") and rek_err.response.get("Error", {}).get("Code") == "ResourceAlreadyExistsException":
                        is_rek_collision = True
                    elif "ResourceAlreadyExistsException" in str(rek_err):
                        is_rek_collision = True

                    # (c) Nếu create_collection lỗi thì xóa bản ghi lớp vừa ghi (có điều kiện đúng ID)
                    if created_db:
                        try:
                            db.delete_class(class_id)
                        except Exception:
                            pass

                    # (d) KHÔNG BAO GIỜ xóa collection trừ khi chính request này vừa tạo thành công
                    if created_collection:
                        try:
                            rek.delete_class_collection(collection_id)
                        except Exception:
                            pass

                    if is_rek_collision:
                        if attempt == max_attempts - 1:
                            raise RuntimeError("Không thể tạo mã lớp học sau 3 lần thử do trùng lặp ID collection")
                        continue
                    else:
                        raise rek_err

            return success({"message": "Tạo lớp học thành công", "class": created_item}, 201)

        return error(f"Unsupported method {http_method}", 405)

    except Exception as e:
        log_error("CLASSES_ERROR", e, context)
        return error(str(e), 500)
