/**
 * Derived text for PDF mining units.
 *
 * **Details**
 *
 * A PDF capture artifact or PDF intake file is read through `@beep/pdf-tools` once: every
 * page's text is concatenated into an immutable object at `ops/mine/text/<pdf-sha256>.txt`
 * with a JSON receipt beside it. Reruns reuse the receipt. An extraction failure or a PDF
 * without text (a scan) records a `no-text` receipt instead, and its job is skipped as
 * unreadable.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { PageTextRequest, PdfTools } from "@beep/pdf-tools";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LibraryError } from "./Library.errors.ts";
import { LibraryMineDerivedText } from "./Library.mine.schemas.ts";
import { hashBytes, saveImmutable } from "./Library.store.ts";

const TEXT_ROOT = "ops/mine/text";
const DerivedTextJson = S.fromJsonString(LibraryMineDerivedText);
const mapFailure = (message: string) => Effect.mapError((cause: unknown) => LibraryError.make({ message, cause }));

/**
 * Extractor recorded on every derived-text receipt.
 *
 * **Details**
 *
 * Bump `version` when the derivation changes (page joining, normalization), so receipts
 * written under the old rule stay distinguishable.
 *
 * **Example** (Read the extractor id)
 * ```ts
 * import { LIBRARY_MINE_PDF_EXTRACTOR } from "@beep/repo-cli/test/ResearchLibrary"
 * console.log(LIBRARY_MINE_PDF_EXTRACTOR.driver) // "@beep/pdf-tools/PdfTools.pageText"
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const LIBRARY_MINE_PDF_EXTRACTOR = { driver: "@beep/pdf-tools/PdfTools.pageText", version: "0.0.0" } as const;

const receiptPath = (pdfSha256: string) => `${TEXT_ROOT}/${pdfSha256}.json`;

/**
 * Read the derived-text receipt of a PDF without extracting anything.
 *
 * **Example** (Prepare a lookup)
 * ```ts
 * import { readLibraryMineDerivedText } from "@beep/repo-cli/test/ResearchLibrary"
 * console.log(readLibraryMineDerivedText("/library", "a".repeat(64)).pipe !== undefined)
 * ```
 *
 * @internal
 * @param root - Directory holding the catalog, content-addressed objects and mining operations.
 * @param pdfSha256 - Digest of the PDF bytes.
 * @returns The receipt, if the PDF was already processed.
 * @category use-cases
 * @since 0.0.0
 */
export const readLibraryMineDerivedText = Effect.fn("Library.mine.text.read")(function* (
  root: string,
  pdfSha256: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const location = path.join(root, receiptPath(pdfSha256));
  if (!(yield* fs.exists(location).pipe(mapFailure("Cannot inspect derived-text receipt."))))
    return O.none<LibraryMineDerivedText>();
  return yield* fs
    .readFileString(location)
    .pipe(
      Effect.flatMap(S.decodeEffect(DerivedTextJson)),
      Effect.asSome,
      mapFailure(`Invalid derived-text receipt ${receiptPath(pdfSha256)}.`)
    );
});

const extractPages = Effect.fn("Library.mine.text.extractPages")(function* (pdfPath: string) {
  const tools = yield* PdfTools;
  const structure = yield* tools.inspect(pdfPath);
  const pages = yield* Effect.forEach(
    A.makeBy(structure.pages.length, (index) => index + 1),
    (page) => tools.pageText(PageTextRequest.make({ pdfPath, page }))
  );
  return { pageCount: structure.pages.length, text: A.join(pages, "") };
});

/**
 * Derive the bound text of a PDF once, or reuse the receipt of an earlier derivation.
 *
 * **Details**
 *
 * The PDF is read from the content-addressed object store and its digest checked first.
 * Pages are concatenated in order exactly as the driver returns them (each ends with a
 * form feed). A parse failure, a tool failure or text that is only whitespace yields a
 * `no-text` receipt, which is reused on rerun and skips the job as unreadable.
 *
 * **Example** (Prepare a derivation)
 * ```ts
 * import { deriveLibraryMinePdfText } from "@beep/repo-cli/test/ResearchLibrary"
 * console.log(deriveLibraryMinePdfText("/library", "a".repeat(64)).pipe !== undefined)
 * ```
 *
 * @internal
 * @param root - Directory holding the catalog, content-addressed objects and mining operations.
 * @param pdfSha256 - Digest of the PDF bytes under `objects/sha256`.
 * @returns Immutable provenance for a readable extraction or an unreadable outcome.
 * @category use-cases
 * @since 0.0.0
 */
