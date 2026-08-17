#!/usr/bin/env bun

/**
 * @since 0.0.0
 */

import { FsUtilsLive } from "@beep/repo-utils";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Exit, Layer, Runtime } from "effect";
import { Command } from "effect/unstable/cli";
import { docgenCommand } from "./CLI.ts";
import * as Domain from "./Domain.ts";
import * as InternalVersion from "./internal/version.ts";

const BaseLayers = Layer.mergeAll(BunServices.layer, Domain.Process.layer);

const DerivedLayers = FsUtilsLive.pipe(Layer.provideMerge(BaseLayers));

const program = Effect.scoped(
  Layer.build(DerivedLayers).pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (context) {
        return yield* Command.run(docgenCommand, { version: `v${InternalVersion.moduleVersion}` }).pipe(
          Effect.provide(context)
        );
      })
    )
  )
);

// The platform runner only hard-exits on failure or signal; a successful run
// relies on the event loop draining, so a leaked handle wedges the process
// after docgen completes (the "✓ succeeded"-then-hang CI class). Exit
// explicitly on success.
BunRuntime.runMain(program, {
  teardown: (exit, onExit) => {
    // Announce reaching teardown. "✓ Docs generation succeeded!" only proves the
    // program finished its work, not that the process got to exit -- and when a
    // docgen lane stalls, telling those two apart is the whole question. One
    // terse stderr line per invocation makes the distinction visible in CI.
    process.stderr.write(`[docgen] teardown: ${Exit.isSuccess(exit) ? "success" : "failure"}, exiting\n`);
    Runtime.defaultTeardown(exit, onExit);
    if (Exit.isSuccess(exit)) {
      process.exit(0);
    }
  },
});
