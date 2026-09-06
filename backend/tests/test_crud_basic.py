"""Tests for basic CRUD happy-path on shows, seasons, and episodes."""

from __future__ import annotations


def _create_show(client, **overrides):
    payload = {
        "title": "My Show",
        "slug": "my-show",
        "synopsis": "A show.",
        "section": "series",
        "status": "draft",
        "categories": ["adventure", "india"],
    }
    payload.update(overrides)
    r = client.post("/api/shows", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_and_get_show(client):
    show = _create_show(client)
    assert show["slug"] == "my-show"
    assert show["title"] == "My Show"
    assert set(show["categories"]) == {"adventure", "india"}

    r = client.get(f"/api/shows/{show['id']}")
    assert r.status_code == 200
    fetched = r.json()
    assert fetched["id"] == show["id"]


def test_update_show_partial(client):
    show = _create_show(client)
    r = client.put(
        f"/api/shows/{show['id']}",
        json={"title": "Renamed"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "Renamed"
    # slug unchanged
    assert r.json()["slug"] == "my-show"


def test_delete_show(client):
    show = _create_show(client)
    r = client.delete(f"/api/shows/{show['id']}")
    assert r.status_code == 204
    r = client.get(f"/api/shows/{show['id']}")
    assert r.status_code == 404


def test_get_missing_show_returns_404(client):
    r = client.get("/api/shows/999999")
    assert r.status_code == 404


def test_create_list_get_update_delete_season(client):
    show = _create_show(client)
    r = client.post(
        "/api/seasons",
        json={"show_id": show["id"], "season_number": 1},
    )
    assert r.status_code == 201, r.text
    season = r.json()

    r = client.get(f"/api/seasons/{season['id']}")
    assert r.status_code == 200

    r = client.get("/api/seasons", params={"show_id": show["id"]})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == season["id"]

    r = client.delete(f"/api/seasons/{season['id']}")
    assert r.status_code == 204


def test_create_get_update_delete_episode(client):
    show = _create_show(client)
    season = client.post(
        "/api/seasons",
        json={"show_id": show["id"], "season_number": 1},
    ).json()

    r = client.post(
        "/api/episodes",
        json={
            "season_id": season["id"],
            "title": "Pilot",
            "episode_number": 1,
            "language": "en",
            "content_group": "my-show-s01e01",
            "status": "draft",
            "duration": 300,
            "artwork": [],
        },
    )
    assert r.status_code == 201, r.text
    ep = r.json()
    assert ep["title"] == "Pilot"
    assert ep["duration"] == 300

    r = client.put(
        f"/api/episodes/{ep['id']}",
        json={"title": "Pilot (renamed)"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Pilot (renamed)"

    r = client.delete(f"/api/episodes/{ep['id']}")
    assert r.status_code == 204


def test_get_missing_episode_returns_404(client):
    r = client.get("/api/episodes/999999")
    assert r.status_code == 404
