import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { CheckRun } from "@beep/github/CheckRun";
import {
  dispatchOwnerCheckpointMerge,
  ExpectationRewriteVerdict,
  FinalCheckGate,
  FinalCheckReceipt,
  FinalCheckStepResult,
  MergeGateCheckRun,
  MergeGateRead,
  makeOwnerCheckpointPublisher,
  makeOwnerCheckpointStore,
  OwnerCheckpointBinding,
  OwnerCheckpointClassicStatus,
  OwnerCheckpointCommand,
  OwnerCheckpointError,
  OwnerCheckpointEvidence,
  OwnerCheckpointObserver,
  OwnerCheckpointPolicy,
  OwnerCheckpointReceiptRef,
  OwnerCheckpointRecord,
  OwnerCheckpointRequest,
  OwnerCheckpointSnapshot,
  OwnerCheckpointState,
  OwnerCheckpointStatusEvidence,
  observeOwnerCheckpointMerge,
  projectOwnerCheckpointClassicStatus,
  projectOwnerCheckpointSelfCheck,
  qualifyOwnerCheckpointEvidence,
  qualifyOwnerCheckpointSnapshot,
  RepoRunContext,
  readOwnerCheckpointEvidenceReceipts,
  readOwnerCheckpointSnapshot,
  SquashCommitlintPass,
  SquashCommitlintReport,
  SquashCommitMessage,
  transitionOwnerCheckpoint,
  YeetReviewWindowElapsed,
} from "@beep/repo-cli/test/Yeet";
import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import { Sha256Hex } from "@beep/schema";
import { NodeCrypto } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
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
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { recordedGithub } from "./support/YeetGithub.ts";
import type { GithubAnswer, GithubCall } from "./support/YeetGithub.ts";

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
    base: { repository: binding.repository, ref: "main", sha: merge },
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
  title: "feat: fixed fixture",
  mergeable_state: "clean",
  base: { ...pullFixture.base, repo: { full_name: binding.repository } },
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
    }).pipe(inMemory)
  );
  it.effect("rolls back owner state when outbox insertion fails", () =>
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
      assertNone(absentOutbox);
    }).pipe(inMemory)
  );
  it.effect("cannot claim an unpublished, wrong-run, or nonsuccessful release check", () =>
    Effect.gen(function* () {
      const store = yield* releasedStore;
      expect((yield* Effect.flip(store.apply(claim(), policy, now))).reason).toBe("publication");
      yield* store.acknowledgePublication(binding, 1, 3);
      expect((yield* Effect.flip(store.apply(claim(), policy, now))).reason).toBe("publication");
    }).pipe(inMemory)
  );
  it.effect("synchronization invalidates the old generation without deleting its intent", () =>
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
    }).pipe(inMemory)
  );
  it.effect("refuses synchronization and revocation while a merge is in flight", () =>
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
        (yield* Effect.flip(store.apply(request(3, OwnerCheckpointCommand.cases.Revoke.make({})), policy, now))).reason
      ).toBe("state");
    }).pipe(inMemory)
  );
  it.effect("public reads reject a different owner or generation at the same PR key", () =>
    Effect.gen(function* () {
      const store = yield* makeOwnerCheckpointStore();
      yield* store.register(binding);
      expect((yield* Effect.flip(store.read(OwnerCheckpointBinding.make({ ...binding, generation: 1 })))).reason).toBe(
        "binding"
      );
    }).pipe(inMemory)
  );
  it.effect("persists a dispatch fence across database reopen and refuses another dispatch", () =>
    Effect.gen(function* () {
      const services = yield* Layer.build(NodeFileSystem.layer);
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
  );
  it.effect("serializes the full expected SHA into exactly one native merge request", () => {
    const github = recordedGithub((call) =>
      call.method === "PUT" ? { body: { merged: true, sha: merge, message: "merged" } } : { body: livePull() }
    );
    return Effect.gen(function* () {
      yield* TestClock.setTime(ms);
      const store = yield* claimedStore;
      const result = yield* dispatchOwnerCheckpointMerge(store, binding, 2, snapshot(-10, true), policy);
      expect(result._tag).toBe("Confirmed");
      const found2 = yield* store.read(binding);
      expect(O.getOrThrow(found2).state._tag).toBe("Merged");
      const puts = A.filter(github.calls, (call) => call.method === "PUT");
      expect(puts).toHaveLength(1);
      expect(puts[0]?.body).toEqual({ sha: head, merge_method: "squash" });
    }).pipe(inMemory, github.provide);
  });
  it.effect("retains uncertain dispatch when result persistence fails and never retries merge", () => {
    const github = recordedGithub((call) =>
      call.method === "PUT" ? { unreachable: "PRIVATE_NATIVE_FAILURE" } : { body: livePull() }
    );
    return Effect.gen(function* () {
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
    }).pipe(inMemory, github.provide);
  });
  it.effect("recovers a confirmed same-PR/head merge by readback alone, retaining unknown commit SHA", () => {
    const github = recordedGithub(() => ({ body: livePull(true) }));
    return Effect.gen(function* () {
      yield* TestClock.setTime(ms);
      const store = yield* claimedStore;
      yield* store.prepareDispatch(binding, 2);
      const result = yield* observeOwnerCheckpointMerge(store, binding, policy);
      expect(result._tag).toBe("Confirmed");
      if (result._tag === "Confirmed") assertNone(result.mergeCommit);
      const persistedOption = yield* store.read(binding);
      const persisted = O.getOrThrow(persistedOption);
      expect(persisted.state._tag).toBe("Merged");
      if (persisted.state._tag === "Merged") assertNone(persisted.state.mergeCommit);
      expect(A.filter(github.calls, (call) => call.method === "PUT")).toHaveLength(0);
    }).pipe(inMemory, github.provide);
  });
  it("rejects unknown states and shortened native identities on decode", () => {
    S.decodeResult(OwnerCheckpointBinding)({ ...binding, head: "abc" }).pipe(Result.isFailure, assertTrue);
    S.decodeUnknownResult(OwnerCheckpointState)({ _tag: "ReadyAnyway" }).pipe(Result.isFailure, assertTrue);
    expect(OwnerCheckpointError.make({ reason: "uncertain" }).reason).toBe("uncertain");
  });
});

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "fixture",
  cwd: ".",
  head,
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: ".",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});
const nativeOwn = (externalId = "fixture-external") => ({
  id: 2,
  name: "Owner checkpoint",
  status: "in_progress",
  conclusion: O.getOrNull(O.none<string>()),
  head_sha: head,
  app: { id: policy.applicationId },
  external_id: externalId,
  html_url: "https://example.invalid/check/2",
});
const lintRun = {
  id: 1,
  name: "Lint",
  status: "completed",
  conclusion: "success",
  head_sha: head,
  app: { id: 7 },
  external_id: null,
};
const upstreamRoute = (call: GithubCall, own = nativeOwn()): GithubAnswer | undefined => {
  if (call.path === "{repo}/pulls/42") return { body: livePull() };
  if (call.path === "{repo}/git/ref/heads/main") return { body: { object: { type: "commit", sha: merge } } };
  if (call.path === `{repo}/commits/${head}/check-runs`)
    return { body: { total_count: 2, check_runs: [lintRun, own] } };
  if (Str.endsWith("/statuses")(call.path)) return { body: [] };
  if (Str.endsWith("/rules/branches/main")(call.path))
    return {
      body: [
        {
          type: "required_status_checks",
          parameters: { required_status_checks: [{ context: "Lint" }, { context: "Owner checkpoint" }] },
        },
      ],
    };
  if (call.path === "{repo}")
    return {
      body: {
        id: 1,
        name: "beep-effect",
        full_name: binding.repository,
        private: false,
        default_branch: "main",
        owner: { login: "beep-effect", id: 1 },
        squash_merge_commit_title: "PR_TITLE",
        squash_merge_commit_message: "PR_BODY",
      },
    };
  if (Str.endsWith("/commits")(call.path)) return { body: [{ commit: { message: "feat: fixed fixture" } }] };
  if (Str.startsWith("{repo}/compare/")(call.path))
    return { body: { merge_base_commit: { sha: merge }, base_commit: { sha: merge } } };
  if (call.path === `{repo}/commits/${merge}/check-runs`) return { body: { total_count: 1, check_runs: [lintRun] } };
  if (Str.endsWith("/timeline")(call.path))
    return { body: [{ event: "ready_for_review", created_at: "2026-11-05T00:00:00Z" }] };
  if (Str.endsWith("/check-suites")(call.path))
    return { body: { total_count: 1, check_suites: [{ created_at: "2026-11-05T00:00:00Z" }] } };
  if (call.path === "/graphql")
    return {
      body: {
        data: {
          repository: {
            pullRequest: {
              author: { login: "owner" },
              reviewThreads: { totalCount: 0, nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
            },
          },
        },
      },
    };
  return undefined;
};
const provideTestLayer =
  <Out, Error, In>(layer: Layer.Layer<Out, Error, In>) =>
  <Value, Failure, Requirements>(effect: Effect.Effect<Value, Failure, Requirements>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const services = yield* Layer.build(layer);
        return yield* Effect.provideContext(effect, services);
      })
    );
