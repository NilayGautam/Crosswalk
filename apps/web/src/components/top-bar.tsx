"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import type { Account } from "@/lib/api";
import { useSession } from "@/lib/session";

interface TopBarProps {
  account: Account | null;
  /** What sits after the wordmark: the page or project the visitor is in. */
  place?: ReactNode;
  /** Status shown before the account links, such as the canvas's live state. */
  status?: ReactNode;
}

const NAV_LINK =
  "text-sm font-medium underline-offset-4 hover:underline aria-[current=page]:underline";

export function TopBar({ account, place, status }: TopBarProps) {
  const { signOut } = useSession();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logOut() {
    setLeaving(true);
    try {
      await signOut();
      router.replace("/login/");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <header className="border-b-2 border-ink bg-leaf">
      <div className="flex min-h-14 flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Crosswalk
        </Link>
        {place !== undefined && (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-base text-mute">{place}</div>
        )}
        {place === undefined && <div className="flex-1" />}
        {status}
        {account !== null && (
          <nav aria-label="Account" className="flex items-center gap-x-5">
            <Link href="/" className={NAV_LINK}>
              Projects
            </Link>
            <Link href="/devices/" className={NAV_LINK}>
              Linked devices
            </Link>
            <span className="hidden max-w-56 truncate text-sm text-mute lg:inline">
              {account.email}
            </span>
            <button
              type="button"
              onClick={logOut}
              disabled={leaving}
              className={`${NAV_LINK} disabled:opacity-55`}
            >
              Log out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}

/** The page frame for everything that is not the canvas. */
export function Page({
  account,
  title,
  lede,
  children,
}: {
  account: Account | null;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <TopBar account={account} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-20 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {lede !== undefined && <p className="mt-2 max-w-[62ch] text-mute">{lede}</p>}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
