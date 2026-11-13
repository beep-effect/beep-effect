import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { LenientManifest } from "@beep/package-json/LenientManifest";
import { ChangeAtom, ChangeAtomKind, ChangeClassifier, ChangeSet, RouteError } from "@beep/repo-cli/commands/Ci";
import { LintPolicySweeps } from "@beep/repo-cli/commands/Quality/Quality.schemas";
import { CoverageFullScope, CoverageNoopScope, CoverageSelectedScope } from "@beep/repo-cli/test/Quality";
import { ComputeProfileError, ComputeProfileProbe, makeComputeProfileProbe } from "@beep/repo-cli/test/RepoRun";
import { configStringOption } from "@beep/repo-cli/test/SharedInternals";
import {
  applyComputeProfileLabel,
  COMPUTE_PROFILE_WORKER_SKIP_REASON,
  collectExpectationRewrites,
  collectFinalCheckRoute,
  computeProfileFinalCheckSkips,
  EXPECTATION_DIFF_OVERFLOW,
  ExpectationRewrite,
  FINAL_CHECK_GATE_SET_DIGEST,
  FINAL_CHECK_RECEIPT_DIR,
  FINAL_CHECK_RECEIPT_VERSION,
  FinalCheckGate,
  FinalCheckPlannedStep,
  FinalCheckReceipt,
  FinalCheckRoute,
  FinalCheckRouteGate,
  FinalCheckSkip,
  FinalCheckStepResult,
  finalCheckGateSetRefusal,
  finalCheckRefusal,
  findExpectationRewrites,
  forcedWorkerFinalCheckLines,
  forcedWorkerGates,
  parseFinalCheckGates,
  parseFinalCheckSkips,
  planFinalCheckRoute,
  planFinalCheckSteps,
  readFinalCheckReceipt,
  readYeetComputeProfile,
  resolveFinalCheckProfileSkips,
  rewrittenTestFiles,
  routeFinalCheckRunForTesting,
  routeFinalCheckStepsForProfile,
  runFinalCheckGatesForTesting,
  verifyExpectationRewrites,
  vitestReplayArgs,
  YEET_WORKER_PUBLISH_BODY_SENTENCE,
  YeetEnsuredPullRequest,
  YeetInboxRowJson,
  YeetPublishOwnRouteFlags,
  YeetPublishPostureInput,
  yeetPublishKeepsOwnRoute,
  yeetPublishPostureFor,
  yeetWorkerPublishBody,
} from "@beep/repo-cli/test/Yeet";
import { QualityTaskStep } from "@beep/repo-cli-kit/process/index";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { assertInclude, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { recordedGithub } from "./support/YeetGithub.ts";
import type { ScriptResult } from "@beep/commands/ScriptedSpawner";
import type { CoverageAffectedScope } from "@beep/repo-cli/test/Quality";
import type { FinalCheckVerdict } from "@beep/repo-cli/test/Yeet";

const encodeJsonText = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const HEAD = Str.repeat(40)("a");
const encodeReceiptJson = S.encodeUnknownEffect(S.fromJsonString(FinalCheckReceipt));
const decodeReceiptJson = S.decodeEffect(S.fromJsonString(FinalCheckReceipt));
const BASE = Str.repeat(40)("b");

// #2215 rewrote this expectation to match #2212's over-escaped `@`
// (ba0efdf11c, packages/tooling/tool/cli/test/yeet.test.ts:2375).
const MASKING_DIFF = A.join(
  [
    "diff --git a/packages/tooling/tool/cli/test/yeet.test.ts b/packages/tooling/tool/cli/test/yeet.test.ts",
    "index 5e0320ec5f..651379b01f 100644",
    "--- a/packages/tooling/tool/cli/test/yeet.test.ts",
    "+++ b/packages/tooling/tool/cli/test/yeet.test.ts",
    "@@ -2375 +2375 @@ printf '%s\\\\n' '{\"number\":874}'",
    '-      expect(markdown).toContain("# Yeet Quality Packet: @beep/repo\\\\-cli");',
    '+      expect(markdown).toContain("# Yeet Quality Packet: \\\\@beep/repo\\\\-cli");',
  ],
  "\n"
);

type ReceiptOverrides = {
  readonly headSha?: string;
  readonly complete?: boolean;
  readonly verdict?: FinalCheckVerdict;
  readonly steps?: ReadonlyArray<FinalCheckStepResult>;
};

const receiptOf = (overrides: ReceiptOverrides = {}) =>
  FinalCheckReceipt.make({
    headSha: overrides.headSha ?? HEAD,
    mergeBase: BASE,
    base: "origin/main",
    complete: overrides.complete ?? true,
    verdict: overrides.verdict ?? "pass",
    startedAt: "2026-10-24T00:00:00.000Z",
    finishedAt: "2026-10-24T00:10:00.000Z",
    steps: overrides.steps ?? [],
    expectationRewrites: [],
  });

// A receipt as a pre-versioning `yeet final-check` wrote it: v1, no gate set.
const legacyV1ReceiptJson = (headSha: string, schemaVersion = "yeet-final-check/v1") =>
  `{"schemaVersion":"${schemaVersion}","headSha":"${headSha}","mergeBase":"${BASE}","base":"origin/main","complete":true,"verdict":"pass","startedAt":"2026-10-24T00:00:00.000Z","finishedAt":"2026-10-24T00:10:00.000Z","steps":[],"expectationRewrites":[]}\n`;

const failedStep = (gate: FinalCheckGate) =>
  FinalCheckStepResult.make({
    gate,
    label: `final-check:${gate}`,
    hostedContext: "Heavy / Check",
    command: "bun run beep ci lane check",
    status: "failed",
    durationMs: 10,
    reason: "exit 2",
  });

describe("findExpectationRewrites", () => {
  it("flags #2215's rewritten expectation with its new line number", () => {
    const rewrites = findExpectationRewrites(MASKING_DIFF);
    expect(rewrites).toHaveLength(1);
    expect(rewrites[0]).toMatchObject({ testFile: "packages/tooling/tool/cli/test/yeet.test.ts", line: 2375 });
    expect(rewrites[0]?.removed).toContain("@beep/repo");
    expect(rewrites[0]?.added).toContain("\\\\@beep/repo");
  });

  it("ignores newly added assertions, non-assertion edits and non-test files", () => {
    const diff = A.join(
      [
        "diff --git a/pkg/test/a.test.ts b/pkg/test/a.test.ts",
        "+++ b/pkg/test/a.test.ts",
        "@@ -0,0 +5,2 @@",
        '+    expect(value).toBe("new")',
        "+    assertTrue(flag)",
        "@@ -9 +11 @@",
        "-    const fixture = 1",
        "+    const fixture = 2",
        "diff --git a/pkg/src/a.ts b/pkg/src/a.ts",
        "+++ b/pkg/src/a.ts",
        "@@ -1 +1 @@",
        '-expect("a").toBe("a")',
        '+expect("b").toBe("b")',
      ],
      "\n"
    );
    expect(findExpectationRewrites(diff)).toEqual([]);
  });

  it("pairs each added assertion with a removed one across hunks and files", () => {
    const diff = A.join(
      [
        "diff --git a/p/test/a.test.ts b/p/test/a.test.ts",
        "--- a/p/test/a.test.ts",
        "+++ b/p/test/a.test.ts",
        "@@ -3,2 +3,2 @@",
        "-  assert.strictEqual(x, 1)",
        "-  expect(y).toEqual([1])",
        "+  assert.strictEqual(x, 2)",
        "+  expect(y).toEqual([2])",
        "diff --git a/p/test/b.spec.tsx b/p/test/b.spec.tsx",
        "+++ b/p/test/b.spec.tsx",
        "@@ -7 +7,2 @@",
        "-  deepStrictEqual(a, b)",
        "+  deepStrictEqual(a, c)",
        "+  deepStrictEqual(a, d)",
      ],
      "\n"
    );
    const rewrites = findExpectationRewrites(diff);
    expect(A.map(rewrites, (rewrite) => [rewrite.testFile, rewrite.line])).toEqual([
      ["p/test/a.test.ts", 3],
      ["p/test/a.test.ts", 4],
      ["p/test/b.spec.tsx", 7],
      ["p/test/b.spec.tsx", 8],
    ]);
    expect(rewrites[3]?.removed).toBe("deepStrictEqual(a, b)");
    expect(rewrittenTestFiles(rewrites)).toEqual([
      ["p/test/a.test.ts", 2],
      ["p/test/b.spec.tsx", 2],
    ]);
  });

  it("maps an edited snapshot to its test file and skips added-only snapshots", () => {
    const diff = A.join(
      [
        "diff --git a/p/test/__snapshots__/render.test.ts.snap b/p/test/__snapshots__/render.test.ts.snap",
        "+++ b/p/test/__snapshots__/render.test.ts.snap",
        "@@ -4 +4 @@",
        '-exports[`render 1`] = `"old"`;',
        '+exports[`render 1`] = `"new"`;',
        "@@ -0,0 +9 @@",
        '+exports[`render 2`] = `"added"`;',
      ],
      "\n"
    );
    expect(findExpectationRewrites(diff)).toEqual([
      ExpectationRewrite.make({
        testFile: "p/test/render.test.ts",
        line: 4,
        removed: 'exports[`render 1`] = `"old"`;',
        added: 'exports[`render 1`] = `"new"`;',
      }),
    ]);
  });

  // #2247: Biome reflowed a block and re-indented its unchanged expectations.
  it("treats a whitespace-only reflow of assertion lines as no rewrite", () => {
    const diff = A.join(
      [
        "diff --git a/p/test/w.test.ts b/p/test/w.test.ts",
        "+++ b/p/test/w.test.ts",
        "@@ -10,3 +10,3 @@",
        "-    expect(a).toBe(1)",
        "-    expect(b).toEqual([1,  2])",
        "-    const c = 3",
        "+      expect(b).toEqual([1, 2])",
        "+      expect(a).toBe(1)",
        "+      const c = 4",
      ],
      "\n"
    );
    expect(findExpectationRewrites(diff)).toEqual([]);
  });

  it("still flags a one-token change inside a reflowed block", () => {
    const diff = A.join(
      [
        "diff --git a/p/test/w.test.ts b/p/test/w.test.ts",
        "+++ b/p/test/w.test.ts",
        "@@ -10,2 +10,2 @@",
        "-    expect(a).toBe(1)",
        "-    expect(b).toEqual([1, 2])",
        "+      expect(a).toBe(1)",
        "+      expect(b).toEqual([1, 3])",
      ],
      "\n"
    );
    expect(findExpectationRewrites(diff)).toEqual([
      ExpectationRewrite.make({
        testFile: "p/test/w.test.ts",
        line: 11,
        removed: "expect(b).toEqual([1, 2])",
        added: "expect(b).toEqual([1, 3])",
      }),
    ]);
  });

  it("treats a deleted test file as no rewrite", () => {
    const diff = A.join(
      [
        "diff --git a/p/test/gone.test.ts b/p/test/gone.test.ts",
        "--- a/p/test/gone.test.ts",
        "+++ /dev/null",
        "@@ -1 +0,0 @@",
        "-  expect(a).toBe(1)",
      ],
      "\n"
    );
    expect(findExpectationRewrites(diff)).toEqual([]);
  });
});

describe("vitestReplayArgs", () => {
  const file = "test/a.test.ts";
  const manifestWith = (scripts: Record<string, string>) => LenientManifest.make({ scripts, rest: {}, issues: [] });

  it("replays under Bun when the package's beep:test runs vitest with --bun", () => {
    const manifest = manifestWith({ "beep:test": "bunx --bun vitest run --passWithNoTests" });
    expect(vitestReplayArgs(manifest, file)).toEqual(["--bun", "vitest", "run", file]);
  });

  it("replays plain when beep:test runs vitest without --bun", () => {
    const manifest = manifestWith({ "beep:test": "bunx vitest run", test: "bunx --bun vitest" });
    expect(vitestReplayArgs(manifest, file)).toEqual(["vitest", "run", file]);
  });

  // Both real mixed shapes: most files run on Bun, one named file runs plain.
  it.each([
    [
      "bunx --bun vitest run --passWithNoTests --exclude=test/integration/** --exclude=test/import-boundary.test.ts && bunx vitest run test/import-boundary.test.ts",
      "test/import-boundary.test.ts",
    ],
    [
      "bunx --bun vitest run --exclude=test/TsNativeApi.test.ts && bunx vitest run test/TsNativeApi.test.ts",
      "test/TsNativeApi.test.ts",
    ],
  ])("uses the runtime of the segment that names the file in %s", (script, named) => {
    const manifest = manifestWith({ "beep:test": script });
    expect(vitestReplayArgs(manifest, named)).toEqual(["vitest", "run", named]);
    expect(vitestReplayArgs(manifest, "test/other.test.ts")).toEqual(["--bun", "vitest", "run", "test/other.test.ts"]);
  });

  it("falls back to the test script, then to a plain replay", () => {
    expect(vitestReplayArgs(manifestWith({ test: "bun --bun vitest run" }), file)).toEqual([
      "--bun",
      "vitest",
      "run",
      file,
    ]);
    expect(vitestReplayArgs(manifestWith({}), file)).toEqual(["vitest", "run", file]);
  });
});

describe("planFinalCheckSteps", () => {
  it("replays every subprocess gate through the hosted lane argv scoped to the merge base", () => {
    const steps = planFinalCheckSteps("/repo", BASE, ["goals/x/ops/check.ts", "packages/a/src/a.ts"]);
    const gates = A.dedupe(A.map(steps, (step) => step.gate));
    expect(gates).toEqual(A.filter(FinalCheckGate.literals, (gate) => gate !== "expectation-rewrite"));
    const argv = (label: string) => O.getOrThrow(A.findFirst(steps, (step) => step.step.label === label)).step.args;
    expect(argv("final-check:check")).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "check",
      "--affected",
      "--base",
      BASE,
      "--summarize",
    ]);
    expect(argv("final-check:docgen")).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "docgen",
      "--mode",
      "auto",
      "--base",
      BASE,
    ]);
    expect(argv("final-check:fallow")).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "fallow",
      "--base",
      BASE,
      "--validate-envelopes",
    ]);
    expect(argv("final-check:repo-sanity")).toEqual(["run", "beep", "ci", "lane", "repo-sanity", "--changeset-status"]);
    expect(argv("final-check:lint-policy:laws")).toEqual(["run", "beep", "lint", "policy", "--base", BASE]);
    expect(argv("final-check:lint-policy:docs")).toEqual([
      "oxlint",
      ".",
      "--config",
      ".oxlintrc.docs.json",
      "--max-warnings=0",
    ]);
    expect(argv("final-check:lint-policy:deprecated-apis")).toEqual([
      "run",
      "beep",
      "lint",
      "deprecated-apis",
      "--full",
    ]);
    const coverage = O.getOrThrow(A.findFirst(steps, (step) => step.gate === "coverage")).step;
    expect(coverage.args).toEqual(["run", "coverage", "--affected"]);
    expect(coverage.env).toEqual({ TURBO_SCM_BASE: BASE });
    expect(A.every(steps, (step) => step.step.cwd === "/repo")).toBe(true);
    expect(argv("final-check:lint:changed-files")).toEqual([
      "biome",
      "check",
      "--files-ignore-unknown=true",
      "--no-errors-on-unmatched",
      "goals/x/ops/check.ts",
      "packages/a/src/a.ts",
    ]);
    expect(planFinalCheckSteps(BASE, ["goals/x/ops/check.ts", "packages/a/src/a.ts"])("/repo")).toEqual(steps);
    const withoutFiles = planFinalCheckSteps("/repo", BASE, []);
    expect(A.some(withoutFiles, (step) => step.step.label === "final-check:lint:changed-files")).toBe(false);
  });
});

