"""Describe a column without repeating any of its values.

Everything a profile says is about form: the type, how many cells are empty,
how many different values there are, and what a value looks like. The words in
a profile come from this file, never from the data.
"""

from __future__ import annotations

import datetime as dt
import unicodedata
from collections import Counter
from dataclasses import dataclass

import polars as pl

# Shapes are worked out from at most this many values per column.
SHAPE_SAMPLE_SIZE = 2_000
# A pattern is reported when this share of the sampled values follow it.
PATTERN_SHARE = 0.9
PATTERN_MAX_LENGTH = 24
# Longer runs of digits are identifiers, not numbers anyone does sums with.
MAX_INTEGER_DIGITS = 18

_INTEGER = r"^[+-]?\d+$"
_DIGITS = r"^\d+$"
_LEADING_ZERO = r"^[+-]?0\d"
_NUMBER = r"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$"
_BOOLEAN_WORDS = ("true", "false", "yes", "no", "t", "f", "y", "n")
_DATETIME = r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$"
_YEAR_FIRST = r"^\d{4}([-/])\d{1,2}([-/])\d{1,2}$"
_YEAR_LAST = r"^(\d{1,2})([-/.])(\d{1,2})[-/.]\d{4}$"


@dataclass(frozen=True)
class ColumnProfile:
    name: str
    type: str
    null_rate: float
    distinct_count: int
    unique_rate: float
    shape: str

    def to_json(self) -> dict[str, object]:
        return {
            "name": self.name,
            "type": self.type,
            "nullRate": self.null_rate,
            "distinctCount": self.distinct_count,
            "uniqueRate": self.unique_rate,
            "shape": self.shape,
        }


def profile_frame(frame: pl.DataFrame) -> list[ColumnProfile]:
    return [profile_column(name, frame.get_column(name)) for name in frame.columns]


def profile_column(name: str, values: pl.Series) -> ColumnProfile:
    total = values.len()
    values = _clean(values)
    present = values.drop_nulls()
    count = present.len()
    null_rate = round((total - count) / total, 6) if total else 0.0
    if count == 0:
        return ColumnProfile(name, "empty", null_rate, 0, 0.0, "no values")
    distinct = _distinct_count(present)
    kind, shape = _describe(present)
    return ColumnProfile(
        name=name,
        type=kind,
        null_rate=null_rate,
        distinct_count=distinct,
        unique_rate=round(distinct / count, 6),
        shape=shape,
    )


def _clean(values: pl.Series) -> pl.Series:
    """Text is trimmed, and a cell with nothing in it counts as empty."""
    if values.dtype in (pl.Categorical, pl.Enum):
        values = values.cast(pl.String)
    if values.dtype == pl.String:
        trimmed = values.str.strip_chars()
        return trimmed.set(trimmed == "", None)
    if values.dtype.is_float():
        return values.fill_nan(None)
    return values


def _distinct_count(present: pl.Series) -> int:
    try:
        return present.n_unique()
    except pl.exceptions.PolarsError:
        # Nested values cannot always be compared, so count them all as different.
        return present.len()


def _describe(present: pl.Series) -> tuple[str, str]:
    dtype = present.dtype
    if dtype == pl.String:
        return _describe_text(present)
    if dtype == pl.Boolean:
        return "boolean", "true or false"
    if dtype.is_integer():
        return "integer", _whole_number_shape(present)
    if dtype.is_float() or dtype.is_decimal():
        as_float = present.cast(pl.Float64)
        finite = as_float.filter(as_float.is_finite())
        if finite.len() > 0 and bool((finite == finite.round(0)).all()):
            return "integer", _whole_number_shape(finite)
        return "number", "decimal numbers"
    if dtype == pl.Date:
        return "date", "dates"
    if dtype == pl.Datetime:
        at_midnight = present.dt.time() == dt.time(0, 0, 0)
        if bool(at_midnight.all()):
            return "date", "dates"
        return "datetime", "dates with a time"
    if dtype in (pl.List, pl.Array, pl.Struct):
        return "text", "nested values"
    return "text", "other values"


def _span(low: int, high: int, unit: str) -> str:
    plural = unit if high == 1 else f"{unit}s"
    if low == high:
        return f"{low} {plural}"
    return f"{low} to {high} {plural}"


