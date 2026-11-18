import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimReviewEvent, type ClaimReviewState, proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import * as A from "@beep/utils/Array";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Str from "@beep/utils/Str";
import {
  blockedByLock,
  clients,
  containersOf,
  docker,
  endBlocked,
  eventually,
  fresh,
  get,
  holdLock,
  human,
  issue,
  killRunners,
  killRunnersThen,
  lockHeld,
  psql,
  releaseLock,
  revoke,
  runnerService,
  runState,
  services,
} from "./Stack.ts";
import { FROZEN_WRITE_BOUND_MS, RECOVERY_BOUND_MS, REFUSED_WRITE_BOUND_MS } from "./RecoveryBound.ts";
import {
  holderNameOf,
  lockSessions,
  runnerHealth,
  runnerLogging,
  runnerNames,
  shardOf,
  slotEntity,
} from "./ShardOwnership.ts";
import { thunkFalse, thunkTrue } from "@beep/utils"

// The prototype's own conformance cases (phase 5, D5, D16), against the deployed stack over its
// Apis. Each case records its evidence with console.log; a failure is a finding, not a retry.
/** The latest proposal in a review a client read, if it has one. */
const proposalIn = (state: ClaimReviewState | null | undefined) => O.flatMap(O.fromNullishOr(state), proposalOf);

/** Where the evidence goes (`EVIDENCE_FILE`): one timestamped JSON line per record. */
const evidenceFile = Config.String("EVIDENCE_FILE").pipe(Config.withDefault("/dev/null"));
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const log = Effect.fn("log")(function* (label: string, value: unknown) {
  const fs = yield* FileSystem.FileSystem;
  const file = yield* evidenceFile;
  const now = yield* DateTime.now;
  const json = yield* encodeJson(value);
  yield* fs.writeFileString(file, `${DateTime.formatIso(now)} ${label}: ${json}\n`, { flag: "a" });
}, Effect.orDie);

/** A fresh org with intake (and propose) for p_intake, review and read for p_rev. */
const setup = Effect.gen(function* () {
  const r = yield* fresh("r");
  const org = `org_${r}`;
  const grants = yield* Effect.all([
    issue(`g_intake_${r}`, "p_intake", "party.intake", org),
    issue(`g_propose_${r}`, "p_intake", "party.propose", org),
    issue(`g_review_${r}`, "p_rev", "party.review", org),
    issue(`g_read_${r}`, "p_rev", "party.read", org),
  ], { concurrency: 1 });
  expect(A.every(grants, (g) => g.ok)).toBe(true);
  // The boundary reads grants from the authority model's views; give them a moment.
  yield* Effect.sleep("2 seconds");
  return { r, org: OrgId.make(org) };
});

const assertion = (org: OrgId) => ({
  org,
  proposition: Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "dana@acme.test" }),
  signals: [
    EvidenceSignal.make({ source: "mailbox:intake", quote: "From: Dana <dana@acme.test>" }),
    EvidenceSignal.make({ source: "crm", quote: "dana@acme.test on file" }),
  ],
});

const asserted = Effect.fn("asserted")(function* (claim: ClaimId, receipt: { readonly stream: string; readonly version: number }) {
  const { reviewer } = yield* clients;
  const page = yield* reviewer.ClaimReview.list(claim, { ...human("p_rev"), atLeast: receipt, take: 100 });
  return A.filter(page.entries, (entry) => ClaimReviewEvent.isAnyOf(["ClaimAsserted"])(entry.event)).length;
});

/** A case against the deployed stack, with the stack's clients built into the case's scope. */
const live = <E>(name: string, body: Effect.Effect<void, E, Layer.Success<typeof services> | Scope.Scope>) =>
  it.live(name, () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(body, context)), 600_000);

