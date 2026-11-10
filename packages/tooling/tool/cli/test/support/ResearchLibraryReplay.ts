import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { LibraryCatalog, saveImmutable } from "@beep/repo-cli/commands/Research";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { NodeChildProcessSpawner, NodeCrypto } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

/** JSON codec of the stored library catalog. */
export const LibraryCatalogJson = S.fromJsonString(LibraryCatalog);

/** Directory of the recorded October library fixtures and their golden outputs. */
export const fixtureDirectory = "test/fixtures/research-library-replay";

/** Materialize the recorded library of one fixture date in a scratch directory. */
export const fixture = Effect.fn("replay.fixture")(function* (date: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-replay-" });
  const root = yield* fs.realPath(temporary);
  const artifact = yield* saveImmutable(
    root,
    "evidence/response.txt",
    new TextEncoder().encode("Preserved response\n")
  );
  const documents = yield* Effect.forEach(
    ["a", "b", "c"],
    Effect.fnUntraced(function* (id) {
      const report = yield* saveImmutable(root, `reports/${id}.md`, new TextEncoder().encode(`Report ${id} ${date}\n`));
      return {
        id,
        originalPath: `inputs/${date}/${id}.md`,
        snapshotPath: report.path,
        sha256: report.sha256,
        bytes: report.bytes,
        title: id === "b" ? "Report [special] `title` & <text>" : `Report ${id}`,
        reportDate: date,
        expectedOccurrences: 1,
        topics: ["ontology"],
      };
    })
  );
  const sources = A.map(["web", "paper", "github-repository"], (kind, i) => ({
    id: `s${i}`,
    kind,
    identity: i === 0 ? "Source [special] `identity` & <text>" : `Source ${i}`,
    canonicalUrl: `https://example.com/${i}`,
    revision: "",
    repository: i === 2 ? "owner/repo" : "",
    ownership: "external",
    locators: [`https://example.com/${i}`],
  }));
  const catalog = yield* S.decodeUnknownEffect(LibraryCatalog)({
    schema: "beep.research.library/v1",
    documents,
    sources,
    occurrences: A.map(documents, (d, i) => ({
      id: `o${i}`,
      documentId: d.id,
      sourceId: `s${i}`,
      locator: `https://example.com/${i}`,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 2,
      label: `Citation ${i}`,
      form: "url",
      context: `Context ${i}`,
    })),
    captures: A.map(["readable", "blocked", "failed", "interrupted", "unavailable"], (status, i) => ({
      id: `c${i}`,
      sourceId: `s${i % 3}`,
      status,
      method: "fixture",
      recordedAt: date,
      capturedRevision: "",
      requestedRevision: "",
      complete: status === "readable",
      artifacts: [{ ...artifact, role: i === 1 ? "reviewed-disposition" : "raw-response" }],
      reason: `Attempt ${i}`,
    })),
    qualifications: A.map(["verified", "failed"], (status, i) => ({
      id: `q${i}`,
      adapter: `route-${i}`,
      status,
      required: false,
      recordedAt: date,
      evidence: [],
      reason: `Probe ${i}`,
    })),
    intakes: [
      {
        id: date,
        date,
        createdAt: date,
        repoCommit: "fixture",
        inputRoots: [],
        manifestPath: `intakes/${date}/manifest.json`,
        files: [],
      },
    ],
  });
  yield* fs.makeDirectory(path.join(root, "catalog"));
  // Write v1 directly: withCatalog also performs unrelated identity reconciliation.
  const encoded = yield* S.encodeEffect(LibraryCatalogJson)(catalog);
  yield* fs.writeFileString(path.join(root, "catalog/library.json"), encoded);
  return { root, fs, path, catalog };
});

/** Process, filesystem, crypto, SPARQL and SHACL services the legacy replay suites run on. */
export const replayServices = Layer.mergeAll(
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(NodeFileSystem.layer), Layer.provideMerge(Path.layer)),
  NodeCrypto.layer,
  OxigraphSparqlQueryServiceLive,
  ShaclValidationServiceLive
);