describe("routeFinalCheckStepsForProfile", () => {
  const planned = planFinalCheckSteps("/repo", BASE, []);
  const repoSanityArgs = (steps: ReadonlyArray<FinalCheckPlannedStep>) =>
    A.map(
      A.filter(steps, (entry) => entry.gate === "repo-sanity"),
      (entry) => entry.step.args
    );
  const runsCommand = (steps: ReadonlyArray<FinalCheckPlannedStep>, fragment: string) =>
    A.some(steps, (entry) => Str.includes(fragment)(A.join(entry.step.args, " ")));

  it("runs only the changeset status check for repo-sanity on worker", () => {
    const routed = routeFinalCheckStepsForProfile({ planned, profile: "worker", forceLocal: false });

    expect(repoSanityArgs(routed)).toEqual([["run", "beep", "quality", "changeset-status", "--since", "origin/main"]]);
    expect(runsCommand(routed, "ci lane repo-sanity")).toBe(false);
    expect(runsCommand(routed, "schema-catalog")).toBe(false);
  });

  it("leaves every other gate and the step identity unchanged on worker", () => {
    const routed = routeFinalCheckStepsForProfile({ planned, profile: "worker", forceLocal: false });

    expect(A.map(routed, (entry) => entry.step.label)).toEqual(A.map(planned, (entry) => entry.step.label));
    expect(A.filter(routed, (entry) => entry.gate !== "repo-sanity")).toEqual(
      A.filter(planned, (entry) => entry.gate !== "repo-sanity")
    );
  });

  it("keeps the whole plan on workstation, test files included", () => {
    const changed = ["packages/a/test/a.test.ts"];
    const withTests = planFinalCheckSteps("/repo", BASE, changed);
    expect(routeFinalCheckStepsForProfile({ planned, profile: "workstation", forceLocal: false })).toEqual(planned);
    expect(
      routeFinalCheckStepsForProfile({
        planned: withTests,
        profile: "workstation",
        forceLocal: true,
        changedFiles: changed,
      })
    ).toEqual(withTests);
  });

  // goals/compute-profile-gate-routing: forced coverage holds one task at a time, Fallow is refused
  // (GateRoute.schemas.ts) so its argv is untouched, and the full repo-sanity lane's catalog scan
  // (5.2 GB on dankserver) stays refused.
  it("runs forced coverage one task at a time on worker and keeps repo-sanity narrowed", () => {
    const routed = routeFinalCheckStepsForProfile({ planned, profile: "worker", forceLocal: true });
    const argsOf = (gate: string) =>
      A.map(
        A.filter(routed, (entry) => entry.gate === gate),
        (entry) => entry.step.args
      );

    const coverageArgs = argsOf("coverage");
    const sanityArgs = repoSanityArgs(routed);
    const untouched = A.filter(routed, (entry) => !A.contains(["coverage", "repo-sanity"], entry.gate));
    expect(coverageArgs).toEqual([["run", "coverage", "--affected", "--concurrency=1"]]);
    expect(sanityArgs).toEqual([["run", "beep", "quality", "changeset-status", "--since", "origin/main"]]);
    expect(untouched).toEqual(A.filter(planned, (entry) => !A.contains(["coverage", "repo-sanity"], entry.gate)));
  });

  // Lint Policy is hosted-only on worker; its effect-vitest pass costs one parse per file, so the
  // worker's lint gate runs it over the diff's files in the effect-vitest scope.
  it("adds the scoped effect-vitest check after the lint steps on worker", () => {
    const changed = [
      "packages/a/src/a.ts",
      "packages/a/test/a.test.ts",
      "packages/a/test/support/fixture.ts",
      "goals/x.md",
    ];
    const routed = routeFinalCheckStepsForProfile({
      planned: planFinalCheckSteps("/repo", BASE, changed),
      profile: "worker",
      forceLocal: false,
      changedFiles: changed,
    });
    const labels = A.map(
      A.filter(routed, (entry) => entry.gate === "lint"),
      (entry) => entry.step.label
    );
    expect(labels).toEqual([
      "final-check:lint",
      "final-check:lint:changed-files",
      "final-check:lint:effect-vitest-files",
    ]);
    const scoped = O.getOrThrow(
      A.findFirst(routed, (entry) => entry.step.label === "final-check:lint:effect-vitest-files")
    );
    expect(scoped.step.args).toEqual([
      "run",
      "beep",
      "lint",
      "effect-vitest",
      "--files",
      "packages/a/test/a.test.ts",
      "--files",
      "packages/a/test/support/fixture.ts",
    ]);
    expect(scoped.hostedContext).toContain("Heavy / Lint Policy");
    const untested = ["packages/a/src/a.ts"];
    expect(
      A.some(
        routeFinalCheckStepsForProfile({
          planned: planFinalCheckSteps("/repo", BASE, untested),
          profile: "worker",
          forceLocal: false,
          changedFiles: untested,
        }),
        (entry) => entry.step.label === "final-check:lint:effect-vitest-files"
      )
    ).toBe(false);
  });
});

