#!/usr/bin/env bun
/**
 * Bundle acceptance sweep entrypoint: proves every graph row resolves, and
 * diffs the matter tables against the bundle being replaced.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import {
  diffPracticeKgMatterTables,
  PracticeKgMatterTablesComparison,
  PracticeKgProjectionError,
  readPracticeKgMatterTables,
  verifyPracticeKgBundle,
} from "@beep/law-practice-server";
import { Console, Effect, Layer, Path } from "effect";
import { Command, Flag } from "effect/cli";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { runEntrypoint } from "./entrypoint.ts";
import { makePracticeKgPgliteLayer } from "./runtime/index.ts";

const bundleDir = Flag.Directory("bundle-dir", { mustExist: true });
const compareTo = Flag.optional(Flag.Directory("compare-to", { mustExist: true }));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const printJson = (value) => encodeJson(value).pipe(Effect.flatMap(Console.log));
const duckStore = (path, dir) =>
  DuckDb.makeNodeLayer(
    DuckDbConnectionOptions.make({
      databaseOptions: { access_mode: "READ_ONLY" },
      databasePath: path.join(dir, "practice.duckdb"),
    })
  );
// The old bundle's DuckDB is read-only and multi-process, so it opens beside the new one.
// Its failures name the old bundle: the new bundle's own read shares the same message otherwise.
const comparisonAgainst = (path, dir) => (next) =>
  Effect.scoped(
    Layer.build(duckStore(path, dir)).pipe(
      Effect.flatMap((context) => readPracticeKgMatterTables.pipe(Effect.provide(context)))
    )
  ).pipe(
    PracticeKgProjectionError.mapError(
      `Practice KG matter tables of the --compare-to bundle "${dir}" could not be read.`
    ),
    Effect.map((base) => ({
      compareTo: dir,
      diff: diffPracticeKgMatterTables(PracticeKgMatterTablesComparison.make({ base, next })),
    }))
  );
const verifyCommand = Command.make(
  "verify",
  { bundleDir, compareTo },
  Effect.fnUntraced(function* (flags) {
    const path = yield* Path.Path;
    const stores = Layer.mergeAll(
      makePracticeKgPgliteLayer(path.join(flags.bundleDir, "kg.pglite")),
      duckStore(path, flags.bundleDir)
    );
    const { diff, summary } = yield* Effect.scoped(
      Layer.build(stores).pipe(
        Effect.flatMap((context) =>
          Effect.gen(function* () {
            // The summary is verified and printed before the old bundle is touched,
            // so a --compare-to failure never hides the new bundle's verification.
            const summary = yield* verifyPracticeKgBundle;
            yield* printJson(summary);
            const diff = yield* O.match(flags.compareTo, {
              onNone: () => Effect.succeedNone,
              onSome: (dir) => Effect.asSome(Effect.flatMap(readPracticeKgMatterTables, comparisonAgainst(path, dir))),
            });
            return { diff, summary };
          }).pipe(Effect.provide(context))
        )
      )
    );
    yield* O.match(diff, { onNone: () => Effect.void, onSome: printJson });
    yield* Effect.succeed(summary).pipe(
      Effect.filterOrFail(
        (result) => result.ok,
        () =>
          PracticeKgProjectionError.make({
            message: "Practice KG bundle verification found rows that do not resolve; see the printed summary.",
          })
      )
    );
    yield* Effect.succeed(diff).pipe(
      Effect.filterOrFail(
        (comparison) => !O.exists(comparison, (result) => result.diff.lost),
        () =>
          PracticeKgProjectionError.make({
            message:
              "Practice KG bundle lost a matter, a docket, or a number against the bundle it replaces; see the printed diff.",
          })
      )
    );
  })
);
const program = Command.run(verifyCommand, { version: "0.0.0" });
runEntrypoint({ isMain: import.meta.main, program });
