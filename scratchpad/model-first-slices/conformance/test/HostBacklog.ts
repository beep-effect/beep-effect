import { StreamPin, StreamWriter } from "@proto/kernel/PublishedStream";
import { backlogOf, StoredRow, type WriterShape } from "@proto/tooling/PublisherBacklog";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import * as Str from "@beep/utils/Str";
import { psql } from "./Stack.ts";

// Phase 11 (D50): the drain check's inputs on the cluster, shared by the handover and upgrade cases.

/** Phase 6's publisher: `ClaimFacts` and the review view it reads, both at generation 0. */
export const phase6Writer: WriterShape = {
  model: "Party",
  projection: { name: "ClaimFacts", generation: 0, classGeneration: 0 },
  on: ["ClaimAccepted", "ClaimRetracted", "ProposalApproved"],
  views: [{ name: "ClaimReview", generation: 0, classGeneration: 0 }],
};

/** Phase 8's publisher: `ClaimFacts` at generation 1, from the review view at version 1, rebuilt in place. */
export const phase8Writer: WriterShape = {
  ...phase6Writer,
  projection: { name: "ClaimFacts", generation: 1, classGeneration: 1 },
  views: [{ name: "ClaimReview", generation: 1, classGeneration: 0 }],
};

/** The pins of the code phases 6 to 8 deployed: the publisher writing generation 1, from the review view. */
export const livePins = [
  StreamPin.cases.Open.make({ stream: "PartyFacts", writer: StreamWriter.make({ projection: "ClaimFacts", generation: 1, sources: ["ClaimReview"] }) }),
];

/**
 * Party's own query, the oracle: decided claims (a decision event in the claim's own events) whose
 * `ClaimDecided` generation 1 lacks.
 */
export const pendingDecisions = `SELECT count(*) FROM (
  SELECT DISTINCT split_part(object, '/', 3) AS claim FROM alchemy_domain_objects
  WHERE object LIKE 'Practice/Party.ClaimAggregate/%' AND key LIKE 'event:%'
    AND value::jsonb->'event'->>'_tag' IN ('ClaimAccepted', 'ClaimRetracted', 'ProposalApproved')
) decided WHERE NOT EXISTS (
  SELECT 1 FROM alchemy_domain_objects fact WHERE fact.object = 'Practice/Party.PartyFactsStream/claims'
    AND fact.key LIKE 'entry:%' AND fact.value::jsonb->'event'->>'factId' = decided.claim || ':decided'
)`;

/** The rows the generic reader reads: staged deliveries, consumer progress, view snapshots and runs. */
const backlogRows = `SELECT coalesce(json_agg(json_build_object('object', object, 'key', key, 'value', value::json)), '[]'::json)
  FROM alchemy_domain_objects WHERE key LIKE 'outbox:%' OR key LIKE 'run:%' OR key IN ('meta', 'snapshot')`;

/** What psql printed last: the result of the last statement (psql 15 and later print every statement's). */
export const lastLine = (out: string) => O.getOrElse(A.last(A.filter(Str.split(out, "\n"), Str.isNonEmpty)), () => "");

/** The number a psql query printed last. */
export const count = (query: string) => Effect.map(psql(query), (out) => Number(lastLine(out)));

const decodeRows = StoredRow.pipe(S.Array, S.fromJsonString, S.decodeEffect);

/** The generic reader over the host's rows, the query run as `wrap` makes it (by default, as it is). */
export const hostBacklog = ({ shape, wrap = identity }: { readonly shape: WriterShape; readonly wrap?: (query: string) => string }) =>
  Effect.flatMap(psql(wrap(backlogRows)), (out) => Effect.map(decodeRows(lastLine(out)), (rows) => backlogOf(shape, rows)));

/** The drain check's backlog entry for the outgoing publisher. */
export const handoverBacklog = (pending: number) => [{ stream: "PartyFacts", writer: "ClaimFacts", pending }];
