import { expect, it } from "@effect/vitest";
import { partyStreamPins } from "@proto/party-model/Facts/StreamPins";
import { checkPublisherHandover } from "@proto/tooling/PublisherHandover";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import type * as Scope from "effect/Scope";
import * as Str from "@beep/utils/Str";
import { count, handoverBacklog, hostBacklog, livePins, pendingDecisions, phase6Writer } from "./HostBacklog.ts";
import { record, registration, services } from "./Stack.ts";

// Phase 10 (D47): before an upgrade that replaces a publisher is deployed, the drain check runs
// against the live host and refuses while the outgoing publisher has anything pending. With
// RESTORE_PHASE=handover, the database holds phase 6's dump with the runners stopped: the data the
// live phase 6 to 8 host held, whose publisher is `ClaimFacts`, writing generation 1. The operator
// runs this case through the one-shot driver on the stack's network before `alchemy deploy`.
//
// Phase 11 (D50): the backlog the check is given is the generic reader's, over the host's rows
// read by SQL, with phase 6's writer written out (its code is no longer in the tree). Party's own
// query stays as the oracle, and the two must agree, drained and with a decision undelivered.

const pad = (n: number) => pipe(String(n), Str.padStart(12, "0"));

/**
 * A decision the old code has committed and not yet delivered, as the aggregate leaves one: the
 * event row and, in the same transaction, its delivery to the review view staged in the claim's
 * outbox (`DurableObjects.ts`, `queue`). The transaction is never committed: the session ends
 * with it open, and PostgreSQL rolls it back.
 */
const withUndelivered = (claim: string, seq: number, outboxSeq: number) => {
  const object = `Practice/Party.ClaimAggregate/${claim}`;
  const event = `{"_tag":"ProposalApproved"}`;
  const delivery = `{"target":{"kind":"view","name":"ClaimReview"},"key":"${claim}","source":"Claim/${claim}","seq":${seq},"origin":"Claim","tag":"ProposalApproved","event":${event},"envelope":{}}`;
  return (query: string) =>
    `BEGIN; INSERT INTO alchemy_domain_objects (object, key, value) VALUES
      ('${object}', 'event:${pad(seq)}', '{"event":${event}}'),
      ('${object}', 'outbox:${pad(outboxSeq)}', '${delivery}'),
      ('${object}', 'outbox-seq', '${outboxSeq}')
      ON CONFLICT (object, key) DO UPDATE SET value = excluded.value; ${query};`;
};

/** A case against the deployed stack, with the stack's clients built into the case's scope. */
const live = <E>(name: string, body: Effect.Effect<void, E, Layer.Success<typeof services> | Scope.Scope>) =>
  it.live(name, () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(body, context)), 600_000);

if (O.contains(registration.restorePhase, "handover")) {
  live("the drain check passes on the live host's data as drained, and refuses with a decision undelivered; the generic backlog agrees with Party's query", Effect.gen(function* () {
    const claim = "claim_restore_1111be3b";
    const drained = yield* hostBacklog({ shape: phase6Writer });
    const drainedOracle = yield* count(pendingDecisions);
    const passed = yield* checkPublisherHandover({ current: livePins, next: partyStreamPins, backlog: handoverBacklog(drained.pending) });
    // A decision on the waiting claim, stored and not yet published, as the old code leaves one.
    const versions = yield* count(`SELECT count(*) FROM alchemy_domain_objects WHERE object = 'Practice/Party.ClaimAggregate/${claim}' AND key LIKE 'event:%'`);
    const staged = yield* count(`SELECT coalesce(max(value::int), 0) FROM alchemy_domain_objects WHERE object = 'Practice/Party.ClaimAggregate/${claim}' AND key = 'outbox-seq'`);
    const undelivered = withUndelivered(claim, versions + 1, staged + 1);
    const held = yield* hostBacklog({ shape: phase6Writer, wrap: undelivered });
    const heldOracle = yield* count(undelivered(pendingDecisions));
    const refused = yield* Effect.flip(checkPublisherHandover({ current: livePins, next: partyStreamPins, backlog: handoverBacklog(held.pending) }));
    const after = yield* hostBacklog({ shape: phase6Writer });
    const afterOracle = yield* count(pendingDecisions);
    yield* record("handover", { drained, drainedOracle, passed, held, heldOracle, refused: refused.pending, after, afterOracle });
    expect(drained.pending).toBe(0);
    expect(drainedOracle).toBe(0);
    expect(passed).toMatchObject([{ stream: "PartyFacts", change: "closed" }]);
    // The undelivered decision waits on its way through the review view, and both readers see it.
    expect(held).toEqual({ staged: 0, throughViews: 1, unprocessed: 0, runComplete: true, pending: 1 });
    expect(heldOracle).toBe(1);
    expect(refused.pending).toMatchObject([{ handover: { stream: "PartyFacts" }, pending: 1 }]);
    // The added decision was rolled back: the dump is as it was.
    expect(after.pending).toBe(0);
    expect(afterOracle).toBe(0);
  }));
}
