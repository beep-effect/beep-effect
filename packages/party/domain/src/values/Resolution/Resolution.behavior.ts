/**
 * Pure cannot-link-first graph replay.
 * @packageDocumentation
 * @since 0.0.0
 */
import { versionsAt } from "@beep/epistemics/Claim";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual, pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { Proposition, partiesOf } from "../../Proposition.ts";
import { ConflictingReview, KeyRepresentative, PartyRepresentative, ResolutionView } from "./Resolution.model.ts";
import type { PartyId } from "@beep/shared-domain/identity/Party";
import type { ClaimVersion } from "../../Claim.ts";
import type { ClaimVersionId } from "../../Ids.ts";
import type { ResolutionScope } from "./Resolution.model.ts";

const codePoints = (value: string) =>
  A.flatMap(A.fromIterable(value), (character) => O.toArray(Str.codePointAt(character, 0)));
const codePointOrder = Order.mapInput(Order.Array(Order.Number), codePoints);
const claimOrder = Order.combine(
  Order.mapInput(Order.Number, (claim: ClaimVersion) => DateTime.toEpochMillis(claim.knowledge.recordedAt)),
  Order.mapInput(codePointOrder, (claim: ClaimVersion) => claim.id)
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
 * import { resolveParties, ResolutionScope } from "@beep/party-domain/Resolution"
 * import * as DateTime from "effect/DateTime"
 * resolveParties([], ResolutionScope.make({ asOf: DateTime.makeUnsafe(0), validAt: DateTime.makeUnsafe(0) }))
 * ```
 * @category queries
 * @since 0.0.0
 */
export const resolveParties: {
  (scope: ResolutionScope): (versions: ReadonlyArray<ClaimVersion>) => ResolutionView;
  (versions: ReadonlyArray<ClaimVersion>, scope: ResolutionScope): ResolutionView;
} = dual(2, (versions: ReadonlyArray<ClaimVersion>, scope: ResolutionScope): ResolutionView => {
  const active = A.sort(versionsAt(versions, { ...scope, states: ["Accepted"] }), claimOrder);
  const vetoes = A.flatMap(active, (claim) =>
    Proposition.isAnyOf(["DistinctParty"])(claim.proposition) ? [{ claim, pair: claim.proposition }] : []
  );
  const merges = A.flatMap(active, (claim) =>
    Proposition.isAnyOf(["SameParty"])(claim.proposition) ? [{ claim, pair: claim.proposition }] : []
  );
  const parties = pipe(
    versions,
    A.filter((claim) => DateTime.isLessThanOrEqualTo(claim.knowledge.recordedAt, scope.asOf)),
    A.flatMap((claim) => partiesOf(claim.proposition)),
    A.dedupe,
    A.sort(Order.Number)
  );
  let indices = HashMap.empty<PartyId, Graph.NodeIndex>();
  let reviewCases = A.empty<ConflictingReview>();
  const graph = Graph.undirected<PartyId, ClaimVersionId>((g) => {
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
            blockedClaim: claim.id,
            vetoClaims: A.map(conflicts, (veto) => veto.claim.id),
            left: pair.left,
            right: pair.right,
            scope,
          })
        );
      } else if (!HashSet.has(left, pair.right)) {
        Graph.addEdge(g, node(pair.left), node(pair.right), claim.id);
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
    Proposition.isAnyOf(["KeyAssignment"])(claim.proposition)
      ? [
          KeyRepresentative.make({
            key: claim.proposition.key,
            party: claim.proposition.party,
            survivor: survivor(claim.proposition.party),
          }),
        ]
      : []
  );
  return ResolutionView.make({ scope, representatives, keys, reviewCases });
});
