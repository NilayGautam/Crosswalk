import { loadConfig } from "./env";
import { startServer } from "./server";

const config = loadConfig();
const server = await startServer(config, config.dataDir);

console.log(`Crosswalk server is running at ${server.url}`);
if (config.webDist === null) {
  console.log(`Open the web app at ${config.publicUrl}`);
}
if (config.google === null) {
  console.log(
    "Google sign-in is off. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to turn it on.",
  );
}

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) {
    return;
  }
  stopping = true;
  await server.close();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
