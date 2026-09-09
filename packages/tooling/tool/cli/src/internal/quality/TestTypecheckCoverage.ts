/**
 * Whether a package's own `check` script typechecks a given set of its test sources.
 *
 * Two gates ask this question. `beep lint package-test-typecheck` scans every
 * package and reports the ones whose `check` graph skips their `test/` tree
 * (the blind-spot baseline). `beep quality test-tsgo` compiles test files
 * repo-wide and, since the quality-lane audit of 2026-09-09 (D1), skips the
 * packages this predicate already proves covered, so the lane is the net under
 * the baseline rather than a second compile of every package. One module
 * answers both so the two gates cannot disagree about what "covered" means.
 *
 * **Details**
 *
 * Coverage is judged per file against the projects a flattened `check`
 * script would compile: a source is covered when some resolved `include` of
 * one of those projects (or an in-package project reference) selects it and
 * no `exclude` rejects it, mirroring tsc. Projects are applied in sequence and
 * each one only sees what is still uncovered, so two partial projects that
 * between them select every test source count as coverage — that is what
 * running both actually achieves.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { normalizePath } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, O, pipe, R, Str, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, flow, MutableHashSet, Path } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/quality/TestTypecheckCoverage");

const wildcardPattern = /[*?]/u;
const recursiveGlobSegment = "**";
// `bun run [flags] <script>`. Flags between `run` and the script name are
// skipped so delegation is still followed through `--silent`, `--if-present`,
// `--filter=<pkg>`, `--bun`, and friends. `--cwd`/`--config`/`--env-file` take
// their value as a separate token, so those are consumed as a pair before the
// generic single-token flag alternative can mistake the value for the script.
// (`bun run-script` is not used anywhere in this repo, so it is not accepted.)
const scriptReferencePattern =
  /\bbun\s+run\s+(?:(?:--(?:cwd|config|env-file)\s+\S+|--?[\w-]+(?:=\S+)?)\s+)*([\w:.-]+)/gu;
const projectFlagPattern = /(?:^|\s)(?:-p|--project|-b|--build)(?:=|\s+)([^\s]+)/gu;
const typescriptProgramPattern = /^\s*(?:(?:env\s+)?(?:[^\s=]+=[^\s]+\s+)*)(?:bunx\s+)?(?:tsgo|tsc)\b/u;
const commandSeparatorPattern = /&&|\|\||;|\|/u;
const defaultProjectFileName = "tsconfig.json";
const checkScriptName = "check";

class TsconfigReference extends S.Class<TsconfigReference>($I`TsconfigReference`)(
  {
    path: S.String,
  },
  $I.annote("TsconfigReference", {
    description: "One TypeScript project reference entry.",
  })
) {}

const TsconfigExtends = S.Union([S.String, S.String.pipe(S.Array)]);
const TsconfigIncludes = S.String.pipe(S.Array);
const TsconfigReferences = TsconfigReference.pipe(S.Array);

class TsconfigDocument extends S.Class<TsconfigDocument>($I`TsconfigDocument`)(
  {
    extends: S.optionalKey(TsconfigExtends),
    include: S.optionalKey(TsconfigIncludes),
    exclude: S.optionalKey(TsconfigIncludes),
    references: S.optionalKey(TsconfigReferences),
  },
  $I.annote("TsconfigDocument", {
    description: "Minimal tsconfig shape used to decide which files a project's include and exclude globs select.",
  })
) {}

const decodeTsconfigDocument = decodeJsoncTextAs(TsconfigDocument);

/**
 * What one package's `check` script proves about a set of its test sources.
 *
 * **Details**
 *
 * `projectConfigs` are the absolute tsconfig paths the flattened `check`
 * script compiles; `uncoveredSources` are the given test sources none of them
 * (nor any in-package project they reference) selects. An empty
 * `uncoveredSources` means running `check` really does typecheck those files.
 *
 * **Example** (Read a coverage verdict)
 *
 * ```ts
 * import { TestTypecheckCoverage } from "@beep/repo-cli/test/SharedInternals"
 *
 * const coverage = TestTypecheckCoverage.make({
 *   packageDir: "/repo/packages/example",
 *   projectConfigs: ["/repo/packages/example/tsconfig.check.json"],
 *   uncoveredSources: [],
 * })
 * console.log(coverage.covered) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TestTypecheckCoverage extends S.Class<TestTypecheckCoverage>($I`TestTypecheckCoverage`)(
  {
    packageDir: S.String,
    projectConfigs: S.Array(S.String),
    uncoveredSources: S.Array(S.String),
  },
  $I.annote("TestTypecheckCoverage", {
    description: "Which of a package's test sources its own check script leaves untypechecked.",
  })
) {
  /** Whether every judged test source is typechecked by the package's `check` script. */
  get covered(): boolean {
    return A.isReadonlyArrayEmpty(this.uncoveredSources);
  }
}