const offline = <Value, Error, Requirements>(effect: Effect.Effect<Value, Error, Requirements>) =>
  effect.pipe(
    provideSpawner(ScriptedSpawner.make(() => ({ stdout: "✔ found 0 problems, 0 warnings" }))),
    provideTestLayer(NodeCrypto.layer)
  );

describe("inert owner native adapter", () => {
  for (const fault of ["latest-app-pending", "latest-app-failed", "conflicting-app-rules"]) {
    it.effect(`refuses App-bound context ambiguity: ${fault}`, () => {
      const runs = [
        lintRun,
        {
          ...lintRun,
          id: 3,
          status: fault === "latest-app-pending" ? "in_progress" : "completed",
          conclusion: fault === "latest-app-pending" ? null : "failure",
        },
        { ...lintRun, id: 4, app: { id: 999 } },
        nativeOwn(),
      ];
      const github = recordedGithub((call) => {
        if (Str.endsWith("/rules/branches/main")(call.path))
          return {
            body: [
              {
                type: "required_status_checks",
                parameters: {
                  required_status_checks: [
                    { context: "Lint", integration_id: 7 },
                    { context: "Owner checkpoint" },
                    ...(fault === "conflicting-app-rules" ? [{ context: "Lint", integration_id: 999 }] : []),
                  ],
                },
              },
            ],
          };
        if (call.path === `{repo}/commits/${head}/check-runs`)
          return { body: { total_count: runs.length, check_runs: runs } };
        return upstreamRoute(call);
      });
      return Effect.gen(function* () {
        yield* TestClock.setTime(ms);
        const error = yield* Effect.flip(readOwnerCheckpointSnapshot(context, binding, 2, policy, "fixture-external"));
        expect(error.reason).toBe("gate");
      }).pipe(offline, github.provide);
    });
  }

  for (const app of [7, 999, null, "malformed", "wrong-owner"]) {
    it.effect(`binds upstream required checks to their native rule App: ${app}`, () => {
      const github = recordedGithub((call) => {
        if (app === "wrong-owner" && call.path === `{repo}/commits/${head}/check-runs`)
          return {
            body: {
              total_count: 3,
              check_runs: [
                lintRun,
                nativeOwn(),
                { ...nativeOwn(), id: 5, app: { id: 999 }, status: "completed", conclusion: "success" },
              ],
            },
          };
        if (Str.endsWith("/rules/branches/main")(call.path))
          return {
            body: [
              {
                type: "required_status_checks",
                parameters: {
                  required_status_checks: [
                    { context: "Lint", integration_id: app === "wrong-owner" ? 7 : app },
                    { context: "Owner checkpoint", integration_id: app === "wrong-owner" ? 999 : policy.applicationId },
                  ],
                },
              },
            ],
          };
        return upstreamRoute(call);
      });
      return Effect.gen(function* () {
        yield* TestClock.setTime(ms);
        const result = yield* readOwnerCheckpointSnapshot(context, binding, 2, policy, "fixture-external").pipe(
          Effect.result
        );
        expect(Result.isSuccess(result)).toBe(app === 7 || app === null);
        if (Result.isFailure(result)) expect(result.failure.reason).toBe(app === "malformed" ? "evidence" : "gate");
      }).pipe(offline, github.provide);
    });
  }

  for (const failedPage of [false, true]) {
    it.effect(`consumes native checks, statuses and review thread pages; second page failure=${failedPage}`, () => {
      const github = recordedGithub((call) => {
        const page2 = call.query.get("page") === "2";
        if (call.path === `{repo}/commits/${head}/check-runs`)
          return page2
            ? failedPage
              ? { status: 503 }
              : { body: { total_count: 2, check_runs: [nativeOwn()] } }
            : {
                body: { total_count: 2, check_runs: [lintRun] },
                headers: {
                  link: ` <https://api.github.com/repos/beep-effect/beep-effect/commits/${head}/check-runs?page=2>; rel="next"`,
                },
              };
        if (Str.endsWith("/statuses")(call.path))
          return page2
            ? { body: [] }
            : {
                body: [
                  {
                    id: 8,
                    context: "classic",
                    state: "success",
                    creator: { login: "vendor" },
                    description: null,
                    target_url: null,
                    updated_at: DateTime.formatIso(at(-1)),
                  },
                ],
                headers: {
                  link: `<https://api.github.com/repos/beep-effect/beep-effect/commits/${head}/statuses?page=2>; rel="next"`,
                },
              };
        if (call.path === "/graphql") {
          const body = Result.getOrThrow(
            S.decodeUnknownResult(S.Struct({ variables: S.Struct({ after: S.String.pipe(S.NullOr, S.optionalKey) }) }))(
              call.body
            )
          );
          const last = body.variables.after === "page-2";
          return {
            body: {
              data: {
                repository: {
                  pullRequest: {
                    author: { login: "owner" },
                    reviewThreads: {
                      totalCount: 0,
                      nodes: [],
                      pageInfo: { hasNextPage: !last, endCursor: last ? null : "page-2" },
                    },
                  },
                },
              },
            },
          };
        }
        return upstreamRoute(call);
      });
      return Effect.gen(function* () {
        yield* TestClock.setTime(ms);
        const result = yield* readOwnerCheckpointSnapshot(context, binding, 2, policy, "fixture-external").pipe(
          Effect.result
        );
        expect(Result.isSuccess(result)).toBe(!failedPage);
        expect(A.some(github.calls, (call) => call.query.get("page") === "2")).toBe(true);
        if (!failedPage) {
          expect(A.filter(github.calls, (call) => Str.endsWith("/statuses")(call.path))).toHaveLength(2);
          expect(A.filter(github.calls, (call) => call.path === "/graphql")).toHaveLength(2);
        }
      }).pipe(offline, github.provide);
    });
  }

  it.effect("reads native App identity and actual base ref independently of stale PR base.sha", () => {
    const github = recordedGithub(upstreamRoute);
    return Effect.gen(function* () {
      yield* TestClock.setTime(ms);
      const result = yield* readOwnerCheckpointSnapshot(context, binding, 2, policy, "fixture-external");
      expect(result.base.sha).toBe(merge);
      expect(result.base.sha).not.toBe(pullFixture.base.sha);
      expect(result.selfCheck.applicationId).toBe(123);
      expect(A.filter(github.calls, (call) => call.path === "{repo}/git/ref/heads/main")).toHaveLength(2);
    }).pipe(offline, github.provide);
  });
  for (const move of [
    "head",
    "base",
    "base-repository",
    "closed",
    "wrong-app",
    "wrong-external",
    "malformed",
    "threads-failed",
    "status-only",
  ]) {
    it.effect(`refuses ${move} without treating unread evidence as success`, () => {
      let refs = 0;
      let pulls = 0;
      const github = recordedGithub((call) => {
        if (call.path === "{repo}/pulls/42") {
          pulls++;
          if (pulls > 2 && move === "head")
            return { body: { ...livePull(), head: { ...livePull().head, sha: merge } } };
          if (pulls > 2 && move === "closed") return { body: livePull(true) };
          if (move === "base-repository")
            return { body: { ...livePull(), base: { ref: "main", repo: { full_name: "other/repo" } } } };
        }
        if (call.path === "{repo}/git/ref/heads/main" && move === "base")
          return { body: { object: { type: "commit", sha: refs++ === 0 ? merge : head } } };
        if (call.path === `/graphql` && move === "threads-failed") return { status: 503 };
        if (Str.endsWith("/rules/branches/main")(call.path) && move === "status-only")
          return {
            body: [
              { type: "required_status_checks", parameters: { required_status_checks: [{ context: "classic-only" }] } },
            ],
          };
        if (Str.endsWith("/statuses")(call.path) && move === "status-only")
          return {
            body: [
              {
                id: 12,
                context: "classic-only",
                state: "success",
                creator: { login: "vendor" },
                description: null,
                target_url: null,
                updated_at: DateTime.formatIso(at(-1)),
              },
            ],
          };
        if (call.path === `{repo}/commits/${head}/check-runs`) {
          const own =
            move === "wrong-app"
              ? { ...nativeOwn(), app: { id: 999 }, applicationId: 123 }
              : move === "wrong-external"
                ? nativeOwn("wrong-pr")
                : move === "malformed"
                  ? { ...nativeOwn(), app: null }
                  : nativeOwn();
          return { body: { total_count: 2, check_runs: [lintRun, own] } };
        }
        return upstreamRoute(call);
      });
      return Effect.gen(function* () {
        yield* TestClock.setTime(ms);
        const error = yield* Effect.flip(readOwnerCheckpointSnapshot(context, binding, 2, policy, "fixture-external"));
        expect(OwnerCheckpointError.make({ reason: error.reason }).reason).toBe(error.reason);
      }).pipe(offline, github.provide);
    });
  }
});

