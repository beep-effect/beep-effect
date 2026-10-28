/**
 * `SourceBoundary.scan` adoption differential for `lint ecosystem-polarity` (4-A4).
 *
 * `Lint/EcosystemPolarity.ts` walked each ecosystem member's `src` by hand and
 * read import, export and dynamic `import(` / `require(` specifiers through a
 * ts-morph `Project`. 4-A4 moves the walk and the specifier reads onto
 * `SourceBoundary.scan` from `@beep/repo-workspaces`. This script runs
 * `runEcosystemPolarityCheck` over two trees and records, per scenario, the
 * member count, the scanned-file count and every violation, in output order and
 * as a sorted multiset:
 *
 * - the live repository (the working directory), in full and `--include` scoped;
 * - a synthetic ecosystem built in a temporary directory with one member per
 *   import form: static, type-only, `export … from`, side-effect, dynamic
 *   literal, template head, `require`, `require?.(`, multi-line call, comment
 *   and string decoys, declaration files, a missing `src`, nested directories,
 *   a `node_modules` directory under `src`, a symlink loop, and reordered
 *   forms; plus manifest-only and `--include` scoped runs over it.
 *
 * Each synthetic member names the shift classes it is built to exhibit. Without
 * `--compare` the run records a report (the baseline, taken before the switch
 * on the unchanged code). With `--compare <baseline.json>` it runs at the head,
 * diffs every scenario against the baseline, and classifies each difference
 * into one of the intended classes (W4-f, 4-A4 part):
 *
 * 1. `1-order`: the same violations, sorted by file, line and column instead of
 *    imports, then exports, then dynamic calls per file;
 * 2. `2-declaration-skipped`: a `.d.ts` / `.d.mts` / `.d.cts` file is no longer
 *    scanned;
 * 3. `3-literal-line`: a dynamic call spanning lines reports the line of its
 *    string literal, not of the call;
 * 4. `4-template-head`: a template literal with a substitution is no longer
 *    read as its head (ruling 3, accepted and pinned in the package tests);
 * 5. `5-wider`: `node_modules` and symlink cycles under `src` are skipped.
 *
 * `require?.(` is not a shift: ts-morph kept `require` as the optional call's
 * expression, so both scanners flag it (the `dynamic-forms` member pins that).
 *
 * A difference that fits no class, or a class the scenario did not announce,
 * is unclassified and fails the run.
 *
 * Usage (from the repo root, after `bun install`):
 *
 *   bun goals/effected-promotion/ops/ecosystem-polarity-differential.ts [--out <report.json>]
 *   bun goals/effected-promotion/ops/ecosystem-polarity-differential.ts --compare <baseline.json> [--out <report.json>]
 */

import { EcosystemPolarityOptions, runEcosystemPolarityCheck } from "@beep/repo-cli/commands/Lint/EcosystemPolarity";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const TOOL = "goals/effected-promotion/ops/ecosystem-polarity-differential.ts";
const ECOSYSTEM = "packages/ecosystem";

class EcosystemPolarityDifferentialFailed extends Data.TaggedError("EcosystemPolarityDifferentialFailed")<{
  readonly reason: string;
}> {}

// --- report schema -----------------------------------------------------------------

const ShiftClass = S.Literals(["1-order", "2-declaration-skipped", "3-literal-line", "4-template-head", "5-wider"]);
type ShiftClass = typeof ShiftClass.Type;

const ViolationRow = S.Struct({ file: S.String, line: S.Finite, kind: S.String, detail: S.String });
type ViolationRow = typeof ViolationRow.Type;

const CheckOutcome = S.Struct({
  ok: S.tag(true),
  checkedMembers: S.Finite,
  scannedSourceFiles: S.Finite,
  violations: S.Array(ViolationRow),
  sortedViolations: S.Array(S.String),
});
type CheckOutcome = typeof CheckOutcome.Type;
const FailureOutcome = S.Struct({ ok: S.tag(false), error: S.String });
const Outcome = S.Union([CheckOutcome, FailureOutcome]);
type Outcome = typeof Outcome.Type;

const ScenarioRow = S.Struct({
  name: S.String,
  tree: S.Literals(["live", "synthetic"]),
  includePaths: S.Array(S.String).pipe(S.optionalKey),
  expects: S.Array(ShiftClass),
  outcome: Outcome,
});
type ScenarioRow = typeof ScenarioRow.Type;

