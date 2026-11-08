import { decodeFirecrawlScrapeBody, Firecrawl } from "@beep/firecrawl";
import { Git } from "@beep/git/Git";
import { N3TurtleCodecLive } from "@beep/n3";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import {
  acquireLibraryBox,
  classifyLibraryReference,
  extractLibraryReferences,
  hashBytes,
  importLibraryRoutedResult,
  inventoryLibraryWithHops,
  LibraryAlphaxivImportPayload,
  LibraryBoxAcquireOptions,
  LibraryCapture,
  LibraryCatalog,
  LibraryDerivation,
  LibraryDocument,
  LibraryFinding,
  LibraryHopGateInput,
  LibraryHopPolicy,
  LibraryImportOriginal,
  LibraryIntake,
  LibraryIntakeFile,
  LibraryInventoryOptions,
  LibraryOccurrence,
  LibraryPacketConcept,
  LibraryQualification,
  LibrarySource,
  LibrarySourceVersion,
  LibraryVidbeeImportPayload,
  libraryHopGate,
  libraryHopReport,
  libraryHopTotals,
  libraryLiveConcepts,
  libraryPacketConcepts,
  libraryRefusedHopTwo,
  librarySourceDomain,
  loadCatalog,
  recordLibraryHops,
  registerLibraryBoxSources,
  verifyLibrary,
  withCatalog,
} from "@beep/repo-cli/commands/Research";
import {
  acquireLibraryBoxFile,
  acquireLibrarySource,
  LibraryBoxFile,
  LibraryBoxFixture,
  libraryBoxAuthMode,
  libraryBoxSha1,
  libraryBoxSource,
  librarySourceEvidenceValid,
  makeLibraryBoxTest,
  saveLibraryText,
  validateLibraryBoxEvidence,
  validateLibraryRouteEvidence,
} from "@beep/repo-cli/test/ResearchLibrary";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import type * as HashSet from "effect/HashSet";

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const bytesOf = (text: string) => new TextEncoder().encode(text);
const encodeVidbee = S.encodeEffect(S.fromJsonString(LibraryVidbeeImportPayload));
const encodeAlphaxiv = S.encodeEffect(S.fromJsonString(LibraryAlphaxivImportPayload));

// A page that links onward, so a readable hop-1 capture yields a hop-2 identity.
const firecrawl = Firecrawl.makeTestLayer((request) =>
  encodeJson({
    success: true,
    data: {
      markdown: `# Article\n\nFull text. Further reading: https://other.org/next and ${request.url}.`,
      rawHtml: `<article>Full text of ${request.url}.</article>`,
      metadata: { sourceURL: request.url, statusCode: 200, contentType: "text/html" },
    },
  }).pipe(
    Effect.orDie,
    Effect.flatMap((body) => decodeFirecrawlScrapeBody(request.url, bytesOf(body)))
  )
);

const boxBytes = { shared: bytesOf("Identical exhibit bytes."), other: bytesOf("A different memo.") };
// A 202-folder chain, one past the Box selection bound.
const chain = A.makeBy(202, (i) => `f${i}`);
const boxFixture = Effect.gen(function* () {
  const sharedSha1 = yield* libraryBoxSha1(boxBytes.shared);
  const otherSha1 = yield* libraryBoxSha1(boxBytes.other);
  const memoSha1 = yield* libraryBoxSha1(bytesOf("Memo text."));
  return LibraryBoxFixture.make({
    folders: {
      ...R.fromEntries(A.map(chain, (id) => [id, A.empty<LibraryBoxFile>()] as const)),
      docs: [
        LibraryBoxFile.make({ id: "201", versionId: "3", name: "", sha1: memoSha1, size: 10 }),
        LibraryBoxFile.make({ id: "202", versionId: "1", name: "notes.md", sha1: memoSha1, size: 10 }),
      ],
      top: [
        LibraryBoxFile.make({ id: "101", versionId: "1", name: "exhibit.pdf", sha1: sharedSha1, size: 24 }),
        LibraryBoxFile.make({ id: "102", versionId: "1", name: "exhibit copy.pdf", sha1: sharedSha1, size: 24 }),
      ],
      nested: [LibraryBoxFile.make({ id: "103", versionId: "7", name: "memo.txt", sha1: otherSha1, size: 17 })],
      tampered: [
        LibraryBoxFile.make({ id: "104", versionId: "1", name: "bad.txt", sha1: Str.repeat(40)("0"), size: 17 }),
      ],
      versioned: [LibraryBoxFile.make({ id: "105", versionId: "2", name: "draft.txt", sha1: sharedSha1, size: 24 })],
      empty: [],
    },
    subfolders: {
      top: ["nested"],
      ...R.fromEntries(A.map(A.drop(chain, 1), (id, i) => [A.getUnsafe(chain, i), [id]] as const)),
    },
    bytes: {
      "101": boxBytes.shared,
      "102": boxBytes.shared,
      "103": boxBytes.other,
      "104": boxBytes.other,
      "105": boxBytes.other,
      "201": bytesOf("Memo text."),
      "202": bytesOf("Memo text."),
    },
  });
});
// The constructed fixture owns its download log; the Box test reads it from here.
let boxFixtureLog: ReadonlyArray<string> = [];
const boxLayer = Layer.unwrap(
  Effect.map(boxFixture, (fixture) => {
    boxFixtureLog = fixture.downloads;
    return makeLibraryBoxTest(fixture);
  })
).pipe(Layer.provide(NodeCrypto.layer));

const platform = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() => Effect.die("Unexpected fixture HTTP request"))
  ),
  firecrawl,
  boxLayer,
  N3TurtleCodecLive,
  ShaclValidationServiceLive,
  OxigraphSparqlQueryServiceLive
);
const services = Layer.provideMerge(Git.layer, platform);

const tempLibrary = Effect.fn("test.tempLibrary")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-routes-" });
  return { fs, path, temporary, root: path.join(temporary, "library") };
});

const original = Effect.fn("test.original")(function* (
  directory: string,
  name: string,
  text: string,
  mediaType: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bytes = bytesOf(text);
  yield* fs.writeFile(path.join(directory, name), bytes);
  const sha256 = yield* hashBytes(bytes);
  return LibraryImportOriginal.make({
    path: name,
    sha256,
    bytes: bytes.byteLength,
    mediaType,
  });
});

const seedSource = Effect.fn("test.seedSource")(function* (root: string, url: string) {
  const source = yield* classifyLibraryReference(url, "report");
  yield* withCatalog(root, (catalog) => Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [source] })));
  return source;
});