describe("inert owner publication fence", () => {
  for (const fault of ["lost-response", "failed-remember", "duplicates", "zero", "wrong-identity"]) {
    it.effect(`reconciles ${fault} without a second create`, () => {
      let own = nativeOwn();
      let created = false;
      const github = recordedGithub((call) => {
        if (call.method === "POST" && call.path === "{repo}/check-runs") {
          created = true;
          const body = S.decodeUnknownResult(S.Struct({ external_id: S.String }))(call.body);
          own = nativeOwn(Result.getOrThrow(body).external_id);
          return fault === "lost-response" || fault === "zero" || fault === "duplicates"
            ? { unreachable: "PRIVATE_LOST_RESPONSE" }
            : { body: own };
        }
        if (call.path === "{repo}/check-runs/2")
          return { body: fault === "wrong-identity" ? { ...own, id: 999 } : own };
        if (Str.endsWith("/check-runs")(call.path))
          return {
            body: {
              total_count: fault === "duplicates" ? 2 : fault === "zero" ? 0 : 1,
              check_runs: !created || fault === "zero" ? [] : fault === "duplicates" ? [own, { ...own, id: 3 }] : [own],
            },
          };
        return upstreamRoute(call, own);
      });
      return Effect.gen(function* () {
        const publisher = yield* makeOwnerCheckpointPublisher(context, policy);
        yield* publisher.owner.register(binding);
        const sql = yield* SqlClient.SqlClient;
        if (fault === "failed-remember")
          yield* sql`CREATE TRIGGER refuse_anchor BEFORE INSERT ON yeet_owner_checkpoint_anchor BEGIN SELECT RAISE(ABORT, 'PRIVATE_DB_FAILURE'); END`;
        const first = yield* publisher.publish(binding, 0);
        if (fault === "failed-remember") yield* sql`DROP TRIGGER refuse_anchor`;
        const second = yield* publisher.publish(binding, 0);
        expect(
          A.filter(github.calls, (call) => call.method === "POST" && call.path === "{repo}/check-runs")
        ).toHaveLength(1);
        expect(second._tag).toBe(
          fault === "duplicates" || fault === "wrong-identity" ? "Held" : fault === "zero" ? "Unknown" : "Published"
        );
        const output = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))([first, second]);
        expect(output).not.toContain("PRIVATE_");
        expect(output).not.toContain(binding.owner);
      }).pipe(inMemory, provideTestLayer(CheckRun.layer), offline, github.provide);
    });
  }
  it.effect("updates one native identity across release and revoke and rejects stale revisions", () => {
    let own = nativeOwn();
    const github = recordedGithub((call) => {
      if (call.method === "POST" && call.path === "{repo}/check-runs") {
        const data = Result.getOrThrow(S.decodeUnknownResult(S.Struct({ external_id: S.String }))(call.body));
        own = nativeOwn(data.external_id);
        return { body: own };
      }
      if (call.method === "PATCH") {
        const data = Result.getOrThrow(
          S.decodeUnknownResult(S.Struct({ external_id: S.String, conclusion: S.String }))(call.body)
        );
        own = { ...own, external_id: data.external_id, status: "completed", conclusion: data.conclusion };
        return { body: own };
      }
      if (call.path === "{repo}/check-runs/2") return { body: own };
      return upstreamRoute(call, own);
    });
    return Effect.gen(function* () {
      yield* TestClock.setTime(ms);
      const publisher = yield* makeOwnerCheckpointPublisher(context, policy);
      yield* publisher.owner.register(binding);
      expect((yield* publisher.publish(binding, 0))._tag).toBe("Published");
      yield* publisher.owner.apply(release(), policy, now);
      expect((yield* publisher.publish(binding, 1))._tag).toBe("Published");
      const outbox = yield* publisher.owner.outbox(binding, 1);
      expect(O.getOrThrow(outbox).delivery).toEqual({ _tag: "Published", checkRunId: 2 });
      own = { ...own, conclusion: "failure" };
      const nonsuccess = yield* publisher.publish(binding, 1);
      expect(nonsuccess).toEqual({ _tag: "Held", reason: "native-status" });
      own = { ...own, conclusion: "success" };
      yield* publisher.owner.apply(request(1, OwnerCheckpointCommand.cases.Revoke.make({})), policy, now);
      expect((yield* publisher.publish(binding, 2))._tag).toBe("Published");
      expect((yield* Effect.flip(publisher.publish(binding, 1))).reason).toBe("conflict");
      expect(
        A.filter(github.calls, (call) => call.method === "POST" && call.path === "{repo}/check-runs")
      ).toHaveLength(1);
      expect(
        A.map(
          A.filter(github.calls, (call) => call.method === "PATCH"),
          (call) => call.path
        )
      ).toEqual(["{repo}/check-runs/2", "{repo}/check-runs/2"]);
      expect(own.conclusion).toBe("failure");
    }).pipe(inMemory, provideTestLayer(CheckRun.layer), offline, github.provide);
  });
});

