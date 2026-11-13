import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { PageSize, PdfStructure, PdfTools, PdfToolsError } from "@beep/pdf-tools";
import {
  hashBytes,
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryDocument,
  LibraryError,
  LibraryIntake,
  LibraryIntakeFile,
  LibraryIntakeRoot,
  LibraryMineDerivedText,
  LibraryMineOptions,
  LibraryMineReceipt,
  LibraryMineRunner,
  LibraryMineUnreadError,
  LibraryOccurrence,
  LibraryReadingRecord,
  LibrarySource,
  LibraryTriageRecord,
  loadCatalog,
  mineLibraryRead,
  mineLibrarySynthesize,
  mineLibraryTriage,
  saveImmutable,
  verifyLibrary,
  withCatalog,
} from "@beep/repo-cli/commands/Research";
import {
  assembleLibraryOntology,
  libraryShapes,
  libraryShapesDataset,
} from "@beep/repo-cli/commands/Research/Library/Library.ontology";
import { catalogDataset } from "@beep/repo-cli/commands/Research/Library/Library.projection";
import {
  deriveLibraryMinePdfText,
  LIBRARY_MINE_PDF_EXTRACTOR,
  LibraryBoxFileMetadata,
  libraryBoxSha1,
  planLibraryMine,
  readLibraryMineDerivedTextBody,
} from "@beep/repo-cli/test/ResearchLibrary";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertInstanceOf, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PDFDocument } from "pdf-lib";
import type { LibraryMineRunRequest } from "@beep/repo-cli/commands/Research";

const UnknownJson = S.fromJsonString(S.Unknown);
const PageTextsJson = S.String.pipe(S.Array, S.fromJsonString);
const DerivedTextJson = S.fromJsonString(LibraryMineDerivedText);
const derivedTextEquivalent = S.toEquivalence(LibraryMineDerivedText);
const ReceiptJson = S.fromJsonString(LibraryMineReceipt);
const TriageRecordJson = S.fromJsonString(LibraryTriageRecord);
const ReadingRecordJson = S.fromJsonString(LibraryReadingRecord);
const encodeJson = S.encodeUnknownEffect(UnknownJson);
const BoxMetadataJson = S.fromJsonString(LibraryBoxFileMetadata);
const BOX_URL = "https://app.box.com/file/123";

// Page text stored in the generated PDF's Subject: the fake driver reads it back per page,
// the way pdftotext emits each page followed by a form feed.
const paperPages = [
  "Bitemporal stores keep valid time\nand transaction time apart.\n",
  "They support audit queries.\n",
];
const localPages = ["A local paper on retrieval spans and citation checks.\n"];

const makePdf = Effect.fn("test.makePdf")(function* (pageCount: number, pageTexts: ReadonlyArray<string>) {
  const doc = yield* Effect.promise(() => PDFDocument.create({ updateMetadata: false }));
  A.makeBy(pageCount, () => doc.addPage([612, 792]));
  const subject = yield* S.encodeEffect(PageTextsJson)(pageTexts);
  doc.setSubject(subject);
  return yield* Effect.promise(() => doc.save({ useObjectStreams: false }));
});