describe("forced final-check on a worker", () => {
  const PUSH_ROUTE = "push with `bun run beep yeet open --body-file <md>` and let hosted CI prove it";
  const selected = CoverageSelectedScope.make({ packageNames: ["@beep/types", "@beep/utils"] });
  const full = CoverageFullScope.make({ reasons: ["package.json changed"] });
  const forcedRouting = (coverageScope?: O.Option<CoverageAffectedScope>) => ({
    gates: FinalCheckGate.literals,
    operatorSkips: [],
    profile: "worker" as const,
    forceLocal: true,
    ...(coverageScope === undefined ? {} : { coverageScope }),
  });

  it("skips every gate but coverage and names each refusal with its measurement and the push route", () => {
    const forced = computeProfileFinalCheckSkips(forcedRouting());
    const lines = forcedWorkerFinalCheckLines(forcedRouting());
    const refusals = A.dropRight(lines, 1);
    expect(A.map(forced, (skip) => skip.gate)).toEqual(["cheap-gates", "lint-policy", "check", "docgen", "fallow"]);
    expect(A.every(forced, (skip) => skip.reason === "compute-profile=worker")).toBe(true);
    expect(A.map(refusals, (line) => Str.split(line, " ")[4])).toEqual([
      "cheap-gates",
      "lint-policy",
      "repo-sanity",
      "check",
      "docgen",
      "fallow",
    ]);
    expect(A.every(refusals, Str.startsWith("[yeet] final-check --force-local refused "))).toBe(true);
    expect(A.every(refusals, Str.endsWith(`; ${PUSH_ROUTE}`))).toBe(true);
    expect(lines[0]).toContain("5.2 GB");
    expect(lines[3]).toContain("2.59 GB");
    expect(lines[4]).toContain("no measured worker budget");
    expect(lines[5]).toContain("523 s");
    expect(lines[6]).toBe(
      "[yeet] final-check --force-local on the worker profile runs coverage one task at a time (concurrency 1)"
    );
  });

  it("names the packages a selected coverage plan measures", () => {
    const routing = O.some(selected).pipe(forcedRouting);
    const lines = forcedWorkerFinalCheckLines(routing);
    const gates = forcedWorkerGates(routing);
    expect(A.takeRight(lines, 2)).toEqual([
      "[yeet] final-check --force-local on the worker profile runs coverage one task at a time (concurrency 1)",
      "[yeet] final-check --force-local measures coverage for @beep/types, @beep/utils (this diff's affected plan)",
    ]);
    expect(gates).toEqual(["coverage"]);
  });

  it("forces a noop coverage plan without naming packages", () => {
    const routing = O.some(CoverageNoopScope.make({})).pipe(forcedRouting);
    const lines = forcedWorkerFinalCheckLines(routing);
    const last = A.last(lines);
    assertSome(
      last,
      "[yeet] final-check --force-local on the worker profile runs coverage one task at a time (concurrency 1)"
    );
  });

  it("refuses coverage whose plan falls back to the whole workspace or could not be read", () => {
    const fullRouting = O.some(full).pipe(forcedRouting);
    const unreadRouting = O.none().pipe(forcedRouting);
    const fullSkips = computeProfileFinalCheckSkips(fullRouting);
    const fullLines = forcedWorkerFinalCheckLines(fullRouting);
    const unreadLines = forcedWorkerFinalCheckLines(unreadRouting);
    const unreadGates = forcedWorkerGates(unreadRouting);
    expect(A.map(fullSkips, (skip) => skip.gate)).toContain("coverage");
    const fullLast = A.last(fullLines);
    const unreadLast = A.last(unreadLines).pipe(O.map(Str.includes("could not be read")));
    assertSome(
      fullLast,
      `[yeet] final-check --force-local refused coverage on the worker profile: its affected plan falls back to the whole workspace (package.json changed): no measured worker budget; ${PUSH_ROUTE}`
    );
    assertSome(unreadLast, true);
    expect(unreadGates).toEqual([]);
  });

  it("forces no gate the change route skips and keeps the profile skips unchanged", () => {
    const routing = { ...O.some(selected).pipe(forcedRouting), routeSkipped: ["coverage" as const] };
    const gates = forcedWorkerGates(routing);
    const lines = forcedWorkerFinalCheckLines(routing);
    const skips = computeProfileFinalCheckSkips(routing);
    expect(gates).toEqual([]);
    expect(A.filter(lines, Str.includes("coverage"))).toEqual([]);
    expect(A.map(skips, (skip) => skip.gate)).toEqual(["cheap-gates", "lint-policy", "check", "docgen", "fallow"]);
  });

  it("forces nothing unforced or off worker", () => {
    const gates = FinalCheckGate.literals;
    const unforced = forcedWorkerGates({ gates, operatorSkips: [], profile: "worker", forceLocal: false });
    const workstation = forcedWorkerGates({ gates, operatorSkips: [], profile: "workstation", forceLocal: true });
    expect(unforced).toEqual([]);
    expect(workstation).toEqual([]);
  });

  it("prints nothing unforced or off worker, and no concurrency line when every forced gate is refused", () => {
    const gates = FinalCheckGate.literals;
    expect(forcedWorkerFinalCheckLines({ gates, operatorSkips: [], profile: "worker", forceLocal: false })).toEqual([]);
    expect(forcedWorkerFinalCheckLines({ gates, operatorSkips: [], profile: "workstation", forceLocal: true })).toEqual(
      []
    );
    const onlyCheck = forcedWorkerFinalCheckLines({
      gates: ["check", "coverage"],
      operatorSkips: [FinalCheckSkip.make({ gate: "coverage", reason: "hosted CI proves it" })],
      profile: "worker",
      forceLocal: true,
    });
    expect(A.length(onlyCheck)).toBe(1);
    expect(onlyCheck[0]).toContain("refused check");
  });
});

