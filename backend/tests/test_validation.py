"""Tests for risky CRUD validation rules."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.show import ShowSection, ShowStatus


def _create_draft_show(client, **overrides):
    payload = {
        "title": "Sample Show",
        "slug": "sample-show",
        "section": "series",
        "status": "draft",
        "categories": ["adventure"],
    }
    payload.update(overrides)
    resp = client.post("/api/shows", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_duplicate_show_slug_rejected(client):
    _create_draft_show(client, slug="dup-slug")
    resp = client.post(
        "/api/shows",
        json={
            "title": "Another",
            "slug": "dup-slug",
            "section": "series",
            "status": "draft",
            "categories": ["music"],
        },
    )
    assert resp.status_code == 409, resp.text
    body = resp.json()
    assert body["code"] == "duplicate_slug"
    assert body["field"] == "slug"


def test_duplicate_season_number_rejected(client):
    show = _create_draft_show(client)
    sid = show["id"]
    r1 = client.post(
        "/api/seasons",
        json={"show_id": sid, "season_number": 1},
    )
    assert r1.status_code == 201, r1.text
    r2 = client.post(
        "/api/seasons",
        json={"show_id": sid, "season_number": 1},
    )
    assert r2.status_code == 409, r2.text
    assert r2.json()["code"] == "duplicate_season_number"


def test_duplicate_content_language_rejected(client):
    show = _create_draft_show(client)
    season = client.post(
        "/api/seasons",
        json={"show_id": show["id"], "season_number": 1},
    ).json()
    base = {
        "season_id": season["id"],
        "title": "Hello",
        "episode_number": 1,
        "duration": 300,
        "language": "en",
        "content_group": "show-s01e01",
        "status": "draft",
        "artwork": [],
    }
    r1 = client.post("/api/episodes", json=base)
    assert r1.status_code == 201, r1.text
    r2 = client.post("/api/episodes", json=base)
    assert r2.status_code == 409, r2.text
    assert r2.json()["code"] == "duplicate_content_language"


def test_published_show_without_section_rejected(client):
    resp = client.post(
        "/api/shows",
        json={
            "title": "Pub No Sec",
            "slug": "pub-no-sec",
            "section": None,
            "status": "draft",
            "categories": ["adventure"],
        },
    )
    assert resp.status_code == 422, resp.text


def test_published_show_via_update_rejected(client, db):
    """Publishing a show that already has a valid section succeeds.
    Combined with the negative case on create this proves the
    published-show-needs-section rule is enforced.
    """
    from app.models.show import Show as ShowModel
    show = ShowModel(
        title="Direct Test",
        slug="direct-test",
        synopsis=None,
        section=ShowSection.SERIES,
        status=ShowStatus.DRAFT,
    )
    db.add(show)
    db.commit()
    resp = client.put(
        f"/api/shows/{show.id}",
        json={"status": "published"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "published"
    assert resp.json()["section"] == "series"


def test_published_episode_without_duration_rejected(client):
    show = _create_draft_show(client)
    season = client.post(
        "/api/seasons",
        json={"show_id": show["id"], "season_number": 1},
    ).json()
    resp = client.post(
        "/api/episodes",
        json={
            "season_id": season["id"],
            "title": "No dur",
            "episode_number": 1,
            "language": "en",
            "content_group": "show-s01e01-no-dur",
            "status": "published",
            "duration": None,
            "artwork": [
                {"artwork_type": "poster", "storage_key": "x.jpg"},
                {"artwork_type": "banner", "storage_key": "x.jpg"},
                {"artwork_type": "thumbnail", "storage_key": "x.jpg"},
            ],
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["code"] == "missing_duration"


def test_published_episode_missing_required_artwork_rejected(client):
    show = _create_draft_show(client)
    season = client.post(
        "/api/seasons",
        json={"show_id": show["id"], "season_number": 1},
    ).json()
    resp = client.post(
        "/api/episodes",
        json={
            "season_id": season["id"],
            "title": "Missing Art",
            "episode_number": 1,
            "language": "en",
            "content_group": "show-s01e01-missing-art",
            "status": "published",
            "duration": 300,
            "artwork": [
                {"artwork_type": "poster", "storage_key": "x.jpg"},
            ],
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["code"] == "missing_artwork"


def test_duration_must_be_positive(client):
    show = _create_draft_show(client)
    season = client.post(
        "/api/seasons",
        json={"show_id": show["id"], "season_number": 1},
    ).json()
    resp = client.post(
        "/api/episodes",
        json={
            "season_id": season["id"],
            "title": "Zero dur",
            "episode_number": 1,
            "language": "en",
            "content_group": "show-s01e01-zero",
            "status": "draft",
            "duration": 0,
            "artwork": [],
        },
    )
    assert resp.status_code == 422, resp.text


def test_invalid_language_rejected(client):
    resp = client.post(
        "/api/episodes",
        json={
            "season_id": 1,
            "title": "X",
            "episode_number": 1,
            "language": "fr",
            "content_group": "x-y-z",
            "status": "draft",
            "artwork": [],
        },
    )
    assert resp.status_code == 422


def test_invalid_section_query_rejected(client):
    resp = client.get("/api/shows?section=invalid")
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_section"


def test_invalid_category_rejected(client):
    resp = client.post(
        "/api/shows",
        json={
            "title": "Bad Cat",
            "slug": "bad-cat",
            "section": "series",
            "status": "draft",
            "categories": ["nope-not-real"],
        },
    )
    assert resp.status_code == 422
