"""Standard HTTP JSON response helpers with strict CORS (No wildcard '*')."""
import os
import json
from decimal import Decimal

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "http://localhost:5173")
LOCAL_ORIGIN = os.environ.get("LOCAL_ORIGIN", "http://localhost:5173")
VALID_ORIGINS = {ALLOWED_ORIGIN, LOCAL_ORIGIN, "http://localhost:5173"}

class DecimalEncoder(json.JSONEncoder):
    """JSON encoder for DynamoDB Decimal types."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def build_response(status_code: int, body: dict, request_origin: str = None) -> dict:
    origin_header = ALLOWED_ORIGIN
    if request_origin and request_origin in VALID_ORIGINS:
        origin_header = request_origin

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin_header,
            "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Amz-Date",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder, ensure_ascii=False)
    }

def success(data: dict, status_code: int = 200, request_origin: str = None) -> dict:
    return build_response(status_code, data, request_origin)

def error(message: str, status_code: int = 400, request_origin: str = None) -> dict:
    return build_response(status_code, {"error": message}, request_origin)
