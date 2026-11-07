import { decodeFirecrawlScrapeBody, Firecrawl } from "@beep/firecrawl";
import { Git } from "@beep/git/Git";
import {
  acquireLibraryBox,
  classifyLibraryReference,
  extractLibraryReferences,
  hashBytes,
  importLibraryRoutedResult,
  inventoryLibraryWithHops,
  LibraryAlphaxivImportPayload,
  LibraryBoxAcquireOptions,
  LibraryCatalog,
  LibraryDerivation,
  LibraryDocument,
  LibraryFinding,
  LibraryHopGateInput,
  LibraryHopPolicy,
  LibraryImportOriginal,
  LibraryInventoryOptions,
  LibraryOccurrence,
  LibraryPacketConcept,
  LibrarySource,
  LibraryVidbeeImportPayload,
  libraryHopGate,
  libraryHopTotals,
  libraryPacketConcepts,
  loadCatalog,
  withCatalog,
} from "@beep/repo-cli/commands/Research";
import {
  acquireLibrarySource,
  LibraryBoxFile,
  libraryBoxSha1,
  librarySourceEvidenceValid,
  makeLibraryBoxTest,
} from "@beep/repo-cli/test/ResearchLibrary";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

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
const boxDownloads: Array<string> = [];
const boxFixture = Effect.gen(function* () {
  const sharedSha1 = yield* libraryBoxSha1(boxBytes.shared);
  const otherSha1 = yield* libraryBoxSha1(boxBytes.other);
  return {
    folders: {
      top: [
        LibraryBoxFile.make({ id: "101", versionId: "1", name: "exhibit.pdf", sha1: sharedSha1, size: 24 }),
        LibraryBoxFile.make({ id: "102", versionId: "1", name: "exhibit copy.pdf", sha1: sharedSha1, size: 24 }),
      ],
      nested: [LibraryBoxFile.make({ id: "103", versionId: "7", name: "memo.txt", sha1: otherSha1, size: 17 })],
      tampered: [
        LibraryBoxFile.make({ id: "104", versionId: "1", name: "bad.txt", sha1: Str.repeat(40)("0"), size: 17 }),
      ],
    },
    subfolders: { top: ["nested"] },
    bytes: { "101": boxBytes.shared, "102": boxBytes.shared, "103": boxBytes.other, "104": boxBytes.other },
    downloads: boxDownloads,
  };
});
const boxLayer = Layer.unwrap(Effect.map(boxFixture, makeLibraryBoxTest)).pipe(Layer.provide(NodeCrypto.layer));

const platform = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() => Effect.die("Unexpected fixture HTTP request"))
  ),
  firecrawl,
  boxLayer
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
        boxDownloads.length = 0;
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
        expect(A.sort(boxDownloads, Str.Order)).toEqual(["101", "102", "103"]);

        yield* acquireLibraryBox(root, options);
        expect(boxDownloads).toHaveLength(3);
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
