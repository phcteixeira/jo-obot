import hashlib
import hmac
import json

from httpx import AsyncClient

APP_SECRET = "app-secret-value"
VERIFY_TOKEN = "verify-me"


def _sign(payload: bytes) -> str:
    digest = hmac.new(APP_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


async def _create_agent_with_credential(client: AsyncClient) -> str:
    agent = await client.post("/agents", json={"name": "Agente Teste"})
    agent_id = agent.json()["id"]
    await client.put(
        f"/agents/{agent_id}/credentials",
        json={
            "phone_number_id": "123",
            "access_token": "token",
            "app_secret": APP_SECRET,
            "verify_token": VERIFY_TOKEN,
        },
    )
    return agent_id


async def test_webhook_verification_success(client: AsyncClient):
    agent_id = await _create_agent_with_credential(client)
    response = await client.get(
        f"/webhook/{agent_id}",
        params={"hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "abc123"},
    )
    assert response.status_code == 200
    assert response.text == "abc123"


async def test_webhook_verification_wrong_token(client: AsyncClient):
    agent_id = await _create_agent_with_credential(client)
    response = await client.get(
        f"/webhook/{agent_id}",
        params={"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "abc123"},
    )
    assert response.status_code == 403


async def test_webhook_verification_missing_agent(client: AsyncClient):
    response = await client.get(
        "/webhook/does-not-exist",
        params={"hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "abc123"},
    )
    assert response.status_code == 404


def _inbound_payload() -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "waba-1",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"display_phone_number": "+1", "phone_number_id": "123"},
                            "contacts": [{"profile": {"name": "Maria"}, "wa_id": "5511999999999"}],
                            "messages": [
                                {
                                    "from": "5511999999999",
                                    "id": "wamid.abc",
                                    "timestamp": "1700000000",
                                    "type": "text",
                                    "text": {"body": "Oi, tudo bem?"},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }


async def test_webhook_receives_message_with_valid_signature(client: AsyncClient):
    agent_id = await _create_agent_with_credential(client)
    body = json.dumps(_inbound_payload()).encode()

    response = await client.post(
        f"/webhook/{agent_id}",
        content=body,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": _sign(body)},
    )
    assert response.status_code == 200
    assert response.json()["messages_received"] == 1

    conversations = await client.get(f"/agents/{agent_id}/conversations")
    assert len(conversations.json()) == 1
    conv = conversations.json()[0]
    assert conv["contact_wa_id"] == "5511999999999"
    assert conv["contact_name"] == "Maria"

    detail = await client.get(f"/conversations/{conv['id']}")
    messages = detail.json()["messages"]
    assert len(messages) == 1
    assert messages[0]["content"] == "Oi, tudo bem?"
    assert messages[0]["direction"] == "inbound"
    assert messages[0]["wa_message_id"] == "wamid.abc"


async def test_webhook_rejects_invalid_signature(client: AsyncClient):
    agent_id = await _create_agent_with_credential(client)
    body = json.dumps(_inbound_payload()).encode()

    response = await client.post(
        f"/webhook/{agent_id}",
        content=body,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": "sha256=deadbeef"},
    )
    assert response.status_code == 403

    conversations = await client.get(f"/agents/{agent_id}/conversations")
    assert conversations.json() == []
