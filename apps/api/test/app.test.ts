import { CLI_CLIENT_ID, type Dataset } from "@crosswalk/contract";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { describeDevice } from "../src/app";
import { Browser, card, linkCli, ORIGIN, startTestServer, type TestServer } from "./harness";

let server: TestServer;

beforeEach(async () => {
  server = await startTestServer();
});

afterEach(async () => {
  await server.close();
});

async function datasetsOf(browser: Browser, projectId: string): Promise<Dataset[]> {
  const response = await browser.fetch(`/api/projects/${projectId}/datasets`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { datasets: Dataset[] }).datasets;
}

function cli(token: string) {
  return (path: string, method: string, body?: unknown) =>
    server.request(path, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}

describe("accounts", () => {
  it("signs a new account in right away", async () => {
    const browser = new Browser(server);
    await browser.signUp("ada@example.com");
    const me = await browser.fetch("/api/me");
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ email: "ada@example.com", name: "ada" });
  });

  it("refuses requests without a session", async () => {
    const response = await server.request("/api/projects");
    expect(response.status).toBe(401);
  });

  it("logs in with the password and out again", async () => {
    const first = new Browser(server);
    await first.signUp("ada@example.com", "a long password");

    const wrong = await new Browser(server).json("/api/auth/sign-in/email", "POST", {
      email: "ada@example.com",
      password: "not the password",
    });
    expect(wrong.status).toBe(401);

    const second = new Browser(server);
    const right = await second.json("/api/auth/sign-in/email", "POST", {
      email: "ada@example.com",
      password: "a long password",
    });
    expect(right.status).toBe(200);
    expect((await second.fetch("/api/me")).status).toBe(200);

    await second.json("/api/auth/sign-out", "POST", {});
    expect((await second.fetch("/api/me")).status).toBe(401);
  });

  it("refuses a second account for the same email", async () => {
    await new Browser(server).signUp("ada@example.com");
    const again = await new Browser(server).json("/api/auth/sign-up/email", "POST", {
      name: "Ada",
      email: "ada@example.com",
      password: "another password",
    });
    expect(again.ok).toBe(false);
  });

  it("refuses a short password", async () => {
    const response = await new Browser(server).json("/api/auth/sign-up/email", "POST", {
      name: "Ada",
      email: "ada@example.com",
      password: "short",
    });
    expect(response.status).toBe(400);
  });

  it("says whether Google sign-in is on", async () => {
    const response = await server.request("/api/config");
    expect(await response.json()).toEqual({ googleSignIn: false, publicUrl: ORIGIN });
  });
});

describe("projects", () => {
  it("creates, lists, renames, and deletes", async () => {
    const browser = new Browser(server);
    await browser.signUp("ada@example.com");

    const id = await browser.createProject("  Supplier litigation  ");
    let list = (await (await browser.fetch("/api/projects")).json()) as {
      projects: { id: string; name: string; datasetCount: number }[];
    };
    expect(list.projects).toMatchObject([{ id, name: "Supplier litigation", datasetCount: 0 }]);

    const renamed = await browser.json(`/api/projects/${id}`, "PATCH", { name: "Panel" });
    expect(renamed.status).toBe(200);

    const removed = await browser.json(`/api/projects/${id}`, "DELETE");
    expect(removed.status).toBe(200);
    list = (await (await browser.fetch("/api/projects")).json()) as typeof list;
    expect(list.projects).toEqual([]);
  });

  it("refuses an empty or very long name", async () => {
    const browser = new Browser(server);
    await browser.signUp("ada@example.com");
    expect((await browser.json("/api/projects", "POST", { name: "   " })).status).toBe(400);
    expect((await browser.json("/api/projects", "POST", { name: "x".repeat(81) })).status).toBe(
      400,
    );
    expect((await browser.json("/api/projects", "POST", {})).status).toBe(400);
  });

  it("hides a project from everyone but its owner", async () => {
    const ada = new Browser(server);
    await ada.signUp("ada@example.com");
    const id = await ada.createProject("Private");

    const grace = new Browser(server);
    await grace.signUp("grace@example.com");
    expect((await grace.fetch(`/api/projects/${id}`)).status).toBe(404);
    expect((await grace.fetch(`/api/projects/${id}/datasets`)).status).toBe(404);
    expect((await grace.json(`/api/projects/${id}`, "PATCH", { name: "Mine" })).status).toBe(404);
    expect((await grace.json(`/api/projects/${id}`, "DELETE")).status).toBe(404);
    expect((await grace.fetch(`/api/projects/${id}/events`)).status).toBe(404);
    expect(
      (await grace.json(`/api/projects/${id}/datasets`, "PUT", { datasets: [card("a.csv")] }))
        .status,
    ).toBe(404);
    expect((await ada.fetch(`/api/projects/${id}`)).status).toBe(200);
  });

  it("refuses a state-changing request from another site", async () => {
    const direct = await server.request("/api/projects", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({ name: "Nope" }),
    });
    expect(direct.status).toBe(403);
  });
});

