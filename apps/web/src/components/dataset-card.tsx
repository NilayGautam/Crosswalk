"use client";

import {
  CARD_EMPTY_BODY_HEIGHT,
  CARD_FOOTER_HEIGHT,
  CARD_HEADER_HEIGHT,
  CARD_MAX_VISIBLE_ROWS,
  CARD_ROW_HEIGHT,
  CARD_WIDTH,
  type ColumnProfile,
  type Dataset,
} from "@crosswalk/contract";
import type { Node, NodeProps } from "@xyflow/react";
import { type KeyboardEvent, useRef, useState } from "react";
import {
  formatCount,
  formatLabel,
  formatShare,
  plural,
  profileLines,
  typeLabel,
} from "@/lib/format";
import { CloseIcon, Leader } from "./ui";

export type DatasetNodeData = {
  dataset: Dataset;
  /** True for a card that arrived while the canvas was open. */
  arrived: boolean;
  onRemove: (datasetId: string) => Promise<void>;
};
export type DatasetNode = Node<DatasetNodeData, "dataset">;

interface ActiveColumn {
  index: number;
  /** Distance from the top of the card to the top of the column's row. */
  top: number;
}

const SMALL_BUTTON =
  "nodrag inline-flex h-6 items-center border px-2.5 text-xs font-semibold transition-colors duration-150";