/**
 * `true` when the path exists; missing and unreadable paths both read as absent.
 *
 * **Example** (Probe a path)
 *
 * ```ts
 * import { pathExists } from "@beep/repo-cli/test/SharedInternals"
 * import { Effect, FileSystem } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   return yield* pathExists(fs, "/repo/tsconfig.json")
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param fs - File system service.
 * @param filePath - Absolute path to probe.
 * @returns Whether the path exists.
 * @category filesystem
 * @since 0.0.0
 */
export const pathExists: {
  (fs: FileSystem.FileSystem, filePath: string): Effect.Effect<boolean>;
  (filePath: string): (fs: FileSystem.FileSystem) => Effect.Effect<boolean>;
} = dual(
  2,
  (fs: FileSystem.FileSystem, filePath: string): Effect.Effect<boolean> =>
    fs.exists(filePath).pipe(Effect.orElseSucceed(thunkFalse))
);

/**
 * The file's text, or `None` when it is missing or unreadable.
 *
 * **Example** (Read an optional file)
 *
 * ```ts
 * import { readOptionalText } from "@beep/repo-cli/test/SharedInternals"
 * import { Effect, FileSystem } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   return yield* readOptionalText(fs, "/repo/tsconfig.json")
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param fs - File system service.
 * @param filePath - Absolute path to read.
 * @returns The file contents when present.
 * @category filesystem
 * @since 0.0.0
 */
export const readOptionalText: {
  (fs: FileSystem.FileSystem, filePath: string): Effect.Effect<O.Option<string>>;
  (filePath: string): (fs: FileSystem.FileSystem) => Effect.Effect<O.Option<string>>;
} = dual(
  2,
  (fs: FileSystem.FileSystem, filePath: string): Effect.Effect<O.Option<string>> =>
    fs.readFileString(filePath).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>))
);

/**
 * `File`, `Directory`, or `None` when the path is missing or unreadable.
 *
 * **Example** (Classify a path)
 *
 * ```ts
 * import { pathTypeOf } from "@beep/repo-cli/test/SharedInternals"
 * import { Effect, FileSystem } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   return yield* pathTypeOf(fs, "/repo/packages")
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param fs - File system service.
 * @param currentPath - Absolute path to classify.
 * @returns The file type when the path can be stat'ed.
 * @category filesystem
 * @since 0.0.0
 */
export const pathTypeOf: {
  (fs: FileSystem.FileSystem, currentPath: string): Effect.Effect<O.Option<FileSystem.File.Type>>;
  (currentPath: string): (fs: FileSystem.FileSystem) => Effect.Effect<O.Option<FileSystem.File.Type>>;
} = dual(
  2,
  (fs: FileSystem.FileSystem, currentPath: string): Effect.Effect<O.Option<FileSystem.File.Type>> =>
    fs.stat(currentPath).pipe(Effect.option, Effect.map(O.map((info) => info.type)))
);

/**
 * `true` when the path is a directory; missing paths read as `false`.
 *
 * **Example** (Probe a directory)
 *
 * ```ts
 * import { isDirectoryPath } from "@beep/repo-cli/test/SharedInternals"
 * import { Effect, FileSystem } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   return yield* isDirectoryPath(fs, "/repo/packages")
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param fs - File system service.
 * @param currentPath - Absolute path to probe.
 * @returns Whether the path is a directory.
 * @category filesystem
 * @since 0.0.0
 */
export const isDirectoryPath: {
  (fs: FileSystem.FileSystem, currentPath: string): Effect.Effect<boolean>;
  (currentPath: string): (fs: FileSystem.FileSystem) => Effect.Effect<boolean>;
} = dual(
  2,
  (fs: FileSystem.FileSystem, currentPath: string): Effect.Effect<boolean> =>
    pathTypeOf(fs, currentPath).pipe(
      Effect.map(O.match({ onNone: thunkFalse, onSome: (type) => type === "Directory" }))
    )
);

const capturedGroups = (pattern: RegExp, text: string): ReadonlyArray<string> =>
  pipe(
    A.fromIterable(Str.matchAll(pattern)(text)),
    A.map((match) => pipe(A.get(match, 1), O.filter(Str.isNonEmpty))),
    A.getSomes
  );

