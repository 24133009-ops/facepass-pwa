"""
Amazon Rekognition integration with Pillow face cropping.
Technical mandate:
SearchFacesByImage matches only the largest face in an image.
Therefore, for a multi-student group photo:
1. DetectFaces to obtain bounding boxes of all faces.
2. Crop each face with +20% padding using Pillow.
3. SearchFacesByImage for each cropped face against the class Rekognition Collection.
"""
import io
import os
import boto3
from PIL import Image
from typing import List, Dict, Any, Tuple
from common.log_utils import log_error

rekognition = boto3.client("rekognition", region_name=os.environ.get("AWS_REGION", "ap-southeast-1"))

def create_class_collection(collection_id: str) -> bool:
    try:
        rekognition.create_collection(CollectionId=collection_id)
        return True
    except Exception as e:
        err_code = getattr(e, "response", {}).get("Error", {}).get("Code")
        if err_code != "ResourceAlreadyExistsException" and "ResourceAlreadyExistsException" not in str(e):
            log_error("REKOGNITION_ERROR", e)
        raise e

def delete_class_collection(collection_id: str) -> bool:
    try:
        rekognition.delete_collection(CollectionId=collection_id)
        return True
    except rekognition.exceptions.ResourceNotFoundException:
        return True
    except Exception as e:
        log_error("REKOGNITION_ERROR", e)
        raise e

def index_student_face(collection_id: str, student_id: str, image_bytes: bytes) -> Tuple[List[str], str]:
    """
    Indexes student face into collection with ExternalImageId = student_id.
    Validates quality: exactly 1 face, sufficient sharpness and brightness.
    """
    # 1. Quality pre-check using DetectFaces
    detect_res = rekognition.detect_faces(
        Image={"Bytes": image_bytes},
        Attributes=["ALL"]
    )
    face_details = detect_res.get("FaceDetails", [])
    
    if len(face_details) == 0:
        return [], "Không phát hiện khuôn mặt nào trong ảnh. Vui lòng chụp lại."
    if len(face_details) > 1:
        return [], "Ảnh chứa nhiều hơn 1 khuôn mặt. Ảnh đăng ký phải chụp đơn lẻ."
        
    quality = face_details[0].get("Quality", {})
    brightness = quality.get("Brightness", 50)
    sharpness = quality.get("Sharpness", 50)
    
    if brightness < 30.0:
        return [], "Ảnh quá tối. Vui lòng đứng ở nơi đủ ánh sáng."
    if sharpness < 30.0:
        return [], "Ảnh bị mờ. Vui lòng giữ chắc điện thoại khi chụp."

    # 2. Index face into collection
    index_res = rekognition.index_faces(
        CollectionId=collection_id,
        Image={"Bytes": image_bytes},
        ExternalImageId=student_id,
        MaxFaces=1,
        QualityFilter="AUTO",
        DetectionAttributes=["DEFAULT"]
    )
    
    face_records = index_res.get("FaceRecords", [])
    face_ids = [record["Face"]["FaceId"] for record in face_records]
    return face_ids, ""

def delete_student_faces_from_collection(collection_id: str, face_ids: List[str]) -> bool:
    if not face_ids:
        return True
    try:
        rekognition.delete_faces(
            CollectionId=collection_id,
            FaceIds=face_ids
        )
        return True
    except Exception as e:
        err_code = None
        if hasattr(e, "response") and isinstance(e.response, dict):
            err_code = e.response.get("Error", {}).get("Code")
        elif "ResourceNotFoundException" in str(e):
            err_code = "ResourceNotFoundException"

        if err_code == "ResourceNotFoundException":
            # Collection does not exist: biometric vectors are considered clean / already erased
            return True

        log_error("REKOGNITION_ERROR", e)
        return False

def calculate_crop_box(box: Dict[str, float], img_w: int, img_h: int, padding_ratio: float = 0.20) -> Tuple[int, int, int, int]:
    """
    Calculates pixel crop coordinates with padding percentage added on all 4 sides.
    Ensures coordinates clamp within image boundaries [0, img_w], [0, img_h].
    """
    orig_w = box["Width"] * img_w
    orig_h = box["Height"] * img_h
    orig_x = box["Left"] * img_w
    orig_y = box["Top"] * img_h

    pad_w = orig_w * padding_ratio
    pad_h = orig_h * padding_ratio

    left = max(0, int(orig_x - pad_w))
    top = max(0, int(orig_y - pad_h))
    right = min(img_w, int(orig_x + orig_w + pad_w))
    bottom = min(img_h, int(orig_y + orig_h + pad_h))

    return left, top, right, bottom

def crop_face_image(image: Image.Image, box: Dict[str, float], padding_ratio: float = 0.20) -> bytes:
    """Crops a face from PIL Image with padding and returns JPEG bytes."""
    img_w, img_h = image.size
    left, top, right, bottom = calculate_crop_box(box, img_w, img_h, padding_ratio)

    cropped = image.crop((left, top, right, bottom))
    buffer = io.BytesIO()
    # Save as high quality JPEG
    if cropped.mode in ("RGBA", "P"):
        cropped = cropped.convert("RGB")
    cropped.save(buffer, format="JPEG", quality=95)
    return buffer.getvalue()

def detect_and_crop_all_faces(image_bytes: bytes, padding_ratio: float = 0.20) -> List[Dict[str, Any]]:
    """
    1. Detects all faces in the classroom group photo.
    2. Crops each face into separate bytes with +20% padding.
    """
    detect_res = rekognition.detect_faces(
        Image={"Bytes": image_bytes},
        Attributes=["DEFAULT"]
    )
    face_details = detect_res.get("FaceDetails", [])
    if not face_details:
        return []

    image = Image.open(io.BytesIO(image_bytes))
    cropped_faces = []

    for idx, face in enumerate(face_details):
        box = face.get("BoundingBox", {})
        cropped_bytes = crop_face_image(image, box, padding_ratio)
        cropped_faces.append({
            "index": idx,
            "boundingBox": box,
            "croppedBytes": cropped_bytes,
            "confidence": face.get("Confidence", 0.0)
        })

    return cropped_faces

def search_face_in_collection(collection_id: str, face_bytes: bytes, threshold: float = 80.0) -> Optional[Dict[str, Any]]:
    """
    Searches a single cropped face against the collection.
    Matches with threshold >= 80% (>= 90% is confident Present, 80-89.9% is Uncertain).
    """
    try:
        res = rekognition.search_faces_by_image(
            CollectionId=collection_id,
            Image={"Bytes": face_bytes},
            FaceMatchThreshold=threshold,
            MaxFaces=1
        )
        matches = res.get("FaceMatches", [])
        if matches:
            matched_face = matches[0]["Face"]
            similarity = matches[0]["Similarity"]
            return {
                "studentId": matched_face.get("ExternalImageId"),
                "faceId": matched_face.get("FaceId"),
                "similarity": round(float(similarity), 1)
            }
    except Exception as e:
        log_error("REKOGNITION_WARN", e)
    return None

