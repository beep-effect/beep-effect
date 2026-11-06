import {
  dispatchOwnerCheckpointMerge,
  FinalCheckGate,
  FinalCheckReceipt,
  FinalCheckStepResult,
  MergeGateCheckRun,
  MergeGateRead,
  makeOwnerCheckpointStore,
  OwnerCheckpointBinding,
  OwnerCheckpointClassicStatus,
  OwnerCheckpointCommand,
  OwnerCheckpointError,
  OwnerCheckpointEvidence,
  OwnerCheckpointObserver,
  OwnerCheckpointPolicy,
  OwnerCheckpointRequest,
  OwnerCheckpointSnapshot,
  OwnerCheckpointState,
  OwnerCheckpointStatusEvidence,
  observeOwnerCheckpointMerge,
  projectOwnerCheckpointClassicStatus,
  projectOwnerCheckpointSelfCheck,
  qualifyOwnerCheckpointEvidence,
  qualifyOwnerCheckpointSnapshot,
  SquashCommitlintPass,
  SquashCommitlintReport,
  SquashCommitMessage,
  YeetReviewWindowElapsed,
} from "@beep/repo-cli/test/Yeet";
import { Sha256Hex } from "@beep/schema";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import pullFixture from "./fixtures/yeet-merge-gate/pull.json" with { type: "json" };
import { recordedGithub } from "./support/YeetGithub.ts";

const head = Str.repeat(40)("a");
const merge = Str.repeat(40)("b");
const digest = Sha256Hex.make(Str.repeat(64)("c"));
const releaseId = Sha256Hex.make(Str.repeat(64)("d"));
const claimId = Sha256Hex.make(Str.repeat(64)("e"));
const now = DateTime.makeUnsafe("2026-11-05T00:21:00Z");
const ms = DateTime.toEpochMillis(now);
const at = (offset: number) => DateTime.makeUnsafe(ms + offset);
const binding = OwnerCheckpointBinding.make({
  repository: "beep-effect/beep-effect",
  prNumber: 42,
  owner: digest,
  head,
  generation: 0,
});
const policy = OwnerCheckpointPolicy.make({ applicationId: 123, context: "Owner checkpoint", maxAgeMillis: 1000 });
const read = (offset = -10, ownSuccess = false) =>
  MergeGateRead.make({
    prNumber: 42,
    title: "feat: fixed fixture",
    headSha: head,
    draft: false,
    mergeableState: "clean",
    labels: [],
    attributedChecks: [],
    requiredContexts: O.some(["Lint", "Owner checkpoint"]),
    checkRuns: [
      MergeGateCheckRun.make({ id: 1, name: "Lint", status: "completed", conclusion: "success" }),
      MergeGateCheckRun.make({
        id: 2,
        name: "Owner checkpoint",
        status: ownSuccess ? "completed" : "in_progress",
        conclusion: ownSuccess ? "success" : null,
      }),
    ],
    baseRuns: O.none(),
    window: YeetReviewWindowElapsed.make({
      anchor: "head-push",
      anchoredAt: "2026-11-05T00:00:00Z",
      windowMs: 1200000,
    }),
    unresolvedThreads: O.some(0),
    squashCommitlint: SquashCommitlintReport.make({
      message: SquashCommitMessage.make({ header: "feat: fixed fixture", body: "" }),
      verdict: SquashCommitlintPass.make({}),
    }),
    readAt: at(offset),
  });
const snapshot = (offset = -10, ownSuccess = false) =>
  OwnerCheckpointSnapshot.make({
    repository: binding.repository,
    state: "open",
    read: read(offset, ownSuccess),
    selfCheck: { id: 2, applicationId: 123, run: O.getOrThrow(A.get(read(offset, ownSuccess).checkRuns, 1)) },
    statuses: [],
  });
const finalCheck = FinalCheckReceipt.make({
  headSha: head,
  mergeBase: head,
  base: "origin/main",
  complete: true,
  verdict: "pass",
  startedAt: DateTime.formatIso(at(-100)),
  finishedAt: DateTime.formatIso(at(-50)),
  steps: A.map(FinalCheckGate.literals, (gate) =>
    FinalCheckStepResult.make({
      gate,
      label: gate,
      hostedContext: gate,
      command: "fixture",
      status: "passed",
      durationMs: 1,
    })
  ),
  expectationRewrites: [],
});
const evidence = OwnerCheckpointEvidence.make({
  observer: OwnerCheckpointObserver.make({
    phase: "finished",
    outcome: "success",
    finalizedAt: at(-20),
    snapshot: snapshot(-30),
    digest,
  }),
  classic: snapshot(),
  finalCheck,
  digest,
});
const request = (revision: number, command: OwnerCheckpointCommand, ownerBinding = binding) =>
  OwnerCheckpointRequest.make({ binding: ownerBinding, expectedRevision: revision, command });