// Translate one tsconfig glob segment into regex source. Regex metacharacters
// are escaped first so only `*` and `?` keep their glob meaning, and neither
// crosses a path separator.
const globSegmentSource: (segment: string) => string = flow(
  Str.replace(/[.+^${}()|[\]\\]/g, "\\$&"),
  Str.replaceAll("*", "[^/]*"),
  Str.replaceAll("?", "[^/]")
);

// Translate a resolved tsconfig glob into a whole-path matcher.
//
// Semantics verified against this repo's tsgo rather than inferred from the
// docs. Files were placed under `test/` at several depths and extensions; this
// is which ones each entry actually typechecked:
//
//   test               every file at every depth, every TS extension
//                      (a bare directory path is a recursive subtree include)
//   test/**/*          every file at every depth
//   test/**/*.ts       every depth, but NOT .mts and NOT .tsx
//   test/**/*.test.ts  only the .test.ts files — helpers alongside them are NOT
//                      typechecked, at any depth
//   test/*.ts          depth 1 only
//   test/*/*.ts        exactly one directory down
//   test/**            NOTHING — a trailing `**` matches no files at all
//
// `**` therefore matches zero or more directories (depth-1 files match
// `test/**/*.ts`), and a trailing `**` with no file segment after it matches
// nothing. Both fall out of emitting `(?:[^/]+/)*` for a `**` segment: it
// consumes its own separator, so as a final segment the pattern can only match
// a path ending in `/`, which no file does.
const globToRegExp = (glob: string): RegExp => {
  const segments = Str.split("/")(glob);
  const lastIndex = A.length(segments) - 1;
  const source = pipe(
    segments,
    A.map((segment, index) =>
      segment === recursiveGlobSegment
        ? "(?:[^/]+/)*"
        : `${globSegmentSource(segment)}${index === lastIndex ? "" : "/"}`
    ),
    A.join("")
  );

  return new RegExp(`^${source}$`, "u");
};

// Build a matcher for one resolved `include`/`exclude` entry. A wildcard-free
// entry naming a directory covers that whole subtree (verified above); any other
// wildcard-free entry names a single file.
const makeGlobMatcher = Effect.fn("TestTypecheckCoverage.makeGlobMatcher")(function* (
  entry: string
): Effect.fn.Return<(filePath: string) => boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;

  if (wildcardPattern.test(entry)) {
    const pattern = globToRegExp(entry);
    return (filePath: string) => pattern.test(filePath);
  }

  const directory = yield* isDirectoryPath(fs, entry);

  return directory
    ? (filePath: string) => Str.startsWith(`${entry}/`)(filePath)
    : (filePath: string) => filePath === entry;
});

const makeGlobMatchers = Effect.fn("TestTypecheckCoverage.makeGlobMatchers")(function* (
  entries: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<(filePath: string) => boolean>, never, FileSystem.FileSystem> {
  return yield* Effect.forEach(entries, makeGlobMatcher, { concurrency: 1 });
});

// Flatten a package script with every script it transitively invokes through
// `bun run`. `check` almost always delegates (check -> beep:check ->
// beep:check:tests), so coverage can only be judged on the flattened text;
// self-referential script graphs terminate on the visited set.
const flattenScriptCommand = (input: {
  readonly scripts: Readonly<Record<string, string>>;
  readonly entry: string;
}): string => {
  const visited = MutableHashSet.empty<string>();

  const collect = (name: string): ReadonlyArray<string> => {
    if (MutableHashSet.has(visited, name)) {
      return A.empty<string>();
    }
    MutableHashSet.add(visited, name);

    return pipe(
      R.get(input.scripts, name),
      O.match({
        onNone: A.empty<string>,
        onSome: (command) =>
          A.appendAll(A.of(command), pipe(capturedGroups(scriptReferencePattern, command), A.flatMap(collect))),
      })
    );
  };

  return A.join(collect(input.entry), " && ");
};

// TypeScript project configs a flattened command would compile. Only segments
// that actually invoke tsc/tsgo count, so unrelated tooling flags never
// register; an invocation with no explicit -p/-b compiles tsconfig.json, as tsc
// does.
const referencedProjectConfigs = (command: string): ReadonlyArray<string> =>
  pipe(
    Str.split(commandSeparatorPattern)(command),
    A.filter((segment) => typescriptProgramPattern.test(segment)),
    A.flatMap((segment) =>
      pipe(capturedGroups(projectFlagPattern, segment), (configs) =>
        A.isReadonlyArrayNonEmpty(configs) ? configs : A.of(defaultProjectFileName)
      )
    ),
    A.dedupe
  );

const readTsconfigDocument = Effect.fn("TestTypecheckCoverage.readTsconfigDocument")(function* (
  configPath: string
): Effect.fn.Return<O.Option<TsconfigDocument>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;

  return yield* pipe(
    readOptionalText(fs, configPath),
    Effect.flatMap(
      O.match({
        onNone: () => Effect.succeed(O.none<TsconfigDocument>()),
        onSome: (text) => decodeTsconfigDocument(text).pipe(Effect.option),
      })
    )
  );
});

