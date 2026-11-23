/**
 * The pure extends-merge engine — reproduces tsc's `extends` merge semantics
 * and its path absolutization as plain string transforms over
 * already-decoded `TsconfigJson.Type` documents. No FileSystem, no Path service:
 * `absolutize` takes an injected `join` (the call site passes `Path.Path.resolve`)
 * and `merge`/`substituteConfigDir` operate on internal forward-slash path
 * helpers, so the module never reaches into `R`.
 *
 * **Details**
 *
 * The loader drives the three phases per tsc: absolutize each config at
 * parse time against its own directory; fold the chain with `merge`, own config
 * last; then run `substituteConfigDir` once against the final config's directory.
 *
 * PATH CONVENTION: `merge`/`substituteConfigDir` assume normalized, absolute
 * forward-slash paths (tsc's internal convention) — the loader normalizes before
 * calling. `dirname`/`relative`/`isAbsolutePath` are pure POSIX string ops on
 * that convention, which keeps the module IO-free while matching tsc's behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TsconfigId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { constant, dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CompilerOptions } from "./CompilerOptions.ts";
import { Reference, TypeAcquisition, WatchOptions } from "./TsconfigJson.ts";
import type { TsconfigJson } from "./TsconfigJson.ts";

const $I = $TsconfigId.create("ResolvedTsconfig");

/**
 * The result of resolving a tsconfig.json's full `extends` chain: the merged
 * compiler options and inherited settings, flattened the way tsc does, with enough
 * provenance for the consumer (`configPath`, `extendedPaths`, and `pathsBase`,
 * the directory of the config that declared `paths`). Unknown top-level keys
 * survive as passthrough via the index signature.
 *
 * @public
 */
const ResolvedTsconfigData = S.StructWithRest(
  S.Struct({
    configPath: S.String.pipe(
      $I.annoteKey("ResolvedTsconfigData.configPath", {
        description: "The own, most-derived config path: the last entry of extendedPaths.",
      })
    ),
    extendedPaths: S.Array(S.String).pipe(
      $I.annoteKey("ResolvedTsconfigData.extendedPaths", {
        description: "The resolution chain, base-most first and own config last.",
      })
    ),
    compilerOptions: S.toType(CompilerOptions).pipe(
      $I.annoteKey("ResolvedTsconfigData.compilerOptions", {
        description: "Per-key merged compiler options: derived wins and paths is replaced wholesale.",
      })
    ),
    files: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("ResolvedTsconfigData.files", {
        description: "Resolved files, when any config in the chain declared them.",
      })
    ),
    include: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("ResolvedTsconfigData.include", {
        description: "Resolved include entries, when any config in the chain declared them.",
      })
    ),
    exclude: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("ResolvedTsconfigData.exclude", {
        description: "Resolved exclude entries, when any config in the chain declared them.",
      })
    ),
    references: Reference.pipe(
      S.toType,
      S.Array,
      S.optionalKey,
      $I.annoteKey("ResolvedTsconfigData.references", { description: "The own config's references, never inherited." })
    ),
    watchOptions: WatchOptions.pipe(
      S.toType,
      S.optionalKey,
      $I.annoteKey("ResolvedTsconfigData.watchOptions", { description: "Per-key merged watch options." })
    ),
    typeAcquisition: TypeAcquisition.pipe(
      S.toType,
      S.optionalKey,
      $I.annoteKey("ResolvedTsconfigData.typeAcquisition", {
        description: "The own config's type acquisition, never inherited.",
      })
    ),
    compileOnSave: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("ResolvedTsconfigData.compileOnSave", {
        description: "The own compile-on-save flag, else a truthy inherited one.",
      })
    ),
    pathsBase: S.optionalKey(S.String).pipe(
      $I.annoteKey("ResolvedTsconfigData.pathsBase", {
        description: "The directory of the config declaring paths, against which paths values resolve.",
      })
    ),
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("ResolvedTsconfig", {
    description: "A resolved tsconfig extends chain with provenance and unknown-key passthrough.",
  })
);

const CONFIG_DIR_TEMPLATE = `\${configDir}`;
const CONFIG_DIR_TEMPLATE_LOWER = Str.toLowerCase(CONFIG_DIR_TEMPLATE);

