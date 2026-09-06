"""
Tests for /admin/validation-report (Phase 4 Part B).

Coverage:
    * clean publishable data -> can_publish=True, no issues
    * published show without section -> missing_section blocking issue
    * published episode without duration -> missing_duration blocking issue
    * published episode missing artwork -> missing_artwork blocking issue
    * multiple issues across multiple entities are grouped correctly
    * draft content does NOT produce blocking errors
"""

from __future__ import annotations

import io

import pytest
from PIL import Image

from app.models.artwork import ArtworkType
from app.services.artwork_specs import get_spec
from app.services.storage import reset_storage_singleton


def _create_show(client, *, slug="show", title="Show", section="series",
                 status="draft", categories=("adventure",)):
    r = client.post(
        "/api/shows",
        json={
            "title": title,
            "slug": slug,
            "section": section,
            "status": status,
            "categories": list(categories),
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_season(client, show_id, season_number=1):
    r = client.post(
        "/api/seasons",
        json={"show_id": show_id, "season_number": season_number},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_episode(
    client, season_id, *,
    title="Ep", episode_number=1, language="en",
    content_group="show-s01e01", status="draft", duration=300,
):
    r = client.post(
        "/api/episodes",
        json={
            "season_id": season_id,
            "title": title,
            "episode_number": episode_number,
            "language": language,
            "content_group": content_group,
            "status": status,
            "duration": duration,
            "artwork": [],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _make_image(width: int, height: int) -> bytes:
    img = Image.new("RGB", (width, height), color=(10, 20, 30))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _upload_artwork(client, episode_id, atype: str, raw: bytes):
    return client.post(
        f"/api/episodes/{episode_id}/artwork",
        data={"artwork_type": atype},
        files={"file": (f"{atype}.jpg", raw, "image/jpeg")},
    )


def _upload_all_artwork(client, episode_id):
    """Upload a valid poster + banner + thumbnail for the episode."""
    for atype in ("poster", "banner", "thumbnail"):
        spec = get_spec(ArtworkType(atype))
        r = _upload_artwork(
            client, episode_id, atype, _make_image(spec.target_w, spec.target_h)
        )
        assert r.status_code == 201, r.text


# ── Tests ────────────────────────────────────────────────────────────────────


def test_validation_report_clean_publishable(client):
    """A published show + published episode with full artwork + duration
    produces can_publish=True and no issues."""
    show = _create_show(client, status="published")
    season = _create_season(client, show["id"])
    # Create as draft first so we can attach artwork, then publish.
    episode = _create_episode(client, season["id"], status="draft")
    _upload_all_artwork(client, episode["id"])
    pub = client.put(
        f"/api/episodes/{episode['id']}", json={"status": "published"}
    )
    assert pub.status_code == 200, pub.text

    r = client.get("/admin/validation-report")
    assert r.status_code == 200
    body = r.json()
    assert body["can_publish"] is True
    assert body["issues"] == []
    assert body["summary"]["blocking_issues"] == 0
    assert body["summary"]["shows_scanned"] == 1
    assert body["summary"]["episodes_scanned"] == 1


def test_validation_report_empty_db_is_publishable(client):
    """No published content -> can_publish=True."""
    r = client.get("/admin/validation-report")
    assert r.status_code == 200
    body = r.json()
    assert body["can_publish"] is True
    assert body["issues"] == []


def test_validation_report_published_show_without_section(client, db):
    """A published show without a section produces a missing_section issue.

    The `shows.section` column is now nullable at the DB level (the
    Pydantic API still requires it) so this test inserts a published
    show directly via the ORM with section=None.
    """
    from app.models.show import Show, ShowCategory, ShowStatus

    show = Show(
        title="Pub No Sec",
        slug="pub-no-sec",
        synopsis=None,
        section=None,
        status=ShowStatus.PUBLISHED,
    )
    show.categories = [ShowCategory.ADVENTURE]
    db.add(show)
    db.commit()

    r = client.get("/admin/validation-report")
    body = r.json()
    assert body["can_publish"] is False
    types = {i["type"] for i in body["issues"]}
    assert "missing_section" in types
    sec_issue = next(i for i in body["issues"] if i["type"] == "missing_section")
    assert sec_issue["entity"] == "show"
    assert sec_issue["entity_id"] == show.id
    assert "Pub No Sec" in sec_issue["message"]
    assert sec_issue["severity"] == "blocking"


def test_validation_report_published_episode_without_duration(client, db):
    """A published episode with NULL duration surfaces missing_duration."""
    show = _create_show(client, status="published")
    season = _create_season(client, show["id"])
    # Create as draft with duration; upload artwork; publish.
    episode = _create_episode(
        client, season["id"], status="draft", duration=300
    )
    _upload_all_artwork(client, episode["id"])
    pub = client.put(
        f"/api/episodes/{episode['id']}", json={"status": "published"}
    )
    assert pub.status_code == 200, pub.text

    # Strip duration directly via ORM to bypass Pydantic enforcement.
    from app.models.episode import Episode
    ep = db.get(Episode, episode["id"])
    ep.duration = None
    db.commit()

    r = client.get("/admin/validation-report")
    body = r.json()
    assert body["can_publish"] is False
    types = {i["type"] for i in body["issues"]}
    assert "missing_duration" in types


def test_validation_report_published_episode_missing_artwork(client, db):
    """A published episode with only partial artwork surfaces
    missing_artwork."""
    show = _create_show(client, status="published")
    season = _create_season(client, show["id"])
    # Create as draft; attach ONLY poster; publish via direct ORM so we
    # bypass the missing_artwork enforcement on PUT updates.
    episode = _create_episode(
        client, season["id"], status="draft", duration=300
    )
    spec = get_spec(ArtworkType.POSTER)
    r = _upload_artwork(
        client, episode["id"], "poster", _make_image(spec.target_w, spec.target_h)
    )
    assert r.status_code == 201

    from app.models.episode import Episode, EpisodeStatus
    ep = db.get(Episode, episode["id"])
    ep.status = EpisodeStatus.PUBLISHED
    db.commit()

    r = client.get("/admin/validation-report")
    body = r.json()
    assert body["can_publish"] is False
    types = {i["type"] for i in body["issues"]}
    assert "missing_artwork" in types
    art_issue = next(i for i in body["issues"] if i["type"] == "missing_artwork")
    assert art_issue["entity"] == "episode"
    assert art_issue["entity_id"] == episode["id"]
    fields_missing = set(art_issue["fields"]["missing_types"])
    assert fields_missing == {"banner", "thumbnail"}


def test_validation_report_groups_multiple_issues(client, db):
    """Multiple issues across multiple entities are reported individually
    and counted correctly in the summary."""
    show_a = _create_show(
        client, slug="a", title="A", status="published", section="featured"
    )
    show_b = _create_show(
        client, slug="b", title="B", status="published", section="series"
    )
    season_a = _create_season(client, show_a["id"])
    season_b = _create_season(client, show_b["id"])

    # Episode A1: published, has duration + artwork -> OK.
    ep_a = _create_episode(
        client, season_a["id"],
        content_group="a-s01e01", status="draft", duration=300,
    )
    _upload_all_artwork(client, ep_a["id"])
    pub_a = client.put(
        f"/api/episodes/{ep_a['id']}", json={"status": "published"}
    )
    assert pub_a.status_code == 200, pub_a.text

    # Episode B1: published, no artwork -> blocked.
    # We move to published via ORM so the missing_artwork PUT guard
    # doesn't kick in (we WANT the bad data to remain in DB for the
    # report to surface).
    ep_b = _create_episode(
        client, season_b["id"],
        content_group="b-s01e01", status="draft", duration=300,
    )
    from app.models.episode import Episode, EpisodeStatus
    db_ep_b = db.get(Episode, ep_b["id"])
    db_ep_b.status = EpisodeStatus.PUBLISHED
    db.commit()

    # Third published show with NO section so we get missing_section too.
    # Insert directly via the ORM now that section is nullable.
    from app.models.show import Show, ShowCategory, ShowStatus
    show_c = Show(
        title="C", slug="c", synopsis=None, section=None,
        status=ShowStatus.PUBLISHED,
    )
    show_c.categories = [ShowCategory.MUSIC]
    db.add(show_c)
    db.commit()

    r = client.get("/admin/validation-report")
    body = r.json()
    assert body["can_publish"] is False
    summary = body["summary"]
    assert summary["blocking_issues"] == 2
    assert summary["by_type"]["missing_artwork"] == 1
    assert summary["by_type"]["missing_section"] == 1
    assert summary["shows_scanned"] == 3
    assert summary["episodes_scanned"] == 2
    assert len(body["issues"]) == 2


def test_validation_report_draft_content_ignored(client):
    """Draft shows / episodes must NOT generate blocking errors."""
    show = _create_show(client, status="draft")
    season = _create_season(client, show["id"])
    _create_episode(
        client, season["id"], status="draft", duration=None
    )

    r = client.get("/admin/validation-report")
    body = r.json()
    assert body["can_publish"] is True
    assert body["issues"] == []
    assert body["summary"]["shows_scanned"] == 0
    assert body["summary"]["episodes_scanned"] == 0


def test_validation_report_removed_episode_ignored(client, db):
    """Episodes with status='removed' are not 'published' so they
    should NOT block the report even if they lack artwork."""
    show = _create_show(client, status="published")
    season = _create_season(client, show["id"])
    ep = _create_episode(
        client, season["id"], status="draft", duration=300
    )

    from app.models.episode import Episode, EpisodeStatus
    db_ep = db.get(Episode, ep["id"])
    db_ep.status = EpisodeStatus.REMOVED
    db.commit()

    r = client.get("/admin/validation-report")
    body = r.json()
    assert body["can_publish"] is True
    assert body["issues"] == []


# ── Storage singleton cleanup (so other tests start fresh) ──────────────────


@pytest.fixture(autouse=True)
def _reset_storage_after_test():
    reset_storage_singleton()
    yield
    reset_storage_singleton()