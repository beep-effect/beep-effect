#!/usr/bin/env bun

/**
 * Stdio entrypoint for the portable practice knowledge-graph MCP host.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// First import: DuckDB's native addon must resolve beside the executable (#1959).
import "./NativeAddon.install.ts";
import { loadPracticeKgBundleContext, PracticeKgHostError } from "@beep/law-practice-server/PracticeKgHost";
import * as Bool from "effect/Boolean";
import * as Config from "effect/Config";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import { runEntrypoint } from "./entrypoint.ts";
import { SelfCheckFailure } from "./PracticeKgMcp.errors.ts";
import {
  layerShapeOnlyStderr,
  makePracticeKgHostLayer,
  printPracticeKgPrivacyReceipt,
  printPracticeKgSelfCheck,
  printPracticeKgTelemetrySelfCheck,
  runPracticeKgMcpSelfCheck,
  runPracticeKgPrivacyReceipt,
  runPracticeKgTelemetrySelfCheck,
} from "./runtime/index.ts";
import "../../../node_modules/@electric-sql/pglite/dist/initdb.wasm" with { type: "file" };
import "../../../node_modules/@electric-sql/pglite/dist/pglite.data" with { type: "file" };
import "../../../node_modules/@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };

const bundleDir = Flag.Directory("bundle-dir", { mustExist: true }).pipe(Flag.optional);
const corpusRoot = Flag.Directory("corpus-root", { mustExist: true }).pipe(Flag.optional);

const selfCheck = Flag.Boolean("self-check").pipe(
  Flag.withDescription("Open the bundle, print one JSON line describing it, and exit without serving MCP."),
  Flag.withDefault(false)
);

const selfCheckTelemetry = Flag.Boolean("self-check-telemetry").pipe(
  Flag.withDescription(
    "Round-trip a test secret through the telemetry key path, print one JSON line (ok, key path, telemetry directory), and exit."
  ),
  Flag.withDefault(false)
);

const privacyReceipt = Flag.Boolean("privacy-receipt").pipe(
  Flag.withDescription(
    "Print the weekly privacy receipt (refusal and spool counts, key path and epoch, names only) as Markdown, write nothing, and exit."
  ),
  Flag.withDefault(false)
);

type BundleFlags = {
  readonly bundleDir: O.Option<string>;
  readonly corpusRoot: O.Option<string>;
};

const resolveBundle = Effect.fnUntraced(function* (flags: BundleFlags) {
  const configuredBundleDir = yield* Config.option(Config.String("PRACTICE_KG_BUNDLE_DIR"));
  const shortBundleDir = yield* Config.option(Config.String("BUNDLE_DIR"));
  const configuredCorpusRoot = yield* Config.option(Config.String("PRACTICE_KG_CORPUS_ROOT"));
  const bundleDir = yield* O.firstSomeOf([flags.bundleDir, configuredBundleDir, shortBundleDir]).pipe(
    O.match({
      onNone: () =>
        PracticeKgHostError.make({
          message: "Provide --bundle-dir, PRACTICE_KG_BUNDLE_DIR, or BUNDLE_DIR.",
        }),
      onSome: Effect.succeed,
    })
  );
  return { bundleDir, corpusRoot: O.getOrUndefined(O.firstSomeOf([flags.corpusRoot, configuredCorpusRoot])) };
});

const serve = Effect.fnUntraced(function* (flags: BundleFlags) {
  return yield* Effect.gen(function* () {
    const resolved = yield* resolveBundle(flags);
    yield* runPracticeKgMcpSelfCheck(resolved.bundleDir, resolved.corpusRoot);
    const context = yield* loadPracticeKgBundleContext(resolved.bundleDir, resolved.corpusRoot);
    return yield* Layer.launch(makePracticeKgHostLayer(context));
  }).pipe(
    // The message names bundle paths, and Claude Desktop keeps stderr, so
    // the refusal is logged as a shape-only line; `--self-check` prints the
    // full refusal for the operator.
    Effect.catchTag("PracticeKgHostError", (error) =>
      Effect.logError(error).pipe(Effect.andThen(SelfCheckFailure.make({ cause: error, message: error.message })))
    )
  );
});

// The self-check never builds the stdio server layer, so stdin is left alone.
const check = (flags: BundleFlags) =>
  resolveBundle(flags).pipe(
    Effect.catchTag("ConfigError", (cause) =>
      PracticeKgHostError.make({ cause, message: "Failed reading the practice KG bundle configuration." })
    ),
    Effect.flatMap((resolved) => runPracticeKgMcpSelfCheck(resolved.bundleDir, resolved.corpusRoot)),
    printPracticeKgSelfCheck
  );

const serverCommand = Command.make(
  "practice-kg-mcp",
  { bundleDir, corpusRoot, selfCheck, selfCheckTelemetry, privacyReceipt },
  (flags) =>
    Match.value(flags).pipe(
      Match.when({ privacyReceipt: true }, () => printPracticeKgPrivacyReceipt(runPracticeKgPrivacyReceipt())),
      Match.when({ selfCheckTelemetry: true }, () =>
        printPracticeKgTelemetrySelfCheck(runPracticeKgTelemetrySelfCheck())
      ),
      Match.orElse(() => Bool.match(flags.selfCheck, { onFalse: () => serve(flags), onTrue: () => check(flags) }))
    )
);

const program = Command.run(serverCommand, { version: "0.0.0" });
runEntrypoint({ isMain: import.meta.main, program, logger: layerShapeOnlyStderr });
