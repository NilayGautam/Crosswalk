import datetime as dt
import json

import polars as pl
import pytest

from crosswalk_cli.profile import mask, profile_column, profile_frame


def profile(values, dtype=pl.String):
    return profile_column("column", pl.Series("column", values, dtype=dtype))


def test_empty_column():
    result = profile([None, "", "   "])
    assert result.type == "empty"
    assert result.null_rate == 1
    assert result.distinct_count == 0
    assert result.shape == "no values"


def test_column_with_no_rows():
    result = profile([])
    assert result.type == "empty"
    assert result.null_rate == 0


def test_blank_text_counts_as_empty():
    result = profile(["a", "", "  ", None])
    assert result.null_rate == 0.75
    assert result.distinct_count == 1


def test_whole_numbers_read_from_text():
    result = profile(["12", "4501", "-7"])
    assert result.type == "integer"
    assert result.shape == "whole numbers, 1 to 4 digits, some negative"


def test_identifier_with_leading_zeros_stays_text():
    result = profile(["001234", "012345", "123456"])
    assert result.type == "text"
    assert result.shape == "6 digits, some with leading zeros"


def test_very_long_digit_runs_are_identifiers():
    result = profile(["1234567890123456789012", "1234567890123456789013"])
    assert result.type == "text"
    assert result.shape == "22 digits"


def test_decimals():
    result = profile(["1.5", "-2", "3e4", ".25"])
    assert result.type == "number"
    assert result.shape == "decimal numbers"


def test_booleans():
    assert profile(["Yes", "no", "YES"]).type == "boolean"
    assert profile([True, False], dtype=pl.Boolean).shape == "true or false"


def test_zero_and_one_are_numbers_not_booleans():
    assert profile(["0", "1", "1"]).type == "integer"


@pytest.mark.parametrize(
    ("values", "shape"),
    [
        (["2024-01-31", "2023-12-01"], "dates like YYYY-MM-DD"),
        (["2024/01/31"], "dates like YYYY/MM/DD"),
        (["01-31-2024", "12-01-2023"], "dates like MM-DD-YYYY"),
        (["31/01/2024", "01/12/2023"], "dates like DD/MM/YYYY"),
        (["01/02/2024", "03/04/2023"], "dates like MM/DD/YYYY or DD/MM/YYYY"),
    ],
)
def test_dates_read_from_text(values, shape):
    result = profile(values)
    assert result.type == "date"
    assert result.shape == shape


def test_impossible_dates_are_text():
    assert profile(["40/40/2024"]).type == "text"


def test_datetimes_read_from_text():
    result = profile(["2024-01-31 10:15:00", "2024-02-01T08:00"])
    assert result.type == "datetime"


def test_native_types():
    assert profile([1, 20, 300], dtype=pl.Int64).shape == "whole numbers, 1 to 3 digits"
    assert profile([1.5, 2.25], dtype=pl.Float64).type == "number"
    assert profile([dt.date(2024, 1, 1)], dtype=pl.Date).type == "date"
    assert profile([dt.datetime(2024, 1, 1, 9, 30)], dtype=pl.Datetime).type == "datetime"
    assert profile([dt.datetime(2024, 1, 1)], dtype=pl.Datetime).type == "date"


def test_whole_floats_are_integers():
    # Spreadsheets store every number as a float, so 2010 arrives as 2010.0.
    result = profile([2010.0, 2011.0, None], dtype=pl.Float64)
    assert result.type == "integer"
    assert result.shape == "whole numbers, 4 digits"


def test_not_a_number_counts_as_empty():
    result = profile([1.5, float("nan")], dtype=pl.Float64)
    assert result.null_rate == 0.5


def test_text_lengths_and_case():
    result = profile(["ACME CORP", "GLOBEX"])
    assert result.type == "text"
    assert result.shape == "text, 6 to 9 characters, all uppercase"


def test_cells_with_several_lines():
    assert "several lines per cell" in profile(["a\nb", "c\nd"]).shape
    assert "several lines in some cells" in profile(["a\nb", "c"]).shape


def test_common_pattern():
    result = profile(["AB-1234", "CD-5678", "EF-9012"])
    assert result.shape == "text, 7 characters, pattern AA-9999, all uppercase"


def test_no_pattern_when_values_differ_in_form():
    result = profile(["alpha", "be-ta", "gamma 3", "d", "epsilon!"])
    assert "pattern" not in result.shape


def test_uniqueness():
    result = profile(["a", "b", "b", None])
    assert result.distinct_count == 2
    assert result.unique_rate == pytest.approx(2 / 3, abs=1e-6)


def test_nested_values():
    result = profile_column("column", pl.Series("column", [[1, 2], [3]]))
    assert result.type == "text"
    assert result.shape == "nested values"


def test_categorical_text():
    result = profile_column("column", pl.Series("column", ["x", "y", "x"], dtype=pl.Categorical))
    assert result.type == "text"
    assert result.distinct_count == 2


def test_mask():
    assert mask("Ab-12 é") == "AA-99 A"


def test_a_profile_never_repeats_a_value():
    # Every cell holds a marker that would be easy to spot if it leaked.
    secrets = {
        "names": ["ZQXJ Holdings", "ZQXK Partners", "ZQXL Group"],
        "codes": ["ZQ-7731", "ZQ-7732", "ZQ-7733"],
        "ids": ["0077310", "0077320", "0077330"],
        "amounts": ["77310.55", "77320.55", "77330.55"],
        "dates": ["1977-03-10", "1977-03-11", "1977-03-12"],
        "notes": ["ZQXJ qqone\nqqtwo", "ZQXK", "ZQXL"],
        "constant": ["ZQXJ", "ZQXJ", "ZQXJ"],
        "symbols": ["@@@", "@@@", "@@@"],
    }
    sent = json.dumps([column.to_json() for column in profile_frame(pl.DataFrame(secrets))])
    for column, values in secrets.items():
        for value in values:
            for piece in value.split():
                assert piece not in sent, f"{piece!r} from {column} leaked"
    for fragment in ("ZQ", "773", "1977", "@@@"):
        assert fragment not in sent