const Difference = S.Struct({
  scenario: S.String,
  class: S.Union([ShiftClass, S.Literal("unclassified")]),
  detail: S.String,
});
type Difference = typeof Difference.Type;

const Compare = S.Struct({
  baseline: S.String,
  baselineCommit: S.String.pipe(S.optionalKey),
  differences: S.Array(Difference),
  intended: S.Finite,
  unclassified: S.Finite,
  ok: S.Boolean,
});
type Compare = typeof Compare.Type;

const Report = S.Struct({
  schemaVersion: S.tag(1),
  commit: S.String.pipe(S.optionalKey),
  tool: S.String,
  generatedAt: S.String,
  scenarios: S.Array(ScenarioRow),
  compare: Compare.pipe(S.optionalKey),
});
type Report = typeof Report.Type;
const ReportJson = S.fromJsonString(Report);
const encodeReport = S.encodeEffect(S.fromJsonString(Report, { space: 2 }));

// --- synthetic ecosystem ----------------------------------------------------------------

interface MemberFixture {
  readonly expects: ReadonlyArray<ShiftClass>;
  readonly files: Readonly<Record<string, string>>;
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly name: string;
  /** Symlinks to create, `path -> target`, both relative to the member root. */
  readonly symlinks: Readonly<Record<string, string>>;
}

const lines = (...text: ReadonlyArray<string>): string => `${A.join(text, "\n")}\n`;

const MEMBERS: ReadonlyArray<MemberFixture> = [
  {
    name: "static-forms",
    manifest: {},
    files: {
      "src/index.ts": lines(
        'import { a } from "@beep/static";',
        'import type { T } from "@beep/types";',
        'import "@beep/side";',
        'export * from "@beep/exported";',
        'export { b } from "@beep/named";',
        'import { c } from "effect/Array";',
        "export const x: ReadonlyArray<T> = [a, c];"
      ),
    },
    symlinks: {},
    expects: [],
  },
  {
    name: "dynamic-forms",
    manifest: {},
    files: {
      "src/index.ts": lines(
        'export const dynamic = import("@beep/dynamic");',
        'export const required = require("@beep/required");',
        'export const optional = require?.("@beep/optional");',
        "export const multiline = import(",
        '  "@beep/multiline"',
        ");",
        'export const concatenated = import("@beep/" + "joined");'
      ),
    },
    symlinks: {},
    expects: ["3-literal-line"],
  },
  {
    name: "template-head",
    manifest: {},
    files: {
      "src/index.ts": lines(
        "declare const name: string;",
        "export const interpolated = import(`@beep/${name}`);",
        "export const interpolatedRequire = require(`@beep/${name}`);",
        "export const plain = import(`@beep/plain`);",
        "export const prefixed = import(`@beep/prefix-${name}`);"
      ),
    },
    symlinks: {},
    expects: ["4-template-head"],
  },
  {
    name: "decoys",
    manifest: {},
    files: {
      "src/index.ts": lines(
        '// import "@beep/in-line-comment"',
        '/* import("@beep/in-block-comment") */',
        "export const inString = 'import \"@beep/in-string\"';",
        'export const inTemplate = `import "@beep/in-template"`;',
        'export const inRegex = /import "@beep\\/in-regex"/u;'
      ),
    },
    symlinks: {},
    expects: [],
  },
  {
    name: "declarations",
    manifest: {},
    files: {
      "src/index.ts": lines("export const ok = 1;"),
      "src/types.d.ts": lines('import type { T } from "@beep/declared";', "export type U = T;"),
      "src/ambient.d.mts": lines('import "@beep/declared-mts";'),
    },
    symlinks: {},
    expects: ["2-declaration-skipped"],
  },
  {
    name: "missing-src",
    manifest: {
      dependencies: { "@beep/runtime": "workspace:^" },
      peerDependencies: { aliased: "npm:@beep/aliased@^1.0.0", effect: "^4.0.0" },
      bundledDependencies: [],
    },
    files: {},
    symlinks: {},
    expects: [],
  },
  {
    name: "nested",
    manifest: {},
    files: {
      "src/a/b/c/deep.ts": lines('import "@beep/deep";'),
      "src/a/sibling.tsx": lines('import "@beep/tsx";'),
      "src/module.mts": lines('import "@beep/mts";'),
      "src/common.cts": lines('const c = require("@beep/cts");', "module.exports = c;"),
      "src/script.js": lines('require("@beep/js");'),
      "src/notes.md": lines('import "@beep/markdown";'),
    },
    symlinks: {},
    expects: [],
  },
  {
    name: "node-modules",
    manifest: {},
    files: {
      "src/index.ts": lines('import "@beep/own";'),
      "src/node_modules/dep/index.ts": lines('import "@beep/vendored";'),
    },
    symlinks: {},
    expects: ["5-wider"],
  },
  {
    name: "symlink-loop",
    manifest: {},
    files: { "src/index.ts": lines('import "@beep/looped";') },
    symlinks: { "src/loop": "." },
    expects: ["5-wider"],
  },
  {
    name: "ordering",
    manifest: {},
    files: {
      "src/index.ts": lines(
        'export const dynamic = import("@beep/z-dynamic");',
        'export * from "@beep/y-export";',
        'import "@beep/x-import";'
      ),
    },
    symlinks: {},
    expects: ["1-order"],
  },
];

