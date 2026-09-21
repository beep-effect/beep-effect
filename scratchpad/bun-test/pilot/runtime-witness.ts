import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

// Qualification-only setup: record the worker runtime, never its environment.
Effect.runSync(Console.log("PILOT_WORKER_RUNTIME", {
  executable: process.execPath,
  node: process.versions.node,
  bun: process.versions.bun,
}));
