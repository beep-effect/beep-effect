/**
 * Declared vs operational hierarchy.
 *
 * **Details**
 * - **Declared**: `ReportsTo` / `Membership` claims whose support is what the
 *   organization said about itself (directory exports, signature titles).
 * - **Operational**: derived assessments over attributed communication events
 *   (who grants approval to whom, who escalates to whom). Never facts: each
 *   carries its producer, supporting events, and custodian coverage.
 *
 * Operational assessments remain investigative leads, never an authoritative
 * organization chart; each retains evidence and collection coverage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { thunkFalse, thunkUndefined } from "@beep/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { SpeechAct } from "../../Communication.ts";
import { ActivityId, AssessmentId, EventId } from "../../Ids.ts";

const $I = $PartyDomainId.create("values/Hierarchy/Hierarchy.model");

/**
 * An event after attribution: author and recipients resolved to party
 * representatives under one projection scope. `author` is `None` when the
 * voice has no admitted author (shared mailbox, unresolved delegate).
 *
 * **Example** (Decode AttributedEvent)
 * ```ts
 * import { AttributedEvent } from "@beep/party-domain/Hierarchy"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(AttributedEvent)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class AttributedEvent extends S.Opaque<AttributedEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    event: EventId,
    author: S.OptionFromNullOr(PartyId),
    to: S.Array(PartyId),
    cc: S.Array(PartyId),
    acts: S.Array(SpeechAct),
  }).pipe($I.annoteSchema("AttributedEvent", { description: "AttributedEvent hierarchy data." }))
) {}

/**
 * Whether a party's own mailbox was collected. Operational signals about
 * uncollected parties are partly artifacts of who the producer chose to collect.
 *
 * **Example** (Decode Coverage)
 * ```ts
 * import { Coverage } from "@beep/party-domain/Hierarchy"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Coverage)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Coverage = LiteralKit(["collected-custodian", "appears-only"]).pipe(
  $I.annoteSchema("Coverage", { description: "Whether a party's mailbox was collected." })
);
/**
 * Decoded Coverage type.
 * @category models
 * @since 0.0.0
 */
export type Coverage = typeof Coverage.Type;

/**
 * A derived operational assessment.
 *
 * **Example** (Decode OperationalAssessment)
 * ```ts
 * import { OperationalAssessment } from "@beep/party-domain/Hierarchy"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(OperationalAssessment)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class OperationalAssessment extends S.Opaque<OperationalAssessment, { readonly brand: unique symbol }>()(
  S.Struct({
    id: AssessmentId,
    relation: LiteralKit(["approves-for", "escalates-to"]),
    actor: PartyId,
    counterparty: PartyId,
    supportingEvents: S.NonEmptyArray(EventId),
    producedBy: ActivityId,
    actorCoverage: Coverage,
    counterpartyCoverage: Coverage,
  }).pipe($I.annoteSchema("OperationalAssessment", { description: "Derived operational-hierarchy signal." }))
) {}

/**
 * A divergence between declared and operational hierarchy: an investigative
 * lead with its evidence, never a finding.
 *
 * **Example** (Decode InvertedAuthority)
 * ```ts
 * import { InvertedAuthority } from "@beep/party-domain/Hierarchy"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(InvertedAuthority)
 * ```
 * @category models
 * @since 0.0.0
 */
export class InvertedAuthority extends S.Opaque<InvertedAuthority, { readonly brand: unique symbol }>()(
  S.TaggedStruct("InvertedAuthority", {
    declaredSubordinate: PartyId,
    declaredSuperior: PartyId,
    evidence: S.NonEmptyArray(AssessmentId),
  }).pipe($I.annoteSchema("InvertedAuthority", { description: "InvertedAuthority data." }))
) {}
/**
 * ShadowGate payload with validated role fields.
 *
 * **Example** (Decode ShadowGate)
 * ```ts
 * import { ShadowGate } from "@beep/party-domain/Hierarchy"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ShadowGate)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ShadowGate extends S.Opaque<ShadowGate, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ShadowGate", {
    party: PartyId,
    approvesFor: S.NonEmptyArray(PartyId),
    evidence: S.NonEmptyArray(AssessmentId),
  }).pipe($I.annoteSchema("ShadowGate", { description: "ShadowGate data." }))
) {}
/**
 * PhantomManager payload with validated role fields.
 *
 * **Example** (Decode PhantomManager)
 * ```ts
 * import { PhantomManager } from "@beep/party-domain/Hierarchy"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(PhantomManager)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PhantomManager extends S.Opaque<PhantomManager, { readonly brand: unique symbol }>()(
  S.TaggedStruct("PhantomManager", {
    declaredSuperior: PartyId,
    declaredSubordinate: PartyId,
    approvedInsteadBy: S.NonEmptyArray(PartyId),
  }).pipe($I.annoteSchema("PhantomManager", { description: "PhantomManager data." }))
) {}
/**
 * CoverageGap payload with validated role fields.
 *
 * **Example** (Decode CoverageGap)
 * ```ts
 * import { CoverageGap } from "@beep/party-domain/Hierarchy"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CoverageGap)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoverageGap extends S.Opaque<CoverageGap, { readonly brand: unique symbol }>()(
  S.TaggedStruct("CoverageGap", { party: PartyId, declaredReports: S.Int }).pipe(
    $I.annoteSchema("CoverageGap", { description: "CoverageGap data." })
  )
) {}
/**
 * Divergence public schema for the hierarchy model.
 *
 * **Example** (Decode Divergence)
 * ```ts
 * import { Divergence } from "@beep/party-domain/Hierarchy"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Divergence)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Divergence = S.Union([InvertedAuthority, ShadowGate, PhantomManager, CoverageGap]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Divergence", { description: "Declared vs operational lead." })
);
/**
 * Decoded Divergence type.
 * @category models
 * @since 0.0.0
 */
