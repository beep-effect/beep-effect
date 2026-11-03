/**
 * Purpose-specific projections, rebuilt from the ledger for one scope.
 *
 * **Details**
 * A projection is parameterized by knowledge time (`asOf`), world time
 * (`validAt`), and the review states it may read. `effect/Graph` node indexes
 * exist only inside one build; every edge carries the claim-version or event
 * id that justifies it, so any line on a chart expands back to evidence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ReviewTag, versionsAt } from "@beep/epistemics/Claim";
import { $PartyDomainId } from "@beep/identity/packages";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { thunkEmptyArray, thunkEmptyReadonlyArray, thunkUndefined } from "@beep/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { voiceOf } from "../../Communication.ts";
import { AttributedEvent, DeclaredLine } from "../../Hierarchy.ts";
import { ClaimVersionId, EventId, IdentifierId, VoiceId } from "../../Ids.ts";
import { Proposition } from "../../Proposition.ts";
import { ConflictingReview, ResolutionScope, resolveParties } from "../../Resolution.ts";
import type { ClaimVersion } from "../../Claim.ts";
import type { CommunicationEvent, Observation } from "../../Communication.ts";

const $I = $PartyDomainId.create("values/Projection/Projection.behavior");

/**
 * Scope of one projection build.
 *
 * **Example** (Decode ProjectionScope)
 * ```ts
 * import { ProjectionScope } from "@beep/party-domain/Projection"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ProjectionScope)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class ProjectionScope extends S.Opaque<ProjectionScope, { readonly brand: unique symbol }>()(
  S.Struct({ asOf: S.DateTimeUtcFromMillis, validAt: S.DateTimeUtcFromMillis, states: S.Array(ReviewTag) }).pipe(
    $I.annoteSchema("ProjectionScope", { description: "Bitemporal scope and allowed review states." })
  )
) {}

const RepresentativeLookup = S.declare<(party: PartyId) => PartyId>(
  (value): value is (party: PartyId) => PartyId => typeof value === "function"
).pipe(
  $I.annoteSchema("RepresentativeLookup", { description: "In-memory representative lookup; not a persisted codec." })
);

/**
 * In-memory identity projection with validated maps and an attached lookup operation.
 *
 * **Details**
 * The callable is supplied by identityView and is not a persisted representation.
 *
 * **Example** (Inspect identifier lookup schema)
 * ```ts
 * import { IdentityView } from "@beep/party-domain/Projection"
 * const identifiers = IdentityView.fields.partyOfIdentifier
 * ```
 * @category models
 * @since 0.0.0
 */
export class IdentityView extends S.Opaque<IdentityView, { readonly brand: unique symbol }>()(
  S.Struct({
    authorOfVoice: S.HashMap(VoiceId, PartyId),
    partyOfIdentifier: S.HashMap(IdentifierId, PartyId),
    representative: RepresentativeLookup,
    reviewCases: S.Array(ConflictingReview),
  }).pipe($I.annoteSchema("IdentityView", { description: "Scoped identity maps and representative lookup." }))
) {}

