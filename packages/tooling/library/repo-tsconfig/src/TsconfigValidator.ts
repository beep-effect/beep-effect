/**
 * Strict, closed validation of a tsconfig.json document: the typed field
 * universe of `@beep/tsconfig` with no passthrough, plus the uniqueness and
 * cross-field rules tsc enforces. `TsconfigValidator.validate` and
 * `TsconfigValidator.validateCompilerOptions` check an in-memory document;
 * `TsconfigValidator.load` and `TsconfigValidator.compilerOptions` run the
 * same checks over a file read through `TsconfigLoader`.
 *
 * **Details**
 *
 * The passthrough model (`TsconfigJson`, `CompilerOptions`) keeps every key
 * tsc would ignore, which is right for a loader. A tool that generates a
 * config from user input (docgen's examples `tsconfig.json`) or reads one the
 * user named wants the opposite: an unknown key is a typo, a `null` option is
 * not a value, a duplicate `lib` entry is a mistake. This module is that
 * door. Its key universe is the closed view `@beep/tsconfig` exports
 * (`ClosedTsconfigJson`, `ClosedCompilerOptions`), so the strict and the
 * passthrough model never drift.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoTsconfigId } from "@beep/identity/packages";
import { ClosedCompilerOptions } from "@beep/tsconfig/CompilerOptions";
import { ClosedTsconfigJson } from "@beep/tsconfig/TsconfigJson";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { TsconfigLoader } from "./TsconfigLoader.ts";
import type { TsconfigParseError } from "@beep/tsconfig/TsconfigJson";
import type * as FileSystem from "effect/FileSystem";
import type * as PlatformError from "effect/PlatformError";
import type * as SchemaAST from "effect/SchemaAST";
import type { TsconfigExtendsError } from "./TsconfigLoader.ts";

const $I = $RepoTsconfigId.create("TsconfigValidator");

/** Strict decoding: an unknown key at any level is a failure, never dropped, and every issue names the rejected value. */
const STRICT = { onExcessProperty: "error", reportInput: true } as const satisfies SchemaAST.ParseOptions;

const UNIQUE_ITEMS = "Array items must be unique.";
const PROTO_KEY = 'Key must not be "__proto__".';

/** tsc normalizes to forward slashes; errors name the config the way `TsconfigLoader` does. */
const normalizeSlashes: (p: string) => string = Str.replace(/\\/g, "/");

/**
 * One `{ path, issue }` when `values` holds a duplicate, judged by `equals`
 * (strict equality unless given), so every list rule reports at its own key.
 *
 * @param path - The issue path of the list within the validated record.
 * @param values - The list, or `undefined` when the key is absent.
 * @param equals - The item equivalence (defaults to `===`).
 * @returns The duplicate issue, if any.
 */
const duplicateIssue = <T>(
  path: ReadonlyArray<PropertyKey>,
  values: ReadonlyArray<T> | undefined,
  equals: (left: T, right: T) => boolean = (left, right) => left === right
): O.Option<S.FilterIssue> =>
  values !== undefined && A.length(A.dedupeWith(values, equals)) !== A.length(values)
    ? O.some({ path, issue: UNIQUE_ITEMS })
    : O.none();

/**
 * `__proto__` cannot be an ordinary own key once a record is rebuilt by a
 * runtime that assigns it, so the strict door rejects it wherever user keys
 * are free-form: `paths` aliases and plugin extras.
 *
 * @param path - The issue path of the record within the validated options.
 * @param keys - The record's keys.
 * @returns The prototype-key issue, if any.
 */
const protoKeyIssue = (path: ReadonlyArray<PropertyKey>, keys: ReadonlyArray<string>): O.Option<S.FilterIssue> =>
  A.contains(keys, "__proto__") ? O.some({ path: [...path, "__proto__"], issue: PROTO_KEY }) : O.none();

type ClosedOptions = ClosedCompilerOptions;
type ClosedDocument = ClosedTsconfigJson;

const UNIQUE_OPTION_LISTS = ["lib", "types", "typeRoots", "rootDirs", "customConditions", "moduleSuffixes"] as const;

const optionListIssues = (options: ClosedOptions): ReadonlyArray<S.FilterIssue> =>
  A.getSomes([
    ...A.map(UNIQUE_OPTION_LISTS, (key) => duplicateIssue([key], options[key])),
    ...pipe(
      O.fromUndefinedOr(options.paths),
      O.match({
        onNone: () => A.empty<O.Option<S.FilterIssue>>(),
        onSome: (paths) => [
          protoKeyIssue(["paths"], R.keys(paths)),
          ...A.map(R.toEntries(paths), ([alias, targets]) => duplicateIssue(["paths", alias], targets)),
        ],
      })
    ),
    ...pipe(
      O.fromUndefinedOr(options.plugins),
      O.match({
        onNone: () => A.empty<O.Option<S.FilterIssue>>(),
        onSome: A.map((plugin, index) => protoKeyIssue(["plugins", index], R.keys(plugin))),
      })
    ),
  ]);

