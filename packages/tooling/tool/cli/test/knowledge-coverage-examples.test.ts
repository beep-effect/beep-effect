import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownFence } from "@beep/markdown/MarkdownFence";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import * as Rdf from "@beep/rdf/Rdf";
import { findRepoRoot } from "@beep/repo-utils";
import { SparqlQueryRequest, SparqlQueryService, SparqlSelectResult } from "@beep/semantic-web/services/sparql-query";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";

const isSelect = S.is(SparqlSelectResult);

const a = Rdf.makeNamedNode("https://example.test/a");
const b = Rdf.makeNamedNode("https://example.test/b");
const blank = Rdf.makeBlankNode("excluded");
const rdfType = Rdf.makeNamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const owlClass = Rdf.makeNamedNode("http://www.w3.org/2002/07/owl#Class");
const label = Rdf.makeNamedNode("http://www.w3.org/2000/01/rdf-schema#label");
const definition = Rdf.makeNamedNode("http://www.w3.org/2004/02/skos/core#definition");
const oboDefinition = Rdf.makeNamedNode("http://purl.obolibrary.org/obo/IAO_0000115");
const english = Rdf.makeLiteral("One", "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString", { language: "en" });
const french = Rdf.makeLiteral("Un", "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString", { language: "fr" });
const classes = [Rdf.makeQuad(a, rdfType, owlClass), Rdf.makeQuad(b, rdfType, owlClass)];
const oneCovered = [Rdf.makeQuad(a, label, english), Rdf.makeQuad(a, definition, english)];
const cases = [
  {
    name: "several values for one class",
    dataset: Rdf.makeDataset([
      ...classes,
      ...oneCovered,
      Rdf.makeQuad(a, label, french),
      Rdf.makeQuad(a, definition, french),
    ]),
    total: "2",
    covered: "1",
  },
  {
    name: "one value shared by different classes",
    dataset: Rdf.makeDataset([
      ...classes,
      ...oneCovered,
      Rdf.makeQuad(b, label, english),
      Rdf.makeQuad(b, definition, english),
    ]),
    total: "2",
    covered: "2",
  },
  { name: "no covered classes", dataset: Rdf.makeDataset(classes), total: "2", covered: "0" },
  {
    name: "both accepted definition properties",
    dataset: Rdf.makeDataset([...classes, ...oneCovered, Rdf.makeQuad(a, oboDefinition, english)]),
    total: "2",
    covered: "1",
  },
  {
    name: "blank-node classes remain excluded",
    dataset: Rdf.makeDataset([
      ...classes,
      ...oneCovered,
      Rdf.makeQuad(blank, rdfType, owlClass),
      Rdf.makeQuad(blank, label, english),
      Rdf.makeQuad(blank, definition, english),
    ]),
    total: "2",
    covered: "1",
  },
  { name: "empty dataset", dataset: Rdf.makeDataset([]), total: "0", covered: "0" },
];

it.layer(Layer.mergeAll(BunServices.layer, OxigraphSparqlQueryServiceLive))("Documented class coverage", (it) => {
  A.forEach(cases, (testCase) => {
    it.effect(
      testCase.name,
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const sourcePath = ".claude/skills/_shared/quality-checklist.md";
        const markdown = yield* fs.readFileString(path.join(repoRoot, sourcePath));
        const document = yield* MarkdownDocument.parse(markdown);
        const fences = A.filter(MarkdownFence.fences(document), (fence) => Str.includes("AS ?total")(fence.value));
        expect(fences).toHaveLength(2);
        const sparql = yield* SparqlQueryService;
        yield* Effect.forEach(
          [
            { field: "labeled", selector: "AS ?labeled" },
            { field: "defined", selector: "AS ?defined" },
          ],
          Effect.fnUntraced(function* (target) {
            const matches = A.filter(fences, (fence) => Str.includes(target.selector)(fence.value));
            expect(matches).toHaveLength(1);
            const fence = A.getUnsafe(matches, 0);
            const result = yield* sparql.execute(
              SparqlQueryRequest.make({
                dataset: testCase.dataset,
                profile: "select",
                query: fence.value,
              })
            );
            assertTrue(isSelect(result));
            const selected = result;
            expect(selected.rows, `${sourcePath}:${fence.line}`).toHaveLength(1);
            const row = A.getUnsafe(selected.rows, 0);
            assertSome(pipe(R.get(row, "total"), O.map(Struct.get("value"))), testCase.total);
            assertSome(pipe(R.get(row, target.field), O.map(Struct.get("value"))), testCase.covered);
          }),
          { discard: true, concurrency: 1 }
        );
      })
    );
  });
});
