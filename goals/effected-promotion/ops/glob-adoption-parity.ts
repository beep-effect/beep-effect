/**
 * Glob adoption parity (roadmap PR R2b, map sites #57, #59, #263, #305).
 *
 * R2b retires two glob owners in repo-cli in favour of the promoted kit:
 *
 * - `internal/GlobPattern.ts`, a hand-rolled `**`/`*` compiler whose six callers (Docgen `JsDocAnalysis` and
 *   `Quality.subjects`, Quality `JSDocDocumentationInventory`, `CoverageScope` and `Tasks`, Cache `Cache.census`)
 *   now match through `@beep/glob` `GlobPattern` compiled with `dot: true, nonegate: true, nocomment: true` (the
 *   old compiler matched dot segments and read a leading `!` or `#` as an ordinary character);
 * - the `tinyglobby` walk in `Laws/EffectImports.ts`, now `@beep/walker` `compileAndExpand` plus an exclusion
 *   filter through `@beep/glob`.
 *
 * Two oracles, as the wave-4 plan names them:
 *
 * 1. **Pattern-literal parity.** The pre-R2b compiler is frozen below (`oldGlobPatternToRegExp`, byte-for-byte
 *    from origin/main ed0c4ec45e) and compared with the kit matcher over every (pattern, candidate) pair each
 *    caller can see in the live tree: every `docgen.json` `exclude` pattern against that package's tracked source
 *    files (both the package-relative and `srcDir`-relative spellings the Docgen callers test); the CoverageScope
 *    repository-fixture owner patterns against every tracked path; coverage selectors derived from every workspace
 *    name and directory against those names and directories (after the `Tasks.ts` selector normalisation); and
 *    every Turbo `env`/`passThroughEnv` entry against every environment variable name those entries mention plus
 *    `BIOME_CONFIG_PATH`. A fixed set of `!`- and `#`-prefixed patterns (`dialectPrefixes`) pins the dialect
 *    choice itself: no live pattern carries either prefix, so only this synthetic set would catch a matcher that
 *    read them as negation or comment. Every disagreement is reported; the gate is zero. A second synthetic
 *    section (`dialectMagic`) records where the two dialects are KNOWN to differ: `?`, `[..]`, `{a,b}`, `+(..)`,
 *    `\` and an in-segment `**` (`src/**.ts`) were literal characters to the old compiler and carry minimatch
 *    meaning in the kit. Each case states both expected answers; the gate is that every observed pair matches its
 *    expectation (no live pattern uses any of these characters, so the live sections cannot see the shift).
 * 2. **EffectImports file-set parity.** The three discovery sets a run can read (`code` sources, `markdown`-mode
 *    foundation sources, `markdown` documents) are listed through the exported discovery functions and
 *    fingerprinted (count, sha256 of the sorted newline-joined list, per-top-level-directory histogram). Run once
 *    before the switch (`--out`, with `--list-dir <dir>` writing each full list), then after it with
 *    `--before <baseline.json> --before-lists <dir> --baseline-tree <sha>`: every fingerprint must match, or every
 *    added and removed path must be classified: a path the tree itself gained or lost between the baseline commit
 *    and HEAD (`git diff --name-status <sha> HEAD`) is a tree change, not a walker change; anything else must be a
 *    shift listed in `INTENDED_FILE_SET_SHIFTS` with its reason. The R2b before lists are committed under
 *    `research/glob-adoption-parity-r2b-before-lists/` (listed at ed0c4ec45e), so the classification re-derives
 *    after the lane merges `main`.
 *
 * Nothing here runs in CI; the reports ride in `research/` and the PR body.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/glob-adoption-parity.ts [--out <report.json>] [--list-dir <dir>]
 *     [--before <baseline.json> --before-lists <dir> --baseline-tree <sha>]
 *
 * Exit status is non-zero when a pattern pair disagrees or an EffectImports fingerprint differs from the baseline.
 */
import * as NodeURL from "node:url";
import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
import {
  discoverEffectImportMarkdownFiles,
  discoverEffectImportSourceFiles,
  EffectImportRulesOptions,
} from "@beep/repo-cli/commands/Laws/EffectImports";
import { discoverWorkspacePackages } from "@beep/repo-cli/test/Quality";
import { runGitLines } from "@beep/repo-cli/test/SharedInternals";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const TOOL = "goals/effected-promotion/ops/glob-adoption-parity.ts";
const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const relative = (path: string): string => (Str.startsWith(repoRoot)(path) ? Str.slice(repoRoot.length)(path) : path);

