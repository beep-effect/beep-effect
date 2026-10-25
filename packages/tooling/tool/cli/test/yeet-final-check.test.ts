import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { PackageJsonDocument } from "@beep/repo-cli/test/Quality";
import { configStringOption } from "@beep/repo-cli/test/SharedInternals";
import {
  collectExpectationRewrites,
  EXPECTATION_DIFF_OVERFLOW,
  ExpectationRewrite,
  FINAL_CHECK_RECEIPT_DIR,
  FinalCheckGate,
  FinalCheckReceipt,
  FinalCheckStepResult,
  finalCheckRefusal,
  findExpectationRewrites,
  parseFinalCheckGates,
  parseFinalCheckSkips,
  planFinalCheckSteps,
  readFinalCheckReceipt,
  rewrittenTestFiles,
  verifyExpectationRewrites,
  vitestReplayArgs,
} from "@beep/repo-cli/test/Yeet";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type { FinalCheckVerdict } from "@beep/repo-cli/test/Yeet";

const HEAD = Str.repeat(40)("a");
const encodeReceiptJson = S.encodeUnknownEffect(S.fromJsonString(FinalCheckReceipt));
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
    schemaVersion: "yeet-final-check/v1",
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

  it("replays under Bun when the package's beep:test runs vitest with --bun", () => {
    const manifest = PackageJsonDocument.make({ scripts: { "beep:test": "bunx --bun vitest run --passWithNoTests" } });
    expect(vitestReplayArgs(manifest, file)).toEqual(["--bun", "vitest", "run", file]);
  });

  it("replays plain when beep:test runs vitest without --bun", () => {
    const manifest = PackageJsonDocument.make({
      scripts: { "beep:test": "bunx vitest run", test: "bunx --bun vitest" },
    });
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
    const manifest = PackageJsonDocument.make({ scripts: { "beep:test": script } });
    expect(vitestReplayArgs(manifest, named)).toEqual(["vitest", "run", named]);
    expect(vitestReplayArgs(manifest, "test/other.test.ts")).toEqual(["--bun", "vitest", "run", "test/other.test.ts"]);
  });

  it("falls back to the test script, then to a plain replay", () => {
    expect(vitestReplayArgs(PackageJsonDocument.make({ scripts: { test: "bun --bun vitest run" } }), file)).toEqual([
      "--bun",
      "vitest",
      "run",
      file,
    ]);
    expect(vitestReplayArgs(PackageJsonDocument.make({}), file)).toEqual(["vitest", "run", file]);
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
    expect(argv("final-check:effect-diagnostics")).toContain("effect-diagnostics");
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

describe("final-check flag parsing", () => {
  it.effect("selects every gate by default and a comma-separated subset in run order", () =>
    Effect.gen(function* () {
      expect(yield* parseFinalCheckGates([])).toEqual(FinalCheckGate.literals);
      expect(yield* parseFinalCheckGates(["docgen,check", " lint "])).toEqual(["lint", "check", "docgen"]);
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
});

const handle = (exitCode: number, output = "") =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(new TextEncoder().encode(output)),
    stdout: Stream.make(new TextEncoder().encode(output)),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });

// git and bun install succeed unless their command names a failing step; the
// merge-base vitest run fails for test files whose path says `masked`, and for
// `bun-only` files (they call a Bun API) replayed without `--bun`.
const scriptedSpawner = (failing: ReadonlyArray<string> = []) =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
    const line = A.join([command.command, ...command.args], " ");
    if (A.some(failing, (fragment) => Str.includes(fragment)(line))) return Effect.succeed(handle(1));
    const bunOnlyOnNode = Str.includes("bun-only")(line) && !A.contains(command.args, "--bun");
    return Effect.succeed(
      handle(command.command === "bunx" && (Str.includes("masked")(line) || bunOnlyOnNode) ? 1 : 0)
    );
  });

const platformWith = (failing: ReadonlyArray<string> = []) =>
  Layer.mergeAll(
    MemoryFileSystem.layer,
    Path.layer,
    BunCrypto.layer,
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, scriptedSpawner(failing))
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
const treeMoveGit = (commands: Ref.Ref<ReadonlyArray<string>>) =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
    const line = A.join([command.command, ...command.args], " ");
    const reply = (output: string) => Ref.update(commands, A.append(line)).pipe(Effect.as(handle(0, output)));
    if (Str.includes("--name-only")(line)) return reply("pkg/test/huge.test.ts\0pkg/test/small.test.ts\0");
    if (Str.includes("--name-status")(line)) {
      return reply(
        "R090\0old/test/moved.test.ts\0new/test/moved.test.ts\0A\0new/test/added.test.ts\0D\0old/test/gone.test.ts\0"
      );
    }
    if (Str.includes("huge.test.ts")(line)) return reply(WIDE_DIFF);
    if (Str.includes("small.test.ts")(line)) return reply(smallDiff("pkg/test/small.test.ts", "a", "b"));
    if (Str.includes("moved.test.ts")(line)) return reply(smallDiff("new/test/moved.test.ts", "c", "d"));
    return reply("");
  });

