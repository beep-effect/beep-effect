import { lintCommand } from "@beep/repo-cli";
import {
  CapabilityProjection,
  capabilityDoctorFindings,
  capabilityPacketFindings,
  classifyGoalDoctorFindings,
  DuplicateCapabilityDeclaration,
  GoalAcceptanceEvidenceRef,
  GoalCompletionIo,
  GoalCompletionObservation,
  GoalCompletionReceipt,
  GoalCompletionVerifier,
  GoalDoctorFinding,
  GoalEvidenceCheck,
  GoalManifest,
  GoalMergeResult,
  GoalRequiredCheckSnapshot,
  GraphCapabilityEdge,
  GraphPacketRow,
  goalCompletionDeclarationDigest,
  goalsCommand,
  PacketEventStoreLive,
} from "@beep/repo-cli/test/Goals";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Result from "effect/Result";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const decodeGoalManifest = S.decodeEffect(GoalManifest);
const encodeGoalCompletionReceiptJson = S.encodeEffect(S.fromJsonString(GoalCompletionReceipt));
const encodeGoalManifestJson = S.encodeEffect(S.fromJsonString(GoalManifest));

const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  PacketEventStoreLive.pipe(Layer.provideMerge(NodeServices.layer)),
  FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer))
);

const expectReportedFailure = (exit: Exit.Exit<unknown, unknown>) => {
  exit.pipe(Exit.isFailure, assertTrue);
  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    expect(Runtime.getErrorExitCode(error)).toBe(1);
  }
};

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

// One packet with exactly one blocking finding: initiative.status "active"
// disagrees with lifecycle "paused" (the yeet-pr-closeout-loop failure mode).
const writeDriftedPacket = Effect.fn("writeDriftedPacket")(function* (slug: string) {
  yield* writeProjectFile(
    `goals/${slug}/ops/manifest.json`,
    `${encodeJson({
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: slug, title: slug, status: "active" },
      lifecycle: "paused",
      completionGate: COMPLETION_GATE,
    })}\n`
  );
  yield* writeProjectFile(`goals/${slug}/README.md`, `# ${slug}\n\n## Status\n\nLifecycle: \`active\`\n`);
});

const runGit = Effect.fn("GoalsDoctorTest.runGit")(function* (
  args: ReadonlyArray<string>,
  env: Record<string, string> = {}
) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: process.cwd(),
    env,
    extendEnv: true,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "inherit",
  });
  expect(yield* handle.exitCode).toBe(0);
});

const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output: ReadonlyArray<unknown> = [];
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(output, values);
      },
      error: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(output, values);
      },
    })
  );
  return A.join(A.map(output, String), "\n");
});

// A consistent active packet whose shipping PR could already have merged.
const writeActivePacket = Effect.fn("writeActivePacket")(function* (slug: string) {
  yield* writeProjectFile(
    `goals/${slug}/ops/manifest.json`,
    `${encodeJson({
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: slug, title: slug, status: "active" },
      lifecycle: "active",
      completionGate: COMPLETION_GATE,
    })}\n`
  );
  yield* writeProjectFile(`goals/${slug}/README.md`, `# ${slug}\n\n## Status\n\nLifecycle: \`active\`\n`);
  yield* writeProjectFile(`goals/${slug}/GOAL.md`, `# ${slug}\n`);
});

const writeBaseline = (keys: ReadonlyArray<string>) =>
  writeProjectFile(
    "goals/goals-doctor.baseline.jsonc",
    `${encodeJson({ schemaVersion: "goals-doctor-baseline/v1", findings: keys })}\n`
  );

