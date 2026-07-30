#!/usr/bin/env bun

/**
 * Practice knowledge-graph bundle build command.
 *
 * @since 0.0.0
 */

import { buildPracticeKgBundle, PracticeKgOptions } from "@beep/law-practice-server";
import { PosInt } from "@beep/schema";
import * as OptionUtils from "@beep/utils/Option";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import { Command, Flag } from "effect/unstable/cli";
import { makePracticeKgBuildLayer } from "./runtime/index.ts";

const corpusRoot = Flag.directory("corpus-root", { mustExist: true });
const bundleOut = Flag.directory("bundle-out").pipe(Flag.optional);
const includeRefresh = Flag.boolean("include-refresh");
const skipEmails = Flag.boolean("skip-emails");
const maxTextBytes = Flag.integer("max-text-bytes").pipe(Flag.optional);
const overwrite = Flag.boolean("overwrite");

const buildCommand = Command.make(
  "build",
  { bundleOut, corpusRoot, includeRefresh, maxTextBytes, overwrite, skipEmails },
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
        overwrite: flags.overwrite,
        skipEmails: flags.skipEmails,
        ...OptionUtils.getSomesStruct({ maxTextBytes: O.map(flags.maxTextBytes, PosInt.make) }),
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
