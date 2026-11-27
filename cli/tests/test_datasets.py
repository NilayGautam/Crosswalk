from pathlib import Path

import polars as pl
import pytest
import xlwt

from conftest import HEADERS, ROWS, sample_frame
from crosswalk_cli import datasets, store
from crosswalk_cli.datasets import Unreadable, find_files, read_cards, scan


def cards_in(folder: Path):
    found = find_files(folder)
    result = []
    for _, outcome in scan(folder, found.files):
        assert not isinstance(outcome, Unreadable), outcome
        result.extend(outcome)
    return result


def test_every_format_gives_the_same_card(data_folder: Path):
    cards = {card.format: card for card in cards_in(data_folder)}
    assert set(cards) == {"csv", "tsv", "parquet", "xlsx", "xls", "dta"}
    for card in cards.values():
        assert [column.name for column in card.columns] == HEADERS, card.format
        assert card.row_count == 3, card.format
        assert card.profiled_rows == 3, card.format
        by_name = {column.name: column for column in card.columns}
        assert by_name["firm_id"].type == "text", card.format
        assert "leading zeros" in by_name["firm_id"].shape, card.format
        assert by_name["firm_name"].type == "text", card.format
        assert by_name["year"].type == "integer", card.format
        assert by_name["score"].type == "number", card.format
        assert by_name["score"].null_rate == pytest.approx(1 / 3, abs=1e-6), card.format
        assert by_name["firm_name"].unique_rate == 1, card.format


def test_flat_file_identity(data_folder: Path):
    [card] = read_cards(data_folder / "firms.csv", "firms.csv")
    assert (card.key, card.name, card.path, card.sheet) == (
        "firms.csv",
        "firms.csv",
        "firms.csv",
        None,
    )


def test_workbook_with_one_sheet_is_named_after_the_file(data_folder: Path):
    [card] = read_cards(data_folder / "firms.xlsx", "firms.xlsx")
    assert card.key == "firms.xlsx#Firms"
    assert card.name == "firms.xlsx"
    assert card.sheet == "Firms"


def test_workbook_gives_one_card_per_sheet_and_skips_empty_ones(tmp_path: Path):
    path = tmp_path / "book.xls"
    # Two sheets with data, and a third with nothing in it, not even headers.
    book = xlwt.Workbook()
    for name, rows in {"First": ROWS, "Second": ROWS[:1]}.items():
        sheet = book.add_sheet(name)
        for column, header in enumerate(HEADERS):
            sheet.write(0, column, header)
        for row_number, row in enumerate(rows, start=1):
            for column, value in enumerate(row):
                if value is not None:
                    sheet.write(row_number, column, value)
    book.add_sheet("Blank")
    book.save(str(path))

    cards = read_cards(path, "sub/book.xls")
    assert [card.key for card in cards] == ["sub/book.xls#First", "sub/book.xls#Second"]
    assert [card.name for card in cards] == ["book.xls / First", "book.xls / Second"]
    assert [card.row_count for card in cards] == [3, 1]


def test_headers_without_rows(tmp_path: Path):
    (tmp_path / "empty.csv").write_text("a,b\n", encoding="utf-8")
    [card] = read_cards(tmp_path / "empty.csv", "empty.csv")
    assert card.row_count == 0
    assert [column.type for column in card.columns] == ["empty", "empty"]


def test_large_file_is_profiled_from_a_sample_but_counted_in_full(tmp_path, monkeypatch):
    monkeypatch.setattr(datasets, "PROFILE_ROW_LIMIT", 50)
    frame = pl.DataFrame({"n": range(175), "label": [f"row {i}" for i in range(175)]})
    frame.write_csv(tmp_path / "big.csv")
    frame.write_parquet(tmp_path / "big.parquet")
    frame.write_excel(tmp_path / "big.xlsx")
    frame.to_pandas().to_stata(tmp_path / "big.dta", write_index=False)
    for card in cards_in(tmp_path):
        assert card.row_count == 175, card.format
        assert card.profiled_rows == 50, card.format


def test_csv_with_uneven_rows_and_odd_bytes(tmp_path: Path):
    (tmp_path / "messy.csv").write_bytes(b"a,b\n1,caf\xe9\n2,x,extra\n3\n")
    [card] = read_cards(tmp_path / "messy.csv", "messy.csv")
    assert [column.name for column in card.columns] == ["a", "b"]
    assert card.row_count == 3