it.layer(testLayer, { timeout: "20 seconds" })("goals doctor baseline ratchet", (it) => {
  it.effect("offline legacy citations remain the fallback while typed declarations are unknown", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* runGit(["init", "-b", "main"]);
      yield* runGit(["config", "user.name", "Fixture"]);
      yield* runGit(["config", "user.email", "fixture@example.invalid"]);
      for (const slug of ["legacy", "typed"]) {
        yield* writeProjectFile(
          `goals/${slug}/ops/manifest.json`,
          `${encodeJson({
            initiative: { id: slug, status: "completed-retained" },
            lifecycle: "completed-retained",
            completionGate: {
              ...COMPLETION_GATE,
              ...(slug === "typed" ? { pullRequests: [{ number: 7, role: "final" }] } : {}),
            },
            ...(slug === "legacy" ? { mergedPullRequest: 7 } : {}),
          })}\n`
        );
        yield* writeProjectFile(`goals/${slug}/README.md`, `# ${slug}\n\nLifecycle: \`completed-retained\`\n`);
      }
      yield* writeBaseline([]);
      yield* runGit(["add", "."]);
      yield* runGit(["commit", "-m", "chore: seed fixtures"]);
      let networkReads = 0;
      const output = yield* captureOutput(
        runGoalsCommand(["doctor"]).pipe(
          Effect.provideService(
            GoalCompletionIo,
            GoalCompletionIo.of({
              git: Effect.fn("GoalsDoctorTest.offlineGit")(() => Effect.succeed("git@github.com:example/repo.git")),
              github: Effect.fn("GoalsDoctorTest.offlineGitHub")(() =>
                Effect.sync(() => {
                  networkReads += 1;
                }).pipe(Effect.andThen(Effect.die("offline network read")))
              ),
            })
          )
        )
      );
      expect(networkReads).toBe(0);
      expect(output).toContain("legacy [completion-gate-unsatisfied]");
      expect(output).not.toContain("legacy [completion-gate-unknown]");
      expect(output).toContain("typed [completion-gate-unknown]");
      expect(output).toContain("Overall verification requires a complete merge-time ruleset inventory");
      expect(output).toContain("declare a final PR to inspect structured PR/head/merge facts");
      expect(output).not.toContain("use doctor --online");
    })
  );
  it.effect.prop(
    "stored incomplete inventory explains why refresh cannot verify completion",
    [Arbitrary.schema(GoalRequiredCheckSnapshot)],
    Effect.fn("GoalsDoctorTest.storedIncompleteInventory")(function* ([snapshot]) {
      yield* temporaryWorkingDirectory;
      yield* runGit(["init", "-b", "main"]);
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "typed", status: "completed-retained" },
        lifecycle: "completed-retained",
        completionGate: { ...COMPLETION_GATE, pullRequests: [{ number: 7, role: "final" }] },
      });
      yield* writeProjectFile("goals/typed/ops/manifest.json", yield* encodeGoalManifestJson(manifest));
      yield* writeProjectFile("goals/typed/README.md", "# Typed\n\nLifecycle: `completed-retained`\n");
      yield* writeBaseline([]);
      const digest = yield* goalCompletionDeclarationDigest(manifest);
      const time = DateTime.makeUnsafe("2026-10-06T01:00:00Z");
      const receipt = GoalCompletionReceipt.make({
        schemaVersion: "goal-completion-receipt/v1",
        repository: "example/repo",
        packet: "typed",
        declarationDigest: digest,
        acceptedDeclarationDigest: O.some(digest),
        requiredChecks: O.some(
          GoalRequiredCheckSnapshot.make({
            contexts: ["Lint"],
            sources: ["surviving-ruleset-history"],
            effectiveAt: time,
            inventoryComplete: false,
          })
        ),
        finalPullRequest: 7,
        acceptedHead: O.some("accepted-head"),
        merge: O.some(
          GoalMergeResult.make({
            mergeCommit: "merge-result",
            tree: "merge-tree",
            mergedAt: time,
            method: O.none(),
            baseRef: "main",
          })
        ),
        evidence: [
          GoalEvidenceCheck.make({
            ref: GoalAcceptanceEvidenceRef.make({ kind: "hosted-required-checks", ref: "required", gating: true }),
            outcome: "verified",
            observedHead: O.some("accepted-head"),
            detail: "Surviving required contexts passed before merge",
          }),
        ],
        nonRequiredReds: [],
        subClaims: [],
        outcome: "unknown",
        verifiedAt: time,
      });
      const resolved = yield* GoalCompletionVerifier.resolve(
        GoalCompletionObservation.make({
          ...receipt,
          requiredChecks: O.some(snapshot),
          merged: O.some(true),
          grandfathered: false,
        })
      );
      expect(resolved.outcome).toBe(
        snapshot.inventoryComplete && snapshot.rulesetReadsComplete ? "verified" : "unknown"
      );
      const text = yield* encodeGoalCompletionReceiptJson(receipt);
      yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", `${text}\n`);
      const output = yield* captureOutput(
        runGoalsCommand(["doctor"]).pipe(
          Effect.provideService(
            GoalCompletionIo,
            GoalCompletionIo.of({
              git: Effect.fn("GoalsDoctorTest.storedGit")(() => Effect.succeed("git@github.com:example/repo.git")),
              github: Effect.fn("GoalsDoctorTest.storedGitHub")(() => Effect.die("offline receipt read used GitHub")),
            })
          )
        )
      );
      expect(output).toContain("typed [completion-gate-unknown]");
      expect(output).toContain("Merge-time ruleset inventory completeness is unknown");
      expect(output).toContain("rulesets deleted since the merge");
      expect(output).toContain("neither can verify completion without a complete historical inventory");
      expect(output).toContain("Online doctor inspects facts and completion refresh persists them");
      expect(output).not.toContain("Online reads and refresh record");
      expect(output).not.toContain("No matching clone receipt");
    }),
    { arbitrary: { runs: 20 } }
  );
  it.effect(
    "ignores hidden editor directories under goals",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* writeProjectFile("goals/.idea/workspace.xml", "<project />\n");
        yield* writeBaseline([]);
        const fs = yield* FileSystem.FileSystem;
        let rootMarkerReads = 0;
        const observedFs = FileSystem.FileSystem.of({
          ...fs,
          exists: Effect.fn("GoalsDoctorTest.observeRootMarkers")((path: string) => {
            if (Str.endsWith("/.git")(path) || Str.endsWith("/bun.lock")(path)) rootMarkerReads += 1;
            return fs.exists(path);
          }),
        });
        const exit = yield* runGoalsCommand(["doctor"]).pipe(
          Effect.provideService(FileSystem.FileSystem, observedFs),
          Effect.exit
        );
        exit.pipe(Exit.isSuccess, assertTrue);
        expect(rootMarkerReads).toBe(0);
      }),
    20_000
  );

  it.effect(
    "fails with exit 1 on a synthetic new blocking finding absent from the baseline",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* writeDriftedPacket("demo");
        yield* writeBaseline([]);
        const exit = yield* Effect.exit(runGoalsCommand(["doctor"]));
        expectReportedFailure(exit);
      }),
    20_000
  );

  it.effect(
    "exits 0 when the same finding is inherited from the committed baseline",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* writeDriftedPacket("demo");
        yield* writeBaseline(["demo lifecycle-mismatch"]);
        const exit = yield* Effect.exit(runGoalsCommand(["doctor"]));
        exit.pipe(Exit.isSuccess, assertTrue);
      }),
    20_000
  );

  it.effect(
    "flags an active packet a squash merge cited and nobody touched since, and nothing else",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* runGit(["init", "-b", "main"]);
        yield* runGit(["config", "user.email", "goals-doctor-test@example.com"]);
        yield* runGit(["config", "user.name", "Goals Doctor Test"]);
        yield* runGit(["config", "commit.gpgsign", "false"]);
        yield* writeBaseline([]);
        // The wall clock, not the test clock: git compares the backdated commits
        // against real time when the doctor asks for the last 21 days.
        const backdated = DateTime.formatIso(DateTime.subtract(DateTime.nowUnsafe(), { days: 40 }));
        const oldEnv = { GIT_AUTHOR_DATE: backdated, GIT_COMMITTER_DATE: backdated };
        // Cited by a squash subject, untouched since: the shipped-but-open shape.
        yield* writeActivePacket("shipped");
        yield* runGit(["add", "."]);
        yield* runGit(["commit", "-m", "feat(demo): ship shipped (#1)"], oldEnv);
        // Cited only by an ordinary commit: stale, but no merge is evidenced.
        yield* writeActivePacket("mentioned");
        yield* runGit(["add", "."]);
        yield* runGit(["commit", "-m", "chore(demo): mention mentioned in passing"], oldEnv);
        // Cited by a squash subject only inside a longer hyphenated token, and only by a
        // PR number that merely contains the one it recorded: neither is a citation.
        yield* writeActivePacket("cargo");
        yield* writeProjectFile(
          "goals/cargo/ops/manifest.json",
          `${encodeJson({
            schemaVersion: "initiative-manifest/v2",
            initiative: { id: "cargo", title: "cargo", status: "active" },
            lifecycle: "active",
            completionGate: COMPLETION_GATE,
            mergedPullRequest: 7,
          })}\n`
        );
        yield* runGit(["add", "."]);
        yield* runGit(["commit", "-m", "feat(demo): ship cargo-bay (#70)"], oldEnv);
        // Cited by a squash subject and stale, but it says why it stays open.
        yield* writeActivePacket("noted");
        yield* writeProjectFile(
          "goals/noted/ops/manifest.json",
          `${encodeJson({
            schemaVersion: "initiative-manifest/v2",
            initiative: { id: "noted", title: "noted", status: "active" },
            lifecycle: "active",
            completionGate: COMPLETION_GATE,
            statusNote: "P8 is an operator gate; closes on live proof.",
          })}\n`
        );
        yield* runGit(["add", "."]);
        yield* runGit(["commit", "-m", "feat(demo): ship noted (#3)"], oldEnv);
        // Cited by a squash subject but touched inside the window: not stale.
        yield* writeActivePacket("fresh");
        yield* runGit(["add", "."]);
        yield* runGit(["commit", "-m", "feat(demo): ship fresh (#2)"]);
        const output = yield* captureOutput(runGoalsCommand(["doctor"]));
        expect(output).toContain("shipped [active-after-merge]");
        expect(output).not.toContain("shipped [stale-active]");
        expect(output).toContain("mentioned [stale-active]");
        expect(output).not.toContain("mentioned [active-after-merge]");
        expect(output).toContain("cargo [stale-active]");
        expect(output).not.toContain("cargo [active-after-merge]");
        expect(output).not.toContain("noted [active-after-merge]");
        expect(output).not.toContain("noted [stale-active]");
        expect(output).not.toContain("fresh [active-after-merge]");
        expect(output).not.toContain("fresh [stale-active]");
      }),
    20_000
  );

  it.effect(
    "exposes the same ratchet through the beep lint goal-packets alias",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* writeDriftedPacket("demo");
        yield* writeBaseline([]);
        const exit = yield* Effect.exit(runLintCommand(["goal-packets"]));
        expectReportedFailure(exit);
      }),
    20_000
  );
});

