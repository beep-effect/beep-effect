/**
 * Package test-typecheck blind-spot lint.
 *
 * A package whose `check` script never typechecks its own `test/` sources has
 * no test-side type coverage: `turbo run check --filter=<pkg>` reports green
 * while a real type error sits in that package's tests. The repo-wide
 * `bun run beep quality test-tsgo` lane is the only net that catches them, and
 * it runs far later than the per-package gate.
 *
 * Two blind-spot shapes exist in the repo, and this lint reports both:
 *
 * - `missing-test-tsconfig` — the package has `test/` sources but owns no
 *   TypeScript project whose `include` reaches that directory.
 * - `unwired-test-tsconfig` — such a project exists (usually
 *   `tsconfig.test.json`), but the package's `check` script never runs it, so
 *   only `beep:audit` or the repo-wide lane would notice a test-side error.
 *
 * Coverage is decided per file, not per glob shape. Every TypeScript source
 * under the package's test tree is enumerated, and the package counts as covered
 * only when each of those files is selected by some project the `check` script
 * runs — `include` matching it, no `exclude` excluding it, exactly as tsc
 * decides program membership. Any file left over is the finding's evidence.
 *
 * Judging real files rather than glob shapes is what makes the promise exact:
 * "every test source is reachable by a typechecking project". Shape heuristics
 * cannot express that, because every partial glob is partial in its own way —
 * a subtree include, a depth-limited `test/*.ts`, or a tail filter such as
 * `test/**\/*.test.ts` that silently skips a helper sitting beside the tests.
 *
 * Enforcement is a fail-on-growth ratchet against
 * `standards/test-typecheck.blindspot-baseline.jsonc`: packages already in the
 * baseline stay green, newly blind packages fail the gate. Packages scaffolded
 * through `beep create-package` or `beep architecture` are compliant by
 * construction — both generators wire `beep:check:tests` into `beep:check`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, normalizePath } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, O, pipe, R, Str, thunkFalse } from "@beep/utils";
import { Console, Effect, FileSystem, flow, HashSet, MutableHashSet, Order, Path } from "effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { formatJsonc, readArtifact, renderTruncatedLines, writeArtifact } from "../../internal/artifacts/index.ts";
import { CliReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { diffMembership, enforceRatchet } from "../../internal/ratchet/index.ts";
import { TestTypecheckBaselineError } from "./Lint.errors.ts";

const $I = $RepoCliId.create("commands/Lint/PackageTestTypecheck");

const defaultBaselinePath = "standards/test-typecheck.blindspot-baseline.jsonc";
const regenerationCommand = "bun run beep lint package-test-typecheck --write-baseline";
const checkCommand = "bun run beep lint package-test-typecheck";
// Mirrors the repo-wide `beep quality test-tsgo` lane's search roots and ignore
// sets so both gates agree on what counts as a package test source.
const packageSearchRoots = ["apps", "infra", "packages"] as const;
const ignoredDirectoryNames = HashSet.fromIterable(["node_modules", "dist", "dist-test", "coverage", "tmp", ".turbo"]);
const testDirectoryName = "test";
const testFixtureSegment = "/test/fixtures/";
const testSourcePattern = /\.(?:cts|mts|ts|tsx)$/u;
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
const newPackageHandling =
  "New packages scaffolded with `beep create-package` or `beep architecture` already wire `beep:check:tests` into `beep:check`; keep new packages out of this baseline rather than regenerating it.";
const baselineHeader = `// Regenerate with: ${regenerationCommand}
// Shrink-only ratchet: a package listed here has test/ sources its own \`check\` script never typechecks.
// Remediate by adding tsconfig.test.json plus a beep:check:tests step wired into beep:check, then regenerate.
// Hand-authored \`notes\` entries are preserved across regeneration; \`findings\` are always regenerated.
`;

/**
 * Shape of a package test-typecheck blind spot.
 *
 * **Example** (Usage)
 * ```ts
 * import { TestTypecheckBlindSpotKind } from "@beep/repo-cli/commands/Lint/PackageTestTypecheck"
 *
 * console.log(TestTypecheckBlindSpotKind.is["missing-test-tsconfig"]("missing-test-tsconfig"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TestTypecheckBlindSpotKind = LiteralKit(["missing-test-tsconfig", "unwired-test-tsconfig"]).pipe(
  $I.annoteSchema("TestTypecheckBlindSpotKind", {
    description:
      "Whether a package owns no test-covering TypeScript project at all, or owns one its check script never runs.",
  })
);

/**
 * Shape of a package test-typecheck blind spot.
 *
 * **Example** (Usage)
 * ```ts
 * import type { TestTypecheckBlindSpotKind } from "@beep/repo-cli/commands/Lint/PackageTestTypecheck"
 *
 * const kind: TestTypecheckBlindSpotKind = "missing-test-tsconfig"
 * console.log(kind) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TestTypecheckBlindSpotKind = typeof TestTypecheckBlindSpotKind.Type;

/**
 * One package whose `check` script never typechecks its `test/` sources.
 *
 * **Example** (Usage)
 * ```ts
 * import { TestTypecheckBlindSpot } from "@beep/repo-cli/commands/Lint/PackageTestTypecheck"
 *
 * const finding = TestTypecheckBlindSpot.make({
 *   package: "@beep/example",
 *   directory: "packages/example",
 *   kind: "missing-test-tsconfig"
 * })
 * console.log(finding.package)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TestTypecheckBlindSpot extends S.Class<TestTypecheckBlindSpot>($I`TestTypecheckBlindSpot`)(
  {
    package: S.String,
    directory: S.String,
    kind: TestTypecheckBlindSpotKind,
  },
  $I.annote("TestTypecheckBlindSpot", {
    description: "A package with test/ sources that its own check script never typechecks.",
  })
) {}

/**
 * Deterministic count summary for a blind-spot baseline or run.
 *
 * **Example** (Usage)
 * ```ts
 * import { TestTypecheckBlindSpotSummary } from "@beep/repo-cli/commands/Lint/PackageTestTypecheck"
 *
 * const summary = TestTypecheckBlindSpotSummary.make({
 *   total_findings: 0,
 *   missing_test_tsconfig: 0,
 *   unwired_test_tsconfig: 0
 * })
 * console.log(summary.total_findings)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TestTypecheckBlindSpotSummary extends S.Class<TestTypecheckBlindSpotSummary>(
  $I`TestTypecheckBlindSpotSummary`
)(
  {
    total_findings: S.Finite,
    missing_test_tsconfig: S.Finite,
    unwired_test_tsconfig: S.Finite,
  },
  $I.annote("TestTypecheckBlindSpotSummary", {
    description: "Deterministic per-kind count summary for test-typecheck blind spots.",
  })
) {}

/**
 * Committed fail-on-growth baseline of test-typecheck blind spots.
 *
 * **Details**
 *
 * Membership is compared by package name alone, so remediating a package
 * half-way (adding `tsconfig.test.json` without wiring it into `check`) shifts
 * its `kind` without registering as a new finding. `notes` is hand-authored
 * rationale keyed by package name and is preserved across regeneration.
 * **Example** (Usage)
 * ```ts
 * import { TestTypecheckBlindSpotBaseline } from "@beep/repo-cli/commands/Lint/PackageTestTypecheck"
 * console.log(TestTypecheckBlindSpotBaseline.fields.schema_version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TestTypecheckBlindSpotBaseline extends S.Class<TestTypecheckBlindSpotBaseline>(
  $I`TestTypecheckBlindSpotBaseline`
)(
  {
    schema_version: S.Literal(1),
    command: S.String,
    regeneration_command: S.String,
    comparison: S.String,
    new_package_handling: S.String,
    notes: S.Record(S.String, S.String),
    check: TestTypecheckBlindSpotSummary,
    findings: S.Array(TestTypecheckBlindSpot),
  },
  $I.annote("TestTypecheckBlindSpotBaseline", {
    description: "Committed shrink-only baseline of packages whose check script skips their test sources.",
  })
) {}

class PackageManifestDocument extends S.Class<PackageManifestDocument>($I`PackageManifestDocument`)(
  {
    name: S.String,
    scripts: S.optionalKey(S.Record(S.String, S.String)),
  },
  $I.annote("PackageManifestDocument", {
    description: "Minimal package.json shape used to resolve a package's name and check-script graph.",
  })
) {}

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

const decodePackageManifest = decodeJsoncTextAs(PackageManifestDocument);
const decodeTsconfigDocument = decodeJsoncTextAs(TsconfigDocument);
const sameBlindSpotPackage = Order.mapInput(Order.String, (finding: TestTypecheckBlindSpot) => finding.package);
const blindSpotOrder = sameBlindSpotPackage;
const samePackage = (left: TestTypecheckBlindSpot, right: TestTypecheckBlindSpot): boolean =>
  left.package === right.package;

const exists = (fs: FileSystem.FileSystem, filePath: string): Effect.Effect<boolean> =>
  fs.exists(filePath).pipe(Effect.orElseSucceed(thunkFalse));

const readOptionalText = (fs: FileSystem.FileSystem, filePath: string): Effect.Effect<O.Option<string>> =>
  fs.readFileString(filePath).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));

// `File`, `Directory`, or none when the path is missing or unreadable. Both
// tree walks classify through this so neither repeats the stat-and-unwrap dance.
const pathTypeOf = (fs: FileSystem.FileSystem, currentPath: string) =>
  fs.stat(currentPath).pipe(Effect.option, Effect.map(O.map((info) => info.type)));

const isDirectoryPath = (fs: FileSystem.FileSystem, currentPath: string): Effect.Effect<boolean> =>
  pathTypeOf(fs, currentPath).pipe(Effect.map(O.match({ onNone: thunkFalse, onSome: (type) => type === "Directory" })));

// Child paths worth descending into: build and vendor directory names are
// pruned here so every walk in this lint agrees on traversal scope.
const walkableChildPaths = Effect.fn("PackageTestTypecheck.walkableChildPaths")(function* (
  currentPath: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(currentPath).pipe(Effect.orElseSucceed(A.empty<string>));

  return pipe(
    entries,
    A.filter((entry) => !HashSet.has(ignoredDirectoryNames, entry)),
    A.map((entry) => path.join(currentPath, entry))
  );
});

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
const makeGlobMatcher = Effect.fn("PackageTestTypecheck.makeGlobMatcher")(function* (
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

const makeGlobMatchers = Effect.fn("PackageTestTypecheck.makeGlobMatchers")(function* (
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

const readTsconfigDocument = Effect.fn("PackageTestTypecheck.readTsconfigDocument")(function* (
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
const inheritedGlobs = Effect.fn("PackageTestTypecheck.inheritedGlobs")(function* (
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
const rejectSourcesSelectedByConfig = Effect.fn("PackageTestTypecheck.rejectSourcesSelectedByConfig")(function* (
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
const packageLocalReferenceConfigs = Effect.fn("PackageTestTypecheck.packageLocalReferenceConfigs")(function* (
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

// Test sources left with no typechecking project after running every given project (and every
// in-package project they reference). Empty means the set of projects covers
// the package's tests; the returned files are the evidence when it does not.
//
// Projects are applied in sequence and each one only sees what is still
// uncovered, so two partial projects that between them select every test source
// count as coverage — that is what running both actually achieves.
const uncoveredTestSources = Effect.fn("PackageTestTypecheck.uncoveredTestSources")(function* (
  packageDir: string,
  configPaths: ReadonlyArray<string>,
  testSources: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const visited = MutableHashSet.empty<string>();

  const visit = Effect.fn("PackageTestTypecheck.uncoveredTestSources.visit")(function* (
    candidate: string,
    remaining: ReadonlyArray<string>
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    if (A.isReadonlyArrayEmpty(remaining)) {
      return remaining;
    }

    const resolved = normalizePath(path.resolve(candidate));

    if (MutableHashSet.has(visited, resolved) || !(yield* exists(fs, resolved))) {
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

const collectPackageDirectories = Effect.fn("PackageTestTypecheck.collectPackageDirectories")(function* (
  searchRoot: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const walk = Effect.fn("PackageTestTypecheck.collectPackageDirectories.walk")(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    if (!(yield* isDirectoryPath(fs, currentPath))) {
      return A.empty<string>();
    }

    const hasManifest = yield* exists(fs, path.join(currentPath, "package.json"));
    const own = hasManifest ? A.of(normalizePath(path.resolve(currentPath))) : A.empty<string>();
    const children = yield* walkableChildPaths(currentPath);
    const nested = yield* Effect.forEach(children, walk, { concurrency: 1 });

    return A.appendAll(own, A.flatten(nested));
  });

  return yield* walk(searchRoot);
});

// Every TypeScript source under a package's test tree, absolute and sorted.
// This is the exact file set coverage is judged against, so the walk's ignore
// rules (build/vendor directories, `test/fixtures/`) define the lint's scope.
const collectTestSources = Effect.fn("PackageTestTypecheck.collectTestSources")(function* (
  testDir: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const walk = Effect.fn("PackageTestTypecheck.collectTestSources.walk")(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    const normalized = normalizePath(currentPath);

    if (pipe(`${normalized}/`, Str.includes(testFixtureSegment))) {
      return A.empty<string>();
    }

    const kind = yield* pathTypeOf(fs, currentPath);

    if (O.isNone(kind)) {
      return A.empty<string>();
    }

    if (kind.value === "File") {
      return testSourcePattern.test(path.basename(currentPath)) ? A.of(normalized) : A.empty<string>();
    }

    if (kind.value !== "Directory") {
      return A.empty<string>();
    }

    const children = yield* walkableChildPaths(currentPath);
    const nested = yield* Effect.forEach(children, walk, { concurrency: 1 });

    return A.flatten(nested);
  });

  return pipe(yield* walk(testDir), A.sort(Order.String));
});

const readPackageManifest = Effect.fn("PackageTestTypecheck.readPackageManifest")(function* (
  packageDir: string
): Effect.fn.Return<O.Option<PackageManifestDocument>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* readOptionalText(fs, path.join(packageDir, "package.json"));

  return yield* pipe(
    text,
    O.match({
      onNone: () => Effect.succeed(O.none<PackageManifestDocument>()),
      onSome: (content) => decodePackageManifest(content).pipe(Effect.option),
    })
  );
});

// Whether the package's own `check` entry point typechecks its test directory.
// This is the blind spot the lint exists to find: everything the flattened
// check-script graph compiles is probed, nothing else.
// Test sources the package's own `check` entry point never typechecks. Empty
// means `turbo run check --filter=<pkg>` really does gate this package's tests.
const uncoveredByCheckScript = Effect.fn("PackageTestTypecheck.uncoveredByCheckScript")(function* (
  packageDir: string,
  scripts: Readonly<Record<string, string>>,
  testSources: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const configPaths = pipe(
    referencedProjectConfigs(flattenScriptCommand({ scripts, entry: "check" })),
    A.map((config) => path.join(packageDir, config))
  );

  return yield* uncoveredTestSources(packageDir, configPaths, testSources);
});

// Whether the package owns any test-covering project at all, wired or not. This
// separates the two blind-spot kinds: a package with no such project is missing
// one, a package with one has it unwired from `check`.
// Whether the package owns projects that together select every test source,
// wired into `check` or not. This separates the two blind-spot kinds: a package
// with no such project is missing one, a package with one has it unwired.
const packageOwnsTestProject = Effect.fn("PackageTestTypecheck.packageOwnsTestProject")(function* (
  packageDir: string,
  testDir: string,
  testSources: ReadonlyArray<string>
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const candidates = pipe(
    yield* fs.readDirectory(packageDir).pipe(Effect.orElseSucceed(A.empty<string>)),
    A.filter((entry) => Str.startsWith("tsconfig")(entry) && Str.endsWith(".json")(entry)),
    A.map((entry) => path.join(packageDir, entry)),
    A.append(path.join(testDir, "tsconfig.json")),
    A.sort(Order.String)
  );

  return A.isReadonlyArrayEmpty(yield* uncoveredTestSources(packageDir, candidates, testSources));
});

const packageBlindSpot = Effect.fn("PackageTestTypecheck.packageBlindSpot")(function* (
  repoRoot: string,
  packageDir: string
): Effect.fn.Return<O.Option<TestTypecheckBlindSpot>, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const testDir = normalizePath(path.join(packageDir, testDirectoryName));
  const testSources = yield* collectTestSources(testDir);

  if (A.isReadonlyArrayEmpty(testSources)) {
    return O.none();
  }

  const manifest = yield* readPackageManifest(packageDir);

  if (O.isNone(manifest) || Str.isEmpty(manifest.value.name)) {
    return O.none();
  }

  const scripts = manifest.value.scripts ?? R.empty<string, string>();

  if (A.isReadonlyArrayEmpty(yield* uncoveredByCheckScript(packageDir, scripts, testSources))) {
    return O.none();
  }

  const ownsTestProject = yield* packageOwnsTestProject(packageDir, testDir, testSources);

  return O.some(
    TestTypecheckBlindSpot.make({
      package: manifest.value.name,
      directory: normalizePath(path.relative(repoRoot, packageDir)),
      kind: ownsTestProject ? "unwired-test-tsconfig" : "missing-test-tsconfig",
    })
  );
});

/**
 * Scan the repository for packages whose `check` script skips their test sources.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { collectTestTypecheckBlindSpots } from "@beep/repo-cli/commands/Lint/PackageTestTypecheck"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(collectTestTypecheckBlindSpots("/repo")))
 * ```
 *
 * @param repoRoot - Absolute repository root directory.
 * @returns Effect yielding the blind spots, ordered by package name.
 * @category use-cases
 * @since 0.0.0
 */