describe("research library routes", () => {
  layer(services, { timeout: "60 seconds" })((it) => {
    it.effect("acquires a Box folder with one receipt per file, shared objects and resumable reruns", () =>
      Effect.gen(function* () {
        const { root, fs, path } = yield* tempLibrary();
        const before = boxFixtureLog.length;
        const options = LibraryBoxAcquireOptions.make({ folderIds: ["top"], fileIds: [] });
        const first = yield* acquireLibraryBox(root, options);
        const boxSources = A.filter(first.sources, (source) => Str.startsWith("box:")(source.identity));
        expect(boxSources).toHaveLength(3);
        expect(A.every(boxSources, (source) => source.accessClass === "private")).toBe(true);
        expect(
          A.map(
            A.filter(first.qualifications, (q) => q.adapter === "box"),
            (q) => q.status
          )
        ).toEqual(["verified"]);
        for (const source of boxSources) {
          const captures = A.filter(first.captures, (capture) => capture.sourceId === source.id);
          expect(A.map(captures, (capture) => [capture.method, capture.status])).toEqual([["box", "readable"]]);
          const capture = A.getUnsafe(captures, 0);
          expect(capture.capturedRevision).toBe(`${Str.slice(4)(source.identity)}:${source.revision}`);
          const observed1 = yield* librarySourceEvidenceValid(root, source, capture);
          expect(observed1).toBe(true);
        }
        const hashes = A.map(
          A.filter(
            A.flatMap(first.captures, (capture) => capture.artifacts),
            (artifact) => artifact.role === "raw-full-text"
          ),
          (artifact) => artifact.sha256
        );
        expect(A.dedupe(hashes)).toHaveLength(2);
        const observed2 = yield* fs.exists(path.join(root, "objects/sha256", A.getUnsafe(hashes, 0)));
        expect(observed2).toBe(true);
        expect(A.sort(A.drop(boxFixtureLog, before), Str.Order)).toEqual(["101", "102", "103"]);

        yield* acquireLibraryBox(root, options);
        expect(boxFixtureLog).toHaveLength(before + 3);
      })
    );

    it.effect("accepts a readable Box capture's version in verify", () =>
      Effect.gen(function* () {
        const { root } = yield* tempLibrary();
        yield* acquireLibraryBox(root, LibraryBoxAcquireOptions.make({ folderIds: ["nested"], fileIds: [] }));
        const failure = yield* verifyLibrary(root).pipe(Effect.flip);
        expect(failure.message).not.toContain("revision differs from source versions");
        expect(failure.message).not.toContain("Box requested version differs");
      })
    );

    it.effect("downloads a superseded Box version against its retained listing SHA-1", () =>
      Effect.gen(function* () {
        const { root } = yield* tempLibrary();
        const otherSha1 = yield* libraryBoxSha1(boxBytes.other);
        const superseded = LibraryBoxFile.make({
          id: "105",
          versionId: "1",
          name: "draft.txt",
          sha1: otherSha1,
          size: 17,
        });
        const listingText = yield* encodeJson({ folderIds: [], fileIds: ["105"], files: [superseded] });
        yield* withCatalog(root, (catalog) => Effect.succeed(catalog));
        const listing = yield* saveLibraryText(
          root,
          "receipts/box/old.json",
          listingText,
          "application/json",
          "box-listing"
        );
        const source = yield* libraryBoxSource(superseded, "private");
        yield* withCatalog(root, (catalog) =>
          Effect.succeed(
            LibraryCatalog.make({ ...catalog, sources: [source], artifacts: [...catalog.artifacts, listing] })
          )
        );
        const capture = yield* acquireLibrarySource(root, source);
        expect([capture.status, capture.capturedRevision]).toEqual(["readable", "105:1"]);
        const valid = yield* librarySourceEvidenceValid(root, source, capture);
        expect(valid).toBe(true);
      })
    );

    it.effect("keeps a Box download whose SHA-1 differs from Box blocked", () =>
      Effect.gen(function* () {
        const { root } = yield* tempLibrary();
        const catalog = yield* acquireLibraryBox(
          root,
          LibraryBoxAcquireOptions.make({ folderIds: ["tampered"], fileIds: [] })
        );
        expect(A.map(catalog.captures, (capture) => capture.status)).toEqual(["blocked"]);
        expect(A.map(catalog.qualifications, (q) => q.status)).toEqual(["failed"]);
      })
    );

    it.effect("imports a VidBee bundle bound to its media hash and records the model run", () =>
      Effect.gen(function* () {
        const { root, temporary, fs, path } = yield* tempLibrary();
        const source = yield* seedSource(root, "https://www.youtube.com/watch?v=tTcxVv8HHNw");
        const faq = (media: string, model: string) =>
          `---\ntitle: "Talk"\nskill: "generate-faq"\nmodel: "${model}"\ngenerated_at: "2026-11-06T20:21:43.769Z"\nmedia: "${media}"\nsource_url: "${source.canonicalUrl}"\n---\n\n# Why?\nBecause.\n`;
        const payload = Effect.fn("test.vidbeePayload")(function* (faqOriginal: LibraryImportOriginal) {
          const media = yield* original(temporary, "0.mkv", "matroska bytes", "video/x-matroska");
          const transcript = yield* original(
            temporary,
            "0.en.vtt",
            "WEBVTT\n\n00:00.000 --> 00:01.000\nHello.\n",
            "text/vtt"
          );
          return LibraryVidbeeImportPayload.make({
            kind: "vidbee",
            sourceId: source.id,
            canonicalUrl: source.canonicalUrl,
            media,
            transcript,
            faq: faqOriginal,
          });
        });
        const write = Effect.fn("test.writeVidbee")(function* (value: LibraryVidbeeImportPayload, name: string) {
          const manifest = path.join(temporary, name);
          const text = yield* encodeVidbee(value);
          yield* fs.writeFileString(manifest, text);
          return manifest;
        });
        const goodFaq = yield* original(
          temporary,
          "generate-faq.md",
          faq("./0.mkv", "gpt-6.1-sol(medium)"),
          "text/markdown"
        );
        const good = yield* payload(goodFaq);
        const catalog = yield* write(good, "vidbee.json").pipe(
          Effect.flatMap((manifest) => importLibraryRoutedResult(root, manifest))
        );
        const capture = A.getUnsafe(
          A.filter(catalog.captures, (item) => item.method === "vidbee"),
          0
        );
        expect(capture.status).toBe("readable");
        expect(A.map(capture.artifacts, (artifact) => artifact.role)).toEqual([
          "import-manifest",
          "media-binding",
          "raw-full-text",
          "ai-interpretation",
        ]);
        expect(A.some(capture.artifacts, (artifact) => artifact.mediaType === "video/x-matroska")).toBe(false);
        expect(A.map(catalog.modelRuns, (run) => [run.model, run.effort, run.route])).toEqual([
          ["gpt-6.1-sol", "medium", "vidbee"],
        ]);
        const observed3 = yield* librarySourceEvidenceValid(root, source, capture);
        expect(observed3).toBe(true);

        const wrongHash = LibraryVidbeeImportPayload.make({
          ...good,
          media: LibraryImportOriginal.make({ ...good.media, sha256: Str.repeat(64)("0") }),
        });
        const hashError = yield* write(wrongHash, "hash.json").pipe(
          Effect.flatMap((manifest) => importLibraryRoutedResult(root, manifest)),
          Effect.flip
        );
        expect(hashError.message).toContain("hash or size mismatch");

        const unboundFaq = yield* original(temporary, "unbound.md", faq("./other.mkv", "gpt-6.1-sol"), "text/markdown");
        const unbound = yield* payload(unboundFaq);
        const bindingError = yield* write(unbound, "unbound.json").pipe(
          Effect.flatMap((manifest) => importLibraryRoutedResult(root, manifest)),
          Effect.flip
        );
        expect(bindingError.message).toContain("does not bind the referenced media");
      })
    );

    it.effect("imports alphaXiv full text for an arXiv version and catalogues references at hop 2", () =>
      Effect.gen(function* () {
        const { root, temporary, fs, path } = yield* tempLibrary();
        const source = yield* seedSource(root, "https://arxiv.org/abs/2610.00609");
        const fullText = yield* original(temporary, "paper.txt", Str.repeat(80)("Full paper sentence. "), "text/plain");
        const write = Effect.fn("test.writeAlpha")(function* (value: LibraryAlphaxivImportPayload, name: string) {
          const manifest = path.join(temporary, name);
          const text = yield* encodeAlphaxiv(value);
          yield* fs.writeFileString(manifest, text);
          return manifest;
        });
        const payload = LibraryAlphaxivImportPayload.make({
          kind: "alphaxiv",
          sourceId: source.id,
          canonicalUrl: source.canonicalUrl,
          arxivId: "2610.00609",
          version: "v2",
          fullText,
          references: [
            { arxivId: "2501.00001", url: "", title: "Cited arXiv paper" },
            { arxivId: "", url: "https://example.org/benchmark", title: "Cited page" },
          ],
        });
        const catalog = yield* write(payload, "alpha.json").pipe(
          Effect.flatMap((manifest) => importLibraryRoutedResult(root, manifest))
        );
        const capture = A.getUnsafe(
          A.filter(catalog.captures, (item) => item.method === "alphaxiv"),
          0
        );
        expect([capture.status, capture.capturedRevision]).toEqual(["readable", "v2"]);
        const observed4 = yield* librarySourceEvidenceValid(root, source, capture);
        expect(observed4).toBe(true);
        const edges = A.filter(catalog.derivations, (edge) => edge.sourceId === source.id);
        expect(A.map(edges, (edge) => edge.hopDepth)).toEqual([2, 2]);
        expect(A.some(catalog.captures, (item) => A.some(edges, (edge) => edge.derivedId === item.sourceId))).toBe(
          false
        );
        expect(A.some(catalog.sources, (item) => item.identity === "arxiv:2501.00001")).toBe(true);

        const mismatched = LibraryAlphaxivImportPayload.make({ ...payload, arxivId: "2610.00610" });
        const identityError = yield* write(mismatched, "mismatch.json").pipe(
          Effect.flatMap((manifest) => importLibraryRoutedResult(root, manifest)),
          Effect.flip
        );
        expect([identityError.cause, identityError.message]).toEqual([
          "identity",
          "alphaXiv arXiv id 2610.00610 does not match source arxiv:2610.00609.",
        ]);
        const corrupt = LibraryAlphaxivImportPayload.make({
          ...payload,
          fullText: LibraryImportOriginal.make({ ...fullText, bytes: fullText.bytes + 1 }),
        });
        const hashError = yield* write(corrupt, "corrupt.json").pipe(
          Effect.flatMap((manifest) => importLibraryRoutedResult(root, manifest)),
          Effect.flip
        );
        expect(hashError.message).toContain("hash or size mismatch");
      })
    );

    it.effect("records hop-1 derivations at inventory and hop-2 identities from readable hop-1 captures", () =>
      Effect.gen(function* () {
        const { root, temporary, fs, path } = yield* tempLibrary();
        const input = path.join(temporary, "input");
        yield* fs.makeDirectory(input, { recursive: true });
        yield* fs.writeFileString(
          path.join(input, "report.md"),
          "# Report 2026-11-06\n\n## Sources\n\nSee https://example.com/article for details.\n"
        );
        const options = LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [input] });
        const first = yield* inventoryLibraryWithHops(options);
        expect(A.map(first.derivations, (edge) => edge.hopDepth)).toEqual(A.map(first.occurrences, () => 1));
        const article = O.getOrThrow(
          A.findFirst(first.sources, (source) => source.canonicalUrl === "https://example.com/article")
        );
        const capture = yield* acquireLibrarySource(root, article);
        expect(capture.status).toBe("readable");
        const second = yield* inventoryLibraryWithHops(options);
        const next = O.getOrThrow(
          A.findFirst(second.sources, (source) => source.canonicalUrl === "https://other.org/next")
        );
        const edges = A.filter(second.derivations, (edge) => edge.derivedId === next.id);
        expect(A.map(edges, (edge) => [edge.hopDepth, edge.sourceId])).toEqual([[2, article.id]]);
        expect(second.derivations.length).toBe(first.derivations.length + 1);
        const third = yield* inventoryLibraryWithHops(options);
        expect(third.derivations).toEqual(second.derivations);
        const current = yield* loadCatalog(root);
        const totals = yield* libraryHopTotals(root, current);
        expect(totals).toEqual([
          `hop 0: documents=1 citations=${second.occurrences.length}`,
          `hop 1: identities=${A.dedupe(A.map(second.occurrences, (o) => o.sourceId)).length} readable=1`,
          "hop 2: identities=1 readable=0 cataloguedOnly=1 gateAdmitted=0 gateRefused=1 (unrouted-parent=1)",
        ]);
      })
    );

    it.effect("derives hops only for the intake the current inventory recorded", () =>
      Effect.gen(function* () {
        const { root, temporary, fs, path } = yield* tempLibrary();
        const october = path.join(temporary, "october");
        const november = path.join(temporary, "november");
        yield* fs.makeDirectory(october, { recursive: true });
        yield* fs.makeDirectory(november, { recursive: true });
        yield* fs.writeFileString(path.join(october, "old.md"), "# Old 2026-10-06\n\nSee https://example.com/old.\n");
        yield* fs.writeFileString(path.join(november, "new.md"), "# New 2026-11-06\n\nSee https://example.com/new.\n");
        const first = yield* inventoryLibraryWithHops(
          LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [october] })
        );
        const octoberIntake = O.getOrThrow(A.last(first.intakes));
        const octoberEdges = A.filter(first.derivations, (edge) => edge.intakeId === octoberIntake.id);
        expect(octoberEdges.length).toBeGreaterThan(0);
        const second = yield* inventoryLibraryWithHops(
          LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [november] })
        );
        // The earlier intake keeps exactly its own edges; the new run adds edges only for its intake.
        expect(A.filter(second.derivations, (edge) => edge.intakeId === octoberIntake.id)).toEqual(octoberEdges);
        const novemberIds = A.map(
          A.filter(second.intakes, (intake) => intake.id !== octoberIntake.id),
          (intake) => intake.id
        );
        const added = A.filter(second.derivations, (edge) => edge.intakeId !== octoberIntake.id);
        expect(added.length).toBeGreaterThan(0);
        expect(A.every(added, (edge) => A.contains(novemberIds, edge.intakeId))).toBe(true);
        // Status scoped to the earlier intake counts only its own documents and hop-1 identities.
        const scoped = yield* libraryHopTotals(root, second, undefined, O.some(octoberIntake.id));
        const octoberHopOne = A.dedupe(
          A.map(
            A.filter(octoberEdges, (edge) => edge.hopDepth === 1),
            (edge) => edge.derivedId
          )
        );
        expect(scoped[0]).toMatch(/^hop 0: documents=1 /);
        expect(scoped[1]).toBe(`hop 1: identities=${octoberHopOne.length} readable=0`);
      })
    );

    it.effect("computes hop totals over tens of thousands of hop-2 identities in linear time", () =>
      Effect.gen(function* () {
        const { root } = yield* tempLibrary();
        const count = 20_000;
        const parent = LibrarySource.make({
          id: "parent",
          kind: "web",
          canonicalUrl: "https://example.com/parent",
          identity: "https://example.com/parent",
          revision: "",
          repository: "",
          ownership: "external",
          locators: [],
        });
        const children = A.makeBy(count, (i) =>
          LibrarySource.make({
            id: `child-${i}`,
            kind: "web",
            canonicalUrl: `https://example.com/child-${i}`,
            identity: `https://example.com/child-${i}`,
            revision: "",
            repository: "",
            ownership: "external",
            locators: [],
          })
        );
        const derivations = A.makeBy(count, (i) =>
          LibraryDerivation.make({
            id: `edge-${i}`,
            derivedId: `child-${i}`,
            sourceId: "parent",
            intakeId: "intake",
            rootId: "report",
            hopDepth: 2,
            recordedAt: "2026-11-07T00:00:00.000Z",
          })
        );
        const catalog = LibraryCatalog.make({
          schema: "beep.research.library/v2",
          documents: [],
          sources: [parent, ...children],
          occurrences: [],
          captures: [],
          qualifications: [],
          derivations,
        });
        const [elapsed, totals] = yield* libraryHopTotals(root, catalog).pipe(Effect.timed, TestClock.withLive);
        expect(Duration.toMillis(elapsed)).toBeLessThan(10_000);
        expect(totals[2]).toContain(`hop 2: identities=${count} readable=0 cataloguedOnly=${count}`);
      })
    );

    it.effect("reads live goal and exploration concepts from packet manifests", () =>
      Effect.gen(function* () {
        const { temporary, fs, path } = yield* tempLibrary();
        const manifest = Effect.fn("test.manifest")(function* (kind: string, slug: string, body: unknown) {
          yield* fs.makeDirectory(path.join(temporary, kind, slug, "ops"), { recursive: true });
          const text = yield* encodeJson(body);
          yield* fs.writeFileString(path.join(temporary, kind, slug, "ops/manifest.json"), text);
        });
        yield* manifest("goals", "paused-goal", { initiative: { id: "paused-goal", status: "paused" } });
        yield* manifest("goals", "done-goal", { initiative: { id: "done-goal", status: "completed-retained" } });
        yield* manifest("explorations", "open", { exploration: { slug: "open", status: "research" } });
        yield* manifest("explorations", "closed", { exploration: { slug: "closed", status: "graduated" } });
        const concepts = yield* libraryPacketConcepts(temporary, LibraryHopPolicy.make({}));
        expect(A.map(concepts, (concept) => [concept.id, concept.live])).toEqual([
          ["goals/done-goal", false],
          ["goals/paused-goal", true],
          ["explorations/closed", false],
          ["explorations/open", true],
        ]);
      })
    );
  });

  describe("hop-2 gate", () => {
    const web = (id: string, url: string, kind: LibrarySource["kind"] = "web") =>
      LibrarySource.make({
        id,
        kind,
        canonicalUrl: url,
        identity: kind === "paper" ? `arxiv:${id}` : url,
        revision: "",
        repository: "",
        ownership: "external",
        locators: [url],
      });
    const routedParent = web("routed", "https://example.com/routed");
    const unroutedParent = web("unrouted", "https://example.com/unrouted");
    const githubParent = web("gh-parent", "https://github.com/acme/tool", "github-repository");
    const children = [
      web("child-routed", "https://other.org/routed"),
      web("child-unrouted", "https://other.org/unrouted"),
      web("child-github", "https://github.com/acme/child", "github-repository"),
      web("child-github-url", "https://github.com/acme"),
      web("child-of-github", "https://other.org/of-github"),
      web("2501.00001", "https://arxiv.org/abs/2501.00001", "paper"),
      ...A.map(A.range(1, 30), (n) =>
        web(`cap-${Str.padStart(2, "0")(`${n}`)}`, `https://cap.org/${Str.padStart(2, "0")(`${n}`)}`)
      ),
    ];
    const parentOf = (child: LibrarySource) =>
      child.id === "child-unrouted" ? unroutedParent : child.id === "child-of-github" ? githubParent : routedParent;
    const edge = (hopDepth: number, sourceId: string, derivedId: string) =>
      LibraryDerivation.make({
        id: `${hopDepth}:${sourceId}:${derivedId}`,
        derivedId,
        sourceId,
        intakeId: "intake",
        rootId: "doc",
        hopDepth,
        recordedAt: "2026-11-06",
      });
    const occurrence = (source: LibrarySource) =>
      LibraryOccurrence.make({
        id: `o-${source.id}`,
        documentId: "doc",
        sourceId: source.id,
        locator: source.canonicalUrl,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 2,
        label: "",
        form: "url",
      });
    const finding = (source: LibrarySource, topic: string) =>
      LibraryFinding.make({
        id: `f-${source.id}`,
        sourceId: source.id,
        citoRelation: "discusses",
        summary: "Relevant.",
        topicIds: [topic],
        recordedAt: "2026-11-06",
      });
    const parents = [routedParent, unroutedParent, githubParent];
    const catalog = LibraryCatalog.make({
      schema: "beep.research.library/v2",
      documents: [
        LibraryDocument.make({
          id: "doc",
          originalPath: "/r.md",
          snapshotPath: "intakes/r.md",
          sha256: Str.repeat(64)("a"),
          bytes: 1,
          title: "R",
          reportDate: "",
          expectedOccurrences: 3,
        }),
      ],
      sources: [...parents, ...children],
      occurrences: A.map(parents, occurrence),
      derivations: [
        ...A.map(parents, (parent) => edge(1, "doc", parent.id)),
        ...A.map(children, (child) => edge(2, parentOf(child).id, child.id)),
      ],
      findings: [
        finding(routedParent, "goals/live-goal"),
        finding(unroutedParent, "goals/done-goal"),
        finding(githubParent, "goals/live-goal"),
      ],
      captures: [],
      qualifications: [],
    });
    const concepts = [
      LibraryPacketConcept.make({ id: "goals/live-goal", initiativeId: "live-goal", status: "active", live: true }),
      LibraryPacketConcept.make({
        id: "goals/done-goal",
        initiativeId: "done-goal",
        status: "completed-retained",
        live: false,
      }),
    ];
    const decide = (explicit: ReadonlyArray<string> = []) => {
      const decisions = libraryHopGate(
        catalog,
        LibraryHopGateInput.make({ concepts, policy: LibraryHopPolicy.make({}), explicit })
      );
      return (id: string) => {
        const decision = O.getOrThrow(A.findFirst(decisions, (item) => item.sourceId === id));
        return [decision.admitted, decision.reason];
      };
    };

    // A small gate catalog: routed hop-1 parents p1..p3, an unrouted parent u, and the given children.
    const gateParents = [
      ...A.map(["p1", "p2", "p3"], (id) => web(id, `https://parents.org/${id}`)),
      web("u", "https://parents.org/u"),
    ];
    const gate = (
      entries: ReadonlyArray<{ readonly source: LibrarySource; readonly parents: ReadonlyArray<string> }>,
      policy: LibraryHopPolicy = LibraryHopPolicy.make({}),
      capturedIds: ReadonlyArray<string> = []
    ) =>
      libraryHopGate(
        LibraryCatalog.make({
          schema: "beep.research.library/v2",
          documents: [],
          sources: [...gateParents, ...A.map(entries, (entry) => entry.source)],
          occurrences: A.map(gateParents, occurrence),
          derivations: [
            ...A.map(gateParents, (parent) => edge(1, "doc", parent.id)),
            ...A.flatMap(entries, (entry) => A.map(entry.parents, (parentId) => edge(2, parentId, entry.source.id))),
          ],
          findings: A.map(gateParents, (parent) =>
            finding(parent, parent.id === "u" ? "goals/done-goal" : "goals/live-goal")
          ),
          captures: A.map(capturedIds, (sourceId) =>
            LibraryCapture.make({
              id: `capture-${sourceId}`,
              sourceId,
              status: "readable",
              method: "firecrawl",
              recordedAt: "2026-11-07",
              capturedRevision: "",
              requestedRevision: "",
              complete: true,
              artifacts: [],
              reason: "",
            })
          ),
          qualifications: [],
        }),
        LibraryHopGateInput.make({ concepts, policy })
      );
    // In-degree counts routed parents only: `a` has one routed and one unrouted parent.
    const budgetCandidates = [
      { source: web("a", "https://b.org/a"), parents: ["p1", "u"] },
      { source: web("m", "https://d.org/m"), parents: ["p1", "p2"] },
      { source: web("t2", "https://c.org/t2"), parents: ["p2", "p3"] },
      { source: web("z", "https://z.org/z"), parents: ["p1", "p2", "p3"] },
      { source: web("t1", "https://a.org/t1"), parents: ["p1", "p3"] },
    ];

    layer(Layer.empty)((it) => {
      it.effect("admits a child of a parent routed to a live packet concept", () =>
        Effect.sync(() => expect(decide()("child-routed")).toEqual([true, "routed-parent"]))
      );
      it.effect("refuses a child whose parent finding routes only to a closed packet", () =>
        Effect.sync(() => expect(decide()("child-unrouted")).toEqual([false, "unrouted-parent"]))
      );
      it.effect("never acquires GitHub transitively, as a child or through a GitHub parent", () =>
        Effect.sync(() => {
          expect(decide()("child-github")).toEqual([false, "github-not-transitive"]);
          expect(decide()("child-of-github")).toEqual([false, "github-not-transitive"]);
          // A github.com link the classifier left as web is still GitHub.
          expect(decide()("child-github-url")).toEqual([false, "github-not-transitive"]);
        })
      );
      it.effect("catalogues arXiv hop 2 and acquires it only on explicit demand", () =>
        Effect.sync(() => {
          expect(decide()("2501.00001")).toEqual([false, "arxiv-catalogue-only"]);
          expect(decide(["2501.00001"])("2501.00001")).toEqual([true, "arxiv-on-demand"]);
        })
      );
      it.effect("holds the per-domain cap at 25 per intake", () =>
        Effect.sync(() => {
          const decisions = libraryHopGate(
            catalog,
            LibraryHopGateInput.make({ concepts, policy: LibraryHopPolicy.make({}) })
          );
          const capped = A.filter(decisions, (decision) => decision.domain === "cap.org");
          expect(A.filter(capped, (decision) => decision.admitted)).toHaveLength(25);
          expect(
            A.map(
              A.filter(capped, (decision) => !decision.admitted),
              (decision) => decision.reason
            )
          ).toEqual(A.replicate("domain-cap", 5));
          expect(
            A.map(
              A.filter(capped, (decision) => !decision.admitted),
              (decision) => decision.sourceId
            )
          ).toEqual(["cap-26", "cap-27", "cap-28", "cap-29", "cap-30"]);
        })
      );
      it.effect("refuses reserved, IP-literal and static-asset hop-2 URLs as non-content", () =>
        Effect.sync(() => {
          const urls = [
            "http://a.example/",
            "https://www.example.com/page",
            "https://docs.example.org/x",
            "http://localhost:8888/",
            "https://site.test/post",
            "https://service.invalid/",
            "http://0.0.0.0:8888/",
            "http://[::1]:3000/api",
            "https://api-rsrc.hyper.ai/figure-1.PNG",
            "https://cdn.site.org/bundle.tar.gz?v=2",
            "https://fonts.site.org/inter.woff2",
          ];
          const decisions = gate(
            A.map(urls, (url, i) => ({ source: web(`junk-${i}`, url), parents: ["p1"] })),
            LibraryHopPolicy.make({})
          );
          expect(A.map(decisions, (decision) => decision.reason)).toEqual(A.replicate("non-content", urls.length));
          const kept = gate([{ source: web("article", "https://site.org/figures.html"), parents: ["p1"] }]);
          expect(A.map(kept, (decision) => [decision.admitted, decision.reason])).toEqual([[true, "routed-parent"]]);
        })
      );
      it.effect("spends the hop-2 budget by routed in-degree, ties by canonical URL", () =>
        Effect.sync(() => {
          const decisions = gate(budgetCandidates, LibraryHopPolicy.make({ hop2Limit: 3 }));
          expect(
            A.map(decisions, (decision) => [
              decision.sourceId,
              decision.routedInDegree,
              decision.admitted,
              decision.reason,
            ])
          ).toEqual([
            ["z", 3, true, "routed-parent"],
            ["t1", 2, true, "routed-parent"],
            ["t2", 2, true, "routed-parent"],
            ["m", 2, false, "budget"],
            ["a", 1, false, "budget"],
          ]);
        })
      );
      it.effect("counts already-captured hop-2 sources against the budget", () =>
        Effect.sync(() => {
          const decisions = gate(budgetCandidates, LibraryHopPolicy.make({ hop2Limit: 3 }), ["a"]);
          expect(A.map(decisions, (decision) => [decision.sourceId, decision.admitted, decision.reason])).toEqual([
            ["z", true, "routed-parent"],
            ["t1", true, "routed-parent"],
            ["t2", false, "budget"],
            ["m", false, "budget"],
            ["a", true, "routed-parent"],
          ]);
        })
      );
      it.effect("applies the default hop-2 budget of 400", () =>
        Effect.sync(() => {
          expect(LibraryHopPolicy.make({}).hop2Limit).toBe(400);
          const decisions = gate(
            A.makeBy(401, (i) => ({
              source: web(`d-${Str.padStart(3, "0")(`${i}`)}`, `https://d-${Str.padStart(3, "0")(`${i}`)}.org/paper`),
              parents: ["p1"],
            })),
            LibraryHopPolicy.make({})
          );
          expect(A.filter(decisions, (decision) => decision.admitted)).toHaveLength(400);
          expect(
            A.map(
              A.filter(decisions, (decision) => !decision.admitted),
              (decision) => [decision.sourceId, decision.reason]
            )
          ).toEqual([["d-400", "budget"]]);
        })
      );
    });

    layer(services, { timeout: "60 seconds" })((it) => {
      it.effect(
        "admits a captured hop-2 child, merges a child with two parents and refuses a parentless hop-3 source",
        () =>
          Effect.sync(() => {
            const first = web("r", "https://example.com/r");
            const second = web("r2", "https://example.com/r2");
            const shared = web("shared", "https://other.org/shared");
            const captured = web("captured-child", "https://other.org/captured");
            const deep = web("deep", "https://other.org/deep");
            const deepCatalog = LibraryCatalog.make({
              schema: "beep.research.library/v2",
              documents: [],
              sources: [first, second, shared, captured, deep],
              occurrences: [],
              derivations: [
                edge(1, "doc", "r"),
                edge(1, "doc", "r2"),
                edge(2, "r", "shared"),
                edge(2, "r2", "shared"),
                edge(2, "r", "captured-child"),
                edge(3, "shared", "deep"),
              ],
              findings: [
                LibraryFinding.make({ ...finding(first, "goals/live-goal"), id: "f-r-live" }),
                LibraryFinding.make({ ...finding(first, "goals/done-goal"), id: "f-r-done" }),
                LibraryFinding.make({ ...finding(second, "goals/live-goal"), id: "f-r2-live" }),
              ],
              captures: [
                LibraryCapture.make({
                  id: "capture",
                  sourceId: "captured-child",
                  status: "readable",
                  method: "firecrawl",
                  recordedAt: "2026-11-06",
                  capturedRevision: "",
                  complete: true,
                  artifacts: [],
                  reason: "",
                }),
              ],
              qualifications: [],
            });
            const decisions = libraryHopGate(
              deepCatalog,
              LibraryHopGateInput.make({ concepts, policy: LibraryHopPolicy.make({ domainCap: 1 }) })
            );
            expect(
              A.map(decisions, (decision) => [
                decision.sourceId,
                decision.intakeId,
                decision.parentIds,
                decision.routedInDegree,
                decision.admitted,
                decision.reason,
              ])
            ).toEqual([
              ["shared", "intake", ["r", "r2"], 2, false, "domain-cap"],
              ["captured-child", "intake", ["r"], 1, true, "routed-parent"],
              ["deep", "", [], 0, false, "unrouted-parent"],
            ]);
          })
      );

      it.effect("derives every intake when none is named, reusing each parent's scan", () =>
        Effect.gen(function* () {
          const { root } = yield* tempLibrary();
          const document = (id: string) =>
            LibraryDocument.make({
              id,
              originalPath: `/${id}.md`,
              snapshotPath: `intakes/${id}.md`,
              sha256: Str.repeat(64)("a"),
              bytes: 1,
              title: id,
              reportDate: "",
              expectedOccurrences: 1,
            });
          const intake = (id: string, documentId: string) =>
            LibraryIntake.make({
              id,
              date: "2026-11-06",
              createdAt: "2026-11-06T00:00:00.000Z",
              repoCommit: "",
              inputRoots: [],
              manifestPath: `intakes/${id}.json`,
              files: [
                LibraryIntakeFile.make({
                  originalPath: `/${documentId}.md`,
                  snapshotPath: `intakes/${documentId}.md`,
                  sha256: Str.repeat(64)("a"),
                  bytes: 1,
                  parseable: true,
                }),
              ],
            });
          const cites = (documentId: string, sourceId: string) =>
            LibraryOccurrence.make({ ...occurrence(web(sourceId, "")), id: `${documentId}-${sourceId}`, documentId });
          const aliased = LibrarySource.make({ ...web("p", "https://example.com/p"), aliasIds: ["p-alias"] });
          const intakeCatalog = LibraryCatalog.make({
            schema: "beep.research.library/v2",
            documents: [document("d1"), document("d2")],
            intakes: [intake("i1", "d1"), intake("i2", "d2")],
            sources: [aliased, web("q", "https://example.com/q")],
            occurrences: [cites("d1", "p"), cites("d1", "q"), cites("d1", "ghost"), cites("d2", "p")],
            captures: [],
            qualifications: [],
          });
          const recorded = yield* recordLibraryHops(root, intakeCatalog, "2026-11-07T00:00:00.000Z");
          expect(
            A.sort(
              A.map(recorded.derivations, (edge) => `${edge.intakeId}:${edge.hopDepth}:${edge.derivedId}`),
              Str.Order
            )
          ).toEqual(["i1:1:ghost", "i1:1:p", "i1:1:q", "i2:1:p"]);
          expect(recorded.sources).toEqual(intakeCatalog.sources);
        })
      );

      it.effect("counts a captured hop-1 identity without a source as unreadable", () =>
        Effect.gen(function* () {
          const { root } = yield* tempLibrary();
          const orphanCatalog = LibraryCatalog.make({
            schema: "beep.research.library/v2",
            documents: [],
            sources: [],
            occurrences: [],
            derivations: [edge(1, "doc", "orphan")],
            captures: [
              LibraryCapture.make({
                id: "orphan-capture",
                sourceId: "orphan",
                status: "readable",
                method: "firecrawl",
                recordedAt: "2026-11-06",
                capturedRevision: "",
                complete: true,
                artifacts: [],
                reason: "",
              }),
            ],
            qualifications: [],
          });
          const totals = yield* libraryHopTotals(root, orphanCatalog);
          expect(A.getUnsafe(totals, 1)).toBe("hop 1: identities=1 readable=0");
        })
      );

      it.effect("prints the hop report and lists refusals, admitting arXiv only on demand", () =>
        Effect.gen(function* () {
          const { root } = yield* tempLibrary();
          const policy = LibraryHopPolicy.make({});
          // The report reads the live packet concepts of this repository, so route through one of them.
          const live = yield* libraryLiveConcepts(policy);
          const topic = O.getOrThrow(A.findFirst(live, (concept) => concept.live)).id;
          const routed = web("rp", "https://example.com/rp");
          const unrouted = web("up", "https://example.com/up");
          const kids = [
            web("child-a", "https://other.org/a"),
            web("child-b", "https://other.org/b"),
            web("2501.00002", "https://arxiv.org/abs/2501.00002", "paper"),
          ];
          const reportCatalog = LibraryCatalog.make({
            schema: "beep.research.library/v2",
            documents: [],
            sources: [routed, unrouted, ...kids],
            occurrences: [],
            derivations: [
              edge(1, "doc", "rp"),
              edge(1, "doc", "up"),
              edge(2, "rp", "child-a"),
              edge(2, "up", "child-b"),
              edge(2, "rp", "2501.00002"),
            ],
            findings: [finding(routed, topic)],
            captures: [],
            qualifications: [],
          });
          yield* withCatalog(root, () => Effect.succeed(reportCatalog));
          // The test environment's TestConsole records the report.
          const lines = yield* libraryHopReport(root, 10, policy).pipe(Effect.andThen(TestConsole.logLines));
          expect(A.drop(lines, 3)).toEqual([
            "admit routed-parent in=1 other.org child-a https://other.org/a",
            "refuse arxiv-catalogue-only in=1 arxiv.org 2501.00002 https://arxiv.org/abs/2501.00002",
            "refuse unrouted-parent in=0 other.org child-b https://other.org/b",
          ]);
          const sorted = (ids: HashSet.HashSet<string>) => A.sort(A.fromIterable(ids), Str.Order);
          const refused = yield* libraryRefusedHopTwo(reportCatalog, policy, []);
          const onDemand = yield* libraryRefusedHopTwo(reportCatalog, policy, ["2501.00002"]);
          expect(sorted(refused)).toEqual(["2501.00002", "child-b"]);
          expect(sorted(onDemand)).toEqual(["child-b"]);
        })
      );

      it.effect("reads no packet concepts outside a repository and no domain from a non-URL", () =>
        Effect.gen(function* () {
          const concepts = yield* libraryLiveConcepts(LibraryHopPolicy.make({})).pipe(
            Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({ exists: () => Effect.succeed(false) }))
          );
          expect(concepts).toEqual([]);
          expect([librarySourceDomain("not a url"), librarySourceDomain("https://www.Example.org/a")]).toEqual([
            "",
            "example.org",
          ]);
        })
      );
    });
  });
});