describe("full-policy final-check planning", () => {
  it("forces full policy and preserves its config in both calling forms", () => {
    const sweeps = LintPolicySweeps.make({ schemaVersion: "lint-policy-sweeps/v1", deprecatedApis: "oxlint" });
    const allSteps = planFinalCheckSteps("/repo", BASE, [], sweeps);
    const steps = A.filter(allSteps, (entry) => entry.gate === "lint-policy");
    expect(planFinalCheckSteps(BASE, [], sweeps)("/repo")).toEqual(allSteps);
    expect(A.map(steps, (entry) => entry.step.label)).toEqual(["final-check:lint-policy:laws"]);
    expect(steps[0]?.step.args).toEqual(["run", "beep", "lint", "policy", "--full", "--base", BASE]);
  });

  it("retains the independent full deprecated sweep when policy uses Turbo", () => {
    const steps = A.filter(
      planFinalCheckSteps(
        "/repo",
        BASE,
        [],
        LintPolicySweeps.make({
          schemaVersion: "lint-policy-sweeps/v1",
          deprecatedApis: "turbo",
        })
      ),
      (entry) => entry.gate === "lint-policy"
    );
    expect(A.map(steps, (entry) => entry.step.label)).toEqual([
      "final-check:lint-policy:laws",
      "final-check:lint-policy:deprecated-apis",
    ]);
    expect(steps[0]?.step.args).toContain("--full");
    expect(steps[1]?.step.args).toEqual(["run", "beep", "lint", "deprecated-apis", "--full"]);
  });
});

describe("final-check flag parsing", () => {
  it.effect("selects every gate by default and a comma-separated subset in run order", () =>
    Effect.gen(function* () {
      const parsedFinalCheckGates = yield* parseFinalCheckGates([]);
      expect(parsedFinalCheckGates).toEqual(FinalCheckGate.literals);
      const parsedFinalCheckGates1 = yield* parseFinalCheckGates(["docgen,check", " lint "]);
      expect(parsedFinalCheckGates1).toEqual(["lint", "check", "docgen"]);
    })
  );

  it.effect("refuses an unknown gate", () =>
    Effect.gen(function* () {
      const error = yield* parseFinalCheckGates(["check,heavy"]).pipe(Effect.flip);
      expect(error.message).toContain("Unknown final-check gate(s): heavy");
    })
  );

  it.effect("parses skips and refuses one without a reason or with an unknown gate", () =>
    Effect.gen(function* () {
      const skips = yield* parseFinalCheckSkips(["coverage = admission waited 10 minutes"]);
      expect(skips).toMatchObject([{ gate: "coverage", reason: "admission waited 10 minutes" }]);
      expect((yield* parseFinalCheckSkips(["coverage"]).pipe(Effect.flip)).message).toContain("--skip must be");
      expect((yield* parseFinalCheckSkips(["coverage="]).pipe(Effect.flip)).message).toContain("--skip must be");
      expect((yield* parseFinalCheckSkips(["nope=x"]).pipe(Effect.flip)).message).toContain("Valid gates");
    })
  );
});

describe("finalCheckRefusal", () => {
  it("admits only a complete passing receipt for the exact head", () => {
    assertNone(finalCheckRefusal(O.some(receiptOf()), HEAD));
    assertNone(O.some(receiptOf()).pipe(finalCheckRefusal(HEAD)));
    expect(O.getOrThrow(finalCheckRefusal(O.none(), HEAD))).toContain("no final-check receipt for head aaaaaaaaaaaa");
    expect(O.getOrThrow(finalCheckRefusal(O.some(receiptOf({ headSha: BASE })), HEAD))).toContain(
      "is for bbbbbbbbbbbb, not head aaaaaaaaaaaa"
    );
    expect(O.getOrThrow(finalCheckRefusal(O.some(receiptOf({ complete: false })), HEAD))).toContain("--gates subset");
    expect(
      O.getOrThrow(
        finalCheckRefusal(
          O.some(
            receiptOf({ verdict: "fail", steps: [failedStep("check"), failedStep("check"), failedStep("docgen")] })
          ),
          HEAD
        )
      )
    ).toContain("final-check failed on check, docgen");
  });

  it("records the sorted gate set and writes v2 by default", () => {
    const receipt = receiptOf();
    expect(receipt.schemaVersion).toBe(FINAL_CHECK_RECEIPT_VERSION);
    expect(receipt.gateSetDigest).toBe(FINAL_CHECK_GATE_SET_DIGEST);
    expect(FINAL_CHECK_GATE_SET_DIGEST).toBe(A.join(A.sort(FinalCheckGate.literals, Order.String), ","));
  });

  it.effect("refuses a v1 receipt on the head itself, naming the version and the re-run", () =>
    Effect.gen(function* () {
      const legacy = yield* decodeReceiptJson(legacyV1ReceiptJson(HEAD));
      expect(legacy.schemaVersion).toBe("yeet-final-check/v1");
      const refusal = finalCheckRefusal(O.some(legacy), HEAD);
      assertSome(
        refusal,
        "the final-check receipt is yeet-final-check/v1, written before receipts recorded their gate set; re-run `bun run beep yeet final-check` on the committed head"
      );
    })
  );

  it.effect("refuses a v2 receipt written under another gate set and names the difference", () =>
    Effect.gen(function* () {
      const smaller = FinalCheckReceipt.make({ ...receiptOf(), gateSetDigest: "cheap-gates,check,retired-gate" });
      const refusal = O.getOrThrow(finalCheckRefusal(O.some(smaller), HEAD));
      assertInclude(refusal, "written under another gate set");
      assertInclude(refusal, "added expectation-rewrite, lint-policy, lint, repo-sanity, docgen, fallow, coverage");
      assertInclude(refusal, "removed retired-gate");
      assertInclude(refusal, "re-run `bun run beep yeet final-check`");
      const unrecorded = yield* decodeReceiptJson(legacyV1ReceiptJson(HEAD, FINAL_CHECK_RECEIPT_VERSION));
      assertSome(
        finalCheckGateSetRefusal(unrecorded),
        "the final-check receipt records no gate set; re-run `bun run beep yeet final-check` on the committed head"
      );
    })
  );
});

// git and bun install succeed unless their command names a failing step; the
// merge-base vitest run fails for test files whose path says `masked`, and for
// `bun-only` files (they call a Bun API) replayed without `--bun`.
const scriptedSpawner = (failing: ReadonlyArray<string> = []) =>
  ScriptedSpawner.make((command, args) => {
    const line = A.join([command, ...args], " ");
    if (A.some(failing, (fragment) => Str.includes(fragment)(line))) return { exit: 1 };
    const bunOnlyOnNode = Str.includes("bun-only")(line) && !A.contains(args, "--bun");
    return { exit: command === "bunx" && (Str.includes("masked")(line) || bunOnlyOnNode) ? 1 : 0 };
  });

const platformWith = (failing: ReadonlyArray<string> = []) =>
  Layer.provideMerge(
    Git.layer,
    Layer.mergeAll(MemoryFileSystem.layer, Path.layer, BunCrypto.layer, scriptedSpawner(failing).layer)
  );

// A moved test tree as #2241 made it: one modified file whose diff is wider than
// the 512 KiB capture bound, one small modification, one rename with a changed
// assertion, and an add plus a delete that must never be diffed.
const WIDE_DIFF = Str.repeat(600 * 1024)("x");
const smallDiff = (path: string, from: string, to: string) =>
  A.join(
    [
      `diff --git a/${path} b/${path}`,
      `--- a/${path}`,
      `+++ b/${path}`,
      "@@ -7 +7 @@",
      `-  expect(out).toBe("${from}")`,
      `+  expect(out).toBe("${to}")`,
    ],
    "\n"
  );
