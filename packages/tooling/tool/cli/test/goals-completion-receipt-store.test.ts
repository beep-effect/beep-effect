import {
  GoalAcceptanceEvidenceRef,
  GoalCompletionIo,
  GoalCompletionReceipt,
  GoalCompletionReceiptStore,
  GoalEvidenceCheck,
  GoalManifest,
  GoalMergeResult,
  GoalMergeTimeInventory,
  GoalMergeTimeRuleSource,
  GoalPullRequestRef,
  GoalRedAttributionClaim,
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
  GoalReviewThreadTally,
  goalCompletionDeclarationDigest,
  goalCompletionReceiptPartition,
  goalCompletionReceiptStore,
  goalCompletionUnknownReasons,
  goalCompletionVerdict,
  layerGoalCompletionReceiptStoreLive,
  layerGoalCompletionReceiptStoreMemory,
  makeGoalCompletionReceiptStoreAt,
  makeGoalCompletionReceiptStoreLive,
  storedGoalCompletion,
} from "@beep/repo-cli/test/Goals";
import { YeetCommandError } from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { NodeTestLayer } from "./support/CommandTest.ts";
import { completionIoFixture } from "./support/CompletionIo.ts";

const receipt = (repository: string, packet: string) =>
  GoalCompletionReceipt.make({
    schemaVersion: "goal-completion-receipt/v1",
    repository,
    packet,
    declarationDigest: "digest",
    acceptedDeclarationDigest: O.none(),
    finalPullRequest: 7,
    acceptedHead: O.none(),
    merge: O.none(),
    evidence: [],
    nonRequiredReds: [],
    subClaims: [],
    outcome: "unknown",
    verifiedAt: DateTime.makeUnsafe("2026-11-01T00:00:00Z"),
  });

const withStateRoot = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

const packets = A.map((row: GoalCompletionReceipt) => row.packet);

describe("goal completion receipt partition", () => {
  it("lowercases the owner and name so every clone shares one file", () => {
    expect(goalCompletionReceiptPartition("Example/Repo")).toEqual({
      host: "github.com",
      owner: "example",
      name: "repo",
    });
  });
  it("keeps a slug without a slash total", () => {
    expect(goalCompletionReceiptPartition("unobserved")).toEqual({ host: "github.com", owner: "unobserved", name: "" });
  });
});

const MemoryStoreTestLayer = Layer.mergeAll(NodeTestLayer, layerGoalCompletionReceiptStoreMemory);

it.layer(MemoryStoreTestLayer, { timeout: "60 seconds" })("goal completion receipt memory store", (it) => {
  it.effect("memory store lists only the requested repository, whatever its case", () =>
    Effect.gen(function* () {
      const store = yield* GoalCompletionReceiptStore;
      yield* store.append(receipt("example/repo", "a"));
      yield* store.append(receipt("other/repo", "b"));
      const list1 = yield* store.list("Example/Repo");
      expect(packets(list1)).toEqual(["a"]);
      const list2 = yield* store.list("missing/repo");
      expect(packets(list2)).toEqual([]);
    })
  );
  it.effect("prefers a provided store over the live workstation store", () =>
    Effect.gen(function* () {
      const provided = yield* GoalCompletionReceiptStore;
      const resolved = yield* goalCompletionReceiptStore();
      expect(resolved).toBe(provided);
    })
  );
});

