"""Standard HTTP JSON response helpers with CORS headers."""
import json
from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    """JSON encoder for DynamoDB Decimal types."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def build_response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Amz-Date",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body, cls=DecimalEncoder, ensure_ascii=False)
    }

def success(data: dict, status_code: int = 200) -> dict:
    return build_response(status_code, data)

def error(message: str, status_code: int = 400) -> dict:
    return build_response(status_code, {"error": message})

