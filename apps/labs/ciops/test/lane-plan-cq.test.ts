// The admission golden and the lane-plan golden queried together (P2 Ruling 7). emission-cq.test.ts
// stays the admission regression. This suite loads emission-v2.ttl and lane-plan-v1.ttl into one
// graph, requires the amended CQ-020 admission rows unchanged, and runs the provisional lane-plan
// queries of contract section 8.3. Counts come from the decoded handoff fixture, never from a
// literal. Lane-plan terms are provisional ciops-prov: instrumentation, not vocabulary ratification.
//
// Two self-tests fail the suite if a check stops biting: forbidden IRIs planted in a foreign
// namespace (hash and slash forms, in subject, predicate and object position) must trip the
// forbidden-term check while look-alike decoys must not, and an admission row whose only change is
// its ?spec column must trip the all-column CQ-020 comparison.
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Oxigraph from "oxigraph";
import {
  asNode,
  bindEpisode,
  CIOPS,
  Cq020,
  copyGraph,
  Graph,
  only,
  PROV,
  prov,
  RDF_TYPE,
  render,
  renderAll,
  subjectsOf,
  xsdString,
} from "./cq-harness.ts";
import type { Node } from "./cq-harness.ts";

const PREFIXES = `PREFIX ciops: <${CIOPS}>\nPREFIX ciops-prov: <${PROV}>\n`;

// Ratified ordering cluster and rejected names: none may touch a lane-plan node (contract section 8.3).
const orderingTerms = [
  "hasCurrentProposal",
  "hasProjectionSpecification",
  "hasStep",
  "hasScopeTag",
  "stepIndex",
  "schedulesSeatRequest",
  "hasCurrentLanePlan",
  "scheduledLaneRef",
];
const orderingTypes = ["ScheduleStep", "ScheduleProposal", "VerificationLane", "AdmissionProjectionSpecification"];
const nowhereTerms = ["schedulesWorkUnit", "hasScope", "Scope"];
// Matched by local name, so a forbidden term is caught in any namespace, not only ciops: and ciops-prov:.
const nowhereLocalName = new RegExp(`[#/](?:${A.join(nowhereTerms, "|")})$`);

const HandoffLane = S.Struct({ laneId: S.String, rank: S.Finite });
const decodeHandoff = S.decodeUnknownEffect(
  S.fromJsonString(S.Struct({ orderRule: S.String, lanes: S.Array(HandoffLane) }))
);
const digestBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const byRank = Order.mapInput(Order.Number, (lane: typeof HandoffLane.Type) => lane.rank);

const PlatformLive = Layer.merge(BunFileSystem.layer, BunCrypto.layer);

/** Every named-node IRI in any triple position whose local name is forbidden, sorted. */
const forbiddenIris = (graph: Graph): ReadonlyArray<string> =>
  pipe(
    graph.quads(),
    A.flatMap((quad) => [quad.subject, quad.predicate, quad.object]),
    A.filter((term) => term.termType === "NamedNode"),
    A.map((term) => term.value),
    A.dedupe,
    A.filter((iri) => nowhereLocalName.test(iri)),
    A.sort(Order.String)
  );

const FOREIGN = "https://example.org/foreign";
const foreign = (suffix: string): Oxigraph.NamedNode => Oxigraph.namedNode(`${FOREIGN}${suffix}`);
const foreignNode = foreign("#lane");
// (planted quad, the one forbidden IRI it carries): hash and slash namespaces, every triple position.
const forbiddenTraps = [
  [Oxigraph.quad(foreignNode, foreign("#hasScope"), Oxigraph.literal("x")), `${FOREIGN}#hasScope`],
  [Oxigraph.quad(foreignNode, RDF_TYPE, foreign("/Scope")), `${FOREIGN}/Scope`],
  [Oxigraph.quad(foreign("#schedulesWorkUnit"), RDF_TYPE, foreign("#Thing")), `${FOREIGN}#schedulesWorkUnit`],
] as const;
// Look-alike names that share a forbidden local name as a prefix or suffix; none may trip the check.
const forbiddenDecoys = [
  Oxigraph.quad(foreignNode, foreign("#hasScopeTag"), Oxigraph.literal("x")),
  Oxigraph.quad(foreignNode, RDF_TYPE, foreign("#LaneScope")),
  Oxigraph.quad(foreignNode, foreign("/ScopeNote"), Oxigraph.literal("x")),
];

