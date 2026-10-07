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
const bundleVersion = Flag.String("bundle-version").pipe(
  Flag.withDescription(
    "Version stamped on the bundle, for example 2026-10-06-03; defaults to the build's own version."
  ),
  Flag.withSchema(S.NonEmptyString),
  Flag.optional
);
const contacts = Flag.File("contacts", { mustExist: true }).pipe(
  Flag.withDescription("Contacts table as JSONL, one contact with its emails and client links per line."),
  Flag.optional
);
const mailIndex = Flag.File("mail-index", { mustExist: true }).pipe(
  Flag.withDescription(
    "Corpus provenance message index as JSONL, one archive message per line; its messages join matter_correspondents by the docket references in their subjects. Repeatable; the first file wins a duplicate."
  ),
  Flag.atLeast(0)
);
const practiceDomain = Flag.String("practice-domain").pipe(
  Flag.withDescription("One of the practice's own mail domains, so its addresses are marked. Repeatable."),
  Flag.withSchema(S.NonEmptyString),
  Flag.atLeast(0)
);
const skipEmails = Flag.Boolean("skip-emails").pipe(Flag.withDefault(false));
const maxTextBytes = Flag.Int("max-text-bytes").pipe(Flag.optional);
const overwrite = Flag.Boolean("overwrite").pipe(Flag.withDefault(false));

const buildCommand = Command.make(
  "build",
  {
    bundleOut,
    bundleVersion,
    contacts,
    corpusRoot,
    docketRegister,
    includeRefresh,
    includeRun,
    mailIndex,
    maxTextBytes,
    overwrite,
    practiceDomain,
    skipEmails,
  },
  Effect.fnUntraced(function* (flags) {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const resolvedBundleOut = PracticeKgOptions.resolveBundleOut(
      { corpusRoot: flags.corpusRoot, ...OptionUtils.getSomesStruct({ bundleOut: flags.bundleOut }) },
      path
    );
    // Options are built before anything is removed, so a value the options
    // schema refuses can never cost an existing bundle.
    const options = PracticeKgOptions.make({
      bundleOut: resolvedBundleOut,
      corpusRoot: flags.corpusRoot,
      includeRefresh: flags.includeRefresh,
      includeRuns: flags.includeRun,
      mailIndexPaths: flags.mailIndex,
      overwrite: flags.overwrite,
      practiceDomains: flags.practiceDomain,
      skipEmails: flags.skipEmails,
      ...OptionUtils.getSomesStruct({
        bundleVersion: flags.bundleVersion,
        contactsPath: flags.contacts,
        docketRegisterPath: flags.docketRegister,
        maxTextBytes: O.map(flags.maxTextBytes, PosInt.make),
      }),
    });
    const bundleExists = yield* fs.exists(resolvedBundleOut).pipe(Effect.orElseSucceed(() => false));
    if (bundleExists && flags.overwrite) {
      yield* fs.remove(resolvedBundleOut, { recursive: true });
    }
    yield* fs.makeDirectory(resolvedBundleOut, { recursive: true });
    const build = buildPracticeKgBundle(options);
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
