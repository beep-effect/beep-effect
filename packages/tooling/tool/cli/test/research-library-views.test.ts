import {
  classifyLibraryReference,
  extractLibraryReferences,
  hashBytes,
  importLibraryResult,
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryDispositionImportPayload,
  LibraryDocument,
  LibraryIntake,
  LibraryIntakeFile,
  LibraryOccurrence,
  LibraryProbeEvidence,
  LibraryQualification,
  LibrarySource,
  LibrarySourceVersion,
  loadCatalog,
  removedLibraryWebAdapter,
  renderLibrary,
  saveImmutable,
  verifyLibrary,
  withCatalog,
} from "@beep/repo-cli/commands/Research";
import {
  correctLibraryCaptures,
  libraryEffectiveCaptures,
  libraryEffectiveCategory,
  libraryQualificationValid,
  librarySourceEvidenceValid,
  runLibraryCommand,
} from "@beep/repo-cli/test/ResearchLibrary";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { constant } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const LibraryProbeEvidenceJson = S.fromJsonString(LibraryProbeEvidence);
const UnknownJson = S.fromJsonString(S.Unknown);
const LibraryDispositionImportPayloadJson = S.fromJsonString(LibraryDispositionImportPayload);
const LibraryIntakeJson = S.fromJsonString(LibraryIntake);
const libraryArtifactEquivalent = S.toEquivalence(LibraryArtifact);

const webSourceKinds: ReadonlyArray<LibrarySource["kind"]> = ["web", "docs", "registry", "endpoint"];
const fixtureJson = S.Unknown.pipe(S.fromJsonString, S.encodeEffect);

const services = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const transcriptApiVariation = (scenario: string) => {
  const captionKind: Record<string, string> = { kind: "asr" };
  const base = {
    automatic: true,
    playerId: "abcdefghijk",
    timedId: "abcdefghijk",
    query: "&kind=asr",
    captionKind,
    xmlStart: 1,
    xmlDoctype: "",
    decodedText: "We're <b>here</b>",
    xmlText: "We&amp;#39;re &lt;b&gt;here&lt;/b&gt;",
    partialApi: false,
    origin: "automatic",
    status: 200,
    transcriptStart: "[1.000 - 3.000]",
  };
  const overrides: Record<string, Partial<typeof base>> = {
    creator: { automatic: false, query: "", captionKind: {}, origin: "creator" },
    "named and numeric entities": {
      xmlText: "We&#39;re&nbsp;&lt;b&gt;here&lt;/b&gt;&euro;&#x41;",
      decodedText: "We're\u00a0<b>here</b>€A",
    },
    "xml11 declaration": { xmlDoctype: '<?xml version="1.1"?>' },
    "default XML after xml11": { xmlText: "We&amp;#39;re &lt;b&gt;here&lt;/b&gt;&#x1F;" },
    "doctype entity": {
      xmlDoctype: '<!DOCTYPE transcript [<!ENTITY speaker "We">]>',
      xmlText: "&speaker;&amp;#39;re &lt;b&gt;here&lt;/b&gt;",
    },
    "unsafe doctype entity": {
      xmlDoctype: '<!DOCTYPE transcript [<!ENTITY speaker "&lt;script&gt;alert(1)&lt;/script&gt;">]>',
      xmlText: "&speaker;",
    },
    "entity expansion limit": { xmlText: Str.repeat(100_001)("&euro;") },
    "wrong player": { playerId: "other-video" },
    "wrong timed target": { timedId: "other-video" },
    "wrong origin": { origin: "creator" },
    "wrong XML timing": { xmlStart: 2 },
    "wrong XML text": { xmlText: "Different text" },
    "partial API": { partialApi: true },
    "wrong timestamps": { transcriptStart: "[0.000 - 2.000]" },
    "HTTP failure": { status: 429 },
  };
  return { ...base, ...overrides[scenario] };
};

const captionVariation = (scenario: string) => {
  const base = {
    webpageUrl: "https://www.youtube.com/watch?v=video-id",
    spoken: "Actual spoken source text",
    url: "https://www.youtube.com/api/timedtext?v=video-id",
    format: "vtt",
    origin: "automatic",
    transcript: "00:00:00.000 --> 00:00:02.000\nActual spoken source text",
    valid: false,
  };
  const overrides: Record<string, Partial<typeof base>> = {
    "valid VTT": { valid: true },
    "valid VTT unversioned request": { valid: true },
    "missing spoken cues": { spoken: "", transcript: "00:00:00.000 --> 00:00:02.000" },
    "unrelated transcript": { transcript: "Unrelated AI interpretation" },
    "wrong target metadata": { webpageUrl: "https://www.youtube.com/watch?v=unrelated" },
    "manual source": {
      url: base.webpageUrl,
      format: "text",
      origin: "manual",
      transcript: "Actual human transcript",
      valid: true,
    },
  };
  return { ...base, ...overrides[scenario] };
};

const falseReadingKinds: Record<string, LibrarySource["kind"]> = {
  "metadata-only web": "web",
  "paper PDF without text": "paper",
  "Grok paper interpretation": "paper",
  "GitHub discussion README only": "github-discussion",
  "YouTube transcript without provenance": "youtube",
};

const falseReadingArtifacts = Effect.fn("test.falseReadingArtifacts")(function* (
  root: string,
  catalog: LibraryCatalog,
  evidence: LibraryArtifact,
  source: LibrarySource,
  scenario: string
) {
  const interpretation =
    scenario === "Grok paper interpretation"
      ? LibraryArtifact.make({
          ...(yield* yield* Effect.map(
            Effect.map(
              fixtureJson({
                sourceId: "s",
                canonicalUrl: source.canonicalUrl,
                method: "grok-deep-research",
                provider: "grok",
                toolName: "deep-research",
                toolCallId: "proof",
                complete: true,
                capturedRevision: "abc",
                artifacts: [LibraryArtifact.make({ ...evidence, role: "extracted-full-text" })],
              }),
              (value) => new TextEncoder().encode(value)
            ),
            (value) => saveImmutable(root, "interpretation/import.json", value)
          )),
          role: "import-provenance",
          mediaType: "application/json",
        })
      : undefined;
  const fixtures: Record<string, ReadonlyArray<LibraryArtifact>> = {
    "metadata-only web": [LibraryArtifact.make({ ...evidence, role: "target-metadata" })],
    "paper PDF without text": [
      LibraryArtifact.make({ ...evidence, role: "raw-full-text", mediaType: "application/pdf" }),
    ],
    "GitHub discussion README only": [
      LibraryArtifact.make({ ...evidence, role: "repository-tree" }),
      LibraryArtifact.make({ ...evidence, role: "extracted-full-text" }),
    ],
    "YouTube transcript without provenance": [LibraryArtifact.make({ ...evidence, role: "transcript-full-text" })],
    "Grok paper interpretation": [
      LibraryArtifact.make({ ...evidence, role: "extracted-full-text" }),
      ...(interpretation === undefined ? [] : [interpretation]),
      ...A.getUnsafe(catalog.qualifications, 1).evidence,
    ],
  };
  const artifacts = fixtures[scenario];
  if (artifacts === undefined) throw new Error("Unknown false-reading fixture");
  return artifacts;
});