// Resolve a config's `include` or `exclude` globs to absolute paths, walking
// the `extends` chain until one is declared (tsconfig inherits both fields).
const inheritedGlobs = Effect.fn("TestTypecheckCoverage.inheritedGlobs")(function* (
  configPath: string,
  field: "include" | "exclude",
  visited: MutableHashSet.MutableHashSet<string>
): Effect.fn.Return<O.Option<ReadonlyArray<string>>, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const resolved = normalizePath(path.resolve(configPath));

  if (MutableHashSet.has(visited, resolved)) {
    return O.none();
  }
  MutableHashSet.add(visited, resolved);

  const document = yield* readTsconfigDocument(resolved);

  if (O.isNone(document)) {
    return O.none();
  }

  const own = document.value[field];

  if (own !== undefined) {
    return O.some(
      pipe(
        own,
        A.map((glob) => normalizePath(path.resolve(path.dirname(resolved), glob)))
      )
    );
  }

  const parents = pipe(
    O.fromUndefinedOr(document.value.extends),
    O.map((value) => (Str.isString(value) ? A.of(value) : value)),
    O.getOrElse(A.empty<string>)
  );

  for (const parent of parents) {
    // Package-manager-resolved bases (`@tsconfig/...`) never carry globs that
    // select a package's test sources, so only relative bases are walked.
    if (!Str.startsWith(".")(parent)) {
      continue;
    }

    const inherited = yield* inheritedGlobs(path.resolve(path.dirname(resolved), parent), field, visited);

    if (O.isSome(inherited)) {
      return inherited;
    }
  }

  return O.none();
});

// Narrow a set of test sources to those one resolved project does NOT select.
//
// A file is selected when some `include` matches it and no `exclude` does,
// mirroring tsc. An `include` absent across the whole extends chain means tsc's
// default of everything under the config directory. `exclude` defaults
// (node_modules, outDir, ...) are not consulted: none of them can name a file
// under a package's `test/` tree, so they cannot change this answer.
const rejectSourcesSelectedByConfig = Effect.fn("TestTypecheckCoverage.rejectSourcesSelectedByConfig")(function* (
  resolvedConfig: string,
  sources: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const includes = yield* inheritedGlobs(resolvedConfig, "include", MutableHashSet.empty<string>());
  const excludes = yield* inheritedGlobs(resolvedConfig, "exclude", MutableHashSet.empty<string>());
  const configDirectory = normalizePath(path.dirname(resolvedConfig));
  const includeMatchers = yield* O.match(includes, {
    onNone: () => Effect.succeed(A.of((filePath: string) => Str.startsWith(`${configDirectory}/`)(filePath))),
    onSome: makeGlobMatchers,
  });
  const excludeMatchers = yield* O.match(excludes, {
    onNone: () => Effect.succeed(A.empty<(filePath: string) => boolean>()),
    onSome: makeGlobMatchers,
  });

  return A.filter(
    sources,
    (source) =>
      !(A.some(includeMatchers, (matches) => matches(source)) && !A.some(excludeMatchers, (matches) => matches(source)))
  );
});

// Project references that stay inside the package: `tsgo -b tsconfig.json`
// builds those, so they can carry the test include. References to sibling
// packages point at another package's sources and never can.
const packageLocalReferenceConfigs = Effect.fn("TestTypecheckCoverage.packageLocalReferenceConfigs")(function* (
  document: TsconfigDocument,
  resolvedConfig: string,
  packageDir: string
): Effect.fn.Return<ReadonlyArray<string>, never, Path.Path> {
  const path = yield* Path.Path;

  return pipe(
    document.references ?? A.empty<TsconfigReference>(),
    A.map((reference) => normalizePath(path.resolve(path.dirname(resolvedConfig), reference.path))),
    A.filter((referenced) => Str.startsWith(`${packageDir}/`)(referenced)),
    A.map((referenced) => (Str.endsWith(".json")(referenced) ? referenced : path.join(referenced, "tsconfig.json")))
  );
});

