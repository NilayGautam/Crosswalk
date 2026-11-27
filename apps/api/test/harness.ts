import { CLI_CLIENT_ID, type DatasetCard } from "@crosswalk/contract";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import { openDatabase } from "../src/db/client";
import { ProjectEvents } from "../src/events";

export const ORIGIN = "http://localhost:8787";

export interface TestServer {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  events: ProjectEvents;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const database = await openDatabase();
  const settings = {
    publicUrl: ORIGIN,
    trustedOrigins: [ORIGIN],
    secret: "test-secret-that-is-long-enough-for-signing",
    google: null,
  };
  const auth = createAuth(database.db, settings);
  const events = new ProjectEvents();
  const app = createApp({
    db: database.db,
    auth,
    events,
    trustedOrigins: settings.trustedOrigins,
    googleSignIn: false,
    publicUrl: settings.publicUrl,
    webDist: null,
  });
  return {
    request: async (path, init) => app.fetch(new Request(`${ORIGIN}${path}`, init)),
    events,
    close: database.close,
  };
}

/** A signed-in browser: it keeps cookies and sends the page's origin. */
export class Browser {
  private cookies = new Map<string, string>();

  constructor(private readonly server: TestServer) {}

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("origin", ORIGIN);
    if (this.cookies.size > 0) {
      headers.set(
        "cookie",
        [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "),
      );
    }
    if (init.body !== undefined && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const response = await this.server.request(path, { ...init, headers });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const separator = pair?.indexOf("=") ?? -1;
      if (pair === undefined || separator < 0) {
        continue;
      }
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (value === "" || /max-age=0/i.test(cookie)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
    return response;
  }

  json(path: string, method: string, body?: unknown): Promise<Response> {
    return this.fetch(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async signUp(email: string, password = "correct horse battery"): Promise<void> {
    const response = await this.json("/api/auth/sign-up/email", "POST", {
      name: email.split("@")[0],
      email,
      password,
    });
    if (!response.ok) {
      throw new Error(`Sign up failed: ${response.status} ${await response.text()}`);
    }
  }

  async createProject(name: string): Promise<string> {
    const response = await this.json("/api/projects", "POST", { name });
    const body = (await response.json()) as { project: { id: string } };
    return body.project.id;
  }
}

/** Runs the device flow the way the CLI does and returns its access token. */
export async function linkCli(
  server: TestServer,
  browser: Browser,
  userAgent = "crosswalk-cli/0.1.0 (Test Laptop; macOS)",
): Promise<string> {
  const headers = { "content-type": "application/json", "user-agent": userAgent };
  const codeResponse = await server.request("/api/auth/device/code", {
    method: "POST",
    headers,
    body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
  });
  if (!codeResponse.ok) {
    throw new Error(`Device code failed: ${await codeResponse.text()}`);
  }
  const code = (await codeResponse.json()) as { device_code: string; user_code: string };
  // The device page looks the code up first, which ties it to the signed-in user.
  const verify = await browser.fetch(
    `/api/auth/device?user_code=${encodeURIComponent(code.user_code)}`,
  );
  if (!verify.ok) {
    throw new Error(`Verify failed: ${verify.status} ${await verify.text()}`);
  }
  const approve = await browser.json("/api/auth/device/approve", "POST", {
    userCode: code.user_code,
  });
  if (!approve.ok) {
    throw new Error(`Approve failed: ${approve.status} ${await approve.text()}`);
  }
  const tokenResponse = await server.request("/api/auth/device/token", {
    method: "POST",
    headers,
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: code.device_code,
      client_id: CLI_CLIENT_ID,
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`Token failed: ${await tokenResponse.text()}`);
  }
  const token = (await tokenResponse.json()) as { access_token: string };
  return token.access_token;
}

export function card(key: string, columnNames: string[] = ["id", "name"]): DatasetCard {
  return {
    key,
    name: key,
    path: key,
    sheet: null,
    format: "csv",
    rowCount: 10,
    profiledRows: 10,
    columns: columnNames.map((name) => ({
      name,
      type: "text",
      nullRate: 0,
      distinctCount: 10,
      uniqueRate: 1,
      shape: "text, 3 to 8 characters",
    })),
  };
}
