"""The `crosswalk` command."""

from __future__ import annotations

import contextlib
import json
import webbrowser
from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console
from rich.progress import BarColumn, MofNCompleteColumn, Progress, TextColumn
from rich.prompt import Confirm, IntPrompt, Prompt
from rich.table import Table

from crosswalk_cli import __version__, store
from crosswalk_cli.api import ApiError, Client, NotSignedIn, Project
from crosswalk_cli.datasets import DatasetCard, ScanResult, Unreadable, find_files, scan

app = typer.Typer(
    help="Send the column headers and profiles of the datasets in this folder to Crosswalk.",
    add_completion=False,
    no_args_is_help=False,
    rich_markup_mode=None,
)
console = Console(highlight=False)
errors = Console(stderr=True, highlight=False)

ServerOption = Annotated[
    str | None,
    typer.Option("--server", help="Address of the Crosswalk server.", envvar="CROSSWALK_SERVER"),
]


def main() -> None:
    try:
        app()
    except ApiError as error:
        errors.print(f"[red]{error}[/red]", markup=True)
        raise SystemExit(1) from None
    except KeyboardInterrupt:
        errors.print("Stopped.")
        raise SystemExit(130) from None


def _version(value: bool) -> None:
    if value:
        console.print(f"crosswalk {__version__}")
        raise typer.Exit


def _client(server: str | None) -> Client:
    address = store.server_url(server)
    token = store.load_token(address)
    if token is None:
        raise NotSignedIn("This computer is not linked. Run `crosswalk login` first.")
    return Client(address, token)


@app.callback(invoke_without_command=True)
def root(
    context: typer.Context,
    server: ServerOption = None,
    yes: Annotated[
        bool, typer.Option("--yes", "-y", help="Send without asking for confirmation.")
    ] = False,
    show: Annotated[
        bool, typer.Option("--show", help="Print exactly what would be sent, then stop.")
    ] = False,
    follow_links: Annotated[
        bool, typer.Option("--follow-links", help="Also look inside folders that are links.")
    ] = False,
    version: Annotated[
        bool,
        typer.Option("--version", callback=_version, is_eager=True, help="Print the version."),
    ] = False,
) -> None:
    """Scan this folder and send its datasets to the linked project."""
    if context.invoked_subcommand is None:
        send(server=server, yes=yes, show=show, follow_links=follow_links)


@app.command()
def login(
    server: ServerOption = None,
    no_browser: Annotated[
        bool, typer.Option("--no-browser", help="Do not open the browser automatically.")
    ] = False,
) -> None:
    """Link this computer to your Crosswalk account."""
    address = store.server_url(server)
    client = Client(address)
    code = client.request_device_code()
    console.print()
    console.print("To link this computer, confirm this code in your browser:")
    console.print()
    console.print(f"    [bold]{_spaced(code.user_code)}[/bold]", markup=True)
    console.print()
    console.print(f"Open {code.verification_uri_complete}")
    if not no_browser:
        webbrowser.open(code.verification_uri_complete)
    with console.status("Waiting for you to confirm in the browser..."):
        token = client.wait_for_token(code)
    store.save_token(address, token)
    account = Client(address, token).me()
    console.print(f"Linked to {account['email']}.")
    console.print("Next, run `crosswalk` in a folder that holds your datasets.")


@app.command()
def logout(server: ServerOption = None) -> None:
    """Unlink this computer."""
    address = store.server_url(server)
    token = store.load_token(address)
    if token is None:
        console.print("This computer is not linked.")
        return
    # The token is removed here even when the server cannot be told. It can
    # also be revoked from the web app.
    with contextlib.suppress(ApiError):
        Client(address, token).sign_out()
    store.delete_token(address)
    console.print("This computer is no longer linked.")


@app.command()
def link(
    server: ServerOption = None,
    project: Annotated[
        str | None, typer.Option("--project", help="The id of the project to link to.")
    ] = None,
) -> None:
    """Choose which project this folder sends its datasets to."""
    client = _client(server)
    chosen = _choose_project(client, project)
    _save_link(client, chosen)


@app.command()
def status(server: ServerOption = None) -> None:
    """Show the account and the project this folder is linked to."""
    address = store.server_url(server)
    console.print(f"Server: {address}")
    token = store.load_token(address)
    if token is None:
        console.print("Account: not linked. Run `crosswalk login`.")
        return
    client = Client(address, token)
    console.print(f"Account: {client.me()['email']}")
    current = store.load_link(Path.cwd(), address)
    if current is None:
        console.print("Project: this folder is not linked. Run `crosswalk link`.")
        return
    console.print(f"Project: {current.project_name}")


