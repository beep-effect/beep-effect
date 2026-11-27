/**
 * The `extends` target-resolution engine (relative/rooted specifiers and the bare-specifier
 * `node_modules` lookup). Every input reaching {@link resolveExports} is an
 * untrusted `package.json` `exports` map, so every recursive surface carries a
 * depth guard, every untrusted map read goes through `R.has` (an own-property check) and dunder
 * keys are skipped — a JSON-parsed `{"__proto__": …}` key must never read a prototype. Wildcard
 * captures are substituted into string targets only, so no untrusted map is ever rebuilt.
 *
 * **Gotchas**
 *
 * A hostile `package.json` must never defect or fail the whole resolution: a
 * malformed manifest is absorbed to "no resolution for that candidate", and
 * only a genuine `PlatformError` from the underlying IO flows through the typed
 * error channel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Jsonc } from "@beep/jsonc";
import { Walker } from "@beep/walker/Walker";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type * as PlatformError from "effect/PlatformError";

const CONDITIONS = HashSet.make("require", "types", "node", "default");

const DUNDER_KEYS = HashSet.make("__proto__", "constructor", "prototype");

const MAX_EXPORTS_DEPTH = 32;

const INVALID_SEGMENTS = HashSet.make(".", "..", "node_modules");

const ABSENT_EXPORTS = HashSet.make<ReadonlyArray<unknown>>(null, false, "");

type UntrustedRecord = { readonly [key: PropertyKey]: unknown };

interface WildcardPattern {
  readonly prefix: string;
  readonly suffix: string;
}

interface PatternMatch {
  readonly captured: string;
  readonly pattern: string;
  readonly prefixLength: number;
}

interface MatchedExport {
  readonly captured: O.Option<string>;
  readonly value: unknown;
}

interface ExportsWalk {
  readonly blocked: boolean;
  readonly targets: ReadonlyArray<string>;
}

interface BareSpecifier {
  readonly pkg: string;
  readonly subpath: string;
}

const safeKeys = (record: UntrustedRecord): ReadonlyArray<string> =>
  A.filter(R.keys(record), (key) => !HashSet.has(DUNDER_KEYS, key) && R.has(record, key));

const ownProp = (record: UntrustedRecord, key: string): O.Option<unknown> =>
  !HashSet.has(DUNDER_KEYS, key) && R.has(record, key) ? O.some(record[key]) : O.none();

const parseSpecifier = (spec: string): BareSpecifier => {
  const parts = Str.split(spec, "/");
  const nameSegments = Str.startsWith("@")(spec) ? 2 : 1;
  return { pkg: A.join(A.take(parts, nameSegments), "/"), subpath: A.join(A.drop(parts, nameSegments), "/") };
};

const splitPattern = (pattern: string): O.Option<WildcardPattern> =>
  pipe(
    Str.indexOf("*")(pattern),
    O.map((star) => ({ prefix: Str.slice(0, star)(pattern), suffix: Str.slice(star + 1)(pattern) })),
    O.filter(({ suffix }) => !Str.includes("*")(suffix))
  );

const matchWildcard = ({ prefix, suffix }: WildcardPattern, subpath: string): O.Option<string> =>
  subpath.length >= prefix.length + suffix.length && Str.startsWith(prefix)(subpath) && Str.endsWith(suffix)(subpath)
    ? O.some(Str.slice(prefix.length, subpath.length - suffix.length)(subpath))
    : O.none();

const matchPattern =
  (subpath: string) =>
  (pattern: string): O.Option<PatternMatch> =>
    O.flatMap(splitPattern(pattern), (split) =>
      O.map(matchWildcard(split, subpath), (captured) => ({ pattern, captured, prefixLength: split.prefix.length }))
    );

const moreSpecific = (best: O.Option<PatternMatch>, next: PatternMatch): O.Option<PatternMatch> =>
  O.isSome(best) && best.value.prefixLength >= next.prefixLength ? best : O.some(next);

const matchSubpath = (map: UntrustedRecord, subpath: string): O.Option<MatchedExport> =>
  O.orElse(
    O.map(ownProp(map, subpath), (value) => ({ value, captured: O.none<string>() })),
    () =>
      pipe(
        A.getSomes(A.map(safeKeys(map), matchPattern(subpath))),
        A.reduce(O.none<PatternMatch>(), moreSpecific),
        O.map((best) => ({ value: map[best.pattern], captured: O.some(best.captured) }))
      )
  );

const isSubpathMap = (exports: UntrustedRecord): boolean => {
  const keys = R.keys(exports);
  return A.isReadonlyArrayNonEmpty(keys) && A.every(keys, Str.startsWith("."));
};

const matchExportKey = (exports: unknown, subpath: string): O.Option<MatchedExport> => {
  if (P.isObject(exports) && isSubpathMap(exports)) return matchSubpath(exports, subpath);
  const isRootTarget = P.isString(exports) || A.isArray(exports) || P.isObject(exports);
  return subpath === "." && isRootTarget ? O.some({ value: exports, captured: O.none() }) : O.none();
};

const JSON_SIBLING_EXTENSIONS = [".d.ts", ".ts", ".js"];

const jsonTarget = (target: string): O.Option<string> =>
  Str.endsWith(".json")(target)
    ? O.some(target)
    : O.map(
        A.findFirst(JSON_SIBLING_EXTENSIONS, (extension) => Str.endsWith(extension)(target)),
        (extension) => `${Str.slice(0, target.length - extension.length)(target)}.json`
      );

const hasInvalidSegment = (path: string): boolean =>
  A.some(Str.split(path, /[\\/]/), (segment) => HashSet.has(INVALID_SEGMENTS, segment));

const stringTarget = (target: string, captured: O.Option<string>): ReadonlyArray<string> =>
  Str.startsWith("./")(target) && !hasInvalidSegment(Str.slice(2)(target)) && !O.exists(captured, hasInvalidSegment)
    ? pipe(
        captured,
        O.match({ onNone: () => target, onSome: (segment) => A.join(Str.split(target, "*"), segment) }),
        jsonTarget,
        O.toArray
      )
    : [];

const OPEN: ExportsWalk = { targets: [], blocked: false };

const BLOCKED: ExportsWalk = { targets: [], blocked: true };

const walkSequence = <X>(entries: ReadonlyArray<X>, walk: (entry: X) => ExportsWalk): ExportsWalk =>
  A.reduce(entries, OPEN, (acc, entry) => {
    if (acc.blocked) return acc;
    const next = walk(entry);
    return { targets: A.appendAll(acc.targets, next.targets), blocked: next.blocked };
  });

const walkValue = (value: unknown, captured: O.Option<string>, depth: number): ExportsWalk => {
  if (depth > MAX_EXPORTS_DEPTH) return OPEN;
  if (P.isNull(value)) return BLOCKED;
  if (P.isString(value)) return { targets: stringTarget(value, captured), blocked: false };
  if (A.isArray(value)) return walkSequence(value, (entry) => walkValue(entry, captured, depth + 1));
  return P.isObject(value) ? walkConditions(value, captured, depth + 1) : OPEN;
};

const walkConditions = (conditions: UntrustedRecord, captured: O.Option<string>, depth: number): ExportsWalk =>
  walkSequence(
    A.filter(safeKeys(conditions), (key) => HashSet.has(CONDITIONS, key)),
    (key) => walkValue(conditions[key], captured, depth)
  );

/**
 * Resolve a `package.json` `exports` map for a subpath key (`"."` for the
 * package root, `"./sub"` for a subpath) to the `.json` targets tsc probes, in
 * order. Pure and hardened; exported for direct unit testing.
 *
 * **Details**
 *
 * The targets are verbatim from the manifest (still relative to the package
 * directory); the caller joins them and takes the first that is a file. tsc keeps
 * going past a target whose file is missing, through fallback arrays, nested
 * conditions and later conditions alike. A `null` target ends the walk with
 * `blocked: true`: when no earlier target exists, tsc stops the whole lookup
 * there, including the ancestor `node_modules` walk.
 *
 * Selection follows tsc. An exact subpath key decides the subpath even when its
 * targets miss; otherwise, among matching single-`*` patterns, the one with the
 * longest text before the star wins, the earlier on a tie. A non-empty object whose
 * keys all start with `.` is a subpath map; any other string, array or condition
 * object is the `"."` target. Conditions are `require`, `types`, `node` and
 * `default`, walked in the map's insertion order.
 *
 * A string target is skipped, and the walk goes on, unless it starts with `./`
 * and neither its tail nor a `*` capture has a `.`, `..` or `node_modules`
 * segment (either slash separates, case-sensitive, as in tsc). A `.json` target
 * is read as written; a `.d.ts`, `.ts` or `.js` target as its `.json` sibling,
 * longest extension first, so `"./*": "./*.ts"` reaches `./tsconfig.json`.
 * Every other target is not a config.
 *
 * **Example** (Resolve a conditional package subpath)
 *
 * ```ts
 * import { resolveExports } from "@beep/repo-tsconfig/internal/extendsTarget";
 *
 * const walk = resolveExports({ ".": { types: "./index.d.ts", default: "./tsconfig.json" } }, ".");
 * console.log(walk.targets) // ["./index.json", "./tsconfig.json"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const resolveExports: {
  (exports: unknown, subpath: string): { readonly targets: ReadonlyArray<string>; readonly blocked: boolean };
  (subpath: string): (exports: unknown) => { readonly targets: ReadonlyArray<string>; readonly blocked: boolean };
} = dual(
  2,
  (exports: unknown, subpath: string): ExportsWalk =>
    O.match(matchExportKey(exports, subpath), {
      onNone: () => OPEN,
      onSome: ({ value, captured }) => walkValue(value, captured, 0),
    })
);

const readManifest = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  manifestPath: string
): Effect.fn.Return<UntrustedRecord, PlatformError.PlatformError> {
  if (!(yield* fs.exists(manifestPath))) return {};
  const text = yield* fs.readFileString(manifestPath);
  const parsed = yield* Effect.option(Jsonc.parse(text));
  return O.getOrElse(O.filter(parsed, P.isObject), (): UntrustedRecord => ({}));
});

const firstExisting = (
  fs: FileSystem.FileSystem,
  candidates: ReadonlyArray<string>
): Effect.Effect<O.Option<string>, PlatformError.PlatformError> =>
  Effect.findFirst(candidates, (candidate) =>
    fs.stat(candidate).pipe(
      Effect.map((info) => info.type === "File"),
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound" || (P.hasProperty(error.cause, "code") && error.cause.code === "ENOTDIR")
          ? Effect.succeed(false)
          : Effect.fail(error)
      )
    )
  );

const withJsonRetry = (abs: string, written: string): ReadonlyArray<string> =>
  Str.endsWith(".json")(written) ? [abs] : [abs, `${abs}.json`];

const probeExports = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  pkgDir: string,
  exports: unknown,
  subpath: string
): Effect.Effect<O.Option<O.Option<string>>, PlatformError.PlatformError> => {
  const walk = resolveExports(exports, subpath === "" ? "." : `./${subpath}`);
  return Effect.map(
    firstExisting(
      fs,
      A.map(walk.targets, (target) => path.resolve(pkgDir, target))
    ),
    (found) => (walk.blocked ? O.some(found) : O.map(found, O.some))
  );
};

const fallbackCandidates = (
  path: Path.Path,
  pkgDir: string,
  record: UntrustedRecord,
  subpath: string
): ReadonlyArray<string> => {
  if (Str.isNonEmpty(subpath)) {
    const exact = path.resolve(pkgDir, subpath);
    return withJsonRetry(exact, subpath);
  }
  const tsField = pipe(
    ownProp(record, "tsconfig"),
    O.filter(P.isString),
    O.filter(Str.isNonEmpty),
    O.map((field) => path.resolve(pkgDir, field))
  );
  return A.append(O.toArray(tsField), path.join(pkgDir, "tsconfig.json"));
};

const tryCandidate = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  dir: string,
  { pkg, subpath }: BareSpecifier
): Effect.fn.Return<O.Option<O.Option<string>>, PlatformError.PlatformError> {
  const pkgDir = path.join(dir, "node_modules", pkg);
  const record = yield* readManifest(fs, path.join(pkgDir, "package.json"));
  const exports = O.filter(ownProp(record, "exports"), (value) => !HashSet.has(ABSENT_EXPORTS, value));
  return yield* O.match(exports, {
    onNone: () => Effect.map(firstExisting(fs, fallbackCandidates(path, pkgDir, record, subpath)), O.map(O.some)),
    onSome: (value) => probeExports(fs, path, pkgDir, value, subpath),
  });
});

const isPathSpecifier = (path: Path.Path, spec: string): boolean =>
  Str.startsWith("./")(spec) || Str.startsWith("../")(spec) || path.isAbsolute(spec);

/**
 * Resolve an `extends` target to an absolute config path. Relative and rooted
 * specifiers resolve against the extending config's directory; bare
 * specifiers walk up the ancestor `node_modules` chain, skipping ancestors
 * named `node_modules`, and resolve against the first package found.
 *
 * **Details**
 *
 * A package-resolved target is realpathed, matching tsc's `preserveSymlinks: false` module
 * resolution: a workspace package linked under `node_modules` resolves to its real file, so the
 * linked config's own relative `extends` resolves from its real directory. A relative or rooted
 * target is not realpathed; tsc keeps that path as written.
 *
 * Absence is `Option.none()`; a malformed manifest is coerced to an empty one
 * (tsc parity — the candidate's manifest-less lookups still run); a
 * `PlatformError` from the underlying IO flows through. Relative targets try
 * the exact file first (even extensionless), then the `.json`-appended path;
 * there is no directory fallback.
 *
 * The bare-specifier lookup also follows tsc. Slashes are normalized once, and
 * the normalized specifier is what resolves. No `package.json` gate applies:
 * a package without a manifest still has its `tsconfig.json` probed. An
 * `exports` of `null`, `false` or `""` counts as absent (measured against tsgo
 * 7.0.2; `0`, `true`, `{}` and `[]` do not), and a present `exports` blocks
 * every same-package fallback even when it resolves nothing. Without one, a
 * subpath probes the exact file and then its `.json` retry unless the subpath
 * as written already ends in `.json`; the package root tries a non-empty
 * `"tsconfig"` field first (`""` falls through, as tsc's falsy check does), then
 * `<pkg>/tsconfig.json`. A candidate that resolves nothing never shadows a
 * farther ancestor's copy; only an `exports` walk a `null` target ended decides
 * the lookup as unresolved.
 *
 * **Example** (Construct a relative extends lookup)
 *
 * ```ts
 * import { resolveExtendsTarget } from "@beep/repo-tsconfig/internal/extendsTarget";
 * import * as Effect from "effect/Effect";
 *
 * const program = resolveExtendsTarget("./base.json", "/project/tsconfig.json");
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const resolveExtendsTarget: {
  (
    spec: string,
    fromConfigPath: string
  ): Effect.Effect<O.Option<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path>;
  (
    fromConfigPath: string
  ): (spec: string) => Effect.Effect<O.Option<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fnUntraced(function* (
    spec: string,
    fromConfigPath: string
  ): Effect.fn.Return<O.Option<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const fromDir = path.dirname(fromConfigPath);
    const normalized = Str.replace(/\\/g, "/")(spec);

    if (isPathSpecifier(path, normalized)) {
      const abs = path.resolve(fromDir, normalized);
      return yield* firstExisting(fs, withJsonRetry(abs, abs));
    }

    const specifier = parseSpecifier(normalized);
    const ancestors = yield* Walker.ascend(fromDir);
    for (const dir of A.filter(ancestors, (ancestor) => path.basename(ancestor) !== "node_modules")) {
      const decided = yield* tryCandidate(fs, path, dir, specifier);
      if (O.isSome(decided)) return yield* Effect.transposeOption(O.map(decided.value, (found) => fs.realPath(found)));
    }
    return O.none();
  })
);