const treeMoveGit = () =>
  ScriptedSpawner.make((command, args) => {
    const line = A.join([command, ...args], " ");
    if (Str.includes("--name-only")(line)) return { stdout: "pkg/test/huge.test.ts\0pkg/test/small.test.ts\0" };
    if (Str.includes("--name-status")(line)) {
      return {
        stdout:
          "R090\0old/test/moved.test.ts\0new/test/moved.test.ts\0A\0new/test/added.test.ts\0D\0old/test/gone.test.ts\0",
      };
    }
    if (Str.includes("huge.test.ts")(line)) return { stdout: WIDE_DIFF };
    if (Str.includes("small.test.ts")(line)) return { stdout: smallDiff("pkg/test/small.test.ts", "a", "b") };
    if (Str.includes("moved.test.ts")(line)) return { stdout: smallDiff("new/test/moved.test.ts", "c", "d") };
    return {};
  });

it.layer(Layer.mergeAll(BunCrypto.layer, Path.layer), { timeout: "30 seconds" })(
  "collectExpectationRewrites over a moved test tree",
  (it) => {
    it.effect("diffs modified and renamed files one at a time and survives a file wider than the capture bound", () =>
      Effect.gen(function* () {
        const spawner = treeMoveGit();
        const rewrites = yield* collectExpectationRewrites("/repo", BASE).pipe(
          Effect.provideServiceEffect(Git, Git.make),
          provideSpawner(spawner)
        );
        expect(rewrites).toEqual([
          ExpectationRewrite.make({
            testFile: "pkg/test/huge.test.ts",
            line: 0,
            removed: EXPECTATION_DIFF_OVERFLOW,
            added: EXPECTATION_DIFF_OVERFLOW,
          }),
          ExpectationRewrite.make({
            testFile: "pkg/test/small.test.ts",
            line: 7,
            removed: 'expect(out).toBe("a")',
            added: 'expect(out).toBe("b")',
          }),
          ExpectationRewrite.make({
            testFile: "new/test/moved.test.ts",
            baseFile: "old/test/moved.test.ts",
            line: 7,
            removed: 'expect(out).toBe("c")',
            added: 'expect(out).toBe("d")',
          }),
        ]);
        const ran = A.map(spawner.spawns, (spawn) => A.join([spawn.command, ...spawn.args], " "));
        const diffs = A.filter(ran, Str.includes("--unified=0"));
        expect(diffs).toHaveLength(3);
        expect(A.some(diffs, Str.includes("*.test.ts"))).toBe(false);
        expect(A.some(ran, Str.includes("added.test.ts"))).toBe(false);
        expect(A.some(ran, Str.includes("gone.test.ts"))).toBe(false);
        assertSome(
          A.findFirst(diffs, Str.includes("moved.test.ts")),
          `git diff --no-color --no-ext-diff --unified=0 --find-renames=50% --end-of-options ${BASE} HEAD -- old/test/moved.test.ts new/test/moved.test.ts`
        );
      })
    );
  }
);

// Scripted git for the listing and per-file failure paths of the collector.
type GitScript = (line: string) => ScriptResult.Encoded;
const collectWith = (script: GitScript) =>
  collectExpectationRewrites("/repo", BASE).pipe(
    Effect.provideServiceEffect(Git, Git.make),
    provideSpawner(ScriptedSpawner.make((command, args) => script(A.join([command, ...args], " "))))
  );
const spawnFailure = PlatformError.systemError({
  _tag: "NotFound",
  module: "Command",
  method: "spawn",
  pathOrDescriptor: "git",
  description: "git is not installed",
});

it.layer(Layer.mergeAll(BunCrypto.layer, Path.layer), { timeout: "30 seconds" })(
  "collectExpectationRewrites failure paths",
  (it) => {
    it.effect("returns nothing when no test file was modified or renamed", () =>
      Effect.gen(function* () {
        const collectWith2 = yield* collectWith(() => ({}));
        expect(collectWith2).toEqual([]);
      })
    );

    it.effect("maps a snapshot overflow to its test file and drops a non-test .snap", () =>
      Effect.gen(function* () {
        const rewrites = yield* collectWith((line) =>
          Str.includes("--name-only")(line)
            ? { stdout: "pkg/fixtures/data.snap\0pkg/test/__snapshots__/render.test.ts.snap\0" }
            : Str.includes("--unified=0")(line)
              ? { stdout: WIDE_DIFF }
              : {}
        );
        // A `.snap` outside __snapshots__ names no test, so its overflow yields nothing.
        expect(A.map(rewrites, (rewrite) => rewrite.testFile)).toEqual(["pkg/test/render.test.ts"]);
        expect(A.every(rewrites, (rewrite) => rewrite.removed === EXPECTATION_DIFF_OVERFLOW)).toBe(true);
      })
    );

    it.effect("fails with the command when a per-file diff exits non-zero", () =>
      Effect.gen(function* () {
        const error = yield* collectWith((line) =>
          Str.includes("--name-only")(line)
            ? { stdout: "pkg/test/a.test.ts\0" }
            : { exit: Str.includes("--unified=0")(line) ? 128 : 0 }
        ).pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "YeetCommandError", exitCode: 128 });
        expect(error.message).toContain("pkg/test/a.test.ts failed with exit code 128");
      })
    );

    it.effect("fails when the rename table cannot be read, is malformed, or exits non-zero", () =>
      Effect.gen(function* () {
        const listingOnly = (nameStatus: ScriptResult.Encoded) =>
          collectWith((line) => (Str.includes("--name-status")(line) ? nameStatus : {})).pipe(Effect.flip);
        expect((yield* listingOnly(spawnFailure)).message).toContain("Failed to run git diff --name-status");
        expect((yield* listingOnly({ stdout: "R090\0only-one-path\0" })).message).toContain("malformed rename table");
        expect((yield* listingOnly({ exit: 1 })).message).toContain("failed with exit code 1");
      })
    );
  }
);

const rewriteIn = (testFile: string) => ExpectationRewrite.make({ testFile, line: 3, removed: "a", added: "b" });

// TestClock pins the worktree suffix to 0; HOME comes from the ambient config.
const seedBaseWorktree = Effect.fnUntraced(function* (
  files: ReadonlyArray<string>,
  contents: Readonly<Record<string, string>> = {}
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configStringOption3 = yield* configStringOption("HOME");
  const home = O.getOrElse(configStringOption3, () => "/repo");
  const baseRoot = path.join(home, ".cache", "beep", "final-check", `base-${Str.slice(0, 12)(BASE)}-0`);
  yield* Effect.forEach(
    files,
    (file) =>
      fs.makeDirectory(path.dirname(path.join(baseRoot, file)), { recursive: true }).pipe(
        Effect.andThen(
          fs.writeFileString(
            path.join(baseRoot, file),
            O.getOrElse(R.get(contents, file), () => "{}")
          )
        )
      ),
    { discard: true }
  );
});

it.layer(platformWith(), { timeout: "30 seconds" })("expectation rewrites replayed on the merge base", (it) => {
  it.effect("classifies a base-red test file as masking and a base-green one as following the diff", () =>
    Effect.gen(function* () {
      yield* seedBaseWorktree([
        "pkg/package.json",
        "pkg/test/masked.test.ts",
        "pkg/test/honest.test.ts",
        "pkg/test/old-name.test.ts",
        "loose/orphan.test.ts",
      ]);
      const verdicts = yield* verifyExpectationRewrites("/repo", BASE, [
        rewriteIn("pkg/test/masked.test.ts"),
        rewriteIn("pkg/test/masked.test.ts"),
        rewriteIn("pkg/test/honest.test.ts"),
        ExpectationRewrite.make({
          testFile: "pkg/test/new-name.test.ts",
          baseFile: "pkg/test/old-name.test.ts",
          line: 3,
          removed: "a",
          added: "b",
        }),
        rewriteIn("pkg/test/missing.test.ts"),
        rewriteIn("loose/orphan.test.ts"),
      ]);
      expect(A.map(verdicts, (verdict) => [verdict.testFile, verdict.classification, verdict.rewrites])).toEqual([
        ["pkg/test/masked.test.ts", "masks-base-red", 2],
        ["pkg/test/honest.test.ts", "follows-diff", 1],
        // A renamed file is replayed where the merge base holds it.
        ["pkg/test/new-name.test.ts", "follows-diff", 1],
        ["pkg/test/missing.test.ts", "unverified", 1],
        ["loose/orphan.test.ts", "unverified", 1],
      ]);
      expect(verdicts[0]?.detail).toContain("vitest exit 1");
    })
  );
});