const release = () => request(0, OwnerCheckpointCommand.cases.Release.make({ releaseId, evidence }));
const claim = () => request(1, OwnerCheckpointCommand.cases.Claim.make({ claimId, snapshot: snapshot(-10, true) }));
const sqlite = (filename: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      if ("bun" in process.versions) {
        const client = yield* Effect.promise(() => import("@effect/sql-sqlite-bun/SqliteClient"));
        return client.layer({ filename });
      }
      const client = yield* Effect.promise(() => import("@effect/sql-sqlite-node/SqliteClient"));
      return client.layer({ filename });
    })
  );
const withDb = <Value, Error, Requirements>(filename: string, effect: Effect.Effect<Value, Error, Requirements>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const services = yield* Layer.build(sqlite(filename));
      return yield* Effect.provideContext(effect, services);
    })
  );
const inMemory = <Value, Error, Requirements>(effect: Effect.Effect<Value, Error, Requirements>) =>
  withDb(":memory:", effect);
const releasedStore = Effect.gen(function* () {
  const store = yield* makeOwnerCheckpointStore();
  yield* store.register(binding);
  yield* store.apply(release(), policy, now);
  return store;
});
const claimedStore = Effect.gen(function* () {
  const store = yield* releasedStore;
  yield* store.acknowledgePublication(binding, 1, 2);
  yield* store.apply(claim(), policy, now);
  return store;
});
const livePull = (merged = false) => ({
  ...pullFixture,
  node_id: "PR_fixture",
  body: "",
  html_url: "https://github.com/beep-effect/beep-effect/pull/42",
  labels: [],
  updated_at: DateTime.formatIso(now),
  number: 42,
  state: merged ? "closed" : "open",
  merged,
  merged_at: merged ? DateTime.formatIso(now) : null,
  draft: false,
  head: { ...pullFixture.head, sha: head },
});

