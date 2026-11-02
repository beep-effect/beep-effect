/**
 * Configuration loading and service wiring for docgen.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ConfigFile } from "@beep/config-file/ConfigFile";
import { JsoncCodec } from "@beep/config-file/JsoncCodec";
import { $RepoDocgenId } from "@beep/identity/packages";
import { PackageJsonFile } from "@beep/package-json/PackageJsonFile";
import { StrictCompilerOptions, StrictTsconfig, TsconfigValidator } from "@beep/repo-tsconfig/TsconfigValidator";
import { jsonStringifyPretty } from "@beep/repo-utils";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { ClosedCompilerOptions } from "@beep/tsconfig/CompilerOptions";
import { A } from "@beep/utils";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import * as Domain from "./Domain.ts";
import type { ConfigReadSchema } from "@beep/config-file/ConfigFile";
import type * as JsonSchema from "effect/JsonSchema";

const $I = $RepoDocgenId.create("Configuration");

/**
 * Default Jekyll remote theme used when neither CLI flags nor `docgen.json` provide one.
 *
 * **Example** (Build remote theme line)
 *
 * ```ts
 * import { DEFAULT_THEME } from "@beep/repo-docgen/Configuration"
 *
 * const configLine = `remote_theme: ${DEFAULT_THEME}`
 * console.log(configLine)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_THEME = "mikearnaldi/just-the-docs";

const PACKAGE_JSON_FILE_NAME = "package.json";
const CONFIG_FILE_NAME = "docgen.json";

/**
 * The on-disk shape of a `compilerOptions` object docgen accepts inline, from
 * `docgen.json` or a CLI flag: the `@beep/tsconfig` closed view's encoded side.
 *
 * **Details**
 *
 * Inline options are checked for their typed shape only (an enum is any
 * string, an unknown option is dropped), as the retired repo-utils model did.
 * The strict rules (`TsconfigValidator`) run where docgen renders the examples
 * `tsconfig.json` and where it reads a tsconfig file the user named.
 *
 * **Example** (Check an inline options object)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CompilerOptionsShape } from "@beep/repo-docgen/Configuration"
 *
 * console.log(S.is(CompilerOptionsShape)({ strict: true, target: "ES2022" })) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CompilerOptionsShape = S.toEncoded(ClosedCompilerOptions).pipe(
  $I.annoteSchema("CompilerOptionsShape", {
    description: "The on-disk compilerOptions shape docgen accepts inline, from docgen.json or a CLI flag.",
  })
);

/**
 * Schema for accepted CLI or config-file compiler options input.
 *
 * **Example** (Validate tsconfig path input)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CompilerOptionsInput } from "@beep/repo-docgen/Configuration"
 *
 * console.log(S.is(CompilerOptionsInput)("tsconfig.json")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CompilerOptionsInput = S.Union([S.String, CompilerOptionsShape]).pipe(
  $I.annoteSchema("CompilerOptionsInput", {
    description: "Accepted CLI or config-file input for TypeScript compiler options.",
  })
);
const encodeCompilerOptions = S.encodeEffect(StrictCompilerOptions);
const encodeTsconfig = S.encodeEffect(StrictTsconfig);
const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  A.isArray(value) && A.every(value, P.isString);

const stringKeyDefault = (value: string) =>
  S.String.pipe(S.withConstructorDefault(Effect.succeed(value)), S.withDecodingDefaultKey(Effect.succeed(value)));
const booleanKeyDefault = (value: boolean) =>
  S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(value)), S.withDecodingDefaultKey(Effect.succeed(value)));
const stringArrayKeyDefault = ArrayKeyDefaultEmpty(S.String);

/**
 * Schema for the optional package-local `docgen.json` document.
 *
 * **Example** (Decode docgen.json config)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ConfigurationSchema } from "@beep/repo-docgen/Configuration"
 *
 * const decode = S.decodeUnknownSync(ConfigurationSchema)
 * const config = decode({
 *   outDir: "docs",
 *   enforceExamples: true,
 *   include: ["src/Parser.ts"]
 * })
 *
 * console.log(config.include)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ConfigurationSchema extends S.Opaque<ConfigurationSchema, { readonly brand: unique symbol }>()(
  S.Struct({
    $schema: S.optionalKey(S.String).annotateKey({
      description: "Optional JSON schema URI for editor tooling.",
    }),
    enableSearch: booleanKeyDefault(true).annotateKey({
      description: "Whether generated docs include search support.",
    }),
    enforceDescriptions: booleanKeyDefault(false).annotateKey({
      description: "Whether docgen requires descriptions on documented exports.",
    }),
    enforceExamples: booleanKeyDefault(false).annotateKey({
      description: "Whether docgen requires examples on documented exports.",
    }),
    enforceVersion: booleanKeyDefault(true).annotateKey({
      description: "Whether docgen requires @since tags on documented exports.",
    }),
    examplesCompilerOptions: S.optionalKey(CompilerOptionsInput).annotateKey({
      description: "Compiler options or TSConfig path used when checking generated examples.",
    }),
    exclude: stringArrayKeyDefault.annotateKey({
      description: "Glob patterns excluded from docgen source discovery.",
    }),
    include: stringArrayKeyDefault.annotateKey({
      description: "Source file globs or paths included in docgen source discovery.",
    }),
    outDir: stringKeyDefault("docs").annotateKey({
      description: "Output directory for generated documentation.",
    }),
    parseCompilerOptions: S.optionalKey(CompilerOptionsInput).annotateKey({
      description: "Compiler options or TSConfig path used when parsing package source files.",
    }),
    projectHomepage: S.optionalKey(S.String).annotateKey({
      description: "Project homepage URL used as the base for generated links.",
    }),
    srcDir: stringKeyDefault("src").annotateKey({
      description: "Source directory scanned by docgen.",
    }),
    srcLink: S.optionalKey(S.String).annotateKey({
      description: "Source URL prefix used for generated source links.",
    }),
    theme: stringKeyDefault(DEFAULT_THEME).annotateKey({
      description: "Jekyll remote theme emitted into generated documentation.",
    }),
    tscExecutable: stringKeyDefault("tsc").annotateKey({
      description: "TypeScript compiler executable used for example checks.",
    }),
  }).pipe(
    $I.annoteSchema("ConfigurationSchema", {
      description: "Optional package-local docgen.json document.",
    })
  )
) {}

/**
 * Runtime type for decoded `docgen.json` configuration documents.
 *
 * **Example** (Make configuration document)
 *
 * ```ts
 * import { ConfigurationSchema, type ConfigurationDocument } from "@beep/repo-docgen/Configuration"
 *
 * const document: ConfigurationDocument = ConfigurationSchema.make({
 *   enforceVersion: true,
 *   srcDir: "src"
 * })
 *
 * console.log(document.srcDir)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type ConfigurationDocument = ConfigurationSchema;

/**
 * The JSON Schema (draft 2020-12) of {@link ConfigurationSchema}, published as
 * `@beep/repo-docgen/schema.json` for editor tooling: the `S.toJsonSchemaDocument`
 * rendering with unknown keys rejected, assembled under one `$defs` map.
 *
 * **Details**
 *
 * `parseCompilerOptions` and `examplesCompilerOptions` render from
 * {@link CompilerOptionsShape}, so an editor offers exactly the compiler
 * options `TsconfigValidator` accepts. `test/ConfigurationJsonSchema.test.ts`
 * holds the committed `schema.json` equal to this value; regenerate it from the
 * package directory with
 * `bun -e 'import("@beep/repo-docgen/Configuration").then((m) => Bun.write("schema.json", JSON.stringify(m.configurationJsonSchema(), null, 2)))'`
 * followed by `bunx biome format --write schema.json`.
 *
 * **Example** (Read the root reference)
 *
 * ```ts
 * import { configurationJsonSchema } from "@beep/repo-docgen/Configuration"
 *
 * console.log(configurationJsonSchema().$ref) // #/$defs/@beep~1repo-docgen~1Configuration~1ConfigurationSchema
 * ```
 *
 * @returns The draft 2020-12 JSON Schema document for `docgen.json`, with every referenced schema under `$defs`.
 * @category configuration
 * @since 0.0.0
 */
