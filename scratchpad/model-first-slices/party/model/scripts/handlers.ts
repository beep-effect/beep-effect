import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as HandlerRegistry from "@proto/tooling/HandlerRegistry";
import * as Effect from "effect/Effect";
import { registry } from "./Party.registry.ts";

// `bun scripts/handlers.ts` writes src/Party.handlers.ts; `--check` fails on drift.
Effect.flatMap(registry, HandlerRegistry.main(process.argv.slice(2))).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