/**
 * Test sources left with no typechecking project after running every given
 * project (and every in-package project they reference).
 *
 * **Details**
 *
 * Empty means the set of projects covers the given sources; the returned
 * files are the evidence when it does not. Projects are applied in sequence
 * and each one only sees what is still uncovered, so two partial projects that
 * between them select every test source count as coverage.
 *
 * **Example** (Judge a package's projects)
 *
 * ```ts
 * import { uncoveredTestSources } from "@beep/repo-cli/test/SharedInternals"
 * import { Effect } from "effect"
 *
 * const program = uncoveredTestSources(
 *   "/repo/packages/example",
 *   ["/repo/packages/example/tsconfig.json"],
 *   ["/repo/packages/example/test/example.test.ts"]
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param packageDir - Absolute, normalized package directory.
 * @param configPaths - Absolute tsconfig paths to apply, in order.
 * @param testSources - Absolute, normalized test source paths to judge.
 * @returns The sources none of the projects select.
 * @category use-cases
 * @since 0.0.0
 */
export const uncoveredTestSources = Effect.fn("TestTypecheckCoverage.uncoveredTestSources")(function* (
  packageDir: string,
  configPaths: ReadonlyArray<string>,
  testSources: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const visited = MutableHashSet.empty<string>();

  const visit = Effect.fn("TestTypecheckCoverage.uncoveredTestSources.visit")(function* (
    candidate: string,
    remaining: ReadonlyArray<string>
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    if (A.isReadonlyArrayEmpty(remaining)) {
      return remaining;
    }

    const resolved = normalizePath(path.resolve(candidate));

    if (MutableHashSet.has(visited, resolved) || !(yield* pathExists(fs, resolved))) {
      return remaining;
    }
    MutableHashSet.add(visited, resolved);

    const document = yield* readTsconfigDocument(resolved);

    if (O.isNone(document)) {
      return remaining;
    }

    let next = yield* rejectSourcesSelectedByConfig(resolved, remaining);

    for (const reference of yield* packageLocalReferenceConfigs(document.value, resolved, packageDir)) {
      next = yield* visit(reference, next);
    }

    return next;
  });

  let remaining = testSources;

  for (const configPath of configPaths) {
    remaining = yield* visit(configPath, remaining);

    if (A.isReadonlyArrayEmpty(remaining)) {
      return remaining;
    }
  }

  return remaining;
});

/**
 * Judge which of a package's test sources its own `check` script typechecks.
 *
 * **Details**
 *
 * The `check` entry point is flattened through every `bun run` delegation it
 * makes (`check -> beep:check -> beep:check:tests`), the tsc/tsgo projects that
 * text compiles are collected, and each given source is checked against them
 * with {@link uncoveredTestSources}. Sources are normalized before judging so
 * callers may pass either raw absolute paths or already-normalized ones.
 *
 * **Example** (Ask whether a package covers its tests)
 *
 * ```ts
 * import { checkScriptTestTypecheckCoverage } from "@beep/repo-cli/test/SharedInternals"
 * import { Effect } from "effect"
 *
 * const program = checkScriptTestTypecheckCoverage(
 *   "/repo/packages/example",
 *   { check: "tsgo -p tsconfig.check.json" },
 *   ["/repo/packages/example/test/example.test.ts"]
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param packageDir - Absolute package directory.
 * @param scripts - The package manifest's scripts block.
 * @param testSources - Absolute test source paths owned by the package.
 * @returns The coverage verdict for those sources.
 * @category use-cases
 * @since 0.0.0
 */
export const checkScriptTestTypecheckCoverage = Effect.fn("TestTypecheckCoverage.checkScriptTestTypecheckCoverage")(
  function* (
    packageDir: string,
    scripts: Readonly<Record<string, string>>,
    testSources: ReadonlyArray<string>
  ): Effect.fn.Return<TestTypecheckCoverage, never, FileSystem.FileSystem | Path.Path> {
    const path = yield* Path.Path;
    const normalizedPackageDir = normalizePath(path.resolve(packageDir));
    const projectConfigs = pipe(
      referencedProjectConfigs(flattenScriptCommand({ scripts, entry: checkScriptName })),
      A.map((config) => normalizePath(path.resolve(normalizedPackageDir, config)))
    );
    const normalizedSources = A.map(testSources, (source) => normalizePath(path.resolve(source)));

    return TestTypecheckCoverage.make({
      packageDir: normalizedPackageDir,
      projectConfigs,
      uncoveredSources: yield* uncoveredTestSources(normalizedPackageDir, projectConfigs, normalizedSources),
    });
  }
);