const lanePlanQuery = (laneEpisode: Node): string => `${PREFIXES}
SELECT ?plan ?spec ?step ?idx ?lane WHERE {
  ${render(laneEpisode)} ciops-prov:hasLanePlan ?plan .
  ?plan a ciops-prov:LanePlan ; ciops-prov:hasLanePlanSpecification ?spec ; ciops-prov:hasLaneStep ?step .
  ?spec a ciops-prov:LanePlanSpecification .
  ?step a ciops-prov:LaneStep ; ciops-prov:laneStepIndex ?idx ; ciops-prov:laneIdRef ?lane .
} ORDER BY ?idx
`;

const precedenceQuery = `${PREFIXES}
SELECT ?i ?j ?from ?to WHERE {
  ?a ciops-prov:precedesLaneStep ?b .
  ?a ciops-prov:laneStepIndex ?i ; ciops-prov:laneIdRef ?from .
  ?b ciops-prov:laneStepIndex ?j ; ciops-prov:laneIdRef ?to .
} ORDER BY ?i
`;

const readHandoff = Effect.fn("LanePlanCqTest.readHandoff")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile("test/fixtures/gate-order-handoff-v1.json");
  const handoff = yield* decodeHandoff(new TextDecoder().decode(bytes));
  const sha256 = yield* digestBytes(bytes);
  return { handoff, sha256 };
});

