import { Git } from "@beep/git/Git";
import {
  classifyLibraryReference,
  extractLibraryReferences,
  hashBytes,
  importLibraryResult,
  inventoryLibrary,
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryDocument,
  LibraryInventoryOptions,
  LibraryOccurrence,
  LibrarySource,
  LibrarySourceVersion,
  loadCatalog,
  ResearchLibraryLive,
  saveImmutable,
  withCatalog,
} from "@beep/repo-cli/commands/Research";
import { runLibraryVerificationCommand } from "@beep/repo-cli/test/ResearchLibrary";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const LibraryCatalogJson = S.fromJsonString(LibraryCatalog);
const LibraryArtifactJson = S.fromJsonString(LibraryArtifact);

const fixtureJson = S.Unknown.pipe(S.fromJsonString, S.encodeEffect);

const resolutionFixture = Effect.fn("test.resolutionFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-resolution-" });
  const input = path.join(temporary, "input");
  const root = path.join(temporary, "library");
  yield* fs.makeDirectory(input);
  yield* fs.writeFileString(path.join(input, "report.md"), "# Report\nCites modelcontextprotocol/conformance#330.\n");
  yield* fs.writeFileString(
    path.join(input, "second.md"),
    "# Second\nAlso cites modelcontextprotocol/conformance#330.\n"
  );
  const options = LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [input] });
  const before = yield* inventoryLibrary(options);
  const source = A.getUnsafe(before.sources, 0);
  const occurrence = A.getUnsafe(before.occurrences, 0);
  const document = A.getUnsafe(before.documents, 0);
  if (source === undefined || occurrence === undefined || document === undefined)
    throw new Error("Missing inventory fixture");
  const preexisting = yield* classifyLibraryReference(
    "https://github.com/ModelContextProtocol/conformance/pull/330",
    document.id
  );
  yield* withCatalog(root, (catalog) =>
    Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [...catalog.sources, preexisting] }))
  );
  const proofPath = path.join(temporary, "proof.json");
  const proof = yield* fixtureJson({
    url: "https://api.github.com/repos/modelcontextprotocol/conformance/issues/330",
    html_url: "https://github.com/modelcontextprotocol/conformance/pull/330",
    number: 330,
    pull_request: { html_url: "https://github.com/modelcontextprotocol/conformance/pull/330" },
  });
  yield* fs.writeFileString(proofPath, proof);
  const bytes = new TextEncoder().encode(proof);
  const payload = {
    kind: "reference-resolution",
    sourceId: source.id,
    locator: occurrence.locator,
    canonicalUrl: "https://github.com/modelcontextprotocol/conformance/pull/330",
    reason: "GitHub issues API identifies the canonical pull request.",
    reviewer: "test-reviewer",
    reviewedAt: "2026-10-06T12:00:00Z",
    evidence: {
      path: proofPath,
      sha256: yield* hashBytes(bytes),
      bytes: bytes.byteLength,
      mediaType: "application/json",
      role: "github-object",
    },
    context: {
      sourceId: source.id,
      locator: occurrence.locator,
      requestedRevision: "",
      occurrences: [
        {
          occurrenceId: occurrence.id,
          documentId: document.id,
          snapshotPath: document.snapshotPath,
          documentSha256: document.sha256,
          line: occurrence.line,
          column: occurrence.column,
          endLine: occurrence.endLine,
          endColumn: occurrence.endColumn,
          locator: occurrence.locator,
          context: occurrence.context,
          contextSha256: yield* hashBytes(new TextEncoder().encode(occurrence.context)),
        },
      ],
    },
  };
  const payloadPath = path.join(temporary, "resolution.json");
  return {
    fs,
    path,
    root,
    options,
    before,
    source,
    occurrence,
    document,
    preexisting,
    proofPath,
    proof,
    payload,
    payloadPath,
  };
});

// `Git` rides over the platform spawner: an input root's commit is read through the kit (W2b).
const InventoryPlatform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FetchHttpClient.layer);
const LibraryPlatform = Layer.provideMerge(Git.layer, InventoryPlatform);