describe("hop extraction locators", () => {
  layer(Layer.empty)((it) => {
    it.effect("ends a Markdown link target at its unbalanced closing parenthesis", () =>
      Effect.sync(() => {
        const references = extractLibraryReferences(
          "[Discord](https://discord.gg/effect-ts)[Follow on X](https://x.com/EffectTS_) and https://en.wikipedia.org/wiki/Effect_(band)"
        );
        expect(A.map(references, (reference) => reference.locator)).toEqual([
          "https://discord.gg/effect-ts",
          "https://x.com/EffectTS_",
          "https://en.wikipedia.org/wiki/Effect_(band)",
        ]);
      })
    );
  });
});

describe("Box authentication precedence", () => {
  const modeWith = (env: Record<string, string>) =>
    libraryBoxAuthMode().pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)));
  layer(Layer.empty, { timeout: "10 seconds" })((it) => {
    it.effect("prefers explicit CCG subjects over a developer token loaded from .env", () =>
      Effect.gen(function* () {
        const modes = yield* Effect.forEach(
          [
            { CLOUD_BOX_TOKEN: "stale-desktop-token", DMS_BOX_USER_ID: "51443111498" },
            { CLOUD_BOX_TOKEN: "stale-desktop-token", DMS_BOX_ENTERPRISE_ID: "123" },
            { CLOUD_BOX_TOKEN: "developer-token" },
            { CLOUD_BOX_TOKEN: "  " },
            {},
          ],
          modeWith
        );
        expect(modes).toEqual(["ccg-user", "ccg-enterprise", "developer-token", "ccg-enterprise", "ccg-enterprise"]);
      })
    );
  });
});