const startsWithConfigDirIgnoringCase = (value: string): boolean =>
  Str.toLowerCase(Str.slice(0, CONFIG_DIR_TEMPLATE.length)(value)) === CONFIG_DIR_TEMPLATE_LOWER;

const normalizeSlashes = (p: string): string => Str.replace(/\\/g, "/")(p);

const dirname = (p: string): string => {
  const norm = normalizeSlashes(p);
  const idx = O.getOrElse(Str.lastIndexOf("/")(norm), constant(-1));
  if (idx < 0) return ".";
  if (idx === 0) return "/";
  return Str.slice(0, idx)(norm);
};

const relative: {
  (from: string, to: string): string;
  (to: string): (from: string) => string;
} = dual(2, (from: string, to: string): string => {
  const f = A.filter(Str.split("/")(normalizeSlashes(from)), (s) => s.length > 0);
  const t = A.filter(Str.split("/")(normalizeSlashes(to)), (s) => s.length > 0);
  let i = 0;
  while (i < f.length && i < t.length && f[i] === t[i]) i++;
  const segments = [...A.map(f.slice(i), () => ".."), ...t.slice(i)];
  return A.join(segments, "/");
});

const isAbsolutePath = (p: string): boolean =>
  Str.startsWith("/")(p) || Str.startsWith("\\\\")(p) || /^[a-zA-Z]:[\\/]/.test(p);

const rebuildRecordWritingProtoKeyAsData: {
  <Value>(source: Record<string, Value>, mapValue: (key: string, value: Value) => Value): Record<string, Value>;
  <Value>(mapValue: (key: string, value: Value) => Value): (source: Record<string, Value>) => Record<string, Value>;
} = dual(
  2,
  <Value>(source: Record<string, Value>, mapValue: (key: string, value: Value) => Value): Record<string, Value> =>
    R.fromEntries(A.map(R.toEntries(source), ([key, value]) => [key, mapValue(key, value)] as const))
);

const PATH_STRING_KEYS = [
  "outFile",
  "outDir",
  "rootDir",
  "declarationDir",
  "sourceRoot",
  "mapRoot",
  "tsBuildInfoFile",
  "baseUrl",
  "generateCpuProfile",
  "generateTrace",
] as const;

const PATH_LIST_KEYS = ["typeRoots", "rootDirs"] as const;

const transformPathList = (value: ReadonlyArray<string>, transform: (value: string) => string): ReadonlyArray<string> =>
  A.map<ReadonlyArray<string>, string>(value, (entry) => (P.isString(entry) ? transform(entry) : entry));

const transformPathsValues = (co: CompilerOptions.Type, transform: (value: string) => string): CompilerOptions.Type =>
  P.isObjectKeyword(co.paths) && !P.isFunction(co.paths)
    ? {
        ...co,
        paths: rebuildRecordWritingProtoKeyAsData(co.paths, (_key, arr) =>
          A.isArray(arr) ? transformPathList(arr, transform) : arr
        ),
      }
    : co;

const transformCompilerOptionPaths: {
  (co: CompilerOptions.Type, transform: (value: string) => string, includePathsValues: boolean): CompilerOptions.Type;
  (
    transform: (value: string) => string,
    includePathsValues: boolean
  ): (co: CompilerOptions.Type) => CompilerOptions.Type;
} = dual(
  3,
  (
    co: CompilerOptions.Type,
    transform: (value: string) => string,
    includePathsValues: boolean
  ): CompilerOptions.Type => {
    const out: { -readonly [Key in keyof CompilerOptions.Type]: CompilerOptions.Type[Key] } = { ...co };
    for (const key of PATH_STRING_KEYS) {
      const value = out[key];
      if (P.isString(value)) out[key] = transform(value);
    }
    for (const key of PATH_LIST_KEYS) {
      const value = out[key];
      if (A.isArray(value)) out[key] = transformPathList(value, transform);
    }
    return includePathsValues ? transformPathsValues(out, transform) : out;
  }
);

