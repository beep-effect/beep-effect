/**
 * Private pdf-lib walk that extracts the structural facts a filing validator
 * needs: header version, page sizes, fonts and their embedding, annotations,
 * optional content, encryption, FlateDecode streams (object and
 * cross-reference streams included) a strict inflate rejects; and the
 * annotation objects a reviewer left.
 *
 * @internal
 */

import * as NodeBuffer from "node:buffer";
import * as NodeZlib from "node:zlib";
import { A, O, P } from "@beep/utils";
import { constant, pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObjectParser,
  PDFRawStream,
  PDFRef,
  PDFString,
} from "pdf-lib";
import { PdfToolsError } from "../PdfTools.errors.ts";
import { PageSize, PdfAnnotation, PdfFont, PdfRect, PdfStructure, UndecodableStream } from "../PdfTools.models.ts";
import type { PDFDocument } from "pdf-lib";
import type { StreamCheck } from "../PdfTools.models.ts";

const headerPattern = /^%PDF-(\d\.\d)/;
// One UTF-16 unit per byte, so string offsets are byte offsets.
const latin1 = new TextDecoder("latin1");

const headerVersion = (bytes: Uint8Array): string =>
  pipe(
    O.fromNullishOr(headerPattern.exec(latin1.decode(bytes.subarray(0, 16)))),
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.getOrElse(() => "")
  );

const fontProgramKeys = A.map(["FontFile", "FontFile2", "FontFile3"], (k) => PDFName.of(k));

const resolve = (doc: PDFDocument, value: unknown): unknown =>
  value instanceof PDFRef ? doc.context.lookup(value) : value;

const resolveDict = (doc: PDFDocument, value: unknown): O.Option<PDFDict> => {
  const resolved = resolve(doc, value);
  return resolved instanceof PDFDict ? O.some(resolved) : O.none();
};

const MAX_FONT_GRAPH_NODES = 10_000;
const MAX_FONT_GRAPH_DEPTH = 256;

const isEmbedded = (
  doc: PDFDocument,
  font: PDFDict,
  resolved: MutableHashMap.MutableHashMap<PDFDict, boolean>,
  visiting: MutableHashSet.MutableHashSet<PDFDict>,
  budget: { count: number },
  depth = 0
): boolean => {
  const cached = MutableHashMap.get(resolved, font);
  if (O.isSome(cached)) return cached.value;
  if (MutableHashSet.has(visiting, font)) {
    throw PdfToolsError.make({ reason: "parse", message: "Cyclic PDF descendant-font graph." });
  }
  if (depth > MAX_FONT_GRAPH_DEPTH || ++budget.count > MAX_FONT_GRAPH_NODES) {
    throw PdfToolsError.make({ reason: "parse", message: "PDF descendant-font graph exceeds inspection limits." });
  }
  MutableHashSet.add(visiting, font);
  const resolvedDescendants = resolve(doc, font.get(PDFName.of("DescendantFonts")));
  if (resolvedDescendants instanceof PDFArray) {
    const embedded = pipe(
      resolvedDescendants.asArray(),
      A.some((entry) =>
        pipe(
          resolveDict(doc, entry),
          O.map((d) => isEmbedded(doc, d, resolved, visiting, budget, depth + 1)),
          O.getOrElse(() => false)
        )
      )
    );
    MutableHashSet.remove(visiting, font);
    MutableHashMap.set(resolved, font, embedded);
    return embedded;
  }
  const embedded = pipe(
    resolveDict(doc, font.get(PDFName.of("FontDescriptor"))),
    O.map((descriptor) => A.some(fontProgramKeys, (key) => descriptor.has(key))),
    O.getOrElse(() => false)
  );
  MutableHashSet.remove(visiting, font);
  MutableHashMap.set(resolved, font, embedded);
  return embedded;
};

