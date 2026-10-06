/**
 * Headless self-check for an installed practice KG host: proves the bundle and
 * both stores open without speaking MCP.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb } from "@beep/duckdb";
import { $PracticeKgMcpId } from "@beep/identity/packages";
import { PracticeKgSchemaVersions, PracticeKgToolkit } from "@beep/law-practice-server";
import { Console, Effect, FileSystem, flow, Layer, Path } from "effect";
import * as A from "effect/Array";
import { constFalse } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { SqlClient } from "effect/sql/SqlClient";
import { PracticeKgHostError, SelfCheckFailure } from "../PracticeKgMcp.errors.ts";
import { PRACTICE_KG_EXTENSION_VERSION } from "../Version.ts";
import { loadPracticeKgBundleContext, makePracticeKgHostResourcesLayer } from "./Host.ts";

const $I = $PracticeKgMcpId.create("runtime/SelfCheck");

/**
 * The single line a passing `--self-check` prints.
 *
 * **Example** (Make a passing report)
 *
 * ```ts
 * import { PracticeKgSelfCheckReport } from "../../src/runtime/SelfCheck.ts"
 * import { PracticeKgSchemaVersions } from "@beep/law-practice-server"
 * import * as S from "effect/Schema"
 *
 * const report = PracticeKgSelfCheckReport.make({
 *   extensionVersion: "0.3.0",
 *   bundleVersion: "2026.08.1",
 *   schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "3", pglite: "3" }),
 *   nodes: S.Natural.make(4),
 *   matters: S.Natural.make(1),
 *   tools: S.Natural.make(9)
 * })
 * console.log(report.ok) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgSelfCheckReport extends S.Class<PracticeKgSelfCheckReport>($I`PracticeKgSelfCheckReport`)(
  {
    ok: S.tag(true),
    extensionVersion: S.NonEmptyString,
    bundleVersion: S.NonEmptyString,
    schemaVersion: PracticeKgSchemaVersions,
    nodes: S.Natural,
    matters: S.Natural,
    tools: S.Natural,
  },
  $I.annote("PracticeKgSelfCheckReport", {
    description: "Versions and store counts proving an installed practice KG host can read its bundle.",
  })
) {}

/**
 * The single line a failing `--self-check` prints.
 *
 * **Example** (Make a failing line)
 *
 * ```ts
 * import { PracticeKgSelfCheckRefusal } from "../../src/runtime/SelfCheck.ts"
 *
 * const refusal = PracticeKgSelfCheckRefusal.make({ message: "Bundle directory is required." })
 * console.log(refusal.ok) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgSelfCheckRefusal extends S.Class<PracticeKgSelfCheckRefusal>($I`PracticeKgSelfCheckRefusal`)(
  {
    ok: S.tag(false),
    message: S.String,
  },
  $I.annote("PracticeKgSelfCheckRefusal", {
    description: "Reason an installed practice KG host could not read its bundle.",
  })
) {}

class CountRow extends S.Class<CountRow>($I`CountRow`)(
  { count: S.Natural },
  $I.annote("CountRow", { description: "Single-row count returned by a self-check store query." })
) {}

const decodeCountRows = S.decodeUnknownEffect(S.NonEmptyArray(CountRow));
const firstCount = (rows: A.NonEmptyReadonlyArray<CountRow>) => A.headNonEmpty(rows).count;
const encodeReport = S.encodeEffect(S.fromJsonString(PracticeKgSelfCheckReport));
const encodeRefusal = S.encodeEffect(S.fromJsonString(PracticeKgSelfCheckRefusal));

// Prints the refusal line, then fails with the error that tells the main
// runner the failure is already on stdout.
const refuse = (cause: PracticeKgHostError) =>
  encodeRefusal(PracticeKgSelfCheckRefusal.make({ message: cause.message })).pipe(
    Effect.orDie,
    Effect.flatMap(Console.log),
    Effect.andThen(SelfCheckFailure.make({ cause, message: cause.message }))
  );

const readStoreCounts = Effect.gen(function* () {
  const sql = (yield* SqlClient).withoutTransforms();
  const duckdb = yield* DuckDb;
  const nodes = yield* sql
    .unsafe("SELECT COUNT(*)::FLOAT8 AS count FROM kg_node")
    .pipe(Effect.flatMap(decodeCountRows), Effect.map(firstCount));
  const matters = yield* duckdb
    .query("SELECT CAST(COUNT(*) AS DOUBLE) AS count FROM matters")
    .pipe(Effect.flatMap(decodeCountRows), Effect.map(firstCount));
  return { matters, nodes };
}).pipe(Effect.withSpan("PracticeKgSelfCheck.readStoreCounts"));

// PGlite and DuckDB both create a missing store on open, so a mistyped bundle
// folder would gain two empty stores and then fail on the first query.
const requireStore = Effect.fn("PracticeKgSelfCheck.requireStore")(function* (bundleDir: string, name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const storePath = path.join(bundleDir, name);
  const present = yield* fs.exists(storePath).pipe(Effect.orElseSucceed(constFalse));
  if (!present) {
    return yield* PracticeKgHostError.make({ message: `Practice KG bundle store is missing at "${storePath}".` });
  }
});

/**
 * Load a bundle exactly as the server does and count one table in each store.
 *
 * **Details**
 *
 * Only `SELECT` statements run, and both stores close before the report is
 * returned. The stores are the ones `makePracticeKgHostResourcesLayer` hands
 * the stdio server, so a passing report covers the files the server reads.
 *
 * **Example** (Check a bundle folder)
 *
 * ```ts
 * import { runPracticeKgSelfCheck } from "../../src/runtime/SelfCheck.ts"
 * import { Effect } from "effect"
 *
 * const check = runPracticeKgSelfCheck("/bundle")
 * console.log(Effect.isEffect(check)) // true
 * ```
 *
 * @param bundleDir - Directory containing `bundle.manifest.json` and both stores.
 * @param corpusRoot - Optional pointer to the external corpus content tree.
 * @category use-cases
 * @since 0.0.0
 */