export type Divergence = typeof Divergence.Type;

/**
 * Deterministic assessor: `grants-approval` authored by X to Y yields
 * `approves-for(X, Y)`; `escalates` authored by X to Y yields
 * `escalates-to(X, Y)`. Events with no admitted author contribute nothing.
 *
 * **Example** (Use assessOperational)
 * ```ts
 * import { assessOperational } from "@beep/party-domain/Hierarchy"
 * const inspect = assessOperational
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const assessOperational = ({
  events,
  producedBy,
  custodians,
}: {
  readonly events: ReadonlyArray<AttributedEvent>;
  readonly producedBy: ActivityId;
  readonly custodians: HashSet.HashSet<PartyId>;
}): ReadonlyArray<OperationalAssessment> => {
  const acc = MutableHashMap.empty<
    string,
    {
      relation: "approves-for" | "escalates-to";
      actor: PartyId;
      counterparty: PartyId;
      first: EventId;
      rest: ReadonlyArray<EventId>;
    }
  >();
  const add = (relation: "approves-for" | "escalates-to", actor: PartyId, counterparty: PartyId, event: EventId) => {
    if (actor === counterparty) return;
    const key = `${relation}|${actor}|${counterparty}`;
    O.match(MutableHashMap.get(acc, key), {
      onNone: () => MutableHashMap.set(acc, key, { relation, actor, counterparty, first: event, rest: [] }),
      onSome: (row) => {
        MutableHashMap.set(acc, key, { ...row, rest: A.append(row.rest, event) });
      },
    });
  };
  A.forEach(events, (e) =>
    O.match(e.author, {
      onNone: thunkUndefined,
      onSome: (author) => {
        if (A.contains(e.acts, "grants-approval")) A.forEach(e.to, (to) => add("approves-for", author, to, e.event));
        if (A.contains(e.acts, "escalates")) A.forEach(e.to, (to) => add("escalates-to", author, to, e.event));
      },
    })
  );
  const coverage = (p: PartyId): Coverage => (HashSet.has(custodians, p) ? "collected-custodian" : "appears-only");
  return pipe(
    acc,
    MutableHashMap.values,
    A.fromIterable,
    A.map(
      (row): OperationalAssessment =>
        OperationalAssessment.make({
          id: AssessmentId.make(`party-asmt:${row.relation}:${row.actor}->${row.counterparty}`),
          relation: row.relation,
          actor: row.actor,
          counterparty: row.counterparty,
          supportingEvents: [row.first, ...row.rest],
          producedBy,
          actorCoverage: coverage(row.actor),
          counterpartyCoverage: coverage(row.counterparty),
        })
    ),
    A.sort(Order.mapInput(Order.String, (a: OperationalAssessment) => a.id))
  );
};

/**
 * A declared reporting line, already admitted and resolved to representatives.
 *
 * **Example** (Decode DeclaredLine)
 * ```ts
 * import { DeclaredLine } from "@beep/party-domain/Hierarchy"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(DeclaredLine)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class DeclaredLine extends S.Opaque<DeclaredLine, { readonly brand: unique symbol }>()(
  S.Struct({ subordinate: PartyId, superior: PartyId }).pipe(
    $I.annoteSchema("DeclaredLine", { description: "DeclaredLine hierarchy data." })
  )
) {}

/**
 * A party-keyed directed projection with a stable id → `NodeIndex` index.
 *
 * @category models
 * @since 0.0.0
 */
export interface PartyGraph<E> {
  readonly graph: Graph.DirectedGraph<PartyId, E>;
  readonly index: HashMap.HashMap<PartyId, Graph.NodeIndex>;
}

const DeclaredRelation = S.Literal("reports-to");

const partyGraph = <E>(
  edges: ReadonlyArray<{ readonly from: PartyId; readonly to: PartyId; readonly data: E }>
): PartyGraph<E> => {
  let index = HashMap.empty<PartyId, Graph.NodeIndex>();
  const graph = Graph.directed<PartyId, E>((g) => {
    const node = (p: PartyId) =>
      O.getOrElse(HashMap.get(index, p), () => {
        const i = Graph.addNode(g, p);
        index = HashMap.set(index, p, i);
        return i;
      });
    A.forEach(edges, (e) => {
      Graph.addEdge(g, node(e.from), node(e.to), e.data);
    });
  });
  return { graph, index };
};

