import { MemoryFileSystem } from "@beep/memfs";
import { N3ParseTurtleRequest, N3TurtleCodec, N3TurtleCodecLive } from "@beep/n3";
import { toTurtle } from "@beep/ontology";
import * as Rdf from "@beep/rdf/Rdf";
import { LibraryCaptureStatus, LibraryCatalog } from "@beep/repo-cli/commands/Research";
import {
  assembleLibraryOntology,
  libraryShapes,
  libraryShapesDataset,
  libraryShapesTurtle,
  renderLibraryOntology,
} from "@beep/repo-cli/commands/Research/Library/Library.ontology";
import {
  catalogDataset,
  LibraryTopic,
  libraryTopics,
} from "@beep/repo-cli/commands/Research/Library/Library.projection";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const SUnknownJson = S.fromJsonString(S.Unknown);
const LibraryCatalogJson = S.fromJsonString(LibraryCatalog);

const artifact = { path: "objects/a", sha256: Str.repeat(64)("a"), bytes: 3, mediaType: "text/plain", role: "content" };
const source = {
  id: "s1",
  aliasIds: ["legacy-s1"],
  kind: "web",
  canonicalUrl: "https://example.test",
  identity: "example",
  revision: "v1",
  repository: "",
  ownership: "external",
  locators: ["https://example.test"],
  versions: [{ revision: "v1", canonicalUrl: "https://example.test", locators: ["https://example.test"] }],
};
const document = {
  id: "r1",
  originalPath: "a.md",
  snapshotPath: "intakes/a.md",
  sha256: Str.repeat(64)("b"),
  bytes: 1,
  title: "Report",
  reportDate: "2026-11-06",
  expectedOccurrences: 1,
};
const occurrence = {
  id: "o1",
  documentId: "r1",
  sourceId: "legacy-s1",
  locator: "https://example.test",
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 2,
  label: "Example",
  form: "inline",
};
const fixture = {
  schema: "beep.research.library/v2",
  documents: [document, { ...document, id: "r2", sha256: Str.repeat(64)("c") }],
  sources: [source, { ...source, id: "s2", identity: "second", aliasIds: [] }],
  occurrences: [occurrence],
  captures: [
    {
      id: "c1",
      sourceId: "s1",
      status: "readable",
      method: "fixture",
      recordedAt: "2026-11-06",
      capturedRevision: "v1",
      complete: true,
      artifacts: [artifact],
      reason: "",
    },
  ],
  artifacts: [artifact],
  qualifications: [
    {
      id: "q1",
      adapter: "fixture",
      status: "verified",
      required: true,
      recordedAt: "2026-11-06",
      evidence: [artifact],
      reason: "",
    },
  ],
  findings: [
    {
      id: "f1",
      sourceId: "s1",
      occurrenceId: "o1",
      modelRunId: "m1",
      citoRelation: "citesAsEvidence",
      summary: "A claim",
      recordedAt: "2026-11-06",
      topicIds: ["example"],
    },
  ],
  derivations: [
    { id: "d1", sourceId: "s1", derivedId: "f1", intakeId: "i1", rootId: "r1", hopDepth: 1, recordedAt: "2026-11-06" },
    { id: "d2", sourceId: "s1", derivedId: "f1", intakeId: "s1", rootId: "r1", hopDepth: 1, recordedAt: "2026-11-06" },
  ],
  modelRuns: [{ id: "m1", model: "fixture", effort: "medium", route: "local", startedAt: "2026-11-06" }],
  intakes: [
    {
      id: "i1",
      date: "2026-11-06",
      createdAt: "2026-11-06",
      repoCommit: "abc",
      manifestPath: "intakes/i1.json",
      inputRoots: [{ path: "input", repoCommit: "abc" }],
      files: [
        { originalPath: "a.md", snapshotPath: "intakes/a.md", sha256: Str.repeat(64)("b"), bytes: 1, parseable: true },
      ],
    },
  ],
};
describe("research library ontology", () => {
  it.layer(Layer.mergeAll(N3TurtleCodecLive, ShaclValidationServiceLive, MemoryFileSystem.layer, Path.layer), {
    timeout: "30 seconds",
  })("generated contracts", (it) => {
    it.effect(
      "parses audited classes and alignments and renders deterministic shapes including status membership",
      Effect.fnUntraced(function* () {
        const assembled = yield* assembleLibraryOntology();
        const codec = yield* N3TurtleCodec;
        const parsed = yield* codec.parse(N3ParseTurtleRequest.make({ source: toTurtle(assembled) }));
        expect(parsed.dataset.quads.length).toBeGreaterThan(50);
        const cls = (name: string) => O.getOrThrow(A.findFirst(assembled.classes, (c) => c.name === name));
        const subclass = (name: string, target: string) =>
          A.some(
            parsed.dataset.quads,
            (q) =>
              q.subject.value === cls(name).iri &&
              q.predicate.value === "http://www.w3.org/2000/01/rdf-schema#subClassOf" &&
              q.object.value === target
          );
        expect(subclass("ModelRun", "http://www.w3.org/ns/prov#Activity")).toBe(true);
        expect(subclass("Occurrence", "http://purl.org/spar/cito/Citation")).toBe(true);
        expect(subclass("SourceVersion", cls("Source").iri)).toBe(false);
        for (const status of LibraryCaptureStatus.literals) {
          expect(
            A.some(
              parsed.dataset.quads,
              (q) =>
                Str.endsWith(`/${status}`)(q.subject.value) && q.object.value === "http://www.w3.org/2002/07/owl#Class"
            )
          ).toBe(false);
        }
        const shapes = libraryShapes(assembled);
        const first = yield* libraryShapesTurtle(shapes);
        const again = yield* assembleLibraryOntology();
        const second = yield* libraryShapesTurtle(libraryShapes(again));
        expect(second).toBe(first);
        expect(toTurtle(again)).toBe(toTurtle(assembled));
        const turtle = yield* codec.parse(N3ParseTurtleRequest.make({ source: first }));
        const capture = O.getOrThrow(
          A.findFirst(
            shapes,
            (shape) => O.isSome(shape.targetClass) && shape.targetClass.value.value === cls("Capture").iri
          )
        );
        const property = O.getOrThrow(A.findFirst(capture.properties, (p) => Str.endsWith("/status")(p.path.value)));
        const pathQuad = O.getOrThrow(
          A.findFirst(
            turtle.dataset.quads,
            (q) => q.predicate.value === "http://www.w3.org/ns/shacl#path" && q.object.value === property.path.value
          )
        );
        expect(
          A.some(
            turtle.dataset.quads,
            (q) => q.subject.value === pathQuad.subject.value && q.predicate.value === "http://www.w3.org/ns/shacl#in"
          )
        ).toBe(true);
      })
    );
    it.effect(
      "validates rich and v1 catalogs and rejects missing required values and invalid status",
      Effect.fnUntraced(function* () {
        const catalog = yield* S.decodeUnknownEffect(LibraryCatalog)(fixture);
        const ontology = yield* assembleLibraryOntology();
        const shapes = libraryShapes(ontology);
        const validator = yield* ShaclValidationService;
        const dataset = yield* catalogDataset(
          catalog,
          [LibraryTopic.make({ id: "goals/example", initiativeId: "example", title: "Example" })],
          HashMap.make(["s1", "readable"], ["s1@v1", "readable"])
        );
        const validate = (dataset: Rdf.Dataset) =>
          validator.validate(
            ShaclValidationRequest.make({
              dataset,
              shapes,
              shapesDataset: O.some(libraryShapesDataset(shapes)),
            })
          );
        const result = yield* validate(dataset);
        expect(result.violations).toEqual([]);
        expect(result.conforms).toBe(true);
        expect(
          A.some(
            dataset.quads,
            (q) =>
              q.predicate.value === "http://www.w3.org/2004/02/skos/core#related" &&
              Str.endsWith("/Topic/goals/example")(q.object.value)
          )
        ).toBe(true);
        expect(
          A.some(
            dataset.quads,
            (q) =>
              Str.endsWith("/intakeId")(q.predicate.value) && q.object.termType === "Literal" && q.object.value === "s1"
          )
        ).toBe(true);
        expect(
          A.some(
            dataset.quads,
            (q) =>
              Str.endsWith("/Occurrence/o1")(q.subject.value) &&
              Str.endsWith("/sourceId")(q.predicate.value) &&
              Str.endsWith("/Source/s1")(q.object.value)
          )
        ).toBe(true);
        const missing = yield* validate(
          Rdf.makeDataset(A.filter(dataset.quads, (q) => !Str.endsWith("/summary")(q.predicate.value)))
        );
        expect(missing.conforms).toBe(false);
        expect(missing.violations.length).toBeGreaterThan(0);
        const invalid = yield* validate(
          Rdf.makeDataset(
            A.map(dataset.quads, (q) =>
              Str.endsWith("/status")(q.predicate.value)
                ? Rdf.makeQuad(
                    q.subject,
                    q.predicate,
                    Rdf.makeLiteral("not-a-status", "http://www.w3.org/2001/XMLSchema#string")
                  )
                : q
            )
          )
        );
        expect(invalid.conforms).toBe(false);
        expect(invalid.violations.length).toBeGreaterThan(0);
        const json = yield* S.encodeEffect(SUnknownJson)({
          schema: "beep.research.library/v1",
          documents: [document],
          sources: [source],
          captures: [],
          occurrences: [occurrence],
          qualifications: [],
        });
        const legacy = yield* S.decodeEffect(LibraryCatalogJson)(json);
        const legacyDataset = yield* catalogDataset(legacy);
        const legacyResult = yield* validate(legacyDataset);
        expect(legacyResult.violations).toEqual([]);
        expect(legacyResult.conforms).toBe(true);
        expect(
          A.some(
            dataset.quads,
            (q) =>
              q.predicate.value === "http://www.w3.org/ns/prov#specializationOf" &&
              Str.endsWith("/Source/s1")(q.object.value)
          )
        ).toBe(true);
        expect(
          A.some(
            dataset.quads,
            (q) =>
              Str.endsWith("/intakeId")(q.predicate.value) &&
              q.object.termType === "NamedNode" &&
              Str.endsWith("/Intake/i1")(q.object.value)
          )
        ).toBe(true);
      })
    );
    it.effect(
      "publishes byte-identical files and reads minimal packet manifests",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "library-ontology-" });
        const first = yield* renderLibraryOntology(root);
        expect(first.tboxCount).toBeGreaterThan(0);
        expect(first.shapesCount).toBeGreaterThan(0);
        const tboxPath = path.join(root, "ontology/research-library.ttl");
        const shapesPath = path.join(root, "ontology/research-library.shacl.ttl");
        const tbox = yield* fs.readFileString(tboxPath);
        const shapes = yield* fs.readFileString(shapesPath);
        yield* renderLibraryOntology(root);
        const nextTbox = yield* fs.readFileString(tboxPath);
        const nextShapes = yield* fs.readFileString(shapesPath);
        expect(nextTbox).toBe(tbox);
        expect(nextShapes).toBe(shapes);
        for (const kind of ["goals", "explorations"]) {
          const dir = path.join(root, kind, "example", "ops");
          yield* fs.makeDirectory(dir, { recursive: true });
          const json = yield* S.encodeEffect(SUnknownJson)({
            initiative: { id: "example", title: "Example" },
            ignored: "extra metadata",
          });
          yield* fs.writeFileString(path.join(dir, "manifest.json"), json);
        }
        yield* fs.makeDirectory(path.join(root, "goals/broken"), { recursive: true });
        const topics = yield* libraryTopics(root);
        expect(A.map(topics, (topic) => topic.id)).toEqual(["goals/example", "explorations/example"]);
      })
    );
  });
});