live("a command sent twice under one id commits once, and its reaction happens once", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake } = yield* clients;
  const claim = ClaimId.make(`claim_dup_${r}`);
  const commandId = `dup_${r}`;
  const first = yield* intake.AssertClaim(claim, assertion(org), { ...human("p_intake"), commandId });
  const second = yield* intake.AssertClaim(claim, assertion(org), { ...human("p_intake"), commandId });
  yield* log("receipts", { first, second });
  expect(second.version).toBe(first.version);
  const assertions = yield* asserted(claim, first);
  expect(assertions).toBe(1);
  const run1 = yield* eventually(runState(`review:${claim}:1`), P.isTagged("AwaitingApproval"));
  const run2 = yield* runState(`review:${claim}:2`);
  yield* log("runs", { run1: run1._tag, run2: run2._tag });
  expect(run2._tag).toBe("Unrequested");
}));

live("a lost response, retried under the same id, gets the stored result", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake } = yield* clients;
  const claim = ClaimId.make(`claim_lost_${r}`);
  const commandId = `lost_${r}`;
  // The client gives up before the answer arrives; the command may or may not have committed.
  const lost = yield* intake.AssertClaim(claim, assertion(org), { ...human("p_intake"), commandId }).pipe(
    Effect.timeout("5 millis"),
    Effect.exit,
  );
  const retried = yield* intake.AssertClaim(claim, assertion(org), { ...human("p_intake"), commandId });
  yield* log("lost-then-retried", { lost: lost._tag, retried });
  expect(retried.version).toBe(2);
  const assertions = yield* asserted(claim, retried);
  expect(assertions).toBe(1);
}));

/** How many events of each tag an instance stored, one `Tag|count` line per tag, by tag. */
const storedTags = (object: string) =>
  psql(
    `SELECT value::jsonb->'event'->>'_tag', count(*) FROM alchemy_domain_objects WHERE object = '${object}' AND key LIKE 'event:%' GROUP BY 1 ORDER BY 1`,
  );
/** What AssertClaim leads to on the claim: the assertion, its review request, the run's proposal. */
const claimReactions = "ClaimAsserted|1\nDispositionProposed|1\nReviewRequested|1";
/** What it leads to on review run 1: requested, activated, its budget, its one step, the wait. */
const runReactions = "BudgetReserved|1\nRunActivated|1\nRunAwaitingApproval|1\nRunRequested|1\nStepRecorded|1\nUsageSettled|1";

// D42: the guarantee is that reactions resume within one lease after a runner dies. Every reaction
// of the committed command happens, each exactly once, all within RECOVERY_BOUND_MS of the kill.
live("a runner killed right after a commit: every reaction happens once, within one lease and the wake allowance of the kill", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake, reviewer } = yield* clients;
  const claim = ClaimId.make(`claim_kill_${r}`);
  const commandId = `kill_${r}`;
  const first = yield* intake.AssertClaim(claim, assertion(org), { ...human("p_intake"), commandId });
  const { before: killed, after: killedAt } = yield* killRunnersThen(Clock.currentTimeMillis);
  const retried = yield* intake.AssertClaim(claim, assertion(org), { ...human("p_intake"), commandId });
  expect(retried.version).toBe(first.version);
  const reactions = Effect.all({
    claim: storedTags(`Practice/Party.ClaimAggregate/${claim}`),
    run: storedTags(`Practice/Runs.AgentRunAggregate/review:${claim}:1`),
    review: reviewer.ClaimReview.get(claim, human("p_rev")).pipe(
      Effect.map((found) => O.isSome(proposalIn(found))),
      Effect.orElseSucceed(thunkFalse),
    ),
  }, { concurrency: 1 });
  const done = (seen: Effect.Success<typeof reactions>) => seen.claim === claimReactions && seen.run === runReactions && seen.review;
  const deadline = killedAt + RECOVERY_BOUND_MS;
  const remaining = Effect.map(Clock.currentTimeMillis, (now) => N.max(deadline - now, 0));
  const untilDone = yield* remaining;
  const atDone = yield* reactions.pipe(
    Effect.repeat({ schedule: Schedule.spaced("1 second"), until: done }),
    Effect.timeoutOption(untilDone),
  );
  const doneAt = yield* Clock.currentTimeMillis;
  // Held to the bound: nothing more arrives late (each reaction exactly once).
  const untilBound = yield* remaining;
  yield* Effect.sleep(untilBound);
  const atBound = yield* reactions;
  const run2 = yield* runState(`review:${claim}:2`);
  yield* log("kill-recovery", {
    killed,
    first,
    retried,
    boundMs: RECOVERY_BOUND_MS,
    doneAfterMs: O.map(atDone, () => doneAt - killedAt),
    atDone,
    atBound,
    run2: run2._tag,
  });
  expect(O.map(atDone, done)).toEqual(O.some(true));
  expect(doneAt - killedAt).toBeLessThanOrEqual(RECOVERY_BOUND_MS);
  expect(atBound).toEqual({ claim: claimReactions, run: runReactions, review: true });
  expect(run2._tag).toBe("Unrequested");
}));

