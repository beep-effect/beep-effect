#!/usr/bin/env bun
// @effect-diagnostics strictEffectProvide:skip-file

/**
 * Stdio entrypoint for the portable practice knowledge-graph MCP host.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Config, Effect, Layer } from "effect";
import * as O from "effect/Option";
import { Command, Flag } from "effect/unstable/cli";
import { PracticeKgHostError } from "./runtime/Host.ts";
import { loadPracticeKgBundleContext, makePracticeKgHostLayer } from "./runtime/index.ts";
import "../../../node_modules/@electric-sql/pglite/dist/initdb.wasm" with { type: "file" };
import "../../../node_modules/@electric-sql/pglite/dist/pglite.data" with { type: "file" };
import "../../../node_modules/@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };

const bundleDir = Flag.directory("bundle-dir", { mustExist: true }).pipe(Flag.optional);
const corpusRoot = Flag.directory("corpus-root", { mustExist: true }).pipe(Flag.optional);

const serverCommand = Command.make(
  "practice-kg-mcp",
  { bundleDir, corpusRoot },
  Effect.fnUntraced(function* (flags) {
    const configuredBundleDir = yield* Config.option(Config.string("PRACTICE_KG_BUNDLE_DIR"));
    const shortBundleDir = yield* Config.option(Config.string("BUNDLE_DIR"));
    const configuredCorpusRoot = yield* Config.option(Config.string("PRACTICE_KG_CORPUS_ROOT"));
    const resolvedBundleDir = yield* O.firstSomeOf([flags.bundleDir, configuredBundleDir, shortBundleDir]).pipe(
      O.match({
        onNone: () =>
          PracticeKgHostError.make({
            message: "Provide --bundle-dir, PRACTICE_KG_BUNDLE_DIR, or BUNDLE_DIR.",
          }),
        onSome: Effect.succeed,
      })
    );
    const resolvedCorpusRoot = O.getOrUndefined(O.firstSomeOf([flags.corpusRoot, configuredCorpusRoot]));
    const context = yield* loadPracticeKgBundleContext(resolvedBundleDir, resolvedCorpusRoot);
    return yield* Layer.launch(makePracticeKgHostLayer(context));
  })
);

const program = Command.run(serverCommand, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer));

if (import.meta.main) {
  BunRuntime.runMain(program);
}
