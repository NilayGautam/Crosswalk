"""Everything the CLI says to the Crosswalk server."""

from __future__ import annotations

import platform
import re
import socket
import time
from collections.abc import Callable
from dataclasses import dataclass

import httpx

from crosswalk_cli import __version__
from crosswalk_cli.limits import MAX_DATASETS_PER_REQUEST, MAX_REQUEST_BYTES, card_bytes

CLIENT_ID = "crosswalk-cli"
DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code"
TIMEOUT_SECONDS = 60.0


class ApiError(Exception):
    """Something the user can act on. The message is shown as it is."""


class NotSignedIn(ApiError):
    pass


def user_agent() -> str:
    """Names this machine, so a linked device can be recognized in the web app."""
    host = socket.gethostname().removesuffix(".local")
    host = re.sub(r"[^\w .'-]", "", host).strip() or "This computer"
    system = {"Darwin": "macOS"}.get(platform.system(), platform.system() or "Unknown")
    return f"crosswalk-cli/{__version__} ({host}; {system})"


@dataclass(frozen=True)
class DeviceCode:
    device_code: str
    user_code: str
    verification_uri: str
    verification_uri_complete: str
    expires_in: int
    interval: int


@dataclass(frozen=True)
class Project:
    id: str
    name: str
    dataset_count: int


class Client:
    def __init__(
        self,
        server: str,
        token: str | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.server = server
        headers = {"user-agent": user_agent()}
        if token:
            headers["authorization"] = f"Bearer {token}"
        self._http = httpx.Client(
            base_url=server, headers=headers, timeout=TIMEOUT_SECONDS, transport=transport
        )

    def close(self) -> None:
        self._http.close()

    def _send(self, method: str, path: str, body: object | None = None) -> httpx.Response:
        try:
            return self._http.request(method, path, json=body)
        except httpx.ConnectError as error:
            raise ApiError(
                f"Could not reach Crosswalk at {self.server}. Is the server running?"
            ) from error
        except httpx.TimeoutException as error:
            raise ApiError(f"Crosswalk at {self.server} took too long to answer.") from error

    def _json(self, method: str, path: str, body: object | None = None) -> dict:
        response = self._send(method, path, body)
        if response.status_code == 401:
            raise NotSignedIn("This computer is not linked. Run `crosswalk login` first.")
        if response.is_error:
            raise ApiError(_message(response))
        return response.json()

    # Linking

    def request_device_code(self) -> DeviceCode:
        response = self._send("POST", "/api/auth/device/code", {"client_id": CLIENT_ID})
        if response.is_error:
            raise ApiError(_message(response))
        return DeviceCode(**response.json())

    def wait_for_token(
        self,
        code: DeviceCode,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> str:
        """Ask for the token until the user approves, refuses, or the code runs out."""
        interval = float(code.interval)
        deadline = clock() + code.expires_in
        while clock() < deadline:
            sleep(interval)
            response = self._send(
                "POST",
                "/api/auth/device/token",
                {
                    "grant_type": DEVICE_GRANT,
                    "device_code": code.device_code,
                    "client_id": CLIENT_ID,
                },
            )
            if response.is_success:
                return response.json()["access_token"]
            error = _error_code(response)
            if error == "authorization_pending":
                continue
            if error == "slow_down":
                interval += 2
                continue
            if error == "access_denied":
                raise ApiError("The request was refused in the browser. Nothing was linked.")
            if error == "expired_token":
                break
            raise ApiError(_message(response))
        raise ApiError("The code ran out before it was confirmed. Run `crosswalk login` again.")

    def sign_out(self) -> None:
        self._send("POST", "/api/auth/sign-out", {})

    # Account and projects

    def me(self) -> dict:
        return self._json("GET", "/api/me")

    def web_url(self) -> str:
        return self._json("GET", "/api/config")["publicUrl"]

    def projects(self) -> list[Project]:
        body = self._json("GET", "/api/projects")
        return [_project(item) for item in body["projects"]]

    def project(self, project_id: str) -> Project | None:
        return next((item for item in self.projects() if item.id == project_id), None)

    def create_project(self, name: str) -> Project:
        return _project(self._json("POST", "/api/projects", {"name": name})["project"])

    def send_datasets(self, project_id: str, cards: list[dict]) -> dict:
        """Send the cards in as many requests as the server's limits need."""
        total = {"added": 0, "updated": 0}
        for batch in _batches(cards):
            outcome = self._json("PUT", f"/api/projects/{project_id}/datasets", {"datasets": batch})
            total["added"] += outcome["added"]
            total["updated"] += outcome["updated"]
        return total


def _batches(cards: list[dict]) -> list[list[dict]]:
    batches: list[list[dict]] = [[]]
    size = 0
    for card in cards:
        weight = card_bytes(card)
        current = batches[-1]
        if current and (
            len(current) == MAX_DATASETS_PER_REQUEST or size + weight > MAX_REQUEST_BYTES
        ):
            current = []
            batches.append(current)
            size = 0
        current.append(card)
        size += weight
    return batches


def _project(item: dict) -> Project:
    return Project(id=item["id"], name=item["name"], dataset_count=item.get("datasetCount", 0))


def _error_code(response: httpx.Response) -> str | None:
    try:
        return response.json().get("error")
    except ValueError:
        return None


def _message(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        body = {}
    detail = body.get("error_description") or body.get("message") or body.get("error")
    if isinstance(detail, str) and detail:
        return detail
    return f"Crosswalk answered with an error ({response.status_code})."
