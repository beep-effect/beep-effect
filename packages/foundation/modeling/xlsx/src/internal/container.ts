// The archive a workbook is: what the first bytes say the file is, and the passes over its parts with Effect's zip
// reader. This file reads with `effect/encoding/Zip` and internal/writer.ts writes with it; nothing else imports it.
// That reader goes through the local entries in order and never reads the central directory, which is what Excel
// opens a file by, so a file could show the two readers two workbooks. Two checks close that: one part name met twice
// is refused (`DuplicatePart`), part names compared as OPC compares them, without regard to ASCII case; and when the
// file ends with a directory, that directory must name exactly the entries the walk read, each where the one before
// it ends, from the first byte to the directory itself (`DirectoryMismatch`). An archive updated by appending, an
// entry the directory leaves out and a directory that names an entry the walk never reached are all refused by the
// second. Caps are counted as bytes are inflated, never taken from the sizes a file declares.
import { $XlsxId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as Zip from "effect/encoding/Zip";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  DamagedArchive,
  DirectoryMismatch,
  DuplicatePart,
  LimitExceeded,
  XlsxFatal,
} from "../XlsxDiagnostic.schema.ts";
import type { XlsxContainer } from "../XlsxDiagnostic.schema.ts";
import type { XlsxLimits } from "../XlsxOptions.schema.ts";

const $I = $XlsxId.create("internal/container");

const cap = (description: string) => S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.annotateKey({ description }));

