"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { type Account, ApiError, api } from "./api";

type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; account: Account }
  | { status: "error"; message: string };

interface SessionContextValue {
  state: SessionState;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      setState({ status: "signed-in", account: await api.me() });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setState({ status: "signed-out" });
      } else {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.signOut();
    setState({ status: "signed-out" });
  }, []);

  const value = useMemo(() => ({ state, refresh, signOut }), [state, refresh, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error("useSession must be used inside SessionProvider.");
  }
  return value;
}

/**
 * The signed-in account, or null while it is unknown. A signed-out visitor is
 * sent to the login page and comes back to where they were.
 */
export function useAccount(): Account | null {
  const { state } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === "signed-out") {
      const here = `${pathname}${window.location.search}`;
      const next = here === "/" ? "" : `?next=${encodeURIComponent(here)}`;
      router.replace(`/login/${next}`);
    }
  }, [state.status, pathname, router]);

  return state.status === "signed-in" ? state.account : null;
}
