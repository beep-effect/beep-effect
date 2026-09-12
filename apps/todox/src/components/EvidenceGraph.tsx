/**
 * The interactive evidence graph in the hero: seven authored nodes drawn from
 * the deterministic synthetic session. Hover previews a node's connections,
 * click, Enter, or focus selects it, and the detail panel shows the record
 * behind it. Without JS the core claim renders selected.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { $TodoxId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as A from "effect/Array";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { nav } from "@/content/copy";
import { RecordState } from "@/session/Session.schema";
import { callNoteSource, emailSource, packet, reviewPassage, supersessionPassage } from "@/session/session";
import type { KeyboardEvent } from "react";

const $I = $TodoxId.create("components/EvidenceGraph");

/**
 * One graph node: where it sits and which record it stands for.
 *
 * @category models
 * @since 0.0.0
 */
class GraphNode extends S.Class<GraphNode>($I`GraphNode`)(
  {
    id: S.String,
    kind: LiteralKit(["source", "claim", "review", "brief"]),
    label: S.String,
    labelAbove: S.Boolean,
    dim: S.Boolean,
    core: S.Boolean,
    x: S.Finite,
    y: S.Finite,
    radius: S.Finite,
    title: S.String,
    state: S.Option(RecordState),
    body: S.String,
    meta: S.String,
  },
  $I.annote("GraphNode", { description: "An authored node of the hero evidence graph." })
) {}

/**
 * One graph edge between two node ids.
 *
 * @category models
 * @since 0.0.0
 */
class GraphEdge extends S.Class<GraphEdge>($I`GraphEdge`)(
  {
    from: S.String,
    to: S.String,
    live: S.Boolean,
    path: S.String,
  },
  $I.annote("GraphEdge", { description: "A drawn connection between two graph nodes." })
) {}

const recordIn = <R extends { readonly no: string }>(records: ReadonlyArray<R>, no: string): O.Option<R> =>
  A.findFirst(records, (record) => record.no === no);

const clm0101 = O.getOrThrow(recordIn(reviewPassage.records, "CLM 0101"));
const clm0099 = O.getOrThrow(recordIn(supersessionPassage.records, "CLM 0099"));
const gate = O.getOrThrow(O.fromUndefinedOr(reviewPassage.gate));
const spanText = (source: typeof emailSource, id: string): string =>
  O.match(
    A.findFirst(source.spans, (span) => span.id === id),
    { onNone: () => "", onSome: (span) => span.text }
  );

/**
 * The authored node set, in draw order.
 *
 * @category data
 * @since 0.0.0
 */
export const graphNodes: ReadonlyArray<GraphNode> = [
  GraphNode.make({
    id: "note",
    kind: "source",
    label: "CALL NOTE",
    labelAbove: true,
    dim: true,
    core: false,
    x: 80,
    y: 88,
    radius: 14,
    title: "SRC 0000 · CALL NOTE",
    state: O.none(),
    body: spanText(callNoteSource, "S1"),
    meta: `${callNoteSource.dated} · authored synthetic source`,
  }),
  GraphNode.make({
    id: "email",
    kind: "source",
    label: "EMAIL · S2",
    labelAbove: true,
    dim: false,
    core: false,
    x: 80,
    y: 194,
    radius: 14,
    title: "SRC 0001 · EMAIL · SPAN S2",
    state: O.none(),
    body: spanText(emailSource, "S2"),
    meta: `${emailSource.from} → ${emailSource.to} · ${emailSource.dated} · fixture-verbatim`,
  }),
  GraphNode.make({
    id: "email-s3",
    kind: "source",
    label: "EMAIL · S3",
    labelAbove: false,
    dim: true,
    core: false,
    x: 80,
    y: 300,
    radius: 14,
    title: "SRC 0001 · EMAIL · SPAN S3",
    state: O.none(),
    body: spanText(emailSource, "S3"),
    meta: `${emailSource.from} → ${emailSource.to} · ${emailSource.dated} · fixture-verbatim`,
  }),
  GraphNode.make({
    id: "core",
    kind: "claim",
    label: "CLM 0101 · EVIDENCE S2",
    labelAbove: false,
    dim: false,
    core: true,
    x: 262,
    y: 190,
    radius: 18,
    title: "CLM 0101 · CLIENT CASH NEED",
    state: O.some(clm0101.state),
    body: clm0101.text,
    meta: `Evidence SRC 0001·S2 · reviewer ${clm0101.receipt.reviewer} · ${clm0101.receipt.time}`,
  }),
  GraphNode.make({
    id: "review",
    kind: "review",
    label: "REVIEWED · ACCEPTED",
    labelAbove: true,
    dim: false,
    core: false,
    x: 424,
    y: 120,
    radius: 14,
    title: `${gate.no} · REVIEW GATE`,
    state: O.some(gate.state),
    body: gate.policyBasis,
    meta: `Reviewer ${gate.reviewer} · the draft stays pending; nothing is sent`,
  }),
  GraphNode.make({
    id: "superseded",
    kind: "claim",
    label: "CLM 0099 · SUPERSEDED",
    labelAbove: false,
    dim: true,
    core: false,
    x: 424,
    y: 260,
    radius: 14,
    title: "CLM 0099 · PRIOR INTENT",
    state: O.some(clm0099.state),
    body: clm0099.text,
    meta: `Superseded by ${O.getOrElse(O.fromUndefinedOr(clm0099.supersededBy), () => "—")} on ${O.getOrElse(O.fromUndefinedOr(clm0099.supersededOn), () => "—")} · kept with its date, never deleted`,
  }),
  GraphNode.make({
    id: "brief",
    kind: "brief",
    label: "BRIEF",
    labelAbove: true,
    dim: false,
    core: false,
    x: 470,
    y: 190,
    radius: 12,
    title: `${packet.no} · MEETING BRIEF`,
    state: O.some(packet.receipt.state),
    body: "What changed, current goals and constraints, open decisions, work in your court, source-backed questions, and what was excluded.",
    meta: `For the ${packet.forCall} call · producer ${packet.receipt.producer}`,
  }),
];

