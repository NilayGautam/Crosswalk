"use client";

import type { Dataset } from "@crosswalk/contract";
import {
  Controls,
  type NodeChangeset,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { plural } from "@/lib/format";
import { DatasetCard, type DatasetNode } from "./dataset-card";
import { Button } from "./ui";

const NODE_TYPES: NodeTypes = { dataset: DatasetCard };
const SAVE_DELAY_MS = 350;
const FIRST_CARD_MARGIN = 16;
// A fit never shrinks cards past the point where their column names can be read.
const FIT_OPTIONS = { padding: 0.12, minZoom: 0.9, maxZoom: 1, duration: 300 };

interface CanvasProps {
  projectId: string;
  datasets: Dataset[];
  onRemoved: () => Promise<void>;
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({ projectId, datasets, onRemoved }: CanvasProps) {
  const [nodes, setNodes, applyChanges] = useNodesState<DatasetNode>([]);
  const [arrivals, setArrivals] = useState<string[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const flow = useReactFlow<DatasetNode>();
  const initialized = useNodesInitialized();
  const seen = useRef<Set<string> | null>(null);
  const fitted = useRef(false);
  const pending = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; send: () => void }>(),
  );

  const remove = useCallback(
    async (datasetId: string) => {
      await api.removeDataset(projectId, datasetId);
      await onRemoved();
    },
    [projectId, onRemoved],
  );

  // The server's list decides which cards exist. Where a card sits is decided
  // here, so a refresh never pulls a card out from under the pointer.
  useEffect(() => {
    const known = seen.current;
    const fresh = known === null ? [] : datasets.filter((item) => !known.has(item.id));
    seen.current = new Set(datasets.map((item) => item.id));
    if (fresh.length > 0) {
      setArrivals((current) => [...current, ...fresh.map((item) => item.id)]);
    }
    setNodes((current) => {
      const byId = new Map(current.map((node) => [node.id, node]));
      return datasets.map((item): DatasetNode => {
        const existing = byId.get(item.id);
        return {
          ...existing,
          id: item.id,
          type: "dataset",
          position: existing?.position ?? { x: item.x, y: item.y },
          ariaLabel: `Dataset ${item.name}. Press Enter to select it, then use the arrow keys to move it.`,
          data: {
            dataset: item,
            arrived: existing?.data.arrived ?? fresh.includes(item),
            onRemove: remove,
          },
        };
      });
    });
  }, [datasets, remove, setNodes]);

  // The first time cards are on screen, bring them all into view. On a small
  // window they cannot all fit at a readable size, so start at the first card
  // instead of at the middle of the layout, which may be empty space.
  useEffect(() => {
    if (!initialized || fitted.current || nodes.length === 0) {
      return;
    }
    fitted.current = true;
    void flow.fitView({ ...FIT_OPTIONS, duration: 0 }).then(() => {
      const pane = document.querySelector<HTMLElement>(".react-flow");
      if (pane === null) {
        return;
      }
      const zoom = 1;
      const bounds = flow.getNodesBounds(flow.getNodes());
      const tooWide = bounds.width * zoom > pane.clientWidth;
      const tooTall = bounds.height * zoom > pane.clientHeight;
      if (tooWide || tooTall) {
        const view = flow.getViewport();
        void flow.setViewport({
          x: tooWide ? FIRST_CARD_MARGIN - bounds.x * zoom : view.x,
          y: FIRST_CARD_MARGIN - bounds.y * zoom,
          zoom,
        });
      }
    });
  }, [initialized, nodes.length, flow]);

  // A move still waiting to be saved is sent at once when the canvas or the
  // page goes away, so leaving right after a drag does not lose it.
  useEffect(() => {
    const moves = pending.current;
    const flush = () => {
      for (const move of [...moves.values()]) {
        clearTimeout(move.timer);
        move.send();
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const save = useCallback(
    (id: string, x: number, y: number) => {
      const moves = pending.current;
      const waiting = moves.get(id);
      if (waiting !== undefined) {
        clearTimeout(waiting.timer);
      }
      const send = () => {
        moves.delete(id);
        api.moveDataset(projectId, id, x, y).then(
          () => setSaveFailed(false),
          () => setSaveFailed(true),
        );
      };
      moves.set(id, { timer: setTimeout(send, SAVE_DELAY_MS), send });
    },
    [projectId],
  );

  const onNodesChange = useCallback(
    (changes: NodeChangeset<DatasetNode>) => {
      applyChanges(changes);
      for (const change of changes.getByType("position")) {
        // A drag reports many positions and only the last one is worth keeping.
        // A move with the arrow keys reports each step as final.
        if (change.dragging !== true && change.position) {
          save(change.id, change.position.x, change.position.y);
        }
      }
    },
    [applyChanges, save],
  );

  const arrivedNodes = useMemo(
    () => nodes.filter((node) => arrivals.includes(node.id)),
    [nodes, arrivals],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={NODE_TYPES}
        nodesConnectable={false}
        deleteKeyCode={null}
        minZoom={0.2}
        maxZoom={1.5}
        defaultViewport={{ x: 48, y: 48, zoom: 1 }}
        nodeDragThreshold={2}
        aria-label="Canvas of datasets"
      >
        <Controls showInteractive={false} position="bottom-left" fitViewOptions={FIT_OPTIONS} />
      </ReactFlow>

      {nodes.length > 0 && (
        <p className="pointer-events-none absolute right-4 bottom-4 left-18 max-w-md text-xs text-mute">
          These cards hold file names, column names, and column profiles. No cell values left your
          computer.
        </p>
      )}

      <div
        className="pointer-events-none absolute top-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        aria-live="polite"
      >
        {arrivedNodes.length > 0 && (
          <div className="pointer-events-auto flex items-center gap-3 border border-ink bg-leaf py-1.5 pr-1.5 pl-3.5 text-sm">
            <span>{plural(arrivedNodes.length, "new dataset")} from the terminal</span>
            <Button
              className="min-h-8 px-3"
              onClick={() => {
                void flow.fitView({ ...FIT_OPTIONS, nodes: arrivedNodes });
                setArrivals([]);
              }}
            >
              Show
            </Button>
            <Button kind="quiet" onClick={() => setArrivals([])}>
              Dismiss
            </Button>
          </div>
        )}
        {saveFailed && (
          <p
            role="alert"
            className="border border-rubric bg-rubric-wash px-3.5 py-2 text-sm font-medium text-rubric-deep"
          >
            The last move was not saved. Check that the server is running, then move the card again.
          </p>
        )}
      </div>
    </div>
  );
}
