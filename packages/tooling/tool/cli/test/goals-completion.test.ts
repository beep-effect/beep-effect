import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  compileCapabilityProjection,
  GoalAcceptanceEvidenceRef,
  GoalCloseoutRecord,
  GoalCompletionGate,
  GoalCompletionObservation,
  GoalCompletionReceipt,
  GoalCompletionVerifier,
  GoalEvidenceCheck,
  GoalManifest,
  GoalMergeMethod,
  GoalMergeResult,
  GoalMergeTimeInventory,
  GoalMergeTimeRuleSource,
  GoalMergeTimeRuleSourceRecord,
  GoalProposedCloseout,
  GoalPullRequestRef,
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
  goalCloseoutVerification,
  goalCloseoutView,
  goalCompletionDeclarationDigest,
  goalPullRequestRefs,
  projectGoalLifecycle,
  readGoalCloseoutViews,
  renderGoalCloseoutRecord,
  renderGoalCloseoutRecordView,
  renderGoalCloseoutView,
} from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeGoalCompletionGate = S.decodeEffect(GoalCompletionGate);
const decodeGoalManifest = S.decodeEffect(GoalManifest);
const decodeGoalRequiredCheckSnapshot = S.decodeEffect(GoalRequiredCheckSnapshot);
const decodeGoalCompletionReceiptJson = S.decodeEffect(S.fromJsonString(GoalCompletionReceipt));
const encodeGoalCompletionReceiptJson = S.encodeEffect(S.fromJsonString(GoalCompletionReceipt));
const encodeGoalManifestJson = S.encodeEffect(S.fromJsonString(GoalManifest));

const time = DateTime.makeUnsafe("2026-10-06T00:55:25Z");
const gate = GoalCompletionGate.make({
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet",
  grandfathered: false,
});
const ref = GoalAcceptanceEvidenceRef.make({ kind: "hosted-required-checks", ref: "required", gating: true });
const MERGE_COMMIT = "squash-result-not-descended-from-head";
// A complete merge-time inventory: GitHub's merge-push rule suite, bound to the
// merge commit, with a recovered history version for its one required-check ruleset.
const completeInventory = GoalMergeTimeInventory.make({
  source: "repos/{owner}/{repo}/rulesets/rule-suites/1",
  ruleSuiteId: 1,
  ref: "refs/heads/main",
  afterSha: MERGE_COMMIT,
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
});
const lintFact = GoalRequiredCheckFact.make({
  context: "Lint",
  head: "accepted-head",
  checkRunId: O.some(1),
  conclusion: "success",
  outcome: "verified",
  source: "check-run",
});
const fixture = () =>
  GoalCompletionObservation.make({
    repository: "example/repo",
    packet: "unmentioned-packet",
    declarationDigest: "declaration",
    acceptedDeclarationDigest: O.some("accepted-declaration"),
    requiredChecks: O.some(
      GoalRequiredCheckSnapshot.make({
        contexts: ["Lint"],
        sources: ["repos/{owner}/{repo}/rulesets/42/history/1"],
        effectiveAt: time,
        inventoryComplete: true,
        mergeTimeInventory: O.some(completeInventory),
      })
    ),
    requiredCheckFacts: [lintFact],
    finalPullRequest: 1429,
    acceptedHead: O.some("accepted-head"),
    merged: O.some(true),
    grandfathered: false,
    merge: O.some(
      GoalMergeResult.make({
        mergeCommit: MERGE_COMMIT,
        tree: "merge-tree",
        mergedAt: time,
        method: O.some("squash"),
        baseRef: "main",
      })
    ),
    evidence: [
      GoalEvidenceCheck.make({
        ref,
        outcome: "verified",
        observedHead: O.some("accepted-head"),
        detail: "Green required lanes at accepted head",
      }),
    ],
    nonRequiredReds: [],
    subClaims: [],
    verifiedAt: time,
  });

