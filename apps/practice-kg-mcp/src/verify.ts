#!/usr/bin/env bun

/**
 * Bundle acceptance sweep entrypoint: proves every graph row resolves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { PracticeKgProjectionError, verifyPracticeKgBundle } from "@beep/law-practice-server";
import { Console, Effect, Layer, Path } from "effect";
import { Command, Flag } from "effect/cli";
import * as S from "effect/Schema";
import { runEntrypoint } from "./entrypoint.ts";
import { makePracticeKgPgliteLayer } from "./runtime/index.ts";

const bundleDir = Flag.Directory("bundle-dir", { mustExist: true });
const encodeSummary = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const verifyCommand = Command.make(
  "verify",
  { bundleDir },
  Effect.fnUntraced(function* (flags) {
    const path = yield* Path.Path;
    const stores = Layer.mergeAll(
      makePracticeKgPgliteLayer(path.join(flags.bundleDir, "kg.pglite")),
      DuckDb.makeNodeLayer(
        DuckDbConnectionOptions.make({
          databaseOptions: { access_mode: "READ_ONLY" },
          databasePath: path.join(flags.bundleDir, "practice.duckdb"),
        })
      )
    );
    const summary = yield* Effect.scoped(
      Layer.build(stores).pipe(Effect.flatMap((context) => verifyPracticeKgBundle.pipe(Effect.provide(context))))
    );
    yield* encodeSummary(summary).pipe(Effect.flatMap(Console.log));
    yield* Effect.succeed(summary).pipe(
      Effect.filterOrFail(
        (result) => result.ok,
        () =>
          PracticeKgProjectionError.make({
            message: "Practice KG bundle verification found rows that do not resolve; see the printed summary.",
          })
      )
    );
  })
);

const program = Command.run(verifyCommand, { version: "0.0.0" });
runEntrypoint({ isMain: import.meta.main, program });
