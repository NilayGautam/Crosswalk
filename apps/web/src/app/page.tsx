"use client";

import type { Project } from "@crosswalk/contract";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Page } from "@/components/top-bar";
import { Button, Problem, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { plural, timeAgo } from "@/lib/format";
import { useAccount } from "@/lib/session";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

export default function ProjectsPage() {
  const account = useAccount();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProjects(await api.projects());
      setProblem(null);
    } catch (error) {
      setProblem(message(error));
    }
  }, []);

  useEffect(() => {
    if (account !== null) {
      void load();
    }
  }, [account, load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() === "") {
      setCreateError("Give the project a name.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await api.createProject(name);
      setName("");
      await load();
    } catch (error) {
      setCreateError(message(error));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Page
      account={account}
      title="Projects"
      lede="A project is one canvas. It holds the datasets for one piece of work, and remembers where you put them."
    >
      <form onSubmit={create} className="flex flex-col gap-2">
        <label htmlFor="new-project" className="text-sm font-semibold">
          New project
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="new-project"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="For example, Supplier litigation panel"
            aria-invalid={createError !== null || undefined}
            aria-describedby={createError !== null ? "new-project-error" : undefined}
            className={`min-h-11 flex-1 border bg-leaf px-3 placeholder:text-mute ${
              createError !== null ? "border-rubric" : "border-ink"
            }`}
          />
          <Button
            type="submit"
            kind="primary"
            busy={creating}
            busyLabel="Creating"
            className="min-h-11"
          >
            Create project
          </Button>
        </div>
        {createError !== null && (
          <p id="new-project-error" className="text-sm font-medium text-rubric-deep">
            {createError}
          </p>
        )}
      </form>

      <section aria-labelledby="your-projects" className="mt-12">
        <h2 id="your-projects" className="double-rule pb-2 text-lg font-bold">
          Your projects
        </h2>
        {problem !== null && (
          <div className="mt-4 flex flex-col items-start gap-3">
            <Problem>{problem}</Problem>
            <Button onClick={() => void load()}>Try again</Button>
          </div>
        )}
        {problem === null && projects === null && (
          <div className="flex flex-col" aria-busy="true">
            <span className="sr-only">Loading your projects</span>
            {["w-1/2", "w-1/3", "w-2/5"].map((width) => (
              <div key={width} className="border-b border-hair py-4">
                <Skeleton className={`h-5 ${width}`} />
                <Skeleton className="mt-2 h-3.5 w-24" />
              </div>
            ))}
          </div>
        )}
        {projects !== null && projects.length === 0 && (
          <p className="mt-4 max-w-[62ch] text-mute">
            You have no projects yet. Name one above to get its canvas, then link the command line
            tool to send it your datasets.
          </p>
        )}
        {projects !== null && projects.length > 0 && (
          <ul>
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} onChanged={load} />
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

function ProjectRow({ project, onChanged }: { project: Project; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "rename") {
      input.current?.select();
    }
  }, [mode]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
      setMode("view");
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setMode("view");
    setName(project.name);
    setError(null);
  }

  return (
    <li className="border-b border-hair py-4">
      {mode === "rename" ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => api.renameProject(project.id, name));
          }}
        >
          <label htmlFor={`rename-${project.id}`} className="sr-only">
            New name for {project.name}
          </label>
          <input
            id={`rename-${project.id}`}
            ref={input}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                cancel();
              }
            }}
            className="min-h-10 flex-1 border border-ink bg-leaf px-3"
          />
          <Button type="submit" kind="primary" busy={busy} busyLabel="Saving">
            Save name
          </Button>
          <Button onClick={cancel} disabled={busy}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-y-1 sm:flex-row sm:items-baseline">
          <Link
            href={`/project/?id=${project.id}`}
            className="min-w-0 break-words text-lg font-bold underline-offset-4 hover:underline"
          >
            {project.name}
          </Link>
          <span className="leader hidden sm:block" aria-hidden="true" />
          <span className="shrink-0 text-sm text-mute">
            {plural(project.datasetCount, "dataset")}, changed {timeAgo(project.updatedAt)}
          </span>
        </div>
      )}

      {mode === "view" && (
        <div className="mt-1.5 flex gap-4">
          <button
            type="button"
            onClick={() => setMode("rename")}
            className="link text-sm"
            aria-label={`Rename ${project.name}`}
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => setMode("delete")}
            className="link text-sm"
            aria-label={`Delete ${project.name}`}
          >
            Delete
          </button>
        </div>
      )}

      {mode === "delete" && (
        <div className="mt-3 border border-rubric bg-rubric-wash p-3">
          <p className="text-sm">
            Delete <strong>{project.name}</strong> and its canvas? This cannot be undone. Your
            dataset files are not touched.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              kind="danger"
              busy={busy}
              busyLabel="Deleting"
              onClick={() => void run(() => api.deleteProject(project.id))}
            >
              Delete project
            </Button>
            <Button onClick={cancel} disabled={busy}>
              Keep it
            </Button>
          </div>
        </div>
      )}

      {error !== null && <p className="mt-2 text-sm font-medium text-rubric-deep">{error}</p>}
    </li>
  );
}
