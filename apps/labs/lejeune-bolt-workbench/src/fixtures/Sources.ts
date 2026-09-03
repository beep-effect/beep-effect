/**
 * Deterministic synthetic Office fixture generation and fixed-layout parsing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DOC_TEXT_ENGINE_VERSION, DocTextFileProcessingEngine } from "@beep/doc-text";
import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { ExtractFileOperation } from "@beep/file-processing/Operation";
import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { NonNegativeInt, PosixPath, Sha256HexFromBytes } from "@beep/schema";
import { decodeXmlTextAs } from "@beep/schema/Xml";
import { DateTime, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { PROVIDER_RECORDING_SOURCE_TEXT, SourceDocument } from "@/domain/Bundle";
import { EntityId } from "@/domain/Ontology";
import type { Sha256Hex } from "@beep/schema";

const $I = $LejeuneBoltWorkbenchId.create("fixtures/Sources");

/**
 * Exact synthetic RFQ A text used by fixture generation and provider-recording verification.
 *
 * **Example** (Confirm the synthetic marker)
 *
 * ```ts
 * import { RFQ_A_OUTLOOK_BODY } from "@/fixtures/Sources"
 * import * as Str from "effect/String"
 *
 * console.log(Str.startsWith("SYNTHETIC RFQ A")(RFQ_A_OUTLOOK_BODY)) // true
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const RFQ_A_OUTLOOK_BODY = PROVIDER_RECORDING_SOURCE_TEXT;
const PROSE_EMAIL = `SYNTHETIC RFQ B for County Shops Expansion. Delivery is 2026-09-20 and certification is required. Do not infer coating approval.`;
const XLSX_ROW_TEXT = "A-1 | TC assembly | F1852 Type 1 | 7/8 in | 3-1/4 in | 180 | F959 Type 325";
const PDF_SCHEDULE_TEXT =
  "Line B-1 | Product heavy hex bolt only | Grade A490 Type 1 | Diameter 3/4 in | Length 2-1/2 in | Quantity 860 | Finish HDG | DTI F959 Type 325";
const FIXED_PDF_DATE = DateTime.toDateUtc(DateTime.makeUnsafe("2026-08-27T00:00:00.000Z"));
// fflate writes ZIP dates through local Date fields. A zone-less value preserves the frozen archive bytes in every TZ.
const FIXED_XLSX_MTIME = "2026-08-26T19:00:00";

const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>Line</t></is></c><c r="B1" t="inlineStr"><is><t>Product</t></is></c><c r="C1" t="inlineStr"><is><t>Grade</t></is></c><c r="D1" t="inlineStr"><is><t>Diameter</t></is></c><c r="E1" t="inlineStr"><is><t>Length</t></is></c><c r="F1" t="inlineStr"><is><t>Quantity</t></is></c><c r="G1" t="inlineStr"><is><t>DTI</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>A-1</t></is></c><c r="B2" t="inlineStr"><is><t>TC assembly</t></is></c><c r="C2" t="inlineStr"><is><t>F1852 Type 1</t></is></c><c r="D2" t="inlineStr"><is><t>7/8 in</t></is></c><c r="E2" t="inlineStr"><is><t>3-1/4 in</t></is></c><c r="F2" t="inlineStr"><is><t>180</t></is></c><c r="G2" t="inlineStr"><is><t>F959 Type 325</t></is></c></row>
</sheetData></worksheet>`;

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
const rootRelationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Takeoff" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const workbookRelationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

class XlsxInlineString extends S.Class<XlsxInlineString>($I`XlsxInlineString`)({ t: S.String }) {}
class XlsxCell extends S.Class<XlsxCell>($I`XlsxCell`)({
  is: XlsxInlineString,
  r: S.String,
  t: S.Literal("inlineStr"),
}) {}
class XlsxRow extends S.Class<XlsxRow>($I`XlsxRow`)({ c: S.NonEmptyArray(XlsxCell), r: S.String }) {}
class XlsxSheetData extends S.Class<XlsxSheetData>($I`XlsxSheetData`)({ row: S.NonEmptyArray(XlsxRow) }) {}
class XlsxWorksheet extends S.Class<XlsxWorksheet>($I`XlsxWorksheet`)({ sheetData: XlsxSheetData }) {}
class XlsxDocument extends S.Class<XlsxDocument>($I`XlsxDocument`)({ worksheet: XlsxWorksheet }) {}

const decodeWorksheetXml = decodeXmlTextAs(XlsxDocument);

/**
 * Typed fixture generation or parsing failure.
 *
 * **Example** (Create a parsing failure)
 *
 * ```ts
 * import { FixtureError } from "@/fixtures/Sources"
 *
 * console.log(FixtureError.make({ stage: "xlsx-parse", message: "missing sheet" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FixtureError extends S.TaggedError<FixtureError>($I`FixtureError`)(
  "FixtureError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })),
    message: S.NonEmptyString,
    stage: S.NonEmptyString,
  },
  $I.annoteError<FixtureError>("FixtureError", {
    title: "LeJeune fixture error",
    description: "A typed failure while generating or parsing one fixed synthetic Office fixture.",
  })
) {}

/**
 * Generated source bytes plus the parsed source documents they deterministically produce.
 *
 * **Example** (Inspect the XLSX byte field)
 *
 * ```ts
 * import { GeneratedFixtureArtifacts } from "@/fixtures/Sources"
 *
 * console.log(GeneratedFixtureArtifacts.fields.rfqAXlsx !== undefined) // true
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export class GeneratedFixtureArtifacts extends S.Class<GeneratedFixtureArtifacts>($I`GeneratedFixtureArtifacts`)(
  {
    rfqAEmail: S.Uint8Array,
    rfqAXlsx: S.Uint8Array,
    rfqBEmail: S.Uint8Array,
    rfqBPdf: S.Uint8Array,
    sources: S.NonEmptyArray(SourceDocument),
  },
  $I.annote("GeneratedFixtureArtifacts", {
    description: "Deterministic synthetic Office bytes and their four parsed exact-text source records.",
  })
) {}

const fixtureError = (stage: string, message: string): FixtureError => FixtureError.make({ message, stage });

const fixtureErrorWithCause = (stage: string, message: string, cause: unknown): FixtureError =>
  FixtureError.make({ cause, message, stage });

const makeXlsxBytes = Effect.fn("LeJeuneFixtures.makeXlsxBytes")(() =>
  Effect.try({
    try: () =>
      zipSync(
        {
          "[Content_Types].xml": strToU8(contentTypesXml),
          "_rels/.rels": strToU8(rootRelationshipsXml),
          "xl/_rels/workbook.xml.rels": strToU8(workbookRelationshipsXml),
          "xl/workbook.xml": strToU8(workbookXml),
          "xl/worksheets/sheet1.xml": strToU8(worksheetXml),
        },
        { level: 9, mtime: FIXED_XLSX_MTIME }
      ),
    catch: (cause) =>
      fixtureErrorWithCause("xlsx-generate", "Failed to generate the deterministic synthetic XLSX fixture.", cause),
  })
);

const makePdfBytes = Effect.fn("LeJeuneFixtures.makePdfBytes")(function* () {
  return yield* Effect.tryPromise({
    try: () =>
      PDFDocument.create().then((document) => {
        document.setAuthor("beep synthetic fixture generator");
        document.setCreationDate(FIXED_PDF_DATE);
        document.setCreator("@beep/lejeune-bolt-workbench");
        document.setModificationDate(FIXED_PDF_DATE);
        document.setProducer("@beep/lejeune-bolt-workbench");
        document.setSubject("SYNTHETIC RFQ B schedule");
        document.setTitle("SYNTHETIC RFQ B schedule");
        return document.embedFont(StandardFonts.Helvetica).then((font) => {
          const page = document.addPage([1_200, 300]);
          page.drawText(PDF_SCHEDULE_TEXT, { font, size: 11, x: 24, y: 220 });
          return document.save({ addDefaultPage: false, useObjectStreams: false });
        });
      }),
    catch: (cause) =>
      fixtureErrorWithCause("pdf-generate", "Failed to generate the deterministic synthetic PDF fixture.", cause),
  });
});

const parseXlsx = Effect.fn("LeJeuneFixtures.parseXlsx")(function* (bytes: Uint8Array) {
  const files = yield* Effect.try({
    try: () => unzipSync(bytes),
    catch: (cause) => fixtureErrorWithCause("xlsx-unzip", "Failed to open the synthetic XLSX fixture.", cause),
  });
  const sheetBytes = O.fromUndefinedOr(files["xl/worksheets/sheet1.xml"]);
  const sheet = yield* sheetBytes.pipe(
    Effect.fromOption(() => fixtureError("xlsx-parse", "Synthetic XLSX fixture is missing sheet1.xml.")),
    Effect.flatMap((value) =>
      Effect.try({
        try: () => strFromU8(value),
        catch: (cause) => fixtureErrorWithCause("xlsx-parse", "Synthetic XLSX worksheet is not valid UTF-8.", cause),
      }).pipe(
        Effect.flatMap(decodeWorksheetXml),
        Effect.mapError((cause) =>
          fixtureErrorWithCause("xlsx-parse", "Synthetic XLSX worksheet did not match the fixed layout.", cause)
        )
      )
    )
  );
  const dataRow = yield* A.get(sheet.worksheet.sheetData.row, 1).pipe(
    Effect.fromOption(() => fixtureError("xlsx-parse", "Synthetic XLSX fixture is missing its data row."))
  );
  const values = A.map(dataRow.c, (cell) => cell.is.t);
  const parsed = A.join(values, " | ");
  return Str.Equivalence(parsed, XLSX_ROW_TEXT)
    ? parsed
    : yield* fixtureError("xlsx-parse", "Synthetic XLSX data row changed from the frozen layout.");
});

const makePdfOperation = (id: string, digest: Sha256Hex, bytes: Uint8Array): ExtractFileOperation => {
  const relativePath = PosixPath.make(`${id}.pdf`);
  return ExtractFileOperation.make({
    format: "pdf-text-layer",
    operationId: OperationId.make(`operation:${digest}`),
    operationKind: "extract",
    preference: { engine: "tika" },
    source: SourceArtifact.make({
      bytes,
      digest: ContentDigest.make(`sha256:${digest}`),
      extension: "pdf",
      id: ArtifactId.make(`artifact:${digest}`),
      locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
      name: `${id}.pdf`,
      relativePath,
      sizeBytes: NonNegativeInt.make(bytes.byteLength),
    }),
  });
};

const parsePdf = Effect.fn("LeJeuneFixtures.parsePdf")(function* (id: string, digest: Sha256Hex, bytes: Uint8Array) {
  const result = yield* DocTextFileProcessingEngine.extract(makePdfOperation(id, digest, bytes)).pipe(
    Effect.mapError((cause) =>
      fixtureErrorWithCause("pdf-parse", "The synthetic PDF text layer could not be extracted.", cause)
    )
  );
  const text = O.fromUndefinedOr(result.text);
  return yield* O.match(text, {
    onNone: () => Effect.fail(fixtureError("pdf-parse", "The synthetic PDF fixture has no text layer.")),
    onSome: (value) =>
      Str.includes(PDF_SCHEDULE_TEXT)(value)
        ? Effect.succeed(PDF_SCHEDULE_TEXT)
        : Effect.fail(fixtureError("pdf-parse", "The synthetic PDF text layer changed from the frozen layout.")),
  });
});

const hashBytes = (bytes: Uint8Array) =>
  Sha256HexFromBytes.decodeEffect(bytes).pipe(
    Effect.mapError((cause) => fixtureErrorWithCause("sha256", "Failed to hash synthetic fixture bytes.", cause))
  );

/**
 * Generate both Office fixture pairs, parse the XLSX and PDF, and freeze source hashes.
 *
 * **Details**
 *
 * The XLSX and PDF binaries exist only in memory or in the caller-selected machine-local
 * bundle directory. The repository stores their deterministic generators, never binary payloads.
 *
 * **Example** (Build deterministic artifacts)
 *
 * ```ts
 * import { buildFixtureArtifacts } from "@/fixtures/Sources"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(buildFixtureArtifacts)) // true
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const buildFixtureArtifacts = Effect.gen(function* () {
  const rfqAEmail = strToU8(RFQ_A_OUTLOOK_BODY);
  const rfqAXlsx = yield* makeXlsxBytes();
  const rfqBEmail = strToU8(PROSE_EMAIL);
  const rfqBPdf = yield* makePdfBytes();
  const [rfqAEmailHash, rfqAXlsxHash, rfqBEmailHash, rfqBPdfHash] = yield* Effect.all(
    [hashBytes(rfqAEmail), hashBytes(rfqAXlsx), hashBytes(rfqBEmail), hashBytes(rfqBPdf)],
    { concurrency: 4 }
  );
  const xlsxText = yield* parseXlsx(rfqAXlsx);
  const pdfText = yield* parsePdf("rfq-b-schedule", rfqBPdfHash, rfqBPdf);
  const sources = [
    SourceDocument.make({
      format: "outlook-body-table",
      id: EntityId.make("rfq-a-outlook-body"),
      layoutId: "rfq-a",
      mediaType: "text/plain",
      sha256: rfqAEmailHash,
      text: RFQ_A_OUTLOOK_BODY,
    }),
    SourceDocument.make({
      format: "xlsx-takeoff",
      id: EntityId.make("rfq-a-xlsx-takeoff"),
      layoutId: "rfq-a",
      mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sha256: rfqAXlsxHash,
      text: xlsxText,
    }),
    SourceDocument.make({
      format: "prose-email",
      id: EntityId.make("rfq-b-prose-email"),
      layoutId: "rfq-b",
      mediaType: "text/plain",
      sha256: rfqBEmailHash,
      text: PROSE_EMAIL,
    }),
    SourceDocument.make({
      format: "pdf-text-layer",
      id: EntityId.make("rfq-b-pdf-schedule"),
      layoutId: "rfq-b",
      mediaType: "application/pdf",
      sha256: rfqBPdfHash,
      text: pdfText,
    }),
  ] as const;
  yield* Effect.logInfo("Built deterministic synthetic Office fixture pairs.").pipe(
    Effect.annotateLogs({
      "lejeune.fixture_count": A.length(sources),
      "lejeune.pdf_parser_version": DOC_TEXT_ENGINE_VERSION,
    })
  );
  return GeneratedFixtureArtifacts.make({ rfqAEmail, rfqAXlsx, rfqBEmail, rfqBPdf, sources });
}).pipe(Effect.withSpan("lejeune.fixtures.build"));
