"use client";

import { useEffect, useRef, useState } from "react";

function Command({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Without clipboard access the command can still be selected by hand.
    }
  }

  return (
    <div className="mt-2 flex items-stretch border border-ink bg-paper">
      <code className="flex-1 overflow-x-auto px-3 py-2 font-mono text-base whitespace-nowrap">
        {text}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy the command ${label}`}
        className="w-18 shrink-0 border-l border-ink bg-leaf px-3 text-sm font-semibold transition-colors duration-150 hover:bg-wash"
      >
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

const STEPS = [
  {
    title: "Install the command line tool",
    body: "Open a terminal in the Crosswalk folder and run this once.",
    command: "pnpm install-cli",
  },
  {
    title: "Link this computer to your account",
    body: "It shows a short code and opens a page here to confirm it.",
    command: "crosswalk login",
  },
  {
    title: "Send your datasets",
    body: "Open a terminal in the folder that holds your data files, run this, and choose this project.",
    command: "crosswalk",
  },
];

/** What an empty canvas shows: how to get the first datasets onto it. */
export function LinkSteps({ live }: { live: boolean }) {
  return (
    <section
      aria-labelledby="link-steps-title"
      className="w-full max-w-lg border border-ink bg-leaf"
    >
      <h2 id="link-steps-title" className="double-rule px-6 pt-5 pb-4 text-xl font-bold">
        Put your datasets on this canvas
      </h2>
      <ol className="flex flex-col gap-5 px-6 py-5">
        {STEPS.map((step, index) => (
          <li key={step.command} className="grid grid-cols-[1.75rem_1fr] items-baseline">
            <span className="font-bold" aria-hidden="true">
              {index + 1}.
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm text-mute">{step.body}</p>
              <Command text={step.command} label={step.command} />
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-hair px-6 py-4 text-sm text-mute">
        <p>
          Only file names, column names, and a profile of each column are sent. No cell values leave
          your computer, and the tool shows what it will send and asks first.
        </p>
        <p className="mt-2 font-medium text-ink" role="status">
          {live
            ? "This page is waiting. Cards appear here on their own."
            : "Connecting to the server."}
        </p>
      </div>
    </section>
  );
}
