import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_PROJECT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "cli");

export interface CliResult {
  code: number | null;
  output: string;
}

/** One person's terminal: its own token store and its own folder of datasets. */
export class Terminal {
  readonly home = mkdtempSync(join(tmpdir(), "crosswalk-e2e-"));
  readonly folder = join(this.home, "data");

  constructor(private readonly server: string) {
    mkdirSync(this.folder);
  }

  /** Writes a small made-up dataset into the folder. */
  write(name: string, content: string): void {
    const path = join(this.folder, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  }

  /**
   * Starts `crosswalk` with the given arguments, in the dataset folder.
   * `input` is typed into the command, as a person would answer its prompts.
   */
  start(
    args: string[],
    input?: string,
  ): { process: ChildProcess; done: Promise<CliResult>; output: () => string } {
    const child = spawn(
      "uv",
      ["run", "--quiet", "--no-editable", "--project", CLI_PROJECT, "crosswalk", ...args],
      {
        cwd: this.folder,
        env: {
          ...process.env,
          CROSSWALK_SERVER: this.server,
          CROSSWALK_TOKEN_FILE: join(this.home, "tokens.json"),
          COLUMNS: "200",
          NO_COLOR: "1",
          TERM: "dumb",
        },
        stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      },
    );
    if (input !== undefined) {
      child.stdin?.end(input);
    }
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    const done = new Promise<CliResult>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, output }));
    });
    return { process: child, done, output: () => output };
  }

  async run(args: string[], input?: string): Promise<CliResult> {
    return this.start(args, input).done;
  }
}

/** Waits until the running command has printed something that matches. */
export async function waitForOutput(
  read: () => string,
  pattern: RegExp,
  timeoutMs = 30_000,
): Promise<RegExpMatchArray> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = read().match(pattern);
    if (match !== null) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The command never printed ${pattern}. It printed:\n${read()}`);
}
