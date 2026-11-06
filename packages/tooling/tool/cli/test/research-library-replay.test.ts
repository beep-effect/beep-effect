import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import {
  hashBytes,
  LibraryCatalog,
  libraryStatus,
  renderLibrary,
  saveImmutable,
} from "@beep/repo-cli/commands/Research";
import { migrateLibrary } from "@beep/repo-cli/commands/Research/Library/Library.migrate";
import {
  LibraryArtifact,
  LibraryCapture,
  LibraryDocument,
  LibraryMigrationReceipt,
  LibraryOccurrence,
  LibrarySource,
  LibrarySourceVersion,
} from "@beep/repo-cli/commands/Research/Library/Library.schemas";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { fcRuns } from "@beep/test-utils";
import { NodeChildProcessSpawner, NodeCrypto } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const LibraryCatalogJson = S.fromJsonString(LibraryCatalog);
const ReplayLines = S.Array(S.String);
const ReplayManifest = S.fromJsonString(S.Record(S.String, S.String));
const LibraryMigrationReceiptJson = S.fromJsonString(LibraryMigrationReceipt);

const fixtureDirectory = "test/fixtures/research-library-replay";
const fixture = Effect.fn("replay.fixture")(function* (date: string) {
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
const written = Effect.fn("replay.written")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files: Record<string, string> = {};
  const walk = Effect.fn("replay.walk")(function* (
    directory: string
  ): Effect.fn.Return<
    void,
    import("effect/PlatformError").PlatformError | import("@beep/repo-cli/commands/Research").LibraryError,
    FileSystem.FileSystem | Path.Path | import("effect/crypto/Digest").Digest
  > {
    const entries = yield* fs.readDirectory(path.join(root, directory));
    for (const name of A.sort(entries, Str.Order)) {
      const relative = path.join(directory, name);
      const info = yield* fs.stat(path.join(root, relative));
      if (info.type === "Directory") yield* walk(relative);
      else {
        const bytes = yield* fs.readFile(path.join(root, relative));
        files[relative] = yield* hashBytes(bytes);
      }
    }
  });
  for (const directory of ["sources", "views"]) yield* walk(directory);
  for (const name of ["index.md", "index.html"]) {
    const bytes = yield* fs.readFile(path.join(root, name));
    files[name] = yield* hashBytes(bytes);
  }
  return files;
});