/**
 * Build the identity view. An identifier attributed to more than one party in
 * scope (a shared mailbox) maps to none: ambiguity is not resolved by picking.
 *
 * **Example** (Use identityView)
 * ```ts
 * import { identityView } from "@beep/party-domain/Projection"
 * const inspect = identityView
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const identityView = ({
  ledger,
  scope,
}: {
  readonly ledger: ReadonlyArray<ClaimVersion>;
  readonly scope: ProjectionScope;
}): IdentityView => {
  const inScope = versionsAt(ledger, scope);
  const resolved = resolveParties(ledger, ResolutionScope.make({ asOf: scope.asOf, validAt: scope.validAt }));
  const representative = (party: PartyId) =>
    O.getOrElse(
      O.map(
        A.findFirst(resolved.representatives, (row) => row.party === party),
        (row) => row.survivor
      ),
      () => party
    );
  const unique = <K>(pairs: ReadonlyArray<readonly [K, PartyId]>): HashMap.HashMap<K, PartyId> => {
    const grouped = A.reduce(pairs, HashMap.empty<K, ReadonlyArray<PartyId>>(), (m, [k, p]) =>
      HashMap.set(m, k, A.dedupe([...O.getOrElse(HashMap.get(m, k), thunkEmptyArray()), representative(p)]))
    );
    return HashMap.filterMap(grouped, (ps) =>
      A.matchLeft(ps, {
        onEmpty: () => Result.failVoid,
        onNonEmpty: (only, rest) => (A.isReadonlyArrayEmpty(rest) ? Result.succeed(only) : Result.failVoid),
      })
    );
  };
  return IdentityView.make({
    representative,
    reviewCases: resolved.reviewCases,
    partyOfIdentifier: unique(
      A.flatMap(inScope, (v) =>
        v.proposition._tag === "IdentifierOf" && v.proposition.relation !== "represents"
          ? [Tuple.make(v.proposition.identifier, v.proposition.party)]
          : []
      )
    ),
    authorOfVoice: unique(
      A.flatMap(inScope, (v) =>
        Proposition.guards.VoiceAuthor(v.proposition) ? [Tuple.make(v.proposition.voice, v.proposition.author)] : []
      )
    ),
  });
};

/**
 * Attribute events under an identity view. Authorship comes only from an
 * admitted `VoiceAuthor`; the `from` header alone never names an author.
 *
 * **Example** (Use attributeEvents)
 * ```ts
 * import { attributeEvents } from "@beep/party-domain/Projection"
 * const inspect = attributeEvents
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const attributeEvents = ({
  events,
  observations,
  view,
}: {
  readonly events: ReadonlyArray<CommunicationEvent>;
  readonly observations: ReadonlyArray<Observation>;
  readonly view: IdentityView;
}): ReadonlyArray<AttributedEvent> =>
  A.map(events, (event) => {
    const parties = (role: "to" | "cc") =>
      A.dedupe(
        A.flatMap(event.participants, (p) =>
          p.role === role ? O.toArray(HashMap.get(view.partyOfIdentifier, p.identifier)) : []
        )
      );
    return AttributedEvent.make({
      event: event.id,
      author: HashMap.get(view.authorOfVoice, voiceOf(event).id),
      to: parties("to"),
      cc: parties("cc"),
      acts: A.flatMap(observations, (o) => (o._tag === "SpeechActLabel" && o.event === event.id ? [o.act] : [])),
    });
  });

/**
 * Declared reporting lines in scope, resolved to representatives.
 *
 * **Example** (Use declaredLines)
 * ```ts
 * import { declaredLines } from "@beep/party-domain/Projection"
 * const inspect = declaredLines
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const declaredLines = ({
  ledger,
  scope,
  view,
}: {
  readonly ledger: ReadonlyArray<ClaimVersion>;
  readonly scope: ProjectionScope;
  readonly view: IdentityView;
}): ReadonlyArray<DeclaredLine> =>
  A.flatMap(versionsAt(ledger, scope), (v) =>
    Proposition.guards.ReportsTo(v.proposition)
      ? [
          DeclaredLine.make({
            subordinate: view.representative(v.proposition.subordinate),
            superior: view.representative(v.proposition.superior),
          }),
        ]
      : []
  );

/**
 * Org-chart projection node and edge payloads.
 *
 * **Example** (Decode OrgNode)
 * ```ts
 * import { OrgNode } from "@beep/party-domain/Projection"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(OrgNode)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class OrgNode extends S.Opaque<OrgNode, { readonly brand: unique symbol }>()(
  S.Struct({ party: PartyId }).pipe(
    $I.annoteSchema("OrgNode", { description: "A party in an organization projection." })
  )
) {}
/**
 * OrgEdge public schema for the projection model.
 *
 * **Example** (Decode OrgEdge)
 * ```ts
 * import { OrgEdge } from "@beep/party-domain/Projection"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(OrgEdge)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class OrgEdge extends S.Opaque<OrgEdge, { readonly brand: unique symbol }>()(
  S.Struct({ relation: S.Literals(["reports-to", "member-of"]), claimVersion: ClaimVersionId }).pipe(
    $I.annoteSchema("OrgEdge", { description: "An evidence-backed organizational relation." })
  )
) {}

/**
 * Build the declared org graph (subordinate → superior, member → org).
 *
 * **Example** (Use orgGraph)
 * ```ts
 * import { orgGraph } from "@beep/party-domain/Projection"
 * const inspect = orgGraph
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const orgGraph = ({
  ledger,
  scope,
  view,
}: {
  readonly ledger: ReadonlyArray<ClaimVersion>;
  readonly scope: ProjectionScope;
  readonly view: IdentityView;
}) => {
  let index = HashMap.empty<PartyId, Graph.NodeIndex>();
  const graph = Graph.directed<OrgNode, OrgEdge>((g) => {
    const node = (p: PartyId): Graph.NodeIndex =>
      O.getOrElse(HashMap.get(index, p), () => {
        const i = Graph.addNode(g, OrgNode.make({ party: p }));
        index = HashMap.set(index, p, i);
        return i;
      });
    A.forEach(versionsAt(ledger, scope), (v) => {
      if (v.proposition._tag === "ReportsTo") {
        const edge = OrgEdge.make({ relation: "reports-to", claimVersion: v.id });
        Graph.addEdge(
          g,
          node(view.representative(v.proposition.subordinate)),
          node(view.representative(v.proposition.superior)),
          edge
        );
      } else if (v.proposition._tag === "Membership") {
        const edge = OrgEdge.make({ relation: "member-of", claimVersion: v.id });
        Graph.addEdge(
          g,
          node(view.representative(v.proposition.member)),
          node(view.representative(v.proposition.organization)),
          edge
        );
      }
    });
  });
  return { graph, index };
};

/**
 * The reports-to projection of an org graph (membership edges removed).
 *
 * **Example** (Use reportingGraph)
 * ```ts
 * import { reportingGraph } from "@beep/party-domain/Projection"
 * const inspect = reportingGraph
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const reportingGraph = (org: ReturnType<typeof orgGraph>) =>
  Graph.mutate(org.graph, (g) => {
    Graph.filterEdges(g, (e) => e.relation === "reports-to");
  });

/**
 * Chain of command upward from a party: a depth-first walk of the reports-to
 * projection. With one declared superior per party this is the chain itself.
 *
 * **Example** (Use chainOfCommand)
 * ```ts
 * import { chainOfCommand } from "@beep/party-domain/Projection"
 * const inspect = chainOfCommand
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const chainOfCommand = ({
  org,
  party,
}: {
  readonly org: ReturnType<typeof orgGraph>;
  readonly party: PartyId;
}): ReadonlyArray<PartyId> =>
  O.match(HashMap.get(org.index, party), {
    onNone: thunkEmptyReadonlyArray<PartyId>(),
    onSome: (start) =>
      pipe(
        Graph.dfs(reportingGraph(org), {
          start: [start],
          direction: "outgoing",
        }),
        Graph.values,
        A.fromIterable,
        A.drop(1),
        A.map((n) => n.party)
      ),
  });

/**
 * A cycle in declared reporting lines ("A reports to B reports to A") is a
 * contradiction between sources, surfaced as data rather than silently broken.
 *
 * **Example** (Use declaredHierarchyCycle)
 * ```ts
 * import { declaredHierarchyCycle } from "@beep/party-domain/Projection"
 * const inspect = declaredHierarchyCycle
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const declaredHierarchyCycle = (org: ReturnType<typeof orgGraph>): O.Option<ReadonlyArray<PartyId>> => {
  const reporting = reportingGraph(org);
  return O.map(Graph.findCycle(reporting), (cycle) =>
    A.flatMap(cycle.path, (i) => O.toArray(O.map(Graph.getNode(reporting, i), (n) => n.party)))
  );
};

/**
 * Mermaid rendering of an org projection, for review documents.
 *
 * **Example** (Use orgMermaid)
 * ```ts
 * import { orgMermaid } from "@beep/party-domain/Projection"
 * const inspect = orgMermaid
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const orgMermaid = ({
  org,
  label,
}: {
  readonly org: ReturnType<typeof orgGraph>;
  readonly label: (p: PartyId) => string;
}): string =>
  Graph.toMermaid(org.graph, {
    nodeLabel: (n) => label(n.party),
    edgeLabel: (e) => e.relation,
  });

/**
 * Identifier node in a communication-selector projection.
 * **Example** (Decode a selector node)
 * ```ts
 * import { SelectorNode } from "@beep/party-domain/Projection"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SelectorNode)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SelectorNode extends S.Opaque<SelectorNode, { readonly brand: unique symbol }>()(
  S.Struct({ identifier: IdentifierId }).pipe(
    $I.annoteSchema("SelectorNode", { description: "A communication selector, never a person." })
  )
) {}
/**
 * Event and recipient role supporting a selector edge.
 * **Example** (Decode a selector edge)
 * ```ts
 * import { SelectorEdge } from "@beep/party-domain/Projection"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SelectorEdge)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SelectorEdge extends S.Opaque<SelectorEdge, { readonly brand: unique symbol }>()(
  S.Struct({ event: EventId, role: S.Literals(["to", "cc", "bcc"]) }).pipe(
    $I.annoteSchema("SelectorEdge", { description: "One evidence-backed recipient relation." })
  )
) {}

/**
 * Selector graph: identifiers as nodes, one edge per (event, from → recipient).
 * Traversal here is selector traversal, never "who knows whom".
 *
 * **Example** (Use selectorGraph)
 * ```ts
 * import { selectorGraph } from "@beep/party-domain/Projection"
 * const inspect = selectorGraph
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const selectorGraph = (events: ReadonlyArray<CommunicationEvent>) => {
  let index = HashMap.empty<IdentifierId, Graph.NodeIndex>();
  const graph = Graph.directed<SelectorNode, SelectorEdge>((g) => {
    const node = (i: IdentifierId): Graph.NodeIndex =>
      O.getOrElse(HashMap.get(index, i), () => {
        const n = Graph.addNode(g, SelectorNode.make({ identifier: i }));
        index = HashMap.set(index, i, n);
        return n;
      });
    A.forEach(events, (e) => {
      const from = A.findFirst(e.participants, (p) => p.role === "from");
      O.match(from, {
        onNone: thunkUndefined,
        onSome: (f) =>
          A.forEach(e.participants, (p) => {
            if (p.role === "to" || p.role === "cc" || p.role === "bcc") {
              Graph.addEdge(
                g,
                node(f.identifier),
                node(p.identifier),
                SelectorEdge.make({
                  event: e.id,
                  role: p.role,
                })
              );
            }
          }),
      });
    });
  });
  return { graph, index };
};

/**
 * Selector reach: identifiers within `hops` outgoing communication hops of a
 * seed identifier, with their distance. Contact-chaining over selectors; it
 * says nothing about who knows whom.
 *
 * **Example** (Use selectorReach)
 * ```ts
 * import { selectorReach } from "@beep/party-domain/Projection"
 * const inspect = selectorReach
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const selectorReach = ({
  selectors,
  seed,
  hops,
}: {
  readonly selectors: ReturnType<typeof selectorGraph>;
  readonly seed: IdentifierId;
  readonly hops: number;
}): HashMap.HashMap<IdentifierId, number> =>
  O.match(HashMap.get(selectors.index, seed), {
    onNone: HashMap.empty<IdentifierId, number>,
    onSome: (start) =>
      pipe(
        Graph.unweightedDistances(selectors.graph, start, { direction: "outgoing" }),
        A.fromIterable,
        A.flatMap(([i, d]) =>
          d > 0 && d <= hops
            ? O.toArray(O.map(Graph.getNode(selectors.graph, i), (n) => Tuple.make(n.identifier, d)))
            : []
        ),
        HashMap.fromIterable
      ),
  });
