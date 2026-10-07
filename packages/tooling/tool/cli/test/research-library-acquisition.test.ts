import { Firecrawl, FirecrawlScrapeSuccess } from "@beep/firecrawl";
import {
  hashBytes,
  importLibraryResult,
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryDispositionImportPayload,
  LibraryImportPayload,
  LibraryQualification,
  LibrarySource,
  loadCatalog,
  saveImmutable,
  validateLibraryScrape,
  withCatalog,
} from "@beep/repo-cli/commands/Research";
import {
  acquireLibraryGithub,
  acquireLibraryPaper,
  acquireLibrarySource,
  acquireLibraryWeb,
  correctLibraryCaptures,
  LibraryCaptureCorrection,
  libraryCaptionProvenance,
  libraryQualificationValid,
  librarySourceEvidenceValid,
  runLibraryCommand,
  saveLibraryText,
  validateProviderQualification,
} from "@beep/repo-cli/test/ResearchLibrary";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it, vi } from "@effect/vitest";
import { Config, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import * as S from "effect/Schema";

const LibraryImportPayloadJson = S.fromJsonString(LibraryImportPayload);
const UnknownJson = S.fromJsonString(S.Unknown);
const LibraryCaptureCorrectionJson = S.fromJsonString(LibraryCaptureCorrection);
const LibraryDispositionImportPayloadJson = S.fromJsonString(LibraryDispositionImportPayload);

const source = LibrarySource.make({
  id: "fixture-source",
  kind: "web",
  canonicalUrl: "https://example.com/article",
  identity: "https://example.com/article",
  revision: "",
  repository: "",
  ownership: "external",
  locators: [],
});
const prepare = Effect.fn("test.prepare")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-adapters-" });
  const root = path.join(temporary, "library");
  yield* withCatalog(root, (catalog) => Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [source] })));
  const original = path.join(temporary, "original.txt");
  const bytes = new TextEncoder().encode("Original source content.");
  yield* fs.writeFile(original, bytes);
  const artifact = LibraryArtifact.make({
    path: "original.txt",
    sha256: yield* hashBytes(bytes),
    bytes: bytes.byteLength,
    mediaType: "text/plain",
    role: "raw-full-text",
  });
  const payload = LibraryImportPayload.make({
    sourceId: source.id,
    canonicalUrl: source.canonicalUrl,
    method: "fixture-original-import",
    provider: "fixture",
    toolName: "",
    toolCallId: "",
    complete: true,
    capturedRevision: "",
    artifacts: [artifact],
  });
  const resultPath = path.join(temporary, "import.json");
  return { fs, path, root, original, payload, resultPath };
});
const writePayload = Effect.fn("test.writePayload")(function* (resultPath: string, payload: LibraryImportPayload) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(resultPath, yield* S.encodeEffect(LibraryImportPayloadJson)(payload));
});

