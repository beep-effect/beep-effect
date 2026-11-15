// Amended CQ-020 over the runtime-verified emission v2 golden (the projection tests compare this
// fixture with current emission). Namespace adaptation is provisional instrumentation, not
// vocabulary ratification.
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Oxigraph from "oxigraph";
import {
  asNode,
  bindEpisode,
  CIOPS,
  Cq020,
  Graph,
  only,
  prov,
  RDF_TYPE,
  render,
  renderAll,
  subjectsOf,
  xsdString,
} from "./cq-harness.ts";

const cq020Columns = ["proposal", "spec", "step", "idx", "req", "scope"] as const;

it.layer(BunFileSystem.layer, { timeout: "30 seconds" })("@beep/ciops emission v2 CQ-020", (it) => {
  it.effect("returns the two ordered admitted rows and keeps the deferred tail step-less", () =>
    Effect.gen(function* () {
      const graph = yield* Graph.load(["emission-v2.ttl"]);
      const cq020 = yield* Cq020.load();
      const episode = only(subjectsOf(graph, prov("VerificationEpisode")));
      const query = bindEpisode(cq020, episode);

      const rows = graph.select(query);
      expect(A.length(rows), "CQ-020 must return the two admitted requests, excluding the tail").toBe(2);
      expect(A.map(rows, (row) => row.integer("idx"))).toStrictEqual([0, 1]);
      A.forEach(rows, (row) => A.forEach(cq020Columns, (name) => expect(row.has(name), `?${name} bound`).toBe(true)));
      A.forEach(rows, (row) => expect(row.render("scope")).toBe(render(xsdString("admission"))));
      expect(A.map(rows, (row) => renderAll(graph.objects(row.node("req"), prov("scheduledUnitRef"))))).toStrictEqual([
        [render(xsdString("admitted-a"))],
        [render(xsdString("admitted-b"))],
      ]);

      const first = O.getOrThrow(A.head(rows));
      const proposal = first.node("proposal");
      const specification = first.node("spec");
      expect(renderAll(graph.objects(episode, prov("hasCurrentProposal")))).toStrictEqual([render(proposal)]);
      expect(renderAll(graph.objects(proposal, prov("hasProjectionSpecification")))).toStrictEqual([
        render(specification),
      ]);
      expect(A.length(subjectsOf(graph, prov("AdmissionProjectionSpecification")))).toBe(1);
      expect(renderAll(graph.objects(specification, prov("policyDigest")))).toStrictEqual([
        render(xsdString("policy-digest")),
      ]);
      expect(renderAll(graph.objects(specification, prov("journalPrefixDigest")))).toStrictEqual([
        render(xsdString("journal-prefix-digest")),
      ]);

      const tail = asNode(only(graph.objects(proposal, prov("defersSeatRequest"))));
      expect(renderAll(graph.objects(tail, prov("scheduledUnitRef")))).toStrictEqual([render(xsdString("deferred-c"))]);
      expect(renderAll(graph.objects(tail, RDF_TYPE))).toStrictEqual([
        render(Oxigraph.namedNode(`${CIOPS}SeatRequest`)),
      ]);
      expect(graph.match(null, prov("schedulesSeatRequest"), tail)).toStrictEqual([]);
      expect(A.length(graph.match(null, prov("scheduledUnitRef"), null))).toBe(3);
      expect(graph.match(null, prov("hasScope"), null)).toStrictEqual([]);

      // A missing specification edge or type must prevent a superficially ordered graph from
      // passing the amended query. Check both joins independently.
      const joins = [
        Oxigraph.quad(proposal, prov("hasProjectionSpecification"), specification),
        Oxigraph.quad(specification, RDF_TYPE, prov("AdmissionProjectionSpecification")),
      ];
      A.forEach(joins, (join) => {
        expect(graph.store.has(join)).toBe(true);
        graph.store.delete(join);
        expect(graph.select(query), "Missing specification evidence must break the CQ join").toStrictEqual([]);
        graph.store.add(join);
      });
      expect(A.length(graph.select(query))).toBe(2);
    })
  );
});