const fakePdfTools = Effect.fn("test.fakePdfTools")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const inspected = yield* Ref.make(0);
  const load = (pdfPath: string) =>
    fs.readFile(pdfPath).pipe(
      Effect.mapError(() =>
        PdfToolsError.make({ reason: "io", message: "read failed", cause: O.some("fixture read failed") })
      ),
      Effect.flatMap((bytes) =>
        Effect.tryPromise({
          // pdf-lib only notices some damage when a page is counted: count inside the guard.
          try: () =>
            PDFDocument.load(bytes, { updateMetadata: false }).then((doc) => ({ doc, pageCount: doc.getPageCount() })),
          catch: () =>
            PdfToolsError.make({
              reason: "parse",
              message: `Could not parse ${pdfPath}.`,
              cause: O.some("fixture parse failed"),
            }),
        })
      )
    );
  const unused = () => Effect.die("This PDF operation is not used by mining.");
  const service = PdfTools.of({
    annotations: unused,
    inkCoverage: unused,
    measurePage: unused,
    pageWords: unused,
    renderPng: unused,
    svgToPdf: unused,
    inspect: Effect.fn("TestPdfTools.inspect")(function* (pdfPath: string) {
      yield* Ref.update(inspected, (count) => count + 1);
      const { pageCount } = yield* load(pdfPath);
      return PdfStructure.make({
        headerVersion: "1.7",
        pages: A.makeBy(pageCount, () => PageSize.make({ widthPt: 612, heightPt: 792 })),
        fonts: [],
        annotationCount: 0,
        hasOptionalContent: false,
        encrypted: false,
      });
    }),
    pageText: Effect.fn("TestPdfTools.pageText")(function* (request) {
      const { doc } = yield* load(request.pdfPath);
      const subject = O.getOrElse(O.fromNullishOr(doc.getSubject()), () => "[]");
      const pages = yield* S.decodeEffect(PageTextsJson)(subject).pipe(
        Effect.mapError(() =>
          PdfToolsError.make({ reason: "parse", message: "bad fixture subject", cause: O.some("bad fixture subject") })
        )
      );
      return `${O.getOrElse(A.get(pages, request.page - 1), () => "")}\f`;
    }),
  });
  return { inspected, service };
});

// The PDF driver is faked, so every byte the mine reads or writes stays in the Effect FileSystem:
// the memory filesystem holds the temp roots, captures and derived text. Nothing here spawns a
// process, so the spawner double dies if a case ever reaches it.
const services = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  NodeCrypto.layer,
  ShaclValidationServiceLive,
  // Own double: dies on any spawn, so a PDF mining path that spawns fails loudly;
  // `ScriptedSpawner` records and answers every spawn instead.
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("the research library mine PDF suite must not spawn a process"))
  )
);

/**
 * One cited Box-style source whose only capture artifact is a PDF, and an intake holding a
 * markdown report, a text PDF (twice, the copy private), a copy of the Box PDF, a scanned
 * PDF without text and a file that is not a PDF at all.
 */