export function DatasetCard({ data, dragging }: NodeProps<DatasetNode>) {
  const { dataset, arrived, onRemove } = data;
  const [hovered, setHovered] = useState<ActiveColumn | null>(null);
  const [focused, setFocused] = useState<ActiveColumn | null>(null);
  const [cursor, setCursor] = useState(0);
  const [removing, setRemoving] = useState<"ask" | "busy" | null>(null);
  const [removeError, setRemoveError] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  const active = dragging ? null : (focused ?? hovered);
  const column = active === null ? undefined : dataset.columns[active.index];
  const listHeight =
    dataset.columns.length === 0
      ? CARD_EMPTY_BODY_HEIGHT
      : Math.min(dataset.columns.length, CARD_MAX_VISIBLE_ROWS) * CARD_ROW_HEIGHT;

  function locate(index: number): ActiveColumn {
    const scrolled = list.current?.scrollTop ?? 0;
    const top = CARD_HEADER_HEIGHT + index * CARD_ROW_HEIGHT - scrolled;
    // A row scrolled out of sight still gets its entry next to the list.
    const clamped = Math.max(
      CARD_HEADER_HEIGHT,
      Math.min(top, CARD_HEADER_HEIGHT + listHeight - CARD_ROW_HEIGHT),
    );
    return { index, top: clamped };
  }

  function focusRow(index: number) {
    const row = list.current?.querySelector<HTMLButtonElement>(`[data-row="${index}"]`);
    row?.focus();
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = dataset.columns.length - 1;
    const target =
      event.key === "ArrowDown"
        ? Math.min(index + 1, last)
        : event.key === "ArrowUp"
          ? Math.max(index - 1, 0)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) {
      return;
    }
    // The arrow keys move through the columns here, not the card on the canvas.
    event.preventDefault();
    event.stopPropagation();
    setCursor(target);
    focusRow(target);
  }

  async function remove() {
    setRemoving("busy");
    setRemoveError(false);
    try {
      await onRemove(dataset.id);
    } catch {
      setRemoving("ask");
      setRemoveError(true);
    }
  }

  return (
    <article
      aria-label={`Dataset ${dataset.name}`}
      className={`relative border border-ink bg-leaf transition-shadow duration-200 ${
        dragging ? "shadow-lifted" : "shadow-leaf"
      } ${arrived ? "card-arrive" : ""}`}
      style={{ width: CARD_WIDTH }}
      onMouseLeave={() => setHovered(null)}
    >
      <header
        className="double-rule flex items-start gap-2 px-3.5 pt-2.5"
        style={{ height: CARD_HEADER_HEIGHT }}
      >
        {removing === null ? (
          <>
            <div className="min-w-0 flex-1">
              <h2
                className="truncate font-mono text-base leading-6 font-bold"
                title={
                  dataset.sheet === null ? dataset.path : `${dataset.path}, sheet ${dataset.sheet}`
                }
              >
                {dataset.name}
              </h2>
              <p className="truncate text-xs leading-5 text-mute">
                {plural(dataset.rowCount, "row")}, {plural(dataset.columns.length, "column")}
                <span className="mx-1.5" aria-hidden="true">
                  /
                </span>
                {formatLabel(dataset.format)}
              </p>
            </div>
            <button
              type="button"
              className="nodrag -mr-1.5 grid size-7 shrink-0 place-items-center text-mute transition-colors duration-150 hover:bg-wash hover:text-ink"
              aria-label={`Remove ${dataset.name} from the canvas`}
              onClick={() => setRemoving("ask")}
            >
              <CloseIcon />
            </button>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="h-5 truncate text-xs leading-5 font-semibold">
              {removeError ? (
                "That did not work. Try again?"
              ) : (
                <>
                  Remove <span className="font-mono leading-none">{dataset.name}</span>?
                </>
              )}
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                className={`${SMALL_BUTTON} border-rubric bg-rubric text-leaf hover:bg-rubric-deep disabled:opacity-55`}
                disabled={removing === "busy"}
                onClick={() => void remove()}
              >
                {removing === "busy" ? "Removing" : "Remove"}
              </button>
              <button
                type="button"
                className={`${SMALL_BUTTON} border-ink bg-leaf hover:bg-wash disabled:opacity-55`}
                disabled={removing === "busy"}
                onClick={() => {
                  setRemoving(null);
                  setRemoveError(false);
                }}
              >
                Keep
              </button>
            </div>
          </div>
        )}
      </header>

      {dataset.columns.length === 0 ? (
        <p
          className="flex items-center px-3.5 text-sm text-mute"
          style={{ height: CARD_EMPTY_BODY_HEIGHT }}
        >
          This file has no columns.
        </p>
      ) : (
        <ul
          ref={list}
          aria-label={`Columns of ${dataset.name}`}
          className="column-list nowheel overflow-y-auto"
          style={{ height: listHeight }}
          onScroll={() => {
            setHovered(null);
            setFocused((current) => (current === null ? null : locate(current.index)));
          }}
        >
          {dataset.columns.map((item, index) => {
            const isActive = active?.index === index;
            return (
              // Column names can repeat within a file, so the position is the identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: the list never reorders
              <li key={index}>
                <button
                  type="button"
                  data-row={index}
                  tabIndex={index === cursor ? 0 : -1}
                  aria-describedby={isActive ? `profile-${dataset.id}` : undefined}
                  className={`flex w-full cursor-[inherit] items-baseline px-3.5 text-left outline-offset-[-2px] ${
                    isActive ? "bg-rubric-wash text-rubric-deep" : ""
                  }`}
                  style={{ height: CARD_ROW_HEIGHT }}
                  onMouseEnter={() => setHovered(locate(index))}
                  onFocus={() => {
                    setCursor(index);
                    setFocused(locate(index));
                  }}
                  onBlur={() => setFocused(null)}
                  onKeyDown={(event) => onRowKeyDown(event, index)}
                >
                  <span className="min-w-0 truncate font-mono text-sm leading-[30px]">
                    {item.name === "" ? "(no name)" : item.name}
                  </span>
                  <span className="leader" aria-hidden="true" />
                  <span
                    className={`shrink-0 text-xs italic ${isActive ? "text-rubric-deep" : "text-mute"}`}
                  >
                    {typeLabel(item.type)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div style={{ height: CARD_FOOTER_HEIGHT }} aria-hidden="true" />

      {column !== undefined && active !== null && (
        <ColumnEntry
          id={`profile-${dataset.id}`}
          column={column}
          position={active.index + 1}
          total={dataset.columns.length}
          top={active.top}
          sampled={dataset.profiledRows < dataset.rowCount ? dataset.profiledRows : null}
        />
      )}
    </article>
  );
}

/** A column's codebook entry: what it is called, what it holds, how complete it is. */
function ColumnEntry({
  id,
  column,
  position,
  total,
  top,
  sampled,
}: {
  id: string;
  column: ColumnProfile;
  /** Where the column sits in the file, counting from one. */
  position: number;
  total: number;
  top: number;
  sampled: number | null;
}) {
  const [shape] = profileLines(column);
  return (
    <aside
      id={id}
      role="tooltip"
      className="pointer-events-none absolute left-full z-10 ml-3 w-64 border border-ink border-t-rubric bg-leaf px-3.5 pt-2.5 pb-3 text-sm shadow-lifted [border-top-width:3px]"
      style={{ top: Math.max(0, top - 4) }}
    >
      <p className="font-mono text-base leading-6 font-bold break-all">
        {column.name === "" ? "(no name)" : column.name}
      </p>
      <p className="mt-1 text-ink">{shape}</p>
      {column.type !== "empty" && (
        <dl className="mt-2.5 flex flex-col gap-1 border-t border-hair pt-2.5">
          <Leader label="Position">
            {formatCount(position)} of {formatCount(total)}
          </Leader>
          <Leader label="Empty cells">{formatShare(column.nullRate)}</Leader>
          <Leader label="Different values">
            {column.uniqueRate >= 1
              ? `${formatCount(column.distinctCount)}, all different`
              : formatCount(column.distinctCount)}
          </Leader>
        </dl>
      )}
      {sampled !== null && (
        <p className="mt-2.5 text-xs text-mute">Based on the first {formatCount(sampled)} rows.</p>
      )}
    </aside>
  );
}