// All source/HTTP/storage data in this file are fixed synthetic fixtures.
describe("offline owner checkpoint", () => {
  it.effect("qualifies upstream while its own App check is still pending, without circular readiness", () =>
    Effect.gen(function* () {
      const result = yield* qualifyOwnerCheckpointEvidence(binding, evidence, policy, now);
      expect(result._tag).toBe("merge");
      expect(result.relaxed).toBe(false);
      expect(result.tolerated).toEqual([]);
    })
  );
  it.effect("refuses another App's same-name check", () =>
    Effect.gen(function* () {
      const bad = OwnerCheckpointSnapshot.make({
        ...snapshot(),
        selfCheck: { ...snapshot().selfCheck, applicationId: 999 },
      });
      expect((yield* Effect.flip(qualifyOwnerCheckpointSnapshot(binding, bad, policy, now))).reason).toBe("evidence");
    })
  );
  it.effect("retains a second same-name check and holds its pending result", () =>
    Effect.gen(function* () {
      const source = snapshot();
      const bad = OwnerCheckpointSnapshot.make({
        ...source,
        read: MergeGateRead.make({
          ...source.read,
          checkRuns: [
            ...source.read.checkRuns,
            MergeGateCheckRun.make({ id: 3, name: "Owner checkpoint", status: "in_progress", conclusion: null }),
          ],
        }),
      });
      expect((yield* Effect.flip(qualifyOwnerCheckpointSnapshot(binding, bad, policy, now))).reason).toBe("gate");
    })
  );
  it.effect("holds a newer classic failure even though checks are green", () =>
    Effect.gen(function* () {
      const bad = OwnerCheckpointSnapshot.make({
        ...snapshot(),
        statuses: [
          OwnerCheckpointClassicStatus.make({
            id: 1,
            context: "external-quality",
            diagnostic: OwnerCheckpointStatusEvidence.cases.Ordinary.make({}),
            state: "success",
            updatedAt: at(-15),
          }),
          OwnerCheckpointClassicStatus.make({
            id: 2,
            context: "external-quality",
            diagnostic: OwnerCheckpointStatusEvidence.cases.Ordinary.make({}),
            state: "failure",
            updatedAt: at(-11),
          }),
        ],
      });
      expect((yield* Effect.flip(qualifyOwnerCheckpointSnapshot(binding, bad, policy, now))).reason).toBe("gate");
    })
  );
  it.effect("refuses post-observer final-check and stale or moved classic snapshots", () =>
    Effect.gen(function* () {
      const late = OwnerCheckpointEvidence.make({
        ...evidence,
        finalCheck: FinalCheckReceipt.make({ ...finalCheck, finishedAt: DateTime.formatIso(at(-5)) }),
      });
      expect((yield* Effect.flip(qualifyOwnerCheckpointEvidence(binding, late, policy, now))).reason).toBe("evidence");
      expect((yield* Effect.flip(qualifyOwnerCheckpointSnapshot(binding, snapshot(-1001), policy, now))).reason).toBe(
        "freshness"
      );
      const moved = OwnerCheckpointBinding.make({ ...binding, head: Str.repeat(40)("f") });
      expect((yield* Effect.flip(qualifyOwnerCheckpointSnapshot(moved, snapshot(), policy, now))).reason).toBe(
        "binding"
      );
    })
  );
  it.effect("rejects a receipt with a missing final-check family", () =>
    Effect.gen(function* () {
      const bad = OwnerCheckpointEvidence.make({
        ...evidence,
        finalCheck: FinalCheckReceipt.make({ ...finalCheck, steps: [] }),
      });
      expect((yield* Effect.flip(qualifyOwnerCheckpointEvidence(binding, bad, policy, now))).reason).toBe("evidence");
    })
  );
  it.effect("binds the App ID from the native row and ignores a spoofed sibling ID", () =>
    Effect.gen(function* () {
      const selfCheck = yield* projectOwnerCheckpointSelfCheck({
        id: 2,
        name: "Owner checkpoint",
        status: "in_progress",
        conclusion: null,
        applicationId: 123,
        app: { id: 999 },
      });
      expect(selfCheck.applicationId).toBe(999);
      const bad = OwnerCheckpointSnapshot.make({ ...snapshot(), selfCheck });
      expect((yield* Effect.flip(qualifyOwnerCheckpointSnapshot(binding, bad, policy, now))).reason).toBe("evidence");
    })
  );
  it.effect("exempts only the exact native vendor rate-limit, refusing other Vercel failures", () =>
    Effect.gen(function* () {
      const native = {
        id: 9,
        context: "Vercel – todox",
        state: "failure",
        creator: { login: "vercel[bot]" },
        description: "Deployment rate limited — retry in 24 hours.",
        target_url: "https://vercel.com/kriegclouds-projects?upgradeToPro=build-rate-limit",
        updated_at: DateTime.formatIso(at(-15)),
      };
      const limited = yield* projectOwnerCheckpointClassicStatus(native);
      expect(limited.diagnostic._tag).toBe("VercelBuildRateLimit");
      yield* qualifyOwnerCheckpointSnapshot(
        binding,
        OwnerCheckpointSnapshot.make({ ...snapshot(), statuses: [limited] }),
        policy,
        now
      );
      const ordinary = yield* projectOwnerCheckpointClassicStatus({ ...native, description: "Deployment failed" });
      expect(
        (yield* Effect.flip(
          qualifyOwnerCheckpointSnapshot(
            binding,
            OwnerCheckpointSnapshot.make({ ...snapshot(), statuses: [ordinary] }),
            policy,
            now
          )
        )).reason
      ).toBe("gate");
      const spoofed = yield* projectOwnerCheckpointClassicStatus({ ...native, creator: { login: "unknown" } });
      expect(spoofed.diagnostic._tag).toBe("Ordinary");
      expect(
        (yield* Effect.flip(
          qualifyOwnerCheckpointSnapshot(
            binding,
            OwnerCheckpointSnapshot.make({ ...snapshot(), statuses: [spoofed] }),
            policy,
            now
          )
        )).reason
      ).toBe("gate");
    })
  );
  it.effect("allows exactly one concurrent old-revision release and preserves one outbox intent", () =>
    inMemory(
      Effect.gen(function* () {
        const store = yield* makeOwnerCheckpointStore();
        yield* store.register(binding);
        const results = yield* Effect.all(
          [
            store.apply(release(), policy, now).pipe(Effect.result),
            store.apply(release(), policy, now).pipe(Effect.result),
          ],
          { concurrency: 2 }
        );
        expect(A.filter(results, Result.isSuccess)).toHaveLength(1);
        expect(A.filter(results, Result.isFailure)).toHaveLength(1);
        const entryOption = yield* store.outbox(binding, 1);
        const entry = O.getOrThrow(entryOption);
        expect(entry.intent._tag).toBe("CheckReleased");
        expect(entry.delivery._tag).toBe("Pending");
        const found7 = yield* store.read(binding);
        expect(O.getOrThrow(found7).revision).toBe(1);
      })
    )
  );
  it.effect("rolls back owner state when outbox insertion fails", () =>
    inMemory(
      Effect.gen(function* () {
        const store = yield* makeOwnerCheckpointStore();
        yield* store.register(binding);
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TRIGGER refuse_intent BEFORE INSERT ON yeet_owner_checkpoint_outbox
        WHEN NEW.revision = 1 BEGIN SELECT RAISE(ABORT, 'FIXTURE'); END`;
        expect((yield* Effect.flip(store.apply(release(), policy, now))).reason).toBe("storage");
        const found6 = yield* store.read(binding);
        expect(O.getOrThrow(found6).revision).toBe(0);
        const absentOutbox = yield* store.outbox(binding, 1);
        expect(O.isNone(absentOutbox)).toBe(true);
      })
    )
  );
  it.effect("cannot claim an unpublished, wrong-run, or nonsuccessful release check", () =>
    inMemory(
      Effect.gen(function* () {
        const store = yield* releasedStore;
        expect((yield* Effect.flip(store.apply(claim(), policy, now))).reason).toBe("publication");
        yield* store.acknowledgePublication(binding, 1, 3);
        expect((yield* Effect.flip(store.apply(claim(), policy, now))).reason).toBe("publication");
      })
    )
  );
  it.effect("synchronization invalidates the old generation without deleting its intent", () =>
    inMemory(
      Effect.gen(function* () {
        const store = yield* releasedStore;
        const changed = yield* store.apply(
          request(1, OwnerCheckpointCommand.cases.Synchronize.make({ head: Str.repeat(40)("f") })),
          policy,
          now
        );
        expect(changed.binding.generation).toBe(1);
        expect(changed.state._tag).toBe("Held");
        expect((yield* Effect.flip(store.apply(claim(), policy, now))).reason).toBe("binding");
        const found5 = yield* store.outbox(binding, 1);
        expect(O.getOrThrow(found5).intent._tag).toBe("CheckReleased");
      })
    )
  );
  it.effect("refuses synchronization and revocation while a merge is in flight", () =>
    inMemory(
      Effect.gen(function* () {
        const store = yield* claimedStore;
        const sync = request(2, OwnerCheckpointCommand.cases.Synchronize.make({ head: Str.repeat(40)("f") }));
        expect((yield* Effect.flip(store.apply(sync, policy, now))).reason).toBe("state");
        yield* store.prepareDispatch(binding, 2);
        yield* store.apply(request(2, OwnerCheckpointCommand.cases.Unknown.make({ claimId })), policy, now);
        expect(
          (yield* Effect.flip(
            store.apply(
              request(3, OwnerCheckpointCommand.cases.Synchronize.make({ head: Str.repeat(40)("f") })),
              policy,
              now
            )
          )).reason
        ).toBe("state");
        expect(
          (yield* Effect.flip(store.apply(request(3, OwnerCheckpointCommand.cases.Revoke.make({})), policy, now)))
            .reason
        ).toBe("state");
      })
    )
  );
  it.effect("public reads reject a different owner or generation at the same PR key", () =>
    inMemory(
      Effect.gen(function* () {
        const store = yield* makeOwnerCheckpointStore();
        yield* store.register(binding);
        expect(
          (yield* Effect.flip(store.read(OwnerCheckpointBinding.make({ ...binding, generation: 1 })))).reason
        ).toBe("binding");
      })
    )
  );
  it.effect("persists a dispatch fence across database reopen and refuses another dispatch", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const services = yield* Layer.build(NodeServices.layer);
        const fs = yield* Effect.provideContext(FileSystem.FileSystem, services);
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "owner-checkpoint-" });
        const filename = `${directory}/owner.sqlite`;
        yield* withDb(
          filename,
          Effect.gen(function* () {
            const store = yield* claimedStore;
            yield* store.prepareDispatch(binding, 2);
          })
        );
        yield* withDb(
          filename,
          Effect.gen(function* () {
            const store = yield* makeOwnerCheckpointStore();
            const found4 = yield* store.outbox(binding, 2);
            expect(O.getOrThrow(found4).delivery._tag).toBe("Dispatched");
            expect((yield* Effect.flip(store.prepareDispatch(binding, 2))).reason).toBe("conflict");
            const found3 = yield* store.read(binding);
            expect(O.getOrThrow(found3).state._tag).toBe("Claimed");
          })
        );
      })
    )
  );
  it.effect("serializes the full expected SHA into exactly one native merge request", () => {
    const github = recordedGithub((call) =>
      call.method === "PUT" ? { body: { merged: true, sha: merge, message: "merged" } } : { body: livePull() }
    );
    return github.provide(
      inMemory(
        Effect.gen(function* () {
          yield* TestClock.setTime(ms);
          const store = yield* claimedStore;
          const result = yield* dispatchOwnerCheckpointMerge(store, binding, 2, snapshot(-10, true), policy);
          expect(result._tag).toBe("Confirmed");
          const found2 = yield* store.read(binding);
          expect(O.getOrThrow(found2).state._tag).toBe("Merged");
          const puts = A.filter(github.calls, (call) => call.method === "PUT");
          expect(puts).toHaveLength(1);
          expect(puts[0]?.body).toEqual({ sha: head, merge_method: "squash" });
        })
      )
    );
  });
  it.effect("retains uncertain dispatch when result persistence fails and never retries merge", () => {
    const github = recordedGithub((call) =>
      call.method === "PUT" ? { unreachable: "PRIVATE_NATIVE_FAILURE" } : { body: livePull() }
    );
    return github.provide(
      inMemory(
        Effect.gen(function* () {
          yield* TestClock.setTime(ms);
          const store = yield* claimedStore;
          const sql = yield* SqlClient.SqlClient;
          yield* sql`CREATE TRIGGER refuse_result BEFORE UPDATE ON yeet_owner_checkpoint
        WHEN NEW.revision = 3 BEGIN SELECT RAISE(ABORT, 'FIXTURE'); END`;
          const result = yield* dispatchOwnerCheckpointMerge(store, binding, 2, snapshot(-10, true), policy);
          expect(result).toEqual({ _tag: "Uncertain", recording: "pending" });
          const found1 = yield* store.outbox(binding, 2);
          expect(O.getOrThrow(found1).delivery._tag).toBe("Dispatched");
          expect(
            (yield* Effect.flip(dispatchOwnerCheckpointMerge(store, binding, 2, snapshot(-10, true), policy))).reason
          ).toBe("conflict");
          expect(A.filter(github.calls, (call) => call.method === "PUT")).toHaveLength(1);
          expect(String(result)).not.toContain("PRIVATE_NATIVE_FAILURE");
        })
      )
    );
  });
  it.effect("recovers a confirmed same-PR/head merge by readback alone, retaining unknown commit SHA", () => {
    const github = recordedGithub(() => ({ body: livePull(true) }));
    return github.provide(
      inMemory(
        Effect.gen(function* () {
          yield* TestClock.setTime(ms);
          const store = yield* claimedStore;
          yield* store.prepareDispatch(binding, 2);
          const result = yield* observeOwnerCheckpointMerge(store, binding, policy);
          expect(result._tag).toBe("Confirmed");
          if (result._tag === "Confirmed") expect(O.isNone(result.mergeCommit)).toBe(true);
          const persistedOption = yield* store.read(binding);
          const persisted = O.getOrThrow(persistedOption);
          expect(persisted.state._tag).toBe("Merged");
          if (persisted.state._tag === "Merged") expect(O.isNone(persisted.state.mergeCommit)).toBe(true);
          expect(A.filter(github.calls, (call) => call.method === "PUT")).toHaveLength(0);
        })
      )
    );
  });
  it("rejects unknown states and shortened native identities on decode", () => {
    expect(Result.isFailure(S.decodeResult(OwnerCheckpointBinding)({ ...binding, head: "abc" }))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(OwnerCheckpointState)({ _tag: "ReadyAnyway" }))).toBe(true);
    expect(OwnerCheckpointError.make({ reason: "uncertain" }).reason).toBe("uncertain");
  });
});
