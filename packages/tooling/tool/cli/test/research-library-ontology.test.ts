import { fcRuns } from "@beep/fc-runs";
import * as Registry from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { MemoryFileSystem } from "@beep/memfs";
import { N3ParseTurtleRequest, N3TurtleCodec, N3TurtleCodecLive } from "@beep/n3";
import { toTurtle } from "@beep/ontology";
import * as Rdf from "@beep/rdf/Rdf";
import {
  LibraryAgentLabel,
  LibraryCaptureStatus,
  LibraryCatalog,
  LibraryMineProfile,
  LibrarySynthesisAuthor,
  LibraryTopicId,
  LibraryVidbeeBinding,
  libraryAgentIri,
  libraryMineProfile,
  libraryTopicIri,
} from "@beep/repo-cli/commands/Research";
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
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
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
    // A recorded hop-1 edge: its parent is the hop-0 report, not a source.
    { id: "d3", sourceId: "r1", derivedId: "s1", intakeId: "i1", rootId: "r1", hopDepth: 1, recordedAt: "2026-11-06" },
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
const decodeCatalog = S.decodeUnknownResult(LibraryCatalog);
const isTopicId = S.is(LibraryTopicId);
const isAgentLabel = S.is(LibraryAgentLabel);

describe("research library instance keys", () => {
  it("accepts exactly the topic keys that form an IRI, and mints them byte for byte", () => {
    const minted = A.map(["goals/example", "example", "goals/_template", "a//b", "é", "a:b", ".."], (id) => [
      isTopicId(id),
      libraryTopicIri(id),
    ]);
    const base = "https://beep-effect.com/ns/research-library/Topic/";
    expect(minted).toStrictEqual([
      [true, `${base}goals/example`],
      [true, `${base}example`],
      [true, `${base}goals/_template`],
      [true, `${base}a//b`],
      [true, `${base}é`],
      [true, `${base}a:b`],
      [true, `${base}..`],
    ]);
    const refused = [
      "",
      " ",
      "goals/an example",
      "/goals/example",
      "goals/example/",
      "<slug>",
      "a%zz",
      "\ud800",
      "a\u200eb",
    ];
    expect(A.filter(refused, isTopicId)).toStrictEqual([]);
  });

  it("accepts every agent label but the empty one and text with no UTF-8 form", () => {
    const base = "https://beep-effect.com/ns/research-library/SoftwareAgent/";
    const agents: ReadonlyArray<readonly [model: string, effort: string, iri: string]> = [
      ["gpt-6.1-sol", "unrecorded", `${base}gpt-6.1-sol/unrecorded`],
      ["/vendor/model/", "very high", `${base}%2Fvendor%2Fmodel%2F/very%20high`],
      ["<model>", " ", `${base}%3Cmodel%3E/%20`],
    ];
    for (const [model, effort, iri] of agents) {
      expect([isAgentLabel(model), isAgentLabel(effort), libraryAgentIri({ model, effort })]).toStrictEqual([
        true,
        true,
        iri,
      ]);
    }
    expect(A.filter(["", "\ud800", "a\udfff"], isAgentLabel)).toStrictEqual([]);
  });

  it("refuses a catalog whose model run or finding topic forms no IRI, naming the field", () => {
    const [run] = fixture.modelRuns;
    const [finding] = fixture.findings;
    const refusals = A.map(
      [
        { ...fixture, modelRuns: [{ ...run, model: "" }] },
        { ...fixture, modelRuns: [{ ...run, effort: "" }] },
        { ...fixture, modelRuns: [{ ...run, model: "\ud800" }] },
        { ...fixture, findings: [{ ...finding, topicIds: [""] }] },
        { ...fixture, findings: [{ ...finding, topicIds: ["goals/an example"] }] },
      ],
      (catalog) => Result.match(decodeCatalog(catalog), { onFailure: (error) => error.message, onSuccess: () => "" })
    );
    expect(refusals).toStrictEqual([
      expect.stringContaining('["modelRuns"][0]["model"]'),
      expect.stringContaining('["modelRuns"][0]["effort"]'),
      expect.stringContaining('["modelRuns"][0]["model"]'),
      expect.stringContaining('["findings"][0]["topicIds"][0]'),
      expect.stringContaining('["findings"][0]["topicIds"][0]'),
    ]);
  });

  it.each<readonly [name: string, accepts: (value: unknown) => Result.Result<unknown, S.SchemaError>, value: object]>([
    [
      "LibrarySynthesisAuthor",
      S.decodeUnknownResult(LibrarySynthesisAuthor),
      { model: "claude-fable-5-1", effort: "medium", route: "claude-code", argv: [] },
    ],
    [
      "LibraryVidbeeBinding",
      S.decodeUnknownResult(LibraryVidbeeBinding),
      {
        sourceUrl: "https://example.test/video",
        mediaPath: "media/video.mp4",
        mediaSha256: Str.repeat(64)("a"),
        mediaBytes: 3,
        transcriptSha256: Str.repeat(64)("b"),
        faqSha256: Str.repeat(64)("c"),
        model: "gpt-6.1-sol",
        effort: "unrecorded",
        generatedAt: "2026-11-21T00:00:00Z",
      },
    ],
    ["LibraryMineProfile", S.decodeUnknownResult(LibraryMineProfile), libraryMineProfile("codex-luna")],
  ])("%s decodes only labels that name an agent, and names the field it refuses", (_name, decode, value) => {
    const refusal = (fields: object) =>
      Result.match(decode({ ...value, ...fields }), {
        onFailure: (error) => error.message,
        onSuccess: () => "",
      });

    expect(refusal({})).toBe("");
    expect(refusal({ model: "" })).toContain('["model"]');
    expect(refusal({ model: "\ud800" })).toContain('["model"]');
    expect(refusal({ effort: "" })).toContain('["effort"]');
    expect(refusal({ effort: "\ud800" })).toContain('["effort"]');
  });

  it.effect.prop(
    "projects every catalog that decodes, whatever its run labels and topic keys",
    [S.String, S.String, S.String],
    ([model, effort, topicId]) =>
      Result.match(
        decodeCatalog({
          ...fixture,
          modelRuns: A.map(fixture.modelRuns, (run) => ({ ...run, model, effort })),
          findings: A.map(fixture.findings, (finding) => ({ ...finding, topicIds: [topicId] })),
        }),
        {
          onFailure: () =>
            Effect.sync(() => expect(isAgentLabel(model) && isAgentLabel(effort) && isTopicId(topicId)).toBe(false)),
          onSuccess: (catalog) =>
            Effect.map(catalogDataset(catalog), (dataset) =>
              expect(A.some(dataset.quads, (quad) => quad.object.value === libraryAgentIri({ model, effort }))).toBe(
                true
              )
            ),
        }
      ),
    { arbitrary: fcRuns(25) }
  );
});