const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "research-library-mine-pdf-" });
  const repo = yield* fs.makeTempDirectoryScoped({ prefix: "research-library-mine-pdf-repo-" });
  // `verifyLibrary` locates the repository by walking up from the working directory. Mark that
  // directory in the memory checkout so verify reaches its integrity checks over packet-free
  // topics instead of the live checkout's goals.
  yield* fs.makeDirectory(process.cwd(), { recursive: true });
  yield* fs.writeFileString(path.join(process.cwd(), "bun.lock"), "");
  yield* fs.makeDirectory(path.join(repo, "goals/demo-memory/ops"), { recursive: true });
  const manifest = yield* encodeJson({ initiative: { id: "demo-memory", title: "Demo memory" } });
  yield* fs.writeFileString(path.join(repo, "goals/demo-memory/ops/manifest.json"), manifest);
  const paperBytes = yield* makePdf(2, paperPages);
  const localBytes = yield* makePdf(1, localPages);
  const scanBytes = yield* makePdf(2, []);
  const brokenBytes = new TextEncoder().encode("%PDF-1.7 not really a pdf");
  const boxPdf = yield* saveImmutable(root, "evidence/paper/paper.pdf", paperBytes);
  const sha1 = yield* libraryBoxSha1(paperBytes);
  const metadataText = yield* S.encodeEffect(BoxMetadataJson)(
    LibraryBoxFileMetadata.make({
      fileId: "123",
      versionId: "456",
      name: "paper.pdf",
      boxSha1: sha1,
      sha1,
      sha256: boxPdf.sha256,
      bytes: boxPdf.bytes,
    })
  );
  const metadata = yield* saveImmutable(root, "evidence/paper/box-file.json", new TextEncoder().encode(metadataText));
  // A Box route capture: the PDF under a text role with no extracted text, plus Box file metadata.
  const capture = LibraryCapture.make({
    id: "capture-paper",
    sourceId: "paper",
    status: "readable",
    method: "box",
    recordedAt: "2026-11-06",
    capturedRevision: "123:456",
    requestedRevision: "456",
    complete: true,
    artifacts: [
      LibraryArtifact.make({ ...boxPdf, role: "raw-full-text", mediaType: "application/pdf" }),
      LibraryArtifact.make({ ...metadata, role: "box-file-metadata", mediaType: "application/json" }),
    ],
    reason: "",
  });
  const report = yield* saveImmutable(
    root,
    "intakes/2026-11-06/raw/report.md",
    new TextEncoder().encode(`See ${BOX_URL}`)
  );
  const intakeFile = Effect.fn(function* (name: string, bytes: Uint8Array, accessClass: "public" | "private") {
    const sha256 = yield* hashBytes(bytes);
    const saved = yield* saveImmutable(root, `intakes/2026-11-06/raw/${sha256}.pdf`, bytes);
    return LibraryIntakeFile.make({
      accessClass,
      originalPath: path.join(repo, name),
      snapshotPath: saved.path,
      sha256,
      bytes: saved.bytes,
      parseable: false,
    });
  });
  const files = [
    LibraryIntakeFile.make({
      originalPath: path.join(repo, "report.md"),
      snapshotPath: report.path,
      sha256: report.sha256,
      bytes: report.bytes,
      parseable: true,
    }),
    yield* intakeFile("2026-10-01-local-paper.pdf", localBytes, "public"),
    yield* intakeFile("private/local-paper-copy.pdf", localBytes, "private"),
    yield* intakeFile("box-paper-copy.pdf", paperBytes, "public"),
    yield* intakeFile("scan.pdf", scanBytes, "public"),
    yield* intakeFile("broken.pdf", brokenBytes, "public"),
  ];
  const catalog = LibraryCatalog.make({
    schema: "beep.research.library/v2",
    documents: [
      LibraryDocument.make({
        id: "report",
        originalPath: path.join(repo, "report.md"),
        snapshotPath: report.path,
        sha256: report.sha256,
        bytes: report.bytes,
        title: "Report",
        reportDate: "2026-11-06",
        expectedOccurrences: 1,
      }),
    ],
    intakes: [
      LibraryIntake.make({
        id: "intake-2026-11-06",
        date: "2026-11-06",
        createdAt: "2026-11-06T00:00:00.000Z",
        repoCommit: "",
        inputRoots: [LibraryIntakeRoot.make({ path: repo, repoCommit: "" })],
        manifestPath: "intakes/2026-11-06/manifest.json",
        files,
      }),
    ],
    sources: [
      LibrarySource.make({
        id: "paper",
        accessClass: "public",
        kind: "paper",
        canonicalUrl: BOX_URL,
        identity: BOX_URL,
        revision: "456",
        repository: "",
        ownership: "external",
        locators: [BOX_URL],
      }),
    ],
    occurrences: [
      LibraryOccurrence.make({
        id: "o1",
        documentId: "report",
        sourceId: "paper",
        revision: "456",
        locator: BOX_URL,
        line: 1,
        column: 5,
        endLine: 1,
        endColumn: 16,
        label: BOX_URL,
        form: "url",
      }),
    ],
    captures: [capture],
    qualifications: [],
  });
  yield* withCatalog(root, () => Effect.succeed(catalog));
  return {
    root,
    repo,
    fs,
    path,
    shas: {
      paper: yield* hashBytes(paperBytes),
      local: yield* hashBytes(localBytes),
      scan: yield* hashBytes(scanBytes),
      broken: yield* hashBytes(brokenBytes),
    },
  };
});

const options = (repo: string, profile: LibraryMineOptions["profile"], dryRun = false) =>
  LibraryMineOptions.make({
    intake: "2026-11-06",
    profile,
    limit: O.none(),
    concurrency: 1,
    dryRun,
    excludePrivate: false,
    repoRoot: O.some(repo),
  });

type Answer = (request: LibraryMineRunRequest) => string;

const fakeRunner = Effect.fn("test.fakeRunner")(function* (answer: Answer) {
  const calls = yield* Ref.make<ReadonlyArray<LibraryMineRunRequest>>([]);
  const service = LibraryMineRunner.of({
    run: Effect.fn("LibraryMineRunner.run")(function* (request) {
      yield* Ref.update(calls, A.append(request));
      return answer(request);
    }),
  });
  return { calls, service };
});

