// Sets a new password for an account. v1 sends no email, so this is how a
// forgotten password is recovered on the laptop that runs Crosswalk.
//
//   pnpm reset-password ada@example.com
//
// Stop the server first: the embedded database allows one process at a time.

import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { createAuth } from "../src/auth";
import { openDatabase } from "../src/db/client";
import { loadConfig } from "../src/env";

const MIN_LENGTH = 8;

function ask(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!muted) {
        process.stdout.write(chunk);
      }
      done();
    },
  });
  const reader = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    reader.question(question, (answer) => {
      reader.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    // What is typed after the question must not appear on screen.
    muted = true;
  });
}

async function main(): Promise<number> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (email === undefined || email === "") {
    console.error("Usage: pnpm reset-password <email>");
    return 2;
  }
  const config = loadConfig();
  let database: Awaited<ReturnType<typeof openDatabase>>;
  try {
    database = await openDatabase(config.dataDir);
  } catch {
    console.error("The database could not be opened. Stop the Crosswalk server and try again.");
    return 1;
  }
  try {
    const auth = createAuth(database.db, config);
    const context = await auth.$context;
    const found = await context.internalAdapter.findUserByEmail(email);
    if (found === null) {
      console.error(`There is no account for ${email}.`);
      return 1;
    }
    const password = await ask("New password: ");
    if (password.length < MIN_LENGTH) {
      console.error(`The password must be at least ${MIN_LENGTH} characters.`);
      return 1;
    }
    if ((await ask("Type it again: ")) !== password) {
      console.error("The two passwords do not match. Nothing was changed.");
      return 1;
    }
    const hash = await context.password.hash(password);
    const accounts = await context.internalAdapter.findAccounts(found.user.id);
    if (accounts.some((account) => account.providerId === "credential")) {
      await context.internalAdapter.updatePassword(found.user.id, hash);
    } else {
      // The account was made with Google only, so it has no password yet.
      await context.internalAdapter.linkAccount({
        userId: found.user.id,
        providerId: "credential",
        accountId: found.user.id,
        password: hash,
      });
    }
    await context.internalAdapter.deleteUserSessions(found.user.id);
    console.log(`The password for ${email} was changed, and every device was signed out.`);
    return 0;
  } finally {
    await database.close();
  }
}

process.exit(await main());
