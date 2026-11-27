"""What the server accepts, as written in packages/contract/src/index.ts.

A card outside these limits is left out and reported, so it never makes the
server refuse the cards sent with it.
"""

from __future__ import annotations

import json

MAX_DATASETS_PER_REQUEST = 500
# The server refuses a body over 16 MB. Staying well under leaves room for the
# difference between how a card is measured here and how it is encoded.
MAX_REQUEST_BYTES = 8 * 1024 * 1024
MAX_COLUMNS = 5000
MAX_KEY_LENGTH = 1000
MAX_PATH_LENGTH = 1000
MAX_NAME_LENGTH = 500
MAX_SHEET_LENGTH = 500
MAX_COLUMN_NAME_LENGTH = 500
MAX_ROW_COUNT = 2_147_483_647


def _length(text: str) -> int:
    """Length the way the server counts it, in UTF-16 code units."""
    return len(text.encode("utf-16-le")) // 2


def card_bytes(card: dict) -> int:
    """An upper bound on the bytes this card takes in a request."""
    return len(json.dumps(card))


def problem(card: dict) -> str | None:
    """Why the server would refuse this card, or None when it would not."""
    columns = card["columns"]
    if card["rowCount"] > MAX_ROW_COUNT:
        return f"it has more than {MAX_ROW_COUNT:,} rows"
    if len(columns) > MAX_COLUMNS:
        return f"it has {len(columns):,} columns, and the most Crosswalk takes is {MAX_COLUMNS:,}"
    if any(_length(column["name"]) > MAX_COLUMN_NAME_LENGTH for column in columns):
        return (
            f"a column name is longer than {MAX_COLUMN_NAME_LENGTH} characters, "
            "so its first line may not be a header"
        )
    if _length(card["key"]) > MAX_KEY_LENGTH or _length(card["path"]) > MAX_PATH_LENGTH:
        return f"its path is longer than {MAX_PATH_LENGTH:,} characters"
    if _length(card["name"]) > MAX_NAME_LENGTH:
        return f"its name is longer than {MAX_NAME_LENGTH} characters"
    if card["sheet"] is not None and _length(card["sheet"]) > MAX_SHEET_LENGTH:
        return f"its sheet name is longer than {MAX_SHEET_LENGTH} characters"
    if card_bytes(card) > MAX_REQUEST_BYTES:
        return "its column names are too long to send together"
    return None
