"""Helpers for encrypting secrets at rest and verifying Meta webhook signatures."""

import hashlib
import hmac
import uuid
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


def new_id() -> str:
    """Generate a URL-safe unique id used as primary key for all tables."""
    return uuid.uuid4().hex


@lru_cache
def _fernet() -> Fernet:
    key = get_settings().encryption_key
    # Allow a plain passphrase in dev by deriving a valid Fernet key from it,
    # while still accepting a properly generated Fernet key as-is.
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError):
        derived = hashlib.sha256(key.encode()).digest()
        import base64

        return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_secret(plaintext: str | None) -> str | None:
    if plaintext is None or plaintext == "":
        return None
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str | None) -> str | None:
    if ciphertext is None or ciphertext == "":
        return None
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        return None


def mask_secret(plaintext: str | None) -> str | None:
    if not plaintext:
        return None
    if len(plaintext) <= 8:
        return "*" * len(plaintext)
    return f"{plaintext[:4]}{'*' * (len(plaintext) - 8)}{plaintext[-4:]}"


def verify_meta_signature(app_secret: str, payload: bytes, signature_header: str | None) -> bool:
    """Validate the X-Hub-Signature-256 header Meta sends on every webhook POST.

    signature_header looks like "sha256=<hexdigest>".
    """
    if not signature_header or not app_secret:
        return False
    try:
        algo, provided_digest = signature_header.split("=", 1)
    except ValueError:
        return False
    if algo != "sha256":
        return False
    expected_digest = hmac.new(app_secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_digest, provided_digest)
