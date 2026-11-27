import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CARD_WIDTH,
  cardHeight,
  type Dataset,
  type Project,
  type PublicConfig,
  placeCards,
  positionSchema,
  projectBodySchema,
  putDatasetsBodySchema,
} from "@crosswalk/contract";
import { serveStatic } from "@hono/node-server/serve-static";
import { and, asc, count, desc, eq, like } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { streamSSE } from "hono/streaming";
import type { z } from "zod";
import type { Auth } from "./auth";
import type { Database } from "./db/client";
import { dataset, project, session as sessionTable } from "./db/schema";
import type { ProjectEvents } from "./events";

/** Every CLI session announces itself with a user agent that starts like this. */
export const CLI_USER_AGENT_PREFIX = "crosswalk-cli/";
const HEARTBEAT_MS = 20_000;
const MAX_BODY_BYTES = 16 * 1024 * 1024;

export interface AppDeps {
  db: Database;
  auth: Auth;
  events: ProjectEvents;
  trustedOrigins: string[];
  googleSignIn: boolean;
  publicUrl: string;
  webDist: string | null;
}

type Env = {
  Variables: {
    userId: string;
    userName: string;
    userEmail: string;
    sessionId: string;
  };
};

function toDataset(row: typeof dataset.$inferSelect): Dataset {
  return {
    id: row.id,
    projectId: row.projectId,
    key: row.key,
    name: row.name,
    path: row.path,
    sheet: row.sheet,
    format: row.format,
    rowCount: row.rowCount,
    profiledRows: row.profiledRows,
    columns: row.columns,
    x: row.x,
    y: row.y,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) {
    return "The request is not valid.";
  }
  const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${where}${issue.message}`;
}

export function createApp(deps: AppDeps) {
  const { db, auth, events } = deps;
  const app = new Hono<Env>();

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: "Something went wrong on the server." }, 500);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/config", (c) => {
    const config: PublicConfig = {
      googleSignIn: deps.googleSignIn,
      publicUrl: deps.publicUrl,
    };
    return c.json(config);
  });

  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  const api = new Hono<Env>();

  // A browser sends its session cookie on its own, so a state-changing request
  // must come from a page we serve. The CLI sends no Origin header at all.
  api.use(async (c, next) => {
    const method = c.req.method;
    if (method !== "GET" && method !== "HEAD") {
      const origin = c.req.header("origin");
      if (origin !== undefined && !deps.trustedOrigins.includes(origin)) {
        return c.json({ error: "This request came from a page Crosswalk does not trust." }, 403);
      }
    }
    await next();
  });

  api.use(async (c, next) => {
    const current = await auth.api.getSession({ headers: c.req.raw.headers });
    if (current === null) {
      return c.json({ error: "You are not signed in." }, 401);
    }
    c.set("userId", current.user.id);
    c.set("userName", current.user.name);
    c.set("userEmail", current.user.email);
    c.set("sessionId", current.session.id);
    await next();
  });

  api.use(bodyLimit({ maxSize: MAX_BODY_BYTES }));

  async function ownedProject(userId: string, projectId: string) {
    const rows = await db
      .select()
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
    try {
      return await c.req.json();
    } catch {
      return undefined;
    }
  }

  api.get("/me", (c) =>
    c.json({ id: c.get("userId"), name: c.get("userName"), email: c.get("userEmail") }),
  );

  api.get("/projects", async (c) => {
    const rows = await db
      .select({
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        datasetCount: count(dataset.id),
      })
      .from(project)
      .leftJoin(dataset, eq(dataset.projectId, project.id))
      .where(eq(project.userId, c.get("userId")))
      .groupBy(project.id)
      .orderBy(desc(project.updatedAt), asc(project.name));
    const projects: Project[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      datasetCount: row.datasetCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
    return c.json({ projects });
  });

  api.post("/projects", async (c) => {
    const parsed = projectBodySchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return c.json({ error: firstIssue(parsed.error) }, 400);
    }
    const [row] = await db
      .insert(project)
      .values({ id: randomUUID(), userId: c.get("userId"), name: parsed.data.name })
      .returning();
    if (row === undefined) {
      throw new Error("The project was not created.");
    }
    const created: Project = {
      id: row.id,
      name: row.name,
      datasetCount: 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
    return c.json({ project: created }, 201);
  });

  api.get("/projects/:projectId", async (c) => {
    const row = await ownedProject(c.get("userId"), c.req.param("projectId"));
    if (row === null) {
      return c.json({ error: "That project does not exist." }, 404);
    }
    return c.json({ project: { id: row.id, name: row.name } });
  });

  api.patch("/projects/:projectId", async (c) => {
    const parsed = projectBodySchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return c.json({ error: firstIssue(parsed.error) }, 400);
    }
    const [row] = await db
      .update(project)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(and(eq(project.id, c.req.param("projectId")), eq(project.userId, c.get("userId"))))
      .returning();
    if (row === undefined) {
      return c.json({ error: "That project does not exist." }, 404);
    }
    return c.json({ project: { id: row.id, name: row.name } });
  });

  api.delete("/projects/:projectId", async (c) => {
    const projectId = c.req.param("projectId");
    const deleted = await db
      .delete(project)
      .where(and(eq(project.id, projectId), eq(project.userId, c.get("userId"))))
      .returning({ id: project.id });
    if (deleted.length === 0) {
      return c.json({ error: "That project does not exist." }, 404);
    }
    events.publish(projectId);
    return c.json({ ok: true });
  });

  api.get("/projects/:projectId/datasets", async (c) => {
    const owned = await ownedProject(c.get("userId"), c.req.param("projectId"));
    if (owned === null) {
      return c.json({ error: "That project does not exist." }, 404);
    }
    const rows = await db
      .select()
      .from(dataset)
      .where(eq(dataset.projectId, owned.id))
      .orderBy(asc(dataset.createdAt), asc(dataset.key));
    return c.json({ datasets: rows.map(toDataset) });
  });

  // The CLI sends every dataset it found in a folder. A dataset the project
  // already has keeps its place on the canvas, and a new one gets a free spot.
  api.put("/projects/:projectId/datasets", async (c) => {
    const owned = await ownedProject(c.get("userId"), c.req.param("projectId"));
    if (owned === null) {
      return c.json({ error: "That project does not exist." }, 404);
    }
    const parsed = putDatasetsBodySchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return c.json({ error: firstIssue(parsed.error) }, 400);
    }
    const incoming = parsed.data.datasets;
    const keys = new Set(incoming.map((card) => card.key));
    if (keys.size !== incoming.length) {
      return c.json({ error: "Two datasets in the request have the same key." }, 400);
    }

    const result = await db.transaction(async (tx) => {
      const existing = await tx.select().from(dataset).where(eq(dataset.projectId, owned.id));
      const byKey = new Map(existing.map((row) => [row.key, row]));
      const fresh = incoming.filter((card) => !byKey.has(card.key));
      const spots = placeCards(
        existing.map((row) => ({
          x: row.x,
          y: row.y,
          width: CARD_WIDTH,
          height: cardHeight(row.columns.length),
        })),
        fresh.map((card) => cardHeight(card.columns.length)),
      );
      const now = new Date();
      let added = 0;
      let updated = 0;
      for (const card of incoming) {
        const current = byKey.get(card.key);
        const values = {
          name: card.name,
          path: card.path,
          sheet: card.sheet,
          format: card.format,
          rowCount: card.rowCount,
          profiledRows: card.profiledRows,
          columns: card.columns,
          updatedAt: now,
        };
        if (current !== undefined) {
          await tx.update(dataset).set(values).where(eq(dataset.id, current.id));
          updated += 1;
          continue;
        }
        const spot = spots[added];
        if (spot === undefined) {
          throw new Error("A new dataset has no position.");
        }
        await tx.insert(dataset).values({
          id: randomUUID(),
          projectId: owned.id,
          key: card.key,
          x: spot.x,
          y: spot.y,
          createdAt: now,
          ...values,
        });
        added += 1;
      }
      await tx.update(project).set({ updatedAt: now }).where(eq(project.id, owned.id));
      return { added, updated };
    });

    events.publish(owned.id);
    return c.json(result);
  });

  api.patch("/projects/:projectId/datasets/:datasetId", async (c) => {
    const owned = await ownedProject(c.get("userId"), c.req.param("projectId"));
    if (owned === null) {
      return c.json({ error: "That project does not exist." }, 404);
    }
    const parsed = positionSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      return c.json({ error: firstIssue(parsed.error) }, 400);
    }
    const [row] = await db
      .update(dataset)
      .set({ x: parsed.data.x, y: parsed.data.y })
      .where(and(eq(dataset.id, c.req.param("datasetId")), eq(dataset.projectId, owned.id)))
      .returning();
    if (row === undefined) {
      return c.json({ error: "That dataset is not on this canvas." }, 404);
    }
    return c.json({ dataset: toDataset(row) });
  });

  api.delete("/projects/:projectId/datasets/:datasetId", async (c) => {
    const owned = await ownedProject(c.get("userId"), c.req.param("projectId"));
    if (owned === null) {
      return c.json({ error: "That project does not exist." }, 404);
    }
    const deleted = await db
      .delete(dataset)
      .where(and(eq(dataset.id, c.req.param("datasetId")), eq(dataset.projectId, owned.id)))
      .returning({ id: dataset.id });
    if (deleted.length === 0) {
      return c.json({ error: "That dataset is not on this canvas." }, 404);
    }
    events.publish(owned.id);
    return c.json({ ok: true });
  });

  // One long-lived response per open canvas. It carries no data, only the
  // signal that the canvas should fetch its datasets again.
  api.get("/projects/:projectId/events", async (c) => {
    const owned = await ownedProject(c.get("userId"), c.req.param("projectId"));
    if (owned === null) {
      return c.json({ error: "That project does not exist." }, 404);
    }
    c.header("Cache-Control", "no-cache, no-transform");
    c.header("X-Accel-Buffering", "no");
    return streamSSE(c, async (stream) => {
      let open = true;
      let wake: (() => void) | undefined;
      let pending = 0;
      const unsubscribe = events.subscribe(owned.id, () => {
        pending += 1;
        wake?.();
      });
      stream.onAbort(() => {
        open = false;
        wake?.();
      });
      try {
        await stream.writeSSE({ event: "ready", data: "" });
        while (open) {
          if (pending > 0) {
            pending = 0;
            await stream.writeSSE({ event: "datasets", data: "" });
            continue;
          }
          const timedOut = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(true), HEARTBEAT_MS);
            wake = () => {
              clearTimeout(timer);
              resolve(false);
            };
          });
          wake = undefined;
          if (timedOut && open) {
            await stream.writeSSE({ event: "ping", data: "" });
          }
        }
      } finally {
        unsubscribe();
      }
    });
  });

  // A linked device is a session that was opened by the CLI.
  api.get("/devices", async (c) => {
    const rows = await db
      .select({
        id: sessionTable.id,
        userAgent: sessionTable.userAgent,
        createdAt: sessionTable.createdAt,
        updatedAt: sessionTable.updatedAt,
      })
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.userId, c.get("userId")),
          like(sessionTable.userAgent, `${CLI_USER_AGENT_PREFIX}%`),
        ),
      )
      .orderBy(desc(sessionTable.createdAt));
    return c.json({
      devices: rows.map((row) => ({
        id: row.id,
        label: describeDevice(row.userAgent ?? ""),
        linkedAt: row.createdAt.toISOString(),
        lastUsedAt: row.updatedAt.toISOString(),
        current: row.id === c.get("sessionId"),
      })),
    });
  });

  api.delete("/devices/:deviceId", async (c) => {
    const deleted = await db
      .delete(sessionTable)
      .where(
        and(
          eq(sessionTable.id, c.req.param("deviceId")),
          eq(sessionTable.userId, c.get("userId")),
          like(sessionTable.userAgent, `${CLI_USER_AGENT_PREFIX}%`),
        ),
      )
      .returning({ id: sessionTable.id });
    if (deleted.length === 0) {
      return c.json({ error: "That device is not linked." }, 404);
    }
    return c.json({ ok: true });
  });

  app.route("/api", api);
  app.all("/api/*", (c) => c.json({ error: "There is nothing at this address." }, 404));

  if (deps.webDist !== null) {
    const root = deps.webDist;
    app.use(
      "/_next/static/*",
      serveStatic({
        root,
        onFound: (_path, c) => {
          c.header("Cache-Control", "public, max-age=31536000, immutable");
        },
      }),
    );
    app.use("*", serveStatic({ root }));
    const notFoundPath = join(root, "404.html");
    const notFoundPage = existsSync(notFoundPath) ? readFileSync(notFoundPath, "utf8") : null;
    app.notFound((c) =>
      notFoundPage === null ? c.text("Not found", 404) : c.html(notFoundPage, 404),
    );
  }

  return app;
}

/** Turns "crosswalk-cli/0.1.0 (Ada's MacBook; macOS)" into "Ada's MacBook, macOS". */
export function describeDevice(userAgent: string): string {
  const match = /\(([^)]*)\)/.exec(userAgent);
  const inside = match?.[1]
    ?.split(";")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return inside !== undefined && inside.length > 0 ? inside.join(", ") : "Crosswalk CLI";
}
