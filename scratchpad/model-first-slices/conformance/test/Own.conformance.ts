import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { type ClaimReviewState, proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Str from "effect/String";
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
  ]);
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
  return A.filter(page.entries, (entry) => entry.event._tag === "ClaimAsserted").length;
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
  const run1 = yield* eventually(runState(`review:${claim}:1`), (s) => s._tag === "AwaitingApproval");
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

live("a runner killed right after a commit: the retry gets the stored result, each reaction happens once", Effect.gen(function* () {
  const { org, r } = yield* setup;
  const { intake } = yield* clients;
  const claim = ClaimId.make(`claim_kill_${r}`);
  const commandId = `kill_${r}`;
  const first = yield* intake.AssertClaim(claim, assertion(org), { ...human("p_intake"), commandId });
  const killed = yield* killRunners;
  const retried = yield* intake.AssertClaim(claim, assertion(org), { ...human("p_intake"), commandId });
  yield* log("kill", { killed, first, retried });
  expect(retried.version).toBe(first.version);
  const assertions = yield* asserted(claim, retried);
  expect(assertions).toBe(1);
  const run1 = yield* eventually(runState(`review:${claim}:1`), (s) => s._tag === "AwaitingApproval");
  const run2 = yield* runState(`review:${claim}:2`);
  yield* log("kill-runs", { run1: run1._tag, run2: run2._tag });
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
      rows: psql(`SELECT count(*) FROM party_directory_rows WHERE party_id = '${party}'`).pipe(Effect.orElseSucceed(() => "no table yet")),
      blocked: blockedByLock,
      meta: psql(`SELECT left(value, 160) ${meta}`),
    }),
    (w) => w.rows === "1" && Str.isNonEmpty(w.blocked),
    60,
  );
  const rowsAtKill = window.rows;
  const killed = yield* killRunnersThen(Effect.all({ ended: endBlocked, released: releaseLock }));
  yield* Fiber.join(lock);
  yield* log("projection-window", { window, killed });
  const found = yield* eventually(
    reviewer.FindParties({ org, text: r }, { ...human("p_rev"), atLeast: registered }).pipe(Effect.orElseSucceed(() => ({ entries: [] as ReadonlyArray<unknown> }))),
    (page) => page.entries.length === 1,
  );
  const rows = yield* psql(`SELECT party_id, name, absorbed FROM party_directory_rows WHERE party_id = '${party}'`);
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
  yield* eventually(runState(`review:${claim}:1`), (s) => s._tag === "AwaitingApproval");
  yield* killRunners;
  const view = yield* eventually(reviewer.ClaimReview.get(claim, human("p_rev")), (v) => O.isSome(proposalIn(v)));
  const { digest } = O.getOrThrow(proposalIn(view));
  const approved = yield* reviewer.ApproveProposal(claim, { digest, evidenceRevision: 1 }, human("p_rev"));
  const run = yield* eventually(runState(`review:${claim}:1`), (s) => s._tag === "Completed", 120);
  yield* log("waiting-run", { approved, run });
  expect(run.outcome).toBe("accepted");
}));