const isNonNegativeInteger = (value: number): boolean => Number.isInteger(value) && N.isGreaterThanOrEqualTo(value, 0);

const StrictCompilerOptionsChecks = S.makeFilterGroup(
  [
    S.makeFilter(
      optionListIssues,
      $I.annote("StrictCompilerOptionsUniqueItemsCheck", {
        title: "Strict compilerOptions unique items",
        description:
          "lib, types, typeRoots, rootDirs, customConditions, moduleSuffixes and every paths target list hold unique items; paths aliases and plugin extras never use the __proto__ key.",
      })
    ),
    S.makeFilter(
      (options: ClosedOptions) =>
        options.maxNodeModuleJsDepth === undefined ||
        isNonNegativeInteger(options.maxNodeModuleJsDepth) || {
          path: ["maxNodeModuleJsDepth"],
          issue: "Expected a non-negative integer.",
        },
      $I.annote("StrictCompilerOptionsMaxNodeModuleJsDepthValueCheck", {
        title: "Strict compilerOptions maxNodeModuleJsDepth value",
        description: "maxNodeModuleJsDepth is a non-negative integer depth.",
      })
    ),
    S.makeFilter(
      (options: ClosedOptions) =>
        options.allowImportingTsExtensions !== true ||
        options.noEmit === true ||
        options.emitDeclarationOnly === true ||
        options.rewriteRelativeImportExtensions === true,
      $I.annote("StrictCompilerOptionsAllowImportingTsExtensionsCheck", {
        title: "Strict compilerOptions allowImportingTsExtensions",
        description:
          "allowImportingTsExtensions requires noEmit, emitDeclarationOnly or rewriteRelativeImportExtensions (tsc TS5096).",
        message:
          "compilerOptions.allowImportingTsExtensions requires compilerOptions.noEmit, compilerOptions.emitDeclarationOnly or compilerOptions.rewriteRelativeImportExtensions to be true.",
      })
    ),
    S.makeFilter(
      (options: ClosedOptions) => options.reactNamespace === undefined || options.jsx === "react",
      $I.annote("StrictCompilerOptionsReactNamespaceCheck", {
        title: "Strict compilerOptions reactNamespace",
        description: "reactNamespace only applies when jsx is set to react.",
        message: "compilerOptions.reactNamespace requires compilerOptions.jsx to be set to react.",
      })
    ),
    S.makeFilter(
      (options: ClosedOptions) => options.maxNodeModuleJsDepth === undefined || options.allowJs === true,
      $I.annote("StrictCompilerOptionsMaxNodeModuleJsDepthCheck", {
        title: "Strict compilerOptions maxNodeModuleJsDepth",
        description: "maxNodeModuleJsDepth only applies when allowJs is enabled.",
        message: "compilerOptions.maxNodeModuleJsDepth requires compilerOptions.allowJs to be true.",
      })
    ),
  ],
  $I.annote("StrictCompilerOptionsChecks", {
    title: "Strict compilerOptions checks",
    description: "The uniqueness and cross-field rules tsc enforces over compilerOptions.",
  })
);