describe("authority receipt root", () => {
  for (const fault of [
    "none",
    "hash",
    "symlink",
    "permissions",
    "unfinished",
    "stopped-monitor",
    "post-finalization",
    "wrong-binding",
    "wrong-checkout",
    "missing-family",
    "base-moved",
  ]) {
    it.effect(`hashes bounded receipt bytes before decoding: ${fault}`, () =>
      Effect.scoped(
        Effect.gen(function* () {
          yield* TestClock.setTime(ms);
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "checkpoint-receipts-" });
          yield* fs.chmod(root, 0o700);
          const write = Effect.fnUntraced(function* (value: unknown) {
            const text = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(value);
            const hash = yield* sha256Hex(text);
            const sha256 = Sha256Hex.make(hash);
            const ref = OwnerCheckpointReceiptRef.make({ name: `${sha256}.json`, sha256 });
            yield* fs.writeFileString(`${root}/${ref.name}`, text);
            yield* fs.chmod(`${root}/${ref.name}`, 0o600);
            return ref;
          });
          const rawObserver = yield* S.encodeEffect(S.toCodecJson(OwnerCheckpointObserver))(evidence.observer);
          const encodedObserver = yield* S.decodeUnknownEffect(S.Record(S.String, S.Unknown))(rawObserver);
          const observer = yield* write({
            ...encodedObserver,
            ...(fault === "unfinished" ? { phase: "running" } : {}),
            ...(fault === "stopped-monitor" ? { mode: "publisher-submitted", outcome: "stopped" } : {}),
          });
          const encodedClassic = yield* S.encodeEffect(S.toCodecJson(OwnerCheckpointSnapshot))(
            fault === "base-moved"
              ? OwnerCheckpointSnapshot.make({ ...evidence.classic, base: { ...evidence.classic.base, sha: head } })
              : evidence.classic
          );
          const classic = yield* write(encodedClassic);
          const encodedFinal = yield* S.encodeEffect(S.toCodecJson(FinalCheckReceipt))(
            FinalCheckReceipt.make({
              ...finalCheck,
              ...(fault === "post-finalization" ? { finishedAt: DateTime.formatIso(now) } : {}),
              ...(fault === "missing-family" ? { steps: [] } : {}),
            })
          );
          const final = yield* write(encodedFinal);
          const manifest = yield* write({
            version: "owner-checkpoint-receipts/v1",
            checkout: fault === "wrong-checkout" ? releaseId : digest,
            binding: fault === "wrong-binding" ? { ...binding, prNumber: 999 } : binding,
            observer,
            classic,
            finalCheck: final,
          });
          if (fault === "hash") yield* fs.writeFileString(`${root}/${observer.name}`, "{}");
          if (fault === "permissions") yield* fs.chmod(`${root}/${observer.name}`, 0o644);
          if (fault === "symlink") {
            yield* fs.rename(`${root}/${observer.name}`, `${root}/original.json`);
            yield* fs.symlink(`${root}/original.json`, `${root}/${observer.name}`);
          }
          const result = yield* readOwnerCheckpointEvidenceReceipts(root, binding, manifest, policy, digest).pipe(
            Effect.result
          );
          expect(Result.isSuccess(result)).toBe(fault === "none");
          if (Result.isFailure(result))
            expect(result.failure.reason).toBe(fault === "base-moved" ? "binding" : "evidence");
        })
      ).pipe(provideTestLayer(NodeServices.layer), offline)
    );
  }
});