const memberExpectations = (names: ReadonlyArray<string>): ReadonlyArray<ShiftClass> =>
  pipe(
    MEMBERS,
    A.filter((member) => A.contains(names, member.name)),
    A.flatMap((member) => member.expects),
    A.dedupe
  );

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown, { space: 2 }));

const buildSyntheticTree = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(root, ".git"), { recursive: true });
  for (const member of MEMBERS) {
    const memberRoot = path.join(root, ECOSYSTEM, member.name);
    yield* fs.makeDirectory(memberRoot, { recursive: true });
    const manifest = yield* encodeJson({
      name: `@beep-ecosystem/${member.name}`,
      private: true,
      beep: { family: "ecosystem" },
      ...member.manifest,
    });
    yield* fs.writeFileString(path.join(memberRoot, "package.json"), `${manifest}\n`);
    for (const [file, content] of R.toEntries(member.files)) {
      const full = path.join(memberRoot, file);
      yield* fs.makeDirectory(path.dirname(full), { recursive: true });
      yield* fs.writeFileString(full, content);
    }
    for (const [link, target] of R.toEntries(member.symlinks)) {
      yield* fs.symlink(target, path.join(memberRoot, link));
    }
  }
});

// --- scenarios -----------------------------------------------------------------------

interface Scenario {
  readonly expects: ReadonlyArray<ShiftClass>;
  readonly includePaths: O.Option<ReadonlyArray<string>>;
  readonly name: string;
  readonly tree: "live" | "synthetic";
}

const memberPath = (name: string, ...rest: ReadonlyArray<string>): string => A.join([ECOSYSTEM, name, ...rest], "/");

const LIVE_SCENARIOS: ReadonlyArray<Scenario> = [
  { name: "live-full", tree: "live", includePaths: O.none(), expects: [] },
  {
    name: "live-scoped-member",
    tree: "live",
    includePaths: O.some([memberPath("effect-drizzle", "package.json")]),
    expects: [],
  },
  { name: "live-scoped-unrelated", tree: "live", includePaths: O.some(["README.md"]), expects: [] },
];

const SYNTHETIC_SCENARIOS: ReadonlyArray<Scenario> = [
  {
    name: "synthetic-full",
    tree: "synthetic",
    includePaths: O.none(),
    expects: memberExpectations(A.map(MEMBERS, (member) => member.name)),
  },
  ...A.map(MEMBERS, (member) => ({
    name: `synthetic-member-${member.name}`,
    tree: "synthetic" as const,
    includePaths: O.some([memberPath(member.name, "package.json")]),
    expects: member.expects,
  })),
  {
    name: "synthetic-scoped-src",
    tree: "synthetic",
    includePaths: O.some([memberPath("dynamic-forms", "src", "index.ts"), memberPath("ordering", "src", "index.ts")]),
    expects: memberExpectations(["dynamic-forms", "ordering"]),
  },
  {
    name: "synthetic-scoped-unrelated",
    tree: "synthetic",
    includePaths: O.some(["packages/other/src/index.ts", memberPath("nested", "test", "index.test.ts")]),
    expects: [],
  },
];

const violationKey = (row: ViolationRow): string => `${row.file}:${row.line} [${row.kind}] ${row.detail}`;
const byKey = Order.mapInput(Str.Order, violationKey);

