from httpx import AsyncClient


async def _create_agent(client: AsyncClient) -> str:
    response = await client.post("/agents", json={"name": "Agente Teste"})
    return response.json()["id"]


async def test_upsert_and_get_credential(client: AsyncClient):
    agent_id = await _create_agent(client)

    response = await client.put(
        f"/agents/{agent_id}/credentials",
        json={
            "phone_number_id": "123",
            "waba_id": "456",
            "access_token": "super-secret-token-value",
            "app_secret": "app-secret-value",
            "verify_token": "verify-me",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["phone_number_id"] == "123"
    assert body["has_app_secret"] is True
    # the raw token must never be echoed back
    assert "super-secret-token-value" not in response.text
    assert body["access_token_masked"].startswith("supe")

    agent = await client.get(f"/agents/{agent_id}")
    assert agent.json()["has_whatsapp_credential"] is True

    response = await client.get(f"/agents/{agent_id}/credentials")
    assert response.status_code == 200
    assert response.json()["phone_number_id"] == "123"


async def test_upsert_is_idempotent_update(client: AsyncClient):
    agent_id = await _create_agent(client)
    payload = {
        "phone_number_id": "123",
        "access_token": "token-one",
        "verify_token": "verify-me",
    }
    first = await client.put(f"/agents/{agent_id}/credentials", json=payload)
    payload["phone_number_id"] = "999"
    second = await client.put(f"/agents/{agent_id}/credentials", json=payload)

    assert first.json()["id"] == second.json()["id"]
    assert second.json()["phone_number_id"] == "999"


async def test_get_credential_missing_404(client: AsyncClient):
    agent_id = await _create_agent(client)
    response = await client.get(f"/agents/{agent_id}/credentials")
    assert response.status_code == 404
