"""Tests for the seed_shows.json loader."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.models.show import Show
from app.models.season import Season
from app.models.episode import Episode
from app.models.artwork import ArtworkType
from app.services.seed import (
    EpisodeConflict,
    SeedResult,
    load_seed_shows,
)


SEED_PATH = Path(r"D:\iampr\downloads\seed_shows.json")


def _seed_once(db) -> SeedResult:
    """Run the loader and commit so other queries see the data."""
    result = load_seed_shows(db, SEED_PATH)
    db.commit()
    return result


def test_seed_loads_and_creates(db):
    """All shows, seasons, and unique episodes are created."""
    result = _seed_once(db)
    assert isinstance(result, SeedResult)
    assert result.shows_created >= 8  # 8 unique slugs in the seed
    # 95 rows total; one duplicate (content_group, language) is recorded
    # as a conflict and NOT created, so episodes_created == 94.
    assert result.episodes_created == 94
    assert len(result.episode_conflicts) == 1


def test_seed_is_idempotent(db):
    """Re-running the loader refreshes scalar fields and creates nothing."""
    _seed_once(db)
    result = load_seed_shows(db, SEED_PATH)
    db.commit()
    assert result.shows_created == 0
    assert result.episodes_created == 0
    assert result.shows_updated == 8  # refresh path
    # The same conflict is detected again on a second pass because the
    # conflicting row is still present in the seed. It is recorded but
    # NOT inserted -- so the existing episode count stays at 94.
    assert len(result.episode_conflicts) == 1
    assert result.episodes_created == 0


def test_seed_relationships(db):
    """Show -> Season -> Episode linkage is preserved."""
    _seed_once(db)

    motis = db.query(Show).filter_by(slug="motis-many-lives").one()
    seasons = db.query(Season).filter_by(show_id=motis.id).all()
    assert len(seasons) >= 1
    season_numbers = {s.season_number for s in seasons}
    assert 0 in season_numbers  # trailer season
    assert 1 in season_numbers

    season1 = next(s for s in seasons if s.season_number == 1)
    eps_s1 = db.query(Episode).filter_by(season_id=season1.id).all()
    assert len(eps_s1) > 0
    cgs = {(e.content_group, e.language) for e in eps_s1}
    # Both en and hi variants exist for the same content_group.
    has_en = any(lang == "en" for (_, lang) in cgs)
    has_hi = any(lang == "hi" for (_, lang) in cgs)
    assert has_en and has_hi


def test_seed_categories_union(db):
    """Categories are the union of every row in the show group."""
    _seed_once(db)
    motis = db.query(Show).filter_by(slug="motis-many-lives").one()
    cats = {c.value for c in motis.categories}
    assert {"adventure", "india", "friendship"} <= cats


def test_seed_artwork_respects_artwork_available(db):
    """The seed loader creates ONLY the artwork records listed in
    `artwork_available`. No synthetic poster/banner records are
    invented for episodes whose source rows list only [thumbnail]."""
    _seed_once(db)
    # ep_0093 lists only "thumbnail" and is published.
    ep = (
        db.query(Episode)
        .filter_by(content_group="motis-many-lives-s00e01", language="en")
        .one()
    )
    types = {a.artwork_type for a in ep.artwork}
    assert types == {ArtworkType.THUMBNAIL}
    # And it MUST NOT have been back-filled to satisfy validation.
    assert ArtworkType.POSTER not in types
    assert ArtworkType.BANNER not in types


def test_seed_published_episodes_may_have_missing_artwork(db):
    """The seed deliberately contains rows that violate the
    published-episode business rule (e.g. ep_0093 is published but only
    has [thumbnail] artwork). The seed must NOT silently fix that --
    missing artwork must remain detectable for the future
    validation-report endpoint.
    """
    _seed_once(db)
    # ep_0093 is "published" in the seed yet lists only [thumbnail].
    ep = (
        db.query(Episode)
        .filter_by(content_group="motis-many-lives-s00e01", language="en")
        .one()
    )
    assert ep.status.value == "published"
    types = {a.artwork_type for a in ep.artwork}
    # The rule requires poster, banner, AND thumbnail; this row has
    # only thumbnail. The seed preserves the imperfection.
    missing = (
        {ArtworkType.POSTER, ArtworkType.BANNER, ArtworkType.THUMBNAIL}
        - types
    )
    assert missing == {ArtworkType.POSTER, ArtworkType.BANNER}


def test_seed_duplicate_content_language_recorded_not_overwritten(db):
    """ep_0004 and ep_9001 collide on
    (content_group=motis-many-lives-s01e02, language=hi).
    The first row wins; the second is recorded as a conflict and
    NOT silently merged into the existing episode.
    """
    _seed_once(db)

    ep = (
        db.query(Episode)
        .filter_by(
            content_group="motis-many-lives-s01e02",
            language="hi",
        )
        .one()
    )
    # The kept episode is the FIRST row in seed_shows.json with that
    # (content_group, language) -- ep_0004 ("Rain on the Roof").
    # The colliding row ep_9001 ("The Lost Kite (v2)") must NOT have
    # overwritten it.
    assert ep.title == "Rain on the Roof"
    assert ep.episode_number == 2

    # Re-run the loader to get the conflict list for this run.
    result = load_seed_shows(db, SEED_PATH)
    db.commit()
    conflicts = [
        c
        for c in result.episode_conflicts
        if c.content_group == "motis-many-lives-s01e02"
        and c.language == "hi"
    ]
    assert len(conflicts) == 1
    assert conflicts[0].reason == "duplicate_content_language"
    assert conflicts[0].episode_id == "ep_9001"


def test_seed_show_status_published_if_any_episode_published(db):
    """Deterministic rule: a show's status is "published" if ANY row
    in its seed group has status="published"; otherwise "draft"."""
    _seed_once(db)
    # "motis-many-lives" has both published and draft rows in the
    # seed group -> Show.status must be "published".
    motis = db.query(Show).filter_by(slug="motis-many-lives").one()
    assert motis.status.value == "published"

    # "rhyme-rangers" only has status="draft" rows.
    rr = db.query(Show).filter_by(slug="rhyme-rangers").one()
    assert rr.status.value == "draft"


def test_seed_season_zero_treated_as_data(db):
    """Season 0 rows must be persisted; we do not strip trailers."""
    _seed_once(db)
    s0_count = db.query(Season).filter_by(season_number=0).count()
    assert s0_count >= 1
