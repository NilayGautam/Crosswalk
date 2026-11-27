import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export interface Config {
  port: number;
  /** Where the embedded database and the generated secret are kept. */
  dataDir: string;
  /** The address people open in a browser. Sign-in links and device codes point here. */
  publicUrl: string;
  /** Origins allowed to call the API with a session cookie. */
  trustedOrigins: string[];
  secret: string;
  google: { clientId: string; clientSecret: string } | null;
  /** The built web app to serve, or null when the web dev server runs separately. */
  webDist: string | null;
}

function loadOrCreateSecret(dataDir: string): string {
  const path = join(dataDir, "auth-secret");
  if (existsSync(path)) {
    return readFileSync(path, "utf8").trim();
  }
  mkdirSync(dataDir, { recursive: true });
  const secret = randomBytes(32).toString("base64url");
  writeFileSync(path, `${secret}\n`, { mode: 0o600 });
  return secret;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.CROSSWALK_PORT ?? 8787);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("CROSSWALK_PORT must be a port number.");
  }
  const dataDir = resolve(env.CROSSWALK_DATA_DIR ?? join(API_ROOT, ".data"));
  const serverUrl = `http://localhost:${port}`;
  const publicUrl = (env.CROSSWALK_PUBLIC_URL ?? serverUrl).replace(/\/$/, "");
  const defaultWebDist = join(API_ROOT, "..", "web", "out");
  const webDist =
    env.CROSSWALK_WEB_DIST === "none" ? null : resolve(env.CROSSWALK_WEB_DIST ?? defaultWebDist);
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return {
    port,
    dataDir,
    publicUrl,
    trustedOrigins: [...new Set([publicUrl, serverUrl])],
    secret: loadOrCreateSecret(dataDir),
    google: clientId && clientSecret ? { clientId, clientSecret } : null,
    webDist: webDist !== null && existsSync(webDist) ? webDist : null,
  };
}