// --- pre-R2b compiler (frozen, byte-for-byte, from ed0c4ec45e `internal/GlobPattern.ts`) -------------------------

const oldEscapeRegexChar = (char: string): string => Str.replace(/[.+?^${}()|[\]\\]/g, "\\$&")(char);

const oldGlobPatternToRegExp = (pattern: string): RegExp => {
  let source = "^";
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index];
    const next = pattern[index + 1];
    const afterNext = pattern[index + 2];

    if (char === "*" && next === "*" && afterNext === "/") {
      source += "(?:.*/)?";
      index += 3;
      continue;
    }

    if (char === "*" && next === "*") {
      source += ".*";
      index += 2;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      index += 1;
      continue;
    }

    source += oldEscapeRegexChar(char ?? "");
    index += 1;
  }

  return new RegExp(`${source}$`);
};

// --- the shipped matcher: `@beep/glob` with the dialect every adopted caller states ---------------------------------

// `dot`: the old compiler let `*` and `**` match dot-leading segments. `nonegate` and `nocomment`: it read a
// leading `!` or `#` as an ordinary character, where the minimatch default negates or drops the pattern.
const dotGlob = GlobPatternOptions.make({ dot: true, nonegate: true, nocomment: true });
const kitMatches = (pattern: string): ((candidate: string) => boolean) => {
  const compiled = GlobPattern.compileResult(pattern, dotGlob);
  return Result.isSuccess(compiled) ? (candidate) => compiled.success.matches(candidate) : () => false;
};

// --- report schema ---------------------------------------------------------------------------------------------

const Disagreement = S.Struct({ pattern: S.String, candidate: S.String, old: S.Boolean, kit: S.Boolean });
const PatternSection = S.Struct({
  patterns: S.Finite,
  candidates: S.Finite,
  comparisons: S.Finite,
  matches: S.Finite,
  disagreements: S.Array(Disagreement),
});
type PatternSection = typeof PatternSection.Type;
const DialectCase = S.Struct({
  pattern: S.String,
  candidate: S.String,
  old: S.Boolean,
  kit: S.Boolean,
  reason: S.String,
});
type DialectCase = typeof DialectCase.Type;
// A section whose disagreements are expected: every case is checked against both dialects, and `unexpected`
// lists the cases where either observed answer differs from the pinned one.
const DialectShiftSection = S.Struct({
  cases: S.Array(DialectCase),
  shifted: S.Finite,
  unexpected: S.Array(DialectCase),
});
type DialectShiftSection = typeof DialectShiftSection.Type;
const Fingerprint = S.Struct({
  count: S.Finite,
  sha256: S.String,
  byTopLevel: S.Record(S.String, S.Finite),
});
type Fingerprint = typeof Fingerprint.Type;
const FileSets = S.Struct({
  codeSources: Fingerprint,
  markdownModeSources: Fingerprint,
  markdownDocuments: Fingerprint,
});
type FileSets = typeof FileSets.Type;
const FileSetShift = S.Struct({
  corpus: S.String,
  kind: S.Literals(["added", "removed"]),
  path: S.String,
  // "tree": the repository gained or lost the path between the baseline commit and HEAD; "walker": a listed
  // semantic shift of the switch itself; "" when unclassified.
  cause: S.Literals(["tree", "walker", ""]),
  reason: S.String,
});
type FileSetShift = typeof FileSetShift.Type;
const Report = S.Struct({
  tool: S.String,
  patternParity: S.Struct({
    docgenExcludes: PatternSection,
    coverageFixtureOwners: PatternSection,
    coverageSelectors: PatternSection,
    turboEnv: PatternSection,
    dialectPrefixes: S.optionalKey(PatternSection),
  }),
  dialectMagic: S.optionalKey(DialectShiftSection),
  effectImports: FileSets,
  comparison: S.optionalKey(
    S.Struct({
      baseline: S.String,
      beforeLists: S.optionalKey(S.String),
      baselineTree: S.optionalKey(S.String),
      tree: S.optionalKey(S.String),
      identical: S.Boolean,
      differing: S.Array(S.String),
      shifts: S.Array(FileSetShift),
      unclassified: S.Array(S.String),
    })
  ),
});
type Report = typeof Report.Type;
const encodeReport = S.encodeEffect(S.fromJsonString(Report, { space: 2 }));
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(Report));