it.layer(Layer.provideMerge(ResearchLibraryLive, LibraryPlatform), { timeout: "30 seconds" })(
  "research library provenance",
  (it) => {
    it.effect("returns a nonzero CLI sentinel for an incomplete source library", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        yield* withCatalog(root, (catalog) => Effect.succeed(catalog));
        const result = yield* runLibraryVerificationCommand(root).pipe(Effect.flip);
        expect(result._tag).toBe("CliReportedExit");
        if (result._tag !== "CliReportedExit") throw new Error("Expected CLI exit sentinel");
        expect(result.exitCode).toBe(1);
      })
    );

    it.effect("backfills legacy receipt objects only from matching original bytes", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        const bytes = new TextEncoder().encode("legacy provider evidence");
        const sha256 = yield* hashBytes(bytes);
        yield* fs.makeDirectory(path.join(root, "qualifications"));
        yield* fs.writeFile(path.join(root, "qualifications/legacy.txt"), bytes);
        const legacy = LibraryCatalog.make({
          schema: "beep.research.library/v2",
          documents: [],
          sources: [],
          occurrences: [],
          captures: [],
          qualifications: [],
          artifacts: [
            LibraryArtifact.make({
              path: "qualifications/legacy.txt",
              sha256,
              bytes: bytes.length,
              role: "qualification-probe",
              mediaType: "text/plain",
            }),
          ],
        });
        const argument = path.join(root, "catalog.json");
        const value1 = yield* S.encodeEffect(LibraryCatalogJson)(legacy);
        yield* fs.writeFileString(argument, value1);
        yield* withCatalog(root, Effect.succeed);
        const readFile23 = yield* fs.readFile(path.join(root, "objects/sha256", sha256));
        const hashBytes1 = yield* hashBytes(readFile23);
        expect(hashBytes1).toBe(sha256);
        const readFile24 = yield* fs.readFile(path.join(root, "qualifications/legacy.txt"));
        const hashBytes2 = yield* hashBytes(readFile24);
        expect(hashBytes2).toBe(sha256);
        yield* fs.remove(path.join(root, "objects/sha256", sha256));
        yield* fs.writeFileString(path.join(root, "qualifications/legacy.txt"), "corrupted legacy evidence");
        const rejected = yield* withCatalog(root, Effect.succeed).pipe(Effect.flip);
        expect(rejected.message).toContain("differs from its immutable receipt");
        const exists3 = yield* fs.exists(path.join(root, "objects/sha256", sha256));
        expect(exists3).toBe(false);
      })
    );

    it.effect("migrates truncated scoped release versions and citation provenance", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        const full = yield* classifyLibraryReference(
          "https://github.com/evoluhq/evolu/releases/tag/@evolu/common@7.4.1",
          "doc"
        );
        const old = LibrarySource.make({
          ...full,
          revision: "@evolu",
          versions: [
            LibrarySourceVersion.make({ revision: "@evolu", canonicalUrl: full.canonicalUrl, locators: full.locators }),
          ],
        });
        yield* withCatalog(root, (catalog) =>
          Effect.succeed(
            LibraryCatalog.make({
              ...catalog,
              sources: [old],
              occurrences: [
                LibraryOccurrence.make({
                  id: "old-use",
                  documentId: "doc",
                  sourceId: old.id,
                  revision: "@evolu",
                  locator: full.canonicalUrl,
                  label: "",
                  form: "url",
                  line: 1,
                  column: 1,
                  endLine: 1,
                  endColumn: 2,
                  findingId: "",
                  context: "",
                }),
              ],
            })
          )
        );
        const migrated = yield* withCatalog(root, Effect.succeed);
        expect(A.getUnsafe(migrated.sources, 0)?.revision).toBe("@evolu/common@7.4.1");
        expect(A.getUnsafe(A.getUnsafe(migrated.sources, 0).versions, 0)?.revision).toBe("@evolu/common@7.4.1");
        expect(A.getUnsafe(migrated.occurrences, 0)?.revision).toBe("@evolu/common@7.4.1");
      })
    );

    it.effect(
      "extracts observed Chinese URL separators and bare support hosts without mistaking listings for services",
      () =>
        Effect.gen(function* () {
          const references = extractLibraryReferences(
            "端点 https://api.ip930.com/api/mcp，Streamable HTTP。 Live `data.uspto.gov/support`."
          );
          expect(A.map(references, (reference) => reference.locator)).toEqual([
            "https://api.ip930.com/api/mcp",
            "data.uspto.gov/support",
          ]);
          const support = yield* classifyLibraryReference(A.getUnsafe(references, 1)!.locator, "doc");
          expect(support.kind).toBe("web");
          expect(support.canonicalUrl).toBe("https://data.uspto.gov/support");
          const listing = yield* classifyLibraryReference(
            "https://glama.ai/mcp/servers/parisbs/codex-subagent-mcp/tree",
            "doc"
          );
          const directory = yield* classifyLibraryReference("https://lobehub.com/pl/mcp/guty3rrez-local-brain", "doc");
          expect(listing.kind).toBe("web");
          expect(directory.kind).toBe("web");
        })
    );

    it.effect("preserves paper revisions, meaningful queries, and repository resource identities", () =>
      Effect.gen(function* () {
        const abs = yield* classifyLibraryReference("https://arxiv.org/abs/2610.00609v1", "doc");
        const pdf = yield* classifyLibraryReference("https://arxiv.org/pdf/2610.00609v1", "doc");
        const next = yield* classifyLibraryReference("https://arxiv.org/abs/2610.00609v2", "doc");
        expect(abs.id).toBe(pdf.id);
        expect(abs.identity).toBe(next.identity);
        expect(abs.id).toBe(next.id);
        expect(abs.revision).not.toBe(next.revision);
        const first = yield* classifyLibraryReference("https://example.com/document?article=1&utm_source=x", "doc");
        const alias = yield* classifyLibraryReference("https://example.com/document?article=1", "doc");
        const other = yield* classifyLibraryReference("https://example.com/document?article=2", "doc");
        expect(first.id).toBe(alias.id);
        expect(first.id).not.toBe(other.id);
        const issue = yield* classifyLibraryReference("https://github.com/Effect-TS/effect/issues/12", "doc");
        const repo = yield* classifyLibraryReference("https://github.com/Effect-TS/effect", "doc");
        expect(issue.repository).toBe(repo.repository);
        expect(issue.id).not.toBe(repo.id);
        expect(issue.kind).toBe("github-issue");
        const release = yield* classifyLibraryReference(
          "https://github.com/evoluhq/evolu/releases/tag/@evolu/common@7.4.1",
          "doc"
        );
        expect(release.revision).toBe("@evolu/common@7.4.1");
        const encodedRelease = yield* classifyLibraryReference(
          "https://github.com/evoluhq/evolu/releases/tag/%40evolu%2Fcommon%407.4.1",
          "doc"
        );
        expect(encodedRelease.revision).toBe("%40evolu%2Fcommon%407.4.1");
        expect(encodedRelease.canonicalUrl).toContain("%40evolu%2Fcommon%407.4.1");
      })
    );

    it.effect("keeps exact occurrence coordinates and bare identifiers without double counting", () =>
      Effect.gen(function* () {
        const text =
          "# Report\nSee [Paper](https://arxiv.org/abs/2610.00609v1).\narXiv:2610.00609v2 and 10.1007/s10115-026-02880-5\n`owner/repo`\n";
        const references = extractLibraryReferences(text);
        expect(references).toHaveLength(4);
        expect(A.getUnsafe(references, 0)).toMatchObject({
          locator: "https://arxiv.org/abs/2610.00609v1",
          line: 2,
          column: 13,
          label: "Paper",
        });
        expect(A.getUnsafe(references, 3)).toMatchObject({
          locator: "owner/repo",
          form: "repo-shorthand",
          line: 4,
          column: 2,
        });
      })
    );

    it.effect("retains immutable input versions and rechecks hashes on inventory reruns", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-inventory-" });
        const input = path.join(temporary, "inputs");
        const root = path.join(temporary, "library");
        yield* fs.makeDirectory(input);
        const report = path.join(input, "report.md");
        yield* fs.writeFileString(report, "# One\nhttps://github.com/owner/repo/issues/1\n");
        const options = LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [input] });
        const first = yield* inventoryLibrary(options);
        expect(first.sources).toHaveLength(2); // repository clone is independently required
        expect(first.occurrences).toHaveLength(1);
        const again = yield* inventoryLibrary(options);
        expect(again.documents).toHaveLength(1);
        expect(again.occurrences).toHaveLength(1);
        yield* fs.writeFileString(report, "# Two\nhttps://example.com/second\n");
        const changed = yield* inventoryLibrary(options);
        expect(changed.documents).toHaveLength(2);
        const original = A.getUnsafe(first.documents, 0);
        expect(original).toBeDefined();
        if (original !== undefined) {
          const snapshot = path.join(root, original.snapshotPath);
          const readFileString4 = yield* fs.readFileString(snapshot);
          expect(readFileString4).toContain("# One");
          yield* fs.writeFileString(snapshot, "corrupted");
          yield* fs.writeFileString(report, "# One\nhttps://github.com/owner/repo/issues/1\n");
          const failed = yield* inventoryLibrary(options).pipe(Effect.flip);
          expect(failed.message).toContain("Immutable artifact content differs");
        }
      })
    );

    it.effect("rejects immutable overwrite and simultaneous writers without losing the catalog", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "library-store-" });
        yield* saveImmutable(root, "snapshot.md", new TextEncoder().encode("first"));
        const failed = yield* saveImmutable(root, "snapshot.md", new TextEncoder().encode("second")).pipe(Effect.flip);
        expect(failed.message).toContain("Immutable artifact content differs");
        const readFileString5 = yield* fs.readFileString(path.join(root, "snapshot.md"));
        expect(readFileString5).toBe("first");
        yield* withCatalog(root, Effect.succeed);
        yield* fs.makeDirectory(path.join(root, ".writer-lock"));
        const locked = yield* withCatalog(root, Effect.succeed).pipe(Effect.flip);
        expect(locked.message).toContain("writer already active");
        expect((yield* loadCatalog(root)).schema).toBe("beep.research.library/v2");
      })
    );
    it.effect("rejects artifact symlink escapes before creating outside directories", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-containment-" });
        const root = path.join(temporary, "library");
        const outside = path.join(temporary, "outside");
        yield* fs.makeDirectory(root);
        yield* fs.makeDirectory(outside);
        yield* fs.symlink(outside, path.join(root, "escape"));
        const rejected = yield* saveImmutable(root, "escape/new/file.md", new TextEncoder().encode("bytes")).pipe(
          Effect.flip
        );
        expect(rejected.message).toContain("escapes library");
        const exists6 = yield* fs.exists(path.join(outside, "new"));
        expect(exists6).toBe(false);
        const traversal = yield* saveImmutable(root, "../escape.md", new Uint8Array()).pipe(Effect.flip);
        expect(traversal.message).toContain("inside the library");
      })
    );
    it.effect("rejects a concurrent same-byte symlink winner without modifying outside evidence", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-link-winner-" });
        const root = path.join(temporary, "library");
        const outside = path.join(temporary, "outside.md");
        const target = path.join(root, "raced.md");
        const bytes = new TextEncoder().encode("same immutable evidence");
        yield* fs.makeDirectory(root);
        yield* fs.writeFile(outside, bytes);
        const intercepted: FileSystem.FileSystem = {
          ...fs,
          link: (from, to) =>
            to === target ? fs.symlink(outside, target).pipe(Effect.andThen(fs.link(from, to))) : fs.link(from, to),
        };
        const rejected = yield* saveImmutable(root, "raced.md", bytes).pipe(
          Effect.provideService(FileSystem.FileSystem, intercepted),
          Effect.flip
        );
        expect(rejected.message).toBe("Cannot publish immutable artifact atomically.");
        expect(rejected.cause).toMatchObject({ message: "Concurrent immutable artifact escapes library via symlink." });
        const readFile25 = yield* fs.readFile(outside);
        const hashBytes7 = yield* hashBytes(readFile25);
        const expectation = expect(hashBytes7);
        const hashBytes3 = yield* hashBytes(bytes);
        expectation.toBe(hashBytes3);
        const realPath8 = yield* fs.realPath(target);
        expect(realPath8).toBe(outside);
        const readDirectory9 = yield* fs.readDirectory(path.join(root, "objects/sha256"));
        expect(readDirectory9).toHaveLength(1);
      })
    );
    it.effect("counts every reference-style Markdown use and preserves definition and use spans", () =>
      Effect.gen(function* () {
        const text = "[Paper][p] then [p][] and [p].\n\n[p]: https://arxiv.org/abs/2610.00609v1\n";
        const references = extractLibraryReferences(text);
        expect(references).toHaveLength(4);
        expect(A.filter(references, (r) => r.form === "reference-use")).toHaveLength(3);
        expect(A.getUnsafe(references, 0)).toMatchObject({
          citationText: "[Paper][p]",
          locator: "https://arxiv.org/abs/2610.00609v1",
          label: "Paper",
          line: 1,
          column: 1,
          endColumn: 11,
          definitionLine: 3,
          definitionColumn: 6,
        });
        expect(A.getUnsafe(references, 3)).toMatchObject({ form: "url", line: 3, column: 6 });
        const bare = extractLibraryReferences("arXiv 2609.02749; 2609.11682 and github.com/Lilaizhen/A2M");
        expect(bare).toHaveLength(3);
        expect(A.getUnsafe(bare, 1)).toMatchObject({ locator: "2609.11682", form: "arxiv-id" });
      })
    );
    it.effect.each(["relative", "absolute"])(
      "resolves reference proof paths from a nested manifest directory: %s",
      (mode) =>
        Effect.gen(function* () {
          const f = yield* resolutionFixture();
          const directory = f.path.join(f.path.dirname(f.payloadPath), "nested", "manifest");
          yield* f.fs.makeDirectory(directory, { recursive: true });
          const proofPath = f.path.join(directory, "proof.json");
          yield* f.fs.writeFileString(proofPath, f.proof);
          // Remove the original so only the manifest-relative copy can satisfy the import.
          yield* f.fs.remove(f.proofPath);
          const manifest = f.path.join(directory, "resolution.json");
          const fixtureJson10 = yield* fixtureJson({
            ...f.payload,
            evidence: { ...f.payload.evidence, path: mode === "relative" ? "proof.json" : proofPath },
          });
          yield* f.fs.writeFileString(manifest, fixtureJson10);
          const result = yield* importLibraryResult(f.root, manifest);
          const resolved = A.findFirst(result.sources, (entry) => entry.id === f.preexisting.id);
          expect(resolved).toMatchObject({ _tag: "Some", value: { aliasIds: expect.arrayContaining([f.source.id]) } });
          const retained = A.findFirst(result.artifacts, (entry) => entry.role === "reference-resolution-evidence");
          expect(retained).toMatchObject({ _tag: "Some", value: { sha256: f.payload.evidence.sha256 } });
        })
    );
    it.effect(
      "resolves GitHub shorthand from bound API proof and preserves aliases across import and inventory reruns",
      () =>
        Effect.gen(function* () {
          const {
            fs,
            path,
            root,
            options,
            before,
            source,
            occurrence,
            document,
            preexisting,
            proofPath,
            proof,
            payload,
            payloadPath,
          } = yield* resolutionFixture();
          const fixtureJson11 = yield* fixtureJson({
            ...payload,
            evidence: { ...payload.evidence, sha256: Str.repeat(64)("0") },
          });
          yield* fs.writeFileString(payloadPath, fixtureJson11);
          expect((yield* importLibraryResult(root, payloadPath).pipe(Effect.flip)).message).toContain("hash differs");
          const fixtureJson12 = yield* fixtureJson({
            ...payload,
            canonicalUrl: "https://github.com/modelcontextprotocol/conformance/issues/330",
          });
          yield* fs.writeFileString(payloadPath, fixtureJson12);
          expect((yield* importLibraryResult(root, payloadPath).pipe(Effect.flip)).message).toContain("object differs");
          const fixtureJson13 = yield* fixtureJson({
            ...payload,
            context: {
              ...payload.context,
              occurrences: [{ ...A.getUnsafe(payload.context.occurrences, 0), context: "fabricated" }],
            },
          });
          yield* fs.writeFileString(payloadPath, fixtureJson13);
          expect((yield* importLibraryResult(root, payloadPath).pipe(Effect.flip)).message).toContain(
            "context differs"
          );
          expect(A.getUnsafe((yield* loadCatalog(root)).sources, 0)?.kind).toBe("unresolved");
          const fixtureJson14 = yield* fixtureJson(payload);
          yield* fs.writeFileString(payloadPath, fixtureJson14);
          yield* importLibraryResult(root, payloadPath);
          const resolved = yield* loadCatalog(root);
          const target = O.getOrThrowWith(
            A.findFirst(resolved.sources, (s) => s.kind === "github-pr"),
            () => new Error("Missing resolved source fixture")
          );
          expect(target.id).toBe(preexisting.id);
          expect(A.filter(resolved.sources, (s) => s.kind === "github-pr")).toHaveLength(1);
          expect(target.aliasIds).toContain(source.id);
          expect(target.locators).toContain(occurrence.locator);
          expect(A.getUnsafe(resolved.occurrences, 0)).toEqual({ ...occurrence, sourceId: target.id });
          expect(A.some(resolved.sources, (s) => s.kind === "github-repository")).toBe(true);
          expect(A.filter(resolved.artifacts, (a) => Str.startsWith("reference-resolution")(a.role))).toHaveLength(2);
          yield* importLibraryResult(root, payloadPath);
          const loadedCatalog = yield* loadCatalog(root);
          expect(loadedCatalog).toEqual(resolved);
          const missingSecondReport = () => new Error("Missing second report fixture");
          const other = O.getOrThrowWith(
            A.findFirst(before.occurrences, (o) => o.sourceId !== source.id),
            missingSecondReport
          );
          const otherDocument = O.getOrThrowWith(
            A.findFirst(before.documents, (d) => d.id === other.documentId),
            missingSecondReport
          );
          const singleton = `[${proof}]`;
          const singletonBytes = new TextEncoder().encode(singleton);
          yield* fs.writeFileString(proofPath, singleton);
          const secondPayload = {
            ...payload,
            sourceId: other.sourceId,
            evidence: {
              ...payload.evidence,
              bytes: singletonBytes.byteLength,
              sha256: yield* hashBytes(singletonBytes),
            },
            context: {
              ...payload.context,
              sourceId: other.sourceId,
              occurrences: [
                {
                  ...A.getUnsafe(payload.context.occurrences, 0),
                  occurrenceId: other.id,
                  documentId: otherDocument.id,
                  snapshotPath: otherDocument.snapshotPath,
                  documentSha256: otherDocument.sha256,
                  line: other.line,
                  column: other.column,
                  endLine: other.endLine,
                  endColumn: other.endColumn,
                  locator: other.locator,
                  context: other.context,
                  contextSha256: yield* hashBytes(new TextEncoder().encode(other.context)),
                },
              ],
            },
          };
          const fixtureJson15 = yield* fixtureJson(secondPayload);
          yield* fs.writeFileString(payloadPath, fixtureJson15);
          yield* importLibraryResult(root, payloadPath);
          const merged = yield* loadCatalog(root);
          expect(A.filter(merged.sources, (s) => s.kind === "github-pr")).toHaveLength(1);
          expect(O.getOrThrow(A.findFirst(merged.sources, (s) => s.id === preexisting.id)).aliasIds).toContain(
            other.sourceId
          );
          expect(A.every(merged.occurrences, (o) => o.sourceId === preexisting.id)).toBe(true);
          yield* importLibraryResult(root, payloadPath);
          const loadedCatalog16 = yield* loadCatalog(root);
          expect(loadedCatalog16).toEqual(merged);
          const rerun = yield* inventoryLibrary(options);
          expect(A.some(rerun.sources, (s) => s.kind === "unresolved")).toBe(false);
          expect(rerun.occurrences).toEqual(merged.occurrences);
          const readFileString17 = yield* fs.readFileString(path.join(root, document.snapshotPath));
          expect(readFileString17).toBe("# Report\nCites modelcontextprotocol/conformance#330.\n");
        })
    );
    it.effect("repairs Markdown URL label boundaries and explicitly expands cited arxiv category alternatives", () =>
      Effect.gen(function* () {
        const text =
          "[openclaw.ai/blog](https://openclaw.ai/blog/security) [x.ai/cli](https://x.ai/build) [arxiv.org/html/2606.18037v3](https://arxiv.org/html/2606.18037v3)\narxiv.org/list/cs.AI|cs.CR/new\nhttps://arxiv.org/list/cs.AI|cs.CR|cs.SE/new";
        const refs = extractLibraryReferences(text);
        expect(A.map(refs, (r) => r.locator)).toEqual([
          "https://openclaw.ai/blog/security",
          "https://x.ai/build",
          "https://arxiv.org/html/2606.18037v3",
          "https://arxiv.org/list/cs.AI/new",
          "https://arxiv.org/list/cs.CR/new",
          "https://arxiv.org/list/cs.AI/new",
          "https://arxiv.org/list/cs.CR/new",
          "https://arxiv.org/list/cs.SE/new",
        ]);
        expect(A.getUnsafe(refs, 3)).toMatchObject({
          citationText: "arxiv.org/list/cs.AI|cs.CR/new",
          line: 2,
          column: 1,
        });
        expect(A.getUnsafe(refs, 4)?.column).toBe(A.getUnsafe(refs, 3)?.column);
        const html = yield* classifyLibraryReference(A.getUnsafe(refs, 2)?.locator ?? "", "doc");
        expect(html).toMatchObject({ identity: "arxiv:2606.18037", revision: "v3", kind: "paper" });
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "library-label-migration-" });
        const bad = yield* classifyLibraryReference(
          "https://arxiv.org/html/2606.18037v3](https://arxiv.org/html/2606.18037v3",
          "doc"
        );
        const oldCapture = LibraryCapture.make({
          id: "old-attempt",
          sourceId: bad.id,
          capturedRevision: "",
          complete: false,
          status: "failed",
          method: "firecrawl",
          recordedAt: "2026-10-06T12:00:00Z",
          artifacts: [],
          reason: "malformed locator request failed",
        });
        yield* withCatalog(root, (catalog) =>
          Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [bad], captures: [oldCapture] }))
        );
        yield* withCatalog(root, Effect.succeed);
        const migrated = yield* loadCatalog(root);
        expect(A.getUnsafe(migrated.sources, 0)).toMatchObject({
          id: html.id,
          identity: html.identity,
          revision: "v3",
          canonicalUrl: html.canonicalUrl,
        });
        expect(A.getUnsafe(migrated.sources, 0)?.aliasIds).toContain(bad.id);
        expect(A.getUnsafe(migrated.captures, 0)).toMatchObject({
          id: "old-attempt",
          sourceId: html.id,
          status: "failed",
          reason: "malformed locator request failed",
        });
      })
    );
    it.effect("retains an entire commits branch reference", () =>
      Effect.gen(function* () {
        expect(
          (yield* classifyLibraryReference("https://github.com/Effect-TS/effect/commits/main", "doc")).revision
        ).toBe("main");
        expect(
          (yield* classifyLibraryReference("https://github.com/Effect-TS/effect/commits/feature/schema", "doc"))
            .revision
        ).toBe("feature/schema");
        expect((yield* classifyLibraryReference("https://github.com/Effect-TS/effect/commits", "doc")).revision).toBe(
          ""
        );
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-commits-ref-" });
        const input = path.join(temporary, "input");
        const root = path.join(temporary, "library");
        yield* fs.makeDirectory(input);
        yield* fs.writeFileString(path.join(input, "report.md"), "https://github.com/Effect-TS/effect/commits/main");
        const options = LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [input] });
        const before = yield* inventoryLibrary(options);
        yield* withCatalog(root, (catalog) =>
          Effect.succeed(
            LibraryCatalog.make({
              ...catalog,
              sources: A.map(catalog.sources, (source) =>
                source.kind === "github-code"
                  ? LibrarySource.make({
                      ...source,
                      revision: "",
                      versions: A.map(source.versions, (version) =>
                        LibrarySourceVersion.make({ ...version, revision: "" })
                      ),
                    })
                  : source
              ),
            })
          )
        );
        const rerun = yield* inventoryLibrary(options);
        const code = O.getOrThrow(A.findFirst(rerun.sources, (source) => source.kind === "github-code"));
        expect(code.revision).toBe("main");
        expect(A.map(code.versions, (version) => version.revision)).toEqual(["main"]);
        expect(A.getUnsafe(rerun.occurrences, 0)?.id).toBe(A.getUnsafe(before.occurrences, 0)?.id);
      })
    );
    it("captures explicit JSON and known prose paper identifiers without duplicating numeric link labels", () => {
      const references = extractLibraryReferences(
        '{"arxiv":"2610.02204v2"}\nRPG (2610.02204v2); unrelated 2610.09999.\n[2610.02204](https://arxiv.org/abs/2610.02204)\nTrustShiftProbe (2608.23763)\nmodelcontextprotocol/conformance#330',
        ["arxiv:2608.23763"]
      );
      expect(A.map(references, (reference) => reference.locator)).toEqual([
        "2610.02204v2",
        "2610.02204v2",
        "https://arxiv.org/abs/2610.02204",
        "2608.23763",
        "modelcontextprotocol/conformance#330",
      ]);
      expect(A.getUnsafe(references, 0)).toMatchObject({ line: 1, column: 11, citationText: "2610.02204v2" });
      expect(A.getUnsafe(references, 4)?.form).toBe("repo-resource-shorthand");
    });
    it.effect("does not assign a nested specification date to a report title", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-title-date-" });
        const input = path.join(temporary, "inputs");
        yield* fs.makeDirectory(input);
        yield* fs.writeFileString(
          path.join(input, "nightly-2026-09-12.md"),
          "# nightly — 12 September 2026\n## MCP spec 2026-07-28\n"
        );
        yield* fs.writeFileString(
          path.join(input, "nightly-2026-09-14.md"),
          "# nightly — 2026-09-13\n## MCP spec 2026-07-28\n"
        );
        yield* fs.writeFileString(path.join(input, "a.md"), "# Earlier report\nKnown paper (2610.02204)\n");
        yield* fs.writeFileString(
          path.join(input, "nightly-2026-09-15.md"),
          "No report heading\n## MCP spec 2026-07-28\n"
        );
        yield* fs.writeFileString(path.join(input, "z.json"), '{"arxiv":"2610.02204"}');
        const catalog = yield* inventoryLibrary(
          LibraryInventoryOptions.make({ libraryRoot: path.join(temporary, "library"), inputRoots: [input] })
        );
        expect(O.getOrThrow(A.findFirst(catalog.documents, (d) => d.filenameDate === "2026-09-12"))).toMatchObject({
          reportDate: "",
          headingDate: "12 September 2026",
          filenameDate: "2026-09-12",
        });
        expect(O.getOrThrow(A.findFirst(catalog.documents, (d) => d.filenameDate === "2026-09-14"))).toMatchObject({
          reportDate: "2026-09-13",
          headingDate: "2026-09-13",
          filenameDate: "2026-09-14",
        });
        expect(O.getOrThrow(A.findFirst(catalog.documents, (d) => d.filenameDate === "2026-09-15")).reportDate).toBe(
          ""
        );
        const proseDocument = O.getOrThrow(
          A.findFirst(catalog.documents, (d) => Str.endsWith("/a.md")(d.originalPath))
        );
        expect(O.getOrThrow(A.findFirst(catalog.occurrences, (o) => o.documentId === proseDocument.id))).toMatchObject({
          locator: "2610.02204",
        });
      })
    );
    it.effect("retains intake file census, finding IDs, date conflicts, and content objects", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-intake-" });
        const input = path.join(temporary, "inputs");
        const root = path.join(temporary, "library");
        yield* fs.makeDirectory(input);
        yield* fs.writeFileString(path.join(input, ".gitkeep"), "");
        yield* fs.writeFileString(
          path.join(input, "beep-effect-nightly-2026-10-24.md"),
          "# nightly — 6 October 2026\n## Law\nhttps://example.com/report\n"
        );
        yield* fs.writeFileString(
          path.join(input, "claims.jsonl"),
          '{"id":"f-law-01","url":"https://example.com/finding"}'
        );
        const catalog = yield* inventoryLibrary(
          LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [input] })
        );
        expect(catalog.documents).toHaveLength(2);
        expect(O.getOrThrow(A.findFirst(catalog.documents, (d) => d.filenameDate === "2026-10-24")).topics).toContain(
          "law-practice"
        );
        expect(
          O.getOrThrow(A.findFirst(catalog.sources, (source) => source.canonicalUrl === "https://example.com/report"))
            .topics
        ).toContain("law-practice");
        expect(catalog.intakes).toHaveLength(1);
        expect(A.getUnsafe(catalog.intakes, 0)?.files).toHaveLength(3);
        expect(O.getOrThrow(A.findFirst(catalog.documents, (d) => d.filenameDate === "2026-10-24"))).toMatchObject({
          headingDate: "6 October 2026",
        });
        expect(
          O.getOrThrow(A.findFirst(catalog.occurrences, (o) => o.locator === "https://example.com/finding"))
        ).toMatchObject({
          findingId: "f-law-01",
        });
        const exists18 = yield* fs.exists(path.join(root, "catalog/library.json"));
        expect(exists18).toBe(true);
        const exists19 = yield* fs.exists(path.join(root, "library.json"));
        expect(exists19).toBe(true);
        for (const document of catalog.documents) {
          const exists4 = yield* fs.exists(path.join(root, "objects/sha256", document.sha256));
          expect(exists4).toBe(true);
        }
      })
    );
    it.effect("bounds migration reconciliation and preserves catalog bytes on an identity no-op", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "library-bounded-migration-" });
        const artifact = LibraryArtifact.make({
          path: "missing-legacy-evidence.txt",
          sha256: Str.repeat(64)("a"),
          bytes: 1,
          role: "content",
          mediaType: "text/plain",
        });
        const catalog = LibraryCatalog.make({
          schema: "beep.research.library/v2",
          documents: [],
          sources: [],
          occurrences: [],
          captures: [],
          qualifications: [],
          artifacts: [artifact],
        });
        const text = yield* S.encodeEffect(LibraryCatalogJson)(catalog);
        yield* fs.makeDirectory(path.join(root, "catalog"));
        const canonical = path.join(root, "catalog/library.json");
        yield* fs.writeFileString(canonical, text);
        const noop = yield* withCatalog(root, Effect.succeed, false);
        expect(noop).toEqual(catalog);
        const unchanged = yield* fs.readFileString(canonical);
        expect(unchanged).toBe(text);
        const historyExists = yield* fs.exists(path.join(root, "catalog/history"));
        expect(historyExists).toBe(false);
        const locked = yield* fs.exists(path.join(root, ".writer-lock"));
        expect(locked).toBe(false);
        const changed = yield* withCatalog(
          root,
          (current) => Effect.succeed(LibraryCatalog.make({ ...current, artifacts: [] })),
          false
        );
        expect(changed.artifacts).toEqual([]);
        const persisted = yield* loadCatalog(root);
        expect(persisted).toEqual(changed);
        const history = yield* fs.readDirectory(path.join(root, "catalog/history"));
        expect(history.length).toBe(1);
      })
    );
    it.effect("reconciles colliding legacy identities while retaining aliases, locators and versions", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "library-migration-collision-" });
        const source = LibrarySource.make({
          id: "legacy-first",
          identity: "arxiv:2610.00609",
          kind: "paper",
          canonicalUrl: "https://arxiv.org/abs/2610.00609v1",
          revision: "v1",
          repository: "",
          ownership: "external",
          locators: ["https://arxiv.org/abs/2610.00609v1"],
        });
        const other = LibrarySource.make({
          ...source,
          id: "unrelated",
          identity: "arxiv:2610.00610",
          canonicalUrl: "https://arxiv.org/abs/2610.00610v1",
          locators: ["https://arxiv.org/abs/2610.00610v1"],
        });
        const next = LibrarySource.make({
          ...source,
          id: "legacy-second",
          revision: "v2",
          canonicalUrl: "https://arxiv.org/abs/2610.00609v2",
          locators: ["https://arxiv.org/abs/2610.00609v2"],
        });
        const catalog = LibraryCatalog.make({
          schema: "beep.research.library/v2",
          documents: [],
          sources: [source, other, next],
          occurrences: [],
          captures: [],
          qualifications: [],
        });
        const text = yield* S.encodeEffect(LibraryCatalogJson)(catalog);
        yield* fs.writeFileString(path.join(root, "catalog.json"), text);
        const migrated = yield* withCatalog(root, Effect.succeed);
        expect(migrated.sources.length).toBe(2);
        const merged = O.getOrThrow(A.findFirst(migrated.sources, (item) => item.identity === source.identity));
        expect(merged.aliasIds).toEqual([source.id, next.id]);
        expect(merged.locators).toEqual([...source.locators, ...next.locators]);
        expect(A.map(merged.versions, (version) => version.revision)).toEqual(["v1", "v2"]);
        expect(A.some(migrated.sources, (item) => item.identity === other.identity)).toBe(true);
        const persisted = yield* loadCatalog(root);
        expect(persisted).toEqual(migrated);
      })
    );
    it.effect("migrates legacy catalog IDs without overwriting original evidence or losing capture bindings", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "library-migration-" });
        const identity = "arxiv:2610.00609";
        const oldId = yield* hashBytes(new TextEncoder().encode(`${identity}\nv1`));
        const source = LibrarySource.make({
          id: oldId,
          identity,
          kind: "paper",
          canonicalUrl: "https://arxiv.org/abs/2610.00609v1",
          revision: "v1",
          repository: "",
          ownership: "external",
          locators: ["https://arxiv.org/abs/2610.00609v1"],
        });
        const occurrence = LibraryOccurrence.make({
          id: "occurrence",
          documentId: "document",
          sourceId: oldId,
          locator: source.canonicalUrl,
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 40,
          label: "",
          form: "url",
        });
        const capture = LibraryCapture.make({
          id: "capture",
          sourceId: oldId,
          status: "readable",
          method: "paper",
          recordedAt: "2026-10-06T00:00:00Z",
          capturedRevision: "v1",
          complete: true,
          artifacts: [],
          reason: "",
        });
        const legacy = LibraryCatalog.make({
          schema: "beep.research.library/v2",
          documents: [],
          sources: [source],
          occurrences: [occurrence],
          captures: [capture],
          qualifications: [],
        });
        const text = yield* S.encodeEffect(LibraryCatalogJson)(legacy);
        yield* fs.writeFileString(path.join(root, "catalog.json"), text);
        const migrated = yield* withCatalog(root, Effect.succeed);
        const newId = yield* hashBytes(new TextEncoder().encode(identity));
        expect(A.getUnsafe(migrated.sources, 0)).toMatchObject({ id: newId, aliasIds: [oldId] });
        expect(A.getUnsafe(migrated.occurrences, 0)).toMatchObject({ sourceId: newId, revision: "v1" });
        expect(A.getUnsafe(migrated.captures, 0)).toMatchObject({
          sourceId: newId,
          requestedRevision: "v1",
          capturedRevision: "v1",
        });
        const readFileString20 = yield* fs.readFileString(path.join(root, "catalog.json"));
        expect(readFileString20).toBe(text);
        const exists21 = yield* fs.exists(path.join(root, "catalog/library.json"));
        expect(exists21).toBe(true);
      })
    );
    it.effect("reconciles stale derived occurrences and topics while retaining the identical document snapshot", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-reconciliation-" });
        const input = path.join(temporary, "input");
        const root = path.join(temporary, "library");
        yield* fs.makeDirectory(input);
        yield* fs.writeFileString(
          path.join(input, "report.md"),
          "# Report\n## Effect agents\n[p] and [p][]\n[p]: https://arxiv.org/abs/2610.00609v1\n"
        );
        const options = LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [input] });
        const initial = yield* inventoryLibrary(options);
        yield* withCatalog(root, (catalog) =>
          Effect.succeed(
            LibraryCatalog.make({
              ...catalog,
              documents: A.map(catalog.documents, (document) =>
                LibraryDocument.make({ ...document, expectedOccurrences: 1, topics: [] })
              ),
              occurrences: A.filter(catalog.occurrences, (occurrence) => occurrence.form === "url"),
            })
          )
        );
        const reconciled = yield* inventoryLibrary(options);
        expect(A.getUnsafe(reconciled.documents, 0)?.id).toBe(A.getUnsafe(initial.documents, 0)?.id);
        expect(A.getUnsafe(reconciled.documents, 0)?.sha256).toBe(A.getUnsafe(initial.documents, 0)?.sha256);
        expect(A.getUnsafe(reconciled.documents, 0)?.topics).toContain("effect");
        expect(A.getUnsafe(reconciled.documents, 0)?.expectedOccurrences).toBe(3);
        expect(reconciled.occurrences).toHaveLength(3);
      })
    );
    it.effect("limits unquoted slash references to explicit repository evidence", () =>
      Effect.gen(function* () {
        expect(extractLibraryReferences("input/output America/Chicago iManage/TR skills/get")).toHaveLength(0);
        expect(extractLibraryReferences("Effect-TS/effect", ["effect-ts/effect"])).toHaveLength(1);
        expect(A.getUnsafe(extractLibraryReferences("`unknown/repository`"), 0)).toMatchObject({
          form: "repo-shorthand",
        });
      })
    );
    it.effect("preserves explicit unversioned citations across unrelated catalog writes and unions aliases", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "library-head-revision-" });
        const identity = "arxiv:2610.00609";
        const id = yield* hashBytes(new TextEncoder().encode(identity));
        const source = LibrarySource.make({
          id,
          identity,
          kind: "paper",
          canonicalUrl: "https://arxiv.org/abs/2610.00609v1",
          revision: "v1",
          repository: "",
          ownership: "external",
          locators: [],
          versions: [
            LibrarySourceVersion.make({
              revision: "v1",
              canonicalUrl: "https://arxiv.org/abs/2610.00609v1",
              locators: ["https://arxiv.org/abs/2610.00609v1"],
            }),
            LibrarySourceVersion.make({
              revision: "v1",
              canonicalUrl: "https://arxiv.org/abs/2610.00609v1",
              locators: ["https://arxiv.org/pdf/2610.00609v1"],
            }),
            LibrarySourceVersion.make({
              revision: "",
              canonicalUrl: "https://arxiv.org/abs/2610.00609",
              locators: ["https://arxiv.org/abs/2610.00609"],
            }),
          ],
        });
        const occurrence = LibraryOccurrence.make({
          id: "occurrence",
          documentId: "document",
          sourceId: id,
          revision: "",
          locator: "https://arxiv.org/abs/2610.00609",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 40,
          label: "",
          form: "url",
        });
        const capture = LibraryCapture.make({
          id: "capture",
          sourceId: id,
          status: "readable",
          method: "paper",
          recordedAt: "2026-10-06T00:00:00Z",
          capturedRevision: "",
          requestedRevision: "",
          complete: true,
          artifacts: [],
          reason: "",
        });
        yield* withCatalog(root, (catalog) =>
          Effect.succeed(
            LibraryCatalog.make({ ...catalog, sources: [source], occurrences: [occurrence], captures: [capture] })
          )
        );
        const result = yield* withCatalog(root, Effect.succeed);
        expect(A.getUnsafe(result.occurrences, 0)?.revision).toBe("");
        expect(A.getUnsafe(result.captures, 0)?.requestedRevision).toBe("");
        expect(
          O.getOrThrow(A.findFirst(A.getUnsafe(result.sources, 0).versions, (version) => version.revision === "v1"))
            .locators
        ).toHaveLength(2);
      })
    );
    it.effect("accepts concurrent identical object publication with one verified byte object", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "library-object-race-" });
        const bytes = new TextEncoder().encode("identical evidence");
        const results = yield* Effect.all(
          [saveImmutable(root, "one/raw.md", bytes), saveImmutable(root, "two/raw.md", bytes)],
          { concurrency: 2 }
        );
        expect(A.getUnsafe(results, 0)?.sha256).toBe(A.getUnsafe(results, 1)?.sha256);
        const readDirectory22 = yield* fs.readDirectory(path.join(root, "objects/sha256"));
        expect(readDirectory22).toHaveLength(1);
      })
    );
  }
);

it.effect.prop(
  "property: schema-generated LibraryArtifact round-trips through catalog JSON",
  { value: Arbitrary.schema(LibraryArtifact) },
  Effect.fnUntraced(function* ({ value }) {
    const encoded = yield* S.encodeEffect(LibraryArtifactJson)(value);
    const decoded = yield* S.decodeEffect(LibraryArtifactJson)(encoded);
    expect(decoded).toEqual(value);
  }),
  { arbitrary: fcRuns(32) }
);