export const configurationJsonSchema = (): JsonSchema.JsonSchema => {
  const document = S.toJsonSchemaDocument(ConfigurationSchema, { onExcessProperty: "error" });
  return { $schema: "https://json-schema.org/draft/2020-12/schema", ...document.schema, $defs: document.definitions };
};

/**
 * Fully resolved configuration values used by the parser, example checker, and printer.
 *
 * **Example** (Build resolved configuration)
 *
 * ```ts
 * import {
 *   DEFAULT_THEME,
 *   ConfigurationShape,
 *   defaultCompilerOptions
 * } from "@beep/repo-docgen/Configuration"
 *
 * const config = ConfigurationShape.make({
 *   enableSearch: true,
 *   enforceDescriptions: false,
 *   enforceExamples: true,
 *   enforceVersion: true,
 *   examplesCompilerOptions: defaultCompilerOptions,
 *   exclude: [],
 *   include: ["src/index.ts"],
 *   outDir: "docs",
 *   parseCompilerOptions: defaultCompilerOptions,
 *   projectHomepage: "https://github.com/beep-effect/beep-effect",
 *   projectName: "@beep/repo-docgen",
 *   srcDir: "src",
 *   srcLink: "https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/docgen/src",
 *   theme: DEFAULT_THEME,
 *   tscExecutable: "tsc"
 * })
 *
 * console.log(config.include)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ConfigurationShape extends S.Opaque<ConfigurationShape, { readonly brand: unique symbol }>()(
  S.Struct({
    enableSearch: S.Boolean.annotateKey({
      description: "Whether generated docs include search support.",
    }),
    enforceDescriptions: S.Boolean.annotateKey({
      description: "Whether docgen requires descriptions on documented exports.",
    }),
    enforceExamples: S.Boolean.annotateKey({
      description: "Whether docgen requires examples on documented exports.",
    }),
    enforceVersion: S.Boolean.annotateKey({
      description: "Whether docgen requires @since tags on documented exports.",
    }),
    examplesCompilerOptions: CompilerOptionsShape.annotateKey({
      description: "Resolved compiler options used when checking generated examples.",
    }),
    exclude: S.Array(S.String).annotateKey({
      description: "Resolved glob patterns excluded from docgen source discovery.",
    }),
    include: S.Array(S.String).annotateKey({
      description: "Resolved source file globs or paths included in docgen source discovery.",
    }),
    outDir: S.String.annotateKey({
      description: "Resolved output directory for generated documentation.",
    }),
    parseCompilerOptions: CompilerOptionsShape.annotateKey({
      description: "Resolved compiler options used when parsing package source files.",
    }),
    projectHomepage: S.String.annotateKey({
      description: "Resolved project homepage URL used as the base for generated links.",
    }),
    projectName: S.String.annotateKey({
      description: "Resolved package name read from package.json.",
    }),
    srcDir: S.String.annotateKey({
      description: "Resolved source directory scanned by docgen.",
    }),
    srcLink: S.String.annotateKey({
      description: "Resolved source URL prefix used for generated source links.",
    }),
    theme: S.String.annotateKey({
      description: "Resolved Jekyll remote theme emitted into generated documentation.",
    }),
    tscExecutable: S.String.annotateKey({
      description: "Resolved TypeScript compiler executable used for example checks.",
    }),
  }).pipe(
    $I.annoteSchema("ConfigurationShape", {
      description: "Fully resolved configuration values used by parser, checker, and printer workflows.",
    })
  )
) {}

/**
 * Runtime configuration service consumed by docgen parsing, checking, and printing effects.
 *
 * **Example** (Provide configuration service)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import {
 *   DEFAULT_THEME,
 *   Configuration,
 *   ConfigurationShape,
 *   defaultCompilerOptions
 * } from "@beep/repo-docgen/Configuration"
 *
 * const config = ConfigurationShape.make({
 *   enableSearch: true,
 *   enforceDescriptions: false,
 *   enforceExamples: true,
 *   enforceVersion: true,
 *   examplesCompilerOptions: defaultCompilerOptions,
 *   exclude: [],
 *   include: [],
 *   outDir: "docs",
 *   parseCompilerOptions: defaultCompilerOptions,
 *   projectHomepage: "https://github.com/beep-effect/beep-effect",
 *   projectName: "@beep/repo-docgen",
 *   srcDir: "src",
 *   srcLink: "https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/docgen/src",
 *   theme: DEFAULT_THEME,
 *   tscExecutable: "tsc"
 * })
 *
 * const projectName = Effect.runSync(
 *   Effect.gen(function* () {
 *     const configuration = yield* Configuration
 *     return configuration.projectName
 *   }).pipe(Effect.provide(Configuration.layer(config)))
 * )
 *
 * console.log(projectName)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Configuration extends Context.Service<Configuration, ConfigurationShape>()($I`Configuration`) {
  /**
   * Creates a layer that provides the current docgen configuration.
   *
   * @param config - Resolved configuration values to expose.
   * @returns Layer providing the {@link Configuration} service.
   */
  static layer(config: ConfigurationShape) {
    return Layer.succeed(Configuration, Configuration.of(config));
  }
}

