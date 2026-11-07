import { PageSize, PdfStructure, PdfTools, PdfToolsError } from "@beep/pdf-tools";
import {
  hashBytes,
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryDocument,
  LibraryIntake,
  LibraryIntakeFile,
  LibraryIntakeRoot,
  LibraryMineDerivedText,
  LibraryMineOptions,
  LibraryMineReceipt,
  LibraryMineRunner,
  LibraryOccurrence,
  LibraryReadingRecord,
  LibrarySource,
  LibraryTriageRecord,
  loadCatalog,
  mineLibraryRead,
  mineLibraryTriage,
  saveImmutable,
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
} from "@beep/repo-cli/test/ResearchLibrary";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PDFDocument } from "pdf-lib";
import type { LibraryMineRunRequest } from "@beep/repo-cli/commands/Research";

const UnknownJson = S.fromJsonString(S.Unknown);
const PageTextsJson = S.String.pipe(S.Array, S.fromJsonString);
const DerivedTextJson = S.fromJsonString(LibraryMineDerivedText);
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

const services = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, ShaclValidationServiceLive);

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
        expect(
          A.map(findings, (finding) => [finding.sourceId, finding.captureId, finding.documentId, finding.span])
        ).toStrictEqual([
          // The span crossed a PDF line break: it resolves to the verbatim slice of the derived text.
          ["paper", "capture-paper", "", "keep valid time\nand transaction time apart."],
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
