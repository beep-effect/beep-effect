import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { type ClaimReviewState, proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { partyStreamPins } from "@proto/party-model/Facts/StreamPins";
import { checkPublisherHandover } from "@proto/tooling/PublisherHandover";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { count, handoverBacklog, hostBacklog, lastLine, livePins, pendingDecisions, phase8Writer } from "./HostBacklog.ts";
import {
  blockedByLock,
  clients,
  eventually,
  fresh,
  holdLock,
  human,
  issue,
  lockHeld,
  psql,
  record,
  registration,
  releaseLock,
  runState,
  services,
} from "./Stack.ts";

// Phase 11 (D47, D50): an upgrade on the cluster. With RESTORE_PHASE=upgrade-decide, the stack runs
// phase 8's code (commit 0d11b18590d): a claim is decided while its review view is held on a row
// lock, so the decision's fact is undelivered; the drain check, reading the host's rows, must
// refuse; the lock is released, the publisher drains, and the check must pass. Then the operator
// deploys the current code over the same data, and RESTORE_PHASE=upgrade-after checks that every
// review run concluded once and the new publisher holds the decision.

/** Where the decide half leaves what the after half checks (`RESTORE_FILE`). */
const restoreFile = Config.String("RESTORE_FILE").pipe(Config.withDefault("/dev/null"));
const Decided = S.Struct({ claim: S.String, run: S.String });
const decidedJson = S.fromJsonString(Decided);

const assertion = (org: OrgId) => ({
  org,
  proposition: Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "dana@acme.test" }),
  signals: [
    EvidenceSignal.make({ source: "mailbox:intake", quote: "From: Dana <dana@acme.test>" }),
    EvidenceSignal.make({ source: "crm", quote: "dana@acme.test on file" }),
  ],
});

/** The latest proposal in a review a client read, if it has one. */
const proposalIn = (state: ClaimReviewState | null | undefined) => O.flatMap(O.fromNullishOr(state), proposalOf);

/** A case against the deployed stack, with the stack's clients built into the case's scope. */
const live = <E>(name: string, body: Effect.Effect<void, E, Layer.Success<typeof services> | Scope.Scope>) =>
  it.live(name, () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(body, context)), 600_000);

if (O.contains(registration.restorePhase, "upgrade-decide")) {
  live("on phase 8's code: the drain check refuses while a decision's fact is undelivered, and passes once the publisher drains", Effect.gen(function* () {
    const r = yield* fresh("r");
    const org = OrgId.make(`org_${r}`);
    const grants = yield* Effect.all([
      issue(`g_intake_${r}`, "p_intake", "party.intake", org),
      issue(`g_propose_${r}`, "p_intake", "party.propose", org),
      issue(`g_review_${r}`, "p_rev", "party.review", org),
      issue(`g_read_${r}`, "p_rev", "party.read", org),
    ], { concurrency: 1 });
    expect(A.every(grants, (grant) => grant.ok)).toBe(true);
    yield* Effect.sleep("2 seconds");
    const { intake, reviewer } = yield* clients;
    const claim = ClaimId.make(`claim_upgrade_${r}`);
    const run = `review:${claim}:1`;
    yield* intake.AssertClaim(claim, assertion(org), human("p_intake"));
    yield* eventually(runState(run), (state) => state._tag === "AwaitingApproval");
    const view = yield* eventually(reviewer.ClaimReview.get(claim, human("p_rev")), (found) => O.isSome(proposalIn(found)));
    const { digest } = O.getOrThrow(proposalIn(view));
    // Hold the claim's review view on its snapshot row: the decision commits, and its delivery to the
    // view (and so to the publisher, which reads the view) waits.
    const viewRow = `FROM alchemy_domain_objects WHERE object = 'Practice/Party.ClaimReviewView/${claim}' AND key = 'snapshot'`;
    const lock = yield* holdLock(`SELECT 1 ${viewRow}`, `SELECT key ${viewRow}`);
    yield* eventually(lockHeld, (n) => n !== "0", 40);
    const approved = yield* reviewer.ApproveProposal(claim, { digest, evidenceRevision: 1 }, human("p_rev"));
    const blocked = yield* eventually(blockedByLock, Str.isNonEmpty, 40);
    const held = yield* hostBacklog({ shape: phase8Writer });
    const heldOracle = yield* count(pendingDecisions);
    const refused = yield* Effect.flip(checkPublisherHandover({ current: livePins, next: partyStreamPins, backlog: handoverBacklog(held.pending) }));
    yield* releaseLock;
    yield* Fiber.join(lock);
    const drained = yield* eventually(hostBacklog({ shape: phase8Writer }), (backlog) => backlog.pending === 0, 120);
    const drainedOracle = yield* eventually(count(pendingDecisions), (n) => n === 0, 60);
    const passed = yield* checkPublisherHandover({ current: livePins, next: partyStreamPins, backlog: handoverBacklog(drained.pending) });
    const completed = yield* eventually(runState(run), (state) => state._tag === "Completed", 120);
    yield* record("upgrade-decide", { claim, run, approved, blocked, held, heldOracle, refused: refused.pending, drained, drainedOracle, passed, completed });
    const fs = yield* FileSystem.FileSystem;
    const file = yield* restoreFile;
    const text = yield* S.encodeEffect(decidedJson)({ claim, run });
    yield* fs.writeFileString(file, text);
    expect(held.pending).toBeGreaterThanOrEqual(1);
    expect(heldOracle).toBe(1);
    expect(refused.pending).toMatchObject([{ handover: { stream: "PartyFacts" }, pending: held.pending }]);
    expect(drained.pending).toBe(0);
    expect(drainedOracle).toBe(0);
    expect(passed).toMatchObject([{ stream: "PartyFacts", change: "closed" }]);
    expect(completed._tag).toBe("Completed");
  }));
}