it.layer(Layer.mergeAll(BunCrypto.layer, Path.layer), { timeout: "30 seconds" })(
  "collectExpectationRewrites over a moved test tree",
  (it) => {
    it.effect("diffs modified and renamed files one at a time and survives a file wider than the capture bound", () =>
      Effect.gen(function* () {
        const commands = yield* Ref.make<ReadonlyArray<string>>([]);
        const rewrites = yield* collectExpectationRewrites("/repo", BASE).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, treeMoveGit(commands))
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
        const ran = yield* Ref.get(commands);
        const diffs = A.filter(ran, Str.includes("--unified=0"));
        expect(diffs).toHaveLength(3);
        expect(A.some(diffs, Str.includes("*.test.ts"))).toBe(false);
        expect(A.some(ran, Str.includes("added.test.ts"))).toBe(false);
        expect(A.some(ran, Str.includes("gone.test.ts"))).toBe(false);
        assertSome(
          A.findFirst(diffs, Str.includes("moved.test.ts")),
          `git diff --unified=0 --no-color --find-renames=50% ${BASE} HEAD -- old/test/moved.test.ts new/test/moved.test.ts`
        );
      })
    );
  }
);

// Scripted git for the listing and per-file failure paths of the collector.
type GitScript = (line: string) => Effect.Effect<ChildProcessSpawner.ChildProcessHandle, PlatformError.PlatformError>;
const scriptedGit = (script: GitScript) =>
  ChildProcessSpawner.make((command) =>
    ChildProcess.isStandardCommand(command)
      ? script(A.join([command.command, ...command.args], " "))
      : Effect.die("unexpected pipe")
  );
const collectWith = (script: GitScript) =>
  collectExpectationRewrites("/repo", BASE).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, scriptedGit(script))
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
        expect(yield* collectWith(() => Effect.succeed(handle(0)))).toEqual([]);
      })
    );

    it.effect("maps a snapshot overflow to its test file and drops a non-test .snap", () =>
      Effect.gen(function* () {
        const rewrites = yield* collectWith((line) =>
          Effect.succeed(
            Str.includes("--name-only")(line)
              ? handle(0, "pkg/fixtures/data.snap\0pkg/test/__snapshots__/render.test.ts.snap\0")
              : Str.includes("--unified=0")(line)
                ? handle(0, WIDE_DIFF)
                : handle(0)
          )
        );
        // A `.snap` outside __snapshots__ names no test, so its overflow yields nothing.
        expect(A.map(rewrites, (rewrite) => rewrite.testFile)).toEqual(["pkg/test/render.test.ts"]);
        expect(A.every(rewrites, (rewrite) => rewrite.removed === EXPECTATION_DIFF_OVERFLOW)).toBe(true);
      })
    );

    it.effect("fails with the command when a per-file diff exits non-zero", () =>
      Effect.gen(function* () {
        const error = yield* collectWith((line) =>
          Effect.succeed(
            Str.includes("--name-only")(line)
              ? handle(0, "pkg/test/a.test.ts\0")
              : handle(Str.includes("--unified=0")(line) ? 128 : 0)
          )
        ).pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "YeetCommandError", exitCode: 128 });
        expect(error.message).toContain("pkg/test/a.test.ts failed with exit code 128");
      })
    );

    it.effect("fails when the rename table cannot be read, is malformed, or exits non-zero", () =>
      Effect.gen(function* () {
        const listingOnly = (
          nameStatus: Effect.Effect<ChildProcessSpawner.ChildProcessHandle, PlatformError.PlatformError>
        ) =>
          collectWith((line) => (Str.includes("--name-status")(line) ? nameStatus : Effect.succeed(handle(0)))).pipe(
            Effect.flip
          );
        expect((yield* listingOnly(spawnFailure.pipe(Effect.fail))).message).toContain(
          "Failed to run git diff --name-status"
        );
        expect((yield* listingOnly(Effect.succeed(handle(0, "R090\0only-one-path\0")))).message).toContain(
          "malformed rename table"
        );
        expect((yield* listingOnly(Effect.succeed(handle(1)))).message).toContain("failed with exit code 1");
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
  const home = O.getOrElse(yield* configStringOption("HOME"), () => "/repo");
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
      assertNone(yield* readFinalCheckReceipt(root, HEAD));
      const dir = path.join(root, FINAL_CHECK_RECEIPT_DIR);
      yield* fs.makeDirectory(dir, { recursive: true });
      const encoded = yield* encodeReceiptJson(receiptOf());
      yield* fs.writeFileString(path.join(dir, `${HEAD}.json`), encoded);
      assertSome(yield* readFinalCheckReceipt(root, HEAD), receiptOf());
      yield* fs.writeFileString(path.join(dir, `${BASE}.json`), "{not json");
      assertNone(yield* readFinalCheckReceipt(root, BASE));
    })
  );

  it.effect("creates no merge-base worktree when nothing was rewritten", () =>
    Effect.gen(function* () {
      expect(yield* verifyExpectationRewrites("/nonexistent-repo", BASE, [])).toEqual([]);
    })
  );
});
