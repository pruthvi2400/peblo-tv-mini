"""Tests for pagination + filter parameters on list endpoints."""

from __future__ import annotations


def _create_show(client, slug, title, section="series"):
    r = client.post(
        "/api/shows",
        json={
            "title": title,
            "slug": slug,
            "section": section,
            "status": "draft",
            "categories": ["adventure"],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_shows_pagination(client):
    for i in range(25):
        _create_show(
            client, slug=f"show-{i:02d}", title=f"Show {i:02d}"
        )

    r = client.get("/api/shows?page=1&page_size=10")
    body = r.json()
    assert r.status_code == 200
    assert body["total"] == 25
    assert body["page"] == 1
    assert body["page_size"] == 10
    assert len(body["items"]) == 10

    r = client.get("/api/shows?page=3&page_size=10")
    body = r.json()
    assert body["page"] == 3
    assert len(body["items"]) == 5  # 25 - 2*10 = 5 left on page 3


def test_shows_search_filter(client):
    _create_show(client, slug="alpha", title="Alpha Adventures")
    _create_show(client, slug="beta", title="Beta Tales")
    _create_show(client, slug="gamma", title="Alpha Returns")

    r = client.get("/api/shows?search=alpha")
    body = r.json()
    titles = [s["title"] for s in body["items"]]
    assert body["total"] == 2
    assert set(titles) == {"Alpha Adventures", "Alpha Returns"}


def test_shows_status_filter(client):
    _create_show(client, slug="d1", title="Draft One")
    pub = _create_show(client, slug="p1", title="Pub One")
    client.put(f"/api/shows/{pub['id']}", json={"status": "published"})

    r = client.get("/api/shows?status=draft")
    body = r.json()
    titles = [s["title"] for s in body["items"]]
    assert "Draft One" in titles
    assert "Pub One" not in titles

    r = client.get("/api/shows?status=published")
    body = r.json()
    titles = [s["title"] for s in body["items"]]
    assert "Pub One" in titles
    assert "Draft One" not in titles


def test_shows_section_filter(client):
    _create_show(client, slug="s1", title="Series One", section="series")
    _create_show(client, slug="s2", title="Songs One", section="songs")

    r = client.get("/api/shows?section=songs")
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Songs One"


def test_episodes_language_filter(client):
    show = _create_show(client, slug="lng", title="LNG")
    season = client.post(
        "/api/seasons",
        json={"show_id": show["id"], "season_number": 1},
    ).json()

    for lang in ("en", "hi"):
        r = client.post(
            "/api/episodes",
            json={
                "season_id": season["id"],
                "title": f"Ep {lang}",
                "episode_number": 1,
                "language": lang,
                "content_group": f"lng-s01e01-{lang}",
                "status": "draft",
                "duration": 300,
                "artwork": [],
            },
        )
        assert r.status_code == 201, r.text

    r = client.get("/api/episodes?language=hi")
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["language"] == "hi"