describe("research library ontology", () => {
  it.layer(Layer.mergeAll(N3TurtleCodecLive, ShaclValidationServiceLive, MemoryFileSystem.layer, Path.layer), {
    timeout: "30 seconds",
  })("generated contracts", (it) => {
    it.effect(
      "publishes every class and owned property under the research-library registry namespace",
      Effect.fnUntraced(function* () {
        const assembled = yield* assembleLibraryOntology();
        const namespace = Registry.namespace("research-library");
        expect(assembled.baseIri).toBe("https://beep-effect.com/ns/research-library/");
        expect(assembled.prefix).toBe(namespace.prefix);
        expect(A.map(assembled.classes, (cls) => cls.curie)).toStrictEqual(
          A.map(assembled.classes, (cls) => `research-library:${cls.name}`)
        );
        const owned = A.flatMap(assembled.classes, (cls) =>
          A.filter(cls.predicates, (predicate) => Str.startsWith(namespace.iri)(predicate.termIri))
        );
        expect(owned.length).toBeGreaterThan(0);
        for (const predicate of owned) {
          assertSome(Registry.contract(predicate.termIri), `research-library:${predicate.key}`);
          assertSome(
            Registry.replacementOf(
              `https://beep-effect.com/ns/repo-cli/commands/Research/Library/Library.schemas/${predicate.key}`
            ),
            TermIri.make(predicate.termIri)
          );
        }
      })
    );
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
        expect(
          A.some(
            dataset.quads,
            (q) =>
              Str.endsWith("/Derivation/d3")(q.subject.value) &&
              Str.endsWith("/sourceId")(q.predicate.value) &&
              Str.endsWith("/Report/r1")(q.object.value)
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
        const manifests = [
          ["goals", { initiative: { id: "example", title: "Example" }, ignored: "extra metadata" }],
          [
            "explorations",
            {
              schemaVersion: "exploration-manifest/v1",
              exploration: { slug: "example-exploration", title: "Example exploration", status: "active" },
            },
          ],
        ] as const;
        for (const [kind, manifest] of manifests) {
          const dir = path.join(root, kind, "example", "ops");
          yield* fs.makeDirectory(dir, { recursive: true });
          const json = yield* S.encodeEffect(SUnknownJson)(manifest);
          yield* fs.writeFileString(path.join(dir, "manifest.json"), json);
        }
        yield* fs.makeDirectory(path.join(root, "goals/broken"), { recursive: true });
        // A manifest that exists but does not decode is skipped and counted, not fatal.
        yield* fs.makeDirectory(path.join(root, "goals/garbled/ops"), { recursive: true });
        yield* fs.writeFileString(path.join(root, "goals/garbled/ops/manifest.json"), "not json");
        const spaced = path.join(root, "goals/an example/ops");
        yield* fs.makeDirectory(spaced, { recursive: true });
        const spacedManifest = yield* S.encodeEffect(SUnknownJson)({ initiative: { id: "spaced", title: "Spaced" } });
        yield* fs.writeFileString(path.join(spaced, "manifest.json"), spacedManifest);
        const quiet = yield* libraryTopics(root, false);
        const topics = yield* libraryTopics(root);
        expect(quiet, "A packet directory whose name forms no topic IRI is skipped and counted the same way.").toEqual(
          topics
        );
        expect(A.map(topics, (topic) => [topic.id, topic.initiativeId, topic.title])).toEqual([
          ["goals/example", "example", "Example"],
          ["explorations/example", "example-exploration", "Example exploration"],
        ]);
      })
    );
  });
});