describe("linking the CLI", () => {
  it("hands the CLI a token once the user approves the code", async () => {
    const browser = new Browser(server);
    await browser.signUp("ada@example.com");
    const token = await linkCli(server, browser);
    const me = await cli(token)("/api/me", "GET");
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ email: "ada@example.com" });
  });

  it("points the user at the device page", async () => {
    const response = await server.request("/api/auth/device/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
    });
    const body = (await response.json()) as {
      user_code: string;
      verification_uri: string;
      verification_uri_complete: string;
      interval: number;
    };
    expect(body.verification_uri).toBe(`${ORIGIN}/device`);
    expect(body.verification_uri_complete).toBe(`${ORIGIN}/device?user_code=${body.user_code}`);
    expect(body.interval).toBe(2);
  });

  it("keeps the CLI waiting until the code is approved", async () => {
    const codeResponse = await server.request("/api/auth/device/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
    });
    const code = (await codeResponse.json()) as { device_code: string };
    const tokenResponse = await server.request("/api/auth/device/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: code.device_code,
        client_id: CLI_CLIENT_ID,
      }),
    });
    expect(tokenResponse.status).toBe(400);
    expect(await tokenResponse.json()).toMatchObject({ error: "authorization_pending" });
  });

  it("refuses a client that is not the CLI", async () => {
    const response = await server.request("/api/auth/device/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: "someone-else" }),
    });
    expect(response.status).toBe(400);
  });

  it("lists linked devices and unlinks one", async () => {
    const browser = new Browser(server);
    await browser.signUp("ada@example.com");
    const token = await linkCli(server, browser, "crosswalk-cli/0.1.0 (Ada's MacBook; macOS)");

    const list = (await (await browser.fetch("/api/devices")).json()) as {
      devices: { id: string; label: string; current: boolean }[];
    };
    expect(list.devices).toHaveLength(1);
    expect(list.devices[0]).toMatchObject({ label: "Ada's MacBook, macOS", current: false });

    const other = new Browser(server);
    await other.signUp("grace@example.com");
    const deviceId = list.devices[0]?.id as string;
    expect((await other.json(`/api/devices/${deviceId}`, "DELETE")).status).toBe(404);

    expect((await browser.json(`/api/devices/${deviceId}`, "DELETE")).status).toBe(200);
    expect((await cli(token)("/api/me", "GET")).status).toBe(401);
    expect((await browser.fetch("/api/me")).status).toBe(200);
  });

  it("does not let the device list unlink the browser session", async () => {
    const browser = new Browser(server);
    await browser.signUp("ada@example.com");
    const list = (await (await browser.fetch("/api/devices")).json()) as { devices: unknown[] };
    expect(list.devices).toEqual([]);

    const current = (await (await browser.fetch("/api/auth/get-session")).json()) as {
      session: { id: string };
    };
    const refused = await browser.json(`/api/devices/${current.session.id}`, "DELETE");
    expect(refused.status).toBe(404);
    expect((await browser.fetch("/api/me")).status).toBe(200);
  });
});

