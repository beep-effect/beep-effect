/**
 * Glob adoption parity (roadmap PR R2b, map sites #57, #59, #263, #305).
 *
 * R2b retires two glob owners in repo-cli in favour of the promoted kit:
 *
 * - `internal/GlobPattern.ts`, a hand-rolled `**`/`*` compiler whose six callers (Docgen `JsDocAnalysis` and
 *   `Quality.subjects`, Quality `JSDocDocumentationInventory`, `CoverageScope` and `Tasks`, Cache `Cache.census`)
 *   now match through `@beep/glob` `GlobPattern` compiled with `dot: true` (the old compiler matched dot segments);
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
 *    `BIOME_CONFIG_PATH`. Every disagreement is reported; the gate is zero.
 * 2. **EffectImports file-set parity.** The three discovery sets a run can read (`code` sources, `markdown`-mode
 *    foundation sources, `markdown` documents) are listed through the exported discovery functions and
 *    fingerprinted (count, sha256 of the sorted newline-joined list, per-top-level-directory histogram). Run once
 *    before the switch (`--out`, with `--list-dir <dir>` writing each full list), then after it with
 *    `--before <baseline.json> --before-lists <dir>`: every fingerprint must match, or every added and removed path
 *    must be a shift listed in `INTENDED_FILE_SET_SHIFTS` with its reason.
 *
 * Nothing here runs in CI; the reports ride in `research/` and the PR body.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/glob-adoption-parity.ts [--out <report.json>] [--list-dir <dir>]
 *     [--before <baseline.json> --before-lists <dir>]
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
import * as Data from "effect/Data";
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

// --- the shipped matcher: `@beep/glob` with the dot dialect every adopted caller states ---------------------------

const dotGlob = GlobPatternOptions.make({ dot: true });
const kitMatches = (pattern: string): ((candidate: string) => boolean) => {
  const compiled = GlobPattern.compileResult(pattern, dotGlob);
  return Result.isSuccess(compiled) ? (candidate) => compiled.success.matches(candidate) : () => false;
};

// --- report schema ---------------------------------------------------------------------------------------------

const Disagreement = S.Struct({ pattern: S.String, candidate: S.String, old: S.Boolean, kit: S.Boolean });
const PatternSection = S.Struct({
  patterns: S.Number,
  candidates: S.Number,
  comparisons: S.Number,
  matches: S.Number,
  disagreements: S.Array(Disagreement),
});
type PatternSection = typeof PatternSection.Type;
const Fingerprint = S.Struct({
  count: S.Number,
  sha256: S.String,
  byTopLevel: S.Record(S.String, S.Number),
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
  }),
  effectImports: FileSets,
  comparison: S.optionalKey(
    S.Struct({
      baseline: S.String,
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

class ParityFailed extends Data.TaggedError("ParityFailed")<{ readonly reasons: ReadonlyArray<string> }> {}

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
  srcDir: S.optionalKey(S.String),
  exclude: S.optionalKey(S.Array(S.String)),
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
      A.filterMap(names, (name) => {
        const slash = Str.indexOf("/")(name);
        return O.map(slash, (index) => `${Str.slice(0, index + 1)(name)}*`);
      }),
      A.filterMap(names, (name) => {
        const dash = Str.lastIndexOf("-")(name);
        return O.map(dash, (index) => `${Str.slice(0, index + 1)(name)}*`);
      }),
      A.map(directories, (directory) => `./${directory}`),
      A.map(directories, (directory) => `{./${directory}}`),
      A.map(directories, (directory) => `...{./${directory}}...`),
      A.filterMap(directories, (directory) => {
        const slash = Str.lastIndexOf("/")(directory);
        return O.map(slash, (index) => `{./${Str.slice(0, index + 1)(directory)}*}`);
      }),
      A.filterMap(directories, (directory) => {
        const slash = Str.indexOf("/")(directory);
        return O.map(slash, (index) => `./${Str.slice(0, index + 1)(directory)}**`);
      }),
    ])
  );

const TurboEnvArrays = S.Struct({
  globalEnv: S.optionalKey(S.Array(S.String)),
  globalPassThroughEnv: S.optionalKey(S.Array(S.String)),
  tasks: S.optionalKey(
    S.Record(
      S.String,
      S.Struct({ env: S.optionalKey(S.Array(S.String)), passThroughEnv: S.optionalKey(S.Array(S.String)) })
    )
  ),
});
const decodeTurboEnvArrays = S.decodeUnknownEffect(S.fromJsonString(TurboEnvArrays));

const turboEnvEntries = (config: typeof TurboEnvArrays.Type): ReadonlyArray<string> =>
  A.flatten([
    config.globalEnv ?? [],
    config.globalPassThroughEnv ?? [],
    A.flatMap(R.values(config.tasks ?? {}), (task) => A.appendAll(task.env ?? [], task.passThroughEnv ?? [])),
  ]);

const hasGlobMagic = Str.includes("*");

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
  [
    "removed",
    (path) => path === "packages/tooling/tool/cli/src/internal/GlobPattern.ts",
    "R2b deletes this module; the baseline was listed before the deletion, over an otherwise identical tree.",
  ],
];

const classifyShift = (corpus: Corpus, kind: "added" | "removed", path: string): FileSetShift => ({
  corpus,
  kind,
  path,
  reason: pipe(
    A.findFirst(INTENDED_FILE_SET_SHIFTS, ([shiftKind, test]) => shiftKind === kind && test(path)),
    O.map(([, , reason]) => reason),
    O.getOrElse(() => "")
  ),
});

const listShifts = (
  corpus: Corpus,
  before: ReadonlyArray<string>,
  after: ReadonlyArray<string>
): ReadonlyArray<FileSetShift> => {
  const beforeSet = MutableHashSet.fromIterable(before);
  const afterSet = MutableHashSet.fromIterable(after);
  return A.appendAll(
    A.map(
      A.filter(after, (path) => !MutableHashSet.has(beforeSet, path)),
      (path) => classifyShift(corpus, "added", path)
    ),
    A.map(
      A.filter(before, (path) => !MutableHashSet.has(afterSet, path)),
      (path) => classifyShift(corpus, "removed", path)
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
    return yield* new ParityFailed({ reasons: [`run from the repo root (${relative(repoRoot)})`] });
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
  const workspaces = A.fromIterable(MutableHashMap.values(yield* discoverWorkspacePackages(repoRoot, path)));
  const names = A.sort(
    A.map(workspaces, (workspace) => workspace.name),
    Order.String
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

  // 2. EffectImports discovery sets.
  const codeOptions = EffectImportRulesOptions.make({ excludePaths: [] });
  const markdownOptions = EffectImportRulesOptions.make({ mode: "markdown", excludePaths: [] });
  const codeSources = yield* discoverEffectImportSourceFiles(codeOptions);
  const markdownModeSources = yield* discoverEffectImportSourceFiles(markdownOptions);
  const markdownDocuments = yield* discoverEffectImportMarkdownFiles(markdownOptions);
  yield* O.match(flag("--list-dir"), {
    onNone: () => Effect.void,
    onSome: (dir) =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(dir, { recursive: true });
        yield* fs.writeFileString(path.join(dir, "code-sources.txt"), `${A.join(codeSources, "\n")}\n`);
        yield* fs.writeFileString(
          path.join(dir, "markdown-mode-sources.txt"),
          `${A.join(markdownModeSources, "\n")}\n`
        );
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
    patternParity: { docgenExcludes, coverageFixtureOwners, coverageSelectors, turboEnv },
    effectImports,
  };
  const currentLists: Record<Corpus, ReadonlyArray<string>> = { codeSources, markdownModeSources, markdownDocuments };
  const report: Report = yield* O.match(flag("--before"), {
    onNone: () => Effect.succeed(current),
    onSome: (baselinePath) =>
      Effect.gen(function* () {
        const before = yield* fs.readFileString(baselinePath).pipe(Effect.flatMap(decodeReport));
        const differing = fileSetDifferences(before.effectImports, effectImports);
        const shifts = yield* O.match(flag("--before-lists"), {
          onNone: () => Effect.succeed(A.empty<FileSetShift>()),
          onSome: (dir) =>
            Effect.forEach(CORPORA, (corpus) =>
              fs
                .readFileString(path.join(dir, corpusListFile[corpus]))
                .pipe(
                  Effect.map((text) =>
                    listShifts(corpus, A.filter(Str.split("\n")(text), Str.isNonEmpty), currentLists[corpus])
                  )
                )
            ).pipe(Effect.map(A.flatten)),
        });
        return {
          ...current,
          comparison: {
            baseline: relative(baselinePath),
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

  const sections = R.toEntries(report.patternParity);
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
            (key) => `EffectImports ${key} differs from the baseline (pass --before-lists to classify)`
          )
        : A.map(comparison.unclassified, (shift) => `unclassified EffectImports shift: ${shift}`);
  const reasons = A.appendAll(disagreements, fileSetReasons);
  yield* Console.log(
    A.join(
      A.map(sections, ([name, section]) => `${name}: ${section.comparisons} comparisons, ${section.matches} matches`),
      "; "
    )
  );
  yield* Console.log(
    `effectImports: code=${effectImports.codeSources.count} markdownModeSources=${effectImports.markdownModeSources.count} markdown=${effectImports.markdownDocuments.count}${comparison === undefined ? "" : ` identical=${comparison.identical} shifts=${comparison.shifts.length}`}`
  );
  if (A.isReadonlyArrayNonEmpty(reasons)) return yield* new ParityFailed({ reasons });
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