describe("goal completion declaration", () => {
  it.effect.prop(
    "normalizes arbitrary explicit PR declarations without changing their roles",
    [Arbitrary.schema(GoalPullRequestRef)],
    Effect.fnUntraced(function* ([reference]) {
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "typed", status: "completed-retained" },
        completionGate: { ...gate, pullRequests: [reference] },
      });
      expect(goalPullRequestRefs(manifest)).toEqual([reference]);
    }),
    { arbitrary: { runs: 32 } }
  );
  it.effect("leaves packets without PR declarations on the legacy citation path", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "legacy", status: "completed-retained" },
        completionGate: gate,
      });
      expect(goalPullRequestRefs(manifest)).toEqual([]);
    })
  );
  it.effect("normalizes a singular PR with no plural list", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "legacy", status: "completed-retained" },
        completionGate: gate,
        mergedPullRequest: 8,
      });
      expect(goalPullRequestRefs(manifest)).toEqual([{ number: 8, role: "final" }]);
    })
  );
  it.effect("normalizes singular and plural legacy PRs in memory", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "legacy", status: "completed-retained" },
        completionGate: gate,
        mergedPullRequest: 168,
        mergedPullRequests: [167, 168],
      });
      expect(goalPullRequestRefs(manifest)).toEqual([
        { number: 168, role: "final" },
        { number: 167, role: "supporting" },
      ]);
      expect(manifest.completionGate.pullRequests).toBeUndefined();
    })
  );
  it.effect("uses the last plural PR as final without a singular reference", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "legacy", status: "completed-retained" },
        completionGate: gate,
        mergedPullRequests: [167, 168],
      });
      expect(goalPullRequestRefs(manifest)).toEqual([
        { number: 168, role: "final" },
        { number: 167, role: "supporting" },
      ]);
    })
  );
  it.effect("rejects multiple final PRs", () =>
    Effect.gen(function* () {
      const exit = yield* decodeGoalCompletionGate({
        ...gate,
        pullRequests: [
          { number: 1, role: "final" },
          { number: 2, role: "final" },
        ],
      }).pipe(Effect.exit);
      expect(exit._tag).toBe("Failure");
    })
  );
  it.effect("explicit supporting-only references do not invent a final PR", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeGoalManifest({
        initiative: { id: "typed", status: "completed-retained" },
        completionGate: { ...gate, pullRequests: [{ number: 7, role: "supporting" }] },
        mergedPullRequest: 8,
      });
      expect(goalPullRequestRefs(manifest)).toEqual([{ number: 7, role: "supporting" }]);
    })
  );
});