it.layer(PlatformLive, { timeout: "30 seconds" })("@beep/ciops lane-plan CQ", (it) => {
  it.effect("keeps CQ-020 admission rows unchanged and orders the lane plan by handoff rank", () =>
    Effect.gen(function* () {
      const graph = yield* Graph.load(["emission-v2.ttl", "lane-plan-v1.ttl"]);
      const admissionGraph = yield* Graph.load(["emission-v2.ttl"]);
      const cq020 = yield* Cq020.load();
      const { handoff, sha256 } = yield* readHandoff();

      const rankedLanes = pipe(
        handoff.lanes,
        A.sort(byRank),
        A.map((lane) => lane.laneId)
      );
      const laneCount = A.length(rankedLanes);
      expect(A.length(A.dedupe(rankedLanes)), "Fixture lane ids must be unique").toBe(laneCount);

      // 1. Amended CQ-020: the admission rows are unchanged, and the lane-plan episode answers nothing.
      const episodes = subjectsOf(graph, prov("VerificationEpisode"));
      expect(A.length(episodes), "One admission episode and one lane-plan episode").toBe(2);
      const anchors = (predicate: string) =>
        A.filter(episodes, (episode) => A.isReadonlyArrayNonEmpty(graph.objects(episode, prov(predicate))));
      const admissionEpisode = only(anchors("hasCurrentProposal"));
      const laneEpisode = only(anchors("hasLanePlan"));
      expect(admissionEpisode.equals(laneEpisode), "Lane-plan and admission episode nodes must be disjoint").toBe(
        false
      );
      expect(graph.objects(admissionEpisode, prov("hasLanePlan"))).toStrictEqual([]);
      expect(graph.objects(laneEpisode, prov("hasCurrentProposal"))).toStrictEqual([]);

      const rows = graph.select(bindEpisode(cq020, admissionEpisode));
      expect(A.length(rows), "CQ-020 must return the two admitted requests, excluding the tail").toBe(2);
      expect(A.map(rows, (row) => row.integer("idx"))).toStrictEqual([0, 1]);
      A.forEach(rows, (row) => expect(row.render("scope")).toBe(render(xsdString("admission"))));
      expect(A.map(rows, (row) => renderAll(graph.objects(row.node("req"), prov("scheduledUnitRef"))))).toStrictEqual([
        [render(xsdString("admitted-a"))],
        [render(xsdString("admitted-b"))],
      ]);
      expect(graph.select(bindEpisode(cq020, laneEpisode)), "Lane steps are never CQ-020 rows").toStrictEqual([]);

      // Every bound column, not only idx/scope/unitRef: adding the lane plan changes no admission row.
      const admissionTable = (target: Graph) =>
        A.map(target.select(bindEpisode(cq020, admissionEpisode)), (row) => row.columns());
      const combinedTable = admissionTable(graph);
      expect(combinedTable, "CQ-020 admission rows must equal the admission-only store's").toStrictEqual(
        admissionTable(admissionGraph)
      );
      expect(
        A.map(
          combinedTable,
          A.map(([name]) => name)
        )
      ).toStrictEqual(A.replicate(["proposal", "spec", "step", "idx", "req", "scope"], 2));

      // 2. Provisional lane steps: one per fixture lane, in rank order, under a typed plan and specification.
      const stepRows = graph.select(lanePlanQuery(laneEpisode));
      expect(A.length(stepRows), "Lane-step count must equal the fixture lane count").toBe(laneCount);
      expect(A.map(stepRows, (row) => row.integer("idx"))).toStrictEqual(A.makeBy(laneCount, (index) => index));
      expect(
        A.map(stepRows, (row) => row.value("lane")),
        "Lane steps must follow the handoff rank order"
      ).toStrictEqual(rankedLanes);
      const plan = only(A.dedupe(A.map(stepRows, (row) => row.render("plan"))));
      const specRendered = only(A.dedupe(A.map(stepRows, (row) => row.render("spec"))));
      const firstStep = O.getOrThrow(A.head(stepRows));
      const specification = firstStep.node("spec");
      expect([render(firstStep.node("plan")), render(specification)]).toStrictEqual([plan, specRendered]);
      expect(renderAll(graph.objects(specification, prov("handoffDigest")))).toStrictEqual([render(xsdString(sha256))]);
      expect(renderAll(graph.objects(specification, prov("laneOrderRule")))).toStrictEqual([
        render(xsdString(handoff.orderRule)),
      ]);

      // 3. The consecutive precedence chain: count - 1 edges, each from index i to i + 1, in rank order.
      const edges = graph.select(precedenceQuery);
      expect(A.length(edges), "The precedence chain must carry count - 1 edges").toBe(laneCount - 1);
      expect(A.map(edges, (edge) => [edge.integer("i"), edge.integer("j")])).toStrictEqual(
        A.makeBy(laneCount - 1, (index) => [index, index + 1])
      );
      expect(A.map(edges, (edge) => [edge.value("from"), edge.value("to")])).toStrictEqual(
        A.zip(rankedLanes, A.drop(rankedLanes, 1))
      );

      // 4. No ratified ordering term or typing on any lane-plan node, in either namespace.
      const laneNodes = A.dedupeWith(
        [laneEpisode, firstStep.node("plan"), specification, ...A.map(stepRows, (row) => row.node("step"))],
        (left, right) => left.equals(right)
      );
      expect(A.length(laneNodes)).toBe(laneCount + 3);
      A.forEach(laneNodes, (node) =>
        A.forEach([CIOPS, PROV], (namespace) => {
          A.forEach(orderingTerms, (term) => {
            const predicate = Oxigraph.namedNode(namespace + term);
            expect(graph.match(node, predicate, null), `${render(node)} carries ${term}`).toStrictEqual([]);
            expect(graph.match(null, predicate, node), `${render(node)} is the object of ${term}`).toStrictEqual([]);
          });
          A.forEach(orderingTypes, (type) =>
            expect(
              graph.match(node, RDF_TYPE, Oxigraph.namedNode(namespace + type)),
              `${render(node)} is typed ${type}`
            ).toStrictEqual([])
          );
        })
      );
      expect(
        A.filter(
          graph.quads(),
          (quad) =>
            Str.startsWith(CIOPS)(quad.predicate.value) && A.some(laneNodes, (node) => node.equals(quad.subject))
        )
      ).toStrictEqual([]);

      // 5. schedulesWorkUnit, hasScope and Scope appear nowhere, in any position or namespace.
      expect(forbiddenIris(graph), "Forbidden terms emitted").toStrictEqual([]);

      // 6a. Self-test: planted forbidden IRIs are each reported alone; look-alike decoys pass.
      expect(forbiddenIris(copyGraph(graph, forbiddenDecoys))).toStrictEqual([]);
      A.forEach(forbiddenTraps, ([trap, plantedIri]) =>
        expect(forbiddenIris(copyGraph(graph, [trap])), `Self-test: ${plantedIri} not reported alone`).toStrictEqual([
          plantedIri,
        ])
      );

      // 6b. Self-test: re-point the admission proposal at a renamed specification, so only ?spec changes.
      const keyColumns = (target: Graph) =>
        A.map(target.select(bindEpisode(cq020, admissionEpisode)), (row) => [
          row.render("idx"),
          row.render("scope"),
          renderAll(target.objects(row.node("req"), prov("scheduledUnitRef"))),
        ]);
      const proposal = asNode(only(graph.objects(admissionEpisode, prov("hasCurrentProposal"))));
      const specQuad = only(graph.match(proposal, prov("hasProjectionSpecification"), null));
      const renamed = Oxigraph.namedNode(`${specQuad.object.value}-self-test`);
      const probe = copyGraph(graph, [
        Oxigraph.quad(proposal, prov("hasProjectionSpecification"), renamed),
        Oxigraph.quad(renamed, RDF_TYPE, prov("AdmissionProjectionSpecification")),
      ]);
      probe.store.delete(specQuad);
      expect(
        keyColumns(probe),
        "Self-test: the renamed specification must leave idx, scope and unitRef unchanged"
      ).toStrictEqual(keyColumns(admissionGraph));
      expect(
        admissionTable(probe),
        "Self-test: a ?spec-only change must fail the all-column comparison"
      ).not.toStrictEqual(admissionTable(admissionGraph));
    })
  );
});