const headerlessPdf = (body: string) => {
  const stream = `BT /F1 12 Tf 72 720 Td (${body}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
};

it.layer(
  Layer.mergeAll(
    NodeServices.layer,
    NodeCrypto.layer,
    Layer.mock(Firecrawl, {}),
    Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make(() => Effect.die("Unexpected fixture HTTP request"))
    )
  ),
  { timeout: "30 seconds" }
)("research acquisition integrity", (it) => {
  it.effect.each(["unchanged", "missing", "requested", "resolved", "provider", "status", "merged", "corrupt"])(
    "revalidates captured web redirects only with retained matching proof: %s",
    (scenario) =>
      Effect.gen(function* () {
        const f = yield* prepare();
        const resolved = "https://example.com/moved-article";
        const client = HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              HttpClientRequest.setUrl(request, resolved),
              new Response("redirect", { status: 200 })
            )
          )
        );
        const driver = yield* Layer.build(
          Layer.mock(Firecrawl, {
            scrape: () =>
              Effect.succeed(
                FirecrawlScrapeSuccess.make({
                  data: {
                    markdown: "The retained full article.",
                    rawHtml: "<article>The retained full article.</article>",
                    metadata: { sourceURL: resolved, statusCode: 200 },
                  },
                })
              ),
          })
        );
        const result = yield* acquireLibraryWeb(f.root, source, "redirect").pipe(
          Effect.provide(driver),
          Effect.provideService(HttpClient.HttpClient, client)
        );
        expect(result.status).toBe("readable");
        expect(result.complete).toBe(true);
        let artifacts = result.artifacts;
        if (scenario !== "unchanged") {
          artifacts = A.filter(artifacts, (artifact) => artifact.role !== "target-metadata");
          if (scenario !== "missing") {
            const proof = yield* saveLibraryText(
              f.root,
              "replacement/redirect.json",
              yield* S.encodeEffect(UnknownJson)({
                requestedUrl: scenario === "requested" ? "https://example.com/other" : source.canonicalUrl,
                resolvedUrl: scenario === "resolved" ? "https://example.com/other" : resolved,
                providerSourceUrl: scenario === "provider" ? "https://example.com/other" : resolved,
                status: scenario === "status" ? 403 : 200,
                identityMerged: scenario === "merged",
              }),
              "application/json",
              "target-metadata"
            );
            artifacts = A.append(
              artifacts,
              scenario === "corrupt" ? LibraryArtifact.make({ ...proof, sha256: "0".repeat(64) }) : proof
            );
          }
        }
        const capture = LibraryCapture.make({
          id: "redirect-capture",
          sourceId: source.id,
          status: result.status,
          method: "firecrawl",
          recordedAt: "2026-10-06T00:00:00Z",
          requestedRevision: "",
          capturedRevision: result.revision,
          complete: result.complete,
          artifacts,
          reason: result.reason,
        });
        expect(yield* librarySourceEvidenceValid(f.root, source, capture)).toBe(scenario === "unchanged");
      })
  );
  it.effect("decodes authentic plain alphaXiv envelopes before class-based qualification", () =>
    Effect.gen(function* () {
      const receipt = {
        provider: "alphaxiv",
        operation: "get_paper_content",
        arguments: { url: "https://arxiv.org/abs/2608.23992v3", fullText: true },
        result: { content: [{ type: "text", text: "Actual retained source body. ".repeat(50) }] },
      };
      expect(yield* validateProviderQualification("alphaxiv", [receipt])).toBe(true);
      const error = yield* validateProviderQualification("alphaxiv", [
        { ...receipt, arguments: { ...receipt.arguments, fullText: false } },
      ]).pipe(Effect.flip);
      expect(error.message).toContain("does not prove operational qualification: alphaxiv");
    })
  );
  it.effect("resolves legitimate quoted and unquoted publisher attributes without accepting lookalike names", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const cases = [
        { html: '<meta content="https://publisher.example/paper.pdf" name=citation_pdf_url>', resolved: true },
        { html: '<meta name="citation_pdf_url" content=https://publisher.example/paper.pdf>', resolved: true },
        { html: "<a href=https://publisher.example/paper.pdf>PDF</a>", resolved: true },
        { html: "<meta name=citation_pdf_url_suffix content=https://publisher.example/paper.pdf>", resolved: false },
        { html: "<a data-href=https://publisher.example/paper.pdf>Not a link</a>", resolved: false },
      ];
      for (const [index, item] of cases.entries()) {
        const paper = LibrarySource.make({
          ...source,
          kind: "paper",
          canonicalUrl: "https://publisher.example/article",
        });
        const calls: Array<string> = [];
        const client = HttpClient.make((request) => {
          calls.push(request.url);
          return Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              new Response(request.url.endsWith(".pdf") ? headerlessPdf("Real full paper fixture") : item.html, {
                status: 200,
              })
            )
          );
        });
        const result = yield* acquireLibraryPaper(fixture.root, paper, `captures/attribute-${index}`).pipe(
          Effect.provideService(HttpClient.HttpClient, client)
        );
        expect(result.complete, result.reason).toBe(item.resolved);
        expect(calls).toHaveLength(item.resolved ? 2 : 1);
      }
    })
  );

  it.effect(
    "preserves matching stable repository identity evidence for a rename and rejects a different repository",
    () =>
      Effect.gen(function* () {
        const fixture = yield* prepare();
        const clone = fixture.path.join(fixture.root, "repos/github/fixture/original");
        yield* fixture.fs.makeDirectory(clone, { recursive: true });
        yield* runLibraryCommand(fixture.root, "git", ["init", clone]);
        yield* runLibraryCommand(fixture.root, "git", [
          "-C",
          clone,
          "remote",
          "add",
          "origin",
          "https://github.com/fixture/original.git",
        ]);
        yield* fixture.fs.writeFileString(fixture.path.join(clone, "file.txt"), "fixture");
        yield* runLibraryCommand(fixture.root, "git", ["-C", clone, "add", "file.txt"]);
        yield* runLibraryCommand(fixture.root, "git", [
          "-C",
          clone,
          "-c",
          "user.name=Fixture",
          "-c",
          "user.email=fixture@example.com",
          "-c",
          "core.hooksPath=/dev/null",
          "commit",
          "-m",
          "fixture",
        ]);
        const bin = fixture.path.join(fixture.root, "fixture-bin");
        yield* fixture.fs.makeDirectory(bin);
        const mismatch = fixture.path.join(bin, "mismatch");
        yield* fixture.fs.writeFileString(
          fixture.path.join(bin, "gh"),
          `#!/usr/bin/python3
import json,sys,pathlib

endpoint=sys.argv[-1]
if endpoint.startswith('https://api.github.com/repos/'):
 different=endpoint.endswith('/renamed') and pathlib.Path(__file__).with_name('mismatch').exists()
 print(json.dumps({'id':999 if different else 42,'node_id':'OTHER' if different else 'REPO','full_name':'fixture/renamed','html_url':'https://github.com/fixture/renamed'}))
elif '/issues/1/comments' in endpoint: print('[]')
else: print(json.dumps({'html_url':'https://github.com/fixture/renamed/issues/1','number':1,'body':'Actual cited issue body'}))
`
        );
        yield* fixture.fs.chmod(fixture.path.join(bin, "gh"), 0o755);
        const previousPath = yield* Config.String("PATH").pipe(Config.withDefault(""));
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            vi.stubEnv("PATH", `${bin}:${previousPath}`);
          }),
          () =>
            Effect.sync(() => {
              vi.unstubAllEnvs();
            })
        );
        const issue = LibrarySource.make({
          ...source,
          kind: "github-issue",
          canonicalUrl: "https://github.com/fixture/original/issues/1",
          repository: "fixture/original",
        });
        const valid = yield* acquireLibraryGithub(fixture.root, issue, "captures/rename");
        expect(valid.status).toBe("readable");
        expect(valid.artifacts.filter((a) => a.role === "repository-identity-response")).toHaveLength(2);
        expect(valid.artifacts.some((a) => a.role === "repository-identity-provenance")).toBe(true);
        yield* fixture.fs.writeFileString(mismatch, "different stable id");
        const invalid = yield* acquireLibraryGithub(fixture.root, issue, "captures/rename-mismatch");
        expect(invalid.complete).toBe(false);
        expect(invalid.status).toBe("blocked");
        expect(invalid.reason).toContain("stable repository ID/node identity");
        expect(invalid.artifacts.filter((a) => a.role === "repository-identity-response")).toHaveLength(2);
      })
  );

  it.effect("retains an exact cited commit patch larger than the subprocess stdout bound", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const clone = fixture.path.join(fixture.root, "repos/github/fixture/repo");
      yield* fixture.fs.makeDirectory(clone, { recursive: true });
      yield* runLibraryCommand(fixture.root, "git", ["init", clone]);
      yield* runLibraryCommand(fixture.root, "git", [
        "-C",
        clone,
        "remote",
        "add",
        "origin",
        "https://github.com/fixture/repo.git",
      ]);
      yield* fixture.fs.writeFileString(
        fixture.path.join(clone, "large.txt"),
        "actual cited patch content ".repeat(360_000)
      );
      yield* runLibraryCommand(fixture.root, "git", ["-C", clone, "add", "large.txt"]);
      yield* runLibraryCommand(fixture.root, "git", [
        "-C",
        clone,
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.com",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "fixture",
      ]);
      const revision = (yield* runLibraryCommand(fixture.root, "git", ["-C", clone, "rev-parse", "HEAD"])).trim();
      const code = LibrarySource.make({
        ...source,
        kind: "github-code",
        canonicalUrl: `https://github.com/fixture/repo/commit/${revision}`,
        identity: "github:fixture/repo",
        repository: "fixture/repo",
        revision,
      });
      const capture = yield* acquireLibraryGithub(fixture.root, code, "captures/large-patch");
      expect(capture.status, capture.reason).toBe("readable");
      expect(capture.complete, capture.reason).toBe(true);
      const patch = capture.artifacts.find((artifact) => artifact.role === "raw-diff");
      expect(patch?.bytes).toBeGreaterThan(8_000_000);
      expect(
        patch === undefined ? "" : yield* fixture.fs.readFileString(fixture.path.join(fixture.root, patch.path))
      ).toContain("actual cited patch content");
    })
  );

  it.effect("binds headerless arxiv full text to observed official metadata and identical versioned PDF bytes", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const paper = LibrarySource.make({
        ...source,
        kind: "paper",
        identity: "arxiv:2608.23992",
        canonicalUrl: "https://arxiv.org/abs/2608.23992",
      });
      const pdf = headerlessPdf("Hybrid Semantic Tool Discovery full paper fixture");
      const requested: Array<string> = [];
      const client = HttpClient.make((request) => {
        requested.push(request.url);
        return Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response(
              request.url.includes("api/query")
                ? "<feed><entry><id>http://arxiv.org/abs/2608.23992v3</id></entry></feed>"
                : pdf,
              { status: 200 }
            )
          )
        );
      });
      const capture = yield* acquireLibraryPaper(fixture.root, paper, "captures/headerless").pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      );
      expect(capture.status, capture.reason).toBe("readable");
      expect(capture.revision).toBe("v3");
      expect(requested).toContain("https://arxiv.org/pdf/2608.23992v3");
      expect(capture.artifacts.some((artifact) => artifact.role === "arxiv-version-proof")).toBe(true);
      const altered = HttpClient.make((request) =>
        Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response(
              request.url.includes("api/query")
                ? "<feed><entry><id>http://arxiv.org/abs/2608.23992v3</id></entry></feed>"
                : request.url.endsWith("v3")
                  ? headerlessPdf("Different actual version bytes")
                  : pdf,
              { status: 200 }
            )
          )
        )
      );
      const mismatch = yield* acquireLibraryPaper(fixture.root, paper, "captures/headerless-mismatch").pipe(
        Effect.provideService(HttpClient.HttpClient, altered)
      );
      expect(mismatch.status).toBe("blocked");
      expect(mismatch.complete).toBe(false);
      expect(mismatch.revision).toBe("");
    })
  );

  it.effect("keeps publisher abstracts incomplete instead of admitting them as a full paper", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const paper = LibrarySource.make({
        ...source,
        kind: "paper",
        canonicalUrl: "https://publisher.example/abstract/paper",
      });
      const client = HttpClient.make((request) =>
        Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response("<html><title>Paper</title><p>Abstract only.</p></html>", {
              status: 200,
              headers: { "content-type": "text/html" },
            })
          )
        )
      );
      const capture = yield* acquireLibraryPaper(fixture.root, paper, "captures/abstract").pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      );
      expect(capture.status).toBe("blocked");
      expect(capture.complete).toBe(false);
      expect(capture.artifacts.some((artifact) => artifact.role === "publisher-landing-page")).toBe(true);
      expect(capture.artifacts.some((artifact) => artifact.role === "extracted-full-text")).toBe(false);
      expect(capture.reason).toContain("Abstract or portal text is incomplete");
    })
  );

  it.effect("follows explicit publisher PDF metadata and preserves a failing PDF response", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const paper = LibrarySource.make({
        ...source,
        kind: "paper",
        canonicalUrl: "https://publisher.example/article",
      });
      const requested: Array<string> = [];
      const client = HttpClient.make((request) => {
        requested.push(request.url);
        return Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response(
              request.url.endsWith("article")
                ? '<meta content="/pdf?id=paper" name="citation_pdf_url">'
                : "Access denied",
              { status: request.url.endsWith("article") ? 200 : 403, headers: { "content-type": "text/html" } }
            )
          )
        );
      });
      const capture = yield* acquireLibraryPaper(fixture.root, paper, "captures/metadata").pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      );
      expect(requested).toEqual(["https://publisher.example/article", "https://publisher.example/pdf?id=paper"]);
      expect(capture.complete).toBe(false);
      expect(capture.reason).toContain("HTTP 403");
      expect(capture.artifacts.some((artifact) => artifact.role === "raw-response")).toBe(true);
      expect(capture.artifacts.some((artifact) => artifact.role === "publisher-landing-page")).toBe(true);
    })
  );

  it.effect("recognizes PDF query responses by signature without routing through a web scrape", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const paper = LibrarySource.make({
        ...source,
        kind: "paper",
        canonicalUrl: "https://openreview.net/pdf?id=paper",
      });
      const client = HttpClient.make((request) =>
        Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response("%PDF-1.4\ninvalid test fixture", {
              status: 200,
              headers: { "content-type": "application/pdf" },
            })
          )
        )
      );
      const capture = yield* acquireLibraryPaper(fixture.root, paper, "captures/query").pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      );
      expect(capture.status).toBe("blocked");
      expect(capture.complete).toBe(false);
      expect(
        capture.artifacts.some(
          (artifact) => artifact.mediaType === "application/pdf" && artifact.role === "raw-full-text"
        )
      ).toBe(true);
      expect(capture.artifacts.some((artifact) => artifact.role === "publisher-landing-page")).toBe(false);
    })
  );

  it.effect("binds downloaded caption provenance when saved metadata omits requested subtitles", () =>
    Effect.sync(() => {
      const tracks = libraryCaptionProvenance(
        {
          id: "video",
          webpage_url: "https://www.youtube.com/watch?v=video",
          title: "Talk",
          subtitles: { en: [{ url: "https://example.com/manual", ext: "vtt" }] },
          automatic_captions: { "en-orig": [{ url: "https://example.com/automatic", ext: "vtt" }] },
        },
        ["source.en.vtt", "source.en-orig.vtt", "source.fr.vtt"]
      );
      expect(tracks.map((track) => [track.language, track.origin, track.downloadedFilename])).toEqual([
        ["en", "creator", "source.en.vtt"],
        ["en-orig", "automatic", "source.en-orig.vtt"],
      ]);
    })
  );

  it.effect("preserves hash-bound before and after states when correcting an invalid reading claim", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      yield* writePayload(fixture.resultPath, fixture.payload);
      const original = yield* importLibraryResult(fixture.root, fixture.resultPath);
      expect(A.getUnsafe(original.captures, 0)?.status).toBe("readable");
      const corrected = yield* withCatalog(fixture.root, (catalog) => correctLibraryCaptures(fixture.root, catalog));
      const capture = A.getUnsafe(corrected.captures, 0);
      expect(capture?.status).toBe("blocked");
      expect(capture?.complete).toBe(false);
      const artifact = capture?.artifacts.find((entry) => entry.role === "capture-correction");
      expect(artifact).toBeDefined();
      if (artifact !== undefined) {
        const receipt = yield* S.decodeEffect(LibraryCaptureCorrectionJson)(
          yield* fixture.fs.readFileString(fixture.path.join(fixture.root, artifact.path))
        );
        const before = yield* fixture.fs.readFile(fixture.path.join(fixture.root, receipt.before.path));
        expect(yield* hashBytes(before)).toBe(receipt.before.sha256);
        expect(receipt.after.status).toBe("blocked");
        const afterText = yield* S.encodeEffect(UnknownJson)(receipt.after);
        expect(yield* hashBytes(new TextEncoder().encode(afterText))).toBe(receipt.afterSha256);
      }
      const repeated = yield* withCatalog(fixture.root, (catalog) => correctLibraryCaptures(fixture.root, catalog));
      expect(A.getUnsafe(repeated.captures, 0)?.artifacts.length).toBe(capture?.artifacts.length);
      expect(A.getUnsafe(original.captures, 0)?.status).toBe("readable");
    })
  );
  it.effect("requires literal workflow launch and completed phases in the same session", () =>
    Effect.gen(function* () {
      const launch = {
        direction: "sent",
        message: {
          method: "session/prompt",
          params: { sessionId: "fixture", prompt: [{ type: "text", text: "/deep-research investigate citations" }] },
        },
      };
      const complete = {
        direction: "received",
        message: {
          params: {
            sessionId: "fixture",
            update: {
              sessionUpdate: "workflow_updated",
              run_id: "fixture-run",
              name: "deep-research",
              status: "complete",
              phases: ["Plan", "Research", "Verify", "Report"].map((title) => ({ title, state: "done" })),
            },
          },
        },
      };
      expect(yield* validateProviderQualification("grok-deep-research", [launch, complete])).toBe(true);
      const missingLaunch = yield* validateProviderQualification("grok-deep-research", [complete]).pipe(Effect.flip);
      expect(missingLaunch.message).toContain("does not prove");
      const otherSession = {
        ...complete,
        message: { params: { ...complete.message.params, sessionId: "unrelated" } },
      };
      yield* validateProviderQualification("grok-deep-research", [launch, otherSession]).pipe(Effect.flip);
    })
  );

  it.effect("qualifies native X execution only when its matching call completes", () =>
    Effect.gen(function* () {
      const call = {
        direction: "received",
        message: {
          params: {
            sessionId: "fixture",
            update: {
              sessionUpdate: "tool_call",
              toolCallId: "x-fixture",
              rawInput: { variant: "XSearch", backend: true },
            },
          },
        },
      };
      const completed = {
        direction: "received",
        message: {
          params: {
            sessionId: "fixture",
            update: {
              sessionUpdate: "tool_call_update",
              toolCallId: "x-fixture",
              status: "completed",
              rawOutput: { name: "x_keyword_search", invocation: "metadata only" },
            },
          },
        },
      };
      expect(yield* validateProviderQualification("grok-x-import", [call, completed])).toBe(true);
      yield* validateProviderQualification("grok-x-import", [call]).pipe(Effect.flip);
    })
  );

  it.effect("rejects corrupted provider qualification originals before admitting acquisition", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const events = [
        { type: "tool_use", id: "x-call", name: "x_keyword_search", input: {} },
        { type: "tool_result", tool_use_id: "x-call", content: { execution: "completed" } },
      ];
      const raw = yield* S.Unknown.pipe(S.Array, S.fromJsonString, S.encodeEffect)(events);
      const saved = yield* saveImmutable(fixture.root, "qualifications/events.json", new TextEncoder().encode(raw));
      const qualification = LibraryQualification.make({
        id: "fixture-qualification",
        adapter: "grok-x-import",
        status: "verified",
        required: true,
        recordedAt: "2026-10-06T00:00:00Z",
        reason: "fixture",
        evidence: [LibraryArtifact.make({ ...saved, role: "raw-provider-events", mediaType: "application/json" })],
      });
      const catalog = yield* loadCatalog(fixture.root);
      expect(yield* libraryQualificationValid(fixture.root, catalog, qualification)).toBe(true);
      yield* fixture.fs.writeFileString(fixture.path.join(fixture.root, saved.path), "corrupted evidence");
      expect(yield* libraryQualificationValid(fixture.root, catalog, qualification)).toBe(false);
    })
  );
  it.effect("rejects a successful provider envelope containing a failed or wrong target", () =>
    Effect.gen(function* () {
      const valid = {
        markdown: "source",
        rawHtml: "<p>source</p>",
        metadata: { sourceURL: source.canonicalUrl, statusCode: 200 },
      };
      expect((yield* validateLibraryScrape(source.canonicalUrl, valid)).markdown).toBe("source");
      const failed = yield* validateLibraryScrape(source.canonicalUrl, {
        ...valid,
        metadata: { ...valid.metadata, statusCode: 403 },
      }).pipe(Effect.flip);
      expect(failed.message).toContain("validation failed");
      const wrong = yield* validateLibraryScrape(source.canonicalUrl, {
        ...valid,
        metadata: { ...valid.metadata, sourceURL: "https://example.com/other" },
      }).pipe(Effect.flip);
      expect(wrong.message).toContain("validation failed");
    })
  );

  it.effect("imports immutable originals and rejects modified hash-bound evidence", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      yield* writePayload(fixture.resultPath, fixture.payload);
      const first = yield* importLibraryResult(fixture.root, fixture.resultPath);
      expect(A.getUnsafe(first.captures, 0)?.status).toBe("readable");
      const snapshot = A.getUnsafe(A.getUnsafe(first.captures, 0).artifacts, 0);
      expect(snapshot).toBeDefined();
      if (snapshot !== undefined)
        expect(yield* fixture.fs.readFileString(fixture.path.join(fixture.root, snapshot.path))).toBe(
          "Original source content."
        );
      yield* fixture.fs.writeFileString(fixture.original, "Modified original.");
      const error = yield* importLibraryResult(fixture.root, fixture.resultPath).pipe(Effect.flip);
      expect(error.message).toContain("hash or size mismatch");
      expect((yield* loadCatalog(fixture.root)).captures).toHaveLength(1);
    })
  );

  it.effect("preserves AI interpretation without admitting it as source reading", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const payload = LibraryImportPayload.make({
        ...fixture.payload,
        artifacts: fixture.payload.artifacts.map((artifact) =>
          LibraryArtifact.make({ ...artifact, role: "ai-interpretation" })
        ),
      });
      yield* writePayload(fixture.resultPath, payload);
      const result = yield* importLibraryResult(fixture.root, fixture.resultPath);
      expect(A.getUnsafe(result.captures, 0)?.status).toBe("blocked");
      expect(A.getUnsafe(result.captures, 0)?.complete).toBe(false);
    })
  );

  it.effect("accounts only the reviewed cited version and preserves evidence roles", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const versioned = LibrarySource.make({
        ...source,
        revision: "v1",
        versions: [
          { revision: "v1", canonicalUrl: "https://example.com/v1", locators: [] },
          { revision: "v2", canonicalUrl: "https://example.com/v2", locators: [] },
        ],
      });
      yield* withCatalog(fixture.root, (catalog) =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [versioned] }))
      );
      const disposition = LibraryDispositionImportPayload.make({
        kind: "disposition",
        sourceId: source.id,
        locator: "https://example.com/v2",
        disposition: "incomplete",
        reason: "Provider supplied interpretation without original returned body.",
        reviewer: "fixture-reviewer",
        reviewedAt: "2026-10-06T00:00:00Z",
        artifacts: fixture.payload.artifacts.map((artifact) =>
          LibraryArtifact.make({ ...artifact, role: "ai-interpretation" })
        ),
      });
      yield* fixture.fs.writeFileString(
        fixture.resultPath,
        yield* S.encodeEffect(LibraryDispositionImportPayloadJson)(disposition)
      );
      const catalog = yield* importLibraryResult(fixture.root, fixture.resultPath);
      expect(A.getUnsafe(catalog.captures, 0)?.requestedRevision).toBe("v2");
      expect(A.getUnsafe(catalog.captures, 0)?.complete).toBe(false);
      expect(A.getUnsafe(A.getUnsafe(catalog.captures, 0).artifacts, 0)?.role).toBe("ai-interpretation");
      expect(A.getUnsafe(catalog.captures, 0)?.status).toBe("blocked");
    })
  );

  it.effect("replaces durable running state with explicit terminal disposition", () =>
    Effect.gen(function* () {
      const fixture = yield* prepare();
      const internal = LibrarySource.make({ ...source, ownership: "internal", kind: "internal" });
      yield* withCatalog(fixture.root, (catalog) =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [internal] }))
      );
      const capture = yield* acquireLibrarySource(fixture.root, internal);
      const catalog = yield* loadCatalog(fixture.root);
      expect(capture.status).toBe("unsupported");
      expect(capture.complete).toBe(false);
      expect(catalog.captures).toHaveLength(1);
      expect(A.getUnsafe(catalog.captures, 0)?.status).toBe("unsupported");
      expect(A.getUnsafe(catalog.captures, 0)?.id).toBe(capture.id);
    })
  );
});
