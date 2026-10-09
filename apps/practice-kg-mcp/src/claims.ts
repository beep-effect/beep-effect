#!/usr/bin/env bun

/**
 * Real-model office-action candidate-claims batch command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnthropicLanguageModelLive } from "@beep/anthropic";
import {
  LawPracticeServerLive,
  PracticeKgClaimsCarryWrite,
  PracticeKgClaimsOptions,
  readPracticeKgClaimsCarry,
  runPracticeKgClaimsBatch,
  writePracticeKgClaimsCarry,
} from "@beep/law-practice-server";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { runEntrypoint } from "./entrypoint.ts";
import { makePracticeKgPgliteLayer } from "./runtime/index.ts";

const inputs = Flag.Directory("inputs", { mustExist: true }).pipe(Flag.optional);
const bundleOut = Flag.Directory("bundle-out", { mustExist: true });
const carryFrom = Flag.Directory("carry-from", { mustExist: true }).pipe(Flag.optional);

/*
 * `--carry-from <bundle>` lifts the candidate claims an earlier batch already
 * extracted into a rebuilt bundle. It calls no model, so it needs neither the
 * language-model layer nor an API key; `--inputs` runs a fresh extraction batch.
 */
const carryClaims = Effect.fnUntraced(function* (sourceBundle: string, destinationBundle: string) {
  const path = yield* Path.Path;
  // The two stores are opened one after the other, each inside its own scope, so
  // the source is closed before the destination is written.
  const carry = yield* Layer.build(makePracticeKgPgliteLayer(path.join(sourceBundle, "kg.pglite"))).pipe(
    Effect.flatMap((context) => readPracticeKgClaimsCarry.pipe(Effect.provide(context))),
    Effect.scoped
  );
  const summary = yield* Layer.build(makePracticeKgPgliteLayer(path.join(destinationBundle, "kg.pglite"))).pipe(
    Effect.flatMap((context) =>
      writePracticeKgClaimsCarry(PracticeKgClaimsCarryWrite.make({ bundleOut: destinationBundle, carry })).pipe(
        Effect.provide(context)
      )
    ),
    Effect.scoped
  );
  yield* Effect.logInfo("PracticeKgClaims.carried", {
    claims: summary.claims,
    evidence: summary.evidence,
    withSourceDocument: summary.withSourceDocument,
  });
});

const extractClaims = Effect.fnUntraced(function* (inputsDir: string, destinationBundle: string) {
  const path = yield* Path.Path;
  const claimsLayer = Layer.mergeAll(
    LawPracticeServerLive.pipe(Layer.provide(AnthropicLanguageModelLive), Layer.provide(BunCrypto.layer)),
    makePracticeKgPgliteLayer(path.join(destinationBundle, "kg.pglite"))
  );
  yield* runPracticeKgClaimsBatch(
    PracticeKgClaimsOptions.make({ bundleOut: destinationBundle, inputs: inputsDir })
  ).pipe(Layer.effectDiscard, Layer.provide(claimsLayer), Layer.build, Effect.scoped);
});

const claimsCommand = Command.make(
  "claims",
  { bundleOut, carryFrom, inputs },
  Effect.fnUntraced(function* (flags) {
    yield* O.match(flags.carryFrom, {
      onNone: () =>
        O.match(flags.inputs, {
          onNone: () => Effect.logError("Provide --inputs for an extraction batch or --carry-from to carry claims."),
          onSome: (inputsDir) => extractClaims(inputsDir, flags.bundleOut),
        }),
      onSome: (sourceBundle) => carryClaims(sourceBundle, flags.bundleOut),
    });
  })
);

const program = Command.run(claimsCommand, { version: "0.0.0" });
runEntrypoint({ isMain: import.meta.main, program });