/** The caps as plain numbers, read once from the options. */
export class Caps extends S.Opaque<Caps, { readonly brand: unique symbol }>()(
  S.Struct({
    cellChars: cap("Most characters in one cell"),
    columns: cap("Most columns a cell may be at"),
    hiddenColumns: cap("Most hidden columns kept over the read"),
    hiddenSpans: cap("Most hidden column spans kept over the read"),
    inflatedBytes: cap("Most bytes all parts may inflate to"),
    inputBytes: cap("Most bytes the file itself may have"),
    merges: cap("Most merged ranges kept over the read"),
    partBytes: cap("Most bytes one part may inflate to"),
    parts: cap("Most parts in the archive"),
    rows: cap("Most rows read from one sheet"),
    sharedFormulaChars: cap("Most characters of formula text handed to cells sharing a formula"),
    sharedFormulas: cap("Most shared formulas kept over the read"),
    sharedStrings: cap("Most entries in the shared text table"),
    sheets: cap("Most sheets in the workbook"),
    warnings: cap("Most warnings kept over the read"),
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
    sharedFormulaChars: limits.maxSharedFormulaChars,
    warnings: limits.maxWarnings,
    merges: limits.maxMerges,
    hiddenSpans: limits.maxHiddenSpans,
    hiddenColumns: limits.maxHiddenColumns,
    sharedFormulas: limits.maxSharedFormulas,
  });

/**
 * A part name as OPC compares it: without regard to ASCII case (ECMA-376 part 2, 9.1.1.1). Every lookup of a part by
 * its name goes through this key; findings keep the name as the archive or the relationship writes it.
 */
export const partKey = (path: string): string => {
  // crispen: read for every entry and every lookup; only `A` to `Z` fold, as OPC folds them, which no Effect string
  // helper does without folding the rest of Unicode too.
  let key = "";
  for (const letter of path) key += letter >= "A" && letter <= "Z" ? Str.toLowerCase(letter) : letter;
  return key;
};

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

/**
 * What a file is, from its first bytes and the names inside. Reads no part. Names are looked for as OPC compares
 * them, without regard to ASCII case: each name by its `partKey`, in the bytes read as one-byte characters (which
 * the engine does natively) and lower-cased in one native pass. That pass folds the Latin-1 capitals too, which a
 * name of ASCII letters never matches, so the result is the one `partKey` folding would give.
 */
export const sniffContainer = (bytes: Uint8Array): XlsxContainer => {
  const zip = startsWith(bytes, zipMagic);
  if (!zip && !startsWith(bytes, oleMagic)) return "notAnArchive";
  const text = Str.toLowerCase(new TextDecoder("latin1").decode(bytes));
  const holds = (name: string): boolean => Str.includes(partKey(name))(text);
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

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const END64 = 0x06064b50;
const LOCATOR64 = 0x07064b50;
const MAX16 = 0xffff;
const MAX32 = 0xffffffff;
const FLAG_DESCRIPTOR = 0x0008;
/** The lengths a data descriptor may have: with or without its signature, with 32-bit or 64-bit sizes. */
const descriptorLengths = [12, 16, 20, 24];

/** One entry as the central directory names it. */
interface Listed {
  readonly compressed: number;
  readonly descriptor: boolean;
  readonly offset: number;
}

const byOffset = Order.mapInput(Order.Number, (entry: Listed) => entry.offset);

/** Where an end record says its directory is: how many entries, how many bytes, from which byte, ending where. */
interface Located {
  readonly count: number;
  readonly directoryEnd: number;
  readonly size: number;
  readonly start: number;
}

/**
 * Where the central directory of a file and the entries it holds from its first byte part ways, none when they
 * agree or when the file does not end with a directory (a file cut short inside it, whose every entry the walk has
 * checked). The directory is found as Excel finds it, from the last end record whose fields name a directory that
 * ends at it (an end record inside an archive comment is passed over), and must be the sequence of entries the walk
 * reads: the first at byte 0, each where the one before it ends, the last ending where the directory starts.
 */
// crispen: a walk over little-endian records at byte offsets, each step a bounds check that may end it. Every offset
// and count here comes from the file, so each read is bounded on both ends (-1 outside the file) and each count is
// checked against the bytes left before it is used.
export const directoryMismatch = (bytes: Uint8Array): O.Option<string> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = bytes.length;
  const inside = (at: number, width: number): boolean => Number.isSafeInteger(at) && at >= 0 && at + width <= length;
  const u16 = (at: number): number => (inside(at, 2) ? view.getUint16(at, true) : -1);
  const u32 = (at: number): number => (inside(at, 4) ? view.getUint32(at, true) : -1);
  const u64 = (at: number): number => (inside(at, 8) ? Number(view.getBigUint64(at, true)) : -1);

  /** What the end record at `end` names, or why it names no directory; constant work, so every candidate is tried. */
  const locate = (end: number): Result.Result<Located, string> => {
    const marked = u16(end + 10) === MAX16 || u32(end + 12) === MAX32 || u32(end + 16) === MAX32;
    // The 64-bit record is taken whenever its locator precedes the end record, whatever the 32-bit fields hold.
    const record = u32(end - 20) === LOCATOR64 ? u64(end - 12) : -1;
    const zip64 = record >= 0 && record + 56 <= end - 20 && u32(record) === END64;
    if (marked && !zip64) return Result.fail("the end record names a 64-bit record that is not there");
    const located = zip64
      ? { count: u64(record + 32), size: u64(record + 40), start: u64(record + 48), directoryEnd: record }
      : { count: u16(end + 10), size: u32(end + 12), start: u32(end + 16), directoryEnd: end };
    const { count, size, start, directoryEnd } = located;
    if (count < 0 || size < 0 || start < 0 || start + size !== directoryEnd) {
      return Result.fail(
        `the directory at byte ${start} of ${size} bytes does not reach its end record at ${directoryEnd}`
      );
    }
    if (count * 46 > size) return Result.fail(`the directory is too short for the ${count} entries it counts`);
    return Result.succeed(located);
  };

  /** The entries a located directory lists, checked against the walk from byte 0. */
  const walk = ({ count, directoryEnd, start }: Located): O.Option<string> => {
    const listed: Array<Listed> = [];
    let at = start;
    for (let n = 0; n < count; n += 1) {
      if (u32(at) !== CENTRAL) return O.some(`the directory's entry ${n + 1} is not where it should be`);
      const names = u16(at + 28);
      const extras = u16(at + 30);
      const recordEnd = at + 46 + names + extras + u16(at + 32);
      if (names < 0 || extras < 0 || recordEnd < at + 46 || recordEnd > directoryEnd) {
        return O.some(`the directory's entry ${n + 1} runs past the directory`);
      }
      let compressed = u32(at + 20);
      let offset = u32(at + 42);
      if (compressed === MAX32 || offset === MAX32) {
        // The 64-bit extra field holds, in order, each of the sizes and the offset that its 32-bit field leaves out.
        let field = at + 46 + names;
        const fieldsEnd = field + extras;
        while (field + 4 <= fieldsEnd) {
          const id = u16(field);
          const spanEnd = field + 4 + u16(field + 2);
          const within = (value: number): number => (value + 8 <= spanEnd && spanEnd <= fieldsEnd ? u64(value) : -1);
          if (id === 0x0001) {
            let value = field + 4;
            if (u32(at + 24) === MAX32) value += 8;
            if (compressed === MAX32) {
              compressed = within(value);
              value += 8;
            }
            if (offset === MAX32) offset = within(value);
          }
          field = spanEnd;
        }
      }
      if (compressed < 0 || offset < 0) return O.some(`the directory's entry ${n + 1} has no 64-bit size or offset`);
      listed.push({ compressed, descriptor: (u16(at + 8) & FLAG_DESCRIPTOR) !== 0, offset });
      at = recordEnd;
    }
    if (at !== directoryEnd) return O.some(`the directory's ${count} entries do not fill it`);
    const sorted = A.sort(listed, byOffset);
    let expected = 0;
    for (const [n, entry] of sorted.entries()) {
      if (entry.offset !== expected || u32(entry.offset) !== LOCAL) {
        return O.some(`the directory names an entry at byte ${entry.offset}, where the walk reached ${expected}`);
      }
      const dataEnd = entry.offset + 30 + u16(entry.offset + 26) + u16(entry.offset + 28) + entry.compressed;
      const next = O.match(A.get(sorted, n + 1), { onNone: () => start, onSome: (after) => after.offset });
      // A descriptor's length is not recorded anywhere: it is the one that lands on the next entry or the directory.
      expected = entry.descriptor && A.some(descriptorLengths, (extra) => dataEnd + extra === next) ? next : dataEnd;
    }
    return expected === start
      ? O.none()
      : O.some(`the directory starts at byte ${start}, where the entries it names end at ${expected}`);
  };

  let refused: O.Option<string> = O.none();
  for (let at = length - 22; at >= Math.max(0, length - 22 - MAX16); at -= 1) {
    if (u32(at) === END && at + 22 + u16(at + 20) <= length) {
      const located = locate(at);
      if (Result.isSuccess(located)) return walk(located.success);
      if (O.isNone(refused)) refused = O.some(located.failure);
    }
  }
  return refused;
};

/**
 * The first pass: every part inflated and counted against the caps, every path checked for a repeat, the parts
 * `keep` asks for held (by their `partKey`), and the directory checked against what the pass read. A part that is
 * not kept is inflated and let go.
 */
export const census = Effect.fnUntraced(function* (input: {
  readonly bytes: Uint8Array;
  readonly caps: Caps;
  readonly keep: (key: string) => boolean;
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
      const key = partKey(path);
      if (MutableHashSet.has(seen, key))
        return Effect.fail(stop(DuplicatePart.make({ path: Str.slice(0, 1024)(path) })));
      MutableHashSet.add(seen, key);
      paths.push(path);
      if (paths.length > caps.parts) return Effect.fail(stop(LimitExceeded.make({ limit: "parts", path: "" })));
      const held: Array<Uint8Array> = [];
      const wanted = keep(key);
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
          if (wanted) MutableHashMap.set(kept, key, concatBytes(held));
        })
      );
    }),
    Stream.runDrain
  );
  const mismatch = directoryMismatch(input.bytes);
  if (O.isSome(mismatch)) {
    return yield* Effect.fail(stop(DirectoryMismatch.make({ reason: Str.slice(0, 255)(mismatch.value) })));
  }
  return { paths, kept };
});

