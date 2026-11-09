"""
Validation utilities for FacePass PWA backend.
Single Source of Truth for input sanitization and verification.
"""
import re

# RFC 5321 / RFC 5322 strict pattern:
# - No whitespace, commas, semicolons, angle brackets, quotes, parentheses, brackets, or backslashes
# - Local part and domain parts must strictly adhere to valid email characters
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)

# Explicit set of forbidden characters: control characters, delimiters, whitespace, quotes, brackets
FORBIDDEN_EMAIL_CHARS = set(',;:<>\"()[]\\ \t\r\n\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x7f')

def is_valid_email(email: str) -> bool:
    """
    Strict email validator:
    - Rejects empty or non-string inputs
    - Enforces maximum length of 254 characters (RFC 5321)
    - Prohibits control characters (\x00-\x1f, \x7f)
    - Prohibits whitespace and punctuation delimiters: , ; : < > " ( ) [ ] \\
    - Enforces local@domain.tld structure
    """
    if not email or not isinstance(email, str):
        return False

    # RFC 5321 max length constraint
    if len(email) > 254:
        return False

    # Check for forbidden control or delimiter characters
    if any(c in FORBIDDEN_EMAIL_CHARS for c in email):
        return False

    # Additional ascii control code range verification
    for c in email:
        code = ord(c)
        if code <= 31 or code == 127:
            return False

    return bool(EMAIL_REGEX.match(email))