export const runPracticeKgSelfCheck = Effect.fn("PracticeKgSelfCheck.run")(function* (
  bundleDir: string,
  corpusRoot?: string | undefined
) {
  const context = yield* loadPracticeKgBundleContext(bundleDir, corpusRoot);
  yield* requireStore(bundleDir, "kg.pglite");
  yield* requireStore(bundleDir, "practice.duckdb");
  const counts = yield* Layer.build(makePracticeKgHostResourcesLayer(context)).pipe(
    Effect.flatMap((resources) => readStoreCounts.pipe(Effect.provide(resources))),
    Effect.scoped,
    Effect.mapError((cause) =>
      PracticeKgHostError.make({
        cause,
        message: `Practice KG self-check could not read the bundle stores at "${bundleDir}".`,
      })
    )
  );
  return PracticeKgSelfCheckReport.make({
    extensionVersion: PRACTICE_KG_EXTENSION_VERSION,
    bundleVersion: context.manifest.bundleVersion,
    schemaVersion: context.manifest.schemaVersion,
    nodes: counts.nodes,
    matters: counts.matters,
    tools: S.Natural.make(A.length(R.keys(PracticeKgToolkit.tools))),
  });
});

/**
 * Print a self-check outcome as exactly one JSON line on stdout.
 *
 * **Details**
 *
 * A failing check prints `{"ok":false,"message":…}` and then fails with
 * `SelfCheckFailure`, which exits the process non-zero without a second
 * report: nothing but the one line reaches stdout.
 *
 * **Example** (Print a self-check line)
 *
 * ```ts
 * import { printPracticeKgSelfCheck, runPracticeKgSelfCheck } from "../../src/runtime/SelfCheck.ts"
 * import { Effect } from "effect"
 *
 * const printing = printPracticeKgSelfCheck(runPracticeKgSelfCheck("/bundle"))
 * console.log(Effect.isEffect(printing)) // true
 * ```
 *
 * @param check - Self-check to run and report.
 * @category use-cases
 * @since 0.0.0
 */
export const printPracticeKgSelfCheck = <R>(
  check: Effect.Effect<PracticeKgSelfCheckReport, PracticeKgHostError, R>
): Effect.Effect<void, SelfCheckFailure, R> =>
  check.pipe(
    // Both lines encode values their schemas already validated, so an encode failure is a defect.
    Effect.flatMap(flow(encodeReport, Effect.orDie)),
    Effect.matchEffect({ onFailure: refuse, onSuccess: Console.log }),
    Effect.withSpan("PracticeKgSelfCheck.print")
  );
