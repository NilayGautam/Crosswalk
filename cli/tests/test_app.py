"""The command as a person runs it: in a folder, against a server."""

import json
from pathlib import Path

import httpx
import pytest
from typer.testing import CliRunner

from crosswalk_cli import app as cli
from crosswalk_cli import store
from crosswalk_cli.api import Client

SERVER = "http://crosswalk.test"


class Server:
    """Stands in for the Crosswalk server and records what it was sent."""

    def __init__(self, project_name: str = "Cases") -> None:
        self.project_name = project_name
        self.sent: list[list[dict]] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/projects":
            return httpx.Response(200, json={"projects": [{"id": "p1", "name": self.project_name}]})
        if request.url.path == "/api/config":
            return httpx.Response(200, json={"publicUrl": SERVER})
        if request.method == "PUT" and request.url.path == "/api/projects/p1/datasets":
            cards = json.loads(request.content)["datasets"]
            self.sent.append(cards)
            return httpx.Response(200, json={"added": len(cards), "updated": 0})
        return httpx.Response(404, json={"error": "Not found."})

    @property
    def keys(self) -> list[str]:
        return [card["key"] for cards in self.sent for card in cards]


@pytest.fixture
def folder(tmp_path: Path, monkeypatch) -> Path:
    """An empty folder to run the command in, linked to project p1."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("COLUMNS", "200")
    return tmp_path


def run(monkeypatch, server: Server, arguments: list[str]):
    monkeypatch.setattr(
        cli, "_client", lambda _address: Client(SERVER, "t", httpx.MockTransport(server))
    )
    return CliRunner().invoke(cli.app, arguments)


def link(folder: Path, name: str = "Cases") -> None:
    store.save_link(folder, store.Link(SERVER, "p1", name))


def write_csv(path: Path, header: str = "a,b") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{header}\n1,2\n", encoding="utf-8")


def test_the_bare_command_sends_the_datasets_in_the_folder(folder: Path, monkeypatch):
    link(folder)
    write_csv(folder / "firms.csv")
    server = Server()
    result = run(monkeypatch, server, ["--yes"])
    assert result.exit_code == 0, result.output
    assert server.keys == ["firms.csv"]
    assert "Sent. 1 new card, 0 updated." in result.output


def test_send_is_not_a_second_spelling_of_the_command(folder: Path, monkeypatch):
    link(folder)
    write_csv(folder / "firms.csv")
    server = Server()
    result = run(monkeypatch, server, ["send", "--yes"])
    assert result.exit_code != 0
    assert server.sent == []


def test_names_with_brackets_and_colons_are_printed_as_they_are(folder: Path, monkeypatch):
    # Square brackets are markup to the library that prints, and :name: is an emoji code.
    name = "[/x] [bold]Cases :smile:"
    link(folder, name)
    write_csv(folder / "survey[clean] :smile:.csv")
    server = Server(project_name=name)
    result = run(monkeypatch, server, ["--yes"])
    assert result.exit_code == 0, result.output
    assert "survey[clean] :smile:.csv" in result.output
    assert f"This will be sent to the project {name}:" in result.output
    assert server.keys == ["survey[clean] :smile:.csv"]


def test_a_server_error_with_brackets_is_printed_as_it_is(capsys, monkeypatch):
    def refuse() -> None:
        raise cli.ApiError("columns[/0].name: Too big")

    monkeypatch.setattr(cli, "app", refuse)
    with pytest.raises(SystemExit) as stopped:
        cli.main()
    assert stopped.value.code == 1
    assert "columns[/0].name: Too big" in capsys.readouterr().err


def test_a_file_the_server_would_refuse_is_skipped_and_the_rest_is_sent(folder: Path, monkeypatch):
    link(folder)
    write_csv(folder / "firms.csv")
    # The server takes column names of at most 500 characters.
    write_csv(folder / "prose.csv", header=f"{'x' * 501},b")
    server = Server()
    result = run(monkeypatch, server, ["--yes"])
    assert result.exit_code == 0, result.output
    assert server.keys == ["firms.csv"]
    assert "Skipped prose.csv" in result.output


def test_the_summary_names_what_was_not_read(folder: Path, monkeypatch):
    link(folder)
    outside = folder.parent / f"{folder.name}-outside"
    write_csv(outside / "far.csv")
    write_csv(folder / "firms.csv")
    write_csv(folder / "node_modules" / "inner.csv")
    write_csv(folder / ".cache" / "inner.csv")
    (folder / "linked.csv").symlink_to(outside / "far.csv")
    (folder / "linked").symlink_to(outside, target_is_directory=True)
    server = Server()
    result = run(monkeypatch, server, ["--yes"])
    assert result.exit_code == 0, result.output
    assert server.keys == ["firms.csv"]
    assert "Skipped 2 folders: .cache, node_modules" in result.output
    assert "Skipped 1 linked folder and 1 linked file." in result.output

    followed = run(monkeypatch, server, ["--yes", "--follow-links"])
    assert followed.exit_code == 0, followed.output
    assert {card["key"] for card in server.sent[-1]} == {
        "firms.csv",
        "linked.csv",
        "linked/far.csv",
    }
    assert "linked f" not in followed.output
