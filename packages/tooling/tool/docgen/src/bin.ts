#!/usr/bin/env bun

/**
 * @since 0.0.0
 */

import { FsUtilsLive } from "@beep/repo-utils";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer, Runtime } from "effect";
import * as Command from "effect/unstable/cli/Command";
import { docgenCommand } from "./CLI.ts";
import * as Domain from "./Domain.ts";
import * as InternalVersion from "./internal/version.ts";

const BaseLayers = Layer.mergeAll(BunServices.layer, Domain.Process.layer);

const DerivedLayers = FsUtilsLive.pipe(Layer.provideMerge(BaseLayers));

const program = Effect.scoped(
  Layer.build(DerivedLayers).pipe(
    Effect.flatMap((ctx) =>
      Command.run(docgenCommand, { version: `v${InternalVersion.moduleVersion}` }).pipe(Effect.provide(ctx))
    )
  )
);

// The runner's onExit only hard-exits on a signal or nonzero code; a clean
// success is left to event-loop drain, so a leaked handle wedges the process
// after docgen completes (the "✓ succeeded"-then-hang CI class). Keep
// defaultTeardown as the sole exit-code authority and force the exit the
// runner declines on success.
const teardown: Runtime.Teardown = (exit, onExit) =>
  Runtime.defaultTeardown(exit, (code) => {
    onExit(code);
    process.exit(code);
  });

BunRuntime.runMain(program, { teardown });