/**
 * The strict `compilerOptions` schema: {@link ClosedCompilerOptions} (no
 * passthrough) refined by tsc's uniqueness and cross-field rules.
 *
 * **Details**
 *
 * Decode it with `onExcessProperty: "error"` to reject unknown options, which
 * is what {@link TsconfigValidator.validateCompilerOptions} does. Encoding a
 * decoded value gives the on-disk JSON shape, with every enum in its
 * canonical lower-case spelling.
 *
 * **Example** (Reject a cross-field violation)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { StrictCompilerOptions } from "@beep/repo-tsconfig/TsconfigValidator";
 *
 * const exit = S.decodeUnknownExit(StrictCompilerOptions)({ maxNodeModuleJsDepth: 2 });
 * console.log(exit._tag); // Failure: maxNodeModuleJsDepth requires allowJs
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const StrictCompilerOptions = ClosedCompilerOptions.check(StrictCompilerOptionsChecks).pipe(
  $I.annoteSchema("StrictCompilerOptions", {
    description:
      "The closed compiler options refined by tsc's uniqueness and cross-field rules; decode strictly to reject unknown options.",
  })
);

/**
 * The decoded shape accepted by {@link (StrictCompilerOptions:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type StrictCompilerOptions = typeof StrictCompilerOptions.Type;

/**
 * Type-only companion namespace for {@link (StrictCompilerOptions:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StrictCompilerOptions {
  /**
   * The decoded strict `compilerOptions` shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Type = StrictCompilerOptions;
  /**
   * The encoded (on-disk JSON) strict `compilerOptions` shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof StrictCompilerOptions.Encoded;
}

const sameReference = (left: { readonly path: string }, right: { readonly path: string }): boolean =>
  left.path === right.path;

const documentListIssues = (document: ClosedDocument): ReadonlyArray<S.FilterIssue> =>
  A.getSomes([
    duplicateIssue(["files"], document.files),
    duplicateIssue(["include"], document.include),
    duplicateIssue(["exclude"], document.exclude),
    duplicateIssue(["references"], document.references, sameReference),
    duplicateIssue(["watchOptions", "excludeFiles"], document.watchOptions?.excludeFiles),
    duplicateIssue(["watchOptions", "excludeDirectories"], document.watchOptions?.excludeDirectories),
    duplicateIssue(["typeAcquisition", "include"], document.typeAcquisition?.include),
    duplicateIssue(["typeAcquisition", "exclude"], document.typeAcquisition?.exclude),
  ]);

const StrictTsconfigChecks = S.makeFilterGroup(
  [
    S.makeFilter(
      documentListIssues,
      $I.annote("StrictTsconfigUniqueItemsCheck", {
        title: "Strict tsconfig unique items",
        description:
          "files, include, exclude, references (by path), watchOptions.excludeFiles, watchOptions.excludeDirectories, typeAcquisition.include and typeAcquisition.exclude hold unique items.",
      })
    ),
  ],
  $I.annote("StrictTsconfigChecks", {
    title: "Strict tsconfig checks",
    description: "The uniqueness rules tsc enforces over the top-level lists and sections.",
  })
);

/**
 * The strict tsconfig.json document schema: {@link ClosedTsconfigJson} with
 * `compilerOptions` as {@link (StrictCompilerOptions:variable)} and the
 * top-level list rules.
 *
 * **Details**
 *
 * Decode it with `onExcessProperty: "error"` to reject unknown keys at every
 * level (the legacy `ts-node` and `buildOptions` sections included), which is
 * what {@link TsconfigValidator.validate} does.
 *
 * **Example** (Encode a validated document)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { StrictTsconfig } from "@beep/repo-tsconfig/TsconfigValidator";
 *
 * const document = S.decodeUnknownSync(StrictTsconfig)({ compilerOptions: { target: "ES2022" } });
 * console.log(S.encodeSync(StrictTsconfig)(document).compilerOptions?.target); // es2022
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const StrictTsconfig = S.Struct({
  ...ClosedTsconfigJson.fields,
  compilerOptions: S.optionalKey(StrictCompilerOptions).pipe(
    $I.annoteKey("StrictTsconfig.compilerOptions", {
      description: "The compilation options for this project, under the strict compilerOptions rules.",
    })
  ),
})
  .check(StrictTsconfigChecks)
  .pipe(
    $I.annoteSchema("StrictTsconfig", {
      description:
        "A tsconfig.json document closed to its typed fields at every level and refined by tsc's list and compilerOptions rules; decode strictly to reject unknown keys.",
    })
  );

/**
 * The decoded shape accepted by {@link (StrictTsconfig:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type StrictTsconfig = typeof StrictTsconfig.Type;

/**
 * Type-only companion namespace for {@link (StrictTsconfig:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StrictTsconfig {
  /**
   * The decoded strict tsconfig.json shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Type = StrictTsconfig;
  /**
   * The encoded (on-disk JSON) strict tsconfig.json shape.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof StrictTsconfig.Encoded;
}

/**
 * Raised when a tsconfig.json document, or a `compilerOptions` record, fails
 * the strict closed validation: an unknown key, a `null` or mistyped option,
 * a removed enum value, a duplicate list item, or a cross-field rule.
 *
 * **Details**
 *
 * `path` is the normalized absolute config path when the failure is
 * file-bound ({@link TsconfigValidator.load},
 * {@link TsconfigValidator.compilerOptions}) and the empty string for an
 * in-memory value. `cause` is the `SchemaError` that names the offending key.
 *
 * **Example** (Read the failing key from the message)
 *
 * ```ts
 * import { TsconfigValidationError } from "@beep/repo-tsconfig/TsconfigValidator";
 *
 * const error = TsconfigValidationError.make({ path: "", cause: new Error("Expected no excess property") });
 * console.log(error.message) // invalid tsconfig.json\nExpected no excess property
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class TsconfigValidationError extends S.TaggedError<TsconfigValidationError, { readonly brand: unique symbol }>(
  $I`TsconfigValidationError`
)(
  "TsconfigValidationError",
  {
    /** The config path that failed validation, or `""` when not file-bound. */
    path: S.String.pipe(
      $I.annoteKey("TsconfigValidationError.path", {
        description: 'The config path that failed validation, or `""` when not file-bound.',
      })
    ),
    /** The underlying schema failure. */
    cause: S.Defect({ includeStack: true }).pipe(
      $I.annoteKey("TsconfigValidationError.cause", { description: "The underlying schema failure." })
    ),
  },
  $I.annoteError<TsconfigValidationError>("TsconfigValidationError", {
    description:
      "Raised when a tsconfig.json document or compilerOptions record fails the strict closed validation. `path` is the config path when the failure is file-bound and the empty string otherwise; `cause` is the schema failure naming the offending key.",
  })
) {
  /**
   * Formats the validation failure: the config path when it is non-empty,
   * then the schema failure text on its own line.
   *
   * **Example** (Inspect a file-bound failure message)
   *
   * ```ts
   * import { TsconfigValidationError } from "@beep/repo-tsconfig/TsconfigValidator";
   *
   * const error = TsconfigValidationError.make({ path: "/p/tsconfig.json", cause: new Error("Expected boolean") });
   * console.log(error.message) // invalid tsconfig.json at "/p/tsconfig.json"\nExpected boolean
   * ```
   *
   * @returns The human-readable failure message.
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const detail = P.isError(this.cause) ? this.cause.message : String(this.cause);
    return Str.isNonEmpty(this.path)
      ? `invalid tsconfig.json at "${this.path}"\n${detail}`
      : `invalid tsconfig.json\n${detail}`;
  }
}

const decodeStrictTsconfig = S.decodeUnknownEffect(StrictTsconfig);
const decodeStrictCompilerOptions = S.decodeUnknownEffect(StrictCompilerOptions);

const validateAt = (path: string) => (input: unknown) =>
  decodeStrictTsconfig(input, STRICT).pipe(Effect.mapError((cause) => TsconfigValidationError.make({ path, cause })));

const validateCompilerOptionsAt = (path: string) => (input: unknown) =>
  decodeStrictCompilerOptions(input, STRICT).pipe(
    Effect.mapError((cause) => TsconfigValidationError.make({ path, cause }))
  );

// Implementation of TsconfigValidator.validate; the public contract lives on the static.
const validate = Effect.fn("TsconfigValidator.validate")(function* (input: unknown) {
  return yield* validateAt("")(input);
});

// Implementation of TsconfigValidator.validateCompilerOptions; the public contract lives on the static.
const validateCompilerOptions = Effect.fn("TsconfigValidator.validateCompilerOptions")(function* (input: unknown) {
  return yield* validateCompilerOptionsAt("")(input);
});

// Implementation of TsconfigValidator.load; the public contract lives on the static.
const load = Effect.fn("TsconfigValidator.load")(function* (
  configPath: string
): Effect.fn.Return<
  StrictTsconfig.Type,
  TsconfigValidationError | TsconfigParseError | PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const abs = normalizeSlashes(path.resolve(configPath));
  const document = yield* TsconfigLoader.load(configPath);
  return yield* validateAt(abs)(document);
});

// Implementation of TsconfigValidator.compilerOptions; the public contract lives on the static.
const compilerOptions = Effect.fn("TsconfigValidator.compilerOptions")(function* (
  configPath: string
): Effect.fn.Return<
  StrictCompilerOptions.Type,
  TsconfigValidationError | TsconfigParseError | TsconfigExtendsError | PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const abs = normalizeSlashes(path.resolve(configPath));
  // One read of the named file: validate the own document, then resolve its
  // extends chain from that same document (only the extended configs are read).
  const document = yield* TsconfigLoader.load(configPath);
  yield* validateAt(abs)(document);
  const resolved = yield* TsconfigLoader.resolveDocument(document, abs);
  const { compilerOptions: options, pathsBase } = resolved;
  const paths = options.paths;
  // The options-only result cannot carry pathsBase to the consumer.
  if (options.baseUrl === undefined && paths !== undefined && pathsBase !== undefined) {
    return yield* validateCompilerOptionsAt(abs)({
      ...options,
      paths: R.map(
        paths,
        A.map((target) => normalizeSlashes(path.resolve(pathsBase, target)))
      ),
    });
  }
  return yield* validateCompilerOptionsAt(abs)(resolved.compilerOptions);
});

/**
 * The strict tsconfig.json door: {@link TsconfigValidator.validate} and
 * {@link TsconfigValidator.validateCompilerOptions} check an in-memory
 * document or options record against {@link (StrictTsconfig:variable)} and
 * {@link (StrictCompilerOptions:variable)} with unknown keys rejected;
 * {@link TsconfigValidator.load} and {@link TsconfigValidator.compilerOptions}
 * run the same checks over a config read through `TsconfigLoader`.
 *
 * **Example** (Validate the examples config docgen renders)
 *
 * ```ts
 * import { TsconfigValidator } from "@beep/repo-tsconfig/TsconfigValidator";
 * import * as Effect from "effect/Effect";
 *
 * const program = TsconfigValidator.validate({ compilerOptions: { noEmit: true, target: "ES2022" } });
 * console.log(Effect.runSync(program).compilerOptions?.target); // es2022
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export abstract class TsconfigValidator {
  /**
   * Strictly decode an in-memory tsconfig.json value (parsed JSON, or a
   * document `TsconfigLoader` decoded) into {@link (StrictTsconfig:variable)}.
   *
   * **Details**
   *
   * An unknown key at any level, a `null` or mistyped option, a removed enum
   * value, a duplicate list item or a cross-field violation fails with a
   * {@link TsconfigValidationError} whose `path` is empty.
   *
   * **Example** (Reject an unknown compiler option)
   *
   * ```ts
   * import { TsconfigValidator } from "@beep/repo-tsconfig/TsconfigValidator";
   * import * as Effect from "effect/Effect";
   *
   * const exit = Effect.runSyncExit(TsconfigValidator.validate({ compilerOptions: { bogus: true } }));
   * console.log(exit._tag); // Failure
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly validate = validate;

  /**
   * Strictly decode an in-memory `compilerOptions` record into
   * {@link (StrictCompilerOptions:variable)}, with the same rules and the same
   * typed failure as {@link TsconfigValidator.validate}.
   *
   * **Example** (Normalize an enum spelling)
   *
   * ```ts
   * import { TsconfigValidator } from "@beep/repo-tsconfig/TsconfigValidator";
   * import * as Effect from "effect/Effect";
   *
   * const options = Effect.runSync(TsconfigValidator.validateCompilerOptions({ moduleResolution: "Bundler" }));
   * console.log(options.moduleResolution); // bundler
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly validateCompilerOptions = validateCompilerOptions;

  /**
   * Read one config file through `TsconfigLoader.load` and validate the
   * document strictly. No `extends` resolution: the named file itself must
   * pass.
   *
   * **Details**
   *
   * Failures are typed: `TsconfigParseError` for a malformed file,
   * {@link TsconfigValidationError} (carrying the normalized absolute path)
   * for a document the strict rules reject, and a `PlatformError` from IO.
   *
   * **Example** (Construct a strict single-config read)
   *
   * ```ts
   * import { TsconfigValidator } from "@beep/repo-tsconfig/TsconfigValidator";
   * import * as Effect from "effect/Effect";
   *
   * const program = TsconfigValidator.load("./tsconfig.json");
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly load = load;

  /**
   * The effective `compilerOptions` of a config under the strict rules: the
   * named file is read once through `TsconfigLoader.load` and passes
   * {@link TsconfigValidator.validate}, its full `extends` chain is merged from
   * that same document by `TsconfigLoader.resolveDocument` (tsc semantics: own
   * config wins, path options absolute, `${configDir}` substituted; only the
   * extended configs are read), and the merged record passes
   * {@link TsconfigValidator.validateCompilerOptions}.
   *
   * **Details**
   *
   * A base config that carries an option the closed model does not type
   * fails here too, since the merged record is validated strictly. Failures
   * add `TsconfigExtendsError` (a broken chain) to those of
   * {@link TsconfigValidator.load}.
   * Without `baseUrl`, `paths` targets are made absolute against the directory
   * that declared them, preserving resolution after the loader's `pathsBase`
   * metadata is dropped. With `baseUrl`, targets stay relative to that option.
   *
   * **Example** (Construct a strict effective-options query)
   *
   * ```ts
   * import { TsconfigValidator } from "@beep/repo-tsconfig/TsconfigValidator";
   * import * as Effect from "effect/Effect";
   *
   * const program = TsconfigValidator.compilerOptions("./tsconfig.json");
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly compilerOptions = compilerOptions;
}
