"""Find the datasets in a folder and build a schema card for each one."""

from __future__ import annotations

import os
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

import polars as pl

from crosswalk_cli.profile import ColumnProfile, profile_frame
from crosswalk_cli.store import LINK_FOLDER

# Profiles are computed from at most this many rows, so huge files stay fast.
# The row count is always the real one.
PROFILE_ROW_LIMIT = 100_000

FORMATS = {
    ".csv": "csv",
    ".tsv": "tsv",
    ".tab": "tsv",
    ".xlsx": "xlsx",
    ".xlsm": "xlsx",
    ".xls": "xls",
    ".parquet": "parquet",
    ".dta": "dta",
}

# Tool folders, which never hold a researcher's datasets.
SKIPPED_FOLDERS = {
    "node_modules",
    "__pycache__",
    "crosswalk_out",
    "site-packages",
}


@dataclass(frozen=True)
class DatasetCard:
    key: str
    name: str
    path: str
    sheet: str | None
    format: str
    row_count: int
    profiled_rows: int
    columns: list[ColumnProfile]

    def to_json(self) -> dict[str, object]:
        return {
            "key": self.key,
            "name": self.name,
            "path": self.path,
            "sheet": self.sheet,
            "format": self.format,
            "rowCount": self.row_count,
            "profiledRows": self.profiled_rows,
            "columns": [column.to_json() for column in self.columns],
        }


@dataclass(frozen=True)
class Unreadable:
    path: str
    reason: str


@dataclass
class ScanResult:
    cards: list[DatasetCard] = field(default_factory=list)
    unreadable: list[Unreadable] = field(default_factory=list)
    skipped_folders: list[str] = field(default_factory=list)
    linked_folders: int = 0
    linked_files: int = 0


@dataclass(frozen=True)
class FoundFiles:
    files: list[Path]
    # Hidden and tool folders that were not entered, relative to the root.
    skipped_folders: list[str]
    linked_folders: int
    linked_files: int


def find_files(root: Path, *, follow_links: bool = False) -> FoundFiles:
    """Every dataset file under the folder, in a stable order.

    Hidden folders, tool folders, and Office lock files are left out. Folders
    and files that are links are only read when asked. Everything left out
    for being a folder or a link is reported, except the folder that holds
    this folder's own link to a project.
    """
    files: list[Path] = []
    skipped: list[str] = []
    linked_folders = 0
    linked_files = 0
    for current, folders, names in os.walk(root, followlinks=follow_links):
        here = Path(current)
        kept = []
        for folder in sorted(folders):
            if here == root and folder == LINK_FOLDER:
                continue
            if folder.startswith(".") or folder in SKIPPED_FOLDERS:
                skipped.append((here / folder).relative_to(root).as_posix())
                continue
            if not follow_links and (here / folder).is_symlink():
                linked_folders += 1
                continue
            kept.append(folder)
        folders[:] = kept
        for name in sorted(names):
            if name.startswith((".", "~$")) or Path(name).suffix.lower() not in FORMATS:
                continue
            if not follow_links and (here / name).is_symlink():
                linked_files += 1
                continue
            files.append(here / name)
    return FoundFiles(sorted(files), sorted(skipped), linked_folders, linked_files)


def scan(root: Path, files: list[Path]) -> Iterator[tuple[Path, list[DatasetCard] | Unreadable]]:
    """Read each file in turn. A file that cannot be read is reported, not fatal."""
    for file in files:
        relative = file.relative_to(root).as_posix()
        try:
            yield file, read_cards(file, relative)
        except Exception as error:
            yield file, Unreadable(relative, _reason(error))


def _reason(error: Exception) -> str:
    text = " ".join(str(error).split())
    name = type(error).__name__
    if not text:
        return name
    return text if len(text) <= 160 else f"{text[:157]}..."


def read_cards(file: Path, relative: str) -> list[DatasetCard]:
    """One card per table: one for a flat file, one per sheet for a workbook."""
    kind = FORMATS[file.suffix.lower()]
    if kind in ("xlsx", "xls"):
        return _read_workbook(file, relative, kind)
    if kind in ("csv", "tsv"):
        frame, rows = _read_delimited(file, "\t" if kind == "tsv" else ",")
    elif kind == "parquet":
        frame, rows = _read_parquet(file)
    else:
        frame, rows = _read_stata(file)
    return [_card(relative, relative, Path(relative).name, None, kind, frame, rows)]


def _card(
    key: str,
    path: str,
    name: str,
    sheet: str | None,
    kind: str,
    frame: pl.DataFrame,
    rows: int,
) -> DatasetCard:
    return DatasetCard(
        key=key,
        name=name,
        path=path,
        sheet=sheet,
        format=kind,
        row_count=rows,
        profiled_rows=frame.height,
        columns=profile_frame(frame),
    )


def _read_delimited(file: Path, separator: str) -> tuple[pl.DataFrame, int]:
    # Every cell is read as text, so an identifier keeps its leading zeros and
    # the profile decides the type instead of the reader guessing it.
    options = {
        "separator": separator,
        "infer_schema": False,
        "encoding": "utf8-lossy",
        "truncate_ragged_lines": True,
        # A file name is a name, even with brackets or a star in it.
        "glob": False,
    }
    frame = pl.read_csv(file, n_rows=PROFILE_ROW_LIMIT, **options)
    if frame.height < PROFILE_ROW_LIMIT:
        return frame, frame.height
    rows = pl.scan_csv(file, **options).select(pl.len()).collect().item()
    return frame, int(rows)


def _read_parquet(file: Path) -> tuple[pl.DataFrame, int]:
    lazy = pl.scan_parquet(file, glob=False)
    rows = lazy.select(pl.len()).collect().item()
    return lazy.head(PROFILE_ROW_LIMIT).collect(), int(rows)


def _read_stata(file: Path) -> tuple[pl.DataFrame, int]:
    import pyreadstat

    frame, _ = pyreadstat.read_dta(str(file), row_limit=PROFILE_ROW_LIMIT)
    if len(frame) < PROFILE_ROW_LIMIT:
        return pl.from_pandas(frame), len(frame)
    # The file's header holds the real row count, so the rows are not read again.
    _, meta = pyreadstat.read_dta(str(file), metadataonly=True)
    rows = meta.number_rows if meta.number_rows is not None else len(frame)
    return pl.from_pandas(frame), int(rows)


def _read_workbook(file: Path, relative: str, kind: str) -> list[DatasetCard]:
    import fastexcel

    reader = fastexcel.read_excel(file)
    tables: list[tuple[str, pl.DataFrame, int]] = []
    for sheet_name in reader.sheet_names:
        sheet = reader.load_sheet(sheet_name, n_rows=PROFILE_ROW_LIMIT)
        if sheet.width == 0:
            continue
        tables.append((sheet_name, sheet.to_polars(), int(sheet.total_height)))
    file_name = Path(relative).name
    return [
        _card(
            key=f"{relative}#{sheet_name}",
            path=relative,
            # A workbook with one table is known by its file name alone.
            name=file_name if len(tables) == 1 else f"{file_name} / {sheet_name}",
            sheet=sheet_name,
            kind=kind,
            frame=frame,
            rows=rows,
        )
        for sheet_name, frame, rows in tables
    ]
