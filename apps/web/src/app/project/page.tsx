"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@/components/canvas";
import { LinkSteps } from "@/components/link-steps";
import { Page, TopBar } from "@/components/top-bar";
import { Button, Problem } from "@/components/ui";
import { api } from "@/lib/api";
import { useAccount } from "@/lib/session";
import { useLiveDatasets } from "@/lib/use-datasets";

function LiveStatus({ live }: { live: boolean }) {
  return (
    <p className="flex items-center gap-2 text-sm" role="status">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${live ? "bg-live" : "border border-mute bg-transparent"}`}
      />
      <span className={live ? "text-ink" : "text-mute"}>{live ? "Live" : "Reconnecting"}</span>
    </p>
  );
}

function ProjectCanvas() {
  const account = useAccount();
  const projectId = useSearchParams().get("id");
  const { state, live, reload } = useLiveDatasets(account === null ? null : projectId);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (account === null || projectId === null) {
      return;
    }
    let current = true;
    api
      .project(projectId)
      .then((project) => {
        if (current) {
          setName(project.name);
        }
      })
      .catch(() => {
        // A project that is gone is reported by the dataset request below.
      });
    return () => {
      current = false;
    };
  }, [account, projectId]);

  useEffect(() => {
    if (name !== null) {
      document.title = `${name} - Crosswalk`;
    }
  }, [name]);

  if (projectId === null || state.status === "missing") {
    return (
      <Page
        account={account}
        title="That project does not exist"
        lede="It may have been deleted, or the address may be mistyped."
      >
        <Link href="/" className="link font-medium">
          Go to your projects
        </Link>
      </Page>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        account={account}
        place={
          name === null ? null : (
            <>
              <span aria-hidden="true">/</span>
              <h1 className="min-w-0 truncate text-base font-bold text-ink">{name}</h1>
            </>
          )
        }
        status={<LiveStatus live={live} />}
      />
      <main className="relative min-h-0 flex-1">
        {state.status === "ready" && (
          <Canvas projectId={projectId} datasets={state.datasets} onRemoved={reload} />
        )}
        {state.status === "ready" && state.datasets.length === 0 && (
          <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-paper p-4 sm:p-8">
            <LinkSteps live={live} />
          </div>
        )}
        {state.status === "loading" && (
          <p className="p-8 text-mute" role="status">
            Loading the canvas.
          </p>
        )}
        {state.status === "error" && (
          <div className="flex flex-col items-start gap-3 p-8">
            <Problem>{state.message}</Problem>
            <Button onClick={() => void reload()}>Try again</Button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectCanvas />
    </Suspense>
  );
}
