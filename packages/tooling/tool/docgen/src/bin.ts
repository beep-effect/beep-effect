#!/usr/bin/env bun

/**
 * @since 0.0.0
 */

import { FsUtilsLive } from "@beep/repo-utils";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer } from "effect";
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

BunRuntime.runMain(program);