const selectAll: Answer = () => '{"decision":"select","reason":"on topic","topicIds":["goals/demo-memory"]}';

const isPaperJob = (request: LibraryMineRunRequest) => Str.startsWith("capture-paper-")(request.jobKey);
const isReportJob = (request: LibraryMineRunRequest) => Str.startsWith("document-report-")(request.jobKey);

const readings =
  (paperSpan: string): Answer =>
  (request) =>
    isPaperJob(request)
      ? `{"coverage":"complete","summary":"bitemporal","findings":[{"citoRelation":"supports","span":"${paperSpan}","summary":"separation","topicIds":["goals/demo-memory"]}]}`
      : isReportJob(request)
        ? '{"coverage":"complete","summary":"links","findings":[]}'
        : '{"coverage":"complete","summary":"local","findings":[{"citoRelation":"discusses","span":"retrieval spans and citation checks","summary":"spans","topicIds":["goals/demo-memory"]}]}';

type RunnerService = Parameters<typeof LibraryMineRunner.of>[0];
type PdfToolsService = Parameters<typeof PdfTools.of>[0];

const mine = <A, E, R>(effect: Effect.Effect<A, E, R>, runner: RunnerService, tools: PdfToolsService) =>
  effect.pipe(Effect.provideService(LibraryMineRunner, runner), Effect.provideService(PdfTools, tools));

const derivedReceipt = Effect.fn("test.derivedReceipt")(function* (root: string, sha256: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs.readFileString(path.join(root, "ops/mine/text", `${sha256}.json`));
  return yield* S.decodeEffect(DerivedTextJson)(text);
});

const recordsUnder = Effect.fn("test.recordsUnder")(function* <A>(
  root: string,
  tier: "t1" | "t2",
  decode: (text: string) => Effect.Effect<A, S.SchemaError>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(root, "ops/mine", tier, "records");
  const entries = yield* fs.readDirectory(directory);
  const listed = A.sort(entries, Str.Order);
  return yield* Effect.forEach(listed, (file) =>
    fs.readFileString(path.join(directory, file)).pipe(Effect.flatMap(decode))
  );
});

