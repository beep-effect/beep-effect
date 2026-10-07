/**
 * The five runner gates of goal section 8: parity, check, lint, test and
 * docgen, each a verbatim-reproducible command sequence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { type GateName, GateFailed } from "./Audit.errors.ts";
import { listTsFiles, upstreamEntries } from "./Copy.ts";
import { type ExportEntry, exportKindCovers, type ModuleName, type AuditTarget } from "./Ledger.schema.ts";
import { foreignSpecifierLines, readExportFacets, scanUnsafeAssertions, type UnsafeAssertion } from "./Exports.ts";
import { isModuleTarget, labPaths, type RunnerConfig, upstreamPaths } from "./Paths.ts";
import { captureExit, heavy, runInherited } from "./Process.ts";
import { jsdocLawFindings } from "./JsdocLaw.ts";
import { canonFindings, coverageGaps } from "./Canon.ts";

const $I = $ScratchpadId.create("effected/runner/Gates");

/**
 * Which gate finished and how its command exited.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface GateOutcome {
  readonly gate: GateName;
  readonly exitCode: number;
}

/**
 * Prints the one-line verdict of a gate.
 *
 * **Example** (Print a verdict)
 *
 * ```ts
 * import { verdict } from "@beep/scratchpad/effected/runner/Gates"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(verdict("yaml", { gate: "check", exitCode: 0 }))) // true
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const verdict: {
  (outcome: GateOutcome): (target: AuditTarget) => Effect.Effect<void>;
  (target: AuditTarget, outcome: GateOutcome): Effect.Effect<void>;
} = dual(
  2,
  (target: AuditTarget, outcome: GateOutcome): Effect.Effect<void> =>
    Console.log(
      `[effected] ${target} ${outcome.gate}: ${outcome.exitCode === 0 ? "ok" : `red (exit ${outcome.exitCode})`}`
    )
);

const gateExit = Effect.fn("Gates.gateExit")(function* (target: AuditTarget, gate: GateName, exitCode: number) {
  yield* verdict(target, { gate, exitCode });
  if (exitCode !== 0) {
    return yield* GateFailed.make({ target, gate, exitCode, problems: [] });
  }
});

/**
 * Every repo-relative TypeScript file a target owns: its source tree, its
 * extra sources, and its test tree.
 *
 * **Example** (List a target's files)
 *
 * ```ts
 * import { targetFiles } from "@beep/scratchpad/effected/runner/Gates"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(targetFiles("/repo", "jsonc"))) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const targetFiles = Effect.fn("Gates.targetFiles")(function* (repoRoot: string, target: AuditTarget) {
  const lab = labPaths(target);
  const sources = yield* listTsFiles(repoRoot, lab.sourceDir);
  const tests = yield* listTsFiles(repoRoot, lab.testDir);
  return [...sources, ...lab.extraSources, ...tests];
});

/**
 * What the parity gate found.
 *
 * **Example** (Inspect a report)
 *
 * ```ts
 * import { ParityReport } from "@beep/scratchpad/effected/runner/Gates"
 *
 * const report = ParityReport.make({ expected: [], actual: [], added: [], problems: [], unsafe: [] })
 * console.log(report.problems.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParityReport extends S.Class<ParityReport>($I`ParityReport`)(
  {
    expected: S.Array(S.Struct({ name: S.String, kind: S.String, entry: S.String })),
    actual: S.Array(S.Struct({ name: S.String, kind: S.String, entry: S.String })),
    added: S.Array(S.Struct({ name: S.String, kind: S.String, entry: S.String })),
    problems: S.Array(S.String),
    unsafe: S.Array(S.String),
  },
  $I.annote("ParityReport", { description: "Expected versus actual exports, additions, problems and D15 findings." })
) {}

const describe = (entry: ExportEntry): string => `${entry.entry} ${entry.name} (${entry.kind})`;

/**
 * The parity gate: every upstream export name present with covering facets,
 * no `@effected/*` specifier left, and (when `strict`) zero D15 assertions.
 *
 * **Example** (Run parity for a module)
 *
 * ```ts
 * import { parity } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = parity(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc", true)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const parity = Effect.fn("Gates.parity")(function* (config: RunnerConfig, module: ModuleName, strict: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lab = labPaths(module);
  const entries = yield* upstreamEntries(config.upstreamRoot, module);
  const expected: ReadonlyArray<ExportEntry> = A.flatMap(entries, ([entry, srcRelative]) =>
    readExportFacets(path.join(config.upstreamRoot, upstreamPaths(module).srcDir, srcRelative), entry)
  );
  const actualPerEntry = yield* Effect.forEach(entries, Effect.fnUntraced(function* ([entry, srcRelative]) {
      const file = path.join(config.repoRoot, lab.sourceDir, srcRelative);
      if (!(yield* fs.exists(file))) {
        return { entry, facets: A.empty<ExportEntry>(), missingFile: O.some(`${lab.sourceDir}/${srcRelative}`) };
      }
      return { entry, facets: readExportFacets(file, entry), missingFile: O.none<string>() };
    })
  );
  const actual = A.flatMap(actualPerEntry, (result) => result.facets);
  const find = (haystack: ReadonlyArray<ExportEntry>, needle: ExportEntry): O.Option<ExportEntry> =>
    A.findFirst(haystack, (candidate) => candidate.entry === needle.entry && candidate.name === needle.name);
  const missingFiles = A.map(A.getSomes(A.map(actualPerEntry, (result) => result.missingFile)), (file) => `missing entry file ${file}`);
  const missing = A.filterMap(expected, (entry) =>
    O.isNone(find(actual, entry)) ? Result.succeed(`missing export ${describe(entry)}`) : Result.failVoid
  );
  const mismatched = A.filterMap(expected, (entry) =>
    O.match(find(actual, entry), {
      onNone: () => Result.failVoid,
      onSome: (found) =>
        exportKindCovers(found.kind, entry.kind)
          ? Result.failVoid
          : Result.succeed(`kind mismatch ${describe(entry)}: lab exports ${found.kind}`),
    })
  );
  const added = A.filter(actual, (entry) => O.isNone(find(expected, entry)));
  const files = yield* targetFiles(config.repoRoot, module);
  const foreign = yield* Effect.forEach(files, (file) =>
    Effect.map(fs.readFileString(path.join(config.repoRoot, file)), (text) => foreignSpecifierLines(file, text))
  );
  const foreignProblems = A.map(A.flatten(foreign), (line) => `@effected specifier at ${line}`);
  const unsafe: ReadonlyArray<UnsafeAssertion> = scanUnsafeAssertions(
    A.map(files, (file) => [path.join(config.repoRoot, file), file] as const)
  );
  const unsafeLines = A.map(unsafe, (finding) => finding.render());
  const problems = [
    ...missingFiles,
    ...missing,
    ...mismatched,
    ...foreignProblems,
    ...(strict ? A.map(unsafeLines, (line) => `unsafe assertion ${line}`) : []),
  ];
  const report = ParityReport.make({
    expected: A.map(expected, (entry) => ({ name: entry.name, kind: entry.kind, entry: entry.entry })),
    actual: A.map(actual, (entry) => ({ name: entry.name, kind: entry.kind, entry: entry.entry })),
    added: A.map(added, (entry) => ({ name: entry.name, kind: entry.kind, entry: entry.entry })),
    problems,
    unsafe: unsafeLines,
  });
  yield* Console.log(
    `[effected] ${module} parity: ${expected.length} expected, ${actual.length} actual, ${added.length} added, ${unsafeLines.length} unsafe assertion(s)${strict ? "" : " (advisory before S1)"}`
  );
  if (A.isReadonlyArrayNonEmpty(problems)) {
    yield* verdict(module, { gate: "parity", exitCode: 1 });
    return yield* GateFailed.make({ target: module, gate: "parity", exitCode: 1, problems });
  }
  yield* verdict(module, { gate: "parity", exitCode: 0 });
  return report;
});

/**
 * Effect diagnostics the canary file must provoke; each is a rule whose
 * reporting proves the language-service plugin and the repo severity map are
 * live (`missingPipeableSignature` is `off` upstream, so only the map turns it
 * on).
 *
 * **Example** (List the canary codes)
 *
 * ```ts
 * import { CANARY_DIAGNOSTICS } from "@beep/scratchpad/effected/runner/Gates"
 *
 * console.log(CANARY_DIAGNOSTICS.length) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CANARY_DIAGNOSTICS = ["effect(missingPipeableSignature)", "effect(strictBooleanExpressions)"] as const;

/**
 * Canary diagnostics a tsgo report failed to mention.
 *
 * **Example** (Detect a silent plugin)
 *
 * ```ts
 * import { missingCanaryDiagnostics } from "@beep/scratchpad/effected/runner/Gates"
 *
 * console.log(missingCanaryDiagnostics("x.ts(1,1): error TS2322: nope")) // ["effect(missingPipeableSignature)", "effect(strictBooleanExpressions)"]
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const missingCanaryDiagnostics = (report: string): ReadonlyArray<string> =>
  A.filter(CANARY_DIAGNOSTICS, (code) => !Str.includes(code)(report));

const canary = Effect.fn("Gates.canary")(function* (config: RunnerConfig, target: AuditTarget) {
  const result = yield* captureExit(
    heavy({
      command: "bun",
      args: ["run", "--cwd", "scratchpad", "tsgo", "-p", "effected/.canary/tsconfig.json", "--noEmit", "--pretty", "false"],
      cwd: config.repoRoot,
    })
  );
  const missing = missingCanaryDiagnostics(result.output);
  if (result.exitCode === 0 || A.isReadonlyArrayNonEmpty(missing)) {
    yield* verdict(target, { gate: "check", exitCode: 1 });
    return yield* GateFailed.make({
      target,
      gate: "check",
      exitCode: 1,
      problems: [
        "effect diagnostics are not live: the canary at scratchpad/effected/.canary was not flagged",
        ...A.map(missing, (code) => `canary missing ${code}`),
      ],
    });
  }
  yield* Console.log(`[effected] ${target} check: effect diagnostics live (canary flagged ${CANARY_DIAGNOSTICS.length} rules)`);
});

/**
 * The check gate: proves Effect diagnostics are live with the canary, then
 * runs tsgo (TypeScript plus Effect diagnostics) on the target's tsconfig,
 * both admitted through `beep-heavy`.
 *
 * **Example** (Run the check gate)
 *
 * ```ts
 * import { check } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(check(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc"))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const check = Effect.fn("Gates.check")(function* (config: RunnerConfig, target: AuditTarget) {
  yield* canary(config, target);
  const exitCode = yield* runInherited(
    heavy({
      command: "bun",
      args: ["run", "--cwd", "scratchpad", "tsgo", "-p", `effected/${target}/tsconfig.json`, "--noEmit", "--pretty", "false"],
      cwd: config.repoRoot,
    })
  );
  yield* gateExit(target, "check", exitCode);
});

/**
 * The repo law canary: one file violating oxlint and each of the four laws,
 * included in every lint run so a silent tool turns the gate red.
 *
 * **Example** (Name the canary)
 *
 * ```ts
 * import { LAW_CANARY } from "@beep/scratchpad/effected/runner/Gates"
 *
 * console.log(LAW_CANARY.endsWith("LawsCanary.ts")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LAW_CANARY = "scratchpad/effected/.canary/LawsCanary.ts";

/**
 * Laws run on the real paths; `effect-imports` runs separately on a mirror.
 *
 * **Example** (List the path laws)
 *
 * ```ts
 * import { PATH_LAWS } from "@beep/scratchpad/effected/runner/Gates"
 *
 * console.log(PATH_LAWS.includes("effect-fn")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PATH_LAWS = ["effect-fn", "terse-effect", "native-runtime"] as const;

/**
 * The paths one linter run is judged against: the canary it must report and
 * the target files it must not.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ReportScope {
  readonly canaryPath: string;
  readonly targets: ReadonlyArray<string>;
}

/**
 * How one linter run treated the canary (live when reported) and the target
 * files (offenders when reported).
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ReportVerdict {
  readonly live: boolean;
  readonly offenders: ReadonlyArray<string>;
}

/**
 * Judges a linter report against its scope: a path counts as reported when a
 * line names it as `path:` or as a bare path.
 *
 * **Example** (Judge a law report)
 *
 * ```ts
 * import { judgeReport } from "@beep/scratchpad/effected/runner/Gates"
 * import { pipe } from "effect/Function"
 *
 * const scope = { canaryPath: "canary.ts", targets: ["a.ts", "b.ts"] }
 * console.log(judgeReport("- canary.ts:1:1 [rule] x", scope)) // { live: true, offenders: [] }
 * console.log(pipe("a.ts:3:1 bad", judgeReport(scope))) // { live: false, offenders: ["a.ts"] }
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const judgeReport: {
  (scope: ReportScope): (report: string) => ReportVerdict;
  (report: string, scope: ReportScope): ReportVerdict;
} = dual(2, (report: string, scope: ReportScope): ReportVerdict => {
  const lines = A.map(Str.split("\n")(report), Str.trim);
  const mentions = (file: string): boolean => Str.includes(`${file}:`)(report) || A.contains(lines, file);
  return { live: mentions(scope.canaryPath), offenders: A.filter(scope.targets, mentions) };
});

const judged = Effect.fn("Gates.judged")(function* (
  target: AuditTarget,
  tool: string,
  report: string,
  verdictOf: ReportVerdict
) {
  if (Str.isNonEmpty(Str.trim(report))) {
    yield* Console.log(Str.trimEnd(report));
  }
  if (!verdictOf.live) {
    return yield* GateFailed.make({
      target,
      gate: "lint",
      exitCode: 1,
      problems: [`${tool} did not report the canary ${LAW_CANARY}; the tool is not checking these paths`],
    });
  }
  if (A.isReadonlyArrayNonEmpty(verdictOf.offenders)) {
    return yield* GateFailed.make({
      target,
      gate: "lint",
      exitCode: 1,
      problems: A.map(verdictOf.offenders, (file) => `${tool} reported ${file}`),
    });
  }
  yield* Console.log(`[effected] ${target} lint: ${tool} clean (canary flagged)`);
});

const mirrorForImports = Effect.fn("Gates.mirrorForImports")(function* (
  config: RunnerConfig,
  target: AuditTarget,
  files: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = `coverage/effected-laws/${target}`;
  yield* fs.remove(path.join(config.repoRoot, root), { recursive: true, force: true });
  const mirrored = yield* Effect.forEach([...files, LAW_CANARY], Effect.fnUntraced(function* (file) {
      const destination = `${root}/${file}`;
      yield* fs.makeDirectory(path.dirname(path.join(config.repoRoot, destination)), { recursive: true });
      yield* fs.copyFile(path.join(config.repoRoot, file), path.join(config.repoRoot, destination));
      return destination;
    })
  );
  return { root, mirrored };
});

/**
 * The lint gate: oxlint, then the four beep laws, each run together with the
 * law canary so a tool that silently checks nothing fails the gate.
 *
 * **Details**
 *
 * `effect-fn`, `terse-effect` and `native-runtime` scan scratchpad paths and
 * run on the real files. `effect-imports` excludes `scratchpad/` by design
 * and promotes no family yet, so it runs with `--candidate` on a git-ignored
 * mirror under `coverage/effected-laws/<target>`. The laws skip test files by
 * scope; tsgo covers tests with the same Effect rules.
 *
 * **Example** (Run the lint gate)
 *
 * ```ts
 * import { lint } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(lint(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc"))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const lint = Effect.fn("Gates.lint")(function* (config: RunnerConfig, target: AuditTarget) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lab = labPaths(target);
  const directories = yield* Effect.filter([lab.sourceDir, ...lab.extraSources, lab.testDir], (directory) =>
    fs.exists(path.join(config.repoRoot, directory))
  );
  const files = yield* targetFiles(config.repoRoot, target);
  const cli = (args: ReadonlyArray<string>) =>
    captureExit({ command: "bun", args: ["packages/tooling/tool/cli/src/bin.ts", ...args], cwd: config.repoRoot });

  const oxlint = yield* captureExit({
    command: "bunx",
    args: ["--no-install", "oxlint", "--quiet", "--disable-nested-config", LAW_CANARY, ...directories],
    cwd: config.repoRoot,
  });
  yield* judged(target, "oxlint", oxlint.output, judgeReport(oxlint.output, { canaryPath: LAW_CANARY, targets: files }));

  for (const law of PATH_LAWS) {
    const run = yield* cli(["laws", law, "--check", "--include", A.join([...files, LAW_CANARY], ",")]);
    yield* judged(target, `law ${law}`, run.output, judgeReport(run.output, { canaryPath: LAW_CANARY, targets: files }));
  }

  const mirror = yield* mirrorForImports(config, target, files);
  const imports = yield* cli(["laws", "effect-imports", "--check", "--candidate", "--include", A.join(mirror.mirrored, ",")]);
  yield* judged(
    target,
    "law effect-imports (mirror)",
    imports.output,
    judgeReport(imports.output, {
      canaryPath: `${mirror.root}/${LAW_CANARY}`,
      targets: A.map(files, (file) => `${mirror.root}/${file}`),
    })
  );
  yield* gateExit(target, "lint", 0);
});

/**
 * The test gate: Node vitest through the shared effected config, with the
 * module's behaviour tests only when measuring coverage (so documentation
 * examples do not inflate covered paths, the proven jsonl recipe). With
 * coverage it also reads the coverage summary back (every source file present
 * at 100 percent) and runs the effect-vitest canon detectors over the tests.
 *
 * **Example** (Run the test gate)
 *
 * ```ts
 * import { test } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(test(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc", false))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const test = Effect.fn("Gates.test")(function* (config: RunnerConfig, target: AuditTarget, coverage: boolean) {
  const lab = labPaths(target);
  const exitCode = yield* runInherited(
    heavy({
      command: "bunx",
      args: [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "scratchpad/vitest.effected.config.ts",
        ...(coverage ? [lab.testDir, "--coverage"] : []),
      ],
      cwd: config.repoRoot,
      env: { EFFECTED_MODULE: target },
    })
  );
  if (exitCode !== 0 || !coverage) {
    return yield* gateExit(target, "test", exitCode);
  }
  const gaps = yield* coverageGaps(config, target);
  const canon = yield* canonFindings(config, target);
  for (const line of canon.excepted) {
    yield* Console.log(`[effected] ${target} test: canon exception ${line}`);
  }
  const problems = [
    ...A.map(gaps, (gap) => `coverage ${gap}`),
    ...A.map(canon.open, (finding) => `canon ${finding}`),
    ...A.map(canon.stale, (row) => `canon stale exception ${row}`),
  ];
  if (A.isReadonlyArrayNonEmpty(problems)) {
    yield* verdict(target, { gate: "test", exitCode: 1 });
    return yield* GateFailed.make({ target, gate: "test", exitCode: 1, problems });
  }
  yield* Console.log(`[effected] ${target} test: coverage summary complete at 100 percent; canon detectors clean`);
  yield* gateExit(target, "test", 0);
});

const TEMPLATE_PATH = "scratchpad/docgen.effected.template.json";

/**
 * The docgen canary: a module whose one Example does not compile, proving the
 * docgen run typechecks examples.
 *
 * **Example** (Name the docgen canary directory)
 *
 * ```ts
 * import { DOCGEN_CANARY_SRC } from "@beep/scratchpad/effected/runner/Gates"
 *
 * console.log(DOCGEN_CANARY_SRC) // "effected/.canary/docgen"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DOCGEN_CANARY_SRC = "effected/.canary/docgen";

/**
 * Writes `scratchpad/<configFile>` from the shared template with `srcDir`
 * substituted for every `effected/__MODULE__` reference.
 *
 * **Example** (Materialize a docgen config)
 *
 * ```ts
 * import { writeDocgenConfig } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const config = RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" })
 * console.log(Effect.isEffect(writeDocgenConfig(config, { srcDir: "effected/jsonc", configFile: "docgen.jsonc.json" }))) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const writeDocgenConfig = Effect.fn("Gates.writeDocgenConfig")(function* (
  config: RunnerConfig,
  options: { readonly srcDir: string; readonly configFile: string }
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const template = yield* fs.readFileString(path.join(config.repoRoot, TEMPLATE_PATH));
  const outDirName = Str.replaceAll("/", "-")(Str.replace(/^effected\//, "")(options.srcDir));
  const rendered = template
    .replaceAll("effected/__MODULE__", options.srcDir)
    .replaceAll("generated-docs/__MODULE__", `generated-docs/${outDirName}`);
  yield* fs.writeFileString(path.join(config.repoRoot, "scratchpad", options.configFile), rendered);
});

const runDocgen = (config: RunnerConfig, configFile: string) =>
  captureExit(
    heavy({
      command: "bun",
      args: ["run", "--cwd", "scratchpad", "docgen", "--config-file", configFile],
      cwd: config.repoRoot,
    })
  );

const docgenCanary = Effect.fn("Gates.docgenCanary")(function* (config: RunnerConfig, target: AuditTarget) {
  yield* writeDocgenConfig(config, { srcDir: DOCGEN_CANARY_SRC, configFile: "docgen.effected-canary.json" });
  const result = yield* runDocgen(config, "docgen.effected-canary.json");
  const live = result.exitCode !== 0 && Str.includes("DocgenCanary")(result.output) && Str.includes("TS2345")(result.output);
  if (!live) {
    yield* Console.log(result.output);
    return yield* GateFailed.make({
      target,
      gate: "docgen",
      exitCode: 1,
      problems: [`docgen did not reject the ill-typed canary example under scratchpad/${DOCGEN_CANARY_SRC}`],
    });
  }
  yield* Console.log(`[effected] ${target} docgen: example typechecking live (canary rejected)`);
});

const DOCTEST_FILES = /doctest: (\d+) file\(s\)/;

const jsdocLaw = Effect.fn("Gates.jsdocLaw")(function* (config: RunnerConfig, target: AuditTarget) {
  const path = yield* Path.Path;
  const lab = labPaths(target);
  const sources = [...(yield* listTsFiles(config.repoRoot, lab.sourceDir)), ...lab.extraSources];
  const entries = isModuleTarget(target)
    ? A.map(yield* upstreamEntries(config.upstreamRoot, target), ([, srcRelative]) => `${lab.sourceDir}/${srcRelative}`)
    : [];
  const findings = jsdocLawFindings({
    files: A.map(sources, (file) => [path.join(config.repoRoot, file), file] as const),
    entries,
  });
  if (A.isReadonlyArrayNonEmpty(findings)) {
    yield* verdict(target, { gate: "docgen", exitCode: 1 });
    return yield* GateFailed.make({ target, gate: "docgen", exitCode: 1, problems: findings });
  }
  yield* Console.log(`[effected] ${target} docgen: JSDoc law clean over ${sources.length} file(s)`);
});

/**
 * The docgen gate: proves example typechecking is live with the canary, runs
 * docgen with every enforcement flag on, then the repo doctest verifier.
 *
 * **Details**
 *
 * The repo doctest verifier discovers `packages/**` and `apps/**` only, so it
 * selects zero scratchpad files; the gate states that rather than reporting a
 * * vacuous pass. Runnable doctest fences execute in the test
 * gate through the `@effect/doctest` vitest plugin.
 *
 * **Example** (Run the docgen gate)
 *
 * ```ts
 * import { docgen } from "@beep/scratchpad/effected/runner/Gates"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(docgen(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc"))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const docgen = Effect.fn("Gates.docgen")(function* (config: RunnerConfig, target: AuditTarget) {
  yield* docgenCanary(config, target);
  yield* jsdocLaw(config, target);
  const configFile = `docgen.${target}.json`;
  yield* writeDocgenConfig(config, { srcDir: labPaths(target).docgenSrcDir, configFile });
  const generated = yield* runDocgen(config, configFile);
  yield* Console.log(Str.trimEnd(generated.output));
  if (generated.exitCode !== 0) {
    return yield* gateExit(target, "docgen", generated.exitCode);
  }
  const verified = yield* captureExit({
    command: "bun",
    args: [
      "packages/tooling/tool/cli/src/bin.ts",
      "docgen",
      "doctest",
      "verify",
      "--include",
      `${labPaths(target).sourceDir}/**/*.ts`,
    ],
    cwd: config.repoRoot,
  });
  yield* Console.log(Str.trimEnd(verified.output));
  const files = O.getOrElse(
    O.map(O.fromNullOr(DOCTEST_FILES.exec(verified.output)), (match) => Number(match[1])),
    () => -1
  );
  if (files === 0) {
    yield* Console.log(
      `[effected] ${target} docgen: doctest verify selects no scratchpad files (repo discovery is packages/** and apps/** only); runnable fences run in the test gate`
    );
  }
  yield* gateExit(target, "docgen", verified.exitCode);
});

/**
 * Which gates `audit` runs for a target at a stage: parity is strict from S1,
 * docgen joins from S2, coverage from S3; the runner runs every gate but
 * parity.
 *
 * **Example** (Plan the gates of a stage)
 *
 * ```ts
 * import { gatePlan } from "@beep/scratchpad/effected/runner/Gates"
 *
 * console.log(gatePlan("yaml", 3)) // { parity: true, strict: true, docgen: true, coverage: true }
 * console.log(gatePlan("runner", 0)) // { parity: false, strict: true, docgen: true, coverage: false }
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const gatePlan: {
  (stage: number): (target: AuditTarget) => GatePlan;
  (target: AuditTarget, stage: number): GatePlan;
} = dual(
  2,
  (target: AuditTarget, stage: number): GatePlan =>
    isModuleTarget(target)
      ? { parity: true, strict: stage >= 1, docgen: stage >= 2, coverage: stage >= 3 }
      : { parity: false, strict: true, docgen: true, coverage: false }
);

/**
 * The gates `audit` runs for one target at one stage.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface GatePlan {
  readonly parity: boolean;
  readonly strict: boolean;
  readonly docgen: boolean;
  readonly coverage: boolean;
}