const fontName = (font: PDFDict): string => {
  const base = font.get(PDFName.of("BaseFont"));
  return base instanceof PDFName ? base.decodeText() : "";
};

const fontOrder = Order.mapInput(Order.String, (font: PdfFont) => font.name);

// No deflate stream inflates to more than 1032 times its own size, so this
// bounds what an inflate produced before it failed, which zlib does not report.
const MAX_DEFLATE_RATIO = 1032;

const flateDecode = PDFName.of("FlateDecode");

// The raw bytes are zlib data only when FlateDecode is the first filter.
const firstFilterIsFlate = (doc: PDFDocument, dict: PDFDict): boolean => {
  const filter = resolve(doc, dict.get(PDFName.of("Filter")));
  return (filter instanceof PDFArray ? resolve(doc, filter.get(0)) : filter) === flateDecode;
};

const declaredLength = (doc: PDFDocument, dict: PDFDict): O.Option<number> => {
  const length = resolve(doc, dict.get(PDFName.of("Length")));
  return length instanceof PDFNumber && Number.isSafeInteger(length.asNumber()) && length.asNumber() >= 0
    ? O.some(length.asNumber())
    : O.none();
};

const streamStart = />>\s*stream(?:\r\n|\n|\r)/;
const endstreamNext = /^\s*endstream/;

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, index) => byte === b[index]);

// Offsets where the data of every definition of `ref` starts, the last
// definition (the one pdf-lib keeps) first.
const dataOffsets = (text: string, ref: PDFRef): ReadonlyArray<number> =>
  pipe(
    A.fromIterable(
      Str.matchAll(new RegExp(`(?<!\\d)${ref.objectNumber}\\s+${ref.generationNumber}\\s+obj`, "g"))(text)
    ),
    A.flatMap((header) => {
      const pattern = new RegExp(streamStart.source, "g");
      pattern.lastIndex = O.getOrElse(constant(0))(O.fromUndefinedOr(header.index)) + header[0].length;
      const keyword = pattern.exec(text);
      return keyword === null ? [] : [keyword.index + keyword[0].length];
    }),
    A.reverse
  );

interface PdfFile {
  readonly bytes: Uint8Array;
  readonly text: () => string;
}

// The stream's data as its declared /Length places it in the file: where
// pdf-lib's bytes start, `length` bytes long, followed by `endstream`.
const dataAtDeclaredLength = (file: PdfFile, ref: PDFRef, parsed: Uint8Array, length: number): O.Option<Uint8Array> => {
  const shared = Math.min(length, parsed.length);
  return A.findFirst(dataOffsets(file.text(), ref), (start) =>
    start + length <= file.bytes.length &&
    sameBytes(file.bytes.subarray(start, start + shared), parsed.subarray(0, shared)) &&
    endstreamNext.test(Str.slice(start + length, start + length + 64)(file.text()))
      ? O.some(file.bytes.subarray(start, start + length))
      : O.none()
  );
};

// pdf-lib ends a stream whose /Length is an indirect object at the first
// `endstream`, minus the EOL before it, so data that itself ends in 0x0D
// loses that byte. When the parsed bytes and the declared length disagree,
// the stream is re-read from the file at its declared length; when no
// definition in the file fits that length, pdf-lib's bytes are judged.
const rawBytesOf = (doc: PDFDocument, file: PdfFile, ref: PDFRef, stream: PDFRawStream): Uint8Array =>
  pipe(
    declaredLength(doc, stream.dict),
    O.filter((length) => length !== stream.contents.length),
    O.flatMap((length) => dataAtDeclaredLength(file, ref, stream.contents, length)),
    O.getOrElse(() => stream.contents)
  );