const unreadReviewVariation = (scenario: string, revision: string) => {
  const base = {
    disposition: "incomplete",
    reason: "Preserved target acquisition evidence reviewed; no source reading claimed",
    revision,
    includeReceipt: true,
    corrupt: false,
    category: "missing",
    valid: false,
  };
  const overrides: Record<string, Partial<typeof base>> = {
    incomplete: { category: "incomplete", valid: true },
    "tool-blocked": { disposition: "tool-blocked", category: "tool-blocked", valid: true },
    ambiguous: { disposition: "ambiguous", category: "ambiguous", valid: true },
    "empty review": { reason: "" },
    "wrong revision": { revision: "wrong" },
    "unreviewed blocked": { includeReceipt: false },
    "corrupted review": { corrupt: true },
  };
  return { ...base, ...overrides[scenario] };
};

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "research-library-views-" });
  const report = yield* saveImmutable(
    root,
    "reports/r.md",
    new TextEncoder().encode("A report referencing https://example.com/source")
  );
  const evidence = LibraryArtifact.make({
    ...(yield* saveImmutable(
      // Deliberate hostile fixture bytes are saved as data; the rendering test asserts HTML escaping.
      // nosemgrep: javascript.lang.security.audit.unknown-value-with-script-tag.unknown-value-with-script-tag
      root,
      "evidence/source.txt",
      new TextEncoder().encode('<script>globalThis.pwned=true</script><img src=x onerror="alert(1)">')
    )),
    role: "extracted-full-text",
    mediaType: "text/plain",
  });
  const rawHtml = LibraryArtifact.make({
    ...(yield* saveImmutable(root, "evidence/source.html", new TextEncoder().encode("<html>source</html>"))),
    role: "raw-full-text",
    mediaType: "text/html",
  });
  const response = LibraryArtifact.make({
    ...(yield* yield* Effect.map(
      Effect.map(
        // Deliberate hostile JSON fixture data; the view assertions below verify HTML escaping.
        // nosemgrep: javascript.lang.security.audit.unknown-value-with-script-tag.unknown-value-with-script-tag
        fixtureJson({
          data: {
            markdown: '<script>globalThis.pwned=true</script><img src=x onerror="alert(1)">',
            rawHtml: "<html>source</html>",
            metadata: { sourceURL: "https://example.com/source", statusCode: 200 },
          },
        }),
        (value) => new TextEncoder().encode(value)
      ),
      // Save encoded fixture bytes as data, never executable markup.
      // nosemgrep: javascript.lang.security.audit.unknown-value-with-script-tag.unknown-value-with-script-tag
      (value) => saveImmutable(root, "evidence/response.json", value)
    )),
    role: "raw-response",
    mediaType: "application/json",
  });
  const document = LibraryDocument.make({
    id: "r",
    originalPath: path.join(root, "outside.md"),
    snapshotPath: report.path,
    sha256: report.sha256,
    bytes: report.bytes,
    title: "Report <img onerror=alert(1)>",
    reportDate: "2026-10-06",
    expectedOccurrences: 1,
  });
  const source = LibrarySource.make({
    id: "s",
    kind: "web",
    canonicalUrl: "https://example.com/source",
    identity: "Example <script>bad()</script>",
    revision: "abc",
    repository: "repos/example",
    ownership: "external",
    locators: ["https://example.com/source"],
  });
  const capture = LibraryCapture.make({
    id: "c",
    sourceId: "s",
    status: "readable",
    method: "firecrawl",
    recordedAt: "2026-10-06",
    capturedRevision: "abc",
    requestedRevision: "abc",
    complete: true,
    artifacts: [evidence, rawHtml, response],
    reason: "",
  });
  const qualifications = yield* Effect.forEach(["firecrawl", "grok-deep-research"], (adapter) =>
    Effect.gen(function* () {
      const probeCapture = LibraryCapture.make({ ...capture, id: adapter, method: adapter });
      const probe = LibraryProbeEvidence.make({
        adapter,
        sourceId: source.id,
        sourceUrl: source.canonicalUrl,
        status: "verified",
        captureId: probeCapture.id,
        complete: true,
        artifacts: [evidence, rawHtml, response],
      });
      const encoded = yield* S.encodeEffect(LibraryProbeEvidenceJson)(probe);
      const providerEvents = [
        {
          direction: "sent",
          message: {
            method: "session/prompt",
            params: { sessionId: "test", prompt: [{ type: "text", text: "/deep-research fixture" }] },
          },
        },
        {
          direction: "received",
          message: {
            params: {
              sessionId: "test",
              update: {
                sessionUpdate: "workflow_updated",
                run_id: "fixture",
                name: "deep-research",
                status: "completed",
                phases: A.map(["Plan", "Research", "Verify", "Report"], (title) => ({ title, state: "done" })),
              },
            },
          },
        },
      ];
      const providerEncoded = yield* S.encodeUnknownEffect(UnknownJson)(A.getUnsafe(providerEvents, 0));
      const completionEncoded = yield* S.encodeUnknownEffect(UnknownJson)(A.getUnsafe(providerEvents, 1));
      const providerArtifact = LibraryArtifact.make({
        ...(yield* saveImmutable(
          root,
          `qualifications/${adapter}/provider.ndjson`,
          new TextEncoder().encode(`${providerEncoded}\n${completionEncoded}`)
        )),
        role: "raw-provider-events",
        mediaType: "application/x-ndjson",
      });
      const artifact = LibraryArtifact.make({
        ...(yield* saveImmutable(root, `qualifications/${adapter}/probe.json`, new TextEncoder().encode(encoded))),
        role: "qualification-probe",
        mediaType: "application/json",
      });
      return LibraryQualification.make({
        id: adapter,
        adapter,
        status: "verified",
        required: true,
        recordedAt: "2026-10-06",
        evidence: adapter === "grok-deep-research" ? [providerArtifact] : [artifact],
        reason: "actual fixture probe",
      });
    })
  );
  const catalog = LibraryCatalog.make({
    schema: "beep.research.library/v2",
    documents: [document],
    sources: [source],
    occurrences: A.map(extractLibraryReferences("A report referencing https://example.com/source"), (reference) =>
      LibraryOccurrence.make({ ...reference, id: "o", documentId: "r", sourceId: "s", revision: "abc" })
    ),
    captures: [
      capture,
      LibraryCapture.make({ ...capture, id: "firecrawl", method: "firecrawl" }),
      LibraryCapture.make({ ...capture, id: "grok-deep-research", method: "grok-deep-research" }),
    ],
    qualifications,
  });
  yield* withCatalog(root, () => Effect.succeed(catalog));
  return { root, catalog, fs, path, evidence };
});

