"""Compatibility alias: forwards to mailer.py (SMTP Gmail implementation)."""
from common.mailer import (
    send_absence_warning,
    dispatch_batch_absence_emails,
    get_gmail_credentials,
    create_smtp_connection,
    EMAIL_TEMPLATE
)
