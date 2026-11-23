/**
 * Pure cannot-link-first graph replay.
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual, pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { claimsAtScope } from "../../Claim.ts";
import { Proposition, partiesOf } from "../../Proposition.ts";
import { ConflictingReview, KeyRepresentative, PartyRepresentative, ResolutionView } from "./Resolution.model.ts";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import type { PartyId } from "@beep/shared-domain/identity/Party";
import type { ClaimLedgerData, ClaimRead } from "../../Claim.ts";
import type { ResolutionScope } from "./Resolution.model.ts";

const codePoints = (value: string) =>
  A.flatMap(A.fromIterable(value), (character) => O.toArray(Str.codePointAt(character, 0)));
const codePointOrder = Order.mapInput(Order.Array(Order.Number), codePoints);
const claimOrder = Order.combine(
  Order.mapInput(Order.Number, (claim: ClaimRead) => DateTime.toEpochMillis(claim.record.core.knowledgeStart)),
  Order.mapInput(codePointOrder, (claim: ClaimRead) => claim.record.claim)
);

/**
 * Rebuild a view from effective bitemporal versions; all vetoes constrain every merge.
 *
 * **Details**
 * The ledger supplies effective knowledge intervals after supersession. This
 * function never mutates claims, assignments or law-practice references.
 *
 * **Example** (Resolve an empty ledger)
 * ```ts
 * import { ClaimLedger } from "@beep/party-domain/Claim"
 * import { resolveParties, ResolutionScope } from "@beep/party-domain/Resolution"
 * import * as DateTime from "effect/DateTime"
 * resolveParties(ClaimLedger.make({}), ResolutionScope.make({ asOf: DateTime.makeUnsafe(0), scope: "synthetic", validAt: DateTime.makeUnsafe(0) }))
 * ```
 * @category queries
 * @since 0.0.0
 */
export const resolveParties: {
  (scope: ResolutionScope): (ledger: ClaimLedgerData) => ResolutionView;
  (ledger: ClaimLedgerData, scope: ResolutionScope): ResolutionView;
} = dual(2, (ledger: ClaimLedgerData, scope: ResolutionScope): ResolutionView => {
  const active = A.sort(claimsAtScope(ledger, { ...scope, states: ["Accepted"] }), claimOrder);
  const vetoes = A.flatMap(active, (claim) =>
    Proposition.isAnyOf(["DistinctParty"])(claim.record.core.proposition)
      ? [{ claim, pair: claim.record.core.proposition }]
      : []
  );
  const merges = A.flatMap(active, (claim) =>
    Proposition.isAnyOf(["SameParty"])(claim.record.core.proposition)
      ? [{ claim, pair: claim.record.core.proposition }]
      : []
  );
  const parties = pipe(
    ledger.claims,
    A.filter(
      (record) =>
        record.core.scope === scope.scope && DateTime.isLessThanOrEqualTo(record.core.knowledgeStart, scope.asOf)
    ),
    A.flatMap((record) => partiesOf(record.core.proposition)),
    A.dedupe,
    A.sort(Order.Number)
  );
  let indices = HashMap.empty<PartyId, Graph.NodeIndex>();
  let reviewCases = A.empty<ConflictingReview>();
  const graph = Graph.undirected<PartyId, ClaimId>((g) => {
    A.forEach(parties, (party) => {
      indices = HashMap.set(indices, party, Graph.addNode(g, party));
    });
    const node = (party: PartyId) => O.getOrThrow(HashMap.get(indices, party));
    const component = (party: PartyId) =>
      pipe(g, Graph.bfs({ start: [node(party)] }), Graph.values, HashSet.fromIterable);
    A.forEach(merges, ({ claim, pair }) => {
      const left = component(pair.left);
      const right = component(pair.right);
      const conflicts = A.filter(
        vetoes,
        ({ pair: veto }) =>
          (HashSet.has(left, veto.left) && HashSet.has(right, veto.right)) ||
          (HashSet.has(left, veto.right) && HashSet.has(right, veto.left))
      );
      if (A.isReadonlyArrayNonEmpty(conflicts)) {
        reviewCases = A.append(
          reviewCases,
          ConflictingReview.make({
            blockedClaim: claim.record.claim,
            vetoClaims: A.map(conflicts, (veto) => veto.claim.record.claim),
            left: pair.left,
            right: pair.right,
            scope,
          })
        );
      } else if (!HashSet.has(left, pair.right)) {
        Graph.addEdge(g, node(pair.left), node(pair.right), claim.record.claim);
      }
    });
  });
  const representatives = pipe(
    Graph.connectedComponents(graph),
    A.flatMap((component) => {
      const members = A.flatMap(component, (index) => O.toArray(Graph.getNode(graph, index)));
      return A.isReadonlyArrayNonEmpty(members)
        ? A.map(members, (party) => PartyRepresentative.make({ party, survivor: A.min(members, Order.Number) }))
        : [];
    }),
    A.sort(Order.mapInput(Order.Number, (row: PartyRepresentative) => row.party))
  );
  const survivor = (party: PartyId) =>
    pipe(
      A.findFirst(representatives, (row) => row.party === party),
      O.map((row) => row.survivor),
      O.getOrElse(() => party)
    );
  const keys = A.flatMap(active, (claim) =>
    Proposition.isAnyOf(["KeyAssignment"])(claim.record.core.proposition)
      ? [
          KeyRepresentative.make({
            key: claim.record.core.proposition.key,
            party: claim.record.core.proposition.party,
            survivor: survivor(claim.record.core.proposition.party),
          }),
        ]
      : []
  );
  return ResolutionView.make({ scope, representatives, keys, reviewCases });
});