/**
 * Accepted CLI or config-file input for compiler options.
 *
 * **Example** (Inline and path options)
 *
 * ```ts
 * import type { CompilerOptionsInput } from "@beep/repo-docgen/Configuration"
 *
 * const inlineOptions: CompilerOptionsInput = {
 *   moduleResolution: "bundler",
 *   noEmit: true,
 *   strict: true,
 *   target: "es2022"
 * }
 * const tsconfigPath: CompilerOptionsInput = "tsconfig.json"
 *
 * console.log([inlineOptions.moduleResolution, tsconfigPath])
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type CompilerOptionsInput = typeof CompilerOptionsInput.Type;

/**
 * @internal
 */
type LoadArgs = {
  readonly configFile?: O.Option<string>;
  readonly enableSearch: O.Option<boolean>;
  readonly enforceDescriptions: O.Option<boolean>;
  readonly enforceExamples: O.Option<boolean>;
  readonly enforceVersion: O.Option<boolean>;
  readonly examplesCompilerOptions: O.Option<CompilerOptionsInput>;
  readonly exclude: O.Option<ReadonlyArray<string>>;
  readonly include: O.Option<ReadonlyArray<string>>;
  readonly outDir: O.Option<string>;
  readonly parseCompilerOptions: O.Option<CompilerOptionsInput>;
  readonly projectHomepage: O.Option<string>;
  readonly srcDir: O.Option<string>;
  readonly srcLink: O.Option<string>;
  readonly theme: O.Option<string>;
  readonly tscExecutable: O.Option<string>;
};

