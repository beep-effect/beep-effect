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

const duckStore = (path: Path.Path, dir: string) =>
  DuckDb.makeNodeLayer(
    DuckDbConnectionOptions.make({
      databaseOptions: { access_mode: "READ_ONLY" },
      databasePath: path.join(dir, "practice.duckdb"),
    })
  );

// The old bundle's DuckDB is read-only and multi-process, so it opens beside the new one.
const matterTablesAt = (path: Path.Path, dir: string) =>
  Effect.scoped(
    Layer.build(duckStore(path, dir)).pipe(
      Effect.flatMap((context) => readPracticeKgMatterTables.pipe(Effect.provide(context)))
    )
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
          Effect.all({
            diff: O.match(flags.compareTo, {
              onNone: () => Effect.succeedNone,
              onSome: (dir) =>
                Effect.map(Effect.all([matterTablesAt(path, dir), readPracticeKgMatterTables]), ([base, next]) =>
                  O.some({
                    compareTo: dir,
                    diff: diffPracticeKgMatterTables(PracticeKgMatterTablesComparison.make({ base, next })),
                  })
                ),
            }),
            summary: verifyPracticeKgBundle,
          }).pipe(Effect.provide(context))
        )
      )
    );
    yield* encodeJson(summary).pipe(Effect.flatMap(Console.log));
    yield* O.match(diff, {
      onNone: () => Effect.void,
      onSome: (comparison) => encodeJson(comparison).pipe(Effect.flatMap(Console.log)),
    });
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