live("a projection batch cut by a runner crash is redelivered and the Postgres directory is right", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake, reviewer } = yield* clients;
  const party = PartyId.make(`party_${r}`);
  // Phase 6: the crash is forced between the sink write and the checkpoint. From the moment the
  // key accepts the input, its meta row (where the checkpoint goes) is locked: the sink writes
  // the row, then the checkpoint waits on the lock. The runners are killed there, and the waiting
  // checkpoint write is ended with them, as their connections would be.
  const meta = `FROM alchemy_domain_objects WHERE object LIKE '%PartyDirectoryProjection/${party}' AND key = 'meta'`;
  const lock = yield* holdLock(`SELECT 1 ${meta}`, `SELECT key ${meta}`);
  const registered = yield* intake.RegisterParty(party, { org, name: `Dana ${r}` }, { ...human("p_intake"), commandId: `reg_${r}` });
  const window = yield* eventually(
    Effect.all({
      rows: psql(`SELECT count(*) FROM party_directory_rows_v_0 WHERE party_id = '${party}'`).pipe(Effect.orElseSucceed(() => "no table yet")),
      blocked: blockedByLock,
      meta: psql(`SELECT left(value, 160) ${meta}`),
    }, { concurrency: 1 }),
    (w) => w.rows === "1" && Str.isNonEmpty(w.blocked),
    60,
  );
  const rowsAtKill = window.rows;
  const killed = yield* killRunnersThen(Effect.all({ ended: endBlocked, released: releaseLock }, { concurrency: 1 }));
  yield* Fiber.join(lock);
  yield* log("projection-window", { window, killed });
  const found = yield* eventually(
    reviewer.FindParties({ org, text: r }, { ...human("p_rev"), atLeast: registered }).pipe(Effect.orElseSucceed(() => ({ entries: [] as ReadonlyArray<unknown> }))),
    (page) => page.entries.length === 1,
  );
  const rows = yield* psql(`SELECT party_id, name, absorbed FROM party_directory_rows_v_0 WHERE party_id = '${party}'`);
  const positions = yield* psql(`SELECT stream, seq FROM party_directory_positions WHERE stream = 'Party/${party}'`);
  yield* log("projection", { rowsAtKill, found: found.entries, rows, positions });
  expect(pipe(rows, Str.split("\n")).length).toBe(1);
  expect(positions).toBe(`Party/${party}|1`);
}));