describe("pure goal completion resolver", () => {
  it.effect("a legacy receipt row with a recovered version and no history fails closed as gating", () =>
    Effect.gen(function* () {
      const observation = fixture();
      const snapshot = O.getOrThrow(observation.requiredChecks);
      const deleted = GoalMergeTimeRuleSource.make({
        sourceType: "ruleset",
        rulesetId: O.some(999),
        name: O.none(),
        enforcement: "deleted ruleset",
        requiredStatusChecks: O.some("fail"),
        survives: false,
        version: O.some("repos/{owner}/{repo}/rulesets/999/history/1"),
        history: "gating",
      });
      const receipt = yield* GoalCompletionVerifier.resolve(
        GoalCompletionObservation.make({
          ...observation,
          requiredChecks: O.some(
            GoalRequiredCheckSnapshot.make({
              ...snapshot,
              mergeTimeInventory: O.some(
                GoalMergeTimeInventory.make({
                  ...completeInventory,
                  ruleSources: [...completeInventory.ruleSources, deleted],
                })
              ),
            })
          ),
        })
      );
      expect(receipt.outcome).toBe("unsatisfied");
      // Rewrite the stored JSON into the shape written before `history` existed.
      const argument = Str.replace(/,"history":"(gating|unread)"/gu, "");
      const encodedGoalCompletionReceiptJson = yield* encodeGoalCompletionReceiptJson(receipt);
      const legacyText = argument(encodedGoalCompletionReceiptJson);
      expect(Str.includes('"history"')(legacyText)).toBe(false);
      const legacy = yield* decodeGoalCompletionReceiptJson(legacyText);
      const sources = O.getOrThrow(O.flatMap(legacy.requiredChecks, (value) => value.mergeTimeInventory)).ruleSources;
      expect(A.map(sources, (source) => source.history)).toEqual(["gating", "gating"]);
      const reresolved = yield* GoalCompletionVerifier.resolve(
        GoalCompletionObservation.make({ ...legacy, merged: O.some(true), grandfathered: false })
      );
      expect(reresolved.outcome).toBe("unsatisfied");
      const unversioned = yield* S.decodeEffect(GoalMergeTimeRuleSourceRecord)({
        sourceType: "ruleset",
        rulesetId: 999,
        name: null,
        enforcement: "deleted ruleset",
        requiredStatusChecks: "fail",
        survives: false,
        version: null,
      });
      expect(unversioned.history).toBe("unread");
    })
  );
  it.effect("requires complete historical inventory despite green surviving contexts", () =>
    Effect.gen(function* () {
      const observation = fixture();
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...observation,
            requiredChecks: O.none(),
          })
        )).outcome
      ).toBe("unknown");
      const snapshot = GoalRequiredCheckSnapshot.make({
        contexts: ["Lint"],
        sources: ["surviving-ruleset/history/1"],
        effectiveAt: time,
        inventoryComplete: false,
      });
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...observation,
            requiredChecks: O.some(snapshot),
          })
        )).outcome
      ).toBe("unknown");
      // The completeness flag alone never verifies: the stored rule suite must prove it.
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...observation,
            requiredChecks: O.some(GoalRequiredCheckSnapshot.make({ ...snapshot, inventoryComplete: true })),
          })
        )).outcome
      ).toBe("unknown");
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...observation,
            requiredChecks: O.some(
              GoalRequiredCheckSnapshot.make({
                ...snapshot,
                inventoryComplete: true,
                mergeTimeInventory: O.some(completeInventory),
              })
            ),
          })
        )).outcome
      ).toBe("verified");
      const legacy = yield* decodeGoalRequiredCheckSnapshot({
        contexts: ["Lint"],
        sources: ["surviving-ruleset/history/1"],
        effectiveAt: "2026-10-06T00:55:25Z",
      });
      expect(legacy.inventoryComplete).toBe(false);
      expect(legacy.rulesetReadsComplete).toBe(true);
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...observation,
            requiredChecks: O.some(
              GoalRequiredCheckSnapshot.make({ ...snapshot, inventoryComplete: true, rulesetReadsComplete: false })
            ),
          })
        )).outcome
      ).toBe("unknown");
    })
  );
  it.effect("round-trips the persisted JSON boundary including optional head and merge facts", () =>
    Effect.gen(function* () {
      const receipt = yield* GoalCompletionVerifier.resolve(fixture());
      const text = yield* encodeGoalCompletionReceiptJson(receipt);
      const decoded = yield* decodeGoalCompletionReceiptJson(text);
      expect(decoded.outcome).toBe("verified");
      assertSome(decoded.acceptedHead, "accepted-head");
      assertSome(
        O.map(decoded.merge, (merge) => merge.method),
        O.some("squash")
      );
    })
  );

  it.effect("verifies a merged PR with no packet-name commit and a non-ancestor squash head", () =>
    Effect.gen(function* () {
      const receipt = yield* GoalCompletionVerifier.resolve(fixture());
      expect(receipt.outcome).toBe("verified");
      assertSome(
        O.map(receipt.merge, (merge) => merge.method),
        O.some("squash")
      );
    })
  );
  for (const method of GoalMergeMethod.literals) {
    it.effect(`verifies GitHub-bound ${method} results`, () =>
      Effect.gen(function* () {
        const observation = fixture();
        const merge = O.getOrThrow(observation.merge);
        const parsed = GoalMergeResult.make({ ...merge, method: O.some(method) });
        expect(
          (yield* GoalCompletionVerifier.resolve(
            GoalCompletionObservation.make({ ...observation, merge: O.some(parsed) })
          )).outcome
        ).toBe("verified");
      })
    );
  }
  it.effect("unmerged or closed PR gives positive unsatisfaction", () =>
    Effect.gen(function* () {
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({ ...fixture(), merged: O.some(false), merge: O.none() })
        )).outcome
      ).toBe("unsatisfied");
    })
  );
  it.effect("network failure and rate limit give unknown", () =>
    Effect.gen(function* () {
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({ ...fixture(), merged: O.none(), merge: O.none(), evidence: [] })
        )).outcome
      ).toBe("unknown");
    })
  );
  it.effect("stale-head evidence cannot satisfy completion", () =>
    Effect.gen(function* () {
      const evidence = GoalEvidenceCheck.make({
        ref,
        outcome: "verified",
        observedHead: O.some("old-head"),
        detail: "Stale",
      });
      expect(
        (yield* GoalCompletionVerifier.resolve(GoalCompletionObservation.make({ ...fixture(), evidence: [evidence] })))
          .outcome
      ).toBe("unsatisfied");
    })
  );
  it.effect("red required checks are unsatisfied", () =>
    Effect.gen(function* () {
      const evidence = GoalEvidenceCheck.make({
        ref,
        outcome: "unsatisfied",
        observedHead: O.some("accepted-head"),
        detail: "Red required context",
      });
      expect(
        (yield* GoalCompletionVerifier.resolve(GoalCompletionObservation.make({ ...fixture(), evidence: [evidence] })))
          .outcome
      ).toBe("unsatisfied");
    })
  );
  it.effect("missing evidence is unknown", () =>
    Effect.gen(function* () {
      const evidence = GoalEvidenceCheck.make({ ref, outcome: "unknown", observedHead: O.none(), detail: "Missing" });
      expect(
        (yield* GoalCompletionVerifier.resolve(GoalCompletionObservation.make({ ...fixture(), evidence: [evidence] })))
          .outcome
      ).toBe("unknown");
    })
  );
  it.effect("grandfathered packets short-circuit unavailable observations", () =>
    Effect.gen(function* () {
      expect(
        (yield* GoalCompletionVerifier.resolve(
          GoalCompletionObservation.make({
            ...fixture(),
            grandfathered: true,
            merged: O.none(),
            merge: O.none(),
            evidence: [],
          })
        )).outcome
      ).toBe("verified");
    })
  );
  it.effect("non-gating historical window failure does not reset completion", () =>
    Effect.gen(function* () {
      const check = GoalEvidenceCheck.make({
        ref: GoalAcceptanceEvidenceRef.make({ kind: "packet-history", ref: "window", gating: false }),
        outcome: "unsatisfied",
        observedHead: O.some("accepted-head"),
        detail: "Seven seconds",
      });
      expect(
        (yield* GoalCompletionVerifier.resolve(GoalCompletionObservation.make({ ...fixture(), subClaims: [check] })))
          .outcome
      ).toBe("verified");
    })
  );
});