it.layer(services, { timeout: "30 seconds" })("research library mine PDFs", (it) => {
  it.effect("plans PDF capture and intake jobs, dedupes byte-identical PDFs and dry runs extract nothing", () =>
    Effect.gen(function* () {
      const { root, repo, fs, path, shas } = yield* fixture;
      const plan = yield* planLibraryMine(root, "2026-11-06");
      expect(
        A.map(plan, (job) => [job.kind, job.textSource, job.artifact.sha256, job.accessClass, job.artifact.mediaType])
      ).toStrictEqual([
        ["source", "pdf", shas.paper, "public", "application/pdf"],
        ["document", "text", plan[1]?.artifact.sha256, "public", "text/markdown"],
        ["document", "pdf", shas.local, "private", "application/pdf"],
        ["document", "pdf", shas.scan, "public", "application/pdf"],
        ["document", "pdf", shas.broken, "public", "application/pdf"],
      ]);
      const local = O.getOrThrow(A.findFirst(plan, (job) => job.artifact.sha256 === shas.local));
      const document = O.getOrThrow(local.pdfDocument);
      strictEqual(local.documentId, document.id);
      strictEqual(local.captureId, "");
      strictEqual(local.sourceId, "");
      expect([
        document.originalPath,
        document.title,
        document.filenameDate,
        document.expectedOccurrences,
      ]).toStrictEqual([path.join(repo, "2026-10-01-local-paper.pdf"), "2026-10-01-local-paper.pdf", "2026-10-01", 0]);
      const expectedId = yield* hashBytes(new TextEncoder().encode(`${document.originalPath}\n${shas.local}`));
      strictEqual(document.id, expectedId);
      const pdf = yield* fakePdfTools();
      const runner = yield* fakeRunner(selectAll);
      yield* mine(mineLibraryTriage(root, options(repo, "codex-luna", true)), runner.service, pdf.service);
      strictEqual((yield* Ref.get(runner.calls)).length, 0);
      const inspected = yield* Ref.get(pdf.inspected);
      strictEqual(inspected, 0);
      assertTrue(!(yield* fs.exists(path.join(root, "ops/mine/text"))));
    })
  );

  it.effect("dedupes PDF captures and preserves private access across captures and intake copies", () =>
    Effect.gen(function* () {
      const { root, shas } = yield* fixture;
      yield* withCatalog(root, (catalog) => {
        const capture = O.getOrThrow(A.head(catalog.captures));
        const intake = O.getOrThrow(A.head(catalog.intakes));
        return Effect.succeed(
          LibraryCatalog.make({
            ...catalog,
            captures: [...catalog.captures, LibraryCapture.make({ ...capture, id: "capture-copy" })],
            intakes: [
              LibraryIntake.make({
                ...intake,
                files: A.map(intake.files, (file) =>
                  file.sha256 === shas.paper ? LibraryIntakeFile.make({ ...file, accessClass: "private" }) : file
                ),
              }),
            ],
          })
        );
      });
      const plan = yield* planLibraryMine(root, "2026-11-06");
      const paperJobs = A.filter(plan, (job) => job.artifact.sha256 === shas.paper);
      strictEqual(paperJobs.length, 1);
      strictEqual(O.getOrThrow(A.head(paperJobs)).accessClass, "private");
    })
  );

  it.effect("records extraction tool failures as no-text and reuses the receipt without retrying", () =>
    Effect.gen(function* () {
      const { root, shas } = yield* fixture;
      const pdf = yield* fakePdfTools();
      const tools = PdfTools.of({
        ...pdf.service,
        inspect: Effect.fn("TestPdfTools.unavailable")(() =>
          Effect.fail(
            PdfToolsError.make({
              reason: "tool-unavailable",
              message: "fixture extractor unavailable",
            })
          )
        ),
      });
      const receipt = yield* deriveLibraryMinePdfText(root, shas.paper).pipe(Effect.provideService(PdfTools, tools));
      strictEqual(receipt.outcome, "no-text");
      const again = yield* deriveLibraryMinePdfText(root, shas.paper).pipe(
        Effect.provideService(PdfTools, pdf.service)
      );
      expect(again).toStrictEqual(receipt);
      const inspected = yield* Ref.get(pdf.inspected);
      strictEqual(inspected, 0);
    })
  );

  it.effect("derives PDF text once with a receipt, skips unreadable PDFs and resumes without re-extracting", () =>
    Effect.gen(function* () {
      const { root, repo, fs, path, shas } = yield* fixture;
      const pdf = yield* fakePdfTools();
      const runner = yield* fakeRunner(selectAll);
      const result = yield* mine(mineLibraryTriage(root, options(repo, "codex-luna")), runner.service, pdf.service);
      expect(result).toStrictEqual({ completed: 3, failed: 0, paused: 0, skippedUnreadable: 2 });
      const calls = yield* Ref.get(runner.calls);
      strictEqual(calls.length, 3);
      const paperPrompt = O.getOrThrow(A.findFirst(calls, isPaperJob)).prompt;
      assertTrue(Str.includes("Bitemporal stores keep valid time\nand transaction time apart.\n\f")(paperPrompt));
      const paper = yield* derivedReceipt(root, shas.paper);
      expect([
        paper.outcome,
        paper.pageCount,
        paper.extractor,
        paper.extractorVersion,
        paper.textPath,
        paper.textBytes > 0,
      ]).toStrictEqual([
        "text",
        2,
        LIBRARY_MINE_PDF_EXTRACTOR.driver,
        LIBRARY_MINE_PDF_EXTRACTOR.version,
        `ops/mine/text/${shas.paper}.txt`,
        true,
      ]);
      const derived = yield* fs.readFile(path.join(root, paper.textPath));
      const derivedSha256 = yield* hashBytes(derived);
      strictEqual(derivedSha256, paper.textSha256);
      strictEqual(
        new TextDecoder().decode(derived),
        A.join(
          A.map(paperPages, (page) => `${page}\f`),
          ""
        )
      );
      const scan = yield* derivedReceipt(root, shas.scan);
      expect([scan.outcome, scan.pageCount, scan.textPath, scan.textSha256]).toStrictEqual(["no-text", 2, "", ""]);
      const broken = yield* derivedReceipt(root, shas.broken);
      expect([broken.outcome, Str.startsWith("PDF text extraction failed")(broken.message)]).toStrictEqual([
        "no-text",
        true,
      ]);
      const triage = yield* recordsUnder(root, "t1", S.decodeEffect(TriageRecordJson));
      const pdfRecords = A.filter(triage, (record) => Str.isNonEmpty(record.derivedTextSha256));
      const local = yield* derivedReceipt(root, shas.local);
      // Records sort by job key: the capture job, then the document job.
      expect(A.map(pdfRecords, (record) => [record.artifactSha256, record.derivedTextSha256])).toStrictEqual([
        [shas.paper, paper.textSha256],
        [shas.local, local.textSha256],
      ]);
      const catalog = yield* loadCatalog(root);
      const registered = A.filter(catalog.documents, (document) => document.sha256 === shas.local);
      expect(A.map(registered, (document) => [document.accessClass, document.title])).toStrictEqual([
        ["private", "2026-10-01-local-paper.pdf"],
      ]);
      assertTrue(!A.some(catalog.documents, (document) => document.sha256 === shas.scan));
      const inspectedOnce = yield* Ref.get(pdf.inspected);
      strictEqual(inspectedOnce, 4);
      const again = yield* fakeRunner(selectAll);
      const rerun = yield* mine(mineLibraryTriage(root, options(repo, "codex-luna")), again.service, pdf.service);
      expect(rerun).toStrictEqual({ completed: 0, failed: 0, paused: 0, skippedUnreadable: 0 });
      strictEqual((yield* Ref.get(again.calls)).length, 0);
      const inspectedAgain = yield* Ref.get(pdf.inspected);
      strictEqual(inspectedAgain, inspectedOnce);
      strictEqual((yield* loadCatalog(root)).documents.length, catalog.documents.length);
    })
  );

  it.effect(
    "checks PDF spans against the derived text, binds intake PDF findings to their report and passes SHACL",
    () =>
      Effect.gen(function* () {
        const { root, repo, shas } = yield* fixture;
        const pdf = yield* fakePdfTools();
        const triage = yield* fakeRunner(selectAll);
        yield* mine(mineLibraryTriage(root, options(repo, "codex-luna")), triage.service, pdf.service);
        const runner = yield* fakeRunner(readings("keep valid time and transaction time apart."));
        yield* mine(mineLibraryRead(root, options(repo, "claude")), runner.service, pdf.service);
        const catalog = yield* loadCatalog(root);
        const report = O.getOrThrow(A.findFirst(catalog.documents, (document) => document.sha256 === shas.local));
        const findings = A.filter(catalog.findings, (finding) => Str.startsWith("mine:t2:")(finding.id));
        // Identity migration rehashes the fixture's "paper" id from its identity; the capture keeps its binding.
        const paperSourceId = O.getOrThrow(
          A.findFirst(catalog.captures, (capture) => capture.id === "capture-paper")
        ).sourceId;
        expect(
          A.map(findings, (finding) => [finding.sourceId, finding.captureId, finding.documentId, finding.span])
        ).toStrictEqual([
          // The span crossed a PDF line break: it resolves to the verbatim slice of the derived text.
          [paperSourceId, "capture-paper", "", "keep valid time\nand transaction time apart."],
          ["", "", report.id, "retrieval spans and citation checks"],
        ]);
        const readingsOut = yield* recordsUnder(root, "t2", S.decodeEffect(ReadingRecordJson));
        const pdfReadings = A.filter(
          readingsOut,
          (record) => record.artifactSha256 === shas.paper || record.artifactSha256 === shas.local
        );
        strictEqual(pdfReadings.length, 2);
        assertTrue(A.every(pdfReadings, (record) => Str.isNonEmpty(record.derivedTextSha256)));
        const validator = yield* ShaclValidationService;
        const ontology = yield* assembleLibraryOntology();
        const shapes = libraryShapes(ontology);
        const dataset = yield* catalogDataset(catalog);
        const result = yield* validator.validate(
          ShaclValidationRequest.make({ dataset, shapes, shapesDataset: O.some(libraryShapesDataset(shapes)) })
        );
        expect(result.violations).toStrictEqual([]);
        assertTrue(result.conforms);
        const census = "PDF report carries a citation census";
        const verified = yield* Effect.exit(verifyLibrary(root));
        assertTrue(!Str.includes(census)(Exit.match(verified, { onFailure: Cause.pretty, onSuccess: () => "" })));
        yield* withCatalog(root, (current) =>
          Effect.succeed(
            LibraryCatalog.make({
              ...current,
              documents: A.map(current.documents, (document) =>
                document.id === report.id ? LibraryDocument.make({ ...document, expectedOccurrences: 1 }) : document
              ),
            })
          )
        );
        const tampered = yield* Effect.exit(verifyLibrary(root));
        expect(Exit.match(tampered, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(
          `${report.id}: ${census}`
        );
      })
  );

  it.effect("rejects a PDF reading whose span is not in the derived text", () =>
    Effect.gen(function* () {
      const { root, repo, fs, path } = yield* fixture;
      const pdf = yield* fakePdfTools();
      const triage = yield* fakeRunner(selectAll);
      yield* mine(mineLibraryTriage(root, options(repo, "codex-luna")), triage.service, pdf.service);
      const runner = yield* fakeRunner(readings("valid time is a ledger"));
      const exit = yield* Effect.exit(
        mine(mineLibraryRead(root, options(repo, "claude")), runner.service, pdf.service)
      );
      strictEqual(exit._tag, "Failure");
      const directory = path.join(root, "ops/mine/t2/receipts");
      const entries = yield* fs.readDirectory(directory, { recursive: true });
      const listed = A.filter(entries, Str.endsWith(".json"));
      const receipts = yield* Effect.forEach(listed, (file) =>
        fs.readFileString(path.join(directory, file)).pipe(Effect.flatMap(S.decodeEffect(ReceiptJson)))
      );
      const paper = O.getOrThrow(A.findFirst(receipts, (receipt) => Str.startsWith("capture-paper-")(receipt.jobKey)));
      expect([paper.outcome, paper.errorTag]).toStrictEqual(["rejected", "LibraryMineSpanError"]);
      const catalog = yield* loadCatalog(root);
      assertTrue(!A.some(catalog.findings, (finding) => finding.captureId === "capture-paper"));
    })
  );
});

const unavailableTools = (pdf: PdfToolsService) =>
  PdfTools.of({
    ...pdf,
    inspect: Effect.fn("TestPdfTools.unavailable")(() =>
      Effect.fail(PdfToolsError.make({ reason: "tool-unavailable", message: "fixture extractor unavailable" }))
    ),
  });

const synthesisOfPaper = Effect.fn("test.synthesisOfPaper")(function* (root: string, repo: string, id: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const catalog = yield* loadCatalog(root);
  const sourceId = O.getOrThrow(A.findFirst(catalog.captures, (capture) => capture.id === "capture-paper")).sourceId;
  const file = path.join(repo, `${id}.json`);
  const text = yield* encodeJson({
    id,
    author: { model: "claude-fable-5-1", effort: "medium", route: "claude-code", argv: ["claude"] },
    findings: [
      {
        sourceId,
        captureId: "capture-paper",
        citoRelation: "citesAsEvidence",
        span: "keep valid time and transaction time apart.",
        summary: "audit",
        topicIds: ["goals/demo-memory"],
      },
    ],
  });
  yield* fs.writeFileString(file, text);
  return file;
});

it.layer(services, { timeout: "30 seconds" })("research library mine PDF provenance", (it) => {
  it.effect("plans a PDF capture of a private source as a private job", () =>
    Effect.gen(function* () {
      const { root, shas } = yield* fixture;
      yield* withCatalog(root, (catalog) =>
        Effect.succeed(
          LibraryCatalog.make({
            ...catalog,
            sources: A.map(catalog.sources, (source) => LibrarySource.make({ ...source, accessClass: "private" })),
          })
        )
      );
      const plan = yield* planLibraryMine(root, "2026-11-06");
      const paper = A.filter(plan, (job) => job.artifact.sha256 === shas.paper);
      expect(A.map(paper, (job) => [job.kind, job.textSource, job.accessClass])).toStrictEqual([
        ["source", "pdf", "private"],
      ]);
    })
  );

  it.effect("synthesize binds a PDF capture only through text a tier run derived", () =>
    Effect.gen(function* () {
      const { root, repo, shas } = yield* fixture;
      const file = yield* synthesisOfPaper(root, repo, "t3-paper");
      const underived = yield* Effect.flip(mineLibrarySynthesize(root, file, O.some(repo), false));
      assertInstanceOf(underived, LibraryMineUnreadError);
      strictEqual(underived.message, "Capture capture-paper is a PDF without derived text; run mine triage first.");
      const pdf = yield* fakePdfTools();
      yield* deriveLibraryMinePdfText(root, shas.paper).pipe(Effect.provideService(PdfTools, pdf.service));
      const imported = yield* mineLibrarySynthesize(root, file, O.some(repo), false);
      expect(imported).toStrictEqual({ findings: 1 });
      const catalog = yield* loadCatalog(root);
      const finding = O.getOrThrow(A.findFirst(catalog.findings, (entry) => entry.modelRunId === "mine:t3:t3-paper"));
      // The span crossed a PDF line break: it resolves to the verbatim slice of the derived text.
      expect([finding.captureId, finding.span, finding.topicIds]).toStrictEqual([
        "capture-paper",
        "keep valid time\nand transaction time apart.",
        ["goals/demo-memory"],
      ]);
    })
  );

  it.effect("synthesize rejects a PDF capture whose derived text is empty", () =>
    Effect.gen(function* () {
      const { root, repo, shas } = yield* fixture;
      const pdf = yield* fakePdfTools();
      const receipt = yield* deriveLibraryMinePdfText(root, shas.paper).pipe(
        Effect.provideService(PdfTools, unavailableTools(pdf.service))
      );
      strictEqual(receipt.outcome, "no-text");
      const file = yield* synthesisOfPaper(root, repo, "t3-scan");
      const error = yield* Effect.flip(mineLibrarySynthesize(root, file, O.some(repo), false));
      assertInstanceOf(error, LibraryMineUnreadError);
      strictEqual(error.message, "Capture capture-paper is a PDF without extractable text.");
    })
  );

  it.effect("refuses PDF bytes and derived text that are missing or differ from their digest", () =>
    Effect.gen(function* () {
      const { root, fs, path, shas } = yield* fixture;
      const pdf = yield* fakePdfTools();
      const object = (sha256: string) => path.join(root, "objects/sha256", sha256);
      const derive = (sha256: string) =>
        deriveLibraryMinePdfText(root, sha256).pipe(Effect.provideService(PdfTools, pdf.service));
      const local = yield* derive(shas.local);
      strictEqual(local.outcome, "text");
      yield* fs.remove(object(local.textSha256));
      yield* fs.writeFileString(object(local.textSha256), "rewritten text");
      const rewritten = yield* Effect.flip(readLibraryMineDerivedTextBody(root, local));
      assertInstanceOf(rewritten, LibraryError);
      strictEqual(rewritten.message, "Derived PDF text differs from its digest.");
      yield* fs.remove(object(shas.paper));
      const missing = yield* Effect.flip(derive(shas.paper));
      strictEqual(missing.message, "Cannot read the PDF to derive its text.");
      yield* fs.remove(object(shas.scan));
      yield* fs.writeFileString(object(shas.scan), "%PDF-1.7 replaced");
      const tampered = yield* Effect.flip(derive(shas.scan));
      strictEqual(tampered.message, "PDF bytes differ from their digest.");
      const inspected = yield* Ref.get(pdf.inspected);
      strictEqual(inspected, 1);
    })
  );
});

it.effect.prop(
  "round-trips schema-derived derived-text records through their JSON codec",
  { derived: LibraryMineDerivedText },
  ({ derived }) =>
    Effect.gen(function* () {
      const record = LibraryMineDerivedText.make(derived);
      const text = yield* S.encodeEffect(DerivedTextJson)(record);
      const back = yield* S.decodeEffect(DerivedTextJson)(text);
      assertTrue(derivedTextEquivalent(back, record));
    }),
  { arbitrary: fcRuns(25) }
);