export const collectTestTypecheckBlindSpots = Effect.fn("PackageTestTypecheck.collectTestTypecheckBlindSpots")(
  function* (
    repoRoot: string
  ): Effect.fn.Return<ReadonlyArray<TestTypecheckBlindSpot>, never, FileSystem.FileSystem | Path.Path> {
    const path = yield* Path.Path;
    const packageDirs = yield* pipe(
      packageSearchRoots,
      Effect.forEach((root) => collectPackageDirectories(path.join(repoRoot, root)), { concurrency: 1 }),
      Effect.map(A.flatten)
    );

    return yield* pipe(
      packageDirs,
      Effect.forEach((packageDir) => packageBlindSpot(repoRoot, packageDir), { concurrency: 1 }),
      Effect.map(A.getSomes),
      Effect.map(A.sort(blindSpotOrder))
    );
  }
);

const countKind = (findings: ReadonlyArray<TestTypecheckBlindSpot>, kind: TestTypecheckBlindSpotKind): number =>
  pipe(
    findings,
    A.filter((finding) => finding.kind === kind),
    A.length
  );

const makeBaseline = (input: {
  readonly findings: ReadonlyArray<TestTypecheckBlindSpot>;
  readonly notes: Readonly<Record<string, string>>;
}): TestTypecheckBlindSpotBaseline =>
  TestTypecheckBlindSpotBaseline.make({
    schema_version: 1,
    command: checkCommand,
    regeneration_command: regenerationCommand,
    comparison: "fail-on-growth: every blind-spot package must already be listed in the committed baseline",
    new_package_handling: newPackageHandling,
    notes: input.notes,
    check: TestTypecheckBlindSpotSummary.make({
      total_findings: A.length(input.findings),
      missing_test_tsconfig: countKind(input.findings, "missing-test-tsconfig"),
      unwired_test_tsconfig: countKind(input.findings, "unwired-test-tsconfig"),
    }),
    findings: input.findings,
  });