/** Runs one scenario in `root` (the process working directory for the duration) and records its outcome. */
const runScenario = Effect.fnUntraced(function* (root: string, scenario: Scenario) {
  const options = O.match(scenario.includePaths, {
    onNone: () => EcosystemPolarityOptions.make({}),
    onSome: (includePaths) => EcosystemPolarityOptions.make({ includePaths }),
  });
  const outcome: Outcome = yield* runEcosystemPolarityCheck(options).pipe(
    Effect.match({
      onFailure: (error) => ({ ok: false as const, error: Str.replaceAll(root, "<root>")(error.message) }),
      onSuccess: (summary) => {
        const violations = A.map(summary.violations, (violation) => ({
          file: violation.file,
          line: violation.line,
          kind: violation.kind,
          detail: violation.detail,
        }));
        return {
          ok: true as const,
          checkedMembers: summary.checkedMembers,
          scannedSourceFiles: summary.scannedSourceFiles,
          violations,
          sortedViolations: A.map(A.sort(violations, byKey), violationKey),
        };
      },
    })
  );
  const row: ScenarioRow = {
    name: scenario.name,
    tree: scenario.tree,
    ...O.match(scenario.includePaths, { onNone: () => ({}), onSome: (includePaths) => ({ includePaths }) }),
    expects: scenario.expects,
    outcome,
  };
  return row;
});

const inWorkingDirectory = <A, E, R>(root: string, use: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.andThen(
      Effect.acquireRelease(
        Effect.sync(() => {
          const previous = process.cwd();
          process.chdir(root);
          return previous;
        }),
        (previous) => Effect.sync(() => process.chdir(previous))
      ),
      use
    )
  );

const runScenarios = Effect.fnUntraced(function* (root: string, scenarios: ReadonlyArray<Scenario>) {
  return yield* inWorkingDirectory(
    root,
    Effect.forEach(scenarios, (scenario) => runScenario(root, scenario))
  );
});

// --- classification --------------------------------------------------------------------

const DECLARATION = /\.d\.[cm]?ts$/u;
const sameKeys = A.makeEquivalence(Str.Equivalence);

const multisetDifference = (left: ReadonlyArray<ViolationRow>, right: ReadonlyArray<ViolationRow>) => {
  const counts = MutableHashMap.empty<string, number>();
  for (const row of right) {
    const key = violationKey(row);
    MutableHashMap.set(counts, key, O.getOrElse(MutableHashMap.get(counts, key), () => 0) + 1);
  }
  const remaining: Array<ViolationRow> = [];
  for (const row of left) {
    const key = violationKey(row);
    const count = O.getOrElse(MutableHashMap.get(counts, key), () => 0);
    if (count > 0) {
      MutableHashMap.set(counts, key, count - 1);
    } else {
      remaining.push(row);
    }
  }
  return remaining;
};

/** The text of `row.line` in the violating file of the tree at `root`, or `None` when it cannot be read. */
const sourceLine = Effect.fnUntraced(function* (root: string, row: ViolationRow) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(root, row.file)).pipe(
    Effect.map((text) => A.get(Str.split(/\r?\n/u)(text), row.line - 1)),
    Effect.orElseSucceed(() => O.none<string>())
  );
});

/** Whether the violating path passes through a symlink (or cannot be resolved at all, as in a cycle). */
const throughSymlink = Effect.fnUntraced(function* (root: string, row: ViolationRow) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const full = path.join(root, row.file);
  return yield* fs.realPath(full).pipe(
    Effect.map((real) => real !== full),
    Effect.orElseSucceed(() => true)
  );
});

const difference = (scenario: string, cls: ShiftClass | "unclassified", detail: string): Difference => ({
  scenario,
  class: cls,
  detail,
});

const classifyBaselineOnly = Effect.fnUntraced(function* (
  root: string,
  scenario: string,
  row: ViolationRow,
  headOnly: Array<ViolationRow>
) {
  const key = violationKey(row);
  if (DECLARATION.test(row.file)) {
    return difference(scenario, "2-declaration-skipped", `baseline only: ${key}`);
  }
  if (A.contains(Str.split("/")(row.file), "node_modules")) {
    return difference(scenario, "5-wider", `baseline only (node_modules): ${key}`);
  }
  if (yield* throughSymlink(root, row)) {
    return difference(scenario, "5-wider", `baseline only (symlink cycle): ${key}`);
  }
  const line = yield* sourceLine(root, row);
  if (O.exists(line, Str.includes(`\`${row.detail}\${`))) {
    return difference(scenario, "4-template-head", `baseline only: ${key}`);
  }
  const moved = A.findFirstIndex(
    headOnly,
    (candidate) =>
      candidate.file === row.file &&
      candidate.kind === row.kind &&
      candidate.detail === row.detail &&
      candidate.line > row.line
  );
  if (O.isSome(moved)) {
    const [replacement] = headOnly.splice(moved.value, 1);
    return difference(
      scenario,
      "3-literal-line",
      `line ${row.line} -> ${replacement?.line ?? row.line}: ${row.file} [${row.kind}] ${row.detail}`
    );
  }
  return difference(scenario, "unclassified", `baseline only: ${key}`);
});