def _whole_number_shape(present: pl.Series) -> str:
    if present.dtype.is_integer():
        lengths = present.cast(pl.Int128).abs().cast(pl.String).str.len_chars()
    else:
        # A float can be far larger than any integer type holds, so its digits
        # are counted from its size instead of by writing it out.
        size = present.abs().round(0).clip(lower_bound=1.0)
        lengths = (size.log10().floor() + 1).cast(pl.Int64)
    shape = f"whole numbers, {_span(int(lengths.min()), int(lengths.max()), 'digit')}"
    if bool((present < 0).any()):
        shape += ", some negative"
    return shape


def _all_match(present: pl.Series, pattern: str) -> bool:
    return bool(present.str.contains(pattern).all())


def _describe_text(present: pl.Series) -> tuple[str, str]:
    if _all_match(present, _INTEGER):
        digits = present.str.replace_all(r"^[+-]", "").str.len_chars()
        low, high = int(digits.min()), int(digits.max())
        if bool(present.str.contains(_LEADING_ZERO).any()):
            # Leading zeros are part of an identifier, so it must stay text.
            return "text", f"{_span(low, high, 'digit')}, some with leading zeros"
        if high > MAX_INTEGER_DIGITS:
            return "text", _span(low, high, "digit")
        shape = f"whole numbers, {_span(low, high, 'digit')}"
        if bool(present.str.starts_with("-").any()):
            shape += ", some negative"
        return "integer", shape
    if _all_match(present, _NUMBER):
        return "number", "decimal numbers"
    if bool(present.str.to_lowercase().is_in(_BOOLEAN_WORDS).all()):
        return "boolean", "true or false"
    if _all_match(present, _DATETIME):
        return "datetime", "dates with a time, like YYYY-MM-DD HH:MM"
    date_shape = _date_shape(present)
    if date_shape is not None:
        return "date", date_shape
    return "text", _text_shape(present)


def _date_shape(present: pl.Series) -> str | None:
    if _all_match(present, _YEAR_FIRST):
        separator = "/" if bool(present.str.contains("/").any()) else "-"
        return f"dates like YYYY{separator}MM{separator}DD"
    if not _all_match(present, _YEAR_LAST):
        return None
    parts = present.str.extract_groups(_YEAR_LAST)
    first = parts.struct.field("1").cast(pl.Int32)
    separator = parts.struct.field("2").mode().sort().item(0)
    second = parts.struct.field("3").cast(pl.Int32)
    first_max, second_max = int(first.max()), int(second.max())
    if first_max > 31 or second_max > 31 or (first_max > 12 and second_max > 12):
        return None
    if first_max > 12:
        order = ("DD", "MM")
    elif second_max > 12:
        order = ("MM", "DD")
    else:
        # Nothing in the column tells the two orders apart.
        return f"dates like MM{separator}DD{separator}YYYY or DD{separator}MM{separator}YYYY"
    return f"dates like {order[0]}{separator}{order[1]}{separator}YYYY"


def _text_shape(present: pl.Series) -> str:
    lengths = present.str.len_chars()
    parts = [f"text, {_span(int(lengths.min()), int(lengths.max()), 'character')}"]
    multiline = present.str.contains("\n")
    if bool(multiline.any()):
        parts.append(
            "several lines per cell" if bool(multiline.all()) else "several lines in some cells"
        )
    else:
        pattern = _common_pattern(present)
        if pattern is not None:
            parts.append(f"pattern {pattern}")
    has_letters = present.str.contains(r"\p{L}")
    if bool(has_letters.any()) and bool((present == present.str.to_uppercase()).all()):
        parts.append("all uppercase")
    return ", ".join(parts)


def mask(value: str) -> str:
    """Replace every digit with 9 and every letter with A, keeping punctuation.

    Only punctuation, plain symbols, and spaces are kept as they are. Anything
    else, such as a vowel sign or a pictograph, is part of what a cell says.
    """
    return "".join(_mask_character(character) for character in value)


def _mask_character(character: str) -> str:
    category = unicodedata.category(character)
    if category.startswith("N"):
        return "9"
    if category.startswith("P") or category in ("Sm", "Sc", "Sk", "Zs"):
        return character
    return "A"


def _common_pattern(present: pl.Series) -> str | None:
    sample = present.head(SHAPE_SAMPLE_SIZE).to_list()
    masks = Counter(mask(value) for value in sample)
    pattern, hits = masks.most_common(1)[0]
    if hits / len(sample) < PATTERN_SHARE or len(pattern) > PATTERN_MAX_LENGTH:
        return None
    if not any(character in "A9" for character in pattern):
        # A value made only of punctuation would be repeated as it is.
        return None
    if pattern.strip("A") == "":
        # Plain words of one length say nothing the length did not already say.
        return None
    return pattern
