// The archive a workbook is: what the first bytes say the file is, and the passes over its parts with Effect's zip
// reader. This file reads with `effect/encoding/Zip` and internal/writer.ts writes with it; nothing else imports it. The reader goes through local headers in order
// and never reads the central directory, so one path met twice is refused: Excel would open the entry the
// directory names, and a file could otherwise show two readers two workbooks. Caps are counted as bytes are
// inflated, never taken from the sizes a file declares.
import { $XlsxId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as Zip from "effect/encoding/Zip";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { DamagedArchive, DuplicatePart, LimitExceeded, XlsxFatal } from "../XlsxDiagnostic.schema.ts";
import type { XlsxContainer } from "../XlsxDiagnostic.schema.ts";
import type { XlsxLimits } from "../XlsxOptions.schema.ts";

const $I = $XlsxId.create("internal/container");

const cap = (description: string) => S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.annotateKey({ description }));

/** The caps as plain numbers, read once from the options. */
export class Caps extends S.Opaque<Caps, { readonly brand: unique symbol }>()(
  S.Struct({
    cellChars: cap("Most characters in one cell"),
    columns: cap("Most columns a cell may be at"),
    inflatedBytes: cap("Most bytes all parts may inflate to"),
    inputBytes: cap("Most bytes the file itself may have"),
    partBytes: cap("Most bytes one part may inflate to"),
    parts: cap("Most parts in the archive"),
    rows: cap("Most rows read from one sheet"),
    sharedStrings: cap("Most entries in the shared text table"),
    sheets: cap("Most sheets in the workbook"),
  }).pipe($I.annoteSchema("Caps", { description: "The caps of a read as plain numbers" }))
) {}

const bytesOf = (size: ByteSize.ByteSize): number =>
  O.getOrElse(ByteSize.toNumber(size), () => Number.MAX_SAFE_INTEGER);

/** The caps of a read as numbers. */
export const capsOf = (
  limits: Pick<XlsxLimits, keyof typeof Caps.fields extends infer K ? `max${Capitalize<K & string>}` : never>
): Caps =>
  Caps.make({
    inputBytes: bytesOf(limits.maxInputBytes),
    inflatedBytes: bytesOf(limits.maxInflatedBytes),
    partBytes: bytesOf(limits.maxPartBytes),
    parts: limits.maxParts,
    sheets: limits.maxSheets,
    sharedStrings: limits.maxSharedStrings,
    rows: limits.maxRows,
    columns: limits.maxColumns,
    cellChars: limits.maxCellChars,
  });

/** A finding that stops a read, as the failure of an engine step. */
export const stop = (finding: XlsxFatal["finding"]): XlsxFatal => XlsxFatal.make({ finding });

const startsWith = (bytes: Uint8Array, prefix: ReadonlyArray<number>): boolean => {
  for (let i = 0; i < prefix.length; i += 1) if (bytes[i] !== prefix[i]) return false;
  return true;
};

/** A name as an OLE directory writes it: UTF-16LE, which read byte for byte puts a NUL after each letter. */
const wide = (name: string): string => {
  // crispen: one short name, built once per sniff.
  let out = "";
  for (const letter of name) out += `${letter}\u0000`;
  return out;
};

const zipMagic = [0x50, 0x4b, 0x03, 0x04];
const oleMagic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** What a file is, from its first bytes and the names inside. Reads no part. */
export const sniffContainer = (bytes: Uint8Array): XlsxContainer => {
  const zip = startsWith(bytes, zipMagic);
  if (!zip && !startsWith(bytes, oleMagic)) return "notAnArchive";
  // The names inside are searched for in the bytes read as one-byte characters, which the engine does natively.
  const text = new TextDecoder("latin1").decode(bytes);
  const holds = (name: string): boolean => Str.includes(name)(text);
  if (zip) {
    if (holds("xl/workbook.xml")) return holds("vbaProject.bin") ? "macroWorkbook" : "workbook";
    if (holds("xl/workbook.bin")) return "binaryWorkbook";
    if (holds("opendocument.spreadsheet")) return "openDocument";
    if (holds("word/document.xml")) return "word";
    return "otherZip";
  }
  if (holds(wide("EncryptedPackage"))) return "encrypted";
  if (holds(wide("Workbook")) || holds(wide("Book"))) return "legacyXls";
  return "otherOle";
};

const damaged = (error: Zip.ZipError): XlsxFatal =>
  stop(DamagedArchive.make({ damage: error.kind, reason: Str.slice(0, 255)(error.message) }));

