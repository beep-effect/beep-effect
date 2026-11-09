import * as Rdf from "@beep/rdf/Rdf";
import {
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryIntake,
  LibraryIntakeFile,
  LibraryOccurrence,
  LibraryProbeEvidence,
  LibraryQualification,
  LibrarySource,
  LibrarySourceVersion,
  libraryWebAdapter,
  renderLibrary,
  saveImmutable,
  verifyLibrary,
  withCatalog,
} from "@beep/repo-cli/commands/Research";
import {
  ShaclValidationError,
  ShaclValidationResult,
  ShaclValidationService,
  ShaclValidationViolation,
} from "@beep/semantic-web/services/shacl-validation";
import { fcRuns } from "@beep/test-utils";
import { expect, it } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { fixture, LibraryIntakeJson, LibraryProbeEvidenceJson, services } from "./support/ResearchLibraryViews.ts";

const fixtureJson = S.Unknown.pipe(S.fromJsonString, S.encodeEffect);

const decodeConsoleLines = S.decodeUnknownEffect(S.Array(S.String));

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

  it.effect.each([true, false])(
    "reports SHACL conforms=%s even when the integrity gate fails",
    Effect.fnUntraced(function* (conforms) {
      const { root, catalog } = yield* fixture;
      yield* withCatalog(root, () => Effect.succeed(LibraryCatalog.make({ ...catalog, occurrences: [] })));
      const validator = yield* ShaclValidationService;
      let calls = 0;
      const console = yield* TestConsole.make;
      const result = yield* Effect.exit(
        verifyLibrary(root).pipe(
          Effect.provideService(Console.Console, console),
          Effect.provideService(ShaclValidationService, {
            validate: Effect.fnUntraced(function* (request) {
              calls++;
              expect(request.dataset.quads.length).toBeGreaterThan(0);
              expect(request.shapes.length).toBeGreaterThan(0);
              expect(request.shapesDataset._tag).toBe("Some");
              const actual = yield* validator.validate(request);
              expect(actual.conforms).toBe(true);
              return ShaclValidationResult.make({
                conforms,
                violations: conforms
                  ? []
                  : [
                      ShaclValidationViolation.cases.violation.make({
                        focusNode: "urn:test:source",
                        path: Rdf.makeNamedNode("urn:test:status"),
                        message: "Injected constraint violation",
                      }),
                    ],
                truncated: false,
              });
            }),
          })
        )
      );
      expect(calls).toBe(1);
      expect(Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
        "citation census mismatch"
      );
      const output = yield* TestConsole.logLines.pipe(Effect.provideService(Console.Console, console));
      const lines = yield* decodeConsoleLines(output);
      expect(A.join(lines, "\n")).toContain(`shacl: conforms=${conforms} violations=${conforms ? 0 : 1}`);
      if (!conforms)
        expect(A.join(lines, "\n")).toContain("urn:test:source urn:test:status: Injected constraint violation");
    })
  );

  it.effect(
    "rejects SHACL non-conformance after a successful integrity gate",
    Effect.fnUntraced(function* () {
      const { root } = yield* fixture;
      const result = yield* Effect.exit(
        verifyLibrary(root).pipe(
          Effect.provideService(ShaclValidationService, {
            validate: () =>
              Effect.succeed(ShaclValidationResult.make({ conforms: false, violations: [], truncated: false })),
          })
        )
      );
      expect(Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
        "Research library SHACL validation failed"
      );
    })
  );

  it.effect(
    "wraps SHACL engine errors with library validation context",
    Effect.fnUntraced(function* () {
      const { root } = yield* fixture;
      const result = yield* Effect.exit(
        verifyLibrary(root).pipe(
          Effect.provideService(ShaclValidationService, {
            validate: () =>
              Effect.fail(ShaclValidationError.make({ reason: "invalidShape", message: "Invalid fixture shape" })),
          })
        )
      );
      const message = Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" });
      expect(message).toContain("Cannot validate library SHACL");
      expect(message).toContain("Invalid fixture shape");
    })
  );

  it.effect(
    "reports unresolved sources with no capture and unknown occurrence bindings",
    Effect.fnUntraced(function* () {
      const { root, catalog } = yield* fixture;
      const source = LibrarySource.make({
        ...A.getUnsafe(catalog.sources, 0),
        kind: "unresolved",
        ownership: "unresolved",
      });
      yield* withCatalog(root, () =>
        Effect.succeed(
          LibraryCatalog.make({
            ...catalog,
            sources: [source],
            captures: [],
            occurrences: [
              ...catalog.occurrences,
              LibraryOccurrence.make({
                ...A.getUnsafe(catalog.occurrences, 0),
                id: "unknown",
                documentId: "unknown-report",
                sourceId: "unknown-source",
              }),
            ],
          })
        )
      );
      const result = yield* Effect.exit(verifyLibrary(root));
      const message = Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" });
      expect(message).toContain("s: unresolved source identity");
      expect(message).toContain("s: no source capture or reviewed disposition");
      expect(message).toContain("unknown: unknown report");
      expect(message).toContain("unknown: unknown source");
    })
  );

  it.effect(
    "requires parseable intake files to match the complete report census",
    Effect.fnUntraced(function* () {
      const { root, catalog } = yield* fixture;
      const document = A.getUnsafe(catalog.documents, 0);
      const intake = LibraryIntake.make({
        id: "census",
        date: "2026-11-06",
        createdAt: "2026-11-06",
        repoCommit: "abc",
        inputRoots: [],
        manifestPath: "intakes/census.json",
        files: [
          LibraryIntakeFile.make({
            originalPath: "unregistered.md",
            snapshotPath: document.snapshotPath,
            sha256: document.sha256,
            bytes: document.bytes,
            parseable: true,
          }),
        ],
      });
      const encoded = yield* S.encodeEffect(LibraryIntakeJson)(intake);
      const manifest = LibraryArtifact.make({
        ...(yield* saveImmutable(root, intake.manifestPath, new TextEncoder().encode(encoded))),
        role: "intake-manifest",
        mediaType: "application/json",
      });
      yield* withCatalog(root, () =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, intakes: [intake], artifacts: [manifest] }))
      );
      const result = yield* Effect.exit(verifyLibrary(root));
      expect(Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
        "unregistered.md: parseable intake input missing from report census"
      );
    })
  );

  it.effect(
    "accepts a required probe URL bound to a source version",
    Effect.fnUntraced(function* () {
      const { root, catalog } = yield* fixture;
      const source = A.getUnsafe(catalog.sources, 0);
      const url = source.canonicalUrl;
      const qualification = A.getUnsafe(catalog.qualifications, 0);
      const probe = LibraryProbeEvidence.make({
        adapter: qualification.adapter,
        sourceId: source.id,
        sourceUrl: url,
        status: "verified",
        captureId: "firecrawl",
        complete: true,
        artifacts: A.getUnsafe(catalog.captures, 0).artifacts,
      });
      const encoded = yield* S.encodeEffect(LibraryProbeEvidenceJson)(probe);
      const artifact = LibraryArtifact.make({
        ...(yield* saveImmutable(root, "qualifications/version-probe.json", new TextEncoder().encode(encoded))),
        role: "qualification-probe",
        mediaType: "application/json",
      });
      yield* withCatalog(
        root,
        () =>
          Effect.succeed(
            LibraryCatalog.make({
              ...catalog,
              sources: [
                LibrarySource.make({
                  ...source,
                  canonicalUrl: "https://example.com/latest",
                  versions: [
                    LibrarySourceVersion.make({
                      revision: "abc",
                      canonicalUrl: url,
                      locators: source.locators,
                    }),
                  ],
                }),
              ],
              qualifications: [
                LibraryQualification.make({ ...qualification, evidence: [artifact] }),
                ...A.drop(catalog.qualifications, 1),
              ],
            })
          ),
        false
      );
      yield* verifyLibrary(root);
    })
  );

  it.effect(
    "wraps report read failures after immutable byte verification",
    Effect.fnUntraced(function* () {
      const { root, catalog, fs, path } = yield* fixture;
      const document = A.getUnsafe(catalog.documents, 0);
      const result = yield* Effect.exit(
        verifyLibrary(root).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readFileString: (file, encoding) =>
              file === path.resolve(root, document.snapshotPath)
                ? fs.readFileString(path.join(root, "missing-report"))
                : fs.readFileString(file, encoding),
          })
        )
      );
      expect(Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
        "Cannot read verified report"
      );
    })
  );

  it.effect("requires the live web route's latest qualification to stay verified", () =>
    Effect.gen(function* () {
      const { root, catalog } = yield* fixture;
      const retained = A.getUnsafe(catalog.qualifications, 0);
      expect(retained.adapter).toBe(libraryWebAdapter);
      yield* verifyLibrary(root);
      const failed = LibraryQualification.make({
        ...retained,
        id: "firecrawl-failed",
        status: "failed",
        recordedAt: "2026-10-07",
      });
      yield* withCatalog(root, () =>
        Effect.succeed(LibraryCatalog.make({ ...catalog, qualifications: [...catalog.qualifications, failed] }))
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
});

it.effect.prop(
  "property: schema-generated probe evidence survives a JSON round trip",
  { value: Arbitrary.schema(LibraryProbeEvidence) },
  ({ value }) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LibraryProbeEvidenceJson)(value);
      const decoded = yield* S.decodeEffect(LibraryProbeEvidenceJson)(encoded);
      expect(decoded).toEqual(value);
    }),
  { arbitrary: fcRuns(32) }
);