const readBaseline = Effect.fn("PackageTestTypecheck.readBaseline")(function* (
  baselineAbsolutePath: string,
  baselinePath: string
): Effect.fn.Return<TestTypecheckBlindSpotBaseline, TestTypecheckBaselineError, FileSystem.FileSystem> {
  return yield* readArtifact({
    path: baselineAbsolutePath,
    schema: TestTypecheckBlindSpotBaseline,
    onReadError: (cause) => TestTypecheckBaselineError.new(cause, `Failed to read ${baselinePath}.`),
    onDecodeError: (cause) => TestTypecheckBaselineError.new(cause, `Failed to decode ${baselinePath}.`),
  });
});

const renderFinding = (finding: TestTypecheckBlindSpot): string =>
  `  - ${finding.package} (${finding.directory}) [${finding.kind}]`;

const renderFindingLines = (findings: ReadonlyArray<TestTypecheckBlindSpot>): ReadonlyArray<string> =>
  renderTruncatedLines({ items: findings, render: renderFinding, limit: 25 });

/**
 * Options accepted by {@link runPackageTestTypecheckLint}.
 *
 * **Example** (Usage)
 * ```ts
 * import { PackageTestTypecheckOptions } from "@beep/repo-cli/commands/Lint/PackageTestTypecheck"
 *
 * const options = PackageTestTypecheckOptions.make({
 *   baselinePath: "standards/test-typecheck.blindspot-baseline.jsonc",
 *   writeBaseline: false
 * })
 * console.log(options.writeBaseline)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageTestTypecheckOptions extends S.Class<PackageTestTypecheckOptions>($I`PackageTestTypecheckOptions`)(
  {
    baselinePath: S.String,
    writeBaseline: S.Boolean,
  },
  $I.annote("PackageTestTypecheckOptions", {
    description: "Options accepted by the package test-typecheck lint: baseline location and write mode.",
  })
) {}

/**
 * Enforce or refresh the committed test-typecheck blind-spot baseline.
 *
 * **Example** (Usage)
 *
 * ```ts
 * import { runPackageTestTypecheckLint } from "@beep/repo-cli/commands/Lint/PackageTestTypecheck"
 * import { Effect } from "effect"
 *
 * const program = runPackageTestTypecheckLint({
 *   baselinePath: "standards/test-typecheck.blindspot-baseline.jsonc",
 *   writeBaseline: false
 * })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param options - Baseline path and write mode.
 * @returns Effect that fails only when a package not already in the baseline is blind.
 * @category use-cases
 * @since 0.0.0
 */
