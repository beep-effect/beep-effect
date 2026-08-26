import { $SemanticaId } from "@beep/identity/packages";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { DateTime, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";

const $I = $SemanticaId.create("scripts/generate-f1-pdfs");
const DEFAULT_OUTPUT_DIRECTORY = "fixtures/f1/documents";

class F1PdfGenerationFailed extends S.TaggedError<F1PdfGenerationFailed>($I`F1PdfGenerationFailed`)(
  "F1PdfGenerationFailed",
  {
    message: S.NonEmptyString,
  },
  $I.annoteError<F1PdfGenerationFailed>("F1PdfGenerationFailed", {
    description: "Typed failure raised when pdf-lib cannot create a deterministic F1 document.",
  })
) {}

const liftPdfPromise = <A>(message: string, evaluate: () => Promise<A>) =>
  Effect.tryPromise({
    try: evaluate,
    catch: () => F1PdfGenerationFailed.make({ message }),
  });

const prepareDocument = Effect.fn("generateF1Pdfs.prepareDocument")(function* (title: string) {
  const fixedEpoch = DateTime.toDateUtc(DateTime.makeUnsafe(946_684_800_000));
  const document = yield* liftPdfPromise("pdf-lib could not create an F1 PDF.", () =>
    PDFDocument.create({ updateMetadata: false })
  );
  document.setTitle(title, { showInWindowTitleBar: false });
  document.setAuthor("Semantica F1 fixture generator");
  document.setSubject("Synthetic academic-paper-like parser fixture");
  document.setCreator("@beep/semantica");
  document.setProducer("pdf-lib 1.17.1 deterministic fixture generator");
  document.setCreationDate(fixedEpoch);
  document.setModificationDate(fixedEpoch);
  return document;
});

const openDocument = Effect.fn("generateF1Pdfs.openDocument")(function* (title: string) {
  const document = yield* prepareDocument(title);
  const regular = yield* liftPdfPromise("pdf-lib could not embed Helvetica.", () =>
    document.embedFont(StandardFonts.Helvetica)
  );
  const bold = yield* liftPdfPromise("pdf-lib could not embed Helvetica Bold.", () =>
    document.embedFont(StandardFonts.HelveticaBold)
  );
  return { document, regular, bold };
});

const newPage = (document: PDFDocument): PDFPage => document.addPage([612, 792]);

const drawLines = (
  page: PDFPage,
  font: PDFFont,
  lines: ReadonlyArray<string>,
  x: number,
  startY: number,
  size = 10,
  leading = 14
): void => {
  let y = startY;
  for (const line of lines) {
    page.drawText(line, { x, y, size, font, color: rgb(0.08, 0.08, 0.08) });
    y -= leading;
  }
};

const saveDocument = (document: PDFDocument) =>
  liftPdfPromise("pdf-lib could not save an F1 PDF.", () =>
    document.save({
      addDefaultPage: false,
      objectsPerTick: 50,
      updateFieldAppearances: false,
      useObjectStreams: false,
    })
  );

const makeTwoColumnPdf = Effect.fn("generateF1Pdfs.makeTwoColumnPdf")(function* () {
  const { document, regular, bold } = yield* openDocument("Two-Column Relation Extraction Study");
  const page = newPage(document);
  page.drawText("Two-Column Relation Extraction Study", { x: 54, y: 742, size: 17, font: bold });
  page.drawText("Abstract", { x: 54, y: 714, size: 12, font: bold });
  drawLines(
    page,
    regular,
    [
      "Arin Wold, affiliated with the fictional",
      "Red Harbor Institute, proposed the",
      "Braided Column Method. The method was",
      "evaluated on the invented Delta Kite Dataset.",
      "",
      "1. Method",
      "The left stream records persons and",
      "organisations before crossing the gutter.",
      "Arin Wold authored the method.",
    ],
    54,
    692
  );
  drawLines(
    page,
    regular,
    [
      "The right stream records datasets and works",
      "without merging lines across columns.",
      "Red Harbor Institute maintains the Delta Kite",
      "Dataset and published the Braided Ledger.",
      "",
      "2. Result",
      "Braided Column Method consumed Delta Kite",
      "Dataset and produced Braided Ledger.",
    ],
    324,
    692
  );
  return yield* saveDocument(document);
});

const makeMultipagePdf = Effect.fn("generateF1Pdfs.makeMultipagePdf")(function* () {
  const { document, regular, bold } = yield* openDocument("Three-Page Provenance Trial");
  const pageBodies = [
    [
      "1. Introduction",
      "Sela Nix, affiliated with the fictional Cloudmere Observatory, proposed",
      "the Long Arc Method for linking weather cells to telescope interruptions.",
      "Oren Pike curated the invented Cloudmere Night Dataset.",
    ],
    [
      "2. Method",
      "The Long Arc Method consumes Cloudmere Night Dataset and preserves each",
      "sentence that links Sela Nix, Cloudmere Observatory, and Oren Pike.",
      "The resulting work is named the Long Arc Interruption Ledger.",
    ],
    [
      "3. Findings",
      "Cloudmere Observatory published the Long Arc Interruption Ledger.",
      "Sela Nix authored the Long Arc Method; Oren Pike maintained the dataset.",
      "1 Footnote: every person and organisation in this fixture is fictional.",
    ],
  ];
  A.forEach(pageBodies, (lines, index) => {
    const page = newPage(document);
    page.drawText("Three-Page Provenance Trial", { x: 54, y: 758, size: 10, font: bold });
    drawLines(page, regular, lines, 54, 708, 11, 18);
    page.drawText(`Synthetic proceedings | page ${index + 1} of 3`, { x: 54, y: 34, size: 8, font: regular });
  });
  return yield* saveDocument(document);
});

const findXrefOffset = (bytes: Uint8Array): number => {
  for (let index = 1; index < bytes.byteLength - 4; index += 1) {
    if (
      bytes[index - 1] === 0x0a &&
      bytes[index] === 0x78 &&
      bytes[index + 1] === 0x72 &&
      bytes[index + 2] === 0x65 &&
      bytes[index + 3] === 0x66 &&
      bytes[index + 4] === 0x0a
    ) {
      return index;
    }
  }
  return -1;
};

/**
 * Writes deterministic two-column, three-page, and pre-xref-truncated PDF fixtures.
 *
 * **Details**
 *
 * Metadata timestamps use a fixed epoch, `PDFDocument.create` disables automatic
 * metadata updates, and object streams are disabled so truncation occurs before
 * an explicit xref table. The truncated specimen reuses the two-column bytes.
 *
 * **Example** (Build a generator effect)
 *
 * ```ts
 * import { generateF1Pdfs } from "../scripts/generate-f1-pdfs"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(generateF1Pdfs("/tmp/f1"))) // true
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const generateF1Pdfs = Effect.fn("generateF1Pdfs")(function* (outputDirectory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(outputDirectory, { recursive: true });
  const twoColumn = yield* makeTwoColumnPdf();
  const multipage = yield* makeMultipagePdf();
  const xrefOffset = findXrefOffset(twoColumn);
  if (xrefOffset < 0) {
    return yield* F1PdfGenerationFailed.make({ message: "The two-column PDF has no explicit xref table." });
  }
  yield* fs.writeFile(path.join(outputDirectory, "pdf-two-column.pdf"), twoColumn);
  yield* fs.writeFile(path.join(outputDirectory, "pdf-multipage.pdf"), multipage);
  yield* fs.writeFile(path.join(outputDirectory, "pdf-truncated.pdf"), twoColumn.subarray(0, xrefOffset));
});

if (import.meta.main) {
  BunRuntime.runMain(
    Effect.scoped(
      Layer.build(BunServices.layer).pipe(
        Effect.flatMap((context) => generateF1Pdfs(DEFAULT_OUTPUT_DIRECTORY).pipe(Effect.provide(context)))
      )
    )
  );
}
