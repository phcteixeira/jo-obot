from httpx import AsyncClient


async def test_create_and_get_agent(client: AsyncClient):
    response = await client.post(
        "/agents",
        json={
            "name": "Suporte Loja",
            "system_prompt": "Voce e um atendente simpatico.",
            "ai_provider": "anthropic",
            "ai_model": "claude-sonnet-5",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Suporte Loja"
    assert body["has_whatsapp_credential"] is False

    agent_id = body["id"]
    response = await client.get(f"/agents/{agent_id}")
    assert response.status_code == 200
    assert response.json()["id"] == agent_id


async def test_list_agents_empty(client: AsyncClient):
    response = await client.get("/agents")
    assert response.status_code == 200
    assert response.json() == []


async def test_update_agent(client: AsyncClient):
    create = await client.post("/agents", json={"name": "Bot 1"})
    agent_id = create.json()["id"]

    response = await client.patch(f"/agents/{agent_id}", json={"name": "Bot Atualizado", "is_active": False})
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Bot Atualizado"
    assert body["is_active"] is False


async def test_delete_agent(client: AsyncClient):
    create = await client.post("/agents", json={"name": "Temp"})
    agent_id = create.json()["id"]

    response = await client.delete(f"/agents/{agent_id}")
    assert response.status_code == 204

    response = await client.get(f"/agents/{agent_id}")
    assert response.status_code == 404


async def test_get_missing_agent_404(client: AsyncClient):
    response = await client.get("/agents/does-not-exist")
    assert response.status_code == 404