/** A later pass: the parts `wanted` asks for by their `partKey` held under it, every other part skipped. The census
 * has already counted them all. */
export const collect = Effect.fnUntraced(function* (input: {
  readonly bytes: Uint8Array;
  readonly wanted: (key: string) => boolean;
}) {
  const kept = MutableHashMap.empty<string, Uint8Array>();
  yield* entriesOf(input.bytes).pipe(
    Stream.mapError(damaged),
    Stream.mapEffect((entry) => {
      const key = partKey(entry.header.path);
      if (entry.header.type === "Directory" || !input.wanted(key)) return Effect.void;
      return entry.body.pipe(
        Stream.mapError(damaged),
        Stream.runCollect,
        Effect.map((chunks) => {
          MutableHashMap.set(kept, key, concatBytes(chunks));
        })
      );
    }),
    Stream.runDrain
  );
  return kept;
});

/**
 * The parts `wanted` asks for by their `partKey`, each as its path, its key and the stream of its inflated bytes, in
 * the order the archive holds them. A body must be read before the next part is pulled, which `Stream.flatMap` and `Stream.mapEffect` do.
 */
export const bodiesOf: {
  (wanted: (key: string) => boolean): (bytes: Uint8Array) => Stream.Stream<Body, XlsxFatal>;
  (bytes: Uint8Array, wanted: (key: string) => boolean): Stream.Stream<Body, XlsxFatal>;
} = dual(
  2,
  (bytes: Uint8Array, wanted: (key: string) => boolean): Stream.Stream<Body, XlsxFatal> =>
    entriesOf(bytes).pipe(
      Stream.mapError(damaged),
      Stream.map((entry) => ({ entry, key: partKey(entry.header.path) })),
      Stream.filter(({ entry, key }) => entry.header.type === "File" && wanted(key)),
      Stream.map(({ entry, key }) => ({ path: entry.header.path, key, body: Stream.mapError(entry.body, damaged) }))
    )
);

/** One part's path as the archive writes it, its `partKey`, and the stream of its inflated bytes. */
interface Body {
  readonly body: Stream.Stream<Uint8Array, XlsxFatal>;
  readonly key: string;
  readonly path: string;
}