it.layer(NodeTestLayer, { timeout: "30 seconds" })("goal completion receipt store", (it) => {
  it.effect("live store resolves BEEP_GOALS_STATE_ROOT and round-trips receipts per repository file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-receipts-" });
      const directory = path.join(root, "goals");
      const context = yield* Layer.build(layerGoalCompletionReceiptStoreLive).pipe(
        withStateRoot({ BEEP_GOALS_STATE_ROOT: directory, HOME: root })
      );
      const store = Context.get(context, GoalCompletionReceiptStore);
      const list3 = yield* store.list("example/repo");
      expect(list3).toEqual([]);
      yield* store.append(receipt("Example/Repo", "a"));
      yield* store.append(receipt("example/repo", "b"));
      const list4 = yield* store.list("example/repo");
      expect(packets(list4)).toEqual(["a", "b"]);
      const exists5 = yield* fs.exists(path.join(directory, "github.com__example__repo.jsonl"));
      expect(exists5).toBe(true);
    })
  );
  it.effect("falls back to the live store under XDG_STATE_HOME when none is provided", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-receipts-" });
      const xdg = path.join(root, "xdg");
      const store = yield* goalCompletionReceiptStore().pipe(withStateRoot({ XDG_STATE_HOME: xdg, HOME: root }));
      yield* store.append(receipt("example/repo", "a"));
      const exists6 = yield* fs.exists(path.join(xdg, "beep", "goals", "github.com__example__repo.jsonl"));
      expect(exists6).toBe(true);
    })
  );
  it.effect("reports an unresolvable state directory as a typed command error", () =>
    Effect.gen(function* () {
      const error = yield* makeGoalCompletionReceiptStoreLive().pipe(withStateRoot({}), Effect.flip);
      expect(error).toBeInstanceOf(YeetCommandError);
      expect(error.message).toBe("Cannot resolve the goal completion receipt store directory.");
    })
  );
  it.effect("reports a receipt that cannot encode as a typed command error before touching the file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-receipts-" });
      const store = yield* makeGoalCompletionReceiptStoreAt(root);
      // Checks are skipped at construction only; encoding still enforces a positive final PR.
      const invalid = GoalCompletionReceipt.make(
        { ...receipt("example/repo", "a"), finalPullRequest: 0 },
        {
          disableChecks: true,
        }
      );
      const error = yield* store.append(invalid).pipe(Effect.flip);
      expect(error).toBeInstanceOf(YeetCommandError);
      expect(error.message).toBe("Failed to encode the goal completion receipt.");
      const exists7 = yield* fs.exists(path.join(root, "github.com__example__repo.jsonl"));
      expect(exists7).toBe(false);
    })
  );
  it.effect("maps filesystem failures on append and list to typed command errors", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-receipts-" });
      // A regular file where the store directory belongs blocks both reads and appends.
      const blocked = path.join(root, "blocked");
      yield* fs.writeFileString(blocked, "");
      const store = yield* makeGoalCompletionReceiptStoreAt(blocked);
      const appendError = yield* store.append(receipt("example/repo", "a")).pipe(Effect.flip);
      expect(appendError).toBeInstanceOf(YeetCommandError);
      expect(appendError.message).toMatch(/^Goal completion receipt store: /u);
      const listError = yield* store.list("example/repo").pipe(Effect.flip);
      expect(listError).toBeInstanceOf(YeetCommandError);
      expect(listError.message).toMatch(/^Goal completion receipt store: /u);
    })
  );
});

const decodeGoalManifest = S.decodeEffect(GoalManifest);
const final = GoalPullRequestRef.make({ number: 7, role: "final" });
const at = DateTime.makeUnsafe("2026-11-01T00:00:00Z");
const verifiedCheck = (kind: "hosted-required-checks" | "hosted-review-threads", ref: string) =>
  GoalEvidenceCheck.make({
    ref: GoalAcceptanceEvidenceRef.make({ kind, ref, gating: true }),
    outcome: "verified",
    observedHead: O.some("accepted-head"),
    detail: "Recorded hosted result",
  });
const claim = GoalRedAttributionClaim.make({
  context: "Lint",
  attribution: "inherited",
  fixPullRequest: 2994,
  decisionFile: "goals/demo/decisions/2026-11-14-final-merged-over-lint.md",
  source: "origin-main",
});

