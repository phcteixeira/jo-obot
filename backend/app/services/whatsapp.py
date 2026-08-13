"""Client for the Meta WhatsApp Cloud API + parsing of incoming webhook payloads."""

from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import get_settings
from app.models.credential import WhatsAppCredential
from app.security import decrypt_secret

settings = get_settings()


class WhatsAppAPIError(RuntimeError):
    def __init__(self, status_code: int, payload: Any):
        self.status_code = status_code
        self.payload = payload
        super().__init__(f"WhatsApp API error ({status_code}): {payload}")


async def send_text_message(credential: WhatsAppCredential, to: str, text: str) -> dict:
    """Send a free-form text message via the WhatsApp Cloud API.

    Returns the parsed JSON response from Meta, which includes the outbound
    message id under response["messages"][0]["id"].
    """
    access_token = decrypt_secret(credential.access_token_encrypted)
    url = (
        f"{settings.meta_graph_base_url}/{credential.api_version}/"
        f"{credential.phone_number_id}/messages"
    )
    body = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": text},
    }
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=body, headers=headers)

    if response.status_code >= 400:
        raise WhatsAppAPIError(response.status_code, response.json() if response.content else None)

    return response.json()


@dataclass
class ParsedInboundMessage:
    phone_number_id: str
    contact_wa_id: str
    contact_name: str | None
    wa_message_id: str
    message_type: str
    text: str
    timestamp: str
    raw: dict = field(default_factory=dict)


@dataclass
class ParsedStatusUpdate:
    phone_number_id: str
    wa_message_id: str
    status: str
    recipient_id: str
    raw: dict = field(default_factory=dict)


@dataclass
class ParsedWebhookPayload:
    messages: list[ParsedInboundMessage] = field(default_factory=list)
    statuses: list[ParsedStatusUpdate] = field(default_factory=list)


def _extract_text(message: dict) -> str:
    msg_type = message.get("type", "text")
    if msg_type == "text":
        return message.get("text", {}).get("body", "")
    if msg_type == "button":
        return message.get("button", {}).get("text", "")
    if msg_type == "interactive":
        interactive = message.get("interactive", {})
        for key in ("button_reply", "list_reply"):
            if key in interactive:
                return interactive[key].get("title", "")
        return ""
    # For media/location/etc. we don't download the payload in this MVP,
    # just record the type so it still shows up in the conversation.
    return f"[{msg_type} message]"


def parse_webhook_payload(payload: dict) -> ParsedWebhookPayload:
    """Parse a Meta WhatsApp Cloud API webhook POST body into a flat structure."""
    result = ParsedWebhookPayload()

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            metadata = value.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id", "")

            contacts_by_wa_id = {
                c.get("wa_id"): c.get("profile", {}).get("name") for c in value.get("contacts", [])
            }

            for message in value.get("messages", []):
                wa_id = message.get("from", "")
                result.messages.append(
                    ParsedInboundMessage(
                        phone_number_id=phone_number_id,
                        contact_wa_id=wa_id,
                        contact_name=contacts_by_wa_id.get(wa_id),
                        wa_message_id=message.get("id", ""),
                        message_type=message.get("type", "text"),
                        text=_extract_text(message),
                        timestamp=message.get("timestamp", ""),
                        raw=message,
                    )
                )

            for status in value.get("statuses", []):
                result.statuses.append(
                    ParsedStatusUpdate(
                        phone_number_id=phone_number_id,
                        wa_message_id=status.get("id", ""),
                        status=status.get("status", ""),
                        recipient_id=status.get("recipient_id", ""),
                        raw=status,
                    )
                )

    return result