describe("datasets", () => {
  async function linked() {
    const browser = new Browser(server);
    await browser.signUp("ada@example.com");
    const projectId = await browser.createProject("Cases");
    const token = await linkCli(server, browser);
    return { browser, projectId, send: cli(token) };
  }

  it("puts the CLI's datasets on the canvas without overlap", async () => {
    const { browser, projectId, send } = await linked();
    const response = await send(`/api/projects/${projectId}/datasets`, "PUT", {
      datasets: [card("a.csv"), card("b.csv"), card("c.csv")],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ added: 3, updated: 0 });

    const datasets = await datasetsOf(browser, projectId);
    expect(datasets.map((dataset) => dataset.key)).toEqual(["a.csv", "b.csv", "c.csv"]);
    const spots = new Set(datasets.map((dataset) => `${dataset.x},${dataset.y}`));
    expect(spots.size).toBe(3);
    expect(datasets[0]?.columns[0]).toMatchObject({ name: "id", type: "text", uniqueRate: 1 });
  });

  it("updates a dataset it already has and keeps where the user put it", async () => {
    const { browser, projectId, send } = await linked();
    await send(`/api/projects/${projectId}/datasets`, "PUT", { datasets: [card("a.csv")] });
    const [first] = await datasetsOf(browser, projectId);
    const moved = await browser.json(`/api/projects/${projectId}/datasets/${first?.id}`, "PATCH", {
      x: 512.5,
      y: -40,
    });
    expect(moved.status).toBe(200);

    const again = await send(`/api/projects/${projectId}/datasets`, "PUT", {
      datasets: [card("a.csv", ["id", "name", "year"]), card("b.csv")],
    });
    expect(await again.json()).toEqual({ added: 1, updated: 1 });

    const datasets = await datasetsOf(browser, projectId);
    expect(datasets).toHaveLength(2);
    const a = datasets.find((dataset) => dataset.key === "a.csv");
    expect(a).toMatchObject({ id: first?.id, x: 512.5, y: -40 });
    expect(a?.columns.map((column) => column.name)).toEqual(["id", "name", "year"]);
  });

  it("removes a card", async () => {
    const { browser, projectId, send } = await linked();
    await send(`/api/projects/${projectId}/datasets`, "PUT", { datasets: [card("a.csv")] });
    const [first] = await datasetsOf(browser, projectId);
    const removed = await browser.json(
      `/api/projects/${projectId}/datasets/${first?.id}`,
      "DELETE",
    );
    expect(removed.status).toBe(200);
    expect(await datasetsOf(browser, projectId)).toEqual([]);
    const missing = await browser.json(
      `/api/projects/${projectId}/datasets/${first?.id}`,
      "DELETE",
    );
    expect(missing.status).toBe(404);
  });

  it("refuses a NUL character with a message instead of a server error", async () => {
    const { browser, projectId, send } = await linked();
    const bad = card("a.csv", ["ok", "bro\u0000ken"]);
    const response = await send(`/api/projects/${projectId}/datasets`, "PUT", { datasets: [bad] });
    expect(response.status).toBe(400);
    expect(await datasetsOf(browser, projectId)).toEqual([]);
    expect((await browser.json("/api/projects", "POST", { name: "a\u0000b" })).status).toBe(400);
  });

  it("refuses a malformed upload and stores nothing", async () => {
    const { browser, projectId, send } = await linked();
    // Row counts are stored as 32-bit integers, so a larger one is refused, not a crash.
    const tooMany = { ...card("a.csv"), rowCount: 2_147_483_648 };
    expect(
      (await send(`/api/projects/${projectId}/datasets`, "PUT", { datasets: [tooMany] })).status,
    ).toBe(400);
    const bad = { ...card("a.csv"), rowCount: -1 };
    expect(
      (await send(`/api/projects/${projectId}/datasets`, "PUT", { datasets: [bad] })).status,
    ).toBe(400);
    expect(
      (
        await send(`/api/projects/${projectId}/datasets`, "PUT", {
          datasets: [card("a.csv"), card("a.csv")],
        })
      ).status,
    ).toBe(400);
    expect((await send(`/api/projects/${projectId}/datasets`, "PUT", "nonsense")).status).toBe(400);
    expect(await datasetsOf(browser, projectId)).toEqual([]);
  });

  it("refuses a position that is not a number", async () => {
    const { browser, projectId, send } = await linked();
    await send(`/api/projects/${projectId}/datasets`, "PUT", { datasets: [card("a.csv")] });
    const [first] = await datasetsOf(browser, projectId);
    const response = await browser.json(
      `/api/projects/${projectId}/datasets/${first?.id}`,
      "PATCH",
      { x: "left", y: 0 },
    );
    expect(response.status).toBe(400);
  });

  it("counts datasets in the project list", async () => {
    const { browser, projectId, send } = await linked();
    await send(`/api/projects/${projectId}/datasets`, "PUT", {
      datasets: [card("a.csv"), card("b.csv")],
    });
    const list = (await (await browser.fetch("/api/projects")).json()) as {
      projects: { datasetCount: number }[];
    };
    expect(list.projects[0]?.datasetCount).toBe(2);
  });

  it("tells an open canvas when the CLI sends datasets", async () => {
    const { browser, projectId, send } = await linked();
    const stream = await browser.fetch(`/api/projects/${projectId}/events`);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    const reader = (stream.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let received = "";
    const readUntil = async (marker: string) => {
      while (!received.includes(marker)) {
        const chunk = await reader.read();
        if (chunk.done) {
          throw new Error(`The stream ended before "${marker}" arrived.`);
        }
        received += decoder.decode(chunk.value, { stream: true });
      }
    };
    await readUntil("event: ready");
    expect(server.events.listenerCount(projectId)).toBe(1);

    await send(`/api/projects/${projectId}/datasets`, "PUT", { datasets: [card("a.csv")] });
    await readUntil("event: datasets");

    await reader.cancel();
    await expect.poll(() => server.events.listenerCount(projectId)).toBe(0);
  });
});

describe("describeDevice", () => {
  it("reads the machine out of the CLI's user agent", () => {
    expect(describeDevice("crosswalk-cli/0.1.0 (Ada's MacBook; macOS)")).toBe(
      "Ada's MacBook, macOS",
    );
    expect(describeDevice("crosswalk-cli/0.1.0")).toBe("Crosswalk CLI");
  });
});
