import json
from pathlib import Path

import httpx
import pytest

from crosswalk_cli import store
from crosswalk_cli.api import ApiError, Client, DeviceCode, NotSignedIn, user_agent

SERVER = "http://crosswalk.test"
CODE = DeviceCode(
    device_code="device-123",
    user_code="ABCD1234",
    verification_uri=f"{SERVER}/device",
    verification_uri_complete=f"{SERVER}/device?user_code=ABCD1234",
    expires_in=600,
    interval=2,
)


def client(handler, token: str | None = None) -> Client:
    return Client(SERVER, token, transport=httpx.MockTransport(handler))


class Clock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds

    def time(self) -> float:
        return self.now


def pending(error: str) -> httpx.Response:
    return httpx.Response(400, json={"error": error, "error_description": error})


def test_user_agent_names_the_cli():
    assert user_agent().startswith("crosswalk-cli/")
    assert "(" in user_agent()


def test_requests_carry_the_token_and_the_user_agent():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(request.headers)
        return httpx.Response(200, json={"email": "ada@example.com"})

    assert client(handler, "secret-token").me() == {"email": "ada@example.com"}
    assert seen["authorization"] == "Bearer secret-token"
    assert seen["user-agent"].startswith("crosswalk-cli/")


def test_device_code_request():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/auth/device/code"
        assert json.loads(request.content) == {"client_id": "crosswalk-cli"}
        return httpx.Response(200, json=CODE.__dict__)

    assert client(handler).request_device_code() == CODE


def test_waiting_for_the_token_keeps_asking_and_slows_down_when_told():
    answers = iter(
        [
            pending("authorization_pending"),
            pending("slow_down"),
            pending("authorization_pending"),
            httpx.Response(200, json={"access_token": "the-token"}),
        ]
    )
    clock = Clock()
    token = client(lambda _request: next(answers)).wait_for_token(CODE, clock.sleep, clock.time)
    assert token == "the-token"
    assert clock.sleeps == [2, 2, 4, 4]


def test_waiting_stops_when_the_user_refuses():
    clock = Clock()
    with pytest.raises(ApiError, match="refused"):
        client(lambda _request: pending("access_denied")).wait_for_token(
            CODE, clock.sleep, clock.time
        )


def test_waiting_stops_when_the_code_runs_out():
    clock = Clock()
    with pytest.raises(ApiError, match="ran out"):
        client(lambda _request: pending("authorization_pending")).wait_for_token(
            CODE, clock.sleep, clock.time
        )
    assert clock.now >= CODE.expires_in


def test_an_expired_session_asks_the_user_to_log_in():
    with pytest.raises(NotSignedIn, match="crosswalk login"):
        client(lambda _request: httpx.Response(401, json={"error": "no"})).projects()


def test_server_errors_are_shown_in_the_servers_words():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "That project does not exist."})

    with pytest.raises(ApiError, match="That project does not exist"):
        client(handler, "t").send_datasets("missing", [])


def test_an_unreachable_server_is_explained():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(ApiError, match="Is the server running"):
        client(handler, "t").me()


def test_sending_datasets():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "PUT"
        assert request.url.path == "/api/projects/p1/datasets"
        assert json.loads(request.content) == {"datasets": [{"key": "a.csv"}]}
        return httpx.Response(200, json={"added": 1, "updated": 0})

    assert client(handler, "t").send_datasets("p1", [{"key": "a.csv"}]) == {
        "added": 1,
        "updated": 0,
    }


def test_tokens_in_a_file_are_kept_per_server(tmp_path: Path, monkeypatch):
    path = tmp_path / "nested" / "tokens.json"
    monkeypatch.setenv("CROSSWALK_TOKEN_FILE", str(path))
    assert store.load_token(SERVER) is None
    store.save_token(SERVER, "one")
    store.save_token("http://other.test", "two")
    assert store.load_token(SERVER) == "one"
    assert path.stat().st_mode & 0o777 == 0o600
    store.delete_token(SERVER)
    assert store.load_token(SERVER) is None
    assert store.load_token("http://other.test") == "two"
    store.delete_token(SERVER)


def test_server_url_precedence(monkeypatch):
    monkeypatch.delenv("CROSSWALK_SERVER", raising=False)
    assert store.server_url() == "http://localhost:8787"
    monkeypatch.setenv("CROSSWALK_SERVER", "http://env.test/")
    assert store.server_url() == "http://env.test"
    assert store.server_url("http://flag.test/") == "http://flag.test"


def test_folder_link_round_trip(tmp_path: Path):
    assert store.load_link(tmp_path, SERVER) is None
    link = store.Link(SERVER, "p1", "Cases")
    store.save_link(tmp_path, link)
    assert store.load_link(tmp_path, SERVER) == link
    # A link made against another server does not count.
    assert store.load_link(tmp_path, "http://other.test") is None


def test_a_damaged_link_file_is_ignored(tmp_path: Path):
    path = store.link_path(tmp_path)
    path.parent.mkdir()
    path.write_text("{not json", encoding="utf-8")
    assert store.load_link(tmp_path, SERVER) is None
