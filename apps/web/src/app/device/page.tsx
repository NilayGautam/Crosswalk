"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { Page } from "@/components/top-bar";
import { Button, Field, Problem } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { formatUserCode } from "@/lib/format";
import { useAccount } from "@/lib/session";

type Step =
  | { name: "enter" }
  | { name: "checking"; code: string }
  | { name: "confirm"; code: string }
  | { name: "linked" }
  | { name: "refused" }
  | { name: "invalid"; reason: string };

function invalidReason(error: unknown): string {
  if (error instanceof ApiError && error.status === 0) {
    return error.message;
  }
  return "That code is not waiting to be confirmed. It may be mistyped, already used, or more than ten minutes old. Run crosswalk login again to get a new one.";
}

function DeviceFlow() {
  const account = useAccount();
  const params = useSearchParams();
  const fromLink = params.get("user_code");
  const [step, setStep] = useState<Step>(
    fromLink ? { name: "checking", code: fromLink } : { name: "enter" },
  );
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"link" | "refuse" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const checkingCode = step.name === "checking" ? step.code : null;
  useEffect(() => {
    if (account === null || checkingCode === null) {
      return;
    }
    let current = true;
    api
      .deviceRequest(checkingCode)
      .then((request) => {
        if (!current) {
          return;
        }
        setStep(
          request.status === "pending"
            ? { name: "confirm", code: checkingCode }
            : { name: "invalid", reason: invalidReason(null) },
        );
      })
      .catch((error) => {
        if (current) {
          setStep({ name: "invalid", reason: invalidReason(error) });
        }
      });
    return () => {
      current = false;
    };
  }, [account, checkingCode]);

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = typed.replace(/[^a-zA-Z0-9]/g, "");
    if (code !== "") {
      setStep({ name: "checking", code });
    }
  }

  async function decide(code: string, link: boolean) {
    setBusy(link ? "link" : "refuse");
    setProblem(null);
    try {
      if (link) {
        await api.approveDevice(code);
        setStep({ name: "linked" });
      } else {
        await api.denyDevice(code);
        setStep({ name: "refused" });
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page account={account} title="Link a computer">
      <div className="max-w-xl">
        {step.name === "enter" && (
          <form onSubmit={submitCode} className="flex flex-col gap-4">
            <p className="text-mute">
              Run <code className="font-mono text-ink">crosswalk login</code> in a terminal. It
              shows a code. Type that code here.
            </p>
            <Field
              id="user-code"
              label="Code from the terminal"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABCD-1234"
              className="font-mono text-lg tracking-widest uppercase"
            />
            <div>
              <Button type="submit" kind="primary" className="min-h-11">
                Continue
              </Button>
            </div>
          </form>
        )}

        {step.name === "checking" && (
          <p className="text-mute" role="status">
            Checking the code.
          </p>
        )}

        {step.name === "confirm" && (
          <div className="flex flex-col gap-5">
            <p>
              A terminal is asking to be linked to your account. It should be showing this code:
            </p>
            <p className="border border-ink bg-leaf px-5 py-4 text-center font-mono text-2xl font-bold tracking-[0.2em]">
              {formatUserCode(step.code)}
            </p>
            <p className="text-mute">
              Link it only if you just ran{" "}
              <code className="font-mono text-ink">crosswalk login</code> yourself and the code
              matches. A linked computer can add datasets to your projects
              {account !== null && (
                <>
                  {" "}
                  as <strong className="font-semibold text-ink">{account.email}</strong>
                </>
              )}
              .
            </p>
            {problem !== null && <Problem>{problem}</Problem>}
            <div className="flex flex-wrap gap-2">
              <Button
                kind="primary"
                className="min-h-11"
                busy={busy === "link"}
                busyLabel="Linking"
                disabled={busy !== null}
                onClick={() => void decide(step.code, true)}
              >
                Link this computer
              </Button>
              <Button
                className="min-h-11"
                busy={busy === "refuse"}
                busyLabel="Refusing"
                disabled={busy !== null}
                onClick={() => void decide(step.code, false)}
              >
                Refuse
              </Button>
            </div>
          </div>
        )}

        {step.name === "linked" && (
          <div className="flex flex-col gap-4" role="status">
            <p className="text-lg font-semibold">The computer is linked.</p>
            <p className="text-mute">
              Go back to the terminal. Then open the folder that holds your datasets and run{" "}
              <code className="font-mono text-ink">crosswalk</code>.
            </p>
            <p>
              <Link href="/" className="link font-medium">
                Go to your projects
              </Link>
            </p>
          </div>
        )}

        {step.name === "refused" && (
          <div className="flex flex-col gap-4" role="status">
            <p className="text-lg font-semibold">The request was refused.</p>
            <p className="text-mute">Nothing was linked, and the code no longer works.</p>
            <p>
              <Link href="/" className="link font-medium">
                Go to your projects
              </Link>
            </p>
          </div>
        )}

        {step.name === "invalid" && (
          <div className="flex flex-col items-start gap-4">
            <Problem>{step.reason}</Problem>
            <Button
              onClick={() => {
                setTyped("");
                setStep({ name: "enter" });
              }}
            >
              Type a code
            </Button>
          </div>
        )}
      </div>
    </Page>
  );
}

export default function DevicePage() {
  return (
    <Suspense>
      <DeviceFlow />
    </Suspense>
  );
}
