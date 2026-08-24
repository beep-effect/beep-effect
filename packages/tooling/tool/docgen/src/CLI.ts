#!/usr/bin/env node

/**
 * Command-line interface wiring for the docgen package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { TSConfigCompilerOptions } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Effect, flow, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import * as Configuration from "./Configuration.ts";
import * as Core from "./Core.ts";
import * as Domain from "./Domain.ts";
import * as InternalVersion from "./internal/version.ts";

const decodeCompilerOptions = S.decodeUnknownEffect(S.fromJsonString(S.toEncoded(TSConfigCompilerOptions)));

const configFile = Flag.file("config-file", { mustExist: true }).pipe(
  Flag.withDescription("Package-relative path to an alternate docgen configuration file"),
  Flag.optional
);
const parseTsconfigFile = Flag.file("parse-tsconfig-file", { mustExist: true }).pipe(Flag.optional);
const parseCompilerOptionsText = Flag.string("parse-compiler-options").pipe(Flag.optional);
const examplesTsconfigFile = Flag.file("examples-tsconfig-file", { mustExist: true }).pipe(Flag.optional);
const examplesCompilerOptionsText = Flag.string("examples-compiler-options").pipe(Flag.optional);

const projectHomepage = Flag.string("homepage").pipe(
  Flag.withDescription("The link to the project homepage shown in the generated documentation"),
  Flag.optional
);

const srcLink = Flag.string("srcLink").pipe(Flag.withDescription("The link to the project source code"), Flag.optional);

const srcDir = Flag.directory("src").pipe(
  Flag.withDescription("The directory in which docgen will search for TypeScript files to parse"),
  Flag.optional
);

const outDir = Flag.directory("out").pipe(
  Flag.withDescription("The directory to which docgen will write markdown files"),
  Flag.optional
);

const theme = Flag.string("theme").pipe(
  Flag.withDescription("The Jekyll theme that should be used for the generated documentation"),
  Flag.optional
);

const enableSearch = Flag.boolean("enable-search").pipe(
  Flag.withDescription("Whether search should be enabled in the generated documentation"),
  Flag.optional
);

const enforceDescriptions = Flag.boolean("enforce-descriptions").pipe(
  Flag.withDescription("Whether a description for each module export should be required"),
  Flag.optional
);

const enforceExamples = Flag.boolean("enforce-examples").pipe(
  Flag.withDescription("Whether @example tags for each module export should be required"),
  Flag.optional
);

const enforceVersion = Flag.boolean("enforce-version").pipe(
  Flag.withDescription("Whether @since tags for each module export should be required"),
  Flag.optional
);

const runExamples = Flag.boolean("run-examples").pipe(
  Flag.withDescription("Whether to execute examples discovered in the source files"),
  Flag.optional
);

const include = Flag.string("include").pipe(
  Flag.withDescription("Comma-separated package-relative or srcDir-relative file globs to include"),
  Flag.optional
);

const exclude = Flag.string("exclude").pipe(
  Flag.withDescription("A glob pattern specifying files that should be excluded from the generated documentation"),
  Flag.optional
);

const tscExecutable = Flag.string("tscExecutable").pipe(
  Flag.withDescription("The TypeScript compiler executable to use for example type checking"),
  Flag.optional
);

const decodeCompilerOptionsText = (value: string) =>
  decodeCompilerOptions(value).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[CLI.decodeCompilerOptionsText] Invalid compiler options JSON\n${cause.message}`,
      })
    )
  );

const splitGlobList: (value: string) => ReadonlyArray<string> = flow(
  Str.split(","),
  A.map(Str.trim),
  A.filter(Str.isNonEmpty)
);

const resolveCompilerOptionsInput = (filePath: O.Option<string>, text: O.Option<string>) =>
  pipe(
    [
      O.map(filePath, (value) => Effect.succeed(O.some(value))),
      O.map(text, (value) => decodeCompilerOptionsText(value).pipe(Effect.map(O.some))),
    ] satisfies ReadonlyArray<
      O.Option<Effect.Effect<O.Option<Configuration.CompilerOptionsInput>, Domain.DocgenError>>
    >,
    O.firstSomeOf,
    O.getOrElse(() => Effect.succeed(O.none<Configuration.CompilerOptionsInput>()))
  );

const options = {
  configFile,
  projectHomepage,
  srcLink,
  srcDir,
  outDir,
  theme,
  enableSearch,
  enforceDescriptions,
  enforceExamples,
  enforceVersion,
  runExamples,
  include,
  exclude,
  tscExecutable,
  parseTsconfigFile,
  parseCompilerOptionsText,
  examplesTsconfigFile,
  examplesCompilerOptionsText,
} as const;

/**
 * Builds the `docgen` CLI command and wires parsed flags into the core workflow.
 *
 * **Example** (Run docgen command help)
 *
 * ```ts
 * import { Command } from "effect/unstable/cli"
 * import { docgenCommand } from "@beep/repo-docgen/CLI"
 * const runDocgen = Command.runWith(docgenCommand, { version: "v0.0.0" })
 * const helpProgram = runDocgen(["--help"])
 * console.log(helpProgram)
 * ```
 *
 * @internal
 * @effects
 * - Decodes inline compiler-option JSON before loading package configuration.
 * - Prefixes `DocgenError` messages with the resolved package name.
 * - Runs the core docgen workflow with a scoped {@link Configuration.Configuration} layer.
 * @category cli-commands
 * @since 0.0.0
 */
export const docgenCommand = Command.make(
  "docgen",
  options,
  Effect.fnUntraced(function* (input) {
    const parseCompilerOptions = yield* resolveCompilerOptionsInput(
      input.parseTsconfigFile,
      input.parseCompilerOptionsText
    );
    const examplesCompilerOptions = yield* resolveCompilerOptionsInput(
      input.examplesTsconfigFile,
      input.examplesCompilerOptionsText
    );
    const config = yield* Configuration.load({
      configFile: input.configFile,
      projectHomepage: input.projectHomepage,
      srcLink: input.srcLink,
      srcDir: input.srcDir,
      outDir: input.outDir,
      theme: input.theme,
      enableSearch: input.enableSearch,
      enforceDescriptions: input.enforceDescriptions,
      enforceExamples: input.enforceExamples,
      enforceVersion: input.enforceVersion,
      tscExecutable: input.tscExecutable,
      runExamples: input.runExamples,
      include: input.include.pipe(O.map(splitGlobList)),
      exclude: input.exclude.pipe(O.map(A.of)),
      parseCompilerOptions,
      examplesCompilerOptions,
    });

    return yield* Effect.scoped(
      Layer.build(Configuration.Configuration.layer(config)).pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (context) {
            return yield* Core.program.pipe(Effect.provide(context));
          })
        )
      )
    ).pipe(
      Effect.catchTag("DocgenError", (error) =>
        Effect.fail(
          Domain.DocgenError.make({
            message: `[${config.projectName}] ${error.message}`,
          })
        )
      )
    );
  })
);

/**
 * Versioned command runner used by the package binary entry point.
 *
 * **Example** (Invoke CLI with help)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { cli } from "@beep/repo-docgen/CLI"
 *
 * const helpProgram = cli(["--help"]).pipe(Effect.result)
 * console.log(helpProgram)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const cli = Command.runWith(docgenCommand, {
  version: `v${InternalVersion.moduleVersion}`,
});
