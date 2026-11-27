import { type ServerType, serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { openDatabase } from "./db/client";
import type { Config } from "./env";
import { ProjectEvents } from "./events";

export interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

/** Opens the database, builds the app, and listens. Used by the entry point and the tests. */
export async function startServer(config: Config, dataDir?: string): Promise<RunningServer> {
  const database = await openDatabase(dataDir);
  const auth = createAuth(database.db, config);
  const app = createApp({
    db: database.db,
    auth,
    events: new ProjectEvents(),
    trustedOrigins: config.trustedOrigins,
    googleSignIn: config.google !== null,
    publicUrl: config.publicUrl,
    webDist: config.webDist,
  });
  const server: ServerType = await new Promise((resolve) => {
    const listening = serve({ fetch: app.fetch, port: config.port, hostname: "127.0.0.1" }, () =>
      resolve(listening),
    );
  });
  return {
    url: `http://localhost:${config.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        // Open event streams would otherwise keep the server alive forever.
        if ("closeAllConnections" in server) {
          server.closeAllConnections();
        }
      });
      await database.close();
    },
  };
}