describe("publication crash and revision serialization", () => {
  it.effect("retains an ambiguous create fence after reopen and refuses a later revision overtaking it", () => {
    const github = recordedGithub((call) =>
      call.method === "POST" ? { unreachable: "PRIVATE_LOST_RESPONSE" } : { body: { total_count: 0, check_runs: [] } }
    );
    return Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "publication-fence-" });
        const filename = `${directory}/owner.sqlite`;
        yield* withDb(
          filename,
          Effect.gen(function* () {
            const publisher = yield* makeOwnerCheckpointPublisher(context, policy);
            yield* publisher.owner.register(binding);
            expect((yield* publisher.publish(binding, 0))._tag).toBe("Unknown");
          }).pipe(provideTestLayer(CheckRun.layer))
        );
        yield* withDb(
          filename,
          Effect.gen(function* () {
            const publisher = yield* makeOwnerCheckpointPublisher(context, policy);
            expect((yield* publisher.publish(binding, 0))._tag).toBe("Unknown");
            yield* publisher.owner.apply(request(0, OwnerCheckpointCommand.cases.Revoke.make({})), policy, now);
            expect((yield* Effect.flip(publisher.publish(binding, 1))).reason).toBe("uncertain");
          }).pipe(provideTestLayer(CheckRun.layer))
        );
        expect(A.filter(github.calls, (call) => call.method === "POST")).toHaveLength(1);
      })
    ).pipe(provideTestLayer(NodeServices.layer), offline, github.provide);
  });
});