live("a grant revoked while a chain is in flight: the next hop is refused and recorded", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake, reviewer } = yield* clients;
  const claim = ClaimId.make(`claim_revoke_${r}`);
  // Phase 6: the revocation lands mid-chain. Once the review run is activated (the policy's hop
  // and the grant are done), its meta row is locked, so its next commit (the saga's reserve) waits.
  // The propose grant is revoked while the chain is held there; then the lock is released.
  const runObject = `FROM alchemy_domain_objects WHERE object LIKE '%AgentRun%/review:${claim}:1'`;
  const lock = yield* holdLock(`SELECT 1 ${runObject} AND key LIKE 'event:%' AND value LIKE '%RunActivated%'`, `SELECT key ${runObject} AND key = 'meta'`);
  const receipt = yield* intake.AssertClaim(claim, assertion(org), human("p_intake"));
  yield* eventually(lockHeld, (n) => n !== "0", 120);
  const held = yield* eventually(blockedByLock, Str.isNonEmpty, 20).pipe(Effect.orElseSucceed(() => "nothing waiting yet"));
  const runAtRevoke = yield* psql(`SELECT key, left(value, 100) ${runObject} ORDER BY key`);
  // Revoke the propose grant the review run's delegation comes from, while the run is held.
  const revoked = yield* revoke(`g_propose_${r}`, org);
  yield* releaseLock;
  yield* Fiber.join(lock);
  yield* log("revocation-window", { held, runAtRevoke, revoked });
  const view = yield* eventually(
    reviewer.ClaimReview.get(claim, { ...human("p_rev"), atLeast: receipt }),
    (v) => (v?.notes.length ?? 0) > 0 || O.isSome(proposalIn(v)),
    60,
  );
  const run1 = yield* runState(`review:${claim}:1`);
  yield* log("revocation", { revoked, notes: view?.notes, proposal: O.getOrNull(proposalIn(view)), run: run1 });
  expect(view?.notes.length ?? 0).toBeGreaterThan(0);
}));

live("a run waiting for approval survives a runner restart and completes after approval", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake, reviewer } = yield* clients;
  const claim = ClaimId.make(`claim_wait_${r}`);
  yield* intake.AssertClaim(claim, assertion(org), human("p_intake"));
  yield* eventually(runState(`review:${claim}:1`), P.isTagged("AwaitingApproval"));
  yield* killRunners;
  const view = yield* eventually(reviewer.ClaimReview.get(claim, human("p_rev")), (v) => O.isSome(proposalIn(v)));
  const { digest } = O.getOrThrow(proposalIn(view));
  const approved = yield* reviewer.ApproveProposal(claim, { digest, evidenceRevision: 1 }, human("p_rev"));
  const run = yield* eventually(runState(`review:${claim}:1`), P.isTagged("Completed"), 120);
  yield* log("waiting-run", { approved, run });
  expect(run.outcome).toBe("accepted");
}));