describe("research library route edges", () => {
  layer(services, { timeout: "60 seconds" })((it) => {
    it.effect("returns the catalog unchanged for an empty Box selection", () =>
      Effect.gen(function* () {
        const { root } = yield* tempLibrary();
        const catalog = yield* acquireLibraryBox(
          root,
          LibraryBoxAcquireOptions.make({ folderIds: ["empty"], fileIds: [] })
        );
        expect([catalog.sources, catalog.captures, catalog.qualifications]).toEqual([[], [], []]);
      })
    );

    it.effect("requalifies the Box route when the previous qualification's provider events are unreadable", () =>
      Effect.gen(function* () {
        const { root } = yield* tempLibrary();
        const options = LibraryBoxAcquireOptions.make({ folderIds: ["nested"], fileIds: [] });
        const first = yield* acquireLibraryBox(root, options);
        const boxQualifications = (catalog: LibraryCatalog) =>
          A.filter(catalog.qualifications, (qualification) => qualification.adapter === "box");
        expect(boxQualifications(first)).toHaveLength(1);
        const events = yield* saveLibraryText(
          root,
          "receipts/box/provider-events.jsonl",
          "not provider events\n",
          "application/x-ndjson",
          "raw-provider-events"
        );
        yield* withCatalog(root, (catalog) =>
          Effect.succeed(
            LibraryCatalog.make({
              ...catalog,
              // The required qualification's evidence no longer reads; a later optional failed one
              // keeps the qualify step itself from re-reading it.
              qualifications: A.flatMap(catalog.qualifications, (qualification) => [
                LibraryQualification.make({ ...qualification, evidence: [...qualification.evidence, events] }),
                LibraryQualification.make({
                  ...qualification,
                  id: `${qualification.id}-optional`,
                  required: false,
                  status: "failed",
                }),
              ]),
            })
          )
        );
        const second = yield* acquireLibraryBox(root, options);
        expect(A.map(boxQualifications(second), (qualification) => qualification.status)).toEqual([
          "verified",
          "failed",
          "verified",
        ]);
      })
    );

    it.effect("derives hops for the newest of several intakes over the same roots", () =>
      Effect.gen(function* () {
        const { root, temporary, fs, path } = yield* tempLibrary();
        const november = path.join(temporary, "november");
        yield* fs.makeDirectory(november, { recursive: true });
        const options = LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [november, november] });
        yield* fs.writeFileString(path.join(november, "new.md"), "# New 2026-11-06\n\nSee https://example.com/new.\n");
        const first = yield* inventoryLibraryWithHops(options);
        expect(A.map(first.intakes, (intake) => intake.inputRoots.length)).toEqual([1]);
        const firstIntake = A.getUnsafe(first.intakes, 0);
        // Edited content records a second intake over the same root; only the newer one gains edges.
        yield* fs.writeFileString(
          path.join(november, "new.md"),
          "# New 2026-11-06\n\nSee https://example.com/newer.\n"
        );
        const second = yield* inventoryLibraryWithHops(options);
        expect(second.intakes).toHaveLength(2);
        const newest = O.getOrThrow(A.findFirst(second.intakes, (intake) => intake.id !== firstIntake.id));
        const newer = O.getOrThrow(
          A.findFirst(second.sources, (source) => source.canonicalUrl === "https://example.com/newer")
        );
        expect(
          A.map(
            A.filter(second.derivations, (edge) => edge.intakeId === newest.id),
            (edge) => [edge.hopDepth, edge.derivedId]
          )
        ).toEqual([[1, newer.id]]);
      })
    );

    it.effect("records each onward page of a parent once across its cited links", () =>
      Effect.gen(function* () {
        const { root, temporary, fs, path } = yield* tempLibrary();
        const input = path.join(temporary, "input");
        yield* fs.makeDirectory(input, { recursive: true });
        yield* fs.writeFileString(
          path.join(input, "report.md"),
          "# Report 2026-11-06\n\nSee https://example.com/first and https://example.com/second.\n"
        );
        const options = LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [input] });
        const first = yield* inventoryLibraryWithHops(options);
        const article = O.getOrThrow(
          A.findFirst(first.sources, (source) => source.canonicalUrl === "https://example.com/first")
        );
        // The page cites each onward page twice.
        const linking = Firecrawl.of({
          scrape: Effect.fn("test.linkingScrape")(function* (request) {
            const body = yield* encodeJson({
              success: true,
              data: {
                markdown: `# Article\n\nSee https://other.org/a, https://other.org/b and again https://other.org/a [b](https://other.org/b).`,
                rawHtml: `<article>Full text of ${request.url}.</article>`,
                metadata: { sourceURL: request.url, statusCode: 200, contentType: "text/html" },
              },
            }).pipe(Effect.orDie);
            return yield* decodeFirecrawlScrapeBody(request.url, bytesOf(body));
          }),
        });
        const capture = yield* acquireLibrarySource(root, article).pipe(Effect.provideService(Firecrawl, linking));
        expect(capture.status).toBe("readable");
        const second = yield* inventoryLibraryWithHops(options);
        const onward = A.getSomes(
          A.map(
            A.filter(second.derivations, (edge) => edge.hopDepth === 2 && edge.sourceId === article.id),
            (edge) =>
              O.map(
                A.findFirst(second.sources, (source) => source.id === edge.derivedId),
                (source) => source.canonicalUrl
              )
          )
        );
        expect(A.sort(onward, Str.Order)).toEqual(["https://other.org/a", "https://other.org/b"]);
      })
    );

    it.effect("scans the text of every cited version of a parent", () =>
      Effect.gen(function* () {
        const { root, temporary, fs, path } = yield* tempLibrary();
        const input = path.join(temporary, "input");
        yield* fs.makeDirectory(input, { recursive: true });
        yield* fs.writeFileString(
          path.join(input, "report.md"),
          "# Report 2026-11-06\n\nSee https://arxiv.org/abs/2610.00609v1 and https://arxiv.org/abs/2610.00609v2.\n"
        );
        const options = LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [input] });
        const first = yield* inventoryLibraryWithHops(options);
        const paper = O.getOrThrow(A.findFirst(first.sources, (source) => source.identity === "arxiv:2610.00609"));
        for (const version of ["v1", "v2"]) {
          const cited = O.getOrThrow(A.findFirst(paper.versions, (item) => item.revision === version));
          const fullText = yield* original(
            temporary,
            `paper-${version}.txt`,
            `${Str.repeat(80)("Full paper sentence. ")}Follow-up: https://other.org/${version}.`,
            "text/plain"
          );
          const manifest = path.join(temporary, `alpha-${version}.json`);
          const text = yield* encodeAlphaxiv(
            LibraryAlphaxivImportPayload.make({
              kind: "alphaxiv",
              sourceId: paper.id,
              canonicalUrl: cited.canonicalUrl,
              arxivId: "2610.00609",
              version,
              fullText,
              references: [],
            })
          );
          yield* fs.writeFileString(manifest, text);
          yield* importLibraryRoutedResult(root, manifest);
        }
        const second = yield* inventoryLibraryWithHops(options);
        const onward = A.getSomes(
          A.map(
            A.filter(second.derivations, (edge) => edge.hopDepth === 2 && edge.sourceId === paper.id),
            (edge) =>
              O.map(
                A.findFirst(second.sources, (source) => source.id === edge.derivedId),
                (source) => source.canonicalUrl
              )
          )
        );
        expect(A.sort(onward, Str.Order)).toEqual(["https://other.org/v1", "https://other.org/v2"]);
      })
    );

    it.effect("rejects a Box capture whose metadata, revision, original or bytes do not bind its source", () =>
      Effect.gen(function* () {
        const { root, fs, path } = yield* tempLibrary();
        const catalog = yield* acquireLibraryBox(
          root,
          LibraryBoxAcquireOptions.make({ folderIds: ["nested"], fileIds: [] })
        );
        const source = O.getOrThrow(A.findFirst(catalog.sources, (item) => Str.startsWith("box:")(item.identity)));
        const capture = O.getOrThrow(A.findFirst(catalog.captures, (item) => item.sourceId === source.id));
        const without = (role: string) =>
          LibraryCapture.make({
            ...capture,
            artifacts: A.filter(capture.artifacts, (artifact) => artifact.role !== role),
          });
        const checks = yield* Effect.forEach(
          [
            [source, capture],
            [LibrarySource.make({ ...source, canonicalUrl: "https://example.com/memo" }), capture],
            [source, LibraryCapture.make({ ...capture, capturedRevision: "103:999" })],
            [source, without("raw-full-text")],
            [source, without("box-file-metadata")],
          ] as const,
          ([item, claim]) => validateLibraryBoxEvidence(root, item, claim)
        );
        expect(checks).toEqual([true, false, false, false, false]);
        const original = O.getOrThrow(A.findFirst(capture.artifacts, (artifact) => artifact.role === "raw-full-text"));
        yield* fs.remove(path.join(root, original.path));
        const removed = yield* validateLibraryBoxEvidence(root, source, capture);
        expect(removed).toBe(false);
      })
    );

    it.effect("binds VidBee imports through aliases, versions and locators and refuses unbound bundles", () =>
      Effect.gen(function* () {
        const { root, temporary, fs, path } = yield* tempLibrary();
        const versioned = LibrarySource.make({
          id: "vid-one",
          aliasIds: ["vid-one-alias"],
          kind: "youtube",
          canonicalUrl: "https://www.youtube.com/watch?v=one",
          identity: "youtube:one",
          revision: "",
          repository: "",
          ownership: "external",
          locators: [],
          versions: [LibrarySourceVersion.make({ revision: "r2", canonicalUrl: "https://youtu.be/one", locators: [] })],
        });
        const located = LibrarySource.make({
          id: "vid-two",
          kind: "youtube",
          canonicalUrl: "https://www.youtube.com/watch?v=two",
          identity: "youtube:two",
          revision: "r1",
          repository: "",
          ownership: "external",
          locators: ["https://www.youtube.com/watch?v=two", "https://youtu.be/two"],
          versions: [],
        });
        yield* withCatalog(root, (catalog) =>
          Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [versioned, located] }))
        );
        // A catalog write re-keys sources by identity and keeps the given ids as aliases.
        const idOf = (catalog: LibraryCatalog, identity: string) =>
          O.getOrThrow(A.findFirst(catalog.sources, (source) => source.identity === identity)).id;
        const media = yield* original(temporary, "0.mkv", "matroska bytes", "video/x-matroska");
        const transcript = yield* original(
          temporary,
          "0.en.vtt",
          "WEBVTT\n\n00:00.000 --> 00:01.000\nHello.\n",
          "text/vtt"
        );
        const faqFile = (name: string, lines: ReadonlyArray<string>) =>
          original(temporary, name, `---\n${A.join(lines, "\n")}\n---\n\n# Why?\nBecause.\n`, "text/markdown");
        const importAs = Effect.fn("test.importVidbee")(function* (name: string, value: LibraryVidbeeImportPayload) {
          const manifest = path.join(temporary, name);
          const text = yield* encodeVidbee(value);
          yield* fs.writeFileString(manifest, text);
          return yield* importLibraryRoutedResult(root, manifest);
        });
        const base = LibraryVidbeeImportPayload.make({
          kind: "vidbee",
          sourceId: "vid-one-alias",
          canonicalUrl: "https://youtu.be/one",
          media,
          transcript,
          faq: yield* faqFile("plain.md", ['media: "0.mkv"', 'model: "gpt-6.1-sol"']),
        });
        yield* importAs("one.json", base);
        const again = yield* importAs("one.json", base);
        const oneId = idOf(again, "youtube:one");
        const plainCapture = O.getOrThrow(A.findFirst(again.captures, (item) => item.sourceId === oneId));
        expect(A.filter(again.captures, (item) => item.sourceId === oneId)).toHaveLength(1);
        expect(plainCapture.requestedRevision).toBe("r2");
        expect(A.map(again.modelRuns, (run) => [run.model, run.effort, run.startedAt])).toEqual([
          ["gpt-6.1-sol", "unrecorded", plainCapture.recordedAt],
        ]);
        // A capture whose requested revision names no version is checked against the canonical URL.
        const unversioned = yield* validateLibraryRouteEvidence(
          root,
          LibrarySource.make({ ...versioned, id: oneId, canonicalUrl: "https://youtu.be/one", versions: [] }),
          plainCapture
        );
        assertSome(unversioned, true);

        const locatedFaq = yield* faqFile("located.md", [
          'media: "./0.mkv"',
          'model: "gpt-6.1-sol(medium)"',
          'effort: "high"',
          'source_url: "https://www.youtube.com/watch?v=two"',
          'generated_at: "2026-11-06T00:00:00.000Z"',
        ]);
        const viaLocator = yield* importAs(
          "two.json",
          LibraryVidbeeImportPayload.make({
            ...base,
            sourceId: "vid-two",
            canonicalUrl: "https://youtu.be/two",
            faq: locatedFaq,
          })
        );
        const twoId = idOf(viaLocator, "youtube:two");
        const locatedCapture = O.getOrThrow(A.findFirst(viaLocator.captures, (item) => item.sourceId === twoId));
        // No version names the locator, so the capture requests the source's own revision.
        const twoSource = O.getOrThrow(A.findFirst(viaLocator.sources, (item) => item.id === twoId));
        expect(A.some(twoSource.versions, (version) => version.canonicalUrl === "https://youtu.be/two")).toBe(false);
        expect(locatedCapture.requestedRevision).toBe(twoSource.revision);
        expect(
          A.map(
            A.filter(viaLocator.modelRuns, (run) => run.effort === "high"),
            (run) => [run.model, run.startedAt]
          )
        ).toEqual([["gpt-6.1-sol", "2026-11-06T00:00:00.000Z"]]);

        const blank = yield* original(temporary, "blank.vtt", "  \n", "text/vtt");
        const refusals = [
          ["unknown.json", LibraryVidbeeImportPayload.make({ ...base, sourceId: "nope" })],
          ["moved.json", LibraryVidbeeImportPayload.make({ ...base, canonicalUrl: "https://youtu.be/other" })],
          [
            "absent.json",
            LibraryVidbeeImportPayload.make({
              ...base,
              media: LibraryImportOriginal.make({ ...media, path: "absent.mkv" }),
            }),
          ],
          [
            "no-media.json",
            LibraryVidbeeImportPayload.make({ ...base, faq: yield* faqFile("no-media.md", ['model: "m"']) }),
          ],
          [
            "elsewhere.json",
            LibraryVidbeeImportPayload.make({
              ...base,
              faq: yield* faqFile("elsewhere.md", [
                'media: "0.mkv"',
                'model: "m"',
                'source_url: "https://example.com/x"',
              ]),
            }),
          ],
          [
            "no-model.json",
            LibraryVidbeeImportPayload.make({ ...base, faq: yield* faqFile("no-model.md", ['media: "0.mkv"']) }),
          ],
          ["blank.json", LibraryVidbeeImportPayload.make({ ...base, transcript: blank })],
        ] as const;
        const messages = yield* Effect.forEach(refusals, ([name, value]) =>
          importAs(name, value).pipe(
            Effect.flip,
            Effect.map((error) => error.message)
          )
        );
        expect(messages).toEqual([
          "Import source nope is not in the inventory.",
          "Import canonical URL differs from the inventoried source.",
          "VidBee media original is missing: absent.mkv",
          "VidBee FAQ frontmatter does not bind the referenced media file.",
          "VidBee FAQ frontmatter names a different source URL.",
          "VidBee FAQ frontmatter omits the generating model.",
          "VidBee transcript is empty.",
        ]);
      })
    );

    it.effect("checks alphaXiv versions and length, carries the parent's intake and stops references at hop 3", () =>
      Effect.gen(function* () {
        const { root, temporary, fs, path } = yield* tempLibrary();
        const paper = yield* classifyLibraryReference("https://arxiv.org/abs/2610.00609", "report");
        const cited = LibrarySource.make({
          ...paper,
          locators: [...paper.locators, "https://www.alphaxiv.org/abs/2610.00609"],
          versions: [
            ...paper.versions,
            LibrarySourceVersion.make({
              revision: "v2",
              canonicalUrl: "https://arxiv.org/abs/2610.00609v2",
              locators: [],
            }),
          ],
        });
        const deep = yield* classifyLibraryReference("https://arxiv.org/abs/2610.00700", "report");
        const derivation = (id: string, derivedId: string, hopDepth: number) =>
          LibraryDerivation.make({
            id,
            derivedId,
            sourceId: "doc-1",
            intakeId: "intake-1",
            rootId: "doc-1",
            hopDepth,
            recordedAt: "2026-11-06",
          });
        yield* withCatalog(root, (catalog) =>
          Effect.succeed(
            LibraryCatalog.make({
              ...catalog,
              sources: [cited, deep],
              derivations: [derivation("hop-1", cited.id, 1), derivation("hop-2", deep.id, 2)],
            })
          )
        );
        const fullText = yield* original(temporary, "paper.txt", Str.repeat(80)("Full paper sentence. "), "text/plain");
        const importAs = Effect.fn("test.importAlpha")(function* (name: string, value: LibraryAlphaxivImportPayload) {
          const manifest = path.join(temporary, name);
          const text = yield* encodeAlphaxiv(value);
          yield* fs.writeFileString(manifest, text);
          return yield* importLibraryRoutedResult(root, manifest);
        });
        const payload = LibraryAlphaxivImportPayload.make({
          kind: "alphaxiv",
          sourceId: cited.id,
          canonicalUrl: cited.canonicalUrl,
          arxivId: "2610.00609",
          version: "v2",
          fullText,
          references: [
            { arxivId: "2501.00001", url: "", title: "Cited arXiv paper" },
            { arxivId: "", url: "https://example.org/benchmark", title: "Cited page" },
          ],
        });
        yield* importAs("alpha.json", payload);
        const again = yield* importAs("alpha.json", payload);
        const edges = A.filter(again.derivations, (edge) => edge.sourceId === cited.id);
        expect(A.map(edges, (edge) => [edge.intakeId, edge.rootId, edge.hopDepth])).toEqual([
          ["intake-1", "doc-1", 2],
          ["intake-1", "doc-1", 2],
        ]);
        expect(A.filter(again.sources, (item) => item.identity === "arxiv:2501.00001")).toHaveLength(1);

        const hopThree = yield* importAs(
          "deep.json",
          LibraryAlphaxivImportPayload.make({
            ...payload,
            sourceId: deep.id,
            canonicalUrl: deep.canonicalUrl,
            arxivId: "2610.00700",
          })
        );
        const deepCapture = O.getOrThrow(A.findFirst(hopThree.captures, (item) => item.sourceId === deep.id));
        expect(deepCapture.reason).toBe(
          "alphaXiv full text bound to arXiv 2610.00700v2; 0 references catalogued at hop 3."
        );

        // A locator that names no version requests the source's own revision.
        const viaLocator = yield* importAs(
          "locator.json",
          LibraryAlphaxivImportPayload.make({ ...payload, canonicalUrl: "https://www.alphaxiv.org/abs/2610.00609" })
        );
        const citedSource = O.getOrThrow(A.findFirst(viaLocator.sources, (item) => item.identity === cited.identity));
        expect(
          A.map(
            A.filter(viaLocator.captures, (item) => item.sourceId === citedSource.id),
            (item) => item.requestedRevision
          )
        ).toContain(citedSource.revision);

        const versionError = yield* importAs(
          "version.json",
          LibraryAlphaxivImportPayload.make({
            ...payload,
            canonicalUrl: "https://arxiv.org/abs/2610.00609v2",
            version: "v1",
          })
        ).pipe(Effect.flip);
        expect(versionError.message).toBe("alphaXiv version v1 differs from the cited version v2.");
        const short = yield* original(temporary, "abstract.txt", "Only an abstract.", "text/plain");
        const shortError = yield* importAs(
          "short.json",
          LibraryAlphaxivImportPayload.make({ ...payload, fullText: short })
        ).pipe(Effect.flip);
        expect(shortError.message).toBe(
          "alphaXiv full text is shorter than 1000 characters; abstracts are not full text."
        );
      })
    );
  });
});