it.layer(
  Layer.mergeAll(
    NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(NodeFileSystem.layer), Layer.provideMerge(Path.layer)),
    NodeCrypto.layer,
    OxigraphSparqlQueryServiceLive,
    ShaclValidationServiceLive
  ),
  {
    timeout: "60 seconds",
  }
)("library legacy replay", (it) => {
  const replay = Effect.fn("replay.assert")(function* (date: string) {
    const { root, fs, path } = yield* fixture(date);
    yield* renderLibrary(root);
    const console = yield* TestConsole.make;
    yield* libraryStatus(root).pipe(Effect.provideService(Console.Console, console));
    const lines = yield* console.logLines;
    const strings = yield* S.decodeUnknownEffect(ReplayLines)(lines);
    const status = `${A.join(strings, "\n")}\n`;
    const index = yield* fs.readFileString(path.join(root, "index.md"));
    const manifest = yield* written(root);
    const goldenIndex = yield* fs.readFileString(`${fixtureDirectory}/index-${date}.md`);
    const goldenStatus = yield* fs.readFileString(`${fixtureDirectory}/status-${date}.txt`);
    const manifestText = yield* fs.readFileString(`${fixtureDirectory}/files-${date}.json`);
    const goldenManifest = yield* S.decodeEffect(ReplayManifest)(manifestText);
    expect(index).toBe(goldenIndex);
    expect(status).toBe(`${goldenStatus}private partition: documents=0 sources=0 artifacts=0 occurrences=0\n`);
    expect(manifest).toEqual(goldenManifest);
    return root;
  });
  it.effect.each(["2026-10-06", "2026-10-14"])(
    "replays %s byte for byte",
    Effect.fnUntraced(function* (date) {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* replay(date);
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
    })
  );
  const migrationReplay = Effect.fn("replay.migration")(function* (date: string) {
    const { root, fs, path, catalog } = yield* fixture(date);
    yield* renderLibrary(root);
    const index = yield* fs.readFileString(path.join(root, "index.md"));
    const before = yield* fs.readFile(path.join(root, "catalog/library.json"));
    const beforeSha = yield* hashBytes(before);
    const dry = yield* migrateLibrary(root, true);
    expect(O.isSome(dry)).toBe(true);
    const stillBefore = yield* fs.readFile(path.join(root, "catalog/library.json"));
    expect(stillBefore).toEqual(before);
    const noBackup = yield* fs.exists(path.join(root, "catalog/history"));
    expect(noBackup).toBe(false);
    const receiptOption = yield* migrateLibrary(root);
    const receipt = O.getOrThrow(receiptOption);
    const receiptNames = yield* fs.readDirectory(path.join(root, "ops/migrations"));
    expect(receiptNames.length).toBe(1);
    const receiptText = yield* fs.readFileString(path.join(root, "ops/migrations", A.getUnsafe(receiptNames, 0)));
    const persisted = yield* S.decodeEffect(LibraryMigrationReceiptJson)(receiptText);
    expect(persisted).toEqual(receipt);
    expect(receipt.fromSchema).toBe("beep.research.library/v1");
    expect(receipt.toSchema).toBe("beep.research.library/v2");
    expect(receipt.validatorContract).toBe("research-library-shapes/1");
    expect(receipt.beforeCatalogSha256).toBe(beforeSha);
    expect(receipt.shaclViolations).toBe(0);
    expect(receipt.intakeIds).toEqual([date]);
    const after = yield* fs.readFile(path.join(root, "catalog/library.json"));
    const afterSha = yield* hashBytes(after);
    expect(receipt.afterCatalogSha256).toBe(afterSha);
    const next = yield* S.decodeEffect(LibraryCatalogJson)(new TextDecoder().decode(after));
    expect(next.schema).toBe("beep.research.library/v2");
    expect(next.sources).toEqual(catalog.sources);
    const backup = yield* fs.readFile(path.join(root, `catalog/history/${beforeSha}.json`));
    expect(backup).toEqual(before);
    const indexAfter = yield* fs.readFileString(path.join(root, "index.md"));
    expect(indexAfter).toBe(index);
    const noop = yield* migrateLibrary(root);
    expect(O.isNone(noop)).toBe(true);
    const afterNoop = yield* fs.readFile(path.join(root, "catalog/library.json"));
    expect(afterNoop).toEqual(after);
    const receiptNamesAfter = yield* fs.readDirectory(path.join(root, "ops/migrations"));
    expect(receiptNamesAfter).toEqual(receiptNames);
    return root;
  });
  it.effect.each(["2026-10-06", "2026-10-14"])(
    "migrates %s with exact backup and no-op replay",
    Effect.fnUntraced(function* (date) {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* migrationReplay(date);
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
    })
  );
  it.effect(
    "rejects a tampered index before writing catalog, backup or receipt",
    Effect.fnUntraced(function* () {
      const { root, fs, path } = yield* fixture("2026-10-06");
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
      yield* renderLibrary(root);
      const target = path.join(root, "catalog/library.json");
      const before = yield* fs.readFile(target);
      yield* fs.writeFileString(path.join(root, "index.md"), "tampered\n");
      const result = yield* Effect.exit(migrateLibrary(root));
      const message = Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" });
      expect(message).toContain("rendered=");
      expect(message).toContain("disk=");
      const after = yield* fs.readFile(target);
      expect(after).toEqual(before);
      const backupExists = yield* fs.exists(path.join(root, "catalog/history"));
      const receiptsExist = yield* fs.exists(path.join(root, "ops/migrations"));
      expect(backupExists).toBe(false);
      expect(receiptsExist).toBe(false);
    })
  );
  it.effect(
    "propagates private documents, sources and artifacts through every view",
    Effect.fnUntraced(function* () {
      const { root, fs, path, catalog } = yield* fixture("2026-10-14");
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
      const privateCatalog = LibraryCatalog.make({
        ...catalog,
        documents: A.map(catalog.documents, (d) =>
          LibraryDocument.make({ ...d, accessClass: d.id === "a" ? "private" : "public" })
        ),
        sources: A.map(catalog.sources, (source) =>
          LibrarySource.make({ ...source, accessClass: source.id === "s1" ? "private" : "public" })
        ),
        captures: A.map(catalog.captures, (capture) =>
          LibraryCapture.make({
            ...capture,
            artifacts: A.map(capture.artifacts, (artifact) =>
              LibraryArtifact.make({ ...artifact, accessClass: capture.id === "c0" ? "private" : "public" })
            ),
          })
        ),
      });
      const encoded = yield* S.encodeEffect(LibraryCatalogJson)(privateCatalog);
      yield* fs.writeFileString(path.join(root, "catalog/library.json"), encoded);
      yield* renderLibrary(root);
      const index = yield* fs.readFileString(path.join(root, "index.md"));
      expect(index).not.toContain("Report a");
      expect(index).not.toContain("Source 1");
      const privateReportExists = yield* fs.exists(path.join(root, "views/reports/a/REPORT.md"));
      const privateSourceExists = yield* fs.exists(path.join(root, "sources/s1/SOURCE.md"));
      expect(privateReportExists).toBe(false);
      expect(privateSourceExists).toBe(false);
      const source = yield* fs.readFileString(path.join(root, "sources/s0/SOURCE.md"));
      expect(source).not.toContain("[a]");
      expect(source).not.toContain("Readable raw-response](artifact-c0");
      const console = yield* TestConsole.make;
      yield* libraryStatus(root).pipe(Effect.provideService(Console.Console, console));
      const lines = yield* console.logLines;
      expect(lines).toContain("library status: reports=2 sources=2 occurrences=1");
      expect(lines).toContain("private partition: documents=1 sources=1 artifacts=3 occurrences=2");
      yield* renderLibrary(root, true);
      const allIndex = yield* fs.readFileString(path.join(root, "index.md"));
      expect(allIndex).toContain("Report a");
      expect(allIndex).toContain("Source 1");
    })
  );
  it.effect(
    "rejects SHACL violations without writing migration state",
    Effect.fnUntraced(function* () {
      const { root, fs, path, catalog } = yield* fixture("2026-10-06");
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
      const invalid = LibraryCatalog.make({
        ...catalog,
        occurrences: A.map(catalog.occurrences, (o) => LibraryOccurrence.make({ ...o, sourceId: "unknown-source" })),
      });
      const encoded = yield* S.encodeEffect(LibraryCatalogJson)(invalid);
      const target = path.join(root, "catalog/library.json");
      yield* fs.writeFileString(target, encoded);
      yield* renderLibrary(root);
      const result = yield* Effect.exit(migrateLibrary(root));
      const message = Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" });
      expect(message).toContain("shacl violations=3");
      const unchanged = yield* fs.readFileString(target);
      expect(unchanged).toBe(encoded);
      const backup = yield* fs.exists(path.join(root, "catalog/history"));
      const receipt = yield* fs.exists(path.join(root, "ops/migrations"));
      expect(backup).toBe(false);
      expect(receipt).toBe(false);
    })
  );
  it.effect(
    "keeps distinct version locators at the same revision SHACL-conformant",
    Effect.fnUntraced(function* () {
      const { root, fs, path, catalog } = yield* fixture("2026-10-14");
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
      const versioned = LibraryCatalog.make({
        ...catalog,
        sources: A.map(catalog.sources, (source) =>
          LibrarySource.make({
            ...source,
            versions: A.map(["one", "two"], (suffix) =>
              LibrarySourceVersion.make({
                revision: "",
                canonicalUrl: `${source.canonicalUrl}/${suffix}`,
                locators: [source.canonicalUrl],
              })
            ),
          })
        ),
      });
      const encoded = yield* S.encodeEffect(LibraryCatalogJson)(versioned);
      yield* fs.writeFileString(path.join(root, "catalog/library.json"), encoded);
      yield* renderLibrary(root);
      const receipt = yield* migrateLibrary(root, true);
      expect(O.getOrThrow(receipt).shaclViolations).toBe(0);
    })
  );
});

it.effect.prop(
  "property: schema-generated LibraryMigrationReceipt retains every field through JSON",
  { value: Arbitrary.schema(LibraryMigrationReceipt) },
  Effect.fnUntraced(function* ({ value }) {
    const encoded = yield* S.encodeEffect(LibraryMigrationReceiptJson)(value);
    const decoded = yield* S.decodeEffect(LibraryMigrationReceiptJson)(encoded);
    expect(decoded).toEqual(value);
  }),
  { arbitrary: fcRuns(32) }
);