it.layer(platformWith(), { timeout: "30 seconds" })("merge-base replay runtime", (it) => {
  it.effect("replays each test file under its owning package's declared test runtime", () =>
    Effect.gen(function* () {
      yield* seedBaseWorktree(
        [
          "bunpkg/package.json",
          "bunpkg/test/bun-only.test.ts",
          "nodepkg/package.json",
          "nodepkg/test/bun-only.test.ts",
          "badpkg/package.json",
          "badpkg/test/a.test.ts",
        ],
        {
          "bunpkg/package.json": '{"scripts":{"beep:test":"bunx --bun vitest run"}}',
          "nodepkg/package.json": '{"scripts":{"beep:test":"bunx vitest run"}}',
          "badpkg/package.json": "{not json",
        }
      );
      const verdicts = yield* verifyExpectationRewrites("/repo", BASE, [
        rewriteIn("bunpkg/test/bun-only.test.ts"),
        rewriteIn("nodepkg/test/bun-only.test.ts"),
        rewriteIn("badpkg/test/a.test.ts"),
      ]);
      expect(A.map(verdicts, (verdict) => [verdict.testFile, verdict.classification])).toEqual([
        ["bunpkg/test/bun-only.test.ts", "follows-diff"],
        ["nodepkg/test/bun-only.test.ts", "masks-base-red"],
        ["badpkg/test/a.test.ts", "unverified"],
      ]);
      expect(verdicts[2]?.detail).toContain("package.json");
    })
  );
});

it.layer(platformWith(["worktree add"]), { timeout: "30 seconds" })(
  "merge-base worktree that cannot be created",
  (it) => {
    it.effect("reports every rewritten file as unverified", () =>
      Effect.gen(function* () {
        const verdicts = yield* verifyExpectationRewrites("/repo", BASE, [rewriteIn("pkg/test/a.test.ts")]);
        expect(verdicts).toMatchObject([{ classification: "unverified", detail: "git worktree add exited 1" }]);
      })
    );
  }
);

it.layer(platformWith(["install --frozen-lockfile"]), { timeout: "30 seconds" })(
  "merge-base worktree that cannot be installed",
  (it) => {
    it.effect("reports every rewritten file as unverified", () =>
      Effect.gen(function* () {
        const verdicts = yield* verifyExpectationRewrites("/repo", BASE, [rewriteIn("pkg/test/a.test.ts")]);
        expect(verdicts[0]?.detail).toContain("bun install in the merge-base worktree exited 1");
      })
    );
  }
);

it.layer(platformWith(), { timeout: "30 seconds" })("final-check receipts on disk", (it) => {
  it.effect("reads a written receipt and treats an absent or malformed one as none", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = "/repo";
      const readFinalCheckReceipt4 = yield* readFinalCheckReceipt(root, HEAD);
      assertNone(readFinalCheckReceipt4);
      const dir = path.join(root, FINAL_CHECK_RECEIPT_DIR);
      yield* fs.makeDirectory(dir, { recursive: true });
      const encoded = yield* encodeReceiptJson(receiptOf());
      yield* fs.writeFileString(path.join(dir, `${HEAD}.json`), encoded);
      const readFinalCheckReceipt5 = yield* readFinalCheckReceipt(root, HEAD);
      assertSome(readFinalCheckReceipt5, receiptOf());
      yield* fs.writeFileString(path.join(dir, `${BASE}.json`), "{not json");
      const readFinalCheckReceipt6 = yield* readFinalCheckReceipt(root, BASE);
      assertNone(readFinalCheckReceipt6);
    })
  );

  it.effect("reads a v1 receipt from disk so the refusal can name it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = path.join("/repo", FINAL_CHECK_RECEIPT_DIR);
      yield* fs.makeDirectory(dir, { recursive: true });
      yield* fs.writeFileString(path.join(dir, `${HEAD}.json`), legacyV1ReceiptJson(HEAD));
      const legacy = yield* readFinalCheckReceipt("/repo", HEAD);
      const refusal = O.getOrThrow(finalCheckRefusal(legacy, HEAD));
      assertInclude(refusal, "yeet-final-check/v1");
    })
  );

  it.effect("creates no merge-base worktree when nothing was rewritten", () =>
    Effect.gen(function* () {
      const verifyExpectationRewrites7 = yield* verifyExpectationRewrites("/nonexistent-repo", BASE, []);
      expect(verifyExpectationRewrites7).toEqual([]);
    })
  );
});

const packetAtom = ChangeAtom.make({
  kind: "packet",
  path: "goals/demo/README.md",
  digest: "packet",
  pkg: O.none(),
  detail: O.none(),
});
const refinementId = "packet-markdown-out-of-build-check";
const routedGateRun = Effect.fn("FinalCheckTest.routedGateRun")(function* (
  revoked: ReadonlyArray<string>,
  exitCode: number
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "final-check-route-" });
  const route = planFinalCheckRoute([packetAtom], "footprint", revoked);
  const result = yield* runFinalCheckGatesForTesting(
    {
      repoRoot: root,
      headSha: HEAD,
      mergeBase: BASE,
      planned: [
        FinalCheckPlannedStep.make({
          gate: "check",
          hostedContext: "Heavy / Check",
          step: QualityTaskStep.make({
            label: "final-check:check",
            command: "sh",
            args: ["-c", `echo ran > ran; exit ${exitCode}`],
            cwd: root,
          }),
        }),
      ],
      skips: [],
      resume: false,
      route,
    },
    ["check"],
    false
  );
  return { root, route, result };
});

// One coverage step that leaves a `ran` marker and fails, so a run that spawns it is visible.
const coverageGateRun = Effect.fn("FinalCheckTest.coverageGateRun")(function* (
  coverageScope: CoverageAffectedScope,
  skips: ReadonlyArray<FinalCheckSkip>,
  route: O.Option<FinalCheckRoute>
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "final-check-coverage-" });
  const run = {
    repoRoot: root,
    headSha: HEAD,
    mergeBase: BASE,
    planned: [
      FinalCheckPlannedStep.make({
        gate: "coverage",
        hostedContext: "Heavy / Coverage Regression, Test Unit (affected packages)",
        step: QualityTaskStep.make({
          label: "final-check:coverage",
          command: "sh",
          args: ["-c", "echo ran > ran; exit 1"],
          cwd: root,
        }),
      }),
    ],
    skips,
    resume: false,
    coverageScope,
  };
  const result = yield* runFinalCheckGatesForTesting(
    O.match(route, { onNone: () => run, onSome: (value) => ({ ...run, route: value }) }),
    ["coverage"],
    false
  );
  const ran = yield* fs.exists(`${root}/ran`);
  return { result, ran };
});