// A complete merged receipt for `demo` whose one required context, Lint, is red.
const storedRow = Effect.fn("ReceiptStoreTest.storedRow")(function* (
  overrides: Partial<Pick<GoalCompletionReceipt, "schemaVersion" | "outcome" | "redAttributions" | "evidence">>
) {
  const manifest = yield* decodeGoalManifest({
    initiative: { id: "demo", status: "completed-retained" },
    completionGate: {
      operator: "yeet",
      requiresPullRequest: true,
      requiresMergeable: true,
      statement: "Ship via yeet",
      grandfathered: false,
      pullRequests: [{ number: 7, role: "final" }],
    },
  });
  const digest = yield* goalCompletionDeclarationDigest(manifest);
  const row = GoalCompletionReceipt.make({
    repository: "example/repo",
    packet: "demo",
    declarationDigest: digest,
    acceptedDeclarationDigest: O.some(digest),
    requiredChecks: O.some(
      GoalRequiredCheckSnapshot.make({
        contexts: ["Lint"],
        sources: ["repos/{owner}/{repo}/rulesets/42/history/1"],
        effectiveAt: at,
        inventoryComplete: true,
        mergeTimeInventory: O.some(
          GoalMergeTimeInventory.make({
            source: "repos/{owner}/{repo}/rulesets/rule-suites/1",
            ruleSuiteId: 1,
            ref: "refs/heads/main",
            afterSha: "merge-result",
            pushedAt: at,
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
    finalPullRequest: 7,
    acceptedHead: O.some("accepted-head"),
    merged: O.some(true),
    merge: O.some(
      GoalMergeResult.make({
        mergeCommit: "merge-result",
        tree: "merge-tree",
        mergedAt: at,
        method: O.none(),
        baseRef: "main",
      })
    ),
    evidence: [
      verifiedCheck("hosted-required-checks", "required"),
      verifiedCheck("hosted-review-threads", "outstanding"),
    ],
    requiredCheckFacts: [
      GoalRequiredCheckFact.make({
        context: "Lint",
        head: "accepted-head",
        checkRunId: O.some(51),
        conclusion: "cancelled",
        outcome: "unsatisfied",
        source: "check-run",
      }),
    ],
    reviewThreads: O.some(GoalReviewThreadTally.make({ total: 1, outstanding: 0 })),
    nonRequiredReds: [],
    subClaims: [],
    outcome: "unsatisfied",
    verifiedAt: at,
    ...overrides,
  });
  return { manifest, row };
});

const readBack = Effect.fn("ReceiptStoreTest.readBack")(function* (manifest: GoalManifest, row: GoalCompletionReceipt) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "goal-receipts-" });
  const store = yield* makeGoalCompletionReceiptStoreAt(root);
  yield* store.append(row);
  return yield* storedGoalCompletion(root, "demo", manifest, final).pipe(
    Effect.provideService(
      GoalCompletionIo,
      completionIoFixture({
        manifest: Effect.succeed(""),
        origin: Effect.succeed("git@github.com:example/repo.git"),
        respond: () => Effect.die("re-resolving a stored receipt reads no GitHub endpoint"),
      })
    ),
    Effect.provideService(GoalCompletionReceiptStore, store)
  );
});

it.layer(NodeTestLayer, { timeout: "30 seconds" })("stored receipt re-resolution", (it) => {
  it.effect("a v1 row that verified stays verified as stored, without thread evidence", () =>
    Effect.gen(function* () {
      const { manifest, row } = yield* storedRow({
        schemaVersion: "goal-completion-receipt/v1",
        outcome: "verified",
        evidence: [verifiedCheck("hosted-required-checks", "required")],
      });
      const stored = yield* readBack(manifest, row);
      assertSome(stored, row);
    })
  );
  it.effect("any other v1 row re-resolves as unknown and names the rerun", () =>
    Effect.gen(function* () {
      const { manifest, row } = yield* storedRow({
        schemaVersion: "goal-completion-receipt/v1",
        outcome: "unsatisfied",
      });
      const read = yield* readBack(manifest, row);
      const stored = O.getOrThrow(read);
      expect(stored.outcome).toBe("unknown");
      expect(stored.schemaVersion).toBe("goal-completion-receipt/v1");
      expect(goalCompletionUnknownReasons(stored)).toContain("v1 receipt predates hosted-only rules; rerun refresh");
    })
  );
  it.effect("a v2 row re-resolves from its own facts and keeps its committed claims", () =>
    Effect.gen(function* () {
      const attributed = yield* storedRow({ outcome: "verified", redAttributions: [claim] });
      const read = yield* readBack(attributed.manifest, attributed.row);
      const stored = O.getOrThrow(read);
      expect(stored.outcome).toBe("verified");
      expect(stored.schemaVersion).toBe("goal-completion-receipt/v2");
      expect(stored.redAttributions).toEqual([claim]);
      assertSome(stored.reviewThreads, GoalReviewThreadTally.make({ total: 1, outstanding: 0 }));
      const verdict = goalCompletionVerdict(stored);
      expect(verdict._tag === "verified" ? A.map(verdict.attributedReds, (red) => red.context) : []).toEqual(["Lint"]);
      // The same row stored without its claim cannot verify: the red is unattributed.
      const bare = yield* storedRow({ outcome: "verified" });
      const bareRead = yield* readBack(bare.manifest, bare.row);
      const unattributed = O.getOrThrow(bareRead);
      expect(unattributed.outcome).toBe("unsatisfied");
    })
  );
});