const containerTypes = A.map(["ObjStm", "XRef"], (type) => PDFName.of(type));
const containerMarkers = ["/ObjStm", "/XRef"];
// PDF object/generation widths are bounded, avoiding suffix retries on long digits.
const objectHeader = /(?<!\d)(\d{1,10})\s+(\d{1,5})\s+obj\b/g;
// How far before its `/Type` an object stream's `N G obj` header may sit.
const HEADER_WINDOW = 64 * 1024;
// Cap candidates before decoding overlapping windows or parsing objects.
// The two marker families share this budget, including markers in stream data.
// Overflow reports partial discovery; structural inspection still succeeds.
const MAX_CONTAINER_CANDIDATES = 128;

// Offsets of every `/ObjStm` and `/XRef` name in the file (`/XRefStm` too,
// which the stream type check below discards).
const markerOffsets = (bytes: Uint8Array) => {
  const buffer = NodeBuffer.Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offsets: Array<number> = [];
  for (const marker of containerMarkers) {
    for (let at = buffer.indexOf(marker); at >= 0; at = buffer.indexOf(marker, at + 1)) {
      if (offsets.length === MAX_CONTAINER_CANDIDATES) {
        return { offsets, check: "limit-reached" as const };
      }
      offsets.push(at);
    }
  }
  return { offsets, check: "complete" as const };
};

// The ref and body offset of the last `N G obj` header before `at`.
const headerBefore = (bytes: Uint8Array, at: number): O.Option<readonly [PDFRef, number]> => {
  const from = Math.max(0, at - HEADER_WINDOW);
  // Keep only the last match: dense fake headers must not allocate an array
  // of every match in each overlapping window.
  let last: O.Option<RegExpMatchArray> = O.none();
  for (const header of Str.matchAll(objectHeader)(latin1.decode(bytes.subarray(from, at)))) {
    last = O.some(header);
  }
  return O.map(last, (header): readonly [PDFRef, number] => [
    PDFRef.of(Number(header[1]), Number(header[2])),
    from + O.getOrElse(constant(0))(O.fromUndefinedOr(header.index)) + header[0].length,
  ]);
};

// pdf-lib decodes object streams and cross-reference streams itself, with a
// decoder that ignores the Adler-32 checksum, and never adds them to the
// document, so they are found in the file: from the header before each
// `/ObjStm` or `/XRef` name, the object is parsed and kept when it is a stream
// of that type.
const containerStreamsOf = (doc: PDFDocument, bytes: Uint8Array) => {
  const discovery = markerOffsets(bytes);
  const streams = pipe(
    discovery.offsets,
    A.flatMap((at) => A.fromOption(headerBefore(bytes, at))),
    A.dedupeWith(([, a], [, b]) => a === b),
    A.flatMap(([ref, body]) =>
      pipe(
        Result.try(() => PDFObjectParser.forBytes(bytes.subarray(body), doc.context).parseObject()),
        Result.getSuccess,
        O.filter(
          (object): object is PDFRawStream =>
            object instanceof PDFRawStream &&
            A.contains(containerTypes, resolve(doc, object.dict.get(PDFName.of("Type"))))
        ),
        O.map((stream) => [ref, stream] as const),
        A.fromOption
      )
    )
  );
  return { streams, check: discovery.check };
};

const objectOrder = Order.mapInput(Order.Number, ([ref]: readonly [PDFRef, PDFRawStream]) => ref.objectNumber);

const isOutputLimit = (cause: unknown): boolean =>
  P.hasProperty(cause, "code") && cause.code === "ERR_BUFFER_TOO_LARGE";

// Bytes the check may still inflate, and whether it ran out.
interface InflateBudget {
  exhausted: boolean;
  remaining: number;
}

// The largest output one inflate may be asked for: the runtime's buffer
// limit. Bun refuses a `maxOutputLength` above it (4 GiB there) with
// ERR_OUT_OF_RANGE, which would read as an undecodable stream.
const MAX_INFLATE_OUTPUT = NodeBuffer.constants.MAX_LENGTH;