describe("final-check verification routing", () => {
  it.effect("old receipt without route still decodes", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeEffect(FinalCheckReceipt)(receiptOf());
      expect(decoded.route).toBeUndefined();
      expect(decoded.schemaVersion).toBe("yeet-final-check/v2");
    })
  );

  it.layer(NodeCommandTestLayer, { timeout: "30 seconds" })("gate execution and shadow sentinel", (it) => {
    it.effect("enforced skip records the route reason without running the gate", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { root, route, result } = yield* routedGateRun([], 7);
        expect(result.steps[0]?.status).toBe("skipped");
        expect(result.steps[0]?.reason).toBe(`route:${refinementId}`);
        const ran = yield* fs.exists(`${root}/ran`);
        expect(ran).toBe(false);
        expect(A.findFirst(route.gates, (gate) => gate.gate === "check")).toMatchObject({
          value: { proofKey: "key-change" },
        });
      })
    );

    it.effect("shadow-skip that passes runs the gate without recording a miss", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { root, route, result } = yield* routedGateRun([refinementId], 0);
        expect(A.findFirst(route.gates, (gate) => gate.gate === "check")).toMatchObject({
          value: { decision: "shadow-skipped" },
        });
        expect(result.steps[0]?.status).toBe("passed");
        expect(result.shadowMisses).toEqual([]);
        const ran = yield* fs.exists(`${root}/ran`);
        expect(ran).toBe(true);
        const inboxExists = yield* fs.exists(`${root}/.beep/inbox/failures.ndjson`);
        expect(inboxExists).toBe(false);
      })
    );

    it.effect("shadow-skip that fails records a key-change miss and a refinement inbox row", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { root, result } = yield* routedGateRun([refinementId], 7);
        expect(result.steps[0]?.status).toBe("failed");
        expect(result.shadowMisses).toHaveLength(1);
        expect(result.shadowMisses[0]).toMatchObject({
          gate: "check",
          refinements: [refinementId],
          proofKey: "key-change",
        });
        const text = yield* fs.readFileString(`${root}/.beep/inbox/failures.ndjson`);
        const row = yield* YeetInboxRowJson.decode(Str.trim(text));
        expect(row).toMatchObject({
          severity: "P0",
          kind: "local-shard-failed",
          capsule: { headSha: HEAD, shard: `route-shadow-miss:${refinementId}:check` },
        });
      })
    );

    it.effect("revoked refinement runs the gate after reading the sentinel at the requested head", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const text = yield* encodeJsonText({
          revoked: [{ id: refinementId, reason: "shadow miss" }],
        });
        const route = yield* collectFinalCheckRoute("/repo", BASE, HEAD).pipe(
          Effect.provideService(
            ChangeClassifier,
            ChangeClassifier.of({
              classify: Effect.fn("ChangeClassifier.classify")((input) => {
                expect(input.head).toBe(HEAD);
                expect(input.base).toBe(BASE);
                return Effect.succeed(
                  ChangeSet.make({ base: BASE, head: HEAD, atoms: [packetAtom], changedPaths: [packetAtom.path] })
                );
              }),
            })
          ),
          Effect.provideService(
            Git,
            Git.of({
              ...git,
              show: dual(
                3,
                Effect.fn("Git.show")((_root: string, revision: string, path: string) => {
                  expect(revision).toBe(HEAD);
                  expect(path).toBe("standards/verification-route.sentinel.json");
                  return Effect.succeedSome(text);
                })
              ),
            })
          )
        );
        expect(A.findFirst(route.gates, (entry) => entry.gate === "check")).toMatchObject({
          value: { decision: "shadow-skipped" },
        });
        const { result } = yield* routedGateRun([refinementId], 0);
        expect(result.steps[0]?.status).toBe("passed");
      })
    );

    it.effect("route error selects every gate with route-unavailable evidence", () =>
      Effect.gen(function* () {
        const route = yield* collectFinalCheckRoute("/repo", BASE, HEAD).pipe(
          Effect.provideService(
            ChangeClassifier,
            ChangeClassifier.of({
              classify: Effect.fn("ChangeClassifier.classify")(() =>
                Effect.fail(RouteError.new("classify", "fixture classification failed"))
              ),
            })
          )
        );
        expect(route.reason).toBe("route-unavailable");
        expect(A.map(route.gates, (entry) => entry.gate)).toEqual(FinalCheckGate.literals);
        expect(
          A.every(route.gates, (entry) => entry.decision === "selected" && entry.reason === "route-unavailable")
        ).toBe(true);
      })
    );

    it.effect("absent sentinel preserves enforced decisions", () =>
      Effect.gen(function* () {
        const git = yield* Git;
        const route = yield* collectFinalCheckRoute("/repo", BASE, HEAD).pipe(
          Effect.provideService(
            ChangeClassifier,
            ChangeClassifier.of({
              classify: Effect.fn("ChangeClassifier.classify")(() =>
                Effect.succeed(
                  ChangeSet.make({ base: BASE, head: HEAD, atoms: [packetAtom], changedPaths: [packetAtom.path] })
                )
              ),
            })
          ),
          Effect.provideService(
            Git,
            Git.of({
              ...git,
              show: dual(3, (_root: string, _revision: string, _path: string) => Effect.succeedNone),
            })
          )
        );
        expect(A.findFirst(route.gates, (entry) => entry.gate === "check")).toMatchObject({
          value: { decision: "skipped" },
        });
        expect(
          A.map(
            A.filter(route.gates, (entry) => entry.lane === "none"),
            (entry) => entry.decision
          )
        ).toEqual(["selected", "selected"]);
      })
    );
  });

  it.layer(NodeCommandTestLayer, { timeout: "30 seconds" })("coverage gate affected-scope noop", (it) => {
    it.effect("records a passed step with the noop reason and runs nothing", () =>
      Effect.gen(function* () {
        const { result, ran } = yield* coverageGateRun(CoverageNoopScope.make({}), [], O.none());
        expect(result.steps).toHaveLength(1);
        expect(result.steps[0]).toMatchObject({
          gate: "coverage",
          label: "final-check:coverage",
          status: "passed",
          durationMs: 0,
          reason: "no affected packages",
        });
        expect(result.shadowMisses).toEqual([]);
        expect(ran).toBe(false);
      })
    );

    it.effect("runs the coverage step for a selected scope", () =>
      Effect.gen(function* () {
        const { result, ran } = yield* coverageGateRun(
          CoverageSelectedScope.make({ packageNames: ["@beep/b"], dependentPackageNames: [] }),
          [],
          O.none()
        );
        expect(result.steps[0]?.status).toBe("failed");
        expect(ran).toBe(true);
      })
    );

    it.effect("keeps an operator skip ahead of a noop scope", () =>
      Effect.gen(function* () {
        const { result, ran } = yield* coverageGateRun(
          CoverageNoopScope.make({}),
          [FinalCheckSkip.make({ gate: "coverage", reason: "x" })],
          O.none()
        );
        expect(result.steps[0]).toMatchObject({ status: "skipped", reason: "x" });
        expect(ran).toBe(false);
      })
    );

    it.effect("keeps a route skip ahead of a noop scope", () =>
      Effect.gen(function* () {
        const route = FinalCheckRoute.make({
          footprintDigest: "footprint",
          atomsByKind: R.map(ChangeAtomKind.Enum, () => 0),
          gates: [
            FinalCheckRouteGate.make({
              gate: "coverage",
              lane: "coverage",
              decision: "skipped",
              refinements: [],
              reason: "route:test",
            }),
          ],
          shadowMisses: [],
          reason: "footprint",
        });
        const { result, ran } = yield* coverageGateRun(CoverageNoopScope.make({}), [], O.some(route));
        expect(result.steps[0]).toMatchObject({ status: "skipped", reason: "route:test" });
        expect(ran).toBe(false);
      })
    );

    // PR #3281 review (beep-reviewer P2, CodeRabbit): a coverage gate the change route skips never
    // runs, so a forced worker run must not count it as forced, print its concurrency line, record
    // forceLocal: true, or journal a bypass row for it.
    it.effect("does not count a route-skipped coverage gate as forced on a worker", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "final-check-route-forced-" });
        const route = FinalCheckRoute.make({
          footprintDigest: "footprint",
          atomsByKind: R.map(ChangeAtomKind.Enum, () => 0),
          gates: [
            FinalCheckRouteGate.make({
              gate: "coverage",
              lane: "coverage",
              decision: "skipped",
              refinements: [],
              reason: "route:test",
            }),
          ],
          shadowMisses: [],
          reason: "footprint",
        });
        const planned = {
          repoRoot: root,
          headSha: HEAD,
          mergeBase: BASE,
          planned: [
            FinalCheckPlannedStep.make({
              gate: "coverage",
              hostedContext: "Heavy / Coverage Regression, Test Unit (affected packages)",
              step: QualityTaskStep.make({
                label: "final-check:coverage",
                command: "sh",
                args: ["-c", "echo ran > ran; exit 1"],
                cwd: root,
              }),
            }),
          ],
          skips: [],
          resume: false,
          route,
        };
        const routed = yield* routeFinalCheckRunForTesting(planned, {
          gates: ["check", "coverage"],
          operatorSkips: [],
          profile: "worker",
          forceLocal: true,
        });
        const result = yield* runFinalCheckGatesForTesting(routed.run, ["coverage"], false);
        const ran = yield* fs.exists(`${root}/ran`);
        const skipGates = A.map(routed.profileSkips, (skip) => skip.gate);
        expect(routed.forced).toBe(false);
        expect(A.filter(routed.forcedLines, Str.includes("one task at a time"))).toEqual([]);
        expect(A.map(routed.forcedLines, (line) => Str.split(line, " ")[4])).toEqual(["check"]);
        expect(skipGates).toEqual(["check"]);
        expect(routed.workerRoutes).toEqual([["check", "refusal"]]);
        expect(result.steps[0]).toMatchObject({ gate: "coverage", status: "skipped", reason: "route:test" });
        expect(ran).toBe(false);
      })
    );
  });
});

// compute-profile-gate-routing P1: final-check auto-skips hosted-only gates on
// a worker host, and a plain publish there takes the yeet open posture.
const PROFILE_GIB = 1024 ** 3;
const probeWithCeiling = (constrainedGib: number) =>
  makeComputeProfileProbe({
    constrainedMemoryBytes: () => constrainedGib * PROFILE_GIB,
    totalMemoryBytes: () => 125 * PROFILE_GIB,
    residentBytes: () => 0,
  });
const workerProbe = probeWithCeiling(7);
const workstationProbe = probeWithCeiling(0);
const skipLines = (skips: ReadonlyArray<{ readonly gate: string; readonly reason: string }>) =>
  A.map(skips, (skip) => `${skip.gate}=${skip.reason}`);

