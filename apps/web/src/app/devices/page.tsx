"use client";

import { useCallback, useEffect, useState } from "react";
import { Page } from "@/components/top-bar";
import { Button, Problem, Skeleton } from "@/components/ui";
import { api, type Device } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useAccount } from "@/lib/session";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

export default function DevicesPage() {
  const account = useAccount();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDevices(await api.devices());
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

  return (
    <Page
      account={account}
      title="Linked devices"
      lede={
        <>
          Computers where you ran <code className="font-mono text-ink">crosswalk login</code>. A
          linked computer can add datasets to your projects until you unlink it.
        </>
      }
    >
      <h2 className="double-rule pb-2 text-lg font-bold">Your computers</h2>
      {problem !== null && (
        <div className="mt-4 flex flex-col items-start gap-3">
          <Problem>{problem}</Problem>
          <Button onClick={() => void load()}>Try again</Button>
        </div>
      )}
      {problem === null && devices === null && (
        <div aria-busy="true">
          <span className="sr-only">Loading linked devices</span>
          {["w-2/5", "w-1/3"].map((width) => (
            <div key={width} className="border-b border-hair py-4">
              <Skeleton className={`h-5 ${width}`} />
            </div>
          ))}
        </div>
      )}
      {devices !== null && devices.length === 0 && (
        <div className="max-w-[62ch] pt-4 text-mute">
          <p>No computer is linked yet. To link this one, open a terminal and run:</p>
          <p className="mt-3 border border-ink bg-leaf px-4 py-3 font-mono text-ink">
            crosswalk login
          </p>
        </div>
      )}
      {devices !== null && devices.length > 0 && (
        <ul>
          {devices.map((device) => (
            <DeviceRow key={device.id} device={device} onChanged={load} />
          ))}
        </ul>
      )}
    </Page>
  );
}

function DeviceRow({ device, onChanged }: { device: Device; onChanged: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlink() {
    setBusy(true);
    setError(null);
    try {
      await api.unlinkDevice(device.id);
      await onChanged();
    } catch (caught) {
      setError(message(caught));
      setBusy(false);
    }
  }

  return (
    <li className="border-b border-hair py-4">
      <div className="flex flex-col gap-y-1 sm:flex-row sm:items-baseline">
        <span className="min-w-0 break-words font-mono text-lg font-bold">{device.label}</span>
        <span className="leader hidden sm:block" aria-hidden="true" />
        <span className="shrink-0 text-sm text-mute">
          linked {timeAgo(device.linkedAt)}, last used {timeAgo(device.lastUsedAt)}
        </span>
      </div>
      {!confirming && (
        <button
          type="button"
          className="link mt-1.5 text-sm"
          onClick={() => setConfirming(true)}
          aria-label={`Unlink ${device.label}`}
        >
          Unlink
        </button>
      )}
      {confirming && (
        <div className="mt-3 border border-rubric bg-rubric-wash p-3">
          <p className="text-sm">
            Unlink <strong>{device.label}</strong>? It will need{" "}
            <code className="font-mono">crosswalk login</code> again before it can send datasets.
          </p>
          <div className="mt-3 flex gap-2">
            <Button kind="danger" busy={busy} busyLabel="Unlinking" onClick={() => void unlink()}>
              Unlink
            </Button>
            <Button onClick={() => setConfirming(false)} disabled={busy}>
              Keep it linked
            </Button>
          </div>
        </div>
      )}
      {error !== null && <p className="mt-2 text-sm font-medium text-rubric-deep">{error}</p>}
    </li>
  );
}