class ParityFailed extends S.TaggedError<ParityFailed, { readonly brand: unique symbol }>()("ParityFailed", {
  reasons: S.Array(S.String),
}) {}

// --- pattern parity -------------------------------------------------------------------------------------------

const comparePatterns = (
  patterns: ReadonlyArray<string>,
  candidates: ReadonlyArray<string>,
  normalize: (pattern: string) => string = (pattern) => pattern
): PatternSection => {
  let matches = 0;
  let disagreements = A.empty<typeof Disagreement.Type>();
  for (const raw of A.dedupe(patterns)) {
    const pattern = normalize(raw);
    const oldRegex = oldGlobPatternToRegExp(pattern);
    const kit = kitMatches(pattern);
    for (const candidate of candidates) {
      const old = oldRegex.test(candidate);
      const next = kit(candidate);
      if (old) matches += 1;
      if (old !== next) disagreements = A.append(disagreements, { pattern, candidate, old, kit: next });
    }
  }
  const distinct = A.dedupe(patterns);
  return {
    patterns: distinct.length,
    candidates: candidates.length,
    comparisons: distinct.length * candidates.length,
    matches,
    disagreements,
  };
};

const normalizeSlashes = Str.replaceAll("\\", "/");
const stripDotSlash = Str.replace(/^\.\//, "");
const docgenNormalize = (pattern: string): string => normalizeSlashes(stripDotSlash(pattern));

const DocgenConfig = S.Struct({
  srcDir: S.String.pipe(S.optionalKey),
  exclude: S.Array(S.String).pipe(S.optionalKey),
});
const decodeDocgenConfig = S.decodeUnknownEffect(S.fromJsonString(DocgenConfig));

// The CoverageScope repository-fixture owner patterns (private to `CoverageScope.ts`), as of ed0c4ec45e.
const COVERAGE_FIXTURE_OWNER_PATTERNS: ReadonlyArray<string> = [
  "goals/fallow-quality-enforcement/research/feature-matrix.jsonc",
  "goals/lexical-playground-capability-atlas/research/capability-atlas.json",
  "goals/ship-velocity/research/branch-protection-contexts.json",
  "goals/*/ops/manifest.json",
  "standards/schema-crispening.policy.jsonc",
  "standards/effect-laws.allowlist.jsonc",
  ".claude/skills/effect-first-development/SKILL.md",
  ".claude/hooks/yeet-inbox.sh",
  ".claude/hooks/circuit-breaker.sh",
  ".claude/hooks/hook-pulse.sh",
  ".claude/hooks/hook-pulse-switch.sh",
  ".claude/hooks/sequence-break-notifier.sh",
  "biome.jsonc",
  "package.json",
  "turbo.json",
  "packages/foundation/**/package.json",
];

// `Tasks.ts` selector normalisation: graph operators, then the brace wrapper, then a leading `./`.
const selectorPattern = (selector: string): string =>
  pipe(
    selector,
    Str.replace(/^(?:\.\.\.\^?)|(?:\^?\.\.\.)$/gu, ""),
    Str.replace(/^\{?|\}$/gu, ""),
    Str.replace(/^\.\//u, "")
  );

const selectorsFor = (names: ReadonlyArray<string>, directories: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.dedupe(
    A.flatten([
      names,
      A.map(names, (name) => `${name}...`),
      A.map(names, (name) => `...^${name}`),
      A.getSomes(
        A.map(names, (name) => {
          const slash = Str.indexOf("/")(name);
          return O.map(slash, (index) => `${Str.slice(0, index + 1)(name)}*`);
        })
      ),
      A.getSomes(
        A.map(names, (name) => {
          const dash = Str.lastIndexOf("-")(name);
          return O.map(dash, (index) => `${Str.slice(0, index + 1)(name)}*`);
        })
      ),
      A.map(directories, (directory) => `./${directory}`),
      A.map(directories, (directory) => `{./${directory}}`),
      A.map(directories, (directory) => `...{./${directory}}...`),
      A.getSomes(
        A.map(directories, (directory) => {
          const slash = Str.lastIndexOf("/")(directory);
          return O.map(slash, (index) => `{./${Str.slice(0, index + 1)(directory)}*}`);
        })
      ),
      A.getSomes(
        A.map(directories, (directory) => {
          const slash = Str.indexOf("/")(directory);
          return O.map(slash, (index) => `./${Str.slice(0, index + 1)(directory)}**`);
        })
      ),
    ])
  );

const TurboEnvArrays = S.Struct({
  globalEnv: S.Array(S.String).pipe(S.optionalKey),
  globalPassThroughEnv: S.Array(S.String).pipe(S.optionalKey),
  tasks: S.Record(
    S.String,
    S.Struct({
      env: S.Array(S.String).pipe(S.optionalKey),
      passThroughEnv: S.Array(S.String).pipe(S.optionalKey),
    })
  ).pipe(S.optionalKey),
});
const decodeTurboEnvArrays = S.decodeUnknownEffect(S.fromJsonString(TurboEnvArrays));

const turboEnvEntries = (config: typeof TurboEnvArrays.Type): ReadonlyArray<string> =>
  A.flatten([
    config.globalEnv ?? [],
    config.globalPassThroughEnv ?? [],
    A.flatMap(R.values(config.tasks ?? {}), (task) => A.appendAll(task.env ?? [], task.passThroughEnv ?? [])),
  ]);

const hasGlobMagic = Str.includes("*");

// Synthetic patterns that pin the `nonegate` / `nocomment` choice: each prefix must stay a literal character, as
// the old compiler read it, so `!BEEP_*` matches `!BEEP_X` and nothing else.
const DIALECT_PREFIX_PATTERNS: ReadonlyArray<string> = ["!BEEP_*", "#BEEP_*", "BEEP_*", "!**/*.ts", "#docs/**/*.md"];
const DIALECT_PREFIX_CANDIDATES: ReadonlyArray<string> = [
  "!BEEP_X",
  "#BEEP_X",
  "BEEP_X",
  "BIOME_CONFIG_PATH",
  "!src/a.ts",
  "src/a.ts",
  "#docs/a.md",
  "docs/a.md",
];

// Where the dialects are known to differ. The old compiler treated every character other than `*` as a literal;
// minimatch gives these glob meaning. Each row pins both answers, so a matcher that drifted either way is caught.
const LITERAL_THEN_MAGIC = "the old compiler read the character literally; minimatch gives it glob meaning";
const DIALECT_MAGIC_CASES: ReadonlyArray<DialectCase> = [
  { pattern: "a?.ts", candidate: "ab.ts", old: false, kit: true, reason: `\`?\`: ${LITERAL_THEN_MAGIC}` },
  { pattern: "a?.ts", candidate: "a?.ts", old: true, kit: true, reason: "`?` also matches a literal `?`" },
  { pattern: "a?.ts", candidate: "a.ts", old: false, kit: false, reason: "`?` matches exactly one character" },
  { pattern: "[ab].ts", candidate: "a.ts", old: false, kit: true, reason: `\`[..]\`: ${LITERAL_THEN_MAGIC}` },
  { pattern: "[ab].ts", candidate: "[ab].ts", old: true, kit: false, reason: `\`[..]\`: ${LITERAL_THEN_MAGIC}` },
  { pattern: "[ab].ts", candidate: "c.ts", old: false, kit: false, reason: "`[ab]` excludes `c`" },
  { pattern: "{a,b}.ts", candidate: "b.ts", old: false, kit: true, reason: `\`{a,b}\`: ${LITERAL_THEN_MAGIC}` },
  { pattern: "{a,b}.ts", candidate: "{a,b}.ts", old: true, kit: false, reason: `\`{a,b}\`: ${LITERAL_THEN_MAGIC}` },
  { pattern: "+(a|b).ts", candidate: "ab.ts", old: false, kit: true, reason: `\`+(..)\`: ${LITERAL_THEN_MAGIC}` },
  { pattern: "+(a|b).ts", candidate: "+(a|b).ts", old: true, kit: false, reason: `\`+(..)\`: ${LITERAL_THEN_MAGIC}` },
  {
    pattern: "src/**.ts",
    candidate: "src/a.ts",
    old: true,
    kit: true,
    reason: "an in-segment `**` matches within the segment under both",
  },
  {
    pattern: "src/**.ts",
    candidate: "src/a/b.ts",
    old: true,
    kit: false,
    reason: "an in-segment `**` crossed `/` for the old compiler; minimatch reads it as a single-segment `*`",
  },
  {
    pattern: "a\\*.ts",
    candidate: "a*.ts",
    old: false,
    kit: true,
    reason: `\`\\\`: ${LITERAL_THEN_MAGIC} (an escape)`,
  },
  {
    pattern: "a\\*.ts",
    candidate: "a\\b.ts",
    old: true,
    kit: false,
    reason: `\`\\\`: ${LITERAL_THEN_MAGIC} (an escape)`,
  },
];

const compareDialectMagic = (): DialectShiftSection => {
  const observed = A.map(DIALECT_MAGIC_CASES, (expected) => ({
    ...expected,
    old: oldGlobPatternToRegExp(expected.pattern).test(expected.candidate),
    kit: kitMatches(expected.pattern)(expected.candidate),
  }));
  return {
    cases: DIALECT_MAGIC_CASES,
    shifted: A.length(A.filter(DIALECT_MAGIC_CASES, (expected) => expected.old !== expected.kit)),
    unexpected: A.filter(observed, (row, index) => {
      const expected = DIALECT_MAGIC_CASES[index];
      return expected === undefined || row.old !== expected.old || row.kit !== expected.kit;
    }),
  };
};

// --- EffectImports file sets ----------------------------------------------------------------------------------

const fingerprint = (files: ReadonlyArray<string>): Fingerprint => {
  const byTopLevel = MutableHashMap.empty<string, number>();
  for (const file of files) {
    const slash = Str.indexOf("/")(file);
    const key = O.match(slash, { onNone: () => ".", onSome: (index) => Str.slice(0, index)(file) });
    MutableHashMap.set(byTopLevel, key, O.getOrElse(MutableHashMap.get(byTopLevel, key), () => 0) + 1);
  }
  return {
    count: files.length,
    sha256: sha256(A.join(files, "\n")),
    byTopLevel: pipe(
      A.fromIterable(byTopLevel),
      A.sort(Order.mapInput(Order.String, ([key]: readonly [string, number]) => key)),
      R.fromEntries
    ),
  };
};

const CORPORA = ["codeSources", "markdownModeSources", "markdownDocuments"] as const;
type Corpus = (typeof CORPORA)[number];
const corpusListFile: Record<Corpus, string> = {
  codeSources: "code-sources.txt",
  markdownModeSources: "markdown-mode-sources.txt",
  markdownDocuments: "markdown-documents.txt",
};

const fileSetDifferences = (before: FileSets, after: FileSets): ReadonlyArray<string> =>
  A.filter(CORPORA, (key) => before[key].count !== after[key].count || before[key].sha256 !== after[key].sha256);

// Every file-set shift the switch is allowed to make, with its witness and reason. Anything else is unclassified.
const INTENDED_FILE_SET_SHIFTS: ReadonlyArray<
  readonly [kind: "added" | "removed", test: (path: string) => boolean, reason: string]
> = [
  [
    "removed",
    (path) =>
      /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)\/[^/]+$/u.test(path) && !/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/u.test(path),
    "tinyglobby matched every file below a directory whose own name ends in a source extension (a Playwright `__screenshots__/<name>.test.ts/` folder); the kit matches the file path itself, so a PNG is no longer scanned as TypeScript.",
  ],
];

// Paths the repository itself gained or lost between the baseline commit and HEAD. A walker that lists a file the
// tree gained, or stops listing one the tree lost, has not changed semantics.
interface TreeChanges {
  readonly added: MutableHashSet.MutableHashSet<string>;
  readonly removed: MutableHashSet.MutableHashSet<string>;
}
const treeChanges = (baselineTree: string) =>
  runGitLines(repoRoot, ["diff", "--name-status", "-z", "--no-renames", baselineTree, "HEAD"]).pipe(
    Effect.map((lines): TreeChanges => {
      const fields = A.filter(A.flatMap(lines, Str.split("\0")), Str.isNonEmpty);
      const added = MutableHashSet.empty<string>();
      const removed = MutableHashSet.empty<string>();
      for (const [status, path] of A.chunksOf(fields, 2)) {
        if (path === undefined) continue;
        if (status === "A") MutableHashSet.add(added, path);
        if (status === "D") MutableHashSet.add(removed, path);
      }
      return { added, removed };
    })
  );

const classifyShift = (
  tree: O.Option<TreeChanges>,
  corpus: Corpus,
  kind: "added" | "removed",
  path: string
): FileSetShift => {
  const inTree = O.exists(tree, (changes) =>
    MutableHashSet.has(kind === "added" ? changes.added : changes.removed, path)
  );
  if (inTree) {
    return {
      corpus,
      kind,
      path,
      cause: "tree",
      reason: `the repository ${kind === "added" ? "gained" : "lost"} this path between the baseline commit and HEAD; a tree change, not a walker change`,
    };
  }
  return pipe(
    A.findFirst(INTENDED_FILE_SET_SHIFTS, ([shiftKind, test]) => shiftKind === kind && test(path)),
    O.match({
      onNone: (): FileSetShift => ({ corpus, kind, path, cause: "", reason: "" }),
      onSome: ([, , reason]): FileSetShift => ({ corpus, kind, path, cause: "walker", reason }),
    })
  );
};

const listShifts = (
  tree: O.Option<TreeChanges>,
  corpus: Corpus,
  before: ReadonlyArray<string>,
  after: ReadonlyArray<string>
): ReadonlyArray<FileSetShift> => {
  const beforeSet = MutableHashSet.fromIterable(before);
  const afterSet = MutableHashSet.fromIterable(after);
  return A.appendAll(
    A.map(
      A.filter(after, (path) => !MutableHashSet.has(beforeSet, path)),
      (path) => classifyShift(tree, corpus, "added", path)
    ),
    A.map(
      A.filter(before, (path) => !MutableHashSet.has(afterSet, path)),
      (path) => classifyShift(tree, corpus, "removed", path)
    )
  );
};

// --- program --------------------------------------------------------------------------------------------------

const flag = (name: string): O.Option<string> => {
  const index = process.argv.indexOf(name);
  return index === -1 ? O.none() : O.fromNullishOr(process.argv[index + 1]);
};

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (normalizeSlashes(process.cwd()) !== normalizeSlashes(Str.replace(/\/$/, "")(repoRoot))) {
    return yield* ParityFailed.make({ reasons: [`run from the repo root (${relative(repoRoot)})`] });
  }

  const tracked = yield* runGitLines(repoRoot, ["ls-files", "-z"]).pipe(
    Effect.map((lines) => pipe(A.flatMap(lines, Str.split("\0")), A.filter(Str.isNonEmpty), A.dedupe))
  );

  // 1a. docgen excludes against each package's tracked sources, both candidate spellings.
  const docgenConfigs = A.filter(tracked, (file) => Str.endsWith("/docgen.json")(file));
  let docgenPatterns = A.empty<string>();
  let docgenCandidates = A.empty<string>();
  for (const configPath of docgenConfigs) {
    const packagePath = path.dirname(configPath);
    const config = yield* fs.readFileString(path.join(repoRoot, configPath)).pipe(Effect.flatMap(decodeDocgenConfig));
    const srcDir = config.srcDir ?? "src";
    const sources = A.filter(
      tracked,
      (file) =>
        Str.startsWith(`${packagePath}/${srcDir}/`)(file) && (Str.endsWith(".ts")(file) || Str.endsWith(".tsx")(file))
    );
    docgenPatterns = A.appendAll(docgenPatterns, config.exclude ?? []);
    for (const file of sources) {
      const packageRelative = Str.slice(packagePath.length + 1)(file);
      docgenCandidates = A.append(docgenCandidates, packageRelative);
      docgenCandidates = A.append(docgenCandidates, Str.slice(srcDir.length + 1)(packageRelative));
    }
  }
  const docgenExcludes = comparePatterns(docgenPatterns, A.dedupe(docgenCandidates), docgenNormalize);

  // 1b. CoverageScope fixture owners against every tracked path.
  const coverageFixtureOwners = comparePatterns(COVERAGE_FIXTURE_OWNER_PATTERNS, tracked);

  // 1c. coverage selectors over the live workspace names and directories.
  const workspaces = pipe(yield* discoverWorkspacePackages(repoRoot, path), MutableHashMap.values, A.fromIterable);
  const names = pipe(
    workspaces,
    A.map((workspace) => workspace.name),
    A.sort(Order.String)
  );
  const directories = A.sort(
    A.filter(
      A.map(workspaces, (workspace) => normalizeSlashes(workspace.path)),
      (directory) => directory !== "."
    ),
    Order.String
  );
  const coverageSelectors = comparePatterns(
    selectorsFor(names, directories),
    A.appendAll(names, directories),
    selectorPattern
  );

  // 1d. Turbo env entries against every env name the configs mention.
  const turboConfigs = A.filter(tracked, (file) => file === "turbo.json" || Str.endsWith("/turbo.json")(file));
  let envEntries = A.empty<string>();
  for (const configPath of turboConfigs) {
    const config = yield* fs.readFileString(path.join(repoRoot, configPath)).pipe(Effect.flatMap(decodeTurboEnvArrays));
    envEntries = A.appendAll(envEntries, turboEnvEntries(config));
  }
  const envNames = A.dedupe(A.append(A.filter(envEntries, P.not(hasGlobMagic)), "BIOME_CONFIG_PATH"));
  const turboEnv = comparePatterns(envEntries, envNames);

  // 1e. the `!` / `#` prefix literals, which no live pattern exercises.
  const dialectPrefixes = comparePatterns(DIALECT_PREFIX_PATTERNS, DIALECT_PREFIX_CANDIDATES);
  // 1f. the characters that are literal to the old compiler and magic to minimatch, with both answers pinned.
  const dialectMagic = compareDialectMagic();

  // 2. EffectImports discovery sets.
  const codeOptions = EffectImportRulesOptions.make({ excludePaths: [] });
  const markdownOptions = EffectImportRulesOptions.make({ mode: "markdown", excludePaths: [] });
  const codeSources = yield* discoverEffectImportSourceFiles(codeOptions);
  const markdownModeSources = yield* discoverEffectImportSourceFiles(markdownOptions);
  const markdownDocuments = yield* discoverEffectImportMarkdownFiles(markdownOptions);
  yield* O.match(flag("--list-dir"), {
    onNone: () => Effect.void,
    onSome: Effect.fnUntraced(function* (dir) {
      yield* fs.makeDirectory(dir, { recursive: true });
      yield* fs.writeFileString(path.join(dir, "code-sources.txt"), `${A.join(codeSources, "\n")}\n`);
      yield* fs.writeFileString(path.join(dir, "markdown-mode-sources.txt"), `${A.join(markdownModeSources, "\n")}\n`);
      yield* fs.writeFileString(path.join(dir, "markdown-documents.txt"), `${A.join(markdownDocuments, "\n")}\n`);
    }),
  });
  const effectImports: FileSets = {
    codeSources: fingerprint(codeSources),
    markdownModeSources: fingerprint(markdownModeSources),
    markdownDocuments: fingerprint(markdownDocuments),
  };

  const current: Report = {
    tool: TOOL,
    patternParity: { docgenExcludes, coverageFixtureOwners, coverageSelectors, turboEnv, dialectPrefixes },
    dialectMagic,
    effectImports,
  };
  const currentLists: Record<Corpus, ReadonlyArray<string>> = { codeSources, markdownModeSources, markdownDocuments };
  const report: Report = yield* O.match(flag("--before"), {
    onNone: () => Effect.succeed(current),
    onSome: Effect.fnUntraced(function* (baselinePath) {
      const before = yield* fs.readFileString(baselinePath).pipe(Effect.flatMap(decodeReport));
      const differing = fileSetDifferences(before.effectImports, effectImports);
      const baselineTree = flag("--baseline-tree");
      const tree = yield* O.match(baselineTree, {
        onNone: () => Effect.succeedNone,
        onSome: (sha) => Effect.asSome(treeChanges(sha)),
      });
      const head = yield* runGitLines(repoRoot, ["rev-parse", "HEAD"]).pipe(Effect.map(A.head));
      const shifts = yield* O.match(flag("--before-lists"), {
        onNone: () => Effect.succeed(A.empty<FileSetShift>()),
        onSome: (dir) =>
          Effect.forEach(CORPORA, (corpus) =>
            fs
              .readFileString(path.join(dir, corpusListFile[corpus]))
              .pipe(
                Effect.map((text) =>
                  listShifts(tree, corpus, A.filter(Str.split("\n")(text), Str.isNonEmpty), currentLists[corpus])
                )
              )
          ).pipe(Effect.map(A.flatten)),
      });
      return {
        ...current,
        comparison: {
          baseline: relative(baselinePath),
          ...O.match(flag("--before-lists"), {
            onNone: () => ({}),
            onSome: (dir) => ({ beforeLists: relative(dir) }),
          }),
          ...O.match(baselineTree, { onNone: () => ({}), onSome: (sha) => ({ baselineTree: sha }) }),
          ...O.match(head, { onNone: () => ({}), onSome: (sha) => ({ tree: sha }) }),
          identical: A.isReadonlyArrayEmpty(differing),
          differing,
          shifts,
          unclassified: A.map(
            A.filter(shifts, (shift) => Str.isEmpty(shift.reason)),
            (shift) => `${shift.corpus} ${shift.kind} ${shift.path}`
          ),
        },
      };
    }),
  });

  const json = yield* encodeReport(report);
  yield* O.match(flag("--out"), {
    onNone: () => Console.log(json),
    onSome: (out) => fs.writeFileString(out, `${json}\n`),
  });

  const parity = report.patternParity;
  const sections: ReadonlyArray<readonly [string, PatternSection]> = A.getSomes([
    O.some(["docgenExcludes", parity.docgenExcludes] as const),
    O.some(["coverageFixtureOwners", parity.coverageFixtureOwners] as const),
    O.some(["coverageSelectors", parity.coverageSelectors] as const),
    O.some(["turboEnv", parity.turboEnv] as const),
    O.map(O.fromUndefinedOr(parity.dialectPrefixes), (section) => ["dialectPrefixes", section] as const),
  ]);
  const disagreements = A.flatMap(sections, ([name, section]) =>
    A.isReadonlyArrayEmpty(section.disagreements) ? [] : [`${name}: ${section.disagreements.length} disagreements`]
  );
  // A fingerprint may differ only when every added or removed path is a classified shift.
  const comparison = report.comparison;
  const fileSetReasons =
    comparison === undefined || comparison.identical
      ? A.empty<string>()
      : A.isReadonlyArrayEmpty(comparison.shifts)
        ? A.map(
            comparison.differing,
            (key) =>
              `EffectImports ${key} differs from the baseline (pass --before-lists and --baseline-tree to classify)`
          )
        : A.map(comparison.unclassified, (shift) => `unclassified EffectImports shift: ${shift}`);
  const magicReasons = A.map(
    dialectMagic.unexpected,
    (row) => `dialectMagic: ${row.pattern} vs ${row.candidate} observed old=${row.old} kit=${row.kit}`
  );
  const reasons = A.appendAll(A.appendAll(disagreements, magicReasons), fileSetReasons);
  yield* Console.log(
    A.join(
      A.map(sections, ([name, section]) => `${name}: ${section.comparisons} comparisons, ${section.matches} matches`),
      "; "
    )
  );
  yield* Console.log(
    `dialectMagic: ${dialectMagic.cases.length} pinned cases, ${dialectMagic.shifted} shifted, ${dialectMagic.unexpected.length} unexpected`
  );
  const causes = (cause: "tree" | "walker"): number =>
    comparison === undefined ? 0 : A.length(A.filter(comparison.shifts, (shift) => shift.cause === cause));
  yield* Console.log(
    `effectImports: code=${effectImports.codeSources.count} markdownModeSources=${effectImports.markdownModeSources.count} markdown=${effectImports.markdownDocuments.count}${comparison === undefined ? "" : ` identical=${comparison.identical} shifts=${comparison.shifts.length} (tree=${causes("tree")} walker=${causes("walker")}) unclassified=${comparison.unclassified.length}`}`
  );
  if (A.isReadonlyArrayNonEmpty(reasons)) return yield* ParityFailed.make({ reasons });
});

// @effect-diagnostics-next-line strictEffectProvide:off -- this is the script's entry point; the one layer is provided once here. Owner: goals/effected-promotion. Exit: the script is deleted with the packet's closeout.
NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
