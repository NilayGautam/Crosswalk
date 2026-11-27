"""Where the CLI keeps what it has to remember.

The access token goes in the operating system's keychain. The link between a
folder and a project goes in a small file inside that folder.
"""

from __future__ import annotations

import contextlib
import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path

import keyring
import keyring.errors

DEFAULT_SERVER = "http://localhost:8787"
KEYCHAIN_SERVICE = "crosswalk"
LINK_FOLDER = ".crosswalk"
LINK_FILE = "project.json"


def server_url(explicit: str | None = None) -> str:
    return (explicit or os.environ.get("CROSSWALK_SERVER") or DEFAULT_SERVER).rstrip("/")


def _token_file() -> Path | None:
    """Set CROSSWALK_TOKEN_FILE to keep tokens in a file, for machines with no keychain."""
    path = os.environ.get("CROSSWALK_TOKEN_FILE")
    return Path(path) if path else None


def _read_token_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _write_token_file(path: Path, tokens: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch(mode=0o600, exist_ok=True)
    path.chmod(0o600)
    path.write_text(json.dumps(tokens), encoding="utf-8")


def load_token(server: str) -> str | None:
    path = _token_file()
    if path is not None:
        return _read_token_file(path).get(server)
    return keyring.get_password(KEYCHAIN_SERVICE, server)


def save_token(server: str, token: str) -> None:
    path = _token_file()
    if path is not None:
        tokens = _read_token_file(path)
        tokens[server] = token
        _write_token_file(path, tokens)
        return
    keyring.set_password(KEYCHAIN_SERVICE, server, token)


def delete_token(server: str) -> None:
    path = _token_file()
    if path is not None:
        tokens = _read_token_file(path)
        if tokens.pop(server, None) is not None:
            _write_token_file(path, tokens)
        return
    with contextlib.suppress(keyring.errors.PasswordDeleteError):
        keyring.delete_password(KEYCHAIN_SERVICE, server)


@dataclass(frozen=True)
class Link:
    server: str
    project_id: str
    project_name: str


def link_path(folder: Path) -> Path:
    return folder / LINK_FOLDER / LINK_FILE


def load_link(folder: Path, server: str) -> Link | None:
    """The folder's link, if it has one and it points at this server."""
    path = link_path(folder)
    if not path.exists():
        return None
    try:
        link = Link(**json.loads(path.read_text(encoding="utf-8")))
    except (ValueError, TypeError):
        return None
    return link if link.server == server else None


def save_link(folder: Path, link: Link) -> None:
    path = link_path(folder)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(link), indent=2) + "\n", encoding="utf-8")