describe("owner checkpoint refusal and recovery boundaries", () => {
  it.effect("sanitizes malformed native check and classic status projections", () =>
    Effect.gen(function* () {
      expect((yield* Effect.flip(projectOwnerCheckpointSelfCheck({ id: 2, app: {} }))).reason).toBe("evidence");
      expect((yield* Effect.flip(projectOwnerCheckpointClassicStatus({ state: "success" }))).reason).toBe("evidence");
    })
  );
  it.effect("uses the newest classic status regardless of input order", () =>
    Effect.gen(function* () {
      const status = (id: number, state: "success" | "failure") =>
        OwnerCheckpointClassicStatus.make({
          id,
          context: "external-quality",
          state,
          updatedAt: at(-15),
          diagnostic: OwnerCheckpointStatusEvidence.cases.Ordinary.make({}),
        });
      yield* qualifyOwnerCheckpointSnapshot(
        binding,
        OwnerCheckpointSnapshot.make({
          ...snapshot(),
          statuses: [status(2, "success"), status(1, "failure"), status(2, "failure")],
        }),
        policy,
        now
      );
      const future = yield* Effect.flip(qualifyOwnerCheckpointSnapshot(binding, snapshot(1), policy, now));
      expect(future.reason).toBe("freshness");
    })
  );
  it.effect("rejects invalid command states, identity revisions and exhausted counters", () =>
    Effect.gen(function* () {
      const held = OwnerCheckpointRecord.make({
        binding,
        revision: 0,
        state: OwnerCheckpointState.cases.Held.make({ reason: "registered" }),
      });
      const released = OwnerCheckpointRecord.make({
        ...held,
        state: OwnerCheckpointState.cases.Released.make({
          releaseId,
          evidenceDigest: digest,
          base: { repository: binding.repository, ref: "main", sha: merge },
        }),
      });
      const claimed = OwnerCheckpointRecord.make({
        ...held,
        state: OwnerCheckpointState.cases.Claimed.make({ releaseId, claimId }),
      });
      const changedClaim = Sha256Hex.make(Str.repeat(64)("f"));
      const cases = [
        { current: held, command: OwnerCheckpointCommand.cases.Claim.make({ claimId, snapshot: snapshot() }) },
        { current: released, command: OwnerCheckpointCommand.cases.Release.make({ releaseId, evidence }) },
        { current: held, command: OwnerCheckpointCommand.cases.Unknown.make({ claimId }) },
        { current: claimed, command: OwnerCheckpointCommand.cases.Unknown.make({ claimId: changedClaim }) },
        { current: held, command: OwnerCheckpointCommand.cases.Confirm.make({ claimId, mergeCommit: O.none() }) },
        {
          current: claimed,
          command: OwnerCheckpointCommand.cases.Confirm.make({ claimId: changedClaim, mergeCommit: O.none() }),
        },
        { current: held, command: OwnerCheckpointCommand.cases.Synchronize.make({ head }) },
        {
          current: OwnerCheckpointRecord.make({
            ...held,
            binding: OwnerCheckpointBinding.make({ ...binding, generation: Number.MAX_SAFE_INTEGER - 1 }),
          }),
          command: OwnerCheckpointCommand.cases.Synchronize.make({ head: merge }),
        },
      ];
      yield* Effect.forEach(
        cases,
        Effect.fnUntraced(function* (row) {
          expect(
            (yield* Effect.flip(
              transitionOwnerCheckpoint(row.current, request(0, row.command, row.current.binding), policy, now)
            )).reason
          ).toBe("state");
        }),
        { concurrency: 1, discard: true }
      );
      const revoke = OwnerCheckpointCommand.cases.Revoke.make({});
      expect(
        (yield* Effect.flip(
          transitionOwnerCheckpoint(
            held,
            request(0, revoke, OwnerCheckpointBinding.make({ ...binding, owner: changedClaim })),
            policy,
            now
          )
        )).reason
      ).toBe("binding");
      const exhausted = OwnerCheckpointRecord.make({ ...held, revision: Number.MAX_SAFE_INTEGER - 1 });
      expect(
        (yield* Effect.flip(transitionOwnerCheckpoint(exhausted, request(exhausted.revision, revoke), policy, now)))
          .reason
      ).toBe("conflict");
      const revoked = yield* transitionOwnerCheckpoint(released, request(0, revoke), policy, now);
      expect(revoked.record.state).toEqual({ _tag: "Held", reason: "revoked" });
      expect(revoked.outbox.intent._tag).toBe("CheckHeld");
    })
  );
  it.effect("refuses missing owners, duplicate registration and invalid publication or dispatch identities", () =>
    inMemory(
      Effect.gen(function* () {
        const store = yield* makeOwnerCheckpointStore();
        const missingOwner = yield* store.read(binding);
        assertNone(missingOwner);
        expect((yield* Effect.flip(store.apply(release(), policy, now))).reason).toBe("missing");
        expect(
          (yield* Effect.flip(store.register(OwnerCheckpointBinding.make({ ...binding, generation: 1 })))).reason
        ).toBe("binding");
        yield* store.register(binding);
        expect((yield* Effect.flip(store.register(binding))).reason).toBe("conflict");
        yield* Effect.forEach(
          [-1, 0.5, Number.NaN],
          Effect.fnUntraced(function* (revision) {
            expect((yield* Effect.flip(store.prepareDispatch(binding, revision))).reason).toBe("conflict");
            expect((yield* Effect.flip(store.acknowledgePublication(binding, revision, 2))).reason).toBe("publication");
          }),
          { concurrency: 1, discard: true }
        );
        expect((yield* Effect.flip(store.acknowledgePublication(binding, 0, 0))).reason).toBe("publication");
        expect((yield* Effect.flip(store.acknowledgePublication(binding, 0, 2))).reason).toBe("conflict");
        expect((yield* Effect.flip(store.prepareDispatch(binding, 0))).reason).toBe("conflict");
        expect((yield* Effect.flip(store.prepareDispatch(binding, 1))).reason).toBe("conflict");
        yield* store.apply(release(), policy, now);
        yield* store.acknowledgePublication(binding, 1, 2);
        expect((yield* Effect.flip(store.acknowledgePublication(binding, 1, 2))).reason).toBe("conflict");
        expect(
          (yield* Effect.flip(
            store.apply(
              request(1, OwnerCheckpointCommand.cases.Claim.make({ claimId, snapshot: snapshot() })),
              policy,
              now
            )
          )).reason
        ).toBe("publication");
      })
    )
  );
});