/** How many of each event a review run stored. */
const runEvents = (run: string) =>
  psql(`SELECT value::json->'event'->>'_tag', count(*) FROM alchemy_domain_objects WHERE object = 'Practice/Runs.AgentRunAggregate/${run}' AND key LIKE 'event:%' GROUP BY 1 ORDER BY 1`);

/** How many conclusions `run` stored. */
const concludedOf = (concluded: ReadonlyArray<{ readonly run: string; readonly concluded: number }>, run: string) =>
  O.getOrElse(O.map(A.findFirst(concluded, (entry) => entry.run === run), (entry) => entry.concluded), () => 0);

if (O.contains(registration.restorePhase, "upgrade-after")) {
  live("after the current code is deployed over phase 8's data: every review run concluded once, and generation 2 holds the decision", Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const file = yield* restoreFile;
    const text = yield* fs.readFileString(file);
    const { claim, run } = yield* S.decodeEffect(decidedJson)(text);
    // A consumer's backfill run starts with the first call its model receives after the deploy; read
    // the claim first, as a client would.
    const { reviewer } = yield* clients;
    const review = yield* reviewer.ClaimReview.get(ClaimId.make(claim), human("p_rev"));
    // The new publisher's backfill republishes every earlier decision into generation 2.
    const republished = yield* eventually(
      psql(`SELECT value FROM alchemy_domain_objects WHERE key = 'prog:projection%3AClaimDecisions'`),
      Str.includes(`"phase":"complete"`),
      120,
    );
    const facts = yield* eventually(
      psql(`SELECT key, value::json->'event'->>'_tag' FROM alchemy_domain_objects WHERE object = 'Practice/Party.PartyFacts2Stream/claims' AND key LIKE 'entry:%' AND value::json->'event'->>'factId' = '${claim}:decided' ORDER BY key`),
      (out) => A.length(A.filter(Str.split(out, "\n"), Str.isNonEmpty)) === 2,
      120,
    );
    const same = yield* count(`SELECT count(*) FROM alchemy_domain_objects g1 JOIN alchemy_domain_objects g2
      ON g2.object = 'Practice/Party.PartyFacts2Stream/claims' AND g2.key LIKE 'entry:%'
      AND g2.value::jsonb->'event' = g1.value::jsonb->'event'
      WHERE g1.object = 'Practice/Party.PartyFactsStream/claims' AND g1.key LIKE 'entry:%' AND g1.value::json->'event'->>'factId' = '${claim}:decided'`);
    // Let the runs inbox read both generations to their end, then count every review run's conclusions.
    const end = yield* count(`SELECT count(*) FROM alchemy_domain_objects WHERE object LIKE 'Practice/Party.PartyFacts%Stream/claims' AND key LIKE 'entry:%'`);
    const checkpoint = yield* eventually(count(`SELECT coalesce(max(seq), 0) FROM runs_inbox_checkpoints WHERE producer = 'party'`), (seq) => seq >= end, 120);
    const listed = yield* psql(`SELECT DISTINCT split_part(object, '/', 3) FROM alchemy_domain_objects WHERE object LIKE 'Practice/Runs.AgentRunAggregate/review:%'`);
    const runs = A.filter(Str.split(listed, "\n"), Str.isNonEmpty);
    const concluded = yield* Effect.forEach(runs, (each) =>
      Effect.map(count(`SELECT count(*) FROM alchemy_domain_objects WHERE object = 'Practice/Runs.AgentRunAggregate/${each}' AND key LIKE 'event:%' AND value::json->'event'->>'_tag' IN ('RunCompleted', 'RunRefused', 'RunCancelled')`), (n) => ({ run: each, concluded: n })),
      { concurrency: 1 },
    );
    const events = yield* runEvents(run);
    const state = yield* runState(run);
    const seen = yield* psql(`SELECT key FROM runs_inbox_seen WHERE key LIKE 'party:${claim}:%' ORDER BY key`);
    yield* record("upgrade-after", { claim, review: review?._tag, run, republished: lastLine(republished), facts, same, end, checkpoint, concluded, events, state, seen });
    expect(same).toBe(2);
    expect(A.filter(concluded, (entry) => entry.concluded > 1)).toEqual([]);
    expect(concludedOf(concluded, run)).toBe(1);
    expect(state._tag).toBe("Completed");
    expect(A.filter(Str.split(seen, "\n"), Str.isNonEmpty)).toEqual([`party:${claim}:decided:v1`]);
  }));
}
