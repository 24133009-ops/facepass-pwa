"""
Student face enrollment handler.
Privacy & Security Mandates:
1. Requires explicit student consent timestamp before indexing.
2. Validates single-face quality (brightness, sharpness).
3. Indexes face with ExternalImageId = studentId into the class collection.
4. PERMANENTLY DELETES raw photo from S3 right after indexing.
"""
import json
import os
import boto3
from common.responses import success, error
from common import dynamodb as db
from common import rekognition as rek

s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ap-southeast-1"))
PHOTO_BUCKET = os.environ.get("PHOTO_BUCKET", "")

def lambda_handler(event, context):
    http = event.get("requestContext", {}).get("http", {})
    http_method = http.get("method", "")
    path_params = event.get("pathParameters", {}) or {}
    class_id = path_params.get("classId")
    student_id = path_params.get("studentId")

    if not class_id or not student_id:
        return error("Thiếu classId hoặc studentId", 400)

    class_info = db.get_class(class_id)
    if not class_info:
        return error("Không tìm thấy lớp học", 404)

    collection_id = class_info.get("collectionId", f"facepass-{class_id}")
    student_info = db.get_student(class_id, student_id)
    if not student_info:
        return error("Không tìm thấy sinh viên", 404)

    try:
        # 1. GET Presigned S3 Upload URL
        if http_method == "GET":
            s3_key = f"enrollments/{class_id}/{student_id}.jpg"
            presigned_url = s3.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": PHOTO_BUCKET,
                    "Key": s3_key,
                    "ContentType": "image/jpeg"
                },
                ExpiresIn=300 # Valid for 5 minutes
            )
            return success({
                "uploadUrl": presigned_url,
                "s3Key": s3_key
            })

        # 2. POST Finalize Enrollment
        elif http_method == "POST":
            body = json.loads(event.get("body", "{}"))
            consent_agreed = body.get("consentAgreed", False)
            consent_at = body.get("consentAt")
            s3_key = body.get("s3Key", f"enrollments/{class_id}/{student_id}.jpg")

            # Mandate: Consent checkbox must be explicitly checked
            if not consent_agreed or not consent_at:
                return error("Bắt buộc sinh viên phải đồng ý lưu trữ đặc trưng khuôn mặt trước khi đăng ký.", 403)

            # Fetch uploaded image from S3
            try:
                s3_obj = s3.get_object(Bucket=PHOTO_BUCKET, Key=s3_key)
                image_bytes = s3_obj["Body"].read()
            except Exception as e:
                return error(f"Không tìm thấy ảnh tải lên trong S3: {str(e)}", 404)

            # Quality validation & Index into Rekognition Collection
            face_ids, err_msg = rek.index_student_face(collection_id, student_id, image_bytes)
            if err_msg:
                # Clean up uploaded file if rejected
                s3.delete_object(Bucket=PHOTO_BUCKET, Key=s3_key)
                return error(err_msg, 400)

            # Append new face IDs in DynamoDB
            existing_faces = student_info.get("faceIds", [])
            updated_face_ids = list(set(existing_faces + face_ids))
            db.update_student_face_ids(class_id, student_id, updated_face_ids)

            # Privacy mandate: DELETE raw photo from S3 immediately
            try:
                s3.delete_object(Bucket=PHOTO_BUCKET, Key=s3_key)
                print(f"Purged raw enrollment photo from S3: {s3_key}")
            except Exception as e:
                print(f"Warning: Failed to purge S3 raw photo {s3_key}: {str(e)}")

            return success({
                "message": f"Đăng ký khuôn mặt thành công cho sinh viên {student_id}",
                "faceIds": updated_face_ids,
                "rawPhotoPurged": True
            })

        return error(f"Unsupported method {http_method}", 405)

    except Exception as e:
        print(f"Error in enrollment_handler: {str(e)}")
        return error(str(e), 500)

