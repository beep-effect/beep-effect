import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as HandlerRegistry from "@proto/tooling/HandlerRegistry";
import * as Effect from "effect/Effect";
import { registry } from "./Runs.registry.ts";

// `bun scripts/handlers.ts` writes src/Runs.handlers.ts; `--check` fails on drift.
Effect.flatMap(registry, (options) => HandlerRegistry.main(options, process.argv.slice(2))).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