/**
 * The authored edge set.
 *
 * @category data
 * @since 0.0.0
 */
export const graphEdges: ReadonlyArray<GraphEdge> = [
  GraphEdge.make({ from: "note", to: "core", live: false, path: "M96 88 C 150 88, 170 150, 230 150" }),
  GraphEdge.make({ from: "email-s3", to: "core", live: false, path: "M96 300 C 150 300, 170 230, 230 230" }),
  GraphEdge.make({ from: "email", to: "core", live: true, path: "M96 194 C 160 194, 190 190, 244 190" }),
  GraphEdge.make({ from: "core", to: "review", live: true, path: "M280 190 C 340 190, 360 120, 410 120" }),
  GraphEdge.make({ from: "core", to: "superseded", live: false, path: "M280 190 C 340 190, 360 260, 410 260" }),
  GraphEdge.make({ from: "review", to: "brief", live: true, path: "M438 120 C 460 120, 470 150, 470 178" }),
  GraphEdge.make({ from: "superseded", to: "brief", live: false, path: "M438 260 C 460 260, 470 230, 470 202" }),
];

const DEFAULT_NODE = "core";

const selectedAtom = Atom.make<O.Option<string>>(O.some(DEFAULT_NODE));
const hoveredAtom = Atom.make<O.Option<string>>(O.none());

const touches = (edge: GraphEdge, id: string): boolean => edge.from === id || edge.to === id;

/**
 * Renders the interactive evidence graph with its detail panel.
 *
 * **Example** (Render the graph)
 *
 * ```tsx
 * import { EvidenceGraph } from "@/components/EvidenceGraph"
 *
 * console.log(<EvidenceGraph />.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EvidenceGraph() {
  const selected = useAtomValue(selectedAtom);
  const setSelected = useAtomSet(selectedAtom);
  const hovered = useAtomValue(hoveredAtom);
  const setHovered = useAtomSet(hoveredAtom);
  const focus = O.orElse(hovered, () => selected);
  const current = O.flatMap(selected, (id) => A.findFirst(graphNodes, (node) => node.id === id));
  const isActiveEdge = (edge: GraphEdge): boolean => O.exists(focus, (id) => touches(edge, id));

  const onKeyDown = (id: string) => (event: KeyboardEvent<SVGGElement>) =>
    Match.value(event.key).pipe(
      Match.when("Enter", () => {
        event.preventDefault();
        setSelected(O.some(id));
      }),
      Match.when(" ", () => {
        event.preventDefault();
        setSelected(O.some(id));
      }),
      Match.orElse(() => undefined)
    );

  return (
    <div className="graph-wrap" data-evidence-graph>
      <svg
        className={`graph${O.isSome(focus) ? " graph--focused" : ""}`}
        viewBox="0 0 520 380"
        role="group"
        aria-label="Evidence graph: select a node to read the record behind it"
      >
        <defs>
          <filter id="graph-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="graph__edges">
          {graphEdges.map((edge) => (
            <path
              key={`${edge.from}-${edge.to}`}
              className={`graph__edge${edge.live ? " graph__edge--live" : ""}`}
              data-active={isActiveEdge(edge) ? "true" : undefined}
              d={edge.path}
            />
          ))}
        </g>
        <g className="graph__nodes">
          {graphNodes.map((node) => {
            const isSelected = O.exists(selected, (id) => id === node.id);
            return (
              <g
                key={node.id}
                className="graph__hit"
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={node.title}
                data-node={node.id}
                onClick={() => setSelected(O.some(node.id))}
                onKeyDown={onKeyDown(node.id)}
                onFocus={() => setSelected(O.some(node.id))}
                onMouseEnter={() => setHovered(O.some(node.id))}
                onMouseLeave={() => setHovered(O.none())}
              >
                <circle className="graph__halo" cx={node.x} cy={node.y} r={node.radius + 14} />
                <circle
                  className={`graph__node${node.core ? " graph__node--core" : ""}`}
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                />
                <text
                  className={`graph__label${node.dim ? " graph__label--dim" : ""}`}
                  x={node.x}
                  y={node.labelAbove ? node.y - node.radius - 12 : node.y + node.radius + 22}
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="graph-detail" aria-live="polite">
        {O.match(current, {
          onNone: () => <p className="graph-detail__id">SELECT A NODE</p>,
          onSome: (node) => (
            <>
              <p className="graph-detail__id">
                <strong>{node.title}</strong>
                {O.match(node.state, {
                  onNone: () => null,
                  onSome: (state) => <span className="graph-detail__state">{state}</span>,
                })}
              </p>
              <p className="graph-detail__body">{node.body}</p>
              <p className="graph-detail__meta">{node.meta}</p>
              <a className="graph-detail__link" href={nav.secondary.href}>
                Open the full session
              </a>
            </>
          ),
        })}
      </div>
    </div>
  );
}