export const runPackageTestTypecheckLint = Effect.fn("PackageTestTypecheck.runPackageTestTypecheckLint")(function* ({
  baselinePath,
  writeBaseline: shouldWriteBaseline,
}: PackageTestTypecheckOptions): Effect.fn.Return<
  void,
  TestTypecheckBaselineError | CliReportedExit,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const repoRoot = normalizePath(path.resolve(process.cwd()));
  const baselineAbsolutePath = path.resolve(repoRoot, baselinePath);
  const current = yield* collectTestTypecheckBlindSpots(repoRoot);

  if (shouldWriteBaseline) {
    const existingNotes = yield* readBaseline(baselineAbsolutePath, baselinePath).pipe(
      Effect.map((baseline) => baseline.notes),
      Effect.orElseSucceed(R.empty<string, string>)
    );
    const body = yield* formatJsonc(makeBaseline({ findings: current, notes: existingNotes })).pipe(
      TestTypecheckBaselineError.mapError(`Failed to encode ${baselinePath}.`)
    );

    yield* writeArtifact({
      path: baselineAbsolutePath,
      header: baselineHeader,
      body,
      onError: (cause) => TestTypecheckBaselineError.new(cause, `Failed to write ${baselinePath}.`),
    });
    yield* Console.log(`[package-test-typecheck] wrote ${baselinePath} with ${A.length(current)} finding(s)`);
    return;
  }

  const baseline = yield* readBaseline(baselineAbsolutePath, baselinePath);
  const diff = diffMembership({
    current,
    baseline: pipe(baseline.findings, A.dedupeWith(samePackage), A.sort(blindSpotOrder)),
    equivalence: samePackage,
    order: blindSpotOrder,
  });

  yield* enforceRatchet({
    regressions: [
      {
        present: A.isReadonlyArrayNonEmpty(diff.introduced),
        lines: [
          `[package-test-typecheck] regression: ${A.length(diff.introduced)} package(s) have test/ sources their check script never typechecks and are not listed in ${baselinePath}`,
          ...renderFindingLines(diff.introduced),
          "[package-test-typecheck] add tsconfig.test.json plus a beep:check:tests step wired into beep:check (see packages/drivers/tika),",
          `[package-test-typecheck] or regenerate with: ${regenerationCommand}`,
        ],
        error: CliReportedExit.make({
          message: "package-test-typecheck: test-typecheck blind-spot baseline grew.",
          exitCode: 1,
        }),
      },
    ],
    okLine: `[package-test-typecheck] ok: current=${diff.currentCount} baseline=${diff.baselineCount} introduced=0`,
    tighten: pipe(
      diff.resolved,
      O.liftPredicate(A.isReadonlyArrayNonEmpty),
      O.map((resolved) => [
        `[package-test-typecheck] tighten-baseline: ${A.length(resolved)} baseline package(s) now typecheck their tests`,
        ...renderFindingLines(resolved),
        `[package-test-typecheck] regenerate with: ${regenerationCommand}`,
      ])
    ),
  });
});

