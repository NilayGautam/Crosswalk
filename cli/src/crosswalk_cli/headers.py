"""Tell a header row from a first row of data.

Every reader takes the first row of a file as its column names, and column
names are sent. A file with no header row would send its first row of cell
values that way, so such a file is held back instead.

Parquet and Stata files carry their column names in the file's schema, so only
CSV, TSV, and Excel files are checked.
"""

from __future__ import annotations

import re

import polars as pl

from crosswalk_cli.profile import mask

# How many values under each column are compared with its name.
SAMPLE_SIZE = 200
# A name is taken for a value when at least this share of the values beneath
# it have exactly its shape.
SAME_SHAPE_SHARE = 0.5

_DECIMAL = re.compile(r"^[+-]?\d*\.\d+$")
_DIGITS = re.compile(r"^[+-]?\d+$")
_DATE = re.compile(r"^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$")


class HeaderLooksLikeData(Exception):
    """The first row of a table looks like a row of data, not column names."""


def check_header(frame: pl.DataFrame, sheet: str | None = None) -> None:
    """Raise HeaderLooksLikeData when the column names look like cell values."""
    suspects = [name for name in frame.columns if _looks_like_value(name, frame.get_column(name))]
    if not suspects:
        return
    where = "its first row" if sheet is None else f"the first row of sheet {sheet}"
    shown = ", ".join(suspects[:3]) + (", ..." if len(suspects) > 3 else "")
    raise HeaderLooksLikeData(
        f"held back, because {where} looks like data rather than column names ({shown}). "
        "Column names are sent, so add a header row and run crosswalk again."
    )


def _looks_like_value(name: str, values: pl.Series) -> bool:
    name = name.strip()
    if _DECIMAL.match(name):
        # Nobody names a column 12.5.
        return True
    if not (_DIGITS.match(name) or _DATE.match(name)):
        return False
    # A number or a date can be a real name, such as a year in a wide panel.
    # It is a value when the values beneath it have the very same shape.
    texts = _texts(values)
    if not texts:
        return False
    shape = mask(name)
    same = sum(1 for text in texts if mask(text) == shape)
    return same / len(texts) >= SAME_SHAPE_SHARE


def _texts(values: pl.Series) -> list[str]:
    present = values.drop_nulls().head(SAMPLE_SIZE)
    if present.dtype.is_float():
        finite = present.filter(present.is_finite())
        if finite.len() > 0 and bool((finite == finite.round(0)).all()):
            present = finite.cast(pl.Int64)
    if present.dtype in (pl.Date, pl.Datetime):
        present = present.dt.strftime("%Y-%m-%d")
    texts = present.cast(pl.String).str.strip_chars().to_list()
    return [text for text in texts if text]
