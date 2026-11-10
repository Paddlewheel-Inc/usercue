import { announceChangelog } from "./announce";
import { pruneAudit } from "./audit";
import { runDigest } from "./digest";
import { jobOrigin } from "./origin";

const TICK_MS = 60_000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

let running = false;
let lastPrune = 0;

async function attempt(name: string, job: () => Promise<void>) {
  try {
    await job();
  } catch (error) {
    console.error(`${name} failed:`, error);
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await attempt("Changelog announcements", () => announceChangelog(jobOrigin()));
    await attempt("Weekly digest", () => runDigest());
    if (Date.now() - lastPrune >= PRUNE_EVERY_MS) {
      lastPrune = Date.now();
      await attempt("Audit log cleanup", pruneAudit);
    }
  } finally {
    running = false;
  }
}

export function startJobs() {
  setInterval(() => void tick(), TICK_MS).unref();
  void tick();
}
