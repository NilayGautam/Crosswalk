"""Synthetic datasets. Nothing here comes from a real file."""

from pathlib import Path

import polars as pl
import pytest
import xlwt

ROWS = [
    ("001001", "Northwind Traders", 2019, 12.5, "2019-03-01"),
    ("001002", "Contoso Ltd", 2020, 8.0, "2020-07-15"),
    ("020003", "Fabrikam Inc", 2021, None, "2021-11-30"),
]
HEADERS = ["firm_id", "firm_name", "year", "score", "filed_on"]


def sample_frame() -> pl.DataFrame:
    return pl.DataFrame(ROWS, schema=HEADERS, orient="row")


def write_xls(path: Path, sheets: dict[str, list[tuple]]) -> None:
    book = xlwt.Workbook()
    for name, rows in sheets.items():
        sheet = book.add_sheet(name)
        for column, header in enumerate(HEADERS):
            sheet.write(0, column, header)
        for row_number, row in enumerate(rows, start=1):
            for column, value in enumerate(row):
                if value is not None:
                    sheet.write(row_number, column, value)
    book.save(str(path))


@pytest.fixture
def data_folder(tmp_path: Path) -> Path:
    """A folder with one small dataset in every format Crosswalk reads."""
    frame = sample_frame()
    frame.write_csv(tmp_path / "firms.csv")
    frame.write_csv(tmp_path / "firms.tsv", separator="\t")
    frame.write_parquet(tmp_path / "firms.parquet")
    frame.write_excel(tmp_path / "firms.xlsx", worksheet="Firms")
    write_xls(tmp_path / "firms.xls", {"Firms": ROWS})
    frame.to_pandas().to_stata(tmp_path / "firms.dta", write_index=False)
    return tmp_path