describe("classifyGoalDoctorFindings", () => {
  const findingFor = (key: string): GoalDoctorFinding =>
    GoalDoctorFinding.make({
      slug: "demo",
      kind: "lifecycle-mismatch",
      severity: "blocking",
      key,
      message: "synthetic",
    });

  it("splits current findings into introduced and inherited, and reports resolved keys", () => {
    const result = classifyGoalDoctorFindings([findingFor("demo a"), findingFor("demo b")], ["demo b", "demo gone"]);
    expect(A.map(result.introduced, (item) => item.key)).toEqual(["demo a"]);
    expect(A.map(result.inherited, (item) => item.key)).toEqual(["demo b"]);
    expect(result.resolved).toEqual(["demo gone"]);
  });

  it("treats an empty baseline as all-new", () => {
    const result = classifyGoalDoctorFindings([findingFor("demo a")], []);
    expect(result.introduced.length).toBe(1);
    expect(result.inherited.length).toBe(0);
    expect(result.resolved).toEqual([]);
  });
});

describe("capabilityDoctorFindings", () => {
  const packet = (packetId: string, status: GraphPacketRow["status"]) =>
    GraphPacketRow.make({ packetId, status, executionCapable: true, title: packetId });
  const edge = (packetId: string, capability: GraphCapabilityEdge["capability"]) =>
    GraphCapabilityEdge.make({ packetId, capability });
  const keysOf = (findings: ReadonlyArray<GoalDoctorFinding>) =>
    A.map(findings, (item) => `${item.severity} ${item.key}`);

  it("reports duplicates and reference provides as blocking and strands as advisory", () => {
    const projection = CapabilityProjection.make({
      packets: [
        packet("builder", "completed-retained"),
        packet("docs", "reference"),
        packet("old", "superseded"),
        packet("older", "superseded"),
        packet("consumer", "active"),
      ],
      capabilities: ["box/driver", "kg/lookup", "m365/category"],
      provides: [
        edge("builder", "box/driver"),
        edge("docs", "kg/lookup"),
        edge("old", "m365/category"),
        edge("older", "m365/category"),
      ],
      requires: [edge("consumer", "box/driver"), edge("consumer", "m365/category")],
      duplicates: [
        DuplicateCapabilityDeclaration.make({ packetId: "consumer", capability: "box/driver", edge: "requires" }),
      ],
    });

    expect(keysOf(capabilityDoctorFindings(projection))).toEqual([
      "blocking consumer capability-duplicate-declaration requires box/driver",
      "blocking docs capability-reference-provides kg/lookup",
      "advisory old capability-stranded m365/category",
      "advisory older capability-stranded m365/category",
    ]);
  });

  it("does not strand a capability that a buildable packet still provides", () => {
    // Counterfactual: the same superseded provider is not stranded once the
    // superseding packet re-declares the capability (D8).
    const projection = CapabilityProjection.make({
      packets: [packet("old", "superseded"), packet("successor", "active")],
      capabilities: ["m365/category"],
      provides: [edge("old", "m365/category"), edge("successor", "m365/category")],
      requires: [],
      duplicates: [],
    });

    expect(capabilityDoctorFindings(projection)).toEqual([]);
  });

  it("holds packets whose id does not match their directory out of the projection", () => {
    const manifest = (id: string, provides: ReadonlyArray<GraphCapabilityEdge["capability"]>) =>
      GoalManifest.make({
        initiative: { id, status: "active", title: `Title ${id}` },
        completionGate: COMPLETION_GATE,
        executionCapable: true,
        provides: [...provides],
        requires: [],
      });

    // Two directories sharing an id (the collision that used to throw) and one
    // single mismatched packet; the admitted reference packet still reports.
    const findings = capabilityPacketFindings([
      { slug: "copy-a", manifest: O.some(manifest("shared", ["box/driver"])) },
      { slug: "copy-b", manifest: O.some(manifest("shared", [])) },
      { slug: "renamed", manifest: O.some(manifest("old-name", [])) },
      {
        slug: "docs",
        manifest: O.some(
          GoalManifest.make({
            ...manifest("docs", ["kg/lookup"]),
            initiative: { id: "docs", status: "reference", title: "Docs" },
          })
        ),
      },
      { slug: "broken", manifest: O.none() },
    ]);

    expect(keysOf(findings)).toEqual([
      "blocking copy-a capability-packet-id-mismatch shared",
      "blocking copy-b capability-packet-id-mismatch shared",
      "blocking renamed capability-packet-id-mismatch old-name",
      "blocking docs capability-reference-provides kg/lookup",
    ]);
  });
});
