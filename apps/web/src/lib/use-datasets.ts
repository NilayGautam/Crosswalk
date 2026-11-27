"use client";

import type { Dataset } from "@crosswalk/contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";

export type DatasetsState =
  | { status: "loading" }
  | { status: "ready"; datasets: Dataset[] }
  | { status: "missing" }
  | { status: "error"; message: string };

export interface LiveDatasets {
  state: DatasetsState;
  /** True while the canvas is connected and will show new datasets on its own. */
  live: boolean;
  reload: () => Promise<void>;
}

/**
 * The datasets of a project, kept current. The server tells an open canvas
 * when the command line tool has sent something, and the list is fetched again.
 */
export function useLiveDatasets(projectId: string | null): LiveDatasets {
  const [state, setState] = useState<DatasetsState>({ status: "loading" });
  const [live, setLive] = useState(false);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (projectId === null) {
      return;
    }
    const request = latest.current + 1;
    latest.current = request;
    try {
      const datasets = await api.datasets(projectId);
      // A slower, older answer must not replace a newer one.
      if (latest.current === request) {
        setState({ status: "ready", datasets });
      }
    } catch (error) {
      if (latest.current !== request) {
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        setState({ status: "missing" });
      } else if (!(error instanceof ApiError && error.status === 401)) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId === null) {
      return;
    }
    void reload();
    const source = new EventSource(`/api/projects/${projectId}/events`);
    const onReady = () => {
      setLive(true);
      // Anything sent while the connection was down is picked up here.
      void reload();
    };
    const onDatasets = () => void reload();
    const onError = () => setLive(false);
    source.addEventListener("ready", onReady);
    source.addEventListener("datasets", onDatasets);
    source.addEventListener("error", onError);
    return () => {
      source.close();
      setLive(false);
    };
  }, [projectId, reload]);

  return { state, live, reload };
}