def test_find_files_skips_what_is_not_a_dataset(tmp_path: Path):
    sample_frame().write_csv(tmp_path / "keep.csv")
    (tmp_path / "notes.txt").write_text("hello", encoding="utf-8")
    (tmp_path / "~$keep.xlsx").write_text("lock", encoding="utf-8")
    (tmp_path / ".hidden.csv").write_text("a\n1\n", encoding="utf-8")
    for folder in (".git", "node_modules", "crosswalk_out", "nested", "nested/__pycache__"):
        (tmp_path / folder).mkdir()
        (tmp_path / folder / "inner.CSV").write_text("a\n1\n", encoding="utf-8")
    found = find_files(tmp_path)
    assert [file.relative_to(tmp_path).as_posix() for file in found.files] == [
        "keep.csv",
        "nested/inner.CSV",
    ]
    # Every folder that was not entered is named, so nothing is left out quietly.
    assert found.skipped_folders == [
        ".git",
        "crosswalk_out",
        "nested/__pycache__",
        "node_modules",
    ]


def test_folders_named_env_and_venv_are_read(tmp_path: Path):
    # A folder of environmental data can be called env.
    for folder in ("env", "venv"):
        (tmp_path / folder).mkdir()
        (tmp_path / folder / "rain.csv").write_text("a\n1\n", encoding="utf-8")
    found = find_files(tmp_path)
    assert [file.relative_to(tmp_path).as_posix() for file in found.files] == [
        "env/rain.csv",
        "venv/rain.csv",
    ]
    assert found.skipped_folders == []


def test_the_folder_holding_the_project_link_is_not_reported(tmp_path: Path):
    store.save_link(tmp_path, store.Link("http://crosswalk.test", "p1", "Cases"))
    (tmp_path / "keep.csv").write_text("a\n1\n", encoding="utf-8")
    found = find_files(tmp_path)
    assert [file.name for file in found.files] == ["keep.csv"]
    assert found.skipped_folders == []


def test_linked_folders_are_counted_and_only_entered_when_asked(tmp_path: Path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "far.csv").write_text("a\n1\n", encoding="utf-8")
    inside = tmp_path / "inside"
    inside.mkdir()
    (inside / "linked").symlink_to(outside, target_is_directory=True)

    found = find_files(inside)
    assert found.files == []
    assert found.linked_folders == 1

    followed = find_files(inside, follow_links=True)
    assert [file.name for file in followed.files] == ["far.csv"]
    assert followed.linked_folders == 0


def test_linked_files_are_counted_and_only_read_when_asked(tmp_path: Path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "far.csv").write_text("a\n1\n", encoding="utf-8")
    (outside / "notes.txt").write_text("hello", encoding="utf-8")
    inside = tmp_path / "inside"
    inside.mkdir()
    (inside / "near.csv").write_text("a\n1\n", encoding="utf-8")
    (inside / "linked.csv").symlink_to(outside / "far.csv")
    (inside / "notes.txt").symlink_to(outside / "notes.txt")

    found = find_files(inside)
    assert [file.name for file in found.files] == ["near.csv"]
    assert found.linked_files == 1

    followed = find_files(inside, follow_links=True)
    assert [file.name for file in followed.files] == ["linked.csv", "near.csv"]
    assert followed.linked_files == 0


def test_an_unreadable_file_is_reported_and_the_rest_still_read(tmp_path: Path):
    sample_frame().write_csv(tmp_path / "good.csv")
    (tmp_path / "broken.parquet").write_text("this is not parquet", encoding="utf-8")
    outcomes = dict(scan(tmp_path, find_files(tmp_path).files))
    broken = outcomes[tmp_path / "broken.parquet"]
    assert isinstance(broken, Unreadable)
    assert broken.path == "broken.parquet"
    assert broken.reason
    assert len(outcomes[tmp_path / "good.csv"]) == 1


def test_card_json_uses_the_server_field_names(data_folder: Path):
    [card] = read_cards(data_folder / "firms.csv", "firms.csv")
    body = card.to_json()
    assert set(body) == {
        "key",
        "name",
        "path",
        "sheet",
        "format",
        "rowCount",
        "profiledRows",
        "columns",
    }
    assert set(body["columns"][0]) == {
        "name",
        "type",
        "nullRate",
        "distinctCount",
        "uniqueRate",
        "shape",
    }


def test_a_file_name_with_brackets_or_a_star_is_read_as_a_name(tmp_path: Path):
    frame = sample_frame()
    frame.write_csv(tmp_path / "survey[clean]*.csv")
    frame.write_parquet(tmp_path / "survey[clean]*.parquet")
    cards = cards_in(tmp_path)
    assert [card.key for card in cards] == ["survey[clean]*.csv", "survey[clean]*.parquet"]
    assert [card.row_count for card in cards] == [3, 3]