live("two runners on one instance (D38): a runner paused past its shard lock commits after another took over", Effect.gen(function* () {
  const slot = yield* fresh("slot");
  const events = psql(`SELECT key, left(value::text, 160) FROM alchemy_domain_objects WHERE object LIKE '%${slot}%' ORDER BY key`);
  // A slow write: decide holds for 70 s on whichever runner owns the slot's shard.
  const slow = yield* Effect.forkChild(get(`/tworunners/write?slot=${slot}&label=A&hold=70000`).pipe(Effect.exit));
  const runners = yield* containersOf(runnerService);
  const owner = yield* eventually(
    Effect.forEach(runners, (id) => Effect.map(docker("logs", id), (out) => (pipe(out, Str.includes("deciding A")) && pipe(out, Str.includes(slot)) ? [id] : []))).pipe(
      Effect.map(A.flatten),
    ),
    (found) => found.length === 1,
    40,
  );
  const stale = owner[0]!;
  yield* docker("pause", stale);
  yield* log("paused", { stale, runners });
  // Past the shard lock's 35 s expiry, the other runner takes the shard; a quick write commits there.
  yield* Effect.sleep("45 seconds");
  const quick = yield* get(`/tworunners/write?slot=${slot}&label=B&hold=0`).pipe(Effect.timeout("60 seconds"), Effect.exit);
  const before = yield* events;
  yield* log("before-unpause", { quick, events: before });
  yield* docker("unpause", stale);
  const slowResult = yield* Fiber.join(slow).pipe(Effect.timeout("120 seconds"), Effect.exit);
  yield* Effect.sleep("3 seconds");
  const after = yield* events;
  const state = yield* get(`/tworunners/state?slot=${slot}`);
  yield* log("after-unpause", { slow: slowResult, events: after, state });
}));

// Phase 6: the same race with the stale runner stopped later, inside its commit. A first write gives
// the slot a meta row; that row is locked before the held write's decide returns, so its commit
// starts and waits there. The runner is paused, the lock released (the commit's statement goes
// through in Postgres and its transaction stays open), and another runner writes after taking the
// shard. Observational, as the case above: it records what is stored.
live("two runners on one instance (D38), the stale runner paused inside its commit", Effect.gen(function* () {
  const slot = yield* fresh("slot");
  const held = `held_${slot}`;
  const objects = `FROM alchemy_domain_objects WHERE object LIKE '%${slot}%'`;
  const events = psql(`SELECT key, left(value::text, 160) ${objects} ORDER BY key`);
  yield* get(`/tworunners/write?slot=${slot}&label=first_${slot}&hold=0`);
  const lock = yield* holdLock("SELECT 1", `SELECT key ${objects} AND key = 'meta'`);
  yield* eventually(lockHeld, (n) => n !== "0", 40);
  const slow = yield* Effect.forkChild(get(`/tworunners/write?slot=${slot}&label=${held}&hold=2000`).pipe(Effect.exit));
  const runners = yield* containersOf(runnerService);
  const owner = yield* eventually(
    Effect.forEach(runners, (id) => Effect.map(docker("logs", id), (out) => (pipe(out, Str.includes(`committing ${held}`)) ? [id] : []))).pipe(
      Effect.map(A.flatten),
    ),
    (found) => found.length === 1,
    40,
  );
  const waiting = yield* eventually(blockedByLock, Str.isNonEmpty, 40);
  const stale = owner[0]!;
  yield* docker("pause", stale);
  yield* releaseLock;
  yield* Fiber.join(lock);
  yield* Effect.sleep("1 second");
  const pid = Str.split(waiting, "|")[0] ?? "0";
  const inCommit = yield* psql(`SELECT state, wait_event_type, left(query, 120) FROM pg_stat_activity WHERE pid = ${pid}`);
  yield* log("paused-in-commit", { stale, runners, waiting, inCommit });
  // Past the shard lock's 35 s expiry, the other runner takes the shard and writes.
  yield* Effect.sleep("45 seconds");
  const quick = yield* get(`/tworunners/write?slot=${slot}&label=other_${slot}&hold=0`).pipe(Effect.timeout("60 seconds"), Effect.exit);
  const before = yield* events;
  const sessions = yield* psql(`SELECT pid, state, wait_event_type, left(query, 80) FROM pg_stat_activity WHERE datname = 'cluster' AND state <> 'idle' AND pid <> pg_backend_pid()`);
  yield* log("in-commit-before-unpause", { quick, events: before, sessions });
  yield* docker("unpause", stale);
  const slowResult = yield* Fiber.join(slow).pipe(Effect.timeout("120 seconds"), Effect.exit);
  yield* Effect.sleep("3 seconds");
  const after = yield* events;
  const state = yield* get(`/tworunners/state?slot=${slot}`);
  yield* log("in-commit-after-unpause", { slow: slowResult, events: after, state });
}));