const classifyHeadOnly = (scenario: string, row: ViolationRow): Difference =>
  difference(scenario, "unclassified", `head only: ${violationKey(row)}`);

const compareOutcomes = Effect.fnUntraced(function* (
  root: string,
  scenario: Scenario,
  baseline: Outcome,
  head: Outcome
) {
  const found: Array<Difference> = [];
  if (!baseline.ok || !head.ok) {
    if (baseline.ok !== head.ok) {
      found.push(difference(scenario.name, "unclassified", `outcome changed: ok ${baseline.ok} -> ${head.ok}`));
    } else if (!baseline.ok && !head.ok && baseline.error !== head.error) {
      found.push(difference(scenario.name, "unclassified", `error changed: ${baseline.error} -> ${head.error}`));
    }
    return found;
  }
  if (baseline.checkedMembers !== head.checkedMembers) {
    found.push(
      difference(scenario.name, "unclassified", `checkedMembers ${baseline.checkedMembers} -> ${head.checkedMembers}`)
    );
  }
  const baselineKeys = A.map(baseline.violations, violationKey);
  const headKeys = A.map(head.violations, violationKey);
  if (!sameKeys(baselineKeys, headKeys)) {
    if (sameKeys(baseline.sortedViolations, head.sortedViolations)) {
      found.push(
        difference(scenario.name, "1-order", `same ${A.length(headKeys)} violation(s), reported in position order`)
      );
    } else {
      const baselineOnly = multisetDifference(baseline.violations, head.violations);
      const headOnly = multisetDifference(head.violations, baseline.violations);
      // Classification pairs moved literals off this copy; `headOnly` itself stays whole for the order check.
      const unmatchedHead = A.copy(headOnly);
      for (const row of baselineOnly) {
        found.push(yield* classifyBaselineOnly(root, scenario.name, row, unmatchedHead));
      }
      for (const row of unmatchedHead) {
        found.push(classifyHeadOnly(scenario.name, row));
      }
      const survivors = multisetDifference(head.violations, headOnly);
      const kept = multisetDifference(baseline.violations, baselineOnly);
      if (A.isReadonlyArrayNonEmpty(kept) && !sameKeys(A.map(kept, violationKey), A.map(survivors, violationKey))) {
        found.push(difference(scenario.name, "1-order", "the shared violations are reported in position order"));
      }
    }
  }
  if (head.scannedSourceFiles < baseline.scannedSourceFiles) {
    const skipping = A.some(scenario.expects, (cls): boolean => cls === "2-declaration-skipped" || cls === "5-wider");
    found.push(
      difference(
        scenario.name,
        skipping
          ? A.contains(scenario.expects, "2-declaration-skipped")
            ? "2-declaration-skipped"
            : "5-wider"
          : "unclassified",
        `scannedSourceFiles ${baseline.scannedSourceFiles} -> ${head.scannedSourceFiles}`
      )
    );
  } else if (head.scannedSourceFiles > baseline.scannedSourceFiles) {
    found.push(
      difference(
        scenario.name,
        "unclassified",
        `scannedSourceFiles ${baseline.scannedSourceFiles} -> ${head.scannedSourceFiles}`
      )
    );
  }
  return A.map(found, (entry) =>
    entry.class === "unclassified" || A.contains(scenario.expects, entry.class)
      ? entry
      : difference(scenario.name, "unclassified", `${entry.class} not announced by the scenario: ${entry.detail}`)
  );
});

