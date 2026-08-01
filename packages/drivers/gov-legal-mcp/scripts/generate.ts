#!/usr/bin/env node

/**
 * Offline generator for the checked-in gov-legal MCP tool-name report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ProductionToolNameCollisionReport, renderToolNameCollisionReport } from "@beep/gov-legal-mcp/ToolNames";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Layer, Path } from "effect";

const generateToolNameCollisionReport = Effect.fn("GovLegalMcp.generateToolNameCollisionReport")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const generatedDirectory = path.join(import.meta.dirname, "..", "src", "_generated");
  const reportPath = path.join(generatedDirectory, "tool-name-collision-report.json");

  yield* fs.makeDirectory(generatedDirectory, { recursive: true });
  yield* fs.writeFileString(reportPath, renderToolNameCollisionReport(ProductionToolNameCollisionReport));
  yield* Effect.log(`Generated ${reportPath}`);
});

const program = Effect.scoped(
  Layer.build(NodeServices.layer).pipe(
    Effect.flatMap((context) => generateToolNameCollisionReport().pipe(Effect.provide(context)))
  )
);

NodeRuntime.runMain(program);
