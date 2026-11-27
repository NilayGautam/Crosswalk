"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { safeNextPath } from "@/lib/format";
import { useSession } from "@/lib/session";
import { Button, Field, Problem } from "./ui";

const MIN_PASSWORD = 8;

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/** Log in and sign up share one form. Sign up adds a name and stricter checks. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { state, refresh } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [google, setGoogle] = useState(false);
  const signingUp = mode === "signup";

  useEffect(() => {
    let current = true;
    api
      .config()
      .then((config) => {
        if (current) {
          setGoogle(config.googleSignIn);
        }
      })
      .catch(() => {
        // Without the config the Google button simply stays hidden.
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    if (state.status === "signed-in") {
      router.replace(next);
    }
  }, [state.status, next, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    setPasswordError(null);
    if (signingUp && password.length < MIN_PASSWORD) {
      setPasswordError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    try {
      if (signingUp) {
        await api.signUp(name.trim(), email.trim(), password);
      } else {
        await api.signIn(email.trim(), password);
      }
      await refresh();
    } catch (error) {
      setProblem(explain(error, signingUp));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    setProblem(null);
    setBusy(true);
    try {
      window.location.assign(await api.googleSignInUrl(next));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Google sign-in did not start.");
      setBusy(false);
    }
  }

  const other = signingUp ? "/login/" : "/signup/";
  const otherHref = next === "/" ? other : `${other}?next=${encodeURIComponent(next)}`;

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <main className="w-full max-w-sm">
        <p className="text-lg font-bold tracking-tight">Crosswalk</p>
        <div className="mt-4 border border-ink bg-leaf">
          <h1 className="double-rule px-6 pt-5 pb-4 text-xl font-bold tracking-tight">
            {signingUp ? "Create your account" : "Log in"}
          </h1>
          <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-6" noValidate={false}>
            {problem !== null && <Problem>{problem}</Problem>}
            {signingUp && (
              <Field
                id="name"
                label="Name"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
            <Field
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              required
              hint={signingUp ? `At least ${MIN_PASSWORD} characters.` : undefined}
              error={passwordError}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              type="submit"
              kind="primary"
              busy={busy}
              busyLabel={signingUp ? "Creating account" : "Logging in"}
              className="mt-1 min-h-11"
            >
              {signingUp ? "Create account" : "Log in"}
            </Button>
            {google && (
              <Button onClick={continueWithGoogle} disabled={busy} className="min-h-11">
                <GoogleMark />
                Continue with Google
              </Button>
            )}
          </form>
        </div>
        <p className="mt-5 text-sm text-mute">
          {signingUp ? "Already have an account? " : "New to Crosswalk? "}
          <Link href={otherHref} className="link font-medium">
            {signingUp ? "Log in" : "Create an account"}
          </Link>
        </p>
      </main>
    </div>
  );
}

function explain(error: unknown, signingUp: boolean): string {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Try again.";
  }
  if (error.status === 0) {
    return error.message;
  }
  if (!signingUp && error.status === 401) {
    return "That email and password do not match an account. Check both and try again.";
  }
  if (signingUp && /exist|already/i.test(error.message)) {
    return "There is already an account for that email. Log in instead.";
  }
  if (/email/i.test(error.message)) {
    return "That does not look like an email address.";
  }
  return error.message;
}