describe("owner merge native outcomes", () => {
  it.effect("rejects another repository before reading or dispatching GitHub", () => {
    const github = recordedGithub(() => ({ body: livePull() }));
    return github.provide(
      inMemory(
        Effect.gen(function* () {
          const store = yield* claimedStore;
          const foreign = OwnerCheckpointBinding.make({ ...binding, repository: "other/repository" });
          expect(
            (yield* Effect.flip(dispatchOwnerCheckpointMerge(store, foreign, 2, snapshot(-10, true), policy))).reason
          ).toBe("binding");
          expect(github.calls).toHaveLength(0);
        })
      )
    );
  });
  it.effect("sanitizes a failed prerequisite read without dispatching", () => {
    const github = recordedGithub(() => ({ status: 403, body: { message: "PRIVATE_READ_FAILURE" } }));
    return github.provide(
      inMemory(
        Effect.gen(function* () {
          yield* TestClock.setTime(ms);
          const store = yield* claimedStore;
          expect(
            (yield* Effect.flip(dispatchOwnerCheckpointMerge(store, binding, 2, snapshot(-10, true), policy))).reason
          ).toBe("evidence");
          expect(A.filter(github.calls, (call) => call.method === "PUT")).toHaveLength(0);
        })
      )
    );
  });
  for (const mismatch of ["number", "head", "closed", "merged", "draft"]) {
    it.effect(`refuses a live PR with mismatched ${mismatch} before fencing`, () => {
      const pull = livePull();
      const github = recordedGithub(() => ({
        body: {
          ...pull,
          number: mismatch === "number" ? 43 : pull.number,
          head: mismatch === "head" ? { ...pull.head, sha: merge } : pull.head,
          state: mismatch === "closed" ? "closed" : pull.state,
          merged: mismatch === "merged",
          draft: mismatch === "draft",
        },
      }));
      return github.provide(
        inMemory(
          Effect.gen(function* () {
            yield* TestClock.setTime(ms);
            const store = yield* claimedStore;
            expect(
              (yield* Effect.flip(dispatchOwnerCheckpointMerge(store, binding, 2, snapshot(-10, true), policy))).reason
            ).toBe("binding");
            const pendingIntent = yield* store.outbox(binding, 2);
            const entry = O.getOrThrow(pendingIntent);
            expect(entry.delivery._tag).toBe("Pending");
            expect(A.filter(github.calls, (call) => call.method === "PUT")).toHaveLength(0);
          })
        )
      );
    });
  }
  for (const result of [
    { merged: false, sha: merge, message: "rejected" },
    { merged: true, sha: "short", message: "incomplete identity" },
  ]) {
    it.effect(`retains a durable uncertain intent after ${result.message}`, () => {
      const github = recordedGithub((call) => (call.method === "PUT" ? { body: result } : { body: livePull() }));
      return github.provide(
        inMemory(
          Effect.gen(function* () {
            yield* TestClock.setTime(ms);
            const store = yield* claimedStore;
            const outcome = yield* dispatchOwnerCheckpointMerge(store, binding, 2, snapshot(-10, true), policy);
            expect(outcome).toEqual({ _tag: "Uncertain", recording: "recorded" });
            const uncertainOwner = yield* store.read(binding);
            expect(O.getOrThrow(uncertainOwner).state._tag).toBe("Uncertain");
            const uncertainIntent = yield* store.outbox(binding, 2);
            expect(O.getOrThrow(uncertainIntent).delivery._tag).toBe("Uncertain");
            expect(A.filter(github.calls, (call) => call.method === "PUT")).toHaveLength(1);
          })
        )
      );
    });
  }
  it.effect("retains a confirmed native result when its recording transaction fails", () => {
    const github = recordedGithub((call) =>
      call.method === "PUT" ? { body: { merged: true, sha: merge, message: "merged" } } : { body: livePull() }
    );
    return github.provide(
      inMemory(
        Effect.gen(function* () {
          yield* TestClock.setTime(ms);
          const store = yield* claimedStore;
          const sql = yield* SqlClient.SqlClient;
          yield* sql`CREATE TRIGGER refuse_confirmation BEFORE UPDATE ON yeet_owner_checkpoint WHEN NEW.revision = 3 BEGIN SELECT RAISE(ABORT, 'FIXTURE'); END`;
          const result = yield* dispatchOwnerCheckpointMerge(store, binding, 2, snapshot(-10, true), policy);
          deepStrictEqual(result, { _tag: "Confirmed", recording: "pending", mergeCommit: O.some(merge) });
          const dispatchedIntent = yield* store.outbox(binding, 2);
          expect(O.getOrThrow(dispatchedIntent).delivery._tag).toBe("Dispatched");
        })
      )
    );
  });
  it.effect("refuses recovery without a merge claim", () => {
    const github = recordedGithub(() => ({ body: livePull(true) }));
    return github.provide(
      inMemory(
        Effect.gen(function* () {
          const store = yield* makeOwnerCheckpointStore();
          expect((yield* Effect.flip(observeOwnerCheckpointMerge(store, binding, policy))).reason).toBe("state");
          yield* store.register(binding);
          expect((yield* Effect.flip(observeOwnerCheckpointMerge(store, binding, policy))).reason).toBe("state");
          expect(github.calls).toHaveLength(0);
        })
      )
    );
  });
  it.effect("preserves pending versus recorded uncertainty during readback without redispatch", () => {
    const github = recordedGithub(() => ({ body: livePull() }));
    return github.provide(
      inMemory(
        Effect.gen(function* () {
          yield* TestClock.setTime(ms);
          const store = yield* claimedStore;
          const pendingReadback = yield* observeOwnerCheckpointMerge(store, binding, policy);
          expect(pendingReadback).toEqual({
            _tag: "Uncertain",
            recording: "pending",
          });
          yield* store.apply(request(2, OwnerCheckpointCommand.cases.Unknown.make({ claimId })), policy, now);
          const recordedReadback = yield* observeOwnerCheckpointMerge(store, binding, policy);
          expect(recordedReadback).toEqual({
            _tag: "Uncertain",
            recording: "recorded",
          });
          const sql = yield* SqlClient.SqlClient;
          yield* sql`CREATE TRIGGER refuse_recovery BEFORE UPDATE ON yeet_owner_checkpoint WHEN NEW.revision = 4 BEGIN SELECT RAISE(ABORT, 'FIXTURE'); END`;
          const mergedGithub = recordedGithub(() => ({ body: livePull(true) }));
          const recovered = yield* observeOwnerCheckpointMerge(store, binding, policy).pipe(mergedGithub.provide);
          deepStrictEqual(recovered, { _tag: "Confirmed", recording: "pending", mergeCommit: O.none() });
          expect(A.filter([...github.calls, ...mergedGithub.calls], (call) => call.method === "PUT")).toHaveLength(0);
        })
      )
    );
  });
});