describe("final-check compute-profile skips", () => {
  it.effect("auto-skips every hosted-only gate on a worker and keeps the local gates planned", () =>
    Effect.gen(function* () {
      const { computeProfile, profileSkips } = yield* resolveFinalCheckProfileSkips(FinalCheckGate.literals, [], false);
      expect(computeProfile).toBe("worker");
      expect(skipLines(profileSkips)).toStrictEqual(
        A.map(
          ["cheap-gates", "lint-policy", "check", "docgen", "fallow", "coverage"],
          (gate) => `${gate}=${COMPUTE_PROFILE_WORKER_SKIP_REASON}`
        )
      );
    }).pipe(Effect.provideService(ComputeProfileProbe, workerProbe))
  );

  it.effect("keeps only the gates a worker cannot force under --force-local", () =>
    Effect.gen(function* () {
      const { profileSkips } = yield* resolveFinalCheckProfileSkips(FinalCheckGate.literals, [], true);
      expect(skipLines(profileSkips)).toStrictEqual(
        A.map(
          ["cheap-gates", "lint-policy", "check", "docgen", "fallow"],
          (gate) => `${gate}=${COMPUTE_PROFILE_WORKER_SKIP_REASON}`
        )
      );
    }).pipe(Effect.provideService(ComputeProfileProbe, workerProbe))
  );

  it.effect("leaves the workstation plan unchanged", () =>
    Effect.gen(function* () {
      const { computeProfile, profileSkips } = yield* resolveFinalCheckProfileSkips(FinalCheckGate.literals, [], false);
      expect(computeProfile).toBe("workstation");
      expect(profileSkips).toStrictEqual([]);
    }).pipe(Effect.provideService(ComputeProfileProbe, workstationProbe))
  );

  it.effect("lets an operator --skip win over the auto-skip for the same gate", () =>
    Effect.gen(function* () {
      const operator = yield* parseFinalCheckSkips(["coverage=admission waited 10 minutes"]);
      const profileSkips = computeProfileFinalCheckSkips({
        gates: ["check", "coverage"],
        operatorSkips: operator,
        profile: "worker",
        forceLocal: false,
      });
      expect(skipLines(profileSkips)).toStrictEqual([`check=${COMPUTE_PROFILE_WORKER_SKIP_REASON}`]);
      const coverage = A.filter(A.appendAll(operator, profileSkips), (skip) => skip.gate === "coverage");
      expect(skipLines(coverage)).toStrictEqual(["coverage=admission waited 10 minutes"]);
    })
  );

  it.effect("decodes a receipt written before computeProfile and forceLocal existed", () =>
    Effect.gen(function* () {
      const receipt = yield* S.decodeEffect(FinalCheckReceipt)({
        schemaVersion: "yeet-final-check/v1",
        headSha: "a",
        mergeBase: "b",
        base: "origin/main",
        complete: true,
        verdict: "pass",
        startedAt: "2026-11-08T00:00:00.000Z",
        finishedAt: "2026-11-08T00:01:00.000Z",
        steps: [],
        expectationRewrites: [],
      });
      expect(receipt.computeProfile).toBeUndefined();
      expect(receipt.forceLocal).toBeUndefined();
    })
  );
});

describe("yeet publish posture", () => {
  const posture = (input: Parameters<typeof YeetPublishPostureInput.make>[0]) =>
    yeetPublishPostureFor(YeetPublishPostureInput.make(input));

  it("takes the open posture for a plain publish on a worker", () => {
    expect(posture({ profile: "worker", mode: "publish" })).toBe("open");
  });

  it("keeps publish under --force-local, on a workstation, for other modes and commit-reusing flags", () => {
    expect(posture({ profile: "worker", mode: "publish", forceLocal: true })).toBe("publish");
    expect(posture({ profile: "workstation", mode: "publish" })).toBe("publish");
    expect(posture({ profile: "worker", mode: "verify" })).toBe("publish");
    expect(posture({ profile: "worker", mode: "publish", keepsOwnRoute: true })).toBe("publish");
  });
});

describe("yeet publish worker helpers", () => {
  it("keeps its own route when any commit-reusing or detach flag is set", () => {
    const flags = ["detach", "proveFirst", "pushOnly", "reuseVerified", "amend", "noEdit", "stagedOnly"] as const;
    expect(yeetPublishKeepsOwnRoute(YeetPublishOwnRouteFlags.make({}))).toBe(false);
    expect(
      A.map(flags, (flag) => yeetPublishKeepsOwnRoute(YeetPublishOwnRouteFlags.make({ [flag]: true })))
    ).toStrictEqual(A.replicate(true, 7));
  });

  it("synthesizes the worker body with and without a commit message", () => {
    expect(yeetWorkerPublishBody("  feat: add x  ")).toBe(`feat: add x\n\n${YEET_WORKER_PUBLISH_BODY_SENTENCE}.\n`);
    expect(yeetWorkerPublishBody("   ")).toBe(`${YEET_WORKER_PUBLISH_BODY_SENTENCE}.\n`);
  });
});

describe("readYeetComputeProfile", () => {
  it.effect("returns the resolved profile", () =>
    Effect.gen(function* () {
      const profile = yield* readYeetComputeProfile("yeet publish");
      expect(profile).toBe("worker");
    }).pipe(Effect.provideService(ComputeProfileProbe, workerProbe))
  );

  it.effect("maps an unreadable probe to a labelled exit-2 command error", () =>
    Effect.gen(function* () {
      const error = yield* readYeetComputeProfile("yeet publish").pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetCommandError", exitCode: 2, message: "yeet publish: bad override" });
    }).pipe(
      Effect.provideService(ComputeProfileProbe, {
        resolve: Effect.fail(ComputeProfileError.make({ message: "bad override" })),
        resolveFor: () => Effect.fail(ComputeProfileError.make({ message: "bad override" })),
      })
    )
  );
});

describe("applyComputeProfileLabel", () => {
  const pullRequest = YeetEnsuredPullRequest.make({ number: 7, created: true });
  const labelCalls = (github: ReturnType<typeof recordedGithub>) =>
    A.filter(github.calls, (call) => Str.endsWith("/issues/7/labels")(call.path));

  it.effect("adds the worker label on a worker host", () =>
    Effect.gen(function* () {
      const github = recordedGithub(() => ({ body: [{ name: "compute-profile-worker" }] }));
      yield* github.provide(applyComputeProfileLabel(pullRequest));
      expect(A.length(labelCalls(github))).toBe(1);
      const lines = yield* TestConsole.logLines;
      expect(A.map(lines, String)).toContain("[yeet] applied compute-profile-worker to PR #7");
    }).pipe(Effect.provideService(ComputeProfileProbe, workerProbe))
  );

  it.effect("warns with the manual command when the label add fails", () =>
    Effect.gen(function* () {
      const github = recordedGithub(() => ({ status: 500, body: { message: "boom" } }));
      yield* github.provide(applyComputeProfileLabel(pullRequest));
      const lines = yield* TestConsole.errorLines;
      expect(A.join(A.map(lines, String), "\n")).toContain(
        "[yeet] warning: could not apply compute-profile-worker to PR #7; run: gh api -X POST"
      );
    }).pipe(Effect.provideService(ComputeProfileProbe, workerProbe))
  );

  it.effect("does nothing on a workstation or an unreadable probe", () =>
    Effect.gen(function* () {
      const github = recordedGithub(() => ({ body: [] }));
      yield* github.provide(applyComputeProfileLabel(pullRequest));
      yield* github.provide(
        applyComputeProfileLabel(pullRequest).pipe(
          Effect.provideService(ComputeProfileProbe, {
            resolve: Effect.fail(ComputeProfileError.make({ message: "bad override" })),
            resolveFor: () => Effect.fail(ComputeProfileError.make({ message: "bad override" })),
          })
        )
      );
      expect(labelCalls(github)).toStrictEqual([]);
    }).pipe(Effect.provideService(ComputeProfileProbe, workstationProbe))
  );
});

describe("final-check wire schemas", () => {
  it.effect.prop(
    "round trips the receipt step and publish posture schemas",
    [Arbitrary.schema(FinalCheckStepResult), Arbitrary.schema(YeetPublishPostureInput)],
    Effect.fnUntraced(function* ([step, posture]) {
      const stepEncoded = yield* S.encodeEffect(FinalCheckStepResult)(step);
      const stepDecoded = yield* S.decodeEffect(FinalCheckStepResult)(stepEncoded);
      assertTrue(S.toEquivalence(FinalCheckStepResult)(stepDecoded, step));
      const postureEncoded = yield* S.encodeEffect(YeetPublishPostureInput)(posture);
      const postureDecoded = yield* S.decodeEffect(YeetPublishPostureInput)(postureEncoded);
      assertTrue(S.toEquivalence(YeetPublishPostureInput)(postureDecoded, posture));
    })
  );
});