// A strict inflate (the default Z_FINISH flush) fails on a stream that is
// cut short anywhere, its Adler-32 checksum included. Every byte zlib
// produces is charged to the budget, a failed inflate's at the most its
// input could have produced; once the budget is spent, or one stream would
// inflate past the runtime's buffer limit, the stream is not judged and the
// check stops.
const inflateFailure = (raw: Uint8Array, budget: InflateBudget): O.Option<string> => {
  if (budget.remaining < 1) {
    budget.exhausted = true;
    return O.none();
  }
  return Result.match(
    Result.try(() => NodeZlib.inflateSync(raw, { maxOutputLength: Math.min(budget.remaining, MAX_INFLATE_OUTPUT) })),
    {
      onSuccess: (inflated) => {
        budget.remaining -= inflated.length;
        return O.none();
      },
      onFailure: (cause) => {
        if (isOutputLimit(cause)) {
          budget.remaining = 0;
          budget.exhausted = true;
          return O.none();
        }
        budget.remaining -= Math.min(budget.remaining, raw.length * MAX_DEFLATE_RATIO);
        return O.some(P.isError(cause) && cause.message.length > 0 ? cause.message : "inflate failed");
      },
    }
  );
};

// Every FlateDecode stream, object and cross-reference streams included,
// whose bytes fail a strict inflate, in object order, until the inflate
// budget runs out. An encrypted file is not checked: its streams are
// ciphertext.
const undecodableStreamsOf = (options: {
  readonly bytes: Uint8Array;
  readonly doc: PDFDocument;
  readonly maxInflatedBytes: number;
}): {
  readonly streams: ReadonlyArray<UndecodableStream>;
  readonly check: StreamCheck;
  readonly discovery: PdfStructure["containerDiscovery"];
} => {
  const { bytes, doc } = options;
  if (doc.isEncrypted) {
    return { streams: [], check: "encrypted", discovery: "encrypted" };
  }
  let text: string | undefined;
  const file: PdfFile = { bytes, text: () => (text ??= latin1.decode(bytes)) };
  const budget: InflateBudget = { remaining: options.maxInflatedBytes, exhausted: false };
  const containers = containerStreamsOf(doc, bytes);
  const streams = pipe(
    A.filter(
      doc.context.enumerateIndirectObjects(),
      (entry): entry is [PDFRef, PDFRawStream] => entry[1] instanceof PDFRawStream
    ),
    A.appendAll(containers.streams),
    A.filter(([, stream]) => firstFilterIsFlate(doc, stream.dict)),
    A.sort(objectOrder),
    A.flatMap(([ref, stream]) =>
      budget.exhausted
        ? []
        : pipe(
            inflateFailure(rawBytesOf(doc, file, ref, stream), budget),
            O.map((reason) =>
              UndecodableStream.make({ objectNumber: ref.objectNumber, generation: ref.generationNumber, reason })
            ),
            A.fromOption
          )
    )
  );
  return { streams, check: budget.exhausted ? "limit-reached" : "complete", discovery: containers.check };
};

/**
 * Extract the structure of a loaded document. `maxInflatedBytes` caps what
 * the undecodable-stream check may inflate; reaching it ends that check
 * early (`streamCheck: "limit-reached"`) and never fails the inspection.
 * `containerDiscovery` independently reports whether raw container discovery
 * completed; both statuses must be complete for an exhaustive stream check.
 *
 * @internal
 */