const absolutize: {
  (configDir: string, join: (a: string, b: string) => string): (doc: TsconfigJson.Type) => TsconfigJson.Type;
  (doc: TsconfigJson.Type, configDir: string, join: (a: string, b: string) => string): TsconfigJson.Type;
} = dual(3, (doc: TsconfigJson.Type, configDir: string, join: (a: string, b: string) => string): TsconfigJson.Type => {
  const co = doc.compilerOptions;
  if (co === undefined) return doc;
  const absolutizeValue = (value: string): string =>
    startsWithConfigDirIgnoringCase(value) ? value : join(configDir, value);
  return { ...doc, compilerOptions: transformCompilerOptionPaths(co, absolutizeValue, false) };
});

const DERIVED_CONSUMED_KEYS: HashSet.HashSet<string> = HashSet.fromIterable([
  "compilerOptions",
  "extends",
  "files",
  "include",
  "exclude",
  "references",
  "watchOptions",
  "typeAcquisition",
  "compileOnSave",
]);

const RESOLVED_STRUCTURAL_KEYS: HashSet.HashSet<string> = HashSet.fromIterable([
  "configPath",
  "extendedPaths",
  "compilerOptions",
  "files",
  "include",
  "exclude",
  "references",
  "watchOptions",
  "typeAcquisition",
  "compileOnSave",
  "pathsBase",
  "extends",
]);

const extractPassthrough: {
  (source: Record<string, unknown>, consumed: HashSet.HashSet<string>): Record<string, unknown>;
  (consumed: HashSet.HashSet<string>): (source: Record<string, unknown>) => Record<string, unknown>;
} = dual(
  2,
  (source: Record<string, unknown>, consumed: HashSet.HashSet<string>): Record<string, unknown> =>
    R.fromEntries(
      A.map(
        A.filter(R.keys(source), (key) => !HashSet.has(consumed, key)),
        (key) => [key, source[key]] as const
      )
    )
);

const rerootEntry: {
  (entry: string, prefix: string): string;
  (prefix: string): (entry: string) => string;
} = dual(2, (entry: string, prefix: string): string => {
  if (startsWithConfigDirIgnoringCase(entry) || isAbsolutePath(entry)) return entry;
  return prefix === "" ? entry : `${prefix}/${entry}`;
});

const mergeFileList: {
  (
    baseList: ReadonlyArray<string> | undefined,
    derivedList: ReadonlyArray<string> | undefined,
    rerootPrefix: string
  ): ReadonlyArray<string> | undefined;
  (
    derivedList: ReadonlyArray<string> | undefined,
    rerootPrefix: string
  ): (baseList: ReadonlyArray<string> | undefined) => ReadonlyArray<string> | undefined;
} = dual(
  3,
  (
    baseList: ReadonlyArray<string> | undefined,
    derivedList: ReadonlyArray<string> | undefined,
    rerootPrefix: string
  ): ReadonlyArray<string> | undefined => {
    if (derivedList !== undefined) return derivedList;
    if (baseList === undefined) return undefined;
    return A.map(baseList, rerootEntry(rerootPrefix));
  }
);

const mergeWatchOptions: {
  (base: WatchOptions.Type | undefined, derived: WatchOptions.Type | undefined): WatchOptions.Type | undefined;
  (derived: WatchOptions.Type | undefined): (base: WatchOptions.Type | undefined) => WatchOptions.Type | undefined;
} = dual(
  2,
  (base: WatchOptions.Type | undefined, derived: WatchOptions.Type | undefined): WatchOptions.Type | undefined => {
    if (base === undefined) return derived;
    if (derived === undefined) return base;
    return { ...base, ...derived };
  }
);