export const deriveLibraryMinePdfText = Effect.fn("Library.mine.text.derive")(function* (
  root: string,
  pdfSha256: string
) {
  const existing = yield* readLibraryMineDerivedText(root, pdfSha256);
  if (O.isSome(existing)) return existing.value;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const pdfPath = path.join(root, "objects/sha256", pdfSha256);
  const bytes = yield* fs.readFile(pdfPath).pipe(mapFailure("Cannot read the PDF to derive its text."));
  if ((yield* hashBytes(bytes)) !== pdfSha256)
    return yield* LibraryError.make({ message: "PDF bytes differ from their digest.", cause: pdfSha256 });
  const extracted = yield* extractPages(pdfPath).pipe(Effect.result);
  const recordedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
  const base = {
    pdfSha256,
    extractor: LIBRARY_MINE_PDF_EXTRACTOR.driver,
    extractorVersion: LIBRARY_MINE_PDF_EXTRACTOR.version,
    recordedAt,
  };
  const noText = (pageCount: number, message: string) =>
    LibraryMineDerivedText.make({
      ...base,
      outcome: "no-text",
      pageCount,
      textPath: "",
      textSha256: "",
      textBytes: 0,
      message,
    });
  const saveText = (pageCount: number, text: string) =>
    Effect.map(saveImmutable(root, `${TEXT_ROOT}/${pdfSha256}.txt`, new TextEncoder().encode(text)), (saved) =>
      LibraryMineDerivedText.make({
        ...base,
        outcome: "text",
        pageCount,
        textPath: saved.path,
        textSha256: saved.sha256,
        textBytes: saved.bytes,
        message: "",
      })
    );
  const receipt = yield* extracted._tag === "Failure"
    ? Effect.succeed(noText(0, `PDF text extraction failed: ${extracted.failure.message}`))
    : Str.isEmpty(Str.trim(extracted.success.text))
      ? Effect.succeed(noText(extracted.success.pageCount, "The PDF has no extractable text (scanned or image-only)."))
      : saveText(extracted.success.pageCount, extracted.success.text);
  const encoded = yield* S.encodeEffect(DerivedTextJson)(receipt).pipe(
    mapFailure("Cannot encode derived-text receipt.")
  );
  yield* saveImmutable(root, receiptPath(pdfSha256), new TextEncoder().encode(encoded));
  return receipt;
});

/**
 * Read the derived text a `text` receipt points at, checking its digest.
 *
 * **Example** (Prepare a read)
 * ```ts
 * import { readLibraryMineDerivedTextBody } from "@beep/repo-cli/test/ResearchLibrary"
 * console.log(readLibraryMineDerivedTextBody !== undefined)
 * ```
 *
 * @internal
 * @param root - Directory holding the catalog, content-addressed objects and mining operations.
 * @param receipt - Provenance with a successful extraction outcome and a stored content digest.
 * @returns UTF-8 page content after verifying its content-addressed bytes.
 * @category use-cases
 * @since 0.0.0
 */
export const readLibraryMineDerivedTextBody = Effect.fn("Library.mine.text.body")(function* (
  root: string,
  receipt: LibraryMineDerivedText
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bytes = yield* fs
    .readFile(path.join(root, "objects/sha256", receipt.textSha256))
    .pipe(mapFailure("Cannot read derived PDF text."));
  if ((yield* hashBytes(bytes)) !== receipt.textSha256)
    return yield* LibraryError.make({ message: "Derived PDF text differs from its digest.", cause: receipt.textPath });
  return new TextDecoder().decode(bytes);
});