export const structureOf = (options: {
  readonly bytes: Uint8Array;
  readonly doc: PDFDocument;
  readonly maxInflatedBytes: number;
}): PdfStructure => {
  const { bytes, doc } = options;
  const fonts = MutableHashMap.empty<string, PdfFont>();
  const embedded = MutableHashMap.empty<PDFDict, boolean>();
  const visiting = MutableHashSet.empty<PDFDict>();
  const fontGraphBudget = { count: 0 };
  let annotationCount = 0;
  const pages = A.map(doc.getPages(), (page) => {
    const annots = page.node.Annots();
    annotationCount += annots === undefined ? 0 : annots.size();
    pipe(
      O.fromUndefinedOr(page.node.Resources()),
      O.flatMap((resources) => resolveDict(doc, resources.get(PDFName.of("Font")))),
      O.map((fontDict) => {
        A.forEach(fontDict.entries(), ([, value]) => {
          pipe(
            resolveDict(doc, value),
            O.map((font) => {
              const name = fontName(font);
              const key = value instanceof PDFRef ? value.toString() : name;
              MutableHashMap.set(
                fonts,
                key,
                PdfFont.make({ name, embedded: isEmbedded(doc, font, embedded, visiting, fontGraphBudget) })
              );
            })
          );
        });
      })
    );
    const { width, height } = page.getSize();
    return PageSize.make({ widthPt: width, heightPt: height });
  });
  const { streams, check, discovery } = undecodableStreamsOf(options);
  return PdfStructure.make({
    headerVersion: headerVersion(bytes),
    pages,
    fonts: fonts.pipe(MutableHashMap.values, A.fromIterable, A.sort(fontOrder)),
    annotationCount,
    hasOptionalContent: doc.catalog.has(PDFName.of("OCProperties")),
    encrypted: doc.isEncrypted,
    undecodableStreams: streams,
    streamCheck: check,
    containerDiscovery: discovery,
  });
};

const textOf = (doc: PDFDocument, value: unknown): O.Option<string> => {
  const resolved = resolve(doc, value);
  return resolved instanceof PDFString || resolved instanceof PDFHexString ? O.some(resolved.decodeText()) : O.none();
};

const numbersOf = (doc: PDFDocument, value: unknown): ReadonlyArray<number> => {
  const resolved = resolve(doc, value);
  return resolved instanceof PDFArray
    ? A.map(resolved.asArray(), (entry) => (entry instanceof PDFNumber ? entry.asNumber() : Number.NaN))
    : [];
};

// `/Rect` is [llx lly urx ury] in default user space, bottom-left up; convert
// to points from the crop box's top-left corner, the pdftotext frame.
const rectOf = (
  numbers: ReadonlyArray<number>,
  box: { readonly x: number; readonly y: number; readonly height: number }
): O.Option<PdfRect> => {
  const [x1 = Number.NaN, y1 = Number.NaN, x2 = Number.NaN, y2 = Number.NaN] = numbers;
  if (A.length(numbers) !== 4 || !A.every([x1, y1, x2, y2], Number.isFinite)) {
    return O.none();
  }
  const top = box.y + box.height;
  return PdfRect.makeOption({
    xMin: Math.min(x1, x2) - box.x,
    yMin: top - Math.max(y1, y2),
    xMax: Math.max(x1, x2) - box.x,
    yMax: top - Math.min(y1, y2),
  });
};

/**
 * Every annotation object on every page, in page order; entries without a
 * readable `/Rect` are skipped.
 *
 * @internal
 */
export const annotationsOf = (doc: PDFDocument): ReadonlyArray<PdfAnnotation> =>
  A.flatMap(doc.getPages(), (page, index) => {
    const annots = page.node.Annots();
    const box = page.getCropBox();
    return pipe(
      annots === undefined ? [] : annots.asArray(),
      A.map((entry) =>
        pipe(
          resolveDict(doc, entry),
          O.flatMap((dict) =>
            O.map(rectOf(numbersOf(doc, dict.get(PDFName.of("Rect"))), box), (rect) => {
              const subtype = dict.get(PDFName.of("Subtype"));
              return PdfAnnotation.make({
                page: index + 1,
                subtype: subtype instanceof PDFName ? subtype.decodeText() : "",
                rect,
                contents: textOf(doc, dict.get(PDFName.of("Contents"))),
                author: textOf(doc, dict.get(PDFName.of("T"))),
              });
            })
          )
        )
      ),
      A.getSomes
    );
  });
