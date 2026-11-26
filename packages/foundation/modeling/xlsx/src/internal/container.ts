import { $XlsxId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Bytes from "effect/Bytes";
import * as Effect from "effect/Effect";
import * as Zip from "effect/encoding/Zip";
import { dual, identity } from "effect/Function";
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
 *
 * **Gotchas**
 * Only `A` to `Z` fold, as OPC folds them, which no Effect string helper does without folding the rest of Unicode
 * too.
 */
export const partKey = (path: string): string => {
  // decision: hot-paths-are-mutable-loops
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

const utf16le = (name: string): string => {
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
  if (startsWith(bytes, zipMagic)) return zipContainer(namesIn(bytes));
  if (startsWith(bytes, oleMagic)) return oleContainer(namesIn(bytes));
  return "notAnArchive";
};

const namesIn = (bytes: Uint8Array): ((name: string) => boolean) => {
  const text = Str.toLowerCase(new TextDecoder("latin1").decode(bytes));
  return (name) => Str.includes(partKey(name))(text);
};

const zipContainer = (holds: (name: string) => boolean): XlsxContainer => {
  if (holds("xl/workbook.xml")) return holds("vbaProject.bin") ? "macroWorkbook" : "workbook";
  if (holds("xl/workbook.bin")) return "binaryWorkbook";
  if (holds("opendocument.spreadsheet")) return "openDocument";
  if (holds("word/document.xml")) return "word";
  return "otherZip";
};

const oleContainer = (holds: (name: string) => boolean): XlsxContainer => {
  if (holds(utf16le("EncryptedPackage"))) return "encrypted";
  if (holds(utf16le("Workbook")) || holds(utf16le("Book"))) return "legacyXls";
  return "otherOle";
};

const damaged = (error: Zip.ZipError): XlsxFatal =>
  stop(DamagedArchive.make({ damage: error.kind, reason: Str.slice(0, 255)(error.message) }));

const entriesOf = (bytes: Uint8Array) => Stream.make(bytes).pipe(Stream.pipeThroughChannel(Zip.decode()));

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const END64 = 0x06064b50;
const LOCATOR64 = 0x07064b50;
const MAX16 = 0xffff;
const MAX32 = 0xffffffff;
const FLAG_DESCRIPTOR = 0x0008;
const descriptorLengths: readonly [plain32: 12, withSignature32: 16, plain64: 20, withSignature64: 24] = [
  12, 16, 20, 24,
];

const FLAG_UTF8 = 0x0800;
const INFO_ZIP_UNICODE_PATH = 0x7075;

interface Span {
  readonly at: number;
  readonly length: number;
}

interface Listed {
  readonly compressed: number;
  readonly descriptor: boolean;
  readonly directoryExtras: Span;
  readonly directoryName: Span;
  readonly flags: number;
  readonly offset: number;
}

const byOffset = Order.mapInput(Order.Number, (entry: Listed) => entry.offset);

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
 *
 * **Details**
 * A 64-bit end record is taken whenever its locator precedes the end record, whatever the 32-bit fields hold. A
 * listed entry must have the name its local header gives it, as OPC compares names: the same bytes without regard to
 * ASCII case, read under the same encoding when any is not ASCII (ASCII reads the same under every name encoding a
 * zip may use), and the same Info-ZIP Unicode path field, or none in either, since a zip reader may take the name
 * from that field instead. A data descriptor's length is not recorded anywhere: it is the one of its four lengths
 * that lands on the next entry or the directory.
 *
 * **Gotchas**
 * Every offset and count here comes from the file, so each read is bounded on both ends (-1 outside the file) and
 * each count is checked against the bytes left before it is used. Locating a directory from one end record is
 * constant work, so every candidate end record is tried.
 */
// decision: archive-walk-checked-against-directory
// decision: hot-paths-are-mutable-loops
export const directoryMismatch = (bytes: Uint8Array): O.Option<string> => {
  const file = new LittleEndian(bytes);
  let refused: O.Option<string> = O.none();
  for (let at = file.length - 22; at >= Math.max(0, file.length - 22 - MAX16); at -= 1) {
    if (!isEndRecord(file, at)) continue;
    const located = locate(file, at);
    if (Result.isSuccess(located)) return walk(file, located.success);
    if (O.isNone(refused)) refused = O.some(located.failure);
  }
  return refused;
};

class LittleEndian {
  readonly length: number;
  private readonly view: DataView;

  constructor(bytes: Uint8Array) {
    this.length = bytes.length;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private inside(at: number, width: number): boolean {
    return Number.isSafeInteger(at) && at >= 0 && at + width <= this.length;
  }

  u8(at: number): number {
    return this.inside(at, 1) ? this.view.getUint8(at) : -1;
  }

  u16(at: number): number {
    return this.inside(at, 2) ? this.view.getUint16(at, true) : -1;
  }

  u32(at: number): number {
    return this.inside(at, 4) ? this.view.getUint32(at, true) : -1;
  }

  u64(at: number): number {
    return this.inside(at, 8) ? Number(this.view.getBigUint64(at, true)) : -1;
  }
}

const isEndRecord = (file: LittleEndian, at: number): boolean =>
  file.u32(at) === END && at + 22 + file.u16(at + 20) <= file.length;

const marked64 = (file: LittleEndian, end: number): boolean =>
  file.u16(end + 10) === MAX16 || file.u32(end + 12) === MAX32 || file.u32(end + 16) === MAX32;

const record64 = (file: LittleEndian, end: number): number => {
  const record = file.u32(end - 20) === LOCATOR64 ? file.u64(end - 12) : -1;
  return record >= 0 && record + 56 <= end - 20 && file.u32(record) === END64 ? record : -1;
};

const locate = (file: LittleEndian, end: number): Result.Result<Located, string> => {
  const record = record64(file, end);
  if (record < 0 && marked64(file, end)) return Result.fail("the end record names a 64-bit record that is not there");
  const located =
    record >= 0
      ? {
          count: file.u64(record + 32),
          size: file.u64(record + 40),
          start: file.u64(record + 48),
          directoryEnd: record,
        }
      : { count: file.u16(end + 10), size: file.u32(end + 12), start: file.u32(end + 16), directoryEnd: end };
  return checkLocated(located);
};

const checkLocated = (located: Located): Result.Result<Located, string> => {
  const { count, size, start, directoryEnd } = located;
  if (count < 0 || size < 0 || start < 0 || start + size !== directoryEnd) {
    return Result.fail(
      `the directory at byte ${start} of ${size} bytes does not reach its end record at ${directoryEnd}`
    );
  }
  if (count * 46 > size) return Result.fail(`the directory is too short for the ${count} entries it counts`);
  return Result.succeed(located);
};

const walk = (file: LittleEndian, located: Located): O.Option<string> =>
  Result.match(listedOf(file, located), {
    onFailure: O.some,
    onSuccess: (listed) => orderMismatch(file, listed, located.start),
  });

const listedOf = (
  file: LittleEndian,
  { count, directoryEnd, start }: Located
): Result.Result<Array<Listed>, string> => {
  const listed: Array<Listed> = [];
  let at = start;
  for (let n = 0; n < count; n += 1) {
    const entry = entryAt(file, at, directoryEnd, n + 1);
    if (Result.isFailure(entry)) return Result.fail(entry.failure);
    listed.push(entry.success.listed);
    at = entry.success.end;
  }
  if (at !== directoryEnd) return Result.fail(`the directory's ${count} entries do not fill it`);
  return Result.succeed(listed);
};

const entryAt = (
  file: LittleEndian,
  at: number,
  directoryEnd: number,
  ordinal: number
): Result.Result<{ readonly listed: Listed; readonly end: number }, string> => {
  if (file.u32(at) !== CENTRAL) return Result.fail(`the directory's entry ${ordinal} is not where it should be`);
  const names = file.u16(at + 28);
  const extras = file.u16(at + 30);
  const end = at + 46 + names + extras + file.u16(at + 32);
  if (names < 0 || extras < 0 || end < at + 46 || end > directoryEnd) {
    return Result.fail(`the directory's entry ${ordinal} runs past the directory`);
  }
  const { compressed, offset } = sizesOf(file, at, at + 46 + names, extras);
  if (compressed < 0 || offset < 0) return Result.fail(`the directory's entry ${ordinal} has no 64-bit size or offset`);
  const flags = file.u16(at + 8);
  return Result.succeed({
    listed: {
      compressed,
      descriptor: (flags & FLAG_DESCRIPTOR) !== 0,
      directoryExtras: { at: at + 46 + names, length: extras },
      flags,
      directoryName: { at: at + 46, length: names },
      offset,
    },
    end,
  });
};

interface Sizes {
  readonly compressed: number;
  readonly offset: number;
}

const sizesOf = (file: LittleEndian, at: number, fields: number, extras: number): Sizes => {
  let sizes: Sizes = { compressed: file.u32(at + 20), offset: file.u32(at + 42) };
  if (sizes.compressed !== MAX32 && sizes.offset !== MAX32) return sizes;
  const fieldsEnd = fields + extras;
  let field = fields;
  while (field + 4 <= fieldsEnd) {
    const spanEnd = field + 4 + file.u16(field + 2);
    if (file.u16(field) === 0x0001) sizes = zip64Sizes(file, { at, field, spanEnd, fieldsEnd }, sizes);
    field = spanEnd;
  }
  return sizes;
};

const zip64Sizes = (
  file: LittleEndian,
  span: { readonly at: number; readonly field: number; readonly spanEnd: number; readonly fieldsEnd: number },
  sizes: Sizes
): Sizes => {
  const within = (value: number): number =>
    value + 8 <= span.spanEnd && span.spanEnd <= span.fieldsEnd ? file.u64(value) : -1;
  let value = file.u32(span.at + 24) === MAX32 ? span.field + 12 : span.field + 4;
  let { compressed, offset } = sizes;
  if (compressed === MAX32) {
    compressed = within(value);
    value += 8;
  }
  if (offset === MAX32) offset = within(value);
  return { compressed, offset };
};

const orderMismatch = (file: LittleEndian, listed: ReadonlyArray<Listed>, start: number): O.Option<string> => {
  const sorted = A.sort(listed, byOffset);
  let expected = 0;
  for (const [n, entry] of sorted.entries()) {
    const mismatch = entryMismatch(file, entry, expected);
    if (O.isSome(mismatch)) return mismatch;
    expected = entryEnd(
      file,
      entry,
      O.match(A.get(sorted, n + 1), { onNone: () => start, onSome: (after) => after.offset })
    );
  }
  return expected === start
    ? O.none()
    : O.some(`the directory starts at byte ${start}, where the entries it names end at ${expected}`);
};

const entryMismatch = (file: LittleEndian, entry: Listed, expected: number): O.Option<string> => {
  if (entry.offset !== expected || file.u32(entry.offset) !== LOCAL) {
    return O.some(`the directory names an entry at byte ${entry.offset}, where the walk reached ${expected}`);
  }
  return sameName(file, entry)
    ? O.none()
    : O.some(`the directory names the entry at byte ${entry.offset} otherwise than its local header does`);
};

const asciiFolded = (byte: number): number => (byte >= 0x41 && byte <= 0x5a ? byte + 0x20 : byte);

const sameBytes = (file: LittleEndian, a: Span, b: Span, fold: (byte: number) => number): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (fold(file.u8(a.at + i)) !== fold(file.u8(b.at + i))) return false;
  return true;
};

const isAscii = (file: LittleEndian, span: Span): boolean => {
  for (let i = 0; i < span.length; i += 1) if (file.u8(span.at + i) >= 0x80) return false;
  return true;
};

const unicodePathOf = (file: LittleEndian, extras: Span): O.Option<Span> => {
  const end = extras.at + extras.length;
  for (let field = extras.at; field + 4 <= end; field += 4 + file.u16(field + 2)) {
    if (file.u16(field) === INFO_ZIP_UNICODE_PATH) return O.some({ at: field + 4, length: file.u16(field + 2) });
  }
  return O.none();
};

const sameName = (file: LittleEndian, entry: Listed): boolean => {
  const local: Span = { at: entry.offset + 30, length: file.u16(entry.offset + 26) };
  const localExtras: Span = { at: local.at + local.length, length: file.u16(entry.offset + 28) };
  const encoded = (file.u16(entry.offset + 6) & FLAG_UTF8) === (entry.flags & FLAG_UTF8) || isAscii(file, local);
  return (
    encoded &&
    sameBytes(file, local, entry.directoryName, asciiFolded) &&
    sameField(file, unicodePathOf(file, localExtras), unicodePathOf(file, entry.directoryExtras))
  );
};

const sameField = (file: LittleEndian, a: O.Option<Span>, b: O.Option<Span>): boolean =>
  O.match(a, {
    onNone: () => O.isNone(b),
    onSome: (field) => O.exists(b, (other) => sameBytes(file, field, other, identity)),
  });

const entryEnd = (file: LittleEndian, entry: Listed, next: number): number => {
  const dataEnd = entry.offset + 30 + file.u16(entry.offset + 26) + file.u16(entry.offset + 28) + entry.compressed;
  return entry.descriptor && A.some(descriptorLengths, (extra) => dataEnd + extra === next) ? next : dataEnd;
};

const inflate = (input: {
  readonly body: Stream.Stream<Uint8Array, Zip.ZipError>;
  readonly path: string;
  readonly caps: Caps;
  readonly total: { inflated: number };
  readonly held: O.Option<Array<Uint8Array>>;
}): Effect.Effect<void, XlsxFatal> => {
  const { caps, total, held } = input;
  const exceeded = (limit: "partBytes" | "inflatedBytes") =>
    Effect.fail(stop(LimitExceeded.make({ limit, path: Str.slice(0, 1024)(input.path) })));
  let size = 0;
  return input.body.pipe(
    Stream.mapError(damaged),
    Stream.mapEffect((chunk) => {
      size += chunk.length;
      total.inflated += chunk.length;
      if (size > caps.partBytes) return exceeded("partBytes");
      if (total.inflated > caps.inflatedBytes) return exceeded("inflatedBytes");
      if (O.isSome(held)) held.value.push(chunk);
      return Effect.void;
    }),
    Stream.runDrain
  );
};

/**
 * The first pass: every part inflated and counted against the caps, every path checked for a repeat, the parts
 * `keep` asks for held (by their `partKey`), and the directory checked against what the pass read. A part that is
 * not kept is inflated and let go, and so is the body of a directory entry, counted as a part's is.
 *
 * **Details**
 * Effect's zip reader goes through the local entries in order and never reads the central directory, which is what
 * Excel opens a file by, so a file could show the two readers two workbooks. One part name met twice is refused
 * (`DuplicatePart`), part names compared by `partKey`; and when the file ends with a directory, that directory must
 * name exactly the entries the walk read (`DirectoryMismatch`). Caps are counted as bytes are inflated, never taken
 * from the sizes a file declares.
 *
 * **Gotchas**
 * The zip reader takes a name ending with `/` for a directory whatever its body holds, and inflates that body when
 * it moves on; the body is counted as any part's is, and a directory is never a part.
 */
export const census = Effect.fnUntraced(function* (input: {
  readonly bytes: Uint8Array;
  readonly caps: Caps;
  readonly keep: (key: string) => boolean;
}) {
  const { caps, keep } = input;
  // decision: archive-walk-checked-against-directory
  // decision: hot-paths-are-mutable-loops
  const paths: Array<string> = [];
  const seen = MutableHashSet.empty<string>();
  const kept = MutableHashMap.empty<string, Uint8Array>();
  const total = { inflated: 0 };
  yield* entriesOf(input.bytes).pipe(
    Stream.mapError(damaged),
    Stream.mapEffect((entry) => {
      const path = entry.header.path;
      if (entry.header.type === "Directory") return inflate({ body: entry.body, path, caps, total, held: O.none() });
      const key = partKey(path);
      if (MutableHashSet.has(seen, key))
        return Effect.fail(stop(DuplicatePart.make({ path: Str.slice(0, 1024)(path) })));
      MutableHashSet.add(seen, key);
      paths.push(path);
      if (paths.length > caps.parts) return Effect.fail(stop(LimitExceeded.make({ limit: "parts", path: "" })));
      const held: O.Option<Array<Uint8Array>> = keep(key) ? O.some([]) : O.none();
      return Effect.map(inflate({ body: entry.body, path, caps, total, held }), () => {
        if (O.isSome(held)) MutableHashMap.set(kept, key, Bytes.concat(held.value));
      });
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
          MutableHashMap.set(kept, key, Bytes.concat(chunks));
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

interface Body {
  readonly body: Stream.Stream<Uint8Array, XlsxFatal>;
  readonly key: string;
  readonly path: string;
}