const entriesOf = (bytes: Uint8Array) => Stream.make(bytes).pipe(Stream.pipeThroughChannel(Zip.decode()));

/** Chunks of bytes as one array, the reader's inflated parts and the writer's archive alike. */
export const concatBytes = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const out = new Uint8Array(A.reduce(chunks, 0, (n, chunk) => n + chunk.length));
  // crispen: `set` at an offset is the copy; there is no Effect combinator over typed arrays.
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

/**
 * The first pass: every part inflated and counted against the caps, every path checked for a repeat, and the parts
 * `keep` asks for held. A part that is not kept is inflated and let go.
 */
export const census = Effect.fnUntraced(function* (input: {
  readonly bytes: Uint8Array;
  readonly caps: Caps;
  readonly keep: (path: string) => boolean;
}) {
  const { caps, keep } = input;
  // crispen: counters and a held-chunk list per part, updated as each inflated chunk arrives; the caps must be
  // checked chunk by chunk, so the state cannot be folded after the stream ends.
  const paths: Array<string> = [];
  const seen = MutableHashSet.empty<string>();
  const kept = MutableHashMap.empty<string, Uint8Array>();
  let inflated = 0;
  yield* entriesOf(input.bytes).pipe(
    Stream.mapError(damaged),
    Stream.mapEffect((entry) => {
      const path = entry.header.path;
      if (entry.header.type === "Directory") return Effect.void;
      if (MutableHashSet.has(seen, path))
        return Effect.fail(stop(DuplicatePart.make({ path: Str.slice(0, 1024)(path) })));
      MutableHashSet.add(seen, path);
      paths.push(path);
      if (paths.length > caps.parts) return Effect.fail(stop(LimitExceeded.make({ limit: "parts", path: "" })));
      const held: Array<Uint8Array> = [];
      const wanted = keep(path);
      let size = 0;
      return entry.body.pipe(
        Stream.mapError(damaged),
        Stream.mapEffect((chunk) => {
          size += chunk.length;
          inflated += chunk.length;
          if (size > caps.partBytes) {
            return Effect.fail(stop(LimitExceeded.make({ limit: "partBytes", path: Str.slice(0, 1024)(path) })));
          }
          if (inflated > caps.inflatedBytes) {
            return Effect.fail(stop(LimitExceeded.make({ limit: "inflatedBytes", path: Str.slice(0, 1024)(path) })));
          }
          if (wanted) held.push(chunk);
          return Effect.void;
        }),
        Stream.runDrain,
        Effect.map(() => {
          if (wanted) MutableHashMap.set(kept, path, concatBytes(held));
        })
      );
    }),
    Stream.runDrain
  );
  return { paths, kept };
});

/** A later pass: the named parts held, every other part skipped. The census has already counted them all. */
export const collect = Effect.fnUntraced(function* (input: {
  readonly bytes: Uint8Array;
  readonly wanted: (path: string) => boolean;
}) {
  const kept = MutableHashMap.empty<string, Uint8Array>();
  yield* entriesOf(input.bytes).pipe(
    Stream.mapError(damaged),
    Stream.mapEffect((entry) => {
      const path = entry.header.path;
      if (entry.header.type === "Directory" || !input.wanted(path)) return Effect.void;
      return entry.body.pipe(
        Stream.mapError(damaged),
        Stream.runCollect,
        Effect.map((chunks) => {
          MutableHashMap.set(kept, path, concatBytes(chunks));
        })
      );
    }),
    Stream.runDrain
  );
  return kept;
});

/**
 * The parts `wanted` asks for, each as its path and the stream of its inflated bytes, in the order the archive holds
 * them. A body must be read before the next part is pulled, which `Stream.flatMap` and `Stream.mapEffect` do.
 */
export const bodiesOf: {
  (wanted: (path: string) => boolean): (bytes: Uint8Array) => Stream.Stream<Body, XlsxFatal>;
  (bytes: Uint8Array, wanted: (path: string) => boolean): Stream.Stream<Body, XlsxFatal>;
} = dual(
  2,
  (bytes: Uint8Array, wanted: (path: string) => boolean): Stream.Stream<Body, XlsxFatal> =>
    entriesOf(bytes).pipe(
      Stream.mapError(damaged),
      Stream.filter((entry) => entry.header.type === "File" && wanted(entry.header.path)),
      Stream.map((entry) => ({ path: entry.header.path, body: Stream.mapError(entry.body, damaged) }))
    )
);

/** One part's path and the stream of its inflated bytes. */
interface Body {
  readonly body: Stream.Stream<Uint8Array, XlsxFatal>;
  readonly path: string;
}
