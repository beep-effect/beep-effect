#!/usr/bin/env bun

/**
 * Real-model office-action candidate-claims batch command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnthropicLanguageModelLive } from "@beep/anthropic";
import { LawPracticeServerLive, PracticeKgClaimsOptions, runPracticeKgClaimsBatch } from "@beep/law-practice-server";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { Effect, Layer, Path } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { runEntrypoint } from "./entrypoint.ts";
import { makePracticeKgPgliteLayer } from "./runtime/index.ts";

const inputs = Flag.directory("inputs", { mustExist: true });
const bundleOut = Flag.directory("bundle-out", { mustExist: true });

const claimsCommand = Command.make(
  "claims",
  { bundleOut, inputs },
  Effect.fnUntraced(function* (flags) {
    const path = yield* Path.Path;
    const claimsLayer = Layer.mergeAll(
      LawPracticeServerLive.pipe(Layer.provide(AnthropicLanguageModelLive), Layer.provide(BunCrypto.layer)),
      makePracticeKgPgliteLayer(path.join(flags.bundleOut, "kg.pglite"))
    );
    yield* Effect.scoped(
      Layer.build(
        Layer.effectDiscard(runPracticeKgClaimsBatch(PracticeKgClaimsOptions.make(flags))).pipe(
          Layer.provide(claimsLayer)
        )
      )
    );
  })
);

const program = Command.run(claimsCommand, { version: "0.0.0" });
runEntrypoint({ isMain: import.meta.main, program });
