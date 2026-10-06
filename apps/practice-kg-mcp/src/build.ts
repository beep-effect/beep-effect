#!/usr/bin/env bun

/**
 * Practice knowledge-graph bundle build command.
 *
 * @since 0.0.0
 */

import { buildPracticeKgBundle, PracticeKgOptions, PracticeKgRunLabel } from "@beep/law-practice-server";
import * as OptionUtils from "@beep/utils/Option";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, Path } from "effect";
import { Command, Flag } from "effect/cli";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makePracticeKgBuildLayer } from "./runtime/index.ts";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" })).annotate({
  title: "PosInt",
  description: "An integer greater than zero.",
});

const corpusRoot = Flag.Directory("corpus-root", { mustExist: true });
const bundleOut = Flag.Directory("bundle-out").pipe(Flag.optional);
const includeRefresh = Flag.Boolean("include-refresh").pipe(
  Flag.withDescription("Fold in source run 2026-07-refresh; the same as --include-run 2026-07-refresh."),
  Flag.withDefault(false)
);
const includeRun = Flag.String("include-run").pipe(
  Flag.withDescription(
    "Fold in one source run by label: its unorganized files and staging/extract-<label> text. Repeatable."
  ),
  Flag.withSchema(PracticeKgRunLabel),
  Flag.atLeast(0)
);
const docketRegister = Flag.File("docket-register", { mustExist: true }).pipe(
  Flag.withDescription("Docket register as JSONL, one {client, docket, clientName} object per line."),
  Flag.optional
);
const skipEmails = Flag.Boolean("skip-emails").pipe(Flag.withDefault(false));
const maxTextBytes = Flag.Int("max-text-bytes").pipe(Flag.optional);
const overwrite = Flag.Boolean("overwrite").pipe(Flag.withDefault(false));

const buildCommand = Command.make(
  "build",
  { bundleOut, corpusRoot, docketRegister, includeRefresh, includeRun, maxTextBytes, overwrite, skipEmails },
  Effect.fnUntraced(function* (flags) {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const resolvedBundleOut = PracticeKgOptions.resolveBundleOut(
      { corpusRoot: flags.corpusRoot, ...OptionUtils.getSomesStruct({ bundleOut: flags.bundleOut }) },
      path
    );
    const bundleExists = yield* fs.exists(resolvedBundleOut).pipe(Effect.orElseSucceed(() => false));
    if (bundleExists && flags.overwrite) {
      yield* fs.remove(resolvedBundleOut, { recursive: true });
    }
    yield* fs.makeDirectory(resolvedBundleOut, { recursive: true });
    const build = buildPracticeKgBundle(
      PracticeKgOptions.make({
        bundleOut: resolvedBundleOut,
        corpusRoot: flags.corpusRoot,
        includeRefresh: flags.includeRefresh,
        includeRuns: flags.includeRun,
        overwrite: flags.overwrite,
        skipEmails: flags.skipEmails,
        ...OptionUtils.getSomesStruct({
          docketRegisterPath: flags.docketRegister,
          maxTextBytes: O.map(flags.maxTextBytes, PosInt.make),
        }),
      })
    );
    yield* Effect.scoped(
      Layer.build(makePracticeKgBuildLayer(path.join(resolvedBundleOut, "kg.pglite"))).pipe(
        Effect.flatMap((context) => build.pipe(Effect.provide(context)))
      )
    );
  })
);

const program = Effect.scoped(
  Layer.build(BunServices.layer).pipe(
    Effect.flatMap((context) => Command.run(buildCommand, { version: "0.0.0" }).pipe(Effect.provide(context)))
  )
);

BunRuntime.runMain(program);