// Phase 12 (D55), the stale runner paused in `decide` past its shard lock, judged by the guarantee
// for a frozen runner: a write sent to it while it is paused is answered, with its receipt or a
// failure, within FROZEN_WRITE_BOUND_MS (the caller's retry budget plus the attempts' time); no
// write is stored twice; a retry under a write's command id after the resume gets its receipt, and
// the state then holds each write exactly once. Phase 11 saw the write sent during the pause wait
// for the paused runner for over 60 s; this case asserts the bound rather than recording it.
live("two runners on one instance (D38, D55): a write sent to a frozen runner is answered within the retry budget, stored once, and its retry gets its receipt", Effect.gen(function* () {
  const slot = yield* fresh("slot");
  const labels = psql(`SELECT value::jsonb->'event'->>'label' FROM alchemy_domain_objects WHERE object LIKE '%${slot}%' AND key LIKE 'event:%' ORDER BY key`);
  const stored = (label: string) => Effect.map(labels, (out) => A.filter(Str.split(out, "\n"), (line) => line === label).length);
  /** A write under its own command id, `<label>_<slot>`. */
  const write = (label: string, hold: number) =>
    get<{ readonly version: number; readonly stream: string; readonly ms: number }>(
      `/tworunners/write?slot=${slot}&label=${label}&hold=${hold}&command=${label}_${slot}`,
    );
  // A slow write: decide holds for 70 s on whichever runner owns the slot's shard.
  const slow = yield* Effect.forkChild(write("A", 70_000).pipe(Effect.exit));
  const runners = yield* containersOf(runnerService);
  const owner = yield* eventually(
    Effect.forEach(runners, (id) => Effect.map(docker("logs", id), (out) => (pipe(out, Str.includes("deciding A")) && pipe(out, Str.includes(slot)) ? [id] : [])), { concurrency: 1 }).pipe(
      Effect.map(A.flatten),
    ),
    (found) => found.length === 1,
    40,
  );
  const stale = owner[0]!;
  yield* docker("pause", stale);
  yield* log("paused", { stale, runners });
  // Past the shard lock's 35 s expiry, a write sent while the runner is still paused.
  yield* Effect.sleep("45 seconds");
  const sentAt = yield* Clock.currentTimeMillis;
  const quick = yield* write("B", 0).pipe(Effect.timeout(`${FROZEN_WRITE_BOUND_MS + 30_000} millis`), Effect.exit);
  const answeredAfterMs = (yield* Clock.currentTimeMillis) - sentAt;
  const storedBefore = yield* Effect.all([stored("A"), stored("B")], { concurrency: 1 });
  yield* docker("unpause", stale);
  const slowResult = yield* Fiber.join(slow).pipe(Effect.timeout("150 seconds"), Effect.exit);
  // After the resume, each write is retried under its command id until it is answered.
  const retried = (label: string) => eventually(write(label, 0).pipe(Effect.option), O.isSome, 120);
  const retriedB = yield* retried("B");
  const retriedA = yield* retried("A");
  const storedAfter = yield* Effect.all([stored("A"), stored("B")], { concurrency: 1 });
  const state = yield* get(`/tworunners/state?slot=${slot}`);
  yield* log("frozen-runner", { quick, answeredAfterMs, slow: slowResult, retriedA, retriedB, storedBefore, storedAfter, state });
  // The write sent during the pause is answered within the bound, with its receipt or a failure.
  expect(answeredAfterMs).toBeLessThanOrEqual(FROZEN_WRITE_BOUND_MS);
  // Never stored twice, before or after the resume; each exactly once after its retry.
  expect(A.every(storedBefore, (n) => n <= 1)).toBe(true);
  expect(storedAfter).toEqual([1, 1]);
  // A retry under the command id gets the receipt the first answer gave, when it gave one.
  const receiptOf = ({ version, stream }: { readonly version: number; readonly stream: string }) => ({ version, stream });
  const firstB = Exit.isSuccess(quick) ? O.some(receiptOf(quick.value)) : O.none();
  const firstA = Exit.isSuccess(slowResult) && Exit.isSuccess(slowResult.value) ? O.some(receiptOf(slowResult.value.value)) : O.none();
  const sameReceipt = (first: O.Option<ReturnType<typeof receiptOf>>, retry: O.Option<ReturnType<typeof receiptOf>>) =>
    O.match(first, { onNone: thunkTrue, onSome: (receipt) => Eq.equals(O.some(receipt), retry) });
  expect(sameReceipt(firstB, O.map(retriedB, receiptOf))).toBe(true);
  expect(sameReceipt(firstA, O.map(retriedA, receiptOf))).toBe(true);
}));