/**
 * Repo-relative location of the committed blind-spot baseline consumed when
 * `--baseline` is not passed.
 *
 * **Example** (Usage)
 * ```ts
 * import { defaultTestTypecheckBaselinePath } from "@beep/repo-cli/commands/Lint/PackageTestTypecheck"
 *
 * console.log(defaultTestTypecheckBaselinePath)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const defaultTestTypecheckBaselinePath = defaultBaselinePath;

/**
 * `bun run beep lint package-test-typecheck` — gate packages whose `check`
 * script never typechecks their own test sources.
 *
 * **Example** (Usage)
 * ```ts
 * console.log("bun run beep lint package-test-typecheck")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintPackageTestTypecheckCommand = Command.make(
  "package-test-typecheck",
  {
    baseline: Flag.string("baseline").pipe(
      Flag.withDefault(defaultBaselinePath),
      Flag.withDescription("Committed test-typecheck blind-spot baseline JSONC path")
    ),
    writeBaseline: Flag.boolean("write-baseline").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Rewrite the blind-spot baseline from the current scan, preserving hand-authored notes")
    ),
  },
  ({ baseline, writeBaseline }) => runPackageTestTypecheckLint({ baselinePath: baseline, writeBaseline })
).pipe(Command.withDescription("Gate packages whose check script never typechecks their own test/ sources"));