/**
 * Default compiler options used when no explicit parse configuration is provided.
 *
 * **Example** (Log default module resolution)
 *
 * ```ts
 * import { defaultCompilerOptions } from "@beep/repo-docgen/Configuration"
 *
 * console.log(defaultCompilerOptions.moduleResolution)
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const defaultCompilerOptions = {
  lib: ["ES2022", "DOM"],
  moduleResolution: "bundler",
  noEmit: true,
  skipLibCheck: true,
  strict: true,
  target: "es2022",
} as const satisfies typeof CompilerOptionsShape.Type;

const readJsoncFile = Effect.fn("readJsonCFile")(function* <A, I>(
  filePath: string,
  schema: ConfigReadSchema<A, I>
): Effect.fn.Return<A, Domain.DocgenError, FileSystem.FileSystem> {
  const fail = (step: string, detail: string) =>
    Effect.fail(
      Domain.DocgenError.make({
        message: `[Configuration.readJsoncFile] Failed to ${step} '${filePath}'\n${detail}`,
      })
    );

  return yield* ConfigFile.read(filePath, { schema, codec: JsoncCodec }).pipe(
    Effect.catchTags({
      ConfigFileReadError: (error) => fail("read", String(error.cause)),
      ConfigCodecError: (error) => fail("parse", String(error.cause)),
      // A schema-only read always carries a `SchemaIssue`; anything else breaks
      // the `ConfigFile.read` contract, so it is a defect. The detail is the
      // `SchemaError` text the old `S.decodeUnknownEffect` path produced.
      ConfigValidationError: (error) =>
        Effect.fromOption(error.schemaIssue).pipe(
          Effect.orDie,
          Effect.flatMap((issue) => fail("decode", String(new S.SchemaError(issue))))
        ),
    })
  );
});

/**
 * The `name` and `homepage` docgen reads from its package's `package.json`.
 *
 * **Example** (Construct a package identity)
 *
 * ```ts
 * import { DocgenPackageIdentity } from "@beep/repo-docgen/Configuration"
 *
 * const identity = DocgenPackageIdentity.make({ name: "@beep/demo", homepage: "https://example.com" })
 * console.log(identity.name) // @beep/demo
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class DocgenPackageIdentity extends S.Opaque<DocgenPackageIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    homepage: S.String,
  }).pipe(
    $I.annoteSchema("DocgenPackageIdentity", {
      description: "The package name and homepage docgen reads from the documented package's package.json.",
    })
  )
) {}

/**
 * Reads a package's `name` and `homepage` through the presence-lenient
 * `PackageManifest` tier.
 *
 * **Details**
 *
 * Every present field must satisfy its `PackageManifest` codec, and docgen
 * needs `name` and `homepage` on top of that. Strict JSON only: JSONC text
 * fails. `DocgenError` carries only a message, so the kit error's text is
 * kept in it.
 *
 * **Example** (Read this package's identity)
 *
 * ```ts
 * import { BunServices } from "@effect/platform-bun"
 * import * as Effect from "effect/Effect"
 * import { readPackageJson } from "../../src/Configuration.ts"
 *
 * const identity = await Effect.runPromise(
 *   readPackageJson("package.json").pipe(Effect.provide(BunServices.layer))
 * )
 * console.log(identity.name)
 * ```
 *
 * @param filePath - Path of the `package.json` to read.
 * @returns The package's name and homepage.
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const readPackageJson = Effect.fn("Configuration.readPackageJson")(function* (
  filePath: string
): Effect.fn.Return<DocgenPackageIdentity, Domain.DocgenError, FileSystem.FileSystem | Path.Path> {
  const fail = (step: string, detail: string, cause?: unknown) =>
    Domain.DocgenError.make({
      message: `[Configuration.readPackageJson] Failed to ${step} '${filePath}'\n${detail}`,
      ...(P.isUndefined(cause) ? {} : { cause }),
    });
  const files = yield* PackageJsonFile.make;
  const manifest = yield* files.readManifest(filePath).pipe(
    Effect.catchTags({
      PackageJsonNotFoundError: (error) => Effect.fail(fail("read", "The file does not exist.", error)),
      PackageJsonReadError: (error) => Effect.fail(fail("read", String(error.cause), error)),
      PackageJsonParseError: (error) => Effect.fail(fail("parse", String(error.cause), error)),
      PackageDecodeError: (error) => Effect.fail(fail("decode", String(error.cause), error)),
    })
  );
  if (P.isUndefined(manifest.name) || P.isUndefined(manifest.homepage)) {
    return yield* fail("decode", "package.json must declare both `name` and `homepage`.");
  }
  return DocgenPackageIdentity.make({ name: manifest.name, homepage: manifest.homepage });
});

const readDocgenConfig = Effect.fn("Configuration.readDocgenConfig")(function* (
  filePath: string
): Effect.fn.Return<O.Option<ConfigurationDocument>, Domain.DocgenError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(filePath).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[Configuration.readDocgenConfig] Failed to check '${filePath}'\n${String(cause)}`,
      })
    )
  );

  if (!exists) {
    return O.none();
  }

  const config = yield* readJsoncFile(filePath, ConfigurationSchema);
  return O.some(config);
});

const readTSConfig = Effect.fn("Configuration.readTSConfig")(function* (
  fileName: string
): Effect.fn.Return<
  typeof CompilerOptionsShape.Type,
  Domain.DocgenError,
  FileSystem.FileSystem | Path.Path | Domain.Process
> {
  const path = yield* Path.Path;
  const process = yield* Domain.Process;
  const cwd = yield* process.cwd;
  const resolved = path.resolve(cwd, fileName);
  const fail = (step: string, detail: string) =>
    Domain.DocgenError.make({
      message: `[Configuration.readTSConfig] Failed to ${step} TSConfig file '${resolved}'\n${detail}`,
    });
  // The named file passes the strict closed check, then its whole `extends`
  // chain is merged with tsc semantics and the merged options pass it too.
  const strict = yield* TsconfigValidator.compilerOptions(resolved).pipe(
    Effect.catchTags({
      TsconfigValidationError: (error) => fail("decode", error.message),
      TsconfigParseError: (error) => fail("decode", pipe(error, Cause.fail, Cause.pretty)),
      TsconfigExtendsError: (error) => fail("resolve", error.message),
      PlatformError: (error) => fail("read", String(error)),
    })
  );
  if (A.isReadonlyArrayEmpty(Struct.keys(strict))) {
    return defaultCompilerOptions;
  }

  return yield* encodeCompilerOptions(strict).pipe(
    Effect.mapError((cause) => fail("encode compiler options from", cause.message))
  );
});

/**
 * Renders the examples `tsconfig.json` text from resolved examples compiler
 * options: the options pass the strict `TsconfigValidator` check (an unknown
 * option or a cross-field violation fails typed), then the validated document
 * is pretty-printed with every enum in its canonical spelling.
 *
 * **Example** (Render the examples tsconfig)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { encodeExamplesTsconfig } from "@beep/repo-docgen/Configuration"
 *
 * const text = Effect.runSync(encodeExamplesTsconfig({ noEmit: true, target: "ES2022" }))
 * console.log(text.includes('"target": "es2022"')) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const encodeExamplesTsconfig = Effect.fn("Configuration.encodeExamplesTsconfig")(function* (
  compilerOptions: typeof CompilerOptionsShape.Type
): Effect.fn.Return<string, Domain.DocgenError> {
  const fail = (detail: string) =>
    Domain.DocgenError.make({
      message: `[Configuration.encodeExamplesTsconfig] Failed to encode examples tsconfig\n${detail}`,
    });
  const document = yield* TsconfigValidator.validate({ compilerOptions }).pipe(
    Effect.mapError((error) => fail(error.message))
  );
  const encoded = yield* encodeTsconfig(document).pipe(Effect.mapError((cause) => fail(cause.message)));
  return yield* jsonStringifyPretty(encoded).pipe(Effect.mapError((cause) => fail(cause.message)));
});

const resolveCompilerOptions = (
  fromCLI: O.Option<CompilerOptionsInput>,
  fromDocgenJson: O.Option<CompilerOptionsInput>
): Effect.Effect<
  typeof CompilerOptionsShape.Type,
  Domain.DocgenError,
  FileSystem.FileSystem | Path.Path | Domain.Process
> => {
  const resolved = O.orElse(fromCLI, () => fromDocgenJson);

  if (O.isNone(resolved)) {
    return Effect.succeed(defaultCompilerOptions);
  }

  return P.isString(resolved.value) ? readTSConfig(resolved.value) : Effect.succeed(resolved.value);
};

const resolveString = (fromCLI: O.Option<string>, fromDocgenJson: O.Option<string>, fallback: string): string =>
  O.getOrElse(
    O.orElse(fromCLI, () => fromDocgenJson),
    () => fallback
  );

/**
 * Loads and resolves the effective docgen configuration from CLI input and repo files.
 *
 * **Details**
 *
 * CLI options win over `docgen.json`; missing values fall back to package metadata and repo defaults.
 * Example compiler options are post-processed to allow generated imports and to disable unused checks.
 *
 * **Example** (Load config from CLI)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 * import { load } from "@beep/repo-docgen/Configuration"
 * const program = load({
 *   configFile: O.none(),
 *   enableSearch: O.some(false),
 *   enforceDescriptions: O.none(),
 *   enforceExamples: O.some(true),
 *   enforceVersion: O.none(),
 *   examplesCompilerOptions: O.none(),
 *   exclude: O.none(),
 *   include: O.some(["src/Domain.ts"]),
 *   outDir: O.none(),
 *   parseCompilerOptions: O.none(),
 *   projectHomepage: O.none(),
 *   srcDir: O.none(),
 *   srcLink: O.none(),
 *   theme: O.none(),
 *   tscExecutable: O.none()
 * }).pipe(Effect.map((config) => config.include))
 * console.log(program)
 * ```
 *
 * @internal
 * @effects
 * - Reads `package.json`, optional `docgen.json`, and any referenced TSConfig file from the current package.
 * - Fails with `DocgenError` when JSONC parsing, schema decoding, or file access fails.
 * @category configuration
 * @since 0.0.0
 */