// Phase 11 (D49), the race with the stale runner stopped inside its commit, judged by the invariant:
// no commit is acknowledged from a runner whose own lock session does not hold the instance's shard
// for the whole commit. Since patch 6 each runner's lock session is named after the runner, so the
// case attributes every holder by name. A first write gives the slot a meta row; a held write's
// commit is stopped on a row lock and its runner paused with the transaction open; a third write is
// sent at once, so it reaches the paused runner's queue. The case samples the shard's holder while
// it waits (a run without a move fails as "no takeover"), then lets the other runner write and
// unpauses. A run counts toward D49 only if the paused runner decided a write after its shard moved
// (the queued one, which it can only decide once resumed). Then: the paused commit was refused; each
// stored write committed while its runner's own session held the shard; every write landed once,
// each refused one within REFUSED_WRITE_BOUND_MS of the unpause; and only named sessions, one per
// runner, hold locks in the cluster's namespace.
live("two runners on one instance (D49): no commit is acknowledged from a runner whose own lock session does not hold the shard", Effect.gen(function* () {
  const now = yield* DateTime.now;
  const startedAt = DateTime.formatIso(now);
  yield* eventually(runnerHealth, (rows) => Str.split(rows, "\n").length === 2 && !pipe(rows, Str.includes("|f")), 240);
  const slot = yield* fresh("slot");
  const shard = shardOf(slotEntity(slot));
  const held = `held_${slot}`;
  const queued = `queued_${slot}`;
  const objects = `FROM alchemy_domain_objects WHERE object LIKE '%${slot}%'`;
  const events = psql(
    `SELECT key, value::jsonb->'event'->>'label', value::jsonb->'event'->>'runner', value::jsonb->'envelope'->>'at' ${objects} AND key LIKE 'event:%' ORDER BY key`,
  );
  yield* get(`/tworunners/write?slot=${slot}&label=first_${slot}&hold=0`);
  const owners = yield* eventually(runnerLogging(`deciding first_${slot}`, startedAt), (found) => found.length === 1, 40);
  const staleRunner = owners[0]!;
  const names = yield* runnerNames;
  const nameOf = (id: string) => O.getOrUndefined(O.flatMap(A.findFirst(names, (runner) => runner.id === id), (runner) => runner.name));
  const otherRunner = yield* Effect.fromOption(A.findFirst(A.map(names, (runner) => runner.id), (id) => id !== staleRunner)).pipe(Effect.orDie);
  const staleName = nameOf(staleRunner);
  const otherName = nameOf(otherRunner);
  const ownerAtStart = yield* holderNameOf(shard);
  yield* log("named-setup", { slot, shard, stale: { id: staleRunner, name: staleName }, other: { id: otherRunner, name: otherName }, ownerAtStart, sessions: yield* lockSessions });
  expect(O.getOrUndefined(ownerAtStart)).toBe(staleName);
  const lock = yield* holdLock("SELECT 1", `SELECT key ${objects} AND key = 'meta'`);
  yield* eventually(lockHeld, (n) => n !== "0", 40);
  const slow = yield* Effect.forkChild(get(`/tworunners/write?slot=${slot}&label=${held}&hold=2000`).pipe(Effect.exit));
  yield* eventually(Effect.map(docker("logs", "--since", startedAt, staleRunner), Str.includes(`committing ${held}`)), (yes) => yes, 40);
  const waiting = yield* eventually(blockedByLock, Str.isNonEmpty, 40);
  const pid = Str.split(waiting, "|")[0] ?? "0";
  yield* docker("pause", staleRunner);
  const pausedAt = yield* Clock.currentTimeMillis;
  yield* releaseLock;
  yield* Fiber.join(lock);
  // Sent while the paused runner still owns the shard: it waits in that runner's queue.
  const queuedWrite = yield* Effect.forkChild(get(`/tworunners/write?slot=${slot}&label=${queued}&hold=0`).pipe(Effect.timeout("200 seconds"), Effect.exit));
  const commitState = psql(`SELECT state FROM pg_stat_activity WHERE pid = ${pid}`);
  const sample = Effect.gen(function* () {
    const holder = yield* holderNameOf(shard);
    const state = yield* commitState;
    const at = (yield* Clock.currentTimeMillis) - pausedAt;
    return { at, holder: O.getOrUndefined(holder), state };
  });
  const moved = yield* sample.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("1 second"),
      until: ({ holder, state }) => holder !== undefined && holder === otherName && state === "idle in transaction",
      times: 150,
    }),
  );
  const tookOver = moved.holder !== undefined && moved.holder === otherName && moved.state === "idle in transaction";
  yield* log("named-takeover", { tookOver, movedAfterMs: moved.at, holder: moved.holder, commitState: moved.state });
  if (!tookOver) {
    yield* docker("unpause", staleRunner);
    yield* Fiber.join(slow).pipe(Effect.timeout("150 seconds"), Effect.exit);
  }
  expect(tookOver, "no takeover: the shard did not move while the paused runner's commit was open").toBe(true);
  // The other runner, now the owner, writes too.
  const quick = yield* Effect.forkChild(get(`/tworunners/write?slot=${slot}&label=other_${slot}&hold=0`).pipe(Effect.timeout("150 seconds"), Effect.exit));
  yield* Effect.sleep("2 seconds");
  const before = yield* events;
  yield* docker("unpause", staleRunner);
  const resumedAt = yield* Clock.currentTimeMillis;
  // After the unpause: who holds the shard, by name, every half second, until every write answered.
  const holders = yield* Ref.make(A.empty<{ readonly at: number; readonly holder: string | undefined }>());
  const watch = yield* Effect.forkChild(
    Effect.gen(function* () {
      const holder = yield* holderNameOf(shard);
      const at = yield* Clock.currentTimeMillis;
      yield* Ref.update(holders, A.append({ at, holder: O.getOrUndefined(holder) }));
    }).pipe(Effect.repeat(Schedule.spaced("500 millis"))),
  );
  const slowResult = yield* Fiber.join(slow).pipe(Effect.timeout("150 seconds"), Effect.exit);
  const queuedResult = yield* Fiber.join(queuedWrite);
  const quickResult = yield* Fiber.join(quick);
  yield* Effect.sleep("3 seconds");
  yield* Fiber.interrupt(watch);
  const afterUnpause = yield* Ref.get(holders);
  const after = yield* events;
  const sessions = yield* lockSessions;
  const staleLog = yield* docker("logs", "--since", startedAt, staleRunner);
  const lines = A.filter(Str.split(staleLog, "\n"), (line) => pipe(line, Str.includes("commit fenced")) || pipe(line, Str.includes("deciding")));
  // A write reached the paused runner after its shard moved: it decided the queued one.
  const counted = pipe(staleLog, Str.includes(`deciding ${queued}`));
  const rows = A.map(A.filter(Str.split(after, "\n"), Str.isNonEmpty), (line) => Str.split(line, "|"));
  const byLabel = (label: string) => A.filter(rows, (row) => row[1] === label);
  // Who held the shard when a write committed: the last sample at or before its commit (its
  // envelope's time, when it was decided, plus the hold its decide took).
  const holderAt = (at: number) => O.getOrUndefined(A.last(A.filter(afterUnpause, (taken) => taken.at <= at)))?.holder;
  const committed = A.map(rows, (row) => {
    const at = Number(row[3]) + (row[1] === held ? 2000 : 0);
    return { key: row[0], label: row[1], runner: row[2], name: nameOf(row[2] ?? ""), at, holder: at >= resumedAt ? holderAt(at) : undefined, afterResumeMs: at - resumedAt };
  });
  yield* log("named-after-unpause", {
    counted,
    slow: slowResult,
    queued: queuedResult,
    quick: quickResult,
    before,
    committed,
    staleLines: lines,
    afterUnpause,
    sessions,
  });
  // The paused commit was refused at COMMIT: its runner's session had lost the shard.
  expect(A.some(lines, Str.includes("before COMMIT"))).toBe(true);
  // Every write committed after the unpause committed while its own runner's session held the shard.
  expect(A.filter(committed, (write) => write.at >= resumedAt && (write.holder === undefined || write.holder !== write.name))).toEqual([]);
  // Every write landed once; the refused ones within the bound of the unpause.
  expect(A.map([`first_${slot}`, `other_${slot}`, held, queued], (label) => byLabel(label).length)).toEqual([1, 1, 1, 1]);
  expect(A.filter(committed, (write) => (write.label === held || write.label === queued) && write.afterResumeMs > REFUSED_WRITE_BOUND_MS)).toEqual([]);
  // Only named sessions hold locks in the cluster's namespace, one per runner, after the lock
  // connection was rebuilt.
  const holdersNow = A.map(A.filter(Str.split(sessions, "\n"), Str.isNonEmpty), (line) => Str.split(line, "|")[0] ?? "");
  expect(A.every(holdersNow, (name) => name === staleName || name === otherName)).toBe(true);
  expect(holdersNow.length).toBe(HashSet.size(HashSet.fromIterable(holdersNow)));
  expect(counted, "not counted: the paused runner decided no write after its shard moved").toBe(true);
}));