const merge: {
  (derived: TsconfigJson.Type, derivedPath: string): (base: ResolvedTsconfig) => ResolvedTsconfig;
  (base: ResolvedTsconfig, derived: TsconfigJson.Type, derivedPath: string): ResolvedTsconfig;
} = dual(3, (base: ResolvedTsconfig, derived: TsconfigJson.Type, derivedPath: string): ResolvedTsconfig => {
  const finalDir = dirname(derivedPath);
  const baseDir = dirname(base.configPath);

  const compilerOptions: CompilerOptions.Type = { ...base.compilerOptions, ...derived.compilerOptions };

  const pathsBase = derived.compilerOptions?.paths !== undefined ? finalDir : base.pathsBase;

  const rerootPrefix = relative(finalDir, baseDir);
  const files = mergeFileList(base.files, derived.files, rerootPrefix);
  const include = mergeFileList(base.include, derived.include, rerootPrefix);
  const exclude = mergeFileList(base.exclude, derived.exclude, rerootPrefix);

  const references = derived.references;
  const typeAcquisition = derived.typeAcquisition;

  const compileOnSave =
    derived.compileOnSave !== undefined ? derived.compileOnSave : base.compileOnSave === true ? true : undefined;

  const watchOptions = mergeWatchOptions(base.watchOptions, derived.watchOptions);

  const passthroughSpreadFirstSoStructuralFieldsWin = {
    ...extractPassthrough(base, RESOLVED_STRUCTURAL_KEYS),
    ...extractPassthrough(derived, DERIVED_CONSUMED_KEYS),
  };

  return ResolvedTsconfig.make({
    ...passthroughSpreadFirstSoStructuralFieldsWin,
    configPath: derivedPath,
    extendedPaths: [...base.extendedPaths, derivedPath],
    compilerOptions,
    ...O.getSomesStruct({ files: O.fromUndefinedOr(files) }),
    ...O.getSomesStruct({ include: O.fromUndefinedOr(include) }),
    ...O.getSomesStruct({ exclude: O.fromUndefinedOr(exclude) }),
    ...O.getSomesStruct({ references: O.fromUndefinedOr(references) }),
    ...O.getSomesStruct({ watchOptions: O.fromUndefinedOr(watchOptions) }),
    ...O.getSomesStruct({ typeAcquisition: O.fromUndefinedOr(typeAcquisition) }),
    ...O.getSomesStruct({ compileOnSave: O.fromUndefinedOr(compileOnSave) }),
    ...O.getSomesStruct({ pathsBase: O.fromUndefinedOr(pathsBase) }),
  });
});

const substituteWatchExcludes: {
  (wo: WatchOptions.Type | undefined, substitute: (value: string) => string): WatchOptions.Type | undefined;
  (substitute: (value: string) => string): (wo: WatchOptions.Type | undefined) => WatchOptions.Type | undefined;
} = dual(
  2,
  (wo: WatchOptions.Type | undefined, substitute: (value: string) => string): WatchOptions.Type | undefined => {
    if (wo === undefined) return undefined;
    const out: { -readonly [Key in keyof WatchOptions.Type]: WatchOptions.Type[Key] } = { ...wo };
    for (const key of ["excludeDirectories", "excludeFiles"] as const) {
      const value = out[key];
      if (A.isArray(value)) out[key] = transformPathList(value, substitute);
    }
    return out;
  }
);

const substituteConfigDir: {
  (finalDir: string): (resolved: ResolvedTsconfig) => ResolvedTsconfig;
  (resolved: ResolvedTsconfig, finalDir: string): ResolvedTsconfig;
} = dual(2, (resolved: ResolvedTsconfig, finalDir: string): ResolvedTsconfig => {
  const substitute = (value: string): string =>
    startsWithConfigDirIgnoringCase(value) ? finalDir + Str.slice(CONFIG_DIR_TEMPLATE.length)(value) : value;

  const compilerOptions = transformCompilerOptionPaths(resolved.compilerOptions, substitute, true);
  const substituteList = (list: ReadonlyArray<string> | undefined): O.Option<ReadonlyArray<string>> =>
    O.map(O.fromUndefinedOr(list), A.map(substitute));

  return {
    ...resolved,
    compilerOptions,
    ...O.getSomesStruct({
      files: substituteList(resolved.files),
      include: substituteList(resolved.include),
      exclude: substituteList(resolved.exclude),
      watchOptions: O.fromUndefinedOr(substituteWatchExcludes(resolved.watchOptions, substitute)),
    }),
  };
});

