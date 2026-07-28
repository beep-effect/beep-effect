#!/usr/bin/env bun
// @effect-diagnostics strictEffectProvide:skip-file

/**
 * Real-model office-action candidate-claims batch command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnthropicLanguageModelLive } from "@beep/anthropic";
import { LawPracticeServerLive, PracticeKgClaimsOptions, runPracticeKgClaimsBatch } from "@beep/law-practice-server";
import { BunRuntime } from "@effect/platform-bun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer, Path } from "effect";
import { Command, Flag } from "effect/unstable/cli";
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
      Layer.build(claimsLayer).pipe(
        Effect.flatMap((context) =>
          runPracticeKgClaimsBatch(PracticeKgClaimsOptions.make(flags)).pipe(Effect.provide(context))
        )
      )
    );
  })
);

const program = Command.run(claimsCommand, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer));

if (import.meta.main) {
  BunRuntime.runMain(program);
}