const compareReports = Effect.fnUntraced(function* (
  roots: { readonly live: string; readonly synthetic: string },
  scenarios: ReadonlyArray<Scenario>,
  baseline: Report,
  head: ReadonlyArray<ScenarioRow>
) {
  const differences: Array<Difference> = [];
  for (const scenario of scenarios) {
    const before = A.findFirst(baseline.scenarios, (row) => row.name === scenario.name);
    const after = A.findFirst(head, (row) => row.name === scenario.name);
    if (O.isNone(before) || O.isNone(after)) {
      differences.push(difference(scenario.name, "unclassified", "scenario missing from the baseline or the head"));
      continue;
    }
    const root = scenario.tree === "live" ? roots.live : roots.synthetic;
    differences.push(...(yield* compareOutcomes(root, scenario, before.value.outcome, after.value.outcome)));
  }
  for (const row of baseline.scenarios) {
    if (!A.some(scenarios, (scenario) => scenario.name === row.name)) {
      differences.push(difference(row.name, "unclassified", "baseline scenario no longer run"));
    }
  }
  return differences;
});

// --- entry point ---------------------------------------------------------------------------

const flagValue = (flag: string): O.Option<string> =>
  O.flatMap(
    A.findFirstIndex(process.argv, (arg) => arg === flag),
    (index) => A.get(process.argv, index + 1)
  );

const gitHead = (repoRoot: string): O.Option<string> => {
  const result = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repoRoot });
  return pipe(
    O.some(result.stdout.toString().trim()),
    O.filter((text) => result.exitCode === 0 && /^[0-9a-f]{40}$/u.test(text))
  );
};

const program = Effect.fn("EcosystemPolarityDifferential.main")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const repoRoot = process.cwd();
  const synthetic = yield* fs.makeTempDirectory({ prefix: "ecosystem-polarity-differential-" });
  yield* buildSyntheticTree(synthetic);
  const scenarios = A.appendAll(LIVE_SCENARIOS, SYNTHETIC_SCENARIOS);
  const liveRows = yield* runScenarios(repoRoot, LIVE_SCENARIOS);
  const syntheticRows = yield* runScenarios(synthetic, SYNTHETIC_SCENARIOS);
  const rows = A.appendAll(liveRows, syntheticRows);
  const commit = gitHead(repoRoot);

  const comparePath = flagValue("--compare");
  const compare: O.Option<Compare> = yield* O.match(comparePath, {
    onNone: () => Effect.succeedNone,
    onSome: (baselinePath) =>
      Effect.gen(function* () {
        const baseline = yield* fs.readFileString(baselinePath).pipe(Effect.flatMap(S.decodeEffect(ReportJson)));
        const differences = yield* compareReports({ live: repoRoot, synthetic }, scenarios, baseline, rows);
        const unclassified = A.filter(differences, (entry) => entry.class === "unclassified");
        return O.some<Compare>({
          baseline: baselinePath,
          ...(P.isUndefined(baseline.commit) ? {} : { baselineCommit: baseline.commit }),
          differences,
          intended: A.length(differences) - A.length(unclassified),
          unclassified: A.length(unclassified),
          ok: A.isReadonlyArrayEmpty(unclassified),
        });
      }),
  });

  const report: Report = {
    schemaVersion: 1,
    ...O.match(commit, { onNone: () => ({}), onSome: (sha) => ({ commit: sha }) }),
    tool: TOOL,
    generatedAt: DateTime.formatIso(yield* DateTime.now),
    scenarios: rows,
    ...O.match(compare, { onNone: () => ({}), onSome: (value) => ({ compare: value }) }),
  };
  const encoded = yield* encodeReport(report);
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(encoded),
    onSome: (out) => fs.writeFileString(out, `${encoded}\n`),
  });
  yield* fs.remove(synthetic, { recursive: true, force: true });

  const failures = A.filter(rows, (row) => !row.outcome.ok);
  yield* Console.log(
    `${A.length(rows)} scenarios (${A.length(LIVE_SCENARIOS)} live, ${A.length(SYNTHETIC_SCENARIOS)} synthetic), ${A.length(failures)} failed outcome(s)`
  );
  if (O.isNone(compare)) {
    return;
  }
  yield* Console.log(
    `${A.length(compare.value.differences)} difference(s): ${compare.value.intended} intended, ${compare.value.unclassified} unclassified`
  );
  for (const entry of compare.value.differences) {
    yield* Console.log(
      `  ${entry.class === "unclassified" ? "UNCLASSIFIED" : entry.class.padEnd(22)} ${entry.scenario}: ${entry.detail}`
    );
  }
  if (!compare.value.ok) {
    return yield* new EcosystemPolarityDifferentialFailed({
      reason: `${compare.value.unclassified} unclassified difference(s) against ${compare.value.baseline}`,
    });
  }
});

program().pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
