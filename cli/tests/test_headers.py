"""A first row of data must never be sent as column names."""

from pathlib import Path

import polars as pl
import pytest

from crosswalk_cli.datasets import Unreadable, find_files, scan
from crosswalk_cli.headers import HeaderLooksLikeData, check_header


def outcome(folder: Path, name: str):
    """What a single-table file gives: its card, or why it was held back."""
    [single] = outcomes(folder, name)
    return single


def outcomes(folder: Path, name: str):
    found = find_files(folder)
    return dict(scan(folder, found.files))[folder / name]


def test_a_csv_with_no_header_row_is_held_back(tmp_path: Path):
    (tmp_path / "firms.csv").write_text(
        "001001,Northwind Traders,2019\n001002,Contoso Ltd,2020\n020003,Fabrikam Inc,2021\n",
        encoding="utf-8",
    )
    held = outcome(tmp_path, "firms.csv")
    assert isinstance(held, Unreadable)
    assert "looks like data rather than column names" in held.reason
    assert "001001" in held.reason


def test_a_real_header_is_not_held_back(tmp_path: Path):
    (tmp_path / "firms.csv").write_text(
        "firm_id,firm_name,year\n001001,Northwind Traders,2019\n001002,Contoso Ltd,2020\n",
        encoding="utf-8",
    )
    cards = outcome(tmp_path, "firms.csv")
    assert not isinstance(cards, Unreadable)


def test_years_as_column_names_in_a_wide_panel_are_kept(tmp_path: Path):
    (tmp_path / "panel.csv").write_text(
        "firm_id,2010,2011,2012\nA1,3,12,0\nB2,7,1,4\nC3,0,0,25\n", encoding="utf-8"
    )
    assert not isinstance(outcome(tmp_path, "panel.csv"), Unreadable)


def test_dates_over_dates_are_held_back(tmp_path: Path):
    (tmp_path / "events.csv").write_text(
        "2020-01-05,filed\n2020-02-09,closed\n2021-03-01,filed\n", encoding="utf-8"
    )
    assert isinstance(outcome(tmp_path, "events.csv"), Unreadable)


def test_a_decimal_name_is_never_a_header():
    frame = pl.DataFrame({"12.5": ["a", "b"], "name": ["x", "y"]})
    with pytest.raises(HeaderLooksLikeData, match=r"12\.5"):
        check_header(frame)


def test_a_workbook_sheet_with_no_header_row_is_held_back(tmp_path: Path):
    frame = pl.DataFrame({"firm": ["Contoso Ltd", "Fabrikam Inc"], "year": [2020, 2021]})
    path = tmp_path / "book.xlsx"
    # Written without a header, so the first data row becomes the names.
    frame.write_excel(path, include_header=False)
    held = outcome(tmp_path, "book.xlsx")
    assert isinstance(held, Unreadable)
    assert "first row" in held.reason


def test_only_the_headerless_sheet_of_a_workbook_is_held_back(tmp_path: Path):
    import xlsxwriter

    path = tmp_path / "book.xlsx"
    with xlsxwriter.Workbook(path) as book:
        data = book.add_worksheet("Data")
        for index, row in enumerate(
            [["firm_id", "firm_name"], ["A1", "Northwind"], ["B2", "Contoso"]]
        ):
            data.write_row(index, 0, row)
        codes = book.add_worksheet("Codes")
        for index, row in enumerate([["001001", "2019"], ["001002", "2020"], ["020003", "2021"]]):
            codes.write_row(index, 0, row)
    card, held = outcomes(tmp_path, "book.xlsx")
    assert not isinstance(card, Unreadable)
    assert card.sheet == "Data"
    assert [column.name for column in card.columns] == ["firm_id", "firm_name"]
    assert isinstance(held, Unreadable)
    assert held.path == "book.xlsx / Codes"
    assert "sheet Codes" in held.reason


def test_the_other_files_are_still_read(tmp_path: Path):
    (tmp_path / "bad.csv").write_text("1,2\n3,4\n5,6\n", encoding="utf-8")
    (tmp_path / "good.csv").write_text("a,b\n1,2\n", encoding="utf-8")
    assert isinstance(outcome(tmp_path, "bad.csv"), Unreadable)
    assert not isinstance(outcome(tmp_path, "good.csv"), Unreadable)