it.layer(
  Layer.mergeAll(
    MemoryFileSystem.layer,
    Path.layer,
    NodeCrypto.layer,
    ScriptedSpawner.make(() =>
      PlatformError.systemError({
        _tag: "NotFound",
        module: "ChildProcess",
        method: "spawn",
        pathOrDescriptor: "git",
        description: "The fixture has no Git remote.",
      })
    ).layer
  ),
  { timeout: "10 seconds" }
)("prospective goal closeout", (it) => {
  const proposal = GoalProposedCloseout.make({ status: "completed-retained", finalPullRequest: 1429 });
  const readiness = GoalAcceptanceEvidenceRef.make({
    kind: "yeet-verdict",
    ref: ".beep/yeet/verdict.json",
    gating: true,
  });
  const proposalGate = GoalCompletionGate.make({ ...gate, acceptanceEvidence: [readiness] });
  const manifest = () =>
    GoalManifest.make({
      initiative: { id: "unmentioned-packet", status: "active" },
      completionGate: proposalGate,
      proposedCloseout: proposal,
      provides: ["goals/example"],
    });
  const receipt = Effect.fnUntraced(function* () {
    const digest = yield* goalCompletionDeclarationDigest(manifest());
    return yield* GoalCompletionVerifier.resolve(
      GoalCompletionObservation.make({
        ...fixture(),
        evidence: [
          ...fixture().evidence,
          GoalEvidenceCheck.make({
            ref: readiness,
            outcome: "verified",
            observedHead: O.some("accepted-head"),
            detail: "Exact-head Yeet readiness: review threads/window and hosted checks satisfied",
          }),
        ],
        declarationDigest: digest,
        acceptedDeclarationDigest: O.some(digest),
      })
    );
  });

  it.effect("keeps proposed closeouts explicit in checkout-local session views", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory("/workspace/goals/unmentioned-packet/ops", { recursive: true });
      const text = yield* encodeGoalManifestJson(manifest());
      yield* fs.writeFileString("/workspace/goals/unmentioned-packet/ops/manifest.json", text);
      const views = yield* readGoalCloseoutViews("/workspace");
      expect(views).toEqual([
        {
          packet: "unmentioned-packet",
          operativeStatus: "active",
          proposedCloseout: proposal,
          verification: "unverified",
        },
      ]);
      expect(A.map(views, renderGoalCloseoutView)).toEqual(["completed-retained (proposed via #1429, unverified)"]);
    })
  );

  it.effect("derives the operative status from the proposal once a matching receipt verifies", () =>
    Effect.gen(function* () {
      const value = manifest();
      const goalCloseoutView1 = yield* goalCloseoutView("unmentioned-packet", value, O.none());
      const unverified = O.getOrThrow(goalCloseoutView1);
      expect(unverified.operativeStatus).toBe("active");
      expect(unverified.verification).toBe("unverified");
      expect(renderGoalCloseoutView(unverified)).toBe("completed-retained (proposed via #1429, unverified)");

      const receipt11 = yield* receipt();
      const goalCloseoutView2 = yield* goalCloseoutView("unmentioned-packet", value, O.some(receipt11));
      const verified = O.getOrThrow(goalCloseoutView2);
      expect(verified.operativeStatus).toBe("completed-retained");
      expect(verified.verification).toBe("verified");
      expect(renderGoalCloseoutView(verified)).toBe("completed-retained (verified via #1429, adoption pending)");
      expect(goalCloseoutVerification(proposal, "completed-retained")).toBe("verified");
      expect(goalCloseoutVerification(proposal, "paused")).toBe("unverified");
      // The manifest itself never moves: completion stays derived.
      expect(value.initiative.status).toBe("active");
    })
  );

  it.effect("has no closeout view for a manifest without a proposal", () =>
    Effect.gen(function* () {
      const value = GoalManifest.make({
        initiative: { id: "unmentioned-packet", status: "active" },
        completionGate: proposalGate,
      });
      const goalCloseoutView3 = yield* goalCloseoutView("unmentioned-packet", value, O.none());
      assertNone(goalCloseoutView3);
    })
  );

  it.effect("keeps an unmerged proposal active in lifecycle and capability projections", () =>
    Effect.gen(function* () {
      const value = manifest();
      expect(goalPullRequestRefs(value)).toEqual([{ number: 1429, role: "final" }]);
      const projectGoalLifecycle4 = yield* projectGoalLifecycle(value, O.none());
      expect(projectGoalLifecycle4).toBe("active");
      expect(compileCapabilityProjection([value]).packets[0]?.status).toBe("active");
      const row = yield* receipt();
      const projectGoalLifecycle5 = yield* projectGoalLifecycle(
        value,
        O.some(GoalCompletionReceipt.make({ ...row, merge: O.none() }))
      );
      expect(projectGoalLifecycle5).toBe("active");
    })
  );
  it.effect("activates a merged proposal with exact-head hosted proof without rewriting its manifest", () =>
    Effect.gen(function* () {
      const value = manifest();
      const receipt6 = yield* receipt();
      const status = yield* projectGoalLifecycle(value, O.some(receipt6));
      expect(status).toBe("completed-retained");
      expect(compileCapabilityProjection([value], { [value.initiative.id]: status }).packets[0]?.status).toBe(
        "completed-retained"
      );
      expect(value.initiative.status).toBe("active");
    })
  );
  it.effect(
    "rejects failed gates, stale heads, missing inventories and mismatched declarations despite a verified flag",
    () =>
      Effect.gen(function* () {
        const row = yield* receipt();
        const bad = [
          GoalCompletionReceipt.make({ ...row, requiredChecks: O.none() }),
          GoalCompletionReceipt.make({ ...row, evidence: fixture().evidence }),
          GoalCompletionReceipt.make({
            ...row,
            evidence: [
              ...fixture().evidence,
              GoalEvidenceCheck.make({
                ref: readiness,
                outcome: "unsatisfied",
                observedHead: row.acceptedHead,
                detail: "review/window failed",
              }),
            ],
          }),
          GoalCompletionReceipt.make({ ...row, acceptedHead: O.some("later-head") }),
          GoalCompletionReceipt.make({ ...row, acceptedDeclarationDigest: O.some("different-declaration") }),
          GoalCompletionReceipt.make({ ...row, declarationDigest: "different-declaration" }),
          GoalCompletionReceipt.make({ ...row, packet: "another-packet" }),
          GoalCompletionReceipt.make({ ...row, finalPullRequest: 1430 }),
          GoalCompletionReceipt.make({
            ...row,
            evidence: [
              GoalEvidenceCheck.make({
                ref,
                outcome: "unsatisfied",
                observedHead: row.acceptedHead,
                detail: "failed gate",
              }),
            ],
          }),
          GoalCompletionReceipt.make({
            ...row,
            requiredCheckFacts: [
              GoalRequiredCheckFact.make({
                ...lintFact,
                conclusion: "failure",
                outcome: "unsatisfied",
              }),
            ],
          }),
        ];
        for (const candidate of bad) {
          const projectGoalLifecycle1 = yield* projectGoalLifecycle(manifest(), O.some(candidate));
          expect(projectGoalLifecycle1).toBe("active");
        }
      })
  );
  it.effect("validates operative status and final PR identity independently of prose", () =>
    Effect.gen(function* () {
      for (const candidate of [
        { ...manifest(), initiative: { id: "unmentioned-packet", status: "completed-retained" } },
        { ...manifest(), proposedCloseout: { ...proposal, status: "achieved" } },
        { ...manifest(), completionGate: { ...proposalGate, pullRequests: [{ number: 99, role: "final" }] } },
      ]) {
        expect((yield* S.decodeUnknownEffect(GoalManifest)(candidate).pipe(Effect.exit))._tag).toBe("Failure");
      }
      const matching = yield* S.decodeEffect(GoalManifest)({
        ...manifest(),
        completionGate: { ...proposalGate, pullRequests: [{ number: 1429, role: "final" }] },
      });
      expect(goalPullRequestRefs(matching)).toEqual([{ number: 1429, role: "final" }]);
      expect(
        goalPullRequestRefs(
          GoalManifest.make({
            ...manifest(),
            completionGate: {
              ...proposalGate,
              pullRequests: [{ number: 10, role: "supporting" }],
            },
          })
        )
      ).toEqual([
        { number: 1429, role: "final" },
        { number: 10, role: "supporting" },
      ]);
      expect(
        (yield* S.decodeEffect(GoalManifest)({ ...manifest(), completionGate: gate }).pipe(Effect.exit))._tag
      ).toBe("Failure");
      const paused = GoalManifest.make({ ...manifest(), initiative: { id: "unmentioned-packet", status: "paused" } });
      const projectGoalLifecycle7 = yield* projectGoalLifecycle(paused, O.none());
      expect(projectGoalLifecycle7).toBe("paused");
    })
  );
  const adopted = () => {
    const { proposedCloseout: _proposal, ...rest } = manifest();
    return {
      ...rest,
      initiative: { id: "unmentioned-packet", status: "completed-retained" as const },
      closeout: GoalCloseoutRecord.make({ status: "completed-retained", finalPullRequest: 1429 }),
    };
  };
  it.effect("keeps the declaration digest and final PR when a verified proposal becomes a committed record", () =>
    Effect.gen(function* () {
      const record = yield* S.decodeEffect(GoalManifest)(adopted());
      const goalCompletionDeclarationDigest8 = yield* goalCompletionDeclarationDigest(record);
      const expectation = expect(goalCompletionDeclarationDigest8);
      const goalCompletionDeclarationDigest2 = yield* goalCompletionDeclarationDigest(manifest());
      expectation.toBe(goalCompletionDeclarationDigest2);
      expect(goalPullRequestRefs(record)).toEqual(goalPullRequestRefs(manifest()));
      const receipt12 = yield* receipt();
      const projectGoalLifecycle9 = yield* projectGoalLifecycle(record, O.some(receipt12));
      expect(projectGoalLifecycle9).toBe("completed-retained");
      const receipt13 = yield* receipt();
      const goalCloseoutView10 = yield* goalCloseoutView("unmentioned-packet", record, O.some(receipt13));
      assertNone(goalCloseoutView10);
      expect(
        renderGoalCloseoutRecord(GoalCloseoutRecord.make({ status: "completed-retained", finalPullRequest: 7 }))
      ).toBe("completed-retained via #7");
      const committed = GoalCloseoutRecord.make({ status: "completed-retained", finalPullRequest: 1429 });
      expect(renderGoalCloseoutRecordView(committed, "verified")).toBe("completed-retained (verified via #1429)");
      expect(renderGoalCloseoutRecordView(committed, "unverified")).toBe(
        "completed-retained (committed via #1429, unverified)"
      );
    })
  );
  it.effect("rejects a committed closeout record without its status, beside a proposal or on another final PR", () =>
    Effect.gen(function* () {
      for (const candidate of [
        { ...adopted(), initiative: { id: "unmentioned-packet", status: "active" } },
        { ...adopted(), proposedCloseout: proposal },
        { ...adopted(), completionGate: { ...proposalGate, pullRequests: [{ number: 99, role: "final" }] } },
        { ...adopted(), completionGate: gate },
      ]) {
        expect((yield* S.decodeUnknownEffect(GoalManifest)(candidate).pipe(Effect.exit))._tag).toBe("Failure");
      }
    })
  );
});