const boxEdgeFile = (id: string, versionId: string, name: string, size: number) =>
  LibraryBoxFile.make({ id, versionId, name, sha1: "", size });

describe("Box acquisition edges", () => {
  layer(services, { timeout: "60 seconds" })((it) => {
    it.effect("registers explicitly selected files and fails on unknown Box items", () =>
      Effect.gen(function* () {
        const { root } = yield* tempLibrary();
        const ids = yield* registerLibraryBoxSources(
          root,
          LibraryBoxAcquireOptions.make({ folderIds: [], fileIds: ["202"] })
        );
        const catalog = yield* loadCatalog(root);
        expect(A.map(catalog.sources, (source) => [source.id, source.canonicalUrl])).toEqual([
          [A.getUnsafe(ids, 0), "https://app.box.com/file/202"],
        ]);
        const file = yield* registerLibraryBoxSources(
          root,
          LibraryBoxAcquireOptions.make({ folderIds: [], fileIds: ["999"] })
        ).pipe(Effect.flip);
        expect(file.message).toBe("Box item 999 not found.");
        const folder = yield* registerLibraryBoxSources(
          root,
          LibraryBoxAcquireOptions.make({ folderIds: ["nowhere"], fileIds: [] })
        ).pipe(Effect.flip);
        expect(folder.message).toBe("Box item nowhere not found.");
      })
    );

    it.effect("refuses a Box selection deeper than 200 folders", () =>
      Effect.gen(function* () {
        const { root } = yield* tempLibrary();
        const failure = yield* registerLibraryBoxSources(
          root,
          LibraryBoxAcquireOptions.make({ folderIds: ["f0"], fileIds: [] })
        ).pipe(Effect.flip);
        expect([failure.cause, failure.message]).toEqual(["box", "Box selection exceeds 200 folders."]);
        const shallow = yield* registerLibraryBoxSources(
          root,
          LibraryBoxAcquireOptions.make({ folderIds: ["f0"], fileIds: [], recursive: false })
        );
        expect(shallow).toEqual([]);
      })
    );

    it.effect("reports a library root that cannot be created", () =>
      Effect.gen(function* () {
        const { fs, path, temporary } = yield* tempLibrary();
        const blocker = path.join(temporary, "plain-file");
        yield* fs.writeFileString(blocker, "not a directory");
        const failure = yield* registerLibraryBoxSources(
          path.join(blocker, "library"),
          LibraryBoxAcquireOptions.make({ folderIds: [], fileIds: [] })
        ).pipe(Effect.flip);
        expect(failure.message).toBe("Cannot create the library root.");
      })
    );

    it.effect("names unnamed downloads and types Markdown and unknown files", () =>
      Effect.gen(function* () {
        const { root } = yield* tempLibrary();
        yield* registerLibraryBoxSources(root, LibraryBoxAcquireOptions.make({ folderIds: ["docs"], fileIds: [] }));
        const catalog = yield* loadCatalog(root);
        const originals = yield* Effect.forEach(catalog.sources, (source) =>
          acquireLibraryBoxFile(root, source, `captures/${source.id}`).pipe(
            Effect.map((result) => {
              const original = A.getUnsafe(result.artifacts, 0);
              const name = O.getOrElse(A.last(Str.split("/")(original.path)), () => "");
              return [result.status, result.revision, name, original.mediaType];
            })
          )
        );
        expect(originals).toEqual([
          ["readable", "201:3", "file", "application/octet-stream"],
          ["readable", "202:1", "notes.md", "text/markdown"],
        ]);
      })
    );

    it.effect("refuses non-Box locators and Box versions without a retained listing", () =>
      Effect.gen(function* () {
        const { root } = yield* tempLibrary();
        const web = LibrarySource.make({
          id: "web",
          kind: "web",
          canonicalUrl: "https://example.com/report",
          identity: "https://example.com/report",
          revision: "",
          repository: "",
          ownership: "external",
          locators: [],
        });
        const unsupported = yield* acquireLibraryBoxFile(root, web, "captures/web");
        expect([unsupported.status, unsupported.reason]).toEqual(["unsupported", "Source is not a Box file locator."]);

        // A retained listing that records other versions does not vouch for version 2.
        const listingText = yield* encodeJson({
          folderIds: [],
          fileIds: ["202"],
          files: [boxEdgeFile("202", "1", "notes.md", 10), boxEdgeFile("201", "2", "", 10)],
        });
        yield* withCatalog(root, (catalog) => Effect.succeed(catalog));
        const listing = yield* saveLibraryText(
          root,
          "receipts/box/listing.json",
          listingText,
          "application/json",
          "box-listing"
        );
        const stale = yield* libraryBoxSource(boxEdgeFile("202", "2", "notes.md", 10), "private");
        yield* withCatalog(root, (catalog) =>
          Effect.succeed(LibraryCatalog.make({ ...catalog, artifacts: [...catalog.artifacts, listing] }))
        );
        const blocked = yield* acquireLibraryBoxFile(root, stale, "captures/stale");
        expect([blocked.status, blocked.reason]).toEqual([
          "blocked",
          "Box file 202 version 2 has no retained listing with its SHA-1; re-run acquire --route box to register it.",
        ]);
      })
    );
  });
});
