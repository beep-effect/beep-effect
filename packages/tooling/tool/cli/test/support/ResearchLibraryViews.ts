import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import {
  extractLibraryReferences,
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryDocument,
  LibraryIntake,
  LibraryOccurrence,
  LibraryProbeEvidence,
  LibraryQualification,
  LibrarySource,
  saveImmutable,
  withCatalog,
} from "@beep/repo-cli/commands/Research";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

/** JSON codec of a stored route probe. */
export const LibraryProbeEvidenceJson = S.fromJsonString(LibraryProbeEvidence);

const UnknownJson = S.fromJsonString(S.Unknown);

/** JSON codec of a stored intake. */
export const LibraryIntakeJson = S.fromJsonString(LibraryIntake);

const fixtureJson = S.Unknown.pipe(S.fromJsonString, S.encodeEffect);

/** Node platform, crypto, SPARQL and SHACL services every library view suite runs on. */
export const services = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  OxigraphSparqlQueryServiceLive,
  ShaclValidationServiceLive
);

/** A scoped temporary library holding one report, one cited source and its captured evidence. */
export const fixture = Effect.gen(function* () {
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
