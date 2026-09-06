"""
Static reference values sourced from reference.json.

These constants are the single source of truth for validation. They match
the lists in `reference.json`:

- SECTIONS:     platform placement sections
- CATEGORIES:   show-level content categories
- LANGUAGES:    ISO 639-1 language codes supported by the platform

The SQLAlchemy model enums (ShowSection, ShowCategory, Episode language)
also derive their values from these lists, but the model enums are used
only inside model definitions. Pydantic schemas and service-level
validation should use the constants below so validation logic stays
in one place.
"""

# Sourced from reference.json -> "sections"
SECTIONS: list[str] = [
    "featured",
    "series",
    "minisodes",
    "songs",
]

# Sourced from reference.json -> "categories"
CATEGORIES: list[str] = [
    "adventure",
    "folk",
    "friendship",
    "india",
    "language",
    "learning",
    "maths",
    "music",
    "nature",
    "reading",
    "science",
    "singalong",
    "stories",
    "travel",
    "values",
]

# Sourced from reference.json -> "languages"
LANGUAGES: list[str] = ["en", "hi"]


# ── Lookup sets (faster membership checks) ────────────────────────────────────
SECTION_SET: frozenset[str] = frozenset(SECTIONS)
CATEGORY_SET: frozenset[str] = frozenset(CATEGORIES)
LANGUAGE_SET: frozenset[str] = frozenset(LANGUAGES)


def is_valid_section(value: str | None) -> bool:
    """Return True iff `value` is one of the known platform sections."""
    return value in SECTION_SET


def is_valid_category(value: str) -> bool:
    """Return True iff `value` is one of the known content categories."""
    return value in CATEGORY_SET


def is_valid_language(value: str) -> bool:
    """Return True iff `value` is one of the supported language codes."""
    return value in LANGUAGE_SET