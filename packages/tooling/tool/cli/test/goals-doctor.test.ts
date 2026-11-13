import { Git } from "@beep/git/Git";
import { GoalCloseoutCheck, GoalCloseoutChecker } from "@beep/repo-cli/commands/Goals/CloseoutCheck";
import { GoalCompletionClaimsReader } from "@beep/repo-cli/commands/Goals/RedAttribution";
import {
  CapabilityProjection,
  capabilityDoctorFindings,
  capabilityPacketFindings,
  classifyGoalDoctorFindings,
  DuplicateCapabilityDeclaration,
  GoalAcceptanceEvidenceRef,
  GoalAttributedRedFact,
  GoalCompletionClaims,
  GoalCompletionIo,
  GoalCompletionObservation,
  GoalCompletionReceipt,
  GoalCompletionVerifier,
  GoalDoctorFinding,
  GoalEvidenceCheck,
  GoalManifest,
  GoalMergeResult,
  GoalMergeTimeInventory,
  GoalMergeTimeRuleSource,
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
  GraphCapabilityEdge,
  GraphPacketRow,
  goalCompletionDeclarationDigest,
  goalsCommand,
  layerGoalCompletionReceiptStoreMemory,
  PacketEventStoreLive,
} from "@beep/repo-cli/test/Goals";
import { YeetCommandError } from "@beep/repo-cli/test/Yeet";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
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
import * as TestClock from "effect/testing/TestClock";
import { temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";
import { completionIoFixture } from "./support/CompletionIo.ts";

// A closeout checker that answers `check` for its own packet and none for any other.
const fixedCloseoutChecker = (check: GoalCloseoutCheck) =>
  GoalCloseoutChecker.of({
    check: Effect.fn("GoalsDoctorTest.fixedChecker")(function* (_root: string, slug: string) {
      return slug === check.packet ? O.some(check) : O.none<GoalCloseoutCheck>();
    }),
  });
const decodeGoalManifest = S.decodeEffect(GoalManifest);
const encodeGoalCompletionReceiptJson = S.encodeEffect(S.fromJsonString(GoalCompletionReceipt));
const encodeGoalManifestJson = S.encodeEffect(S.fromJsonString(GoalManifest));

const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  // The doctor's git advisories read history through the kit (W7b, SPEC D-19).
  Git.layer.pipe(Layer.provide(NodeServices.layer)),
  layerGoalCompletionReceiptStoreMemory,
  NodeCrypto.layer,
  PacketEventStoreLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))),
  FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))),
  TSMorphServiceLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)))
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
  const exitCode1 = yield* handle.exitCode;
  expect(exitCode1).toBe(0);
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

// A committed closeout on #7, consistent with its README.
const writeClosedPacket = Effect.fn("writeClosedPacket")(function* () {
  yield* writeProjectFile(
    "goals/closed/ops/manifest.json",
    `${encodeJson({
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: "closed", status: "completed-retained" },
      lifecycle: "completed-retained",
      completionGate: COMPLETION_GATE,
      closeout: { status: "completed-retained", finalPullRequest: 7 },
    })}\n`
  );
  yield* writeProjectFile("goals/closed/README.md", "# closed\n\n## Status\n\nLifecycle: `completed-retained`\n");
});

// A port whose every GitHub read dies: the run must not reach it.
const unusedGitHub = completionIoFixture({
  manifest: Effect.succeed(""),
  origin: Effect.succeed("git@github.com:example/repo.git"),
  respond: Effect.fn("GoalsDoctorTest.unusedGitHub")(() => Effect.die("the fixed closeout check read GitHub")),
});

// Answers pulls/7 with `pull` and fails every other read.
const pullOnlyGitHub = (
  pull: { readonly state: string; readonly merged: boolean; readonly merged_at: string | null },
  record: (endpoint: string) => void = () => undefined
) =>
  completionIoFixture({
    manifest: Effect.succeed(""),
    origin: Effect.succeed("git@github.com:example/repo.git"),
    respond: Effect.fn("GoalsDoctorTest.pullOnlyGitHub")((endpoint: string) =>
      Effect.sync(() => record(endpoint)).pipe(
        Effect.andThen(
          Str.endsWith("pulls/7")(endpoint)
            ? Effect.succeed(
                encodeJson({
                  number: 7,
                  ...pull,
                  created_at: "2026-09-01T00:00:00Z",
                  merge_commit_sha: pull.merged ? "merge-result" : null,
                  head: { sha: "accepted-head" },
                  base: { ref: "main", repo: { full_name: "example/repo" } },
                })
              )
            : Effect.fail(YeetCommandError.make({ message: `fixture refuses ${endpoint}` }))
        )
      )
    ),
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
            completionIoFixture({
              manifest: Effect.succeed(""),
              origin: Effect.succeed("git@github.com:example/repo.git"),
              respond: Effect.fn("GoalsDoctorTest.offlineGitHub")(() =>
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
      expect(output).toContain("Overall verification requires the merge-push rule suite");
      expect(output).toContain("declare a final PR to inspect structured PR/head/merge facts");
      expect(output).not.toContain("use doctor --online");
    })
  );
  it.effect("offline committed closeouts print their committed status line", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* runGit(["init", "-b", "main"]);
      yield* runGit(["config", "user.name", "Fixture"]);
      yield* runGit(["config", "user.email", "fixture@example.invalid"]);
      yield* writeActivePacket("closed");
      yield* writeProjectFile(
        "goals/closed/ops/manifest.json",
        `${encodeJson({
          schemaVersion: "initiative-manifest/v2",
          initiative: { id: "closed", status: "completed-retained" },
          lifecycle: "completed-retained",
          completionGate: {
            ...COMPLETION_GATE,
            acceptanceEvidence: [{ kind: "yeet-verdict", ref: ".beep/yeet/verdict.json", gating: true }],
          },
          closeout: { status: "completed-retained", finalPullRequest: 7 },
        })}\n`
      );
      yield* writeProjectFile("goals/closed/README.md", "# closed\n\n## Status\n\nLifecycle: `completed-retained`\n");
      yield* writeBaseline([]);
      yield* runGit(["add", "."]);
      yield* runGit(["commit", "-m", "chore: closed fixture"]);
      const output = yield* captureOutput(
        runGoalsCommand(["doctor"]).pipe(
          Effect.provideService(
            GoalCompletionIo,
            completionIoFixture({
              manifest: Effect.succeed(""),
              origin: Effect.succeed("git@github.com:example/repo.git"),
              respond: Effect.fn("GoalsDoctorTest.closeoutGitHub")(() => Effect.die("offline closeout used GitHub")),
            })
          )
        )
      );
      // Without a matching receipt the record still reads as committed, never as verified.
      expect(output).toContain("[goals:doctor] note: closed: completed-retained (committed via #7, unverified)");
      expect(output).toContain("closed [completion-gate-unknown]");
    })
  );
  it.effect("online closeout checks map each outcome onto a note, an advisory or the blocking finding", () =>
    Effect.forEach(
      [
        {
          check: { outcome: "final-open", reasons: ["final #7 open"] },
          blocks: false,
          expected: [
            "[goals:doctor] note: closed: completed-retained (committed via #7, unverified); final #7 open, nothing to verify until it merges",
          ],
          absent: ["closed [completion-gate", "closed [closeout-unverified]"],
        },
        {
          check: {
            outcome: "verified",
            reasons: ["verified by a goal-completion-receipt/v1 row (Yeet readiness rules)"],
            attributedReds: [
              GoalAttributedRedFact.make({
                context: "Lint",
                checkRunId: O.some(1),
                conclusion: "failure",
                observed: "red",
                attribution: "inherited",
                fixPullRequest: 2994,
                decisionFile: "goals/closed/decisions/2026-11-14-lint.md",
                source: "origin-main",
              }),
            ],
          },
          blocks: false,
          expected: [
            "[goals:doctor] note: closed: completed-retained (verified via #7)",
            "[goals:doctor] note: closed: attributed Lint (inherited, fix #2994, goals/closed/decisions/2026-11-14-lint.md)",
            "[goals:doctor] note: closed: verified by a goal-completion-receipt/v1 row (Yeet readiness rules)",
          ],
          absent: ["closed [completion-gate", "closed [closeout-unverified]"],
        },
        {
          check: {
            outcome: "operator-ruling",
            reasons: ["unattributed red: Lint"],
            rulingFile: O.some("goals/closed/decisions/2026-11-14-ruling.md"),
          },
          blocks: false,
          expected: [
            "[goals:doctor] note: closed: completed-retained (committed via #7, unverified); closed by operator ruling goals/closed/decisions/2026-11-14-ruling.md",
          ],
          absent: ["closed [completion-gate", "closed [closeout-unverified]"],
        },
        {
          check: {
            outcome: "beyond-window",
            reasons: ["final #7 merged more than 28 days ago, beyond the rule-suite window"],
          },
          blocks: false,
          expected: [
            "[goals:doctor] note: closed: completed-retained (committed via #7, unverified); final #7 merged more than 28 days ago, beyond the rule-suite window",
          ],
          absent: ["closed [completion-gate", "closed [closeout-unverified]"],
        },
        {
          check: { outcome: "transient", reasons: ["review threads unreadable"] },
          blocks: false,
          expected: ["closed [completion-gate-unknown] Final PR #7: unknown (transient). review threads unreadable."],
          absent: ["closed [closeout-unverified]"],
        },
        {
          check: { outcome: "unverified", reasons: ["unattributed red: Lint"] },
          blocks: true,
          expected: [
            "[goals:doctor] NEW blocking findings (not in baseline):",
            "closed [closeout-unverified] Final PR #7: unattributed red: Lint. Next:",
            "--final 7 --attribute-red",
            "bun run beep goals set-status closed active",
          ],
          absent: ["closed [completion-gate"],
        },
      ] as const,
      Effect.fn("GoalsDoctorTest.closeoutOutcome")(function* (row) {
        yield* temporaryWorkingDirectory;
        yield* writeClosedPacket();
        yield* writeBaseline([]);
        const check = GoalCloseoutCheck.make({ packet: "closed", finalPullRequest: 7, ...row.check });
        let exit: Exit.Exit<unknown, unknown> = Exit.void;
        const output = yield* captureOutput(
          runGoalsCommand(["doctor", "--online"]).pipe(
            Effect.provideService(GoalCloseoutChecker, fixedCloseoutChecker(check)),
            Effect.provideService(GoalCompletionIo, unusedGitHub),
            Effect.exit,
            Effect.tap((result) =>
              Effect.sync(() => {
                exit = result;
              })
            )
          )
        );
        if (row.blocks) expectReportedFailure(exit);
        else exit.pipe(Exit.isSuccess, assertTrue);
        for (const text of row.expected) expect(output).toContain(text);
        for (const text of row.absent) expect(output).not.toContain(text);
      }),
      { discard: true }
    )
  );
  it.effect("an unverified closeout blocks under the key carrying its final, and the baseline ratchets it", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeClosedPacket();
      const check = GoalCloseoutCheck.make({
        packet: "closed",
        finalPullRequest: 7,
        outcome: "unverified",
        reasons: ["final #7 closed without merging; bind a new final or reopen the packet"],
      });
      const online = runGoalsCommand(["doctor", "--online"]).pipe(
        Effect.provideService(GoalCloseoutChecker, fixedCloseoutChecker(check)),
        Effect.provideService(GoalCompletionIo, unusedGitHub)
      );
      // A re-final mints a new key, so an inherited #6 never covers #7.
      yield* writeBaseline(["closed closeout-unverified #6"]);
      const introduced = yield* Effect.exit(online);
      expectReportedFailure(introduced);
      yield* writeBaseline(["closed closeout-unverified #7"]);
      const inherited = yield* Effect.exit(online);
      inherited.pipe(Exit.isSuccess, assertTrue);
    })
  );
  it.effect("a raw legacy proposedCloseout key is a blocking manifest-invalid naming the bind command", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeActivePacket("legacy");
      // The schema strips the retired key, so the packet decodes; only the raw JSON shows it.
      yield* writeProjectFile(
        "goals/legacy/ops/manifest.json",
        `${encodeJson({
          schemaVersion: "initiative-manifest/v2",
          initiative: { id: "legacy", title: "legacy", status: "active" },
          lifecycle: "active",
          completionGate: COMPLETION_GATE,
          proposedCloseout: { status: "completed-retained", finalPullRequest: 7 },
        })}\n`
      );
      const decoded = yield* S.decodeUnknownEffect(GoalManifest)({
        initiative: { id: "legacy", status: "active" },
        completionGate: COMPLETION_GATE,
        proposedCloseout: { status: "completed-retained", finalPullRequest: 7 },
      });
      expect(decoded).not.toHaveProperty("proposedCloseout");
      yield* writeBaseline([]);
      let exit: Exit.Exit<unknown, unknown> = Exit.void;
      const output = yield* captureOutput(
        runGoalsCommand(["doctor"]).pipe(
          Effect.exit,
          Effect.tap((result) =>
            Effect.sync(() => {
              exit = result;
            })
          )
        )
      );
      expectReportedFailure(exit);
      expect(output).toContain(
        "legacy [manifest-invalid] ops/manifest.json has a legacy proposedCloseout; run `bun run beep goals set-status legacy completed-retained`, which binds its final, or deletes it when a closeout is already committed or the gate is grandfathered."
      );
      yield* writeBaseline(["legacy manifest-invalid"]);
      const inherited = yield* Effect.exit(runGoalsCommand(["doctor"]));
      inherited.pipe(Exit.isSuccess, assertTrue);
      // Without the key the same packet is clean.
      yield* writeBaseline([]);
      yield* writeActivePacket("legacy");
      const clean = yield* Effect.exit(runGoalsCommand(["doctor"]));
      clean.pipe(Exit.isSuccess, assertTrue);
    })
  );
  it.effect("offline never blocks a committed closeout and never consults the closeout checker", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeClosedPacket();
      yield* writeBaseline([]);
      let consulted = 0;
      const checker = GoalCloseoutChecker.of({
        check: Effect.fn("GoalsDoctorTest.countingChecker")(function* () {
          consulted += 1;
          return O.some(GoalCloseoutCheck.make({ packet: "closed", finalPullRequest: 7, outcome: "unverified" }));
        }),
      });
      let exit: Exit.Exit<unknown, unknown> = Exit.void;
      const output = yield* captureOutput(
        runGoalsCommand(["doctor"]).pipe(
          Effect.provideService(GoalCloseoutChecker, checker),
          Effect.provideService(GoalCompletionIo, unusedGitHub),
          Effect.exit,
          Effect.tap((result) =>
            Effect.sync(() => {
              exit = result;
            })
          )
        )
      );
      exit.pipe(Exit.isSuccess, assertTrue);
      expect(consulted).toBe(0);
      expect(output).toContain("closed [completion-gate-unknown]");
      expect(output).not.toContain("[closeout-unverified]");
    })
  );
  it.effect("the live online check blocks a final closed without merging and advises on a transient read", () =>
    Effect.forEach(
      [
        {
          pull: { state: "closed", merged: false, merged_at: null },
          blocks: true,
          expected: "closed [closeout-unverified] Final PR #7: final #7 closed without merging",
        },
        {
          pull: { state: "closed", merged: true, merged_at: "2026-11-10T00:00:00Z" },
          blocks: false,
          expected: "closed [completion-gate-unknown] Final PR #7: unknown (transient).",
        },
      ] as const,
      Effect.fn("GoalsDoctorTest.liveCloseout")(function* (row) {
        yield* temporaryWorkingDirectory;
        yield* writeClosedPacket();
        yield* writeBaseline([]);
        let exit: Exit.Exit<unknown, unknown> = Exit.void;
        const output = yield* captureOutput(
          runGoalsCommand(["doctor", "--online"]).pipe(
            Effect.provideService(GoalCompletionIo, pullOnlyGitHub(row.pull)),
            Effect.provideService(GoalCompletionClaimsReader, {
              read: () => Effect.succeed(GoalCompletionClaims.make({})),
            }),
            Effect.exit,
            Effect.tap((result) =>
              Effect.sync(() => {
                exit = result;
              })
            )
          )
        );
        if (row.blocks) expectReportedFailure(exit);
        else exit.pipe(Exit.isSuccess, assertTrue);
        expect(output).toContain(row.expected);
      }),
      { discard: true }
    )
  );
  it.effect("online legacy rows read only the pull request when the final merged before the window", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* DateTime.makeUnsafe("2026-11-12T00:00:00Z").pipe(DateTime.toEpochMillis, TestClock.setTime);
      yield* writeProjectFile(
        "goals/typed/ops/manifest.json",
        `${encodeJson({
          initiative: { id: "typed", status: "completed-retained" },
          lifecycle: "completed-retained",
          completionGate: { ...COMPLETION_GATE, pullRequests: [{ number: 7, role: "final" }] },
        })}\n`
      );
      yield* writeProjectFile("goals/typed/README.md", "# Typed\n\nLifecycle: `completed-retained`\n");
      yield* writeBaseline([]);
      let reads = A.empty<string>();
      const output = yield* captureOutput(
        runGoalsCommand(["doctor", "--online"]).pipe(
          Effect.provideService(
            GoalCompletionIo,
            pullOnlyGitHub({ state: "closed", merged: true, merged_at: "2026-10-06T00:00:00Z" }, (endpoint) => {
              reads = A.append(reads, endpoint);
            })
          )
        )
      );
      expect(reads).toEqual(["repos/{owner}/{repo}/pulls/7"]);
      expect(output).toContain(
        "[goals:doctor] note: typed: final #7 merged more than 28 days ago, beyond the rule-suite window; its stored receipt is used"
      );
      expect(output).toContain("typed [completion-gate-unknown]");
    })
  );
  it.effect("doctor prints the missing fact for unknown completion and nothing for verified", () =>
    Effect.forEach(
      [
        // A v1 row that verified under Yeet readiness is returned as stored.
        { version: "goal-completion-receipt/v1", threads: false, extraUnknown: false, expect: "" },
        // A v2 row must carry both hosted kinds; the missing one is named.
        {
          version: "goal-completion-receipt/v2",
          threads: false,
          extraUnknown: false,
          expect: "no hosted-review-threads evidence",
        },
        // A declared local verdict gates nothing, even when it is unknown.
        { version: "goal-completion-receipt/v2", threads: true, extraUnknown: true, expect: "" },
      ] as const,
      Effect.fn("GoalsDoctorTest.unknownCompletionWording")(function* (row) {
        yield* temporaryWorkingDirectory;
        yield* runGit(["init", "-b", "main"]);
        const manifest = yield* decodeGoalManifest({
          initiative: { id: "typed", status: "completed-retained" },
          lifecycle: "completed-retained",
          completionGate: { ...COMPLETION_GATE, pullRequests: [{ number: 7, role: "final" }] },
        });
        const encodedGoalManifestJson = yield* encodeGoalManifestJson(manifest);
        yield* writeProjectFile("goals/typed/ops/manifest.json", encodedGoalManifestJson);
        yield* writeProjectFile("goals/typed/README.md", "# Typed\n\nLifecycle: `completed-retained`\n");
        yield* writeBaseline([]);
        const digest = yield* goalCompletionDeclarationDigest(manifest);
        const time = DateTime.makeUnsafe("2026-10-06T01:00:00Z");
        const hosted = GoalEvidenceCheck.make({
          ref: GoalAcceptanceEvidenceRef.make({ kind: "hosted-required-checks", ref: "required", gating: true }),
          outcome: "verified",
          observedHead: O.some("accepted-head"),
          detail: "Green",
        });
        const threads = GoalEvidenceCheck.make({
          ref: GoalAcceptanceEvidenceRef.make({ kind: "hosted-review-threads", ref: "outstanding", gating: true }),
          outcome: "verified",
          observedHead: O.some("accepted-head"),
          detail: "No outstanding review thread (0 read when refresh ran).",
        });
        const hostedEvidence = row.threads ? [hosted, threads] : [hosted];
        const receipt = GoalCompletionReceipt.make({
          schemaVersion: row.version,
          repository: "example/repo",
          packet: "typed",
          declarationDigest: digest,
          // The accepted-head digest no longer gates (DN-12).
          acceptedDeclarationDigest: O.none(),
          requiredChecks: O.some(
            GoalRequiredCheckSnapshot.make({
              contexts: ["Lint"],
              sources: ["repos/{owner}/{repo}/rulesets/42/history/1"],
              effectiveAt: time,
              inventoryComplete: true,
              mergeTimeInventory: O.some(
                GoalMergeTimeInventory.make({
                  source: "repos/{owner}/{repo}/rulesets/rule-suites/1",
                  ruleSuiteId: 1,
                  ref: "refs/heads/main",
                  afterSha: "merge-result",
                  pushedAt: time,
                  result: "pass",
                  ruleSources: [
                    GoalMergeTimeRuleSource.make({
                      sourceType: "ruleset",
                      rulesetId: O.some(42),
                      name: O.some("main"),
                      enforcement: "active",
                      requiredStatusChecks: O.some("pass"),
                      survives: true,
                      version: O.some("repos/{owner}/{repo}/rulesets/42/history/1"),
                    }),
                  ],
                })
              ),
            })
          ),
          requiredCheckFacts: [
            GoalRequiredCheckFact.make({
              context: "Lint",
              head: "accepted-head",
              checkRunId: O.some(1),
              conclusion: "success",
              outcome: "verified",
              source: "check-run",
            }),
          ],
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
          evidence: row.extraUnknown
            ? [
                ...hostedEvidence,
                GoalEvidenceCheck.make({
                  ref: GoalAcceptanceEvidenceRef.make({ kind: "yeet-verdict", ref: "merge-ready", gating: true }),
                  outcome: "unknown",
                  observedHead: O.none(),
                  detail: "Verdict absent",
                }),
              ]
            : hostedEvidence,
          nonRequiredReds: [],
          subClaims: [],
          outcome: "verified",
          verifiedAt: time,
        });
        yield* writeProjectFile(
          ".beep/goals/completion-receipts.ndjson",
          `${yield* encodeGoalCompletionReceiptJson(receipt)}\n`
        );
        const output = yield* captureOutput(
          runGoalsCommand(["doctor"]).pipe(
            Effect.provideService(
              GoalCompletionIo,
              completionIoFixture({
                manifest: Effect.succeed(""),
                origin: Effect.succeed("git@github.com:example/repo.git"),
                respond: Effect.fn("GoalsDoctorTest.wordingGitHub")(() =>
                  Effect.die("offline receipt read used GitHub")
                ),
              })
            )
          )
        );
        expect(output).not.toContain("Merge-time evidence verified");
        if (row.expect === "") {
          expect(output).not.toContain("typed [completion-gate");
        } else {
          expect(output).toContain("typed [completion-gate-unknown]");
          expect(output).toContain(row.expect);
        }
      })
    )
  );
  it.effect("stored receipts name a known red and unreadable merge facts plainly", () =>
    Effect.forEach(
      [
        {
          version: "goal-completion-receipt/v2" as const,
          merged: true,
          hosted: "unsatisfied" as const,
          kind: "completion-gate-unsatisfied",
          text: "See head-bound completion evidence",
        },
        {
          version: "goal-completion-receipt/v2" as const,
          merged: false,
          hosted: "unknown" as const,
          kind: "completion-gate-unknown",
          text: "PR, merge or check facts could not be read",
        },
        // A v1 row that did not verify predates the hosted-only rules (DN-8).
        {
          version: "goal-completion-receipt/v1" as const,
          merged: true,
          hosted: "unsatisfied" as const,
          kind: "completion-gate-unknown",
          text: "v1 receipt predates hosted-only rules; rerun refresh",
        },
      ],
      Effect.fn("GoalsDoctorTest.storedReceiptMessages")(function* (row) {
        yield* temporaryWorkingDirectory;
        yield* runGit(["init", "-b", "main"]);
        const manifest = yield* decodeGoalManifest({
          initiative: { id: "typed", status: "completed-retained" },
          lifecycle: "completed-retained",
          completionGate: { ...COMPLETION_GATE, pullRequests: [{ number: 7, role: "final" }] },
        });
        const encodedGoalManifestJson2 = yield* encodeGoalManifestJson(manifest);
        yield* writeProjectFile("goals/typed/ops/manifest.json", encodedGoalManifestJson2);
        yield* writeProjectFile("goals/typed/README.md", "# Typed\n\nLifecycle: `completed-retained`\n");
        yield* writeBaseline([]);
        const digest = yield* goalCompletionDeclarationDigest(manifest);
        const time = DateTime.makeUnsafe("2026-10-06T01:00:00Z");
        const receipt = GoalCompletionReceipt.make({
          schemaVersion: row.version,
          repository: "example/repo",
          packet: "typed",
          declarationDigest: digest,
          acceptedDeclarationDigest: O.some(digest),
          finalPullRequest: 7,
          acceptedHead: O.some("accepted-head"),
          merge: row.merged
            ? O.some(
                GoalMergeResult.make({
                  mergeCommit: "merge-result",
                  tree: "merge-tree",
                  mergedAt: time,
                  method: O.none(),
                  baseRef: "main",
                })
              )
            : O.none(),
          evidence: [
            GoalEvidenceCheck.make({
              ref: GoalAcceptanceEvidenceRef.make({ kind: "hosted-required-checks", ref: "required", gating: true }),
              outcome: row.hosted,
              observedHead: O.some("accepted-head"),
              detail: "Recorded hosted result",
            }),
          ],
          nonRequiredReds: [],
          subClaims: [],
          outcome: row.hosted,
          verifiedAt: time,
        });
        yield* writeProjectFile(
          ".beep/goals/completion-receipts.ndjson",
          `${yield* encodeGoalCompletionReceiptJson(receipt)}\n`
        );
        const output = yield* captureOutput(
          runGoalsCommand(["doctor"]).pipe(
            Effect.provideService(
              GoalCompletionIo,
              completionIoFixture({
                manifest: Effect.succeed(""),
                origin: Effect.succeed("git@github.com:example/repo.git"),
                respond: Effect.fn("GoalsDoctorTest.messageGitHub")(() =>
                  Effect.die("offline receipt read used GitHub")
                ),
              })
            )
          )
        );
        expect(output).toContain(`typed [${row.kind}]`);
        expect(output).toContain(row.text);
      })
    )
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
      const encodedGoalManifestJson3 = yield* encodeGoalManifestJson(manifest);
      yield* writeProjectFile("goals/typed/ops/manifest.json", encodedGoalManifestJson3);
      yield* writeProjectFile("goals/typed/README.md", "# Typed\n\nLifecycle: `completed-retained`\n");
      yield* writeBaseline([]);
      const digest = yield* goalCompletionDeclarationDigest(manifest);
      const time = DateTime.makeUnsafe("2026-10-06T01:00:00Z");
      const receipt = GoalCompletionReceipt.make({
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
      // An arbitrary snapshot carries no head-bound facts, so it can never verify.
      expect(resolved.outcome).not.toBe("verified");
      const text = yield* encodeGoalCompletionReceiptJson(receipt);
      yield* writeProjectFile(".beep/goals/completion-receipts.ndjson", `${text}\n`);
      const output = yield* captureOutput(
        runGoalsCommand(["doctor"]).pipe(
          Effect.provideService(
            GoalCompletionIo,
            completionIoFixture({
              manifest: Effect.succeed(""),
              origin: Effect.succeed("git@github.com:example/repo.git"),
              respond: Effect.fn("GoalsDoctorTest.storedGitHub")(() => Effect.die("offline receipt read used GitHub")),
            })
          )
        )
      );
      expect(output).toContain("typed [completion-gate-unknown]");
      expect(output).toContain("Completion unknown:");
      expect(output).toContain("rule-suite-unavailable");
      expect(output).not.toContain("Merge-time evidence verified");
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
    "flags an active packet whose phases are all complete",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* runGit(["init", "-b", "main"]);
        yield* runGit(["config", "user.name", "Fixture"]);
        yield* runGit(["config", "user.email", "fixture@example.invalid"]);
        const phases = [
          { id: "P0", status: "complete" },
          { id: "P1", status: "complete" },
        ];
        // Declared status is the packet's own: all phases complete means it must move.
        yield* writeActivePacket("owned");
        yield* writeProjectFile(
          "goals/owned/ops/manifest.json",
          `${encodeJson({
            schemaVersion: "initiative-manifest/v2",
            initiative: { id: "owned", title: "owned", status: "active" },
            lifecycle: "active",
            completionGate: COMPLETION_GATE,
            phases,
          })}\n`
        );
        // A packet whose phases are not all complete owes nothing yet.
        yield* writeActivePacket("working");
        yield* writeProjectFile(
          "goals/working/ops/manifest.json",
          `${encodeJson({
            schemaVersion: "initiative-manifest/v2",
            initiative: { id: "working", title: "working", status: "active" },
            lifecycle: "active",
            completionGate: COMPLETION_GATE,
            phases: [...phases, { id: "P2", status: "active" }],
          })}\n`
        );
        yield* writeBaseline([]);
        yield* runGit(["add", "."]);
        yield* runGit(["commit", "-m", "chore: phase fixtures"]);
        // "owned" introduces a new blocking finding, so the doctor reports exit 1.
        let exit: Exit.Exit<unknown, unknown> = Exit.void;
        const output = yield* captureOutput(
          runGoalsCommand(["doctor"]).pipe(
            Effect.provideService(
              GoalCompletionIo,
              completionIoFixture({
                manifest: Effect.succeed(""),
                origin: Effect.succeed("git@github.com:example/repo.git"),
                respond: Effect.fn("GoalsDoctorTest.phaseGitHub")(() =>
                  Effect.die("offline phase fixture used GitHub")
                ),
              })
            ),
            Effect.exit,
            Effect.tap((result) =>
              Effect.sync(() => {
                exit = result;
              })
            )
          )
        );
        expectReportedFailure(exit);
        expect(output).toContain("owned [phases-terminal-but-active]");
        expect(output).not.toContain("working [phases-terminal-but-active]");
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
