#!/usr/bin/env bun

/**
 * Stdio entrypoint of the practice gateway `.mcpb`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { runMcpbEntrypoint } from "@beep/mcpb-kit";
import * as Bool from "effect/Boolean";
import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { printGatewaySelfCheck, runGatewaySelfCheck } from "./SelfCheck.ts";
import { GatewayServerLayer, GatewayServicesLayer } from "./Server.ts";
import { PRACTICE_GATEWAY_VERSION } from "./Version.ts";
// The practice knowledge-graph provider opens PGlite in process, so its
// assets are embedded in the compiled binary.
import "../../../node_modules/@electric-sql/pglite/dist/initdb.wasm" with { type: "file" };
import "../../../node_modules/@electric-sql/pglite/dist/pglite.data" with { type: "file" };
import "../../../node_modules/@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };

const selfCheck = Flag.Boolean("self-check").pipe(
  Flag.withDescription("Run the setup doctor once, print its report as one JSON line, and exit without serving MCP."),
  Flag.withDefault(false)
);

// stdout carries MCP frames (and the self-check's one JSON line), so logs,
// such as a provider explaining why it did not mount, go to stderr.
const StderrLogger = Layer.succeed(Logger.LogToStderr, true);

// The self-check never builds the stdio server layer, so stdin is left alone.
const check = printGatewaySelfCheck(
  GatewayServicesLayer.pipe(
    Layer.provide(StderrLogger),
    Layer.build,
    Effect.flatMap((services) => Effect.provideContext(runGatewaySelfCheck, services)),
    Effect.scoped
  )
);

const serve = Layer.launch(GatewayServerLayer.pipe(Layer.provide(StderrLogger)));

const gatewayCommand = Command.make(
  "practice-gateway",
  { selfCheck },
  Effect.fnUntraced(function* (flags) {
    return yield* Bool.match(flags.selfCheck, { onFalse: () => serve, onTrue: () => check });
  })
);

const program = Command.run(gatewayCommand, { version: PRACTICE_GATEWAY_VERSION });
runMcpbEntrypoint({ isMain: import.meta.main, program });