@app.command()
def send(
    server: ServerOption = None,
    yes: Annotated[
        bool, typer.Option("--yes", "-y", help="Send without asking for confirmation.")
    ] = False,
    show: Annotated[
        bool, typer.Option("--show", help="Print exactly what would be sent, then stop.")
    ] = False,
    follow_links: Annotated[
        bool, typer.Option("--follow-links", help="Also look inside folders that are links.")
    ] = False,
) -> None:
    """Scan this folder and send its datasets to the linked project."""
    folder = Path.cwd()
    result = _scan_folder(folder, follow_links)
    payload = [card.to_json() for card in result.cards]
    if show:
        # Printed plainly, so it can be piped to a file and read in full.
        print(json.dumps({"datasets": payload}, indent=2, ensure_ascii=False))
        return

    _print_summary(result)
    if not result.cards:
        console.print("There is nothing to send.")
        raise typer.Exit(1 if result.unreadable else 0)

    client = _client(server)
    current = store.load_link(folder, client.server)
    target = client.project(current.project_id) if current is not None else None
    if current is not None and target is None:
        console.print(f"The project this folder was linked to, {current.project_name}, is gone.")
    if target is None:
        target = _choose_project(client, None)
        _save_link(client, target)

    console.print()
    console.print(f"This will be sent to the project [bold]{target.name}[/bold]:", markup=True)
    console.print("  - file names, sheet names, and row counts")
    console.print("  - column names")
    console.print("  - for each column: its type, how often it is empty, how many")
    console.print("    different values it has, and what its values look like")
    console.print("No cell values are sent. Run `crosswalk --show` to read every byte first.")
    console.print()
    if not yes and not Confirm.ask("Send?", default=True, console=console):
        console.print("Nothing was sent.")
        raise typer.Exit(1)

    outcome = client.send_datasets(target.id, payload)
    console.print(f"Sent. {_count(outcome['added'], 'new card')}, {outcome['updated']} updated.")
    console.print(f"Open {client.web_url()}/project/?id={target.id}")


def _scan_folder(folder: Path, follow_links: bool) -> ScanResult:
    found = find_files(folder, follow_links=follow_links)
    result = ScanResult(linked_folders=found.linked_folders)
    if not found.files:
        return result
    progress = Progress(
        TextColumn("Reading"),
        BarColumn(),
        MofNCompleteColumn(),
        TextColumn("{task.description}"),
        console=errors,
        transient=True,
    )
    with progress:
        task = progress.add_task("", total=len(found.files))
        for file, outcome in scan(folder, found.files):
            progress.update(task, advance=1, description=file.name)
            if isinstance(outcome, Unreadable):
                result.unreadable.append(outcome)
            else:
                result.cards.extend(outcome)
    return result


def _print_summary(result: ScanResult) -> None:
    if result.cards:
        table = Table(box=None, pad_edge=False, header_style="bold")
        table.add_column("Dataset", overflow="fold")
        table.add_column("Rows", justify="right")
        table.add_column("Columns", justify="right")
        for card in result.cards:
            table.add_row(_label(card), f"{card.row_count:,}", f"{len(card.columns):,}")
        console.print(table)
    else:
        console.print("No datasets were found in this folder.")
        console.print("Crosswalk reads CSV, TSV, XLSX, XLS, Parquet, and Stata .dta files.")
    for item in result.unreadable:
        errors.print(f"Skipped {item.path}: {item.reason}", markup=False)
    if result.linked_folders:
        console.print(
            f"Skipped {_count(result.linked_folders, 'linked folder')}. "
            "Use --follow-links to look inside."
        )


def _label(card: DatasetCard) -> str:
    return card.path if card.sheet is None else f"{card.path} / {card.sheet}"


def _count(number: int, noun: str) -> str:
    return f"{number} {noun}" if number == 1 else f"{number} {noun}s"


def _spaced(code: str) -> str:
    """ABCD1234 is easier to compare as ABCD-1234."""
    middle = len(code) // 2
    return f"{code[:middle]}-{code[middle:]}" if len(code) >= 6 and "-" not in code else code


def _choose_project(client: Client, project_id: str | None) -> Project:
    projects = client.projects()
    if project_id is not None:
        match = next((item for item in projects if item.id == project_id), None)
        if match is None:
            raise ApiError("There is no project with that id in your account.")
        return match
    console.print()
    if not projects:
        console.print("You have no projects yet.")
        return client.create_project(_ask_name())
    console.print("Which project should this folder send its datasets to?")
    for number, item in enumerate(projects, start=1):
        console.print(f"  {number}. {item.name}", markup=False)
    console.print(f"  {len(projects) + 1}. Create a new project")
    choice = IntPrompt.ask(
        "Number",
        choices=[str(number) for number in range(1, len(projects) + 2)],
        show_choices=False,
        console=console,
    )
    if choice == len(projects) + 1:
        return client.create_project(_ask_name())
    return projects[choice - 1]


def _ask_name() -> str:
    while True:
        name = Prompt.ask("Name for the new project", console=console).strip()
        if name:
            return name


def _save_link(client: Client, project: Project) -> None:
    folder = Path.cwd()
    store.save_link(folder, store.Link(client.server, project.id, project.name))
    console.print(f"This folder is linked to {project.name}.", markup=False)