/**
 * The pure extends-merge engine: parse-time path absolutization
 * ({@link (ResolvedTsconfig:class).absolutize}), the per-field merge fold
 * ({@link (ResolvedTsconfig:class).merge}), and the `${configDir}` final
 * phase ({@link (ResolvedTsconfig:class).substituteConfigDir}).
 *
 * **Example** (Resolve a derived compiler option)
 *
 * ```ts
 * import { ResolvedTsconfig } from "@beep/tsconfig/ResolvedTsconfig";
 *
 * const base = ResolvedTsconfig.make({
 *   configPath: "/project/base.json",
 *   extendedPaths: ["/project/base.json"],
 *   compilerOptions: { strict: true },
 * });
 * const resolved = ResolvedTsconfig.merge(base, { compilerOptions: { strict: false } }, "/project/tsconfig.json");
 * console.log(resolved.compilerOptions.strict) // false
 * console.log(resolved.extendedPaths.length) // 2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ResolvedTsconfig extends S.Opaque<ResolvedTsconfig, { readonly brand: unique symbol }>()(
  ResolvedTsconfigData
) {
  /**
   * Absolutize a config's path-typed options against its own
   * `configDir`, using the injected `join` (`Path.Path.resolve` at the call
   * site — so an already-absolute value is preserved). `${configDir}`-prefixed
   * values are exempt (resolved later, in
   * {@link (ResolvedTsconfig:class).substituteConfigDir}), and `paths`
   * VALUES stay verbatim. Only `compilerOptions` path surfaces are touched;
   * `files`/`include`/`exclude` are re-rooted at merge time instead.
   *
   * **Example** (Absolutize paths while retaining path mappings)
   *
   * ```ts
   * import { ResolvedTsconfig } from "@beep/tsconfig/ResolvedTsconfig";
   *
   * const doc = ResolvedTsconfig.absolutize(
   *   { compilerOptions: { outDir: "dist", paths: { app: ["src/app"] } } },
   *   "/project",
   *   (directory, entry) => `${directory}/${entry}`,
   * );
   * console.log(doc.compilerOptions?.outDir) // /project/dist
   * console.log(doc.compilerOptions?.paths?.app?.[0]) // src/app
   * ```
   *
   * @category normalization
   * @since 0.0.0
   */
  static readonly absolutize = absolutize;

  /**
   * Fold one more-derived config onto the accumulated base, derived
   * winning. The loader applies this across the resolution chain,
   * own config last. `derivedPath` is the derived config's absolute
   * normalized path, from which the re-rooting frame and `pathsBase` are
   * computed.
   *
   * **Example** (Merge a derived file list and inherit checking options)
   *
   * ```ts
   * import { ResolvedTsconfig } from "@beep/tsconfig/ResolvedTsconfig";
   *
   * const base = ResolvedTsconfig.make({
   *   configPath: "/project/base.json",
   *   extendedPaths: ["/project/base.json"],
   *   compilerOptions: { strict: true },
   * });
   * const resolved = ResolvedTsconfig.merge(base, { files: [] }, "/project/app/tsconfig.json");
   * console.log(resolved.configPath) // /project/app/tsconfig.json
   * console.log(resolved.files?.length) // 0
   * console.log(resolved.compilerOptions.strict) // true
   * ```
   *
   * @category combinators
   * @since 0.0.0
   */
  static readonly merge = merge;

  /**
   * The final phase: replace a leading `${configDir}` token
   * (case-insensitive, leading position only) with `finalDir` — the
   * top-level extending config's directory — across every eligible
   * surface: compilerOptions path options, `paths` values,
   * `files`/`include`/`exclude`, and `watchOptions`'
   * `excludeDirectories`/`excludeFiles`. Every other field is left
   * untouched.
   *
   * **Example** (Substitute the final config directory)
   *
   * ```ts
   * import { ResolvedTsconfig } from "@beep/tsconfig/ResolvedTsconfig";
   *
   * const resolved = ResolvedTsconfig.make({
   *   configPath: "/project/tsconfig.json",
   *   extendedPaths: ["/project/tsconfig.json"],
   *   compilerOptions: { outDir: "${configDir}/dist" },
   *   include: ["${configDir}/src"],
   * });
   * const substituted = ResolvedTsconfig.substituteConfigDir(resolved, "/project");
   * console.log(substituted.compilerOptions.outDir) // /project/dist
   * console.log(substituted.include?.[0]) // /project/src
   * ```
   *
   * @category normalization
   * @since 0.0.0
   */
  static readonly substituteConfigDir = substituteConfigDir;
}
