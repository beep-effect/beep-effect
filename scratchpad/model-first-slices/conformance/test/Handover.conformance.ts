import { expect, it } from "@effect/vitest";
import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import { partyStreamPins } from "@proto/party-model/Facts/StreamPins";
import { checkPublisherHandover } from "@proto/tooling/PublisherHandover";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { psql, record, registration, services } from "./Stack.ts";

// Phase 10 (D47): before an upgrade that replaces a publisher is deployed, the drain check runs
// against the live host and refuses while the outgoing publisher has anything pending. With
// RESTORE_PHASE=handover, the database holds phase 6's dump with the runners stopped: the data the
// live phase 6 to 8 host held, whose publisher is `ClaimFacts`, writing generation 1. The operator
// runs this case through the one-shot driver on the stack's network before `alchemy deploy`.

/** The pins of the live code: phase 8's publisher on generation 1, from the review view (version 1). */
const livePins = [
  StreamPin.cases.Open.make({ stream: "PartyFacts", writer: StreamWriter.make({ projection: "ClaimFacts", generation: 1, sources: ["ClaimReview"] }) }),
];

/**
 * What the outgoing publisher has not published, read from the host's storage: decided claims
 * (a decision event in the claim's own events) whose `ClaimDecided` generation 1 lacks.
 */
const pendingDecisions = `SELECT count(*) FROM (
  SELECT DISTINCT split_part(object, '/', 3) AS claim FROM alchemy_domain_objects
  WHERE object LIKE 'Practice/Party.ClaimAggregate/%' AND key LIKE 'event:%'
    AND value::jsonb->'event'->>'_tag' IN ('ClaimAccepted', 'ClaimRetracted', 'ProposalApproved')
) decided WHERE NOT EXISTS (
  SELECT 1 FROM alchemy_domain_objects fact WHERE fact.object = 'Practice/Party.PartyFactsStream/claims'
    AND fact.key LIKE 'entry:%' AND fact.value::jsonb->'event'->>'factId' = decided.claim || ':decided'
)`;

/** The same, inside a transaction that first adds a decision the old publisher has not handled; it rolls back. */
const withUndelivered = (claim: string, seq: number) =>
  `BEGIN; INSERT INTO alchemy_domain_objects (object, key, value) VALUES ('Practice/Party.ClaimAggregate/${claim}', 'event:${pipe(String(seq), Str.padStart(12, "0"))}', '{"event":{"_tag":"ProposalApproved"}}'); ${pendingDecisions};`;

/** A case against the deployed stack, with the stack's clients built into the case's scope. */
const live = <E>(name: string, body: Effect.Effect<void, E, Layer.Success<typeof services> | Scope.Scope>) =>
  it.live(name, () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(body, context)), 600_000);

/** The number a psql query printed last (psql 15 and later print every statement's result). */
const count = (query: string) =>
  Effect.map(psql(query), (out) => Number(O.getOrElse(A.last(A.filter(Str.split(out, "\n"), Str.isNonEmpty)), () => "NaN")));

const backlogOf = (pending: number) => [{ stream: "PartyFacts", writer: "ClaimFacts", pending }];

if (O.contains(registration.restorePhase, "handover")) {
  live("the drain check passes on the live host's data as drained, and refuses with a decision undelivered", Effect.gen(function* () {
    const drained = yield* count(pendingDecisions);
    const passed = yield* checkPublisherHandover({ current: livePins, next: partyStreamPins, backlog: backlogOf(drained) });
    // A decision on the waiting claim, stored and not yet published, as the old code leaves one.
    const versions = yield* count(
      "SELECT count(*) FROM alchemy_domain_objects WHERE object = 'Practice/Party.ClaimAggregate/claim_restore_1111be3b' AND key LIKE 'event:%'",
    );
    const undelivered = yield* count(withUndelivered("claim_restore_1111be3b", versions + 1));
    const refused = yield* Effect.flip(checkPublisherHandover({ current: livePins, next: partyStreamPins, backlog: backlogOf(undelivered) }));
    const after = yield* count(pendingDecisions);
    yield* record("handover", { drained, passed, undelivered, refused: refused.pending, after });
    expect(drained).toBe(0);
    expect(passed).toMatchObject([{ stream: "PartyFacts", change: "closed" }]);
    expect(undelivered).toBe(1);
    expect(refused.pending).toMatchObject([{ handover: { stream: "PartyFacts" }, pending: 1 }]);
    // The added decision was rolled back: the dump is as it was.
    expect(after).toBe(0);
  }));
}