it.effect("rejects failed, unexplained skipped, and unrelated rewritten prerequisite receipts", () =>
  Effect.gen(function* () {
    const first = O.getOrThrow(A.head(finalCheck.steps));
    const receipts = [
      FinalCheckReceipt.make({ ...finalCheck, headSha: merge }),
      FinalCheckReceipt.make({
        ...finalCheck,
        steps: A.map(finalCheck.steps, (step) =>
          step.gate === first.gate ? FinalCheckStepResult.make({ ...step, status: "failed" }) : step
        ),
      }),
      FinalCheckReceipt.make({
        ...finalCheck,
        steps: A.map(finalCheck.steps, (step) =>
          step.gate === first.gate ? FinalCheckStepResult.make({ ...step, status: "skipped" }) : step
        ),
      }),
      FinalCheckReceipt.make({
        ...finalCheck,
        steps: A.map(finalCheck.steps, (step) =>
          step.gate === first.gate ? FinalCheckStepResult.make({ ...step, status: "skipped", reason: "  " }) : step
        ),
      }),
      FinalCheckReceipt.make({
        ...finalCheck,
        expectationRewrites: [
          ExpectationRewriteVerdict.make({
            testFile: "fixture.test.ts",
            classification: "unverified",
            rewrites: 1,
            detail: "base proof unavailable",
          }),
        ],
      }),
      FinalCheckReceipt.make({ ...finalCheck, startedAt: "invalid timestamp" }),
      FinalCheckReceipt.make({ ...finalCheck, finishedAt: "invalid timestamp" }),
    ];
    yield* Effect.forEach(
      receipts,
      Effect.fnUntraced(function* (receipt) {
        const error = yield* Effect.flip(
          qualifyOwnerCheckpointEvidence(
            binding,
            OwnerCheckpointEvidence.make({ ...evidence, finalCheck: receipt }),
            policy,
            now
          )
        );
        expect(error.reason).toBe("evidence");
      }),
      { concurrency: 1, discard: true }
    );
    const explained = FinalCheckReceipt.make({
      ...finalCheck,
      steps: A.map(finalCheck.steps, (step) =>
        step.gate === first.gate
          ? FinalCheckStepResult.make({ ...step, status: "skipped", reason: "hosted proof owns this gate" })
          : step
      ),
      expectationRewrites: [
        ExpectationRewriteVerdict.make({
          testFile: "fixture.test.ts",
          classification: "follows-diff",
          rewrites: 1,
          detail: "base passed",
        }),
      ],
    });
    yield* qualifyOwnerCheckpointEvidence(
      binding,
      OwnerCheckpointEvidence.make({ ...evidence, finalCheck: explained }),
      policy,
      now
    );
  })
);

it.effect("rejects a foreign outbox binding and rolls back both failed compare-and-swap writes", () =>
  inMemory(
    Effect.gen(function* () {
      const store = yield* releasedStore;
      const foreign = OwnerCheckpointBinding.make({ ...binding, generation: 1 });
      const error = yield* Effect.flip(store.outbox(foreign, 1));
      expect(error.reason).toBe("binding");
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TRIGGER ignore_delivery BEFORE UPDATE ON yeet_owner_checkpoint_outbox BEGIN SELECT RAISE(IGNORE); END`;
      const deliveryFailure = yield* Effect.flip(store.acknowledgePublication(binding, 1, 2));
      expect(deliveryFailure.reason).toBe("conflict");
      const pending = yield* store.outbox(binding, 1);
      expect(O.getOrThrow(pending).delivery._tag).toBe("Pending");
      yield* sql`DROP TRIGGER ignore_delivery`;
      yield* sql`CREATE TRIGGER ignore_record BEFORE UPDATE ON yeet_owner_checkpoint BEGIN SELECT RAISE(IGNORE); END`;
      const transitionFailure = yield* Effect.flip(
        store.apply(request(1, OwnerCheckpointCommand.cases.Revoke.make({})), policy, now)
      );
      expect(transitionFailure.reason).toBe("conflict");
      const current = yield* store.read(binding);
      expect(O.getOrThrow(current).state._tag).toBe("Released");
      const nextIntent = yield* store.outbox(binding, 2);
      assertNone(nextIntent);
    })
  )
);

it.effect("fails closed when the explicitly owned database scope has been released", () =>
  Effect.gen(function* () {
    const store = yield* inMemory(claimedStore);
    const operations: ReadonlyArray<Effect.Effect<void, OwnerCheckpointError>> = [
      store.register(binding).pipe(Effect.asVoid),
      store.apply(request(2, OwnerCheckpointCommand.cases.Unknown.make({ claimId })), policy, now).pipe(Effect.asVoid),
      store.acknowledgePublication(binding, 2, 2).pipe(Effect.asVoid),
      store.prepareDispatch(binding, 2).pipe(Effect.asVoid),
    ];
    yield* Effect.forEach(
      operations,
      Effect.fnUntraced(function* (operation) {
        const error = yield* Effect.flip(operation);
        expect(error).toMatchObject({ _tag: "OwnerCheckpointError", reason: "storage" });
        expect("cause" in error).toBe(false);
      }),
      { concurrency: 1, discard: true }
    );
  })
);