it.layer(services, { timeout: "30 seconds" })("portable research library views and strict integrity", (it) => {
  it.effect("escapes source HTML, renders readable evidence and relative backlinks without fetch", () =>
    Effect.gen(function* () {
      const { root, fs, path, evidence } = yield* fixture;
      yield* renderLibrary(root);
      const html = yield* fs.readFileString(path.join(root, "index.html"));
      const readable = yield* fs.readFileString(path.join(root, "sources/s", `artifact-c-${evidence.sha256}.html`));
      expect(readable).toContain("&lt;script&gt;globalThis.pwned=true&lt;/script&gt;");
      expect(html).not.toContain("globalThis.pwned=true");
      expect(html).toContain("Example &lt;script&gt;bad()&lt;/script&gt;");
      expect(html).not.toContain('<img src=x onerror="alert(1)">');
      expect(readable).toContain('href="../../evidence/source.txt"');
      expect(html).toContain("revision abc");
      expect(readable).toContain('href="../../views/reports/r/index.html"');
      expect(html).toContain('href="sources/s/index.html"');
      expect(html).not.toContain("fetch(");
      expect(html).not.toContain(root);
    })
  );

  it.effect("accepts hash-bound complete captures and source-bound required probes", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture;
      yield* verifyLibrary(root);
    })
  );

  it.effect("holds a failed retained receipt on the removed web route only to evidence integrity", () =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      const retained = A.getUnsafe(catalog.qualifications, 0);
      expect(retained.adapter).toBe(removedLibraryWebAdapter);
      const failed = LibraryQualification.make({
        ...retained,
        id: "firecrawl-failed",
        status: "failed",
        recordedAt: "2026-10-07",
      });
      yield* withCatalog(root, () =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, qualifications: [...catalog.qualifications, failed] }))
      );
      yield* verifyLibrary(root);

      const tampered = LibraryQualification.make({
        ...failed,
        evidence: A.map(failed.evidence, (artifact) =>
          LibraryArtifact.make({ ...artifact, sha256: Str.repeat(64)("0") })
        ),
      });
      yield* withCatalog(root, () =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, qualifications: [...catalog.qualifications, tampered] }))
      );
      (yield* Effect.exit(verifyLibrary(root))).pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect.each(["wrong revision", "partial capture", "interrupted capture", "unqualified required route"])(
    "rejects %s",
    (scenario) =>
      Effect.gen(function* () {
        const { root, catalog } = yield* fixture;
        const capture = LibraryCapture.make({
          ...A.getUnsafe(catalog.captures, 0),
          capturedRevision: scenario === "wrong revision" ? "wrong" : "abc",
          complete: scenario !== "partial capture",
          status: scenario === "interrupted capture" ? "interrupted" : "readable",
        });
        const qualifications =
          scenario === "unqualified required route"
            ? [LibraryQualification.make({ ...A.getUnsafe(catalog.qualifications, 0), status: "failed", evidence: [] })]
            : catalog.qualifications;
        yield* withCatalog(root, () =>
          Effect.succeed(
            LibraryCatalog.make({
              ...catalog,
              captures: [
                capture,
                LibraryCapture.make({ ...capture, id: "firecrawl", method: "firecrawl" }),
                LibraryCapture.make({ ...capture, id: "grok-deep-research", method: "grok-deep-research" }),
              ],
              qualifications,
            })
          )
        );
        (yield* Effect.exit(verifyLibrary(root))).pipe(Exit.isFailure, assertTrue);
      })
  );

  it.effect("rejects missing and ambiguous citation relationships", () =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      yield* withCatalog(root, () => Effect.succeed(LibraryCatalog.make({ ...catalog, occurrences: [] })));
      const missingCitations = yield* Effect.exit(verifyLibrary(root));
      missingCitations.pipe(Exit.isFailure, assertTrue);
      yield* withCatalog(root, () =>
        Effect.succeed(
          LibraryCatalog.make({ ...catalog, occurrences: [...catalog.occurrences, ...catalog.occurrences] })
        )
      );
      const ambiguousCitations = yield* Effect.exit(verifyLibrary(root));
      ambiguousCitations.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("does not treat a blocked provider as a source unavailability receipt", () =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      const capture = LibraryCapture.make({
        ...A.getUnsafe(catalog.captures, 0),
        status: "blocked",
        complete: true,
        reason: "Provider authentication unavailable",
      });
      yield* withCatalog(root, () => Effect.succeed(LibraryCatalog.make({ ...catalog, captures: [capture] })));
      (yield* Effect.exit(verifyLibrary(root))).pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("requires every cited version even when another version is readable", () =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      const source = LibrarySource.make({
        ...A.getUnsafe(catalog.sources, 0),
        versions: [
          LibrarySourceVersion.make({
            revision: "v2",
            canonicalUrl: "https://example.com/source?v2",
            locators: ["https://example.com/source"],
          }),
        ],
      });
      const occurrences = A.map(catalog.occurrences, (occurrence) =>
        LibraryOccurrence.make({ ...occurrence, revision: "v2" })
      );
      yield* withCatalog(root, () =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [source], occurrences }))
      );
      (yield* Effect.exit(verifyLibrary(root))).pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect.each([
    "incomplete",
    "tool-blocked",
    "ambiguous",
    "unreviewed blocked",
    "corrupted review",
    "wrong revision",
    "empty review",
  ])("accounts reviewed unread source without affirmative reading: %s", (scenario) =>
    Effect.gen(function* () {
      const { root, catalog, fs, path } = yield* fixture;
      const source = LibrarySource.make({
        ...A.getUnsafe(catalog.sources, 0),
        kind: "unresolved",
        ownership: "unresolved",
      });
      const evidence = LibraryArtifact.make({
        ...(yield* yield* Effect.map(
          Effect.map(
            fixtureJson({
              sourceId: source.id,
              locator: source.canonicalUrl,
              attempt: "Partial target evidence; no complete source reading",
            }),
            (value) => new TextEncoder().encode(value)
          ),
          (value) => saveImmutable(root, "review/source-attempt.json", value)
        )),
        role: "disposition-evidence",
        mediaType: "application/json",
      });
      const variation = unreadReviewVariation(scenario, source.revision);
      const disposition = variation.disposition;
      const payload = {
        kind: "disposition",
        sourceId: source.id,
        locator: source.canonicalUrl,
        disposition,
        reason: variation.reason,
        reviewer: "fixture",
        reviewedAt: "2026-10-06",
        artifacts: [evidence],
      };
      const receipt = LibraryArtifact.make({
        ...(yield* yield* Effect.map(
          Effect.map(fixtureJson(payload), (value) => new TextEncoder().encode(value)),
          (value) => saveImmutable(root, "review/disposition.json", value)
        )),
        role: "reviewed-disposition",
        mediaType: "application/json",
      });
      const capture = LibraryCapture.make({
        id: "review",
        sourceId: source.id,
        status: "blocked",
        method: "reviewed-disposition",
        recordedAt: "2026-10-06",
        requestedRevision: variation.revision,
        capturedRevision: "",
        complete: false,
        reason: "Explicit unread-source review",
        artifacts: variation.includeReceipt ? [evidence, receipt] : [evidence],
      });
      yield* withCatalog(root, () =>
        Effect.succeed(
          LibraryCatalog.make({
            ...catalog,
            sources: [source],
            captures: [capture],
            qualifications: A.filter(catalog.qualifications, (item) => item.adapter === "grok-deep-research"),
          })
        )
      );
      if (variation.corrupt) {
        yield* fs.writeFileString(path.join(root, receipt.path), "Corrupted review receipt");
      }
      expect(capture.complete).toBe(false);
      expect(capture.status).toBe("blocked");
      const outcome = yield* Effect.exit(verifyLibrary(root));
      strictEqual(Exit.isSuccess(outcome), variation.valid);
      yield* renderLibrary(root);
      const index = yield* fs.readFileString(path.join(root, "index.html"));
      const category = variation.category;
      expect(index).toContain(`data-status="${category}"`);
      const card = yield* fs.readFileString(path.join(root, "sources", source.id, "index.html"));
      if (category !== "missing") expect(card).toContain(`${category} (reviewed; not read)`);
      else expect(card).not.toContain("(reviewed; not read)");
    })
  );
  it.effect.each(["valid review", "corrupt review", "wrong revision"])(
    "uses latest validated revision-specific claim: %s",
    (scenario) =>
      Effect.gen(function* () {
        const { root, catalog, fs, path } = yield* fixture;
        const source = LibrarySource.make({
          ...A.getUnsafe(catalog.sources, 0),
          versions: [
            LibrarySourceVersion.make({
              revision: "abc",
              canonicalUrl: A.getUnsafe(catalog.sources, 0).canonicalUrl,
              locators: A.getUnsafe(catalog.sources, 0).locators,
            }),
            LibrarySourceVersion.make({
              revision: "other",
              canonicalUrl: A.getUnsafe(catalog.sources, 0).canonicalUrl,
              locators: A.getUnsafe(catalog.sources, 0).locators,
            }),
          ],
        });
        const other = LibraryCapture.make({
          ...A.getUnsafe(catalog.captures, 0),
          id: "other-version",
          requestedRevision: "other",
          capturedRevision: "other",
        });
        const occurrences = [
          ...catalog.occurrences,
          LibraryOccurrence.make({ ...A.getUnsafe(catalog.occurrences, 0), id: "other-occurrence", revision: "other" }),
        ];
        const prior = LibraryCatalog.make({
          ...catalog,
          sources: [source],
          occurrences,
          captures: [...catalog.captures, other],
        });
        const initial = yield* libraryEffectiveCaptures(root, prior, source);
        expect(A.map(initial, (item) => item.category)).toEqual(["readable", "readable"]);
        const payload = LibraryDispositionImportPayload.make({
          kind: "disposition",
          sourceId: source.id,
          locator: source.canonicalUrl,
          disposition: "incomplete",
          reason: "Human inspection found article body stops at membership gate; original bytes retained",
          reviewer: "fixture",
          reviewedAt: "2026-10-06",
          artifacts: [A.getUnsafe(A.getUnsafe(catalog.captures, 0).artifacts, 0)],
        });
        const receipt = LibraryArtifact.make({
          ...(yield* yield* Effect.map(
            Effect.map(fixtureJson(payload), (value) => new TextEncoder().encode(value)),
            (value) => saveImmutable(root, "reviews/partial.json", value)
          )),
          role: "reviewed-disposition",
          mediaType: "application/json",
        });
        const reviewed = LibraryCapture.make({
          id: "partial-review",
          sourceId: source.id,
          requestedRevision: scenario === "wrong revision" ? "not-inventoried" : "abc",
          capturedRevision: "",
          status: "blocked",
          complete: false,
          method: "reviewed-disposition",
          recordedAt: "2026-10-07",
          reason: payload.reason,
          artifacts: [A.getUnsafe(A.getUnsafe(catalog.captures, 0).artifacts, 0), receipt],
        });
        if (scenario === "corrupt review") {
          yield* fs.writeFileString(path.resolve(root, receipt.path), "corrupt");
        }
        const reviewedCatalog = LibraryCatalog.make({ ...prior, captures: [...prior.captures, reviewed] });
        const current = yield* libraryEffectiveCaptures(root, reviewedCatalog, source);
        expect(A.map(current, (item) => item.category)).toEqual([
          scenario === "valid review" ? "incomplete" : "readable",
          "readable",
        ]);
        expect(libraryEffectiveCategory(A.map(current, (item) => item.category))).toBe(
          scenario === "valid review" ? "incomplete" : "readable"
        );
        yield* withCatalog(root, () =>
          Effect.succeed(LibraryCatalog.make({ ...reviewedCatalog, occurrences: catalog.occurrences }))
        );
        const gate = yield* Effect.exit(verifyLibrary(root));
        strictEqual(Exit.isSuccess(gate), scenario === "valid review");
        if (scenario === "valid review") {
          yield* renderLibrary(root);
          const index = yield* fs.readFileString(path.join(root, "index.html"));
          expect(index).toContain('data-status="incomplete"');
          const card = yield* fs.readFileString(path.join(root, "sources/s/index.html"));
          expect(card).not.toContain("Validated current reading evidence");
        }
        const restored = LibraryCapture.make({
          ...A.getUnsafe(catalog.captures, 0),
          id: "revalidated",
          recordedAt: "2026-10-06",
        });
        const restoredCatalog = LibraryCatalog.make({
          ...reviewedCatalog,
          captures: [...reviewedCatalog.captures, restored],
        });
        const restoredClaims = yield* libraryEffectiveCaptures(root, restoredCatalog, source);
        expect(A.map(restoredClaims, (item) => item.category)).toEqual(["readable", "readable"]);
        expect(A.getUnsafe(restoredClaims, 0).capture?.id).toBe("revalidated");
      })
  );

  it.effect("accounts explicit source unavailability without calling it readable", () =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      const source = LibrarySource.make({
        ...A.getUnsafe(catalog.sources, 0),
        id: "unavailable",
        revision: "",
        canonicalUrl: "https://example.com/gone",
        locators: ["https://example.com/gone"],
      });
      const evidence = LibraryArtifact.make({
        ...(yield* saveImmutable(
          root,
          "unavailable/evidence.txt",
          new TextEncoder().encode("Source withdrawal evidence")
        )),
        role: "disposition-evidence",
        mediaType: "text/plain",
      });
      const payload = LibraryDispositionImportPayload.make({
        kind: "disposition",
        sourceId: source.id,
        locator: source.canonicalUrl,
        disposition: "unavailable",
        reason: "Source withdrawn with preserved receipt",
        reviewer: "fixture",
        reviewedAt: "2026-10-06",
        artifacts: [evidence],
      });
      const encoded = yield* S.encodeEffect(LibraryDispositionImportPayloadJson)(payload);
      const receipt = LibraryArtifact.make({
        ...(yield* saveImmutable(root, "unavailable/review.json", new TextEncoder().encode(encoded))),
        role: "reviewed-disposition",
        mediaType: "application/json",
      });
      const capture = LibraryCapture.make({
        id: "unavailable",
        sourceId: source.id,
        status: "unavailable",
        method: "reviewed-disposition",
        recordedAt: "2026-10-06",
        requestedRevision: "",
        capturedRevision: "",
        complete: false,
        artifacts: [evidence, receipt],
        reason: "Source withdrawn; explicit unavailable receipt retained.",
      });
      yield* withCatalog(root, () =>
        Effect.succeed(
          LibraryCatalog.make({
            ...catalog,
            sources: [...catalog.sources, source],
            captures: [...catalog.captures, capture],
          })
        )
      );
      yield* verifyLibrary(root);
    })
  );

  it.effect("rejects interrupted artifact publication and renders an explicit missing state", () =>
    Effect.gen(function* () {
      const { root, fs, path, evidence } = yield* fixture;
      yield* fs.remove(path.join(root, evidence.path));
      (yield* Effect.exit(verifyLibrary(root))).pipe(Exit.isFailure, assertTrue);
      yield* renderLibrary(root);
      const readFileString1 = yield* fs.readFileString(
        path.join(root, "sources/s", `artifact-c-${evidence.sha256}.html`)
      );
      expect(readFileString1).toContain("Artifact unavailable: read failed.");
    })
  );

  it.effect("rejects corrupted evidence bytes and reports snapshots", () =>
    Effect.gen(function* () {
      const { root, fs, path, evidence } = yield* fixture;
      yield* fs.writeFileString(path.join(root, evidence.path), "corruption");
      yield* renderLibrary(root);
      const readFileString2 = yield* fs.readFileString(
        path.join(root, "sources/s", `artifact-c-${evidence.sha256}.html`)
      );
      expect(readFileString2).toContain("Artifact unavailable: integrity mismatch.");
      (yield* Effect.exit(verifyLibrary(root))).pipe(Exit.isFailure, assertTrue);
    })
  );
  it.effect.each([
    "metadata-only web",
    "paper PDF without text",
    "Grok paper interpretation",
    "GitHub discussion README only",
    "YouTube transcript without provenance",
  ])("rejects false reading: %s", (scenario) =>
    Effect.gen(function* () {
      const { root, catalog, evidence } = yield* fixture;
      const kind = falseReadingKinds[scenario];
      if (kind === undefined) throw new Error("Unknown source-kind fixture");
      const source = LibrarySource.make({ ...A.getUnsafe(catalog.sources, 0), kind });
      const artifacts = yield* falseReadingArtifacts(root, catalog, evidence, source, scenario);
      const captures = A.map(catalog.captures, (capture) => LibraryCapture.make({ ...capture, artifacts }));
      yield* withCatalog(root, () => Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [source], captures })));
      const result = yield* Effect.exit(verifyLibrary(root));
      expect(Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
        "source-kind evidence or target provenance missing"
      );
    })
  );

  it.effect("does not use a v1 unavailable receipt to account for v2", () =>
    Effect.gen(function* () {
      const { root, catalog, evidence } = yield* fixture;
      const source = LibrarySource.make({
        ...A.getUnsafe(catalog.sources, 0),
        versions: [
          LibrarySourceVersion.make({
            revision: "abc",
            canonicalUrl: "https://example.com/source",
            locators: ["https://example.com/source"],
          }),
          LibrarySourceVersion.make({
            revision: "v2",
            canonicalUrl: "https://example.com/source?v2",
            locators: ["https://example.com/source?v2"],
          }),
        ],
      });
      const payload = LibraryDispositionImportPayload.make({
        kind: "disposition",
        sourceId: source.id,
        locator: "https://example.com/source",
        disposition: "unavailable",
        reason: "Preserved target withdrawal proof",
        reviewer: "fixture",
        reviewedAt: "2026-10-06",
        artifacts: [evidence],
      });
      const receipt = LibraryArtifact.make({
        ...(yield* yield* Effect.map(
          Effect.map(S.encodeEffect(LibraryDispositionImportPayloadJson)(payload), (value) =>
            new TextEncoder().encode(value)
          ),
          (value) => saveImmutable(root, "reviewed/v1.json", value)
        )),
        role: "reviewed-disposition",
        mediaType: "application/json",
      });
      const capture = LibraryCapture.make({
        ...A.getUnsafe(catalog.captures, 0),
        id: "unavailable-v2",
        requestedRevision: "v2",
        status: "unavailable",
        complete: false,
        artifacts: [LibraryArtifact.make({ ...evidence, role: "disposition-evidence" }), receipt],
      });
      yield* withCatalog(root, () =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [source], captures: [...catalog.captures, capture] }))
      );
      const result = yield* Effect.exit(verifyLibrary(root));
      expect(Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
        "unavailable status lacks a valid identity-bound reviewed disposition"
      );
    })
  );
  it.effect("links synthesized repositories to resource reports without fabricating citations", () =>
    Effect.gen(function* () {
      const { root, catalog, fs, path } = yield* fixture;
      const resource = LibrarySource.make({
        ...A.getUnsafe(catalog.sources, 0),
        kind: "github-code",
        repository: "owner/repo",
      });
      const repository = LibrarySource.make({
        ...resource,
        id: "repo",
        kind: "github-repository",
        canonicalUrl: "https://github.com/owner/repo",
        locators: ["https://github.com/owner/repo"],
      });
      yield* withCatalog(root, () =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, sources: [resource, repository] }))
      );
      yield* renderLibrary(root);
      const card = yield* fs.readFileString(path.join(root, "sources/repo/index.html"));
      expect(card).toContain("indirect provenance through");
      expect(card).toContain('href="../../views/reports/r/index.html"');
      const readFileString3 = yield* fs.readFileString(path.join(root, "sources/repo/SOURCE.md"));
      expect(readFileString3).toContain("Related reports (indirect provenance)");
      const readFileString4 = yield* fs.readFileString(path.join(root, "views/reports/r/index.html"));
      expect(readFileString4).toContain('href="../../../sources/repo/index.html"');
      expect(catalog.occurrences.length).toBe(1);
    })
  );
  it.effect("requires canonical content objects even when an evidence alias remains readable", () =>
    Effect.gen(function* () {
      const { root, fs, path, evidence } = yield* fixture;
      yield* fs.remove(path.join(root, "objects/sha256", evidence.sha256));
      const result = yield* Effect.exit(verifyLibrary(root));
      expect(Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
        "canonical content object missing or corrupt"
      );
    })
  );
  it.effect("checks immutable intake census when a report record was dropped", () =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      const document = A.getUnsafe(catalog.documents, 0);
      const intake = LibraryIntake.make({
        id: "intake",
        date: "2026-10-06",
        createdAt: "2026-10-06",
        repoCommit: "",
        inputRoots: [],
        manifestPath: "intakes/2026-10-06/manifest.json",
        files: [
          LibraryIntakeFile.make({
            originalPath: document.originalPath,
            snapshotPath: document.snapshotPath,
            sha256: document.sha256,
            bytes: document.bytes,
            parseable: true,
          }),
        ],
      });
      const artifact = LibraryArtifact.make({
        ...(yield* yield* Effect.map(
          Effect.map(S.encodeEffect(LibraryIntakeJson)(intake), (value) => new TextEncoder().encode(value)),
          (value) => saveImmutable(root, intake.manifestPath, value)
        )),
        role: "intake-manifest",
        mediaType: "application/json",
      });
      yield* withCatalog(root, () =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, documents: [], intakes: [intake], artifacts: [artifact] }))
      );
      const result = yield* Effect.exit(verifyLibrary(root));
      expect(Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
        "parseable intake input missing from report census"
      );
    })
  );
  it.effect("refuses projection directories that point outside the library", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture;
      const outside = yield* fs.makeTempDirectoryScoped({ prefix: "research-library-outside-" });
      yield* fs.symlink(outside, path.join(root, "sources"));
      (yield* Effect.exit(renderLibrary(root))).pipe(Exit.isFailure, assertTrue);
      const readDirectory5 = yield* fs.readDirectory(outside);
      expect(readDirectory5).toEqual([]);
    })
  );
  it.effect.each(["", "v1"])("binds requested arXiv version '%s' to the observed PDF header", (requested) =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      const source = LibrarySource.make({
        ...A.getUnsafe(catalog.sources, 0),
        kind: "paper",
        identity: "arxiv:2609.12345",
        canonicalUrl: `https://arxiv.org/abs/2609.12345${requested}`,
        revision: requested,
        versions: [
          LibrarySourceVersion.make({
            revision: requested,
            canonicalUrl: `https://arxiv.org/abs/2609.12345${requested}`,
            locators: A.getUnsafe(catalog.sources, 0).locators,
          }),
        ],
      });
      const artifact = Effect.fn(function* (name: string, text: string, role: string, mediaType: string) {
        return LibraryArtifact.make({
          ...(yield* saveImmutable(root, `paper/${name}`, new TextEncoder().encode(text))),
          role,
          mediaType,
        });
      });
      const argument = yield* artifact("source.pdf", "%PDF-1.7 retained original", "raw-full-text", "application/pdf");
      const argument1 = yield* artifact(
        "source.txt",
        "arXiv:2609.12345v2 Full paper text",
        "extracted-full-text",
        "text/plain"
      );
      const fixtureJson1 = yield* fixtureJson({
        requestedUrl: source.canonicalUrl,
        pdfUrl: `https://arxiv.org/pdf/2609.12345${requested}`,
        status: 200,
        requestedRevision: requested,
        capturedRevision: "v2",
        paperId: "2609.12345",
      });
      const artifacts = [
        argument,
        argument1,
        yield* artifact("target.json", fixtureJson1, "target-metadata", "application/json"),
      ];
      const capture = LibraryCapture.make({
        ...A.getUnsafe(catalog.captures, 0),
        method: "paper",
        requestedRevision: requested,
        capturedRevision: "v2",
        artifacts,
      });
      const probe = LibraryProbeEvidence.make({
        adapter: "paper",
        sourceId: source.id,
        sourceUrl: source.canonicalUrl,
        status: "verified",
        captureId: capture.id,
        complete: true,
        artifacts,
      });
      const value6 = yield* S.encodeEffect(LibraryProbeEvidenceJson)(probe);
      const proof = yield* artifact("probe.json", value6, "qualification-probe", "application/json");
      yield* withCatalog(root, () =>
        Effect.succeed(
          LibraryCatalog.make({
            ...catalog,
            sources: [source],
            occurrences: A.map(catalog.occurrences, (o) => LibraryOccurrence.make({ ...o, revision: requested })),
            captures: [capture],
            qualifications: [
              LibraryQualification.make({
                ...A.getUnsafe(catalog.qualifications, 0),
                adapter: "paper",
                evidence: [proof],
              }),
              A.getUnsafe(catalog.qualifications, 1),
            ],
          })
        )
      );
      const result = yield* Effect.exit(verifyLibrary(root));
      strictEqual(Exit.isSuccess(result), requested === "");
    })
  );
  it.effect("gates explicitly required provider routes even without a matching source-kind adapter", () =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      const required = LibraryQualification.make({
        id: "alpha-required",
        adapter: "alphaxiv",
        required: true,
        status: "failed",
        recordedAt: "2026-10-06",
        evidence: [],
        reason: "Full text probe missing",
      });
      yield* withCatalog(root, () =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, qualifications: [...catalog.qualifications, required] }))
      );
      const result = yield* Effect.exit(verifyLibrary(root));
      expect(Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
        "alphaxiv: required route lacks verified source-bound probe evidence"
      );
    })
  );
  it.effect.each(["valid", "wrong revision", "empty review", "missing context"])(
    "checks reviewed non-reference: %s",
    (scenario) =>
      Effect.gen(function* () {
        const { root, catalog, fs, path } = yield* fixture;
        const text = "`Protocol/Call` is a local method token.";
        const report = yield* saveImmutable(root, "reports/token.md", new TextEncoder().encode(text));
        const source = yield* classifyLibraryReference("Protocol/Call", "token-report");
        const document = LibraryDocument.make({
          id: "token-report",
          originalPath: "/input/token.md",
          snapshotPath: report.path,
          sha256: report.sha256,
          bytes: report.bytes,
          title: "Token context",
          reportDate: "",
          expectedOccurrences: 1,
        });
        const occurrence = LibraryOccurrence.make({
          ...A.getUnsafe(extractLibraryReferences(text), 0),
          id: "token-occurrence",
          documentId: document.id,
          sourceId: source.id,
          context: text,
          revision: "",
        });
        yield* withCatalog(root, () =>
          Effect.succeed(
            LibraryCatalog.make({
              ...catalog,
              sources: [...catalog.sources, source],
              documents: [...catalog.documents, document],
              occurrences: [...catalog.occurrences, occurrence],
            })
          )
        );
        const context = {
          sourceId: source.id,
          locator: "Protocol/Call",
          requestedRevision: "",
          occurrences:
            scenario === "missing context"
              ? []
              : [
                  {
                    occurrenceId: occurrence.id,
                    documentId: document.id,
                    snapshotPath: report.path,
                    documentSha256: report.sha256,
                    line: occurrence.line,
                    column: occurrence.column,
                    endLine: occurrence.endLine,
                    endColumn: occurrence.endColumn,
                    locator: occurrence.locator,
                    context: text,
                    contextSha256: yield* hashBytes(new TextEncoder().encode(text)),
                  },
                ],
        };
        const evidence = LibraryArtifact.make({
          ...(yield* yield* Effect.map(
            Effect.map(fixtureJson(context), (value) => new TextEncoder().encode(value)),
            (value) => saveImmutable(root, "reviews/token-context.json", value)
          )),
          role: "disposition-evidence",
          mediaType: "application/json",
        });
        const raw = {
          kind: "disposition",
          sourceId: source.id,
          locator: "Protocol/Call",
          disposition: "non-reference",
          reason:
            scenario === "empty review"
              ? "          "
              : "Context demonstrates a local protocol method, not an external repository.",
          reviewer: scenario === "empty review" ? " " : "fixture",
          reviewedAt: "2026-10-06",
          artifacts: [evidence],
        };
        const request = path.join(root, "non-reference-import.json");
        const fixtureJson7 = yield* fixtureJson(raw);
        yield* fs.writeFileString(request, fixtureJson7);
        const imported = yield* Effect.exit(importLibraryResult(root, request));
        if (scenario === "empty review" || scenario === "missing context") {
          imported.pipe(Exit.isFailure, assertTrue);
          return;
        }
        imported.pipe(Exit.isSuccess, assertTrue);
        const current = yield* loadCatalog(root);
        expect(A.findFirst(current.captures, (c) => c.status === "non-reference")._tag).toBe("Some");
        if (scenario === "wrong revision") {
          yield* withCatalog(root, () =>
            Effect.succeed(
              LibraryCatalog.make({
                ...current,
                captures: A.map(current.captures, (c) =>
                  c.status === "non-reference" ? LibraryCapture.make({ ...c, requestedRevision: "v2" }) : c
                ),
              })
            )
          );
        }
        const result = yield* Effect.exit(verifyLibrary(root));
        strictEqual(Exit.isSuccess(result), scenario === "valid");
      })
  );
  it.effect("prioritizes validated reading evidence before collapsed retained history", () =>
    Effect.gen(function* () {
      const { root, catalog, fs, path } = yield* fixture;
      const current = A.getUnsafe(catalog.captures, catalog.captures.length - 1);
      const history = LibraryCapture.make({
        ...current,
        id: "history",
        status: "blocked",
        complete: false,
        reason: "Partial historic attempt",
      });
      yield* withCatalog(root, () =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, captures: [history, ...catalog.captures] }))
      );
      yield* renderLibrary(root);
      const card = yield* fs.readFileString(path.join(root, "sources/s/index.html"));
      expect(O.getOrElse(constant(-1))(Str.indexOf(`artifact-${current.id}-`)(card))).toBeLessThan(
        O.getOrElse(constant(-1))(Str.indexOf("artifact-history-")(card))
      );
      expect(card).toContain("<details><summary>Retained history — not validated reading evidence</summary>");
    })
  );
  it.effect("compares preserved leading BOM characters against exact provider originals", () =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      const markdown = "\uFEFF\nThe Akron Legal News article text";
      const html = "\uFEFF<html>The Akron Legal News article text</html>";
      const make = Effect.fn(function* (name: string, text: string, role: string, mediaType: string) {
        return LibraryArtifact.make({
          ...(yield* saveImmutable(root, `bom/${name}`, new TextEncoder().encode(text))),
          role,
          mediaType,
        });
      });
      const originalMarkdown = yield* make("source.md", markdown, "extracted-full-text", "text/markdown");
      const originalHtml = yield* make("source.html", html, "raw-full-text", "text/html");
      const fixtureJson8 = yield* fixtureJson({
        data: {
          markdown,
          rawHtml: html,
          metadata: { sourceURL: A.getUnsafe(catalog.sources, 0).canonicalUrl, statusCode: 200 },
        },
      });
      const response = yield* make("response.json", fixtureJson8, "raw-response", "application/json");
      const capture = LibraryCapture.make({
        ...A.getUnsafe(catalog.captures, 0),
        artifacts: [originalMarkdown, originalHtml, response],
      });
      const librarySourceEvidenceValid9 = yield* librarySourceEvidenceValid(
        root,
        A.getUnsafe(catalog.sources, 0),
        capture
      );
      expect(librarySourceEvidenceValid9).toBe(true);
      const altered = yield* make("altered.md", Str.slice(1)(markdown), "extracted-full-text", "text/markdown");
      const librarySourceEvidenceValid10 = yield* librarySourceEvidenceValid(
        root,
        A.getUnsafe(catalog.sources, 0),
        LibraryCapture.make({ ...capture, artifacts: [altered, originalHtml, response] })
      );
      expect(librarySourceEvidenceValid10).toBe(false);
    })
  );
  it.effect.each(webSourceKinds)("validates genuine imported Firecrawl %s originals", (kind) =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      const source = LibrarySource.make({ ...A.getUnsafe(catalog.sources, 0), kind });
      const capture = A.getUnsafe(catalog.captures, 0);
      const payload = {
        sourceId: source.id,
        canonicalUrl: source.canonicalUrl,
        method: capture.method,
        provider: "firecrawl",
        toolName: "scrape",
        toolCallId: "actual",
        complete: true,
        capturedRevision: capture.capturedRevision,
        artifacts: capture.artifacts,
      };
      const envelope = LibraryArtifact.make({
        ...(yield* yield* Effect.map(
          Effect.map(fixtureJson(payload), (value) => new TextEncoder().encode(value)),
          (value) => saveImmutable(root, "imports/firecrawl.json", value)
        )),
        role: "import-provenance",
        mediaType: "application/json",
      });
      const imported = LibraryCapture.make({ ...capture, artifacts: [...capture.artifacts, envelope] });
      const librarySourceEvidenceValid11 = yield* librarySourceEvidenceValid(root, source, imported);
      expect(librarySourceEvidenceValid11).toBe(true);
      const librarySourceEvidenceValid12 = yield* librarySourceEvidenceValid(
        root,
        LibrarySource.make({ ...source, kind: "paper" }),
        imported
      );
      expect(librarySourceEvidenceValid12).toBe(false);
      const librarySourceEvidenceValid13 = yield* librarySourceEvidenceValid(
        root,
        source,
        LibraryCapture.make({
          ...imported,
          artifacts: A.filter(imported.artifacts, (a) => a.role !== "raw-response"),
        })
      );
      expect(librarySourceEvidenceValid13).toBe(false);
      const librarySourceEvidenceValid14 = yield* librarySourceEvidenceValid(
        root,
        LibrarySource.make({ ...source, canonicalUrl: "https://example.com/unrelated" }),
        imported
      );
      expect(librarySourceEvidenceValid14).toBe(false);
    })
  );
  it.effect.each(["valid", "wrong landing", "missing relationship", "wrong PDF target"])(
    "binds native paper import to actual publisher citation: %s",
    (scenario) =>
      Effect.gen(function* () {
        const { root, catalog, evidence } = yield* fixture;
        const source = LibrarySource.make({ ...A.getUnsafe(catalog.sources, 0), kind: "paper" });
        const make = Effect.fn(function* (name: string, text: string, role: string, mediaType = "application/json") {
          return LibraryArtifact.make({
            ...(yield* saveImmutable(root, `paper/${name}`, new TextEncoder().encode(text))),
            role,
            mediaType,
          });
        });
        const pdfUrl = "https://example.com/source.pdf";
        const landing = yield* make(
          "landing.html",
          scenario === "missing relationship"
            ? "<html>No PDF relationship</html>"
            : `<meta content="${pdfUrl}" name=citation_pdf_url>`,
          "publisher-landing-page",
          "text/html"
        );
        const fixtureJson15 = yield* fixtureJson({
          requestedUrl: scenario === "wrong landing" ? "https://example.com/unrelated" : source.canonicalUrl,
          status: 200,
        });
        const landingMeta = yield* make("landing.json", fixtureJson15, "publisher-target-metadata");
        const fixtureJson16 = yield* fixtureJson({
          requestedUrl: scenario === "wrong PDF target" ? "https://example.com/unrelated.pdf" : pdfUrl,
          pdfUrl,
          status: 200,
        });
        const pdfMeta = yield* make("pdf-target.json", fixtureJson16, "pdf-request-metadata");
        const fixtureJson17 = yield* fixtureJson({ requestedUrl: source.canonicalUrl, pdfUrl, status: 200 });
        const target = yield* make("target.json", fixtureJson17, "target-metadata");
        const pdf = yield* make("source.pdf", "%PDF-original fixture", "raw-full-text", "application/pdf");
        const fixtureJson18 = yield* fixtureJson({
          sourceId: source.id,
          citedUrl: source.canonicalUrl,
          pdfUrl,
          observedCitationPdfUrl: pdfUrl,
          landingHtmlSha256: landing.sha256,
          landingMetadataSha256: landingMeta.sha256,
          pdfMetadataSha256: pdfMeta.sha256,
          pdfSha256: pdf.sha256,
          reason: "Exact publisher citation relationship",
        });
        const proof = yield* make("resolution.json", fixtureJson18, "citation-resolution");
        const originals = [landing, landingMeta, pdfMeta, target, pdf, proof, evidence];
        const fixtureJson19 = yield* fixtureJson({
          sourceId: source.id,
          canonicalUrl: source.canonicalUrl,
          method: "paper",
          provider: "publisher-http",
          toolName: "fetch",
          toolCallId: "actual",
          complete: true,
          capturedRevision: "abc",
          artifacts: originals,
        });
        const envelope = yield* make("import.json", fixtureJson19, "import-provenance");
        const capture = LibraryCapture.make({
          ...A.getUnsafe(catalog.captures, 0),
          method: "paper",
          artifacts: [...originals, envelope],
        });
        const librarySourceEvidenceValid20 = yield* librarySourceEvidenceValid(root, source, capture);
        expect(librarySourceEvidenceValid20).toBe(scenario === "valid");
      })
  );
  it.effect("binds GitHub blob evidence to the exact pinned file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const argument2 = yield* Path.Path;
      const String2 = yield* Config.String("HOME");
      const root = yield* fs.makeTempDirectoryScoped({
        directory: argument2.join(String2, ".cache"),
        prefix: "library-git-evidence-",
      });
      const clone = path.join(root, "repos/github/owner/repo");
      yield* fs.makeDirectory(clone, { recursive: true });
      const git = (args: ReadonlyArray<string>) => runLibraryCommand(root, "git", ["-C", clone, ...args]);
      yield* git(["init"]);
      yield* git(["config", "user.name", "Library fixture"]);
      yield* git(["config", "user.email", "fixture@example.invalid"]);
      yield* git(["remote", "add", "origin", "https://github.com/owner/repo.git"]);
      yield* fs.writeFileString(path.join(clone, "target.ts"), "export const target = true;\n");
      yield* fs.writeFileString(path.join(clone, "README.md"), "A different document\n");
      yield* fs.writeFileString(path.join(clone, "large.txt"), Str.repeat(1_100_000)("fixture "));
      yield* git(["add", "--", "target.ts", "README.md", "large.txt"]);
      yield* git(["-c", "core.hooksPath=/dev/null", "commit", "-m", "test: retain evidence fixture"]);
      const git21 = yield* git(["rev-parse", "HEAD"]);
      const revision = Str.trim(git21);
      const make = Effect.fn(function* (name: string, text: string, role: string) {
        return LibraryArtifact.make({
          ...(yield* saveImmutable(root, `evidence/${name}`, new TextEncoder().encode(text))),
          role,
          mediaType: "text/plain",
        });
      });
      const fixtureJson22 = yield* fixtureJson({
        remote: "https://github.com/owner/repo.git",
        revision,
        clone: "repos/github/owner/repo",
        requestedRevision: "HEAD",
      });
      const pin = yield* make("pin.json", fixtureJson22, "repository-pin");
      const git23 = yield* git(["ls-tree", "-r", "--name-only", revision]);
      const tree = yield* make("tree.txt", git23, "repository-tree");
      const exact = yield* make("target.txt", "export const target = true;\n", "raw-full-text");
      const borrowed = yield* make("README.txt", "A different document\n", "raw-full-text");
      const source = LibrarySource.make({
        id: "blob",
        kind: "github-code",
        canonicalUrl: "https://github.com/owner/repo/blob/HEAD/target.ts",
        identity: "github:owner/repo:blob:target.ts",
        revision: "HEAD",
        repository: "owner/repo",
        ownership: "external",
        locators: [],
      });
      const capture = LibraryCapture.make({
        id: "blob",
        sourceId: "blob",
        method: "github",
        recordedAt: "2026-10-06",
        requestedRevision: "HEAD",
        capturedRevision: revision,
        complete: true,
        status: "readable",
        reason: "fixture",
        artifacts: [pin, tree, exact],
      });
      const librarySourceEvidenceValid24 = yield* librarySourceEvidenceValid(root, source, capture);
      expect(librarySourceEvidenceValid24).toBe(true);
      const fixtureJson25 = yield* fixtureJson({
        remote: "https://github.com/owner/repo.git",
        revision,
        clone: "repos/github/owner/repo",
        requestedRevision: revision,
      });
      const commitPin = yield* make("commit-pin.json", fixtureJson25, "repository-pin");
      const patchPath = path.join(root, "commit.diff");
      yield* git(["show", "--no-ext-diff", "--no-textconv", "--format=fuller", revision, `--output=${patchPath}`]);
      const patchBytes = yield* fs.readFile(patchPath);
      expect(patchBytes.byteLength).toBeGreaterThan(8_000_000);
      const patch = LibraryArtifact.make({
        ...(yield* saveImmutable(root, "evidence/commit.diff", patchBytes)),
        role: "raw-diff",
        mediaType: "text/x-diff",
      });
      const commitSource = LibrarySource.make({
        ...source,
        id: "commit",
        canonicalUrl: `https://github.com/owner/repo/commit/${revision}`,
        identity: "github:owner/repo:commit",
        revision,
      });
      const commitCapture = LibraryCapture.make({
        ...capture,
        id: "commit",
        sourceId: "commit",
        requestedRevision: revision,
        artifacts: [commitPin, tree, patch],
      });
      const librarySourceEvidenceValid26 = yield* librarySourceEvidenceValid(root, commitSource, commitCapture);
      expect(librarySourceEvidenceValid26).toBe(true);
      const partialPatch = yield* make("partial.diff", "An incomplete diff body", "raw-diff");
      const librarySourceEvidenceValid27 = yield* librarySourceEvidenceValid(
        root,
        commitSource,
        LibraryCapture.make({ ...commitCapture, artifacts: [commitPin, tree, partialPatch] })
      );
      expect(librarySourceEvidenceValid27).toBe(false);
      const listingSource = LibrarySource.make({
        ...source,
        canonicalUrl: "https://github.com/owner/repo/commits/HEAD",
      });
      const entries = [{ sha: revision, html_url: `https://github.com/owner/repo/commit/${revision}` }];
      const fixtureJson28 = yield* fixtureJson(entries);
      const page = yield* make("commits-page-1.json", fixtureJson28, "raw-discussion");
      const fixtureJson29 = yield* fixtureJson([entries]);
      const aggregate = yield* make("commits.json", fixtureJson29, "raw-discussion");
      const fixtureJson30 = yield* fixtureJson({
        endpoint: `repos/owner/repo/commits?sha=${revision}&per_page=100`,
        pages: 1,
        exhausted: true,
        pageSize: 100,
      });
      const pagination = yield* make("commits-pagination.json", fixtureJson30, "pagination-metadata");
      const listingCapture = LibraryCapture.make({ ...capture, artifacts: [pin, tree, page, aggregate, pagination] });
      const librarySourceEvidenceValid31 = yield* librarySourceEvidenceValid(root, listingSource, listingCapture);
      expect(librarySourceEvidenceValid31).toBe(true);
      const fixtureJson32 = yield* fixtureJson({
        endpoint: `repos/owner/repo/commits?sha=${revision}&per_page=100`,
        pages: 1,
        exhausted: false,
        pageSize: 100,
      });
      const unexhausted = yield* make("unexhausted.json", fixtureJson32, "pagination-metadata");
      const librarySourceEvidenceValid33 = yield* librarySourceEvidenceValid(
        root,
        listingSource,
        LibraryCapture.make({ ...listingCapture, artifacts: [pin, tree, page, aggregate, unexhausted] })
      );
      expect(librarySourceEvidenceValid33).toBe(false);
      const librarySourceEvidenceValid34 = yield* librarySourceEvidenceValid(
        root,
        listingSource,
        LibraryCapture.make({ ...listingCapture, artifacts: [pin, tree, aggregate, pagination] })
      );
      expect(librarySourceEvidenceValid34).toBe(false);
      const releaseSource = LibrarySource.make({
        ...source,
        kind: "github-release",
        canonicalUrl: "https://github.com/owner/repo/releases/tag/%40pkg%2Fcore%401.0",
      });
      const fixtureJson35 = yield* fixtureJson([
        { html_url: "https://github.com/owner/repo/releases/tag/@pkg/core%401.0", tag_name: "@pkg/core@1.0" },
      ]);
      const release = yield* make("release.json", fixtureJson35, "raw-discussion");
      const librarySourceEvidenceValid36 = yield* librarySourceEvidenceValid(
        root,
        releaseSource,
        LibraryCapture.make({ ...capture, artifacts: [pin, tree, release] })
      );
      expect(librarySourceEvidenceValid36).toBe(true);
      const fixtureJson37 = yield* fixtureJson([
        { html_url: "https://github.com/other/repo/releases/tag/@pkg/core%401.0", tag_name: "@pkg/core@1.0" },
      ]);
      const unrelated = yield* make("unrelated-release.json", fixtureJson37, "raw-discussion");
      const librarySourceEvidenceValid38 = yield* librarySourceEvidenceValid(
        root,
        releaseSource,
        LibraryCapture.make({ ...capture, artifacts: [pin, tree, unrelated] })
      );
      expect(librarySourceEvidenceValid38).toBe(false);
      const fixtureJson39 = yield* fixtureJson([
        { html_url: "https://github.com/owner/repo/releases/tag/@pkg/core%401.0", tag_name: "@pkg/core@2.0" },
      ]);
      const wrongTag = yield* make("wrong-tag.json", fixtureJson39, "raw-discussion");
      const librarySourceEvidenceValid40 = yield* librarySourceEvidenceValid(
        root,
        releaseSource,
        LibraryCapture.make({ ...capture, artifacts: [pin, tree, wrongTag] })
      );
      expect(librarySourceEvidenceValid40).toBe(false);
      const identityBody = {
        id: 123,
        node_id: "repo-123",
        full_name: "owner/renamed",
        html_url: "https://github.com/owner/renamed",
      };
      const fixtureJson41 = yield* fixtureJson(identityBody);
      const identity = yield* make("identity.json", fixtureJson41, "repository-identity-response");
      const receipts = A.map(["owner/repo", "owner/renamed"], (slug) => ({
        ...identityBody,
        requestedEndpoint: `https://api.github.com/repos/${slug}`,
        observedAt: "2026-10-06",
        exitCode: 0,
        sha256: identity.sha256,
        bytes: identity.bytes,
      }));
      const fixtureJson42 = yield* fixtureJson(receipts);
      const identityProof = yield* make("identity-receipts.json", fixtureJson42, "repository-identity-provenance");
      const fixtureJson43 = yield* fixtureJson([{ html_url: "https://github.com/owner/renamed/issues/1" }]);
      const renamedDiscussion = yield* make("renamed-issue.json", fixtureJson43, "raw-discussion");
      const discussionSource = LibrarySource.make({
        ...source,
        kind: "github-discussion",
        canonicalUrl: "https://github.com/owner/repo/issues/1",
      });
      const renamedCapture = LibraryCapture.make({
        ...capture,
        artifacts: [pin, tree, renamedDiscussion, identity, identityProof],
      });
      const librarySourceEvidenceValid44 = yield* librarySourceEvidenceValid(root, discussionSource, renamedCapture);
      expect(librarySourceEvidenceValid44).toBe(true);
      const librarySourceEvidenceValid45 = yield* librarySourceEvidenceValid(
        root,
        discussionSource,
        LibraryCapture.make({ ...renamedCapture, artifacts: [pin, tree, renamedDiscussion] })
      );
      expect(librarySourceEvidenceValid45).toBe(false);
      const fixtureJson46 = yield* fixtureJson(A.map(receipts, (item) => ({ ...item, id: 999 })));
      const wrongIdentityProof = yield* make(
        "wrong-identity-receipts.json",
        fixtureJson46,
        "repository-identity-provenance"
      );
      const librarySourceEvidenceValid47 = yield* librarySourceEvidenceValid(
        root,
        discussionSource,
        LibraryCapture.make({
          ...renamedCapture,
          artifacts: [pin, tree, renamedDiscussion, identity, wrongIdentityProof],
        })
      );
      expect(librarySourceEvidenceValid47).toBe(false);
      const prSource = LibrarySource.make({
        ...source,
        kind: "github-pr",
        canonicalUrl: "https://github.com/owner/repo/pull/1",
      });
      const pullBody = {
        html_url: "https://github.com/OWNER/repo/pull/1",
        base: { sha: revision },
        head: { sha: revision },
        changed_files: 0,
        additions: 0,
        deletions: 0,
      };
      const fixtureJson48 = yield* fixtureJson([pullBody]);
      const pull = yield* make("pull.json", fixtureJson48, "raw-discussion");
      const emptyDiff = yield* make("empty.diff", "", "raw-diff");
      const files = yield* make("files.json", "[[]]", "raw-discussion");
      const filesPage = yield* make("files-page-1.json", "[]", "raw-discussion");
      const fixtureJson49 = yield* fixtureJson({
        endpoint: "repos/owner/repo/pulls/1/files?per_page=100",
        pages: 1,
        exhausted: true,
        pageSize: 100,
      });
      const filesProof = yield* make("files-pagination.json", fixtureJson49, "pagination-metadata");
      const fixtureJson50 = yield* fixtureJson({
        method: "gh-api-diff",
        endpoint: "repos/owner/repo/pulls/1",
        accept: "application/vnd.github.diff",
        base: revision,
        head: revision,
      });
      const diffProof = yield* make("diff-proof.json", fixtureJson50, "diff-provenance");
      const emptyCapture = LibraryCapture.make({
        ...capture,
        artifacts: [pin, tree, pull, emptyDiff, files, filesPage, filesProof, diffProof],
      });
      const librarySourceEvidenceValid51 = yield* librarySourceEvidenceValid(root, prSource, emptyCapture);
      expect(librarySourceEvidenceValid51).toBe(true);
      const librarySourceEvidenceValid52 = yield* librarySourceEvidenceValid(
        root,
        prSource,
        LibraryCapture.make({
          ...emptyCapture,
          artifacts: A.filter(emptyCapture.artifacts, (a) => !libraryArtifactEquivalent(a, filesProof)),
        })
      );
      expect(librarySourceEvidenceValid52).toBe(false);
      const fixtureJson53 = yield* fixtureJson([{ ...pullBody, changed_files: 1 }]);
      const changedPull = yield* make("changed-pull.json", fixtureJson53, "raw-discussion");
      const librarySourceEvidenceValid54 = yield* librarySourceEvidenceValid(
        root,
        prSource,
        LibraryCapture.make({
          ...emptyCapture,
          artifacts: [pin, tree, changedPull, emptyDiff, files, filesPage, filesProof, diffProof],
        })
      );
      expect(librarySourceEvidenceValid54).toBe(false);
      yield* fs.writeFileString(path.join(clone, "target.ts"), "export const target = false;\n");
      yield* git(["add", "target.ts"]);
      yield* git(["-c", "core.hooksPath=/dev/null", "commit", "-m", "test: change cited target"]);
      const git55 = yield* git(["rev-parse", "HEAD"]);
      const child = Str.trim(git55);
      const fixtureJson56 = yield* fixtureJson([{ ...pullBody, head: { sha: Str.repeat(40)("f") }, changed_files: 1 }]);
      const legacyPull = yield* make("legacy-pull.json", fixtureJson56, "raw-discussion");
      const git57 = yield* git(["diff", "--no-ext-diff", "--no-textconv", `${revision}...${child}`]);
      const legacyDiff = yield* make("legacy.diff", git57, "raw-diff");
      const librarySourceEvidenceValid58 = yield* librarySourceEvidenceValid(
        root,
        prSource,
        LibraryCapture.make({ ...capture, artifacts: [pin, tree, legacyPull, legacyDiff] })
      );
      expect(librarySourceEvidenceValid58).toBe(true);
      const librarySourceEvidenceValid59 = yield* librarySourceEvidenceValid(
        root,
        prSource,
        LibraryCapture.make({
          ...capture,
          artifacts: [pin, tree, legacyPull, emptyDiff],
        })
      );
      expect(librarySourceEvidenceValid59).toBe(false);
      const incorrect = LibraryCapture.make({ ...capture, artifacts: [pin, tree, borrowed] });
      yield* withCatalog(root, () =>
        Effect.succeed(
          LibraryCatalog.make({
            schema: "beep.research.library/v2",
            documents: [],
            sources: [source],
            occurrences: [],
            captures: [incorrect],
            qualifications: [],
          })
        )
      );
      const result = yield* Effect.exit(verifyLibrary(root));
      const message = Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" });
      expect(message).toContain("source-kind evidence or target provenance missing");
      expect(message).not.toContain("pinned commit unavailable");
      const librarySourceEvidenceValid60 = yield* librarySourceEvidenceValid(
        root,
        source,
        LibraryCapture.make({ ...capture, artifacts: [pin, tree, borrowed] })
      );
      expect(librarySourceEvidenceValid60).toBe(false);
    })
  );
  it.effect.each([
    "valid",
    "wrong Atom identity",
    "different version PDF",
    "wrong metadata URL",
    "wrong header version",
  ])("binds headerless paper version proof: %s", (scenario) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const argument3 = yield* Path.Path;
      const String3 = yield* Config.String("HOME");
      const root = yield* fs.makeTempDirectoryScoped({
        directory: argument3.join(String3, ".cache"),
        prefix: "library-paper-proof-",
      });
      const make = Effect.fn(function* (name: string, text: string, role: string, mediaType = "application/json") {
        return LibraryArtifact.make({
          ...(yield* saveImmutable(root, `evidence/${name}`, new TextEncoder().encode(text))),
          role,
          mediaType,
        });
      });
      const pdf = yield* make("source.pdf", "%PDF-fixture original", "raw-full-text", "application/pdf");
      const versioned = yield* make(
        "versioned.pdf",
        scenario === "different version PDF" ? "%PDF-fixture different" : "%PDF-fixture original",
        "versioned-pdf-response",
        "application/pdf"
      );
      const atom = yield* make(
        "metadata.xml",
        `<feed><entry><id>http://arxiv.org/abs/${scenario === "wrong Atom identity" ? "2608.99999" : "2608.23992"}v3</id></entry></feed>`,
        "arxiv-version-metadata",
        "application/atom+xml"
      );
      const fixtureJson61 = yield* fixtureJson({
        metadataUrl:
          scenario === "wrong metadata URL"
            ? "https://export.arxiv.org/api/query?id_list=2608.99999"
            : "https://export.arxiv.org/api/query?id_list=2608.23992",
        metadataStatus: 200,
        metadataSha256: atom.sha256,
        paperId: "2608.23992",
        observedRevision: "v3",
        explicitUrl: "https://arxiv.org/pdf/2608.23992v3",
        resolvedUrl: "https://arxiv.org/pdf/2608.23992v3",
        status: 200,
        originalPdfSha256: pdf.sha256,
        versionedPdfSha256: versioned.sha256,
        identicalPdf: true,
      });
      const proof = yield* make("proof.json", fixtureJson61, "arxiv-version-proof");
      const fixtureJson62 = yield* fixtureJson({
        requestedUrl: "https://arxiv.org/abs/2608.23992",
        pdfUrl: "https://arxiv.org/pdf/2608.23992",
        status: 200,
        requestedRevision: "",
        capturedRevision: "v3",
        paperId: "2608.23992",
      });
      const metadata = yield* make("target.json", fixtureJson62, "target-metadata");
      const text = yield* make(
        "source.txt",
        scenario === "wrong header version" ? "arXiv:2608.23992v30" : "Headerless extracted paper body",
        "extracted-full-text",
        "text/plain"
      );
      const source = LibrarySource.make({
        id: "paper",
        kind: "paper",
        canonicalUrl: "https://arxiv.org/abs/2608.23992",
        identity: "arxiv:2608.23992",
        revision: "",
        repository: "",
        ownership: "external",
        locators: [],
      });
      const capture = LibraryCapture.make({
        id: "paper",
        sourceId: source.id,
        method: "paper",
        recordedAt: "2026-10-06",
        requestedRevision: "",
        capturedRevision: "v3",
        complete: true,
        status: "readable",
        reason: "fixture",
        artifacts: [pdf, versioned, atom, proof, metadata, text],
      });
      const librarySourceEvidenceValid63 = yield* librarySourceEvidenceValid(root, source, capture);
      expect(librarySourceEvidenceValid63).toBe(scenario === "valid");
    })
  );
  it.effect.each([
    "automatic",
    "creator",
    "named and numeric entities",
    "xml11 declaration",
    "default XML after xml11",
    "doctype entity",
    "unsafe doctype entity",
    "entity expansion limit",
    "wrong player",
    "wrong timed target",
    "wrong origin",
    "wrong XML timing",
    "wrong XML text",
    "partial API",
    "wrong timestamps",
    "HTTP failure",
  ])("validates authentic transcript API proof: %s", (scenario) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const argument4 = yield* Path.Path;
      const String4 = yield* Config.String("HOME");
      const root = yield* fs.makeTempDirectoryScoped({
        directory: argument4.join(String4, ".cache"),
        prefix: "library-caption-api-",
      });
      const make = Effect.fn(function* (name: string, text: string, role: string, mediaType = "application/json") {
        return LibraryArtifact.make({
          ...(yield* saveImmutable(root, `evidence/${name}`, new TextEncoder().encode(text))),
          role,
          mediaType,
        });
      });
      const id = "abcdefghijk";
      const url = `https://www.youtube.com/watch?v=${id}`;
      const variation = transcriptApiVariation(scenario);
      const automatic = variation.automatic;
      const timedUrl = `https://www.youtube.com/api/timedtext?v=${variation.timedId}&lang=en${variation.query}`;
      const watch = yield* make("watch.html", "Retained watch response", "raw-response", "text/html");
      const fixtureJson64 = yield* fixtureJson({
        videoDetails: { videoId: variation.playerId },
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [{ baseUrl: `${timedUrl}&fmt=srv3`, languageCode: "en", ...variation.captionKind }],
          },
        },
      });
      const player = yield* make("player.json", fixtureJson64, "raw-response");
      const xml = yield* make(
        "timed.xml",
        `${variation.xmlDoctype}<transcript><text start="${variation.xmlStart}" dur="2">${variation.xmlText}</text><text start="4" dur="1">Next cue</text></transcript>`,
        "raw-transcript",
        "text/xml"
      );
      const snippets = [
        { text: variation.decodedText, start: 1, duration: 2 },
        { text: "Next cue", start: 4, duration: 1 },
      ];
      const fixtureJson65 = yield* fixtureJson({
        videoId: id,
        languageCode: "en",
        isGenerated: automatic,
        snippets: variation.partialApi ? snippets.slice(0, 1) : snippets,
      });
      const api = yield* make("api.json", fixtureJson65, "raw-api-response");
      const fixtureJson66 = yield* fixtureJson({ id, webpage_url: url, originalPlayerSha256: player.sha256 });
      const target = yield* make("target.json", fixtureJson66, "target-metadata");
      const fixtureJson67 = yield* fixtureJson([
        {
          language: "en",
          url: timedUrl,
          format: "xml",
          origin: variation.origin,
          sourceSha256: xml.sha256,
        },
      ]);
      const provenance = yield* make("provenance.json", fixtureJson67, "transcript-provenance");
      const fixtureJson68 = yield* fixtureJson([
        { path: "watch.html", url, status: 200, sha256: watch.sha256, bytes: watch.bytes },
        {
          path: "player.json",
          url: "https://www.youtube.com/youtubei/v1/player",
          status: 200,
          sha256: player.sha256,
          bytes: player.bytes,
        },
        {
          path: "timed.xml",
          url: timedUrl,
          status: variation.status,
          sha256: xml.sha256,
          bytes: xml.bytes,
        },
      ]);
      const receipts = yield* make("receipts.json", fixtureJson68, "http-response-provenance");
      const text = yield* make(
        "transcript.txt",
        `${variation.transcriptStart} ${variation.decodedText}\n[4.000 - 5.000] Next cue\n`,
        "transcript-full-text",
        "text/plain"
      );
      const artifacts = [watch, player, xml, api, target, provenance, receipts, text];
      const fixtureJson69 = yield* fixtureJson({
        sourceId: "video",
        canonicalUrl: url,
        method: "youtube-transcript-api",
        provider: "youtube-transcript-api",
        complete: true,
        capturedRevision: id,
        toolName: "YouTubeTranscriptApi.fetch",
        toolCallId: "",
        artifacts,
      });
      const envelope = yield* make("import.json", fixtureJson69, "import-provenance");
      const source = LibrarySource.make({
        id: "video",
        kind: "youtube",
        canonicalUrl: url,
        identity: `youtube:${id}`,
        revision: id,
        repository: "",
        ownership: "external",
        locators: [url],
      });
      const capture = LibraryCapture.make({
        id: "api",
        sourceId: source.id,
        status: "readable",
        method: "youtube-transcript-api",
        recordedAt: "2026-10-06",
        requestedRevision: id,
        capturedRevision: id,
        complete: true,
        reason: "Original API/XML caption proof",
        artifacts: [...artifacts, envelope],
      });
      const valid = A.contains(
        ["automatic", "creator", "named and numeric entities", "xml11 declaration", "default XML after xml11"],
        scenario
      );
      const librarySourceEvidenceValid70 = yield* librarySourceEvidenceValid(root, source, capture);
      expect(librarySourceEvidenceValid70).toBe(valid);
      const fixtureJson71 = yield* fixtureJson({
        adapter: "youtube",
        sourceId: source.id,
        sourceUrl: url,
        status: "verified",
        captureId: capture.id,
        complete: true,
        artifacts: capture.artifacts,
      });
      const probe = yield* make("probe.json", fixtureJson71, "qualification-probe");
      const qualification = LibraryQualification.make({
        id: "probe",
        adapter: "youtube",
        status: "verified",
        required: true,
        recordedAt: "2026-10-06",
        reason: "Actual retained fallback capture",
        evidence: [probe],
      });
      const catalog = LibraryCatalog.make({
        schema: "beep.research.library/v2",
        documents: [],
        sources: [source],
        occurrences: [],
        captures: [capture],
        qualifications: [qualification],
      });
      const libraryQualificationValid72 = yield* libraryQualificationValid(root, catalog, qualification);
      expect(libraryQualificationValid72).toBe(valid);
    })
  );
  it.effect.each([
    "valid VTT",
    "valid VTT unversioned request",
    "missing spoken cues",
    "unrelated transcript",
    "wrong target metadata",
    "manual source",
  ])("validates YouTube source provenance: %s", (scenario) =>
    Effect.gen(function* () {
      const { root } = yield* fixture;
      const variation = captionVariation(scenario);
      const source = LibrarySource.make({
        id: "video",
        kind: "youtube",
        canonicalUrl: "https://www.youtube.com/watch?v=video-id",
        identity: "youtube:video-id",
        revision: "video-id",
        repository: "",
        ownership: "external",
        locators: [],
      });
      const make = Effect.fn(function* (name: string, text: string, role: string, mediaType: string) {
        return LibraryArtifact.make({
          ...(yield* saveImmutable(root, `video/${name}`, new TextEncoder().encode(text))),
          role,
          mediaType,
        });
      });
      const fixtureJson73 = yield* fixtureJson({
        id: "video-id",
        webpage_url: variation.webpageUrl,
      });
      const metadata = yield* make("metadata.json", fixtureJson73, "target-metadata", "application/json");
      const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n${variation.spoken}\n`;
      const fixtureJson74 = yield* fixtureJson([
        {
          language: "en",
          url: variation.url,
          format: variation.format,
          origin: variation.origin,
        },
      ]);
      const provenance = yield* make("provenance.json", fixtureJson74, "transcript-provenance", "application/json");
      const captions = yield* make("source.en.vtt", vtt, "transcript-full-text", "text/vtt");
      const transcript = yield* make("source.en.vtt.txt", variation.transcript, "transcript-full-text", "text/plain");
      const capture = LibraryCapture.make({
        id: "video",
        sourceId: "video",
        method: "youtube-captions",
        recordedAt: "2026-10-06",
        requestedRevision: "video-id",
        capturedRevision: "video-id",
        complete: true,
        status: "readable",
        reason: "fixture",
        artifacts: [metadata, provenance, captions, transcript],
      });
      const librarySourceEvidenceValid75 = yield* librarySourceEvidenceValid(root, source, capture);
      expect(librarySourceEvidenceValid75).toBe(variation.valid);
    })
  );
  it.effect("verifies immutable correction history and rejects an altered demoted capture", () =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      yield* withCatalog(root, () =>
        Effect.succeed(
          LibraryCatalog.make({
            ...catalog,
            captures: A.map(catalog.captures, (c) =>
              c.id === "c" ? LibraryCapture.make({ ...c, complete: false }) : c
            ),
          })
        )
      );
      yield* withCatalog(root, (current) => correctLibraryCaptures(root, current));
      const corrected = yield* loadCatalog(root);
      const prior = A.findFirst(corrected.captures, (c) => c.id === "c");
      expect(prior._tag).toBe("Some");
      if (prior._tag === "Some") {
        expect(prior.value.status).toBe("blocked");
        expect(A.some(prior.value.artifacts, (a) => a.role === "capture-correction")).toBe(true);
      }
      yield* verifyLibrary(root);
      yield* withCatalog(root, (current) =>
        Effect.succeed(
          LibraryCatalog.make({
            ...current,
            captures: A.map(current.captures, (c) =>
              c.id === "c" ? LibraryCapture.make({ ...c, reason: "Altered after-state" }) : c
            ),
          })
        )
      );
      const result = yield* Effect.exit(verifyLibrary(root));
      expect(Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
        "correction does not bind immutable before and demoted after state"
      );
    })
  );
  it.effect("does not link preserved raw HTML directly from Markdown source cards", () =>
    Effect.gen(function* () {
      const { root, fs, path } = yield* fixture;
      yield* renderLibrary(root);
      const card = yield* fs.readFileString(path.join(root, "sources/s/SOURCE.md"));
      expect(card).not.toContain("[original evidence](../../evidence/source.html)");
      expect(card).toContain("download preserved HTML from the escaped view");
    })
  );
});

it.effect.prop(
  "property: schema-generated library intakes survive a JSON round trip",
  { value: Arbitrary.schema(LibraryIntake) },
  ({ value }) =>
    Effect.gen(function* () {
      const argument5 = S.decodeEffect(LibraryIntakeJson);
      const value5 = yield* S.encodeEffect(LibraryIntakeJson)(value);
      const decoded = yield* argument5(value5);
      expect(decoded).toEqual(value);
    }),
  { arbitrary: fcRuns(32) }
);