export const load = Effect.fn("load")(function* (args: LoadArgs) {
  const process = yield* Domain.Process;
  const cwd = yield* process.cwd;
  const path = yield* Path.Path;

  const packageJson = yield* readPackageJson(path.join(cwd, PACKAGE_JSON_FILE_NAME));
  const configFile = O.getOrElse(args.configFile ?? O.none(), () => CONFIG_FILE_NAME);
  const maybeConfig = yield* readDocgenConfig(path.resolve(cwd, configFile));
  const docgenConfig = O.getOrElse(maybeConfig, () => ConfigurationSchema.make({}));

  const projectName = packageJson.name;
  const projectHomepage = resolveString(
    args.projectHomepage,
    O.fromNullishOr(docgenConfig.projectHomepage),
    packageJson.homepage
  );
  const srcLink = resolveString(
    args.srcLink,
    O.fromNullishOr(docgenConfig.srcLink),
    `${projectHomepage}/blob/main/src/`
  );
  const srcDir = O.getOrElse(args.srcDir, () => docgenConfig.srcDir);
  const outDir = O.getOrElse(args.outDir, () => docgenConfig.outDir);
  const theme = O.getOrElse(args.theme, () => docgenConfig.theme);
  const enableSearch = O.getOrElse(args.enableSearch, () => docgenConfig.enableSearch);
  const enforceDescriptions = O.getOrElse(args.enforceDescriptions, () => docgenConfig.enforceDescriptions);
  const enforceExamples = O.getOrElse(args.enforceExamples, () => docgenConfig.enforceExamples);
  const enforceVersion = O.getOrElse(args.enforceVersion, () => docgenConfig.enforceVersion);
  const tscExecutable = O.getOrElse(args.tscExecutable, () => docgenConfig.tscExecutable);
  const include = O.getOrElse(args.include, () => docgenConfig.include);
  const exclude = O.getOrElse(args.exclude, () => docgenConfig.exclude);
  const parseCompilerOptions = yield* resolveCompilerOptions(
    args.parseCompilerOptions,
    O.fromNullishOr(docgenConfig.parseCompilerOptions)
  );
  const resolvedExamplesCompilerOptions = yield* resolveCompilerOptions(
    args.examplesCompilerOptions,
    O.fromNullishOr(docgenConfig.examplesCompilerOptions)
  );
  // Examples commonly include illustrative bindings that are intentionally unused.
  // Force-disable unused checks to keep docs validation focused on type correctness.
  const configuredExampleTypes: ReadonlyArray<string> = isStringArray(resolvedExamplesCompilerOptions.types)
    ? resolvedExamplesCompilerOptions.types
    : A.empty<string>();
  const exampleTypes: ReadonlyArray<string> = pipe(configuredExampleTypes, A.append("node"), A.append("bun"), A.dedupe);
  const examplesCompilerOptions = {
    ...resolvedExamplesCompilerOptions,
    allowImportingTsExtensions: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    types: exampleTypes,
  };

  return Configuration.of(
    ConfigurationShape.make({
      enableSearch,
      enforceDescriptions,
      enforceExamples,
      enforceVersion,
      examplesCompilerOptions,
      exclude,
      include,
      outDir,
      parseCompilerOptions,
      projectHomepage,
      projectName,
      srcDir,
      srcLink,
      theme,
      tscExecutable,
    })
  );
});

/**
 * Empty layer kept for upstream workflow parity while this port resolves configuration in {@link load}.
 *
 * **Example** (Merge empty config layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer";
 * import { configProviderLayer } from "@beep/repo-docgen/Configuration"
 *
 * const merged = Layer.mergeAll(configProviderLayer, Layer.empty)
 * console.log(merged)
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const configProviderLayer = Layer.empty;