/**
 * Declared hierarchy projection: subordinate → superior.
 *
 * **Example** (Use declaredGraph)
 * ```ts
 * import { declaredGraph } from "@beep/party-domain/Hierarchy"
 * const inspect = declaredGraph
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const declaredGraph = (declared: ReadonlyArray<DeclaredLine>): PartyGraph<"reports-to"> =>
  partyGraph(
    A.map(declared, (l) => ({ from: l.subordinate, to: l.superior, data: DeclaredRelation.make("reports-to") }))
  );

/**
 * Operational approvals projection: approver → approved, one edge per
 * aggregated assessment (so out-degree = distinct people approved for).
 *
 * **Example** (Use approvalsGraph)
 * ```ts
 * import { approvalsGraph } from "@beep/party-domain/Hierarchy"
 * const inspect = approvalsGraph
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const approvalsGraph = (operational: ReadonlyArray<OperationalAssessment>): PartyGraph<OperationalAssessment> =>
  partyGraph(
    A.flatMap(operational, (o) =>
      o.relation === "approves-for" ? [{ from: o.actor, to: o.counterparty, data: o }] : []
    )
  );

/**
 * Join declared lines with operational assessments into divergence leads.
 *
 * **Example** (Use divergences)
 * ```ts
 * import { divergences } from "@beep/party-domain/Hierarchy"
 * const inspect = divergences
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const divergences = ({
  declared,
  operational,
  custodians,
  shadowGateMinimum,
}: {
  readonly declared: ReadonlyArray<DeclaredLine>;
  readonly operational: ReadonlyArray<OperationalAssessment>;
  readonly custodians: HashSet.HashSet<PartyId>;
  readonly shadowGateMinimum: number;
}): ReadonlyArray<Divergence> => {
  const chart = declaredGraph(declared);
  const approvals = approvalsGraph(operational);
  const approvalRows = A.filter(operational, (o) => o.relation === "approves-for");

  // approver is (transitively) below the person they approve for in the declared chart
  const isAbove = (actor: PartyId, target: PartyId) =>
    O.match(O.all([HashMap.get(chart.index, actor), HashMap.get(chart.index, target)]), {
      onNone: thunkFalse,
      onSome: ([a, t]) => Graph.hasPath(chart.graph, a, t, { direction: "outgoing" }),
    });

  const inverted = A.flatMap(approvalRows, (o) =>
    isAbove(o.actor, o.counterparty)
      ? [
          Divergence.cases.InvertedAuthority.make({
            declaredSubordinate: o.actor,
            declaredSuperior: o.counterparty,
            evidence: [o.id],
          }),
        ]
      : []
  );

  const hasReports = (p: PartyId) =>
    O.match(HashMap.get(chart.index, p), { onNone: thunkFalse, onSome: (i) => Graph.inDegree(chart.graph, i) > 0 });

  const shadow = pipe(
    approvals.index,
    HashMap.entries,
    A.fromIterable,
    A.flatMap(([actor, i]) => {
      const mine = A.filter(approvalRows, (o) => o.actor === actor);
      const targets = A.map(mine, (o) => o.counterparty);
      return Graph.outDegree(approvals.graph, i) >= shadowGateMinimum &&
        !hasReports(actor) &&
        A.isReadonlyArrayNonEmpty(targets) &&
        A.isReadonlyArrayNonEmpty(mine)
        ? [Divergence.cases.ShadowGate.make({ party: actor, approvesFor: targets, evidence: A.map(mine, (o) => o.id) })]
        : [];
    })
  );

  const phantom = A.flatMap(declared, (line) => {
    const others = A.dedupe(
      A.map(
        A.filter(approvalRows, (o) => o.counterparty === line.subordinate && o.actor !== line.superior),
        (o) => o.actor
      )
    );
    const superiorApproves = A.some(
      approvalRows,
      (o) => o.actor === line.superior && o.counterparty === line.subordinate
    );
    return !superiorApproves && A.isReadonlyArrayNonEmpty(others)
      ? [
          Divergence.cases.PhantomManager.make({
            declaredSuperior: line.superior,
            declaredSubordinate: line.subordinate,
            approvedInsteadBy: others,
          }),
        ]
      : [];
  });

  const gaps = pipe(
    chart.index,
    HashMap.entries,
    A.fromIterable,
    A.flatMap(([manager, i]) => {
      const reports = Graph.inDegree(chart.graph, i);
      return reports >= 2 && !HashSet.has(custodians, manager)
        ? [Divergence.cases.CoverageGap.make({ party: manager, declaredReports: reports })]
        : [];
    })
  );

  return [...inverted, ...shadow, ...phantom, ...gaps];
};
