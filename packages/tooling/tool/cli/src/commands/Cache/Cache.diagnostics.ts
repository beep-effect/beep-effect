/**
 * Observe package-level installed dependency differences without changing the approved tree digest.
 *
 * **Details**
 *
 * This credential-free observer consumes the same canonical GNU tar stream as
 * `inspectCacheDependencyTree`. It never extracts, executes or publishes file
 * payloads. Two sequential passes must match each other and the selected
 * source report. The result is diagnostic evidence only, never producer
 * approval. Hashed records and the retained report are RFC 8785 canonical
 * JSON from the repo's digest owner, `JsoncFingerprint`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { Sha256Hex } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { constFalse, identity, pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Pull from "effect/Pull";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  CacheDependencyDiagnosticBounds,
  CacheDependencyDiagnosticFileDetails,
  CacheDependencyDiagnosticGroupRow,
  CacheDependencyDiagnosticLimits,
  CacheDependencyDiagnosticRefusal,
  CacheDependencyDiagnosticRefusalReport,
  CacheDependencyDiagnosticReport,
  CacheDependencyDiagnosticSecondPass,
  CacheDependencyDiagnosticSnapshot,
  CacheDependencyPublicationPlan,
} from "./Cache.diagnostics.schemas.ts";
import type * as PlatformError from "effect/PlatformError";
import type {
  CacheDependencyDiagnosticCode,
  CacheDependencyDiagnosticFileKind,
  CacheDependencyDiagnosticFileRow,
} from "./Cache.diagnostics.schemas.ts";

const refuse = CacheDependencyDiagnosticRefusal.fail;
const utf8 = new TextEncoder();
const newline = utf8.encode("\n");
// The real paired observation isolated byte drift to this one package.
const fileDetailGroup = "node-gyp";
const changedGroupLimit = 64;
const blockSize = 512;
const tarArguments = [
  "/usr/bin/tar",
  "--sort=name",
  "--format=posix",
  "--mtime=@0",
  "--owner=0",
  "--group=0",
  "--numeric-owner",
  "--hard-dereference",
  "--pax-option=exthdr.name=%d/PaxHeaders/%f,delete=atime,delete=ctime",
  "-C",
  ".",
  "-cf",
  "-",
  "--",
  "node_modules",
];
const safeLabel = /^[A-Za-z0-9@._+~%/=-]{1,180}$/;
const hex40 = /^[a-f0-9]{40}$/;
const hex64 = /^[a-f0-9]{64}$/;
const paxLengthPrefix = /^([0-9]{1,20}) /;
const octalNumber = /^[+-]?(?:0[oO]_?)?[0-7](?:_?[0-7])*$/;
const decimalInteger = /^[+-]?[0-9](?:_?[0-9])*$/;
const decimalFloat =
  /^[+-]?(?:[0-9](?:_?[0-9])*(?:\.(?:[0-9](?:_?[0-9])*)?)?|\.[0-9](?:_?[0-9])*)(?:[eE][+-]?[0-9](?:_?[0-9])*)?$/;
const pythonWhitespace = /^[\t\n\v\f\r\u001c-\u001f ]+|[\t\n\v\f\r\u001c-\u001f ]+$/g;
const isJsonObject = S.is(S.Record(S.String, S.Unknown));

/**
 * Encode a plain JSON value as RFC 8785 canonical bytes.
 *
 * **Details**
 *
 * Every hashed record and report here is built from strings, finite numbers
 * and plain arrays or objects, so a canonicalization failure is an invariant
 * breach and surfaces as a defect.
 *
 * **Example** (Encode a sorted record)
 *
 * ```ts
 * import { encodeCacheDiagnosticJson } from "@beep/repo-cli/test/Cache"
 * const bytes = encodeCacheDiagnosticJson({ b: 1, a: "x" })
 * console.assert(new TextDecoder().decode(bytes) === '{"a":"x","b":1}')
 * ```
 *
 * @internal
 * @param value - Plain JSON value to encode.
 * @returns Canonical JSON bytes.
 * @category encoding
 * @since 0.0.0
 */
export const encodeCacheDiagnosticJson = (value: unknown): Uint8Array =>
  utf8.encode(Result.getOrThrowWith(JsoncFingerprint.canonicalizeResult(value), identity));

const concatBytes = (...parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const out = new Uint8Array(A.reduce(parts, 0, (total, part) => total + part.length));
  A.reduce(parts, 0, (offset, part) => {
    out.set(part, offset);
    return offset + part.length;
  });
  return out;
};

const sha256Hex = (bytes: Uint8Array) => Sha256Hex.make(Hex.encode(sha256(bytes)));

// Streaming SHA-256 over two full archive passes dominates run time. Bun's native
// hasher is about nine times faster than the portable one (see Corpus Restoration);
// a runtime without `Bun.CryptoHasher`, such as the vitest Node lane, falls back.
// Digests are identical either way.
interface StreamingSha256 {
  readonly digest: () => Uint8Array;
  readonly update: (chunk: Uint8Array) => void;
}
const hasNativeSha256 = (): boolean => P.hasProperty(globalThis, "Bun") && P.isFunction(Bun.CryptoHasher);
const createSha256 = (): StreamingSha256 => {
  if (hasNativeSha256()) {
    const native = new Bun.CryptoHasher("sha256");
    return {
      update: (chunk) => {
        native.update(chunk);
      },
      digest: () => new Uint8Array(native.digest()),
    };
  }
  const portable = sha256.create();
  return {
    update: (chunk) => {
      portable.update(chunk);
    },
    digest: () => portable.digest(),
  };
};

// ---------------------------------------------------------------------------
// Source report reads.
// ---------------------------------------------------------------------------

const regularFileSize = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, file: string) {
  // A symlink at the final component is refused like O_NOFOLLOW.
  if (yield* fs.readLink(file).pipe(Effect.as(true), Effect.orElseSucceed(constFalse)))
    return yield* refuse("filesystem-or-process-failed");
  const info = yield* fs.stat(file);
  return info.type === "File" ? O.some(Number(info.size)) : O.none<number>();
});

const readExact = Effect.fnUntraced(function* (handle: FileSystem.File, buffer: Uint8Array) {
  let length = 0;
  while (length < buffer.length) {
    const read = yield* handle.read(buffer.subarray(length));
    if (read === 0) return length;
    length += read;
  }
  return length;
});

const openSource = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  file: string,
  limits: CacheDependencyDiagnosticLimits
) {
  // Special files are refused before any open, so a FIFO can never block the observer.
  const size = yield* regularFileSize(fs, file);
  if (O.isNone(size)) return yield* refuse("source-not-regular");
  const handle = yield* fs.open(file, { flag: "r", noFollow: true });
  const info = yield* handle.stat;
  if (info.type !== "File") return yield* refuse("source-not-regular");
  const bytes = Number(info.size);
  if (!(bytes > 0 && bytes < limits.artifactBytes)) return yield* refuse("source-size-bound");
  return [handle, bytes] as const;
});

/**
 * Read bounded source-report bytes without following a final symlink.
 *
 * **Example** (Plan a bounded source read)
 *
 * ```ts
 * import { readCacheDiagnosticSource } from "@beep/repo-cli/test/Cache"
 * import { CacheDependencyDiagnosticLimits } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(readCacheDiagnosticSource("report.json", CacheDependencyDiagnosticLimits.make({}))))
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const readCacheDiagnosticSource = Effect.fn("CacheDiagnostics.readSource")(
  function* (file: string, limits: CacheDependencyDiagnosticLimits) {
    const fs = yield* FileSystem.FileSystem;
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const [handle, size] = yield* openSource(fs, file, limits);
        const buffer = new Uint8Array(size + 1);
        const read = yield* readExact(handle, buffer);
        if (read !== size) return yield* refuse("source-read-drift");
        return buffer.subarray(0, size);
      })
    );
  },
  Effect.catchTag("PlatformError", () => refuse("filesystem-or-process-failed"))
);

/**
 * Compare a source report with retained bytes in bounded chunks, without a second full copy.
 *
 * **Example** (Plan a chunked comparison)
 *
 * ```ts
 * import { compareCacheDiagnosticSource } from "@beep/repo-cli/test/Cache"
 * import { CacheDependencyDiagnosticLimits } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * const compare = compareCacheDiagnosticSource("report.json", new Uint8Array([1]), CacheDependencyDiagnosticLimits.make({}))
 * console.assert(Effect.isEffect(compare))
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const compareCacheDiagnosticSource = Effect.fn("CacheDiagnostics.compareSource")(
  function* (file: string, expected: Uint8Array, limits: CacheDependencyDiagnosticLimits) {
    const fs = yield* FileSystem.FileSystem;
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const [handle, size] = yield* openSource(fs, file, limits);
        if (size !== expected.length) return false;
        const chunk = new Uint8Array(64 * 1024);
        for (let offset = 0; offset < size; offset += chunk.length) {
          const length = Math.min(chunk.length, size - offset);
          const read = yield* readExact(handle, chunk.subarray(0, length));
          if (read !== length) return yield* refuse("source-read-drift");
          for (let index = 0; index < length; index += 1) {
            if (chunk[index] !== expected[offset + index]) return false;
          }
        }
        if ((yield* readExact(handle, chunk.subarray(0, 1))) !== 0) return yield* refuse("source-read-drift");
        return true;
      })
    );
  },
  Effect.catchTag("PlatformError", () => refuse("filesystem-or-process-failed"))
);

// ---------------------------------------------------------------------------
// Bounded streaming tar parser (Python `tarfile` stream-mode semantics).
// ---------------------------------------------------------------------------

// Names that are not strict UTF-8 refuse as invalid values. Python decoded them
// with surrogateescape and then failed the same way on `name.encode()`.
const strictUtf8 = new TextDecoder("utf-8", { fatal: true });
const latin1 = new TextDecoder("latin1");
const decodeText = (bytes: Uint8Array) =>
  Effect.try({
    try: () => strictUtf8.decode(bytes),
    catch: () => CacheDependencyDiagnosticRefusal.make({ code: "invalid-value-or-shape" }),
  });

const untilNul = (bytes: Uint8Array) => {
  const end = bytes.indexOf(0);
  return end === -1 ? bytes : bytes.subarray(0, end);
};

const everyByte = (bytes: Uint8Array, predicate: (byte: number) => boolean) => {
  for (const byte of bytes) if (!predicate(byte)) return false;
  return true;
};

const parseOctal = (field: Uint8Array): O.Option<number> => {
  const first = field[0] ?? 0;
  if (first === 0o200 || first === 0o377) {
    const base = BigInt(256);
    const magnitude = A.reduce(
      A.fromIterable(field.subarray(1)),
      BigInt(0),
      (total, byte) => total * base + BigInt(byte)
    );
    return O.some(Number(first === 0o377 ? magnitude - base ** BigInt(field.length - 1) : magnitude));
  }
  const raw = untilNul(field);
  if (!everyByte(raw, (byte) => byte <= 0x7f)) return O.none();
  const text = Str.replace(pythonWhitespace, "")(latin1.decode(raw));
  if (text === "") return O.some(0);
  if (!octalNumber.test(text)) return O.none();
  const digits = Str.replace(/^([+-]?)(?:0[oO])?/, "$1")(Str.replaceAll("_", "")(text));
  return O.some(Number.parseInt(digits, 8));
};

const checksumMatches = (block: Uint8Array, expected: number) => {
  let unsigned = 256;
  let signed = 256;
  for (let index = 0; index < blockSize; index += 1) {
    if (index >= 148 && index < 156) continue;
    const byte = block[index] ?? 0;
    unsigned += byte;
    signed += byte > 127 ? byte - 256 : byte;
  }
  return expected === unsigned || expected === signed;
};

const typeRegular = 0x30;
const typeAregular = 0;
const typeSymlink = 0x32;
const typeDirectory = 0x35;
const typeContiguous = 0x37;
const typeLongName = 0x4c;
const typeLongLink = 0x4b;
const typeSparse = 0x53;
const typeExtended = 0x78;
const typeGlobal = 0x67;
const typeSolarisExtended = 0x58;
const regularTypes = [typeRegular, typeAregular, typeContiguous, typeSparse];
const gnuTypes = [typeLongName, typeLongLink, typeSparse];
type PaxPairs = Array<[string, string]>;

type TarMember = {
  name: string;
  mode: number;
  uid: number;
  gid: number;
  size: number;
  mtime: number;
  type: number;
  linkname: string;
  uname: string;
  gname: string;
  pax: PaxPairs;
  sparse: boolean;
};

const isRegular = (member: TarMember) => A.contains(regularTypes, member.type);
const isDirectory = (member: TarMember) => member.type === typeDirectory;
const stripTrailingSlashes = Str.replace(/\/+$/, "");
const setPax = (pairs: PaxPairs, key: string, value: string) => {
  const existing = A.findFirstIndex(pairs, ([name]) => name === key);
  if (O.isSome(existing)) pairs[existing.value] = [key, value];
  else pairs.push([key, value]);
};

const pythonInt = (text: string): O.Option<number> => {
  const trimmed = Str.replace(pythonWhitespace, "")(text);
  return decimalInteger.test(trimmed) ? O.some(Number(Str.replaceAll("_", "")(trimmed))) : O.none();
};

const pythonFloatValue = (text: string): O.Option<number> => {
  // Non-finite pax times are treated as invalid and fall back to 0, so every record stays plain JSON.
  const trimmed = Str.replace(pythonWhitespace, "")(text);
  return decimalFloat.test(trimmed)
    ? O.filter(O.some(Number(Str.replaceAll("_", "")(trimmed))), Number.isFinite)
    : O.none();
};

const applyPax = Effect.fnUntraced(function* (member: TarMember, pairs: PaxPairs) {
  for (const [keyword, value] of pairs) {
    if (keyword === "GNU.sparse.name") member.name = value;
    else if (keyword === "GNU.sparse.size" || keyword === "GNU.sparse.realsize") {
      const size = pythonInt(value);
      if (O.isNone(size)) return yield* refuse("invalid-value-or-shape");
      member.size = size.value;
    } else if (keyword === "path") member.name = stripTrailingSlashes(value);
    else if (keyword === "linkpath") member.linkname = value;
    else if (keyword === "uname") member.uname = value;
    else if (keyword === "gname") member.gname = value;
    else if (keyword === "size") member.size = O.getOrElse(pythonInt(value), () => 0);
    else if (keyword === "uid") member.uid = O.getOrElse(pythonInt(value), () => 0);
    else if (keyword === "gid") member.gid = O.getOrElse(pythonInt(value), () => 0);
    else if (keyword === "mtime") member.mtime = O.getOrElse(pythonFloatValue(value), () => 0);
  }
  member.pax = A.map(pairs, ([key, entry]): [string, string] => [key, entry]);
});

const HeaderStop = S.TaggedStruct("HeaderStop", {
  reason: S.Literals(["empty", "truncated", "end", "invalid"]),
});
const isHeaderStop = S.is(HeaderStop);

const parseHeader = Effect.fnUntraced(function* (block: Uint8Array, dircheck: boolean) {
  if (block.length === 0) return HeaderStop.make({ reason: "empty" });
  if (block.length !== blockSize) return HeaderStop.make({ reason: "truncated" });
  if (everyByte(block, (byte) => byte === 0)) return HeaderStop.make({ reason: "end" });
  const fields = O.all({
    checksum: parseOctal(block.subarray(148, 156)),
    mode: parseOctal(block.subarray(100, 108)),
    uid: parseOctal(block.subarray(108, 116)),
    gid: parseOctal(block.subarray(116, 124)),
    size: parseOctal(block.subarray(124, 136)),
    mtime: parseOctal(block.subarray(136, 148)),
    devmajor: parseOctal(block.subarray(329, 337)),
    devminor: parseOctal(block.subarray(337, 345)),
  });
  if (O.isNone(fields) || !checksumMatches(block, fields.value.checksum)) return HeaderStop.make({ reason: "invalid" });
  const member: TarMember = {
    name: yield* decodeText(untilNul(block.subarray(0, 100))),
    mode: fields.value.mode,
    uid: fields.value.uid,
    gid: fields.value.gid,
    size: fields.value.size,
    mtime: fields.value.mtime,
    type: block[156] ?? 0,
    linkname: yield* decodeText(untilNul(block.subarray(157, 257))),
    uname: yield* decodeText(untilNul(block.subarray(265, 297))),
    gname: yield* decodeText(untilNul(block.subarray(297, 329))),
    pax: [],
    sparse: false,
  };
  const prefix = yield* decodeText(untilNul(block.subarray(345, 500)));
  // Old V7 archives represent a directory as a regular file with a trailing slash.
  if (dircheck && member.type === typeAregular && Str.endsWith("/")(member.name)) member.type = typeDirectory;
  if (member.type === typeSparse) member.sparse = true;
  if (isDirectory(member)) member.name = stripTrailingSlashes(member.name);
  if (prefix !== "" && !A.contains(gnuTypes, member.type)) member.name = `${prefix}/${member.name}`;
  return member;
});

const blockLength = (size: number) => Math.ceil(size / blockSize) * blockSize;

/**
 * One raw archive reader: hashes every byte (padding included) with timed, bounded pulls.
 */
const makeArchiveReader = (
  pull: Pull.Pull<A.NonEmptyReadonlyArray<Uint8Array>, PlatformError.PlatformError>,
  deadline: number,
  limits: CacheDependencyDiagnosticLimits
) => {
  const hasher = createSha256();
  const queue: Array<Uint8Array> = [];
  let available = 0;
  let total = 0;
  let ended = false;

  const fill = Effect.gen(function* () {
    if (ended) return false;
    const remaining = deadline - (yield* Clock.currentTimeMillis);
    if (remaining <= 0) return yield* refuse("deadline");
    const next = yield* pull.pipe(
      Effect.asSome,
      Pull.catchDone(() => Effect.succeed(O.none<A.NonEmptyReadonlyArray<Uint8Array>>())),
      Effect.timeoutOrElse({ duration: Duration.millis(remaining), orElse: () => refuse("deadline") })
    );
    if (O.isNone(next)) {
      ended = true;
      return false;
    }
    for (const chunk of next.value) {
      total += chunk.length;
      if (total > limits.streamBytes) return yield* refuse("archive-stream-bound");
      hasher.update(chunk);
      if (chunk.length > 0) {
        queue.push(chunk);
        available += chunk.length;
      }
    }
    return true;
  });

  const takeHead = (size: number) => {
    const head = queue[0] ?? new Uint8Array(0);
    const piece = head.subarray(0, size);
    if (piece.length === head.length) queue.shift();
    else queue[0] = head.subarray(size);
    available -= piece.length;
    return piece;
  };

  const take = Effect.fnUntraced(function* (size: number) {
    while (available < size && (yield* fill)) {}
    const out = new Uint8Array(Math.min(size, available));
    let offset = 0;
    while (offset < out.length) {
      const piece = takeHead(out.length - offset);
      out.set(piece, offset);
      offset += piece.length;
    }
    return out;
  });

  const consume = Effect.fnUntraced(function* (size: number, onChunk: (chunk: Uint8Array) => void) {
    let consumed = 0;
    while (consumed < size) {
      if (available === 0 && !(yield* fill)) return consumed;
      const piece = takeHead(Math.min(available, size - consumed, queue[0]?.length ?? 0));
      onChunk(piece);
      consumed += piece.length;
    }
    return consumed;
  });

  const drain = Effect.gen(function* () {
    queue.length = 0;
    available = 0;
    while (yield* fill) {
      queue.length = 0;
      available = 0;
    }
  });

  return {
    take,
    consume,
    drain,
    digest: () => Sha256Hex.make(Hex.encode(hasher.digest())),
    bytes: () => total,
  };
};

type ArchiveReader = ReturnType<typeof makeArchiveReader>;
type ArchiveFailure = CacheDependencyDiagnosticRefusal | PlatformError.PlatformError;

const readHeaderData = Effect.fnUntraced(function* (
  reader: ArchiveReader,
  member: TarMember,
  limits: CacheDependencyDiagnosticLimits
) {
  if (member.size > limits.headerBytes) return yield* refuse("archive-header-bound");
  const data = yield* reader.take(blockLength(member.size));
  if (data.length !== blockLength(member.size)) return yield* refuse("archive-read-failed");
  return data;
});

const parsePaxRecords = Effect.fnUntraced(function* (data: Uint8Array, pairs: PaxPairs) {
  let position = 0;
  while (position < data.length && data[position] !== 0) {
    const prefix = paxLengthPrefix.exec(latin1.decode(data.subarray(position, position + 21)));
    if (prefix === null) return yield* refuse("archive-read-failed");
    const length = Number(prefix[1]);
    const end = position + length - 1;
    if (length < 5 || position + length > data.length) return yield* refuse("archive-read-failed");
    const record = data.subarray(position + (prefix[1]?.length ?? 0) + 1, end);
    const equals = record.indexOf(0x3d);
    if (equals <= 0 || data[end] !== 0x0a) return yield* refuse("archive-read-failed");
    const keyword = yield* decodeText(record.subarray(0, equals));
    const value = yield* decodeText(record.subarray(equals + 1));
    setPax(pairs, keyword, value);
    position += length;
  }
});

/** Read the next member, or `None` at the end of the archive (Python `TarFile.next`). */
const nextMember: (
  reader: ArchiveReader,
  globalPax: PaxPairs,
  limits: CacheDependencyDiagnosticLimits,
  first: boolean
) => Effect.Effect<O.Option<TarMember>, ArchiveFailure> = Effect.fnUntraced(
  function* (reader, globalPax, limits, first) {
    const header = yield* readMember(reader, globalPax, limits, true);
    if (!isHeaderStop(header)) return O.some(header);
    // A malformed first header is an archive failure; later ones end iteration like tarfile.
    return first && header.reason !== "end" ? yield* refuse("archive-read-failed") : O.none<TarMember>();
  }
);

const readSubsequent = Effect.fnUntraced(function* (
  reader: ArchiveReader,
  globalPax: PaxPairs,
  limits: CacheDependencyDiagnosticLimits
) {
  const next = yield* readMember(reader, globalPax, limits, false);
  return isHeaderStop(next) ? yield* refuse("archive-read-failed") : next;
});

const readMember: (
  reader: ArchiveReader,
  globalPax: PaxPairs,
  limits: CacheDependencyDiagnosticLimits,
  dircheck: boolean
) => Effect.Effect<TarMember | typeof HeaderStop.Type, ArchiveFailure> = Effect.fnUntraced(
  function* (reader, globalPax, limits, dircheck) {
    const block = yield* reader.take(blockSize);
    const header = yield* parseHeader(block, dircheck);
    if (isHeaderStop(header)) return header;
    if (header.type === typeLongName || header.type === typeLongLink) {
      const data = yield* readHeaderData(reader, header, limits);
      const next = yield* readSubsequent(reader, globalPax, limits);
      const text = yield* decodeText(untilNul(data));
      if (header.type === typeLongName) next.name = text;
      else next.linkname = text;
      if (isDirectory(next)) next.name = Str.endsWith("/")(next.name) ? Str.slice(0, -1)(next.name) : next.name;
      return next;
    }
    if (header.type === typeExtended || header.type === typeGlobal || header.type === typeSolarisExtended) {
      const data = yield* readHeaderData(reader, header, limits);
      const pairs: PaxPairs =
        header.type === typeGlobal ? globalPax : A.map(globalPax, ([key, value]): [string, string] => [key, value]);
      yield* parsePaxRecords(data, pairs);
      const next = yield* readSubsequent(reader, globalPax, limits);
      const pax = R.fromEntries(pairs);
      if (
        R.has(pax, "GNU.sparse.map") ||
        R.has(pax, "GNU.sparse.size") ||
        (pax["GNU.sparse.major"] === "1" && pax["GNU.sparse.minor"] === "0")
      )
        next.sparse = true;
      if (header.type !== typeGlobal) yield* applyPax(next, pairs);
      return next;
    }
    yield* applyPax(header, globalPax);
    if (isDirectory(header)) header.name = stripTrailingSlashes(header.name);
    return header;
  }
);

// ---------------------------------------------------------------------------
// Snapshot: one bounded archive pass.
// ---------------------------------------------------------------------------

const pathParts = (name: string): ReadonlyArray<string> => {
  const root =
    Str.startsWith("//")(name) && !Str.startsWith("///")(name) ? ["//"] : Str.startsWith("/")(name) ? ["/"] : [];
  return [...root, ...A.filter(Str.split("/")(name), (part) => part !== "" && part !== ".")];
};

const packageGroup = Effect.fnUntraced(function* (name: string, limits: CacheDependencyDiagnosticLimits) {
  const parts = pathParts(name);
  if (
    A.head(parts).pipe(
      O.filter((part) => part === "node_modules"),
      O.isNone
    ) ||
    A.contains(parts, "..")
  )
    return yield* refuse("archive-path");
  if (utf8.encode(name).length > limits.headerBytes) return yield* refuse("archive-path-bound");
  const relative = A.drop(parts, 1);
  return yield* pipe(
    A.head(relative),
    O.match({
      onNone: () => Effect.succeed("."),
      onSome: (head) =>
        Effect.succeed(A.join(A.take(relative, head === ".bun" || Str.startsWith("@")(head) ? 2 : 1), "/")),
    })
  );
});

const fileKind = (name: string): CacheDependencyDiagnosticFileKind => {
  const base = O.getOrElse(A.last(Str.split("/")(name)), () => "");
  const suffix = pipe(
    Str.lastIndexOf(".")(base),
    O.filter((dot) => dot > 0 && dot < base.length - 1),
    O.match({ onNone: () => "", onSome: (dot) => Str.slice(dot)(base) })
  );
  return suffix === ".pyc" || suffix === ".pyo" ? "python-bytecode" : suffix === ".py" ? "python-source" : "other";
};

type GroupState = {
  label: string;
  entries: number;
  files: number;
  bytes: number;
  content: StreamingSha256;
  mode: StreamingSha256;
  links: StreamingSha256;
  headers: StreamingSha256;
};

const newGroup = (label: string): GroupState => ({
  // Unexpected names are represented by a digest, never copied into logs.
  label: safeLabel.test(label) ? label : `opaque:${sha256Hex(utf8.encode(label))}`,
  entries: 0,
  files: 0,
  bytes: 0,
  content: createSha256(),
  mode: createSha256(),
  links: createSha256(),
  headers: createSha256(),
});

const digestHex = (hash: StreamingSha256) => Sha256Hex.make(Hex.encode(hash.digest()));

const requirePhysicalRoot = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const modules = path.join(root, "node_modules");
  const linked = yield* fs.readLink(modules).pipe(Effect.as(true), Effect.orElseSucceed(constFalse));
  if (linked || (yield* fs.stat(modules)).type !== "Directory") return yield* refuse("dependency-root-not-physical");
});

/**
 * Stream one canonical GNU tar pass over `node_modules` and group it by package.
 *
 * **Details**
 *
 * The archive child runs with a fixed environment, no stdin, discarded stderr
 * and a 64 KiB file-size limit, in its own process group that is killed on
 * any exit. Every streamed byte, padding included, feeds the raw digest that
 * must equal the producer inspection's declared dependency digest.
 *
 * **Example** (Plan one archive pass)
 *
 * ```ts
 * import { snapshotCacheDependencies } from "@beep/repo-cli/test/Cache"
 * import { CacheDependencyDiagnosticLimits } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(snapshotCacheDependencies("/repo", Date.now() + 1000, CacheDependencyDiagnosticLimits.make({}))))
 * ```
 *
 * @internal
 * @param root - Directory containing the physical `node_modules` tree.
 * @param deadline - Absolute deadline in epoch milliseconds.
 * @param limits - Archive, entry, group and detail bounds.
 * @returns The pass digest, byte count and redacted package groups.
 * @category queries
 * @since 0.0.0
 */
export const snapshotCacheDependencies = Effect.fn("CacheDiagnostics.snapshot")(
  function* (root: string, deadline: number, limits: CacheDependencyDiagnosticLimits) {
    yield* requirePhysicalRoot(root);
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.make(
          "/usr/bin/bash",
          ["-c", 'ulimit -f 64 && exec "$@"', "cache-dependency-diagnostics", ...tarArguments],
          {
            cwd: root,
            extendEnv: false,
            env: { PATH: "/usr/bin", HOME: "/nonexistent", LANG: "C", LC_ALL: "C" },
            stdin: "ignore",
            stdout: "pipe",
            stderr: "ignore",
            killSignal: "SIGKILL",
          }
        );
        const pull = yield* Stream.toPull(handle.stdout);
        const reader = makeArchiveReader(pull, deadline, limits);
        const groups = MutableHashMap.empty<string, GroupState>();
        const globalPax: PaxPairs = [];
        const fileRows: Array<CacheDependencyDiagnosticFileRow> = [];
        let fileDetailBytes = 2;
        let entries = 0;
        let first = true;
        while (true) {
          const next = yield* nextMember(reader, globalPax, limits, first);
          if (O.isNone(next)) break;
          first = false;
          const member = next.value;
          entries += 1;
          if (entries > limits.entries) return yield* refuse("entry-bound");
          const regular = isRegular(member);
          const symlink = member.type === typeSymlink;
          if (!(isDirectory(member) || regular || symlink)) return yield* refuse("archive-entry-type");
          if (member.size > limits.streamBytes || member.sparse) return yield* refuse("archive-entry-bound");
          const label = yield* packageGroup(member.name, limits);
          const existing = MutableHashMap.get(groups, label);
          if (O.isNone(existing) && MutableHashMap.size(groups) >= limits.groups) return yield* refuse("group-bound");
          const group = O.isSome(existing) ? existing.value : newGroup(label);
          if (O.isNone(existing)) MutableHashMap.set(groups, label, group);
          group.entries += 1;
          const pax = R.fromEntries(member.pax);
          if (encodeCacheDiagnosticJson(pax).length > limits.headerBytes) return yield* refuse("archive-header-bound");
          const type = latin1.decode(Uint8Array.of(member.type));
          const identity = concatBytes(encodeCacheDiagnosticJson([member.name, type]), newline);
          group.mode.update(concatBytes(identity, encodeCacheDiagnosticJson(member.mode), newline));
          group.headers.update(
            concatBytes(
              encodeCacheDiagnosticJson([
                member.name,
                type,
                member.size,
                member.mode,
                member.uid,
                member.gid,
                member.uname,
                member.gname,
                member.mtime,
                member.linkname,
                pax,
              ]),
              newline
            )
          );
          if (regular) {
            const payload = createSha256();
            const consumed = yield* reader.consume(member.size, (chunk) => {
              payload.update(chunk);
            });
            if (consumed !== member.size) return yield* refuse("archive-read-failed");
            const padding = blockLength(member.size) - member.size;
            if ((yield* reader.take(padding)).length !== padding) return yield* refuse("archive-read-failed");
            const payloadDigest = payload.digest();
            group.files += 1;
            group.bytes += consumed;
            group.content.update(concatBytes(identity, payloadDigest));
            if (label === fileDetailGroup) {
              if (fileRows.length >= limits.fileDetailEntries) return yield* refuse("file-detail-entry-bound");
              const row: CacheDependencyDiagnosticFileRow = [
                sha256Hex(utf8.encode(member.name)),
                fileKind(member.name),
                consumed,
                Sha256Hex.make(Hex.encode(payloadDigest)),
              ];
              fileDetailBytes += encodeCacheDiagnosticJson(row).length + 1;
              if (fileDetailBytes > limits.fileDetailBytes) return yield* refuse("file-detail-byte-bound");
              fileRows.push(row);
            }
          } else {
            group.content.update(identity);
          }
          if (symlink) {
            if (utf8.encode(member.linkname).length > limits.headerBytes) return yield* refuse("archive-link-bound");
            // Link text is hashed but never traversed or emitted.
            group.links.update(concatBytes(identity, encodeCacheDiagnosticJson(member.linkname), newline));
          }
        }
        yield* reader.drain;
        const remaining = deadline - (yield* Clock.currentTimeMillis);
        if (remaining <= 0) return yield* refuse("deadline");
        const exitCode = yield* handle.exitCode.pipe(
          Effect.timeoutOrElse({ duration: Duration.millis(remaining), orElse: () => refuse("subprocess-deadline") })
        );
        if (exitCode !== 0) return yield* refuse("archive-command-failed");
        const rows = A.map(
          A.sort(
            A.fromIterable(groups),
            Order.mapInput(Order.String, ([label]: readonly [string, GroupState]) => label)
          ),
          ([, group]): CacheDependencyDiagnosticGroupRow => [
            group.label,
            group.entries,
            group.files,
            group.bytes,
            digestHex(group.content),
            digestHex(group.mode),
            digestHex(group.links),
            digestHex(group.headers),
          ]
        );
        return CacheDependencyDiagnosticSnapshot.make({
          sha256: reader.digest(),
          archiveBytes: reader.bytes(),
          groups: rows,
          ...(A.isReadonlyArrayNonEmpty(fileRows)
            ? {
                fileDetails: CacheDependencyDiagnosticFileDetails.make({
                  group: "node-gyp",
                  columns: ["nameSha256", "kind", "bytes", "contentSha256"],
                  rows: fileRows,
                  entryLimit: limits.fileDetailEntries,
                  encodedBytesLimit: limits.fileDetailBytes,
                }),
              }
            : {}),
        });
      })
    );
  },
  Effect.catchTag("PlatformError", () => refuse("filesystem-or-process-failed"))
);

// ---------------------------------------------------------------------------
// Observation and publication.
// ---------------------------------------------------------------------------

const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const invalidShape = () => CacheDependencyDiagnosticRefusal.make({ code: "invalid-value-or-shape" });
// Missing keys and non-object containers both refuse as invalid values, like Python KeyError/TypeError.
const field = (value: unknown, key: string): Effect.Effect<unknown, CacheDependencyDiagnosticRefusal> =>
  isJsonObject(value) ? Effect.fromOption(invalidShape)(R.get(value, key)) : Effect.fail(invalidShape());
const requireString = (value: unknown): Effect.Effect<string, CacheDependencyDiagnosticRefusal> =>
  P.isString(value) ? Effect.succeed(value) : Effect.fail(invalidShape());
const indexRows = (
  rows: ReadonlyArray<CacheDependencyDiagnosticGroupRow>
): Record<string, CacheDependencyDiagnosticGroupRow> => R.fromEntries(A.map(rows, (row) => [row[0], row]));
const groupRowEquivalence = S.toEquivalence(S.NullOr(CacheDependencyDiagnosticGroupRow));
const snapshotEquivalence = S.toEquivalence(CacheDependencyDiagnosticSnapshot);

/**
 * Hooks a test can use to change the tree or source between and after the two passes.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export interface CacheDependencyDiagnosticHooks {
  readonly afterFirstPass?: Effect.Effect<void> | undefined;
  readonly afterSecondPass?: Effect.Effect<void> | undefined;
}

/**
 * Run two bounded archive passes and compare them with the selected source report.
 *
 * **Details**
 *
 * Returns the canonical report bytes (trailing newline included) and the
 * process exit status: `0` only for a `stable-match`. The source report plus
 * the diagnostic must fit the aggregate artifact cap or the run refuses.
 *
 * **Example** (Plan an observation)
 *
 * ```ts
 * import { observeCacheDependencies } from "@beep/repo-cli/test/Cache"
 * import { CacheDependencyDiagnosticLimits } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * const run = observeCacheDependencies("/repo", "report.json", "a".repeat(40), CacheDependencyDiagnosticLimits.make({}))
 * console.assert(Effect.isEffect(run))
 * ```
 *
 * @internal
 * @param root - Directory containing the physical `node_modules` tree.
 * @param source - Producer inspection report path.
 * @param revision - Expected source revision.
 * @param limits - Diagnostic bounds.
 * @param hooks - Optional test hooks run after each pass.
 * @returns The canonical report bytes and exit status.
 * @category commands
 * @since 0.0.0
 */
export const observeCacheDependencies = Effect.fn("CacheDiagnostics.observe")(function* (
  root: string,
  source: string,
  revision: string,
  limits: CacheDependencyDiagnosticLimits,
  hooks: CacheDependencyDiagnosticHooks = {}
) {
  const started = yield* Clock.currentTimeMillis;
  const deadline = started + Duration.toMillis(Duration.seconds(limits.deadlineSeconds));
  const sourceBytes = yield* readCacheDiagnosticSource(source, limits);
  const parsed = yield* decodeText(sourceBytes).pipe(
    Effect.flatMap(decodeJson),
    Effect.mapError(() => CacheDependencyDiagnosticRefusal.make({ code: "invalid-value-or-shape" }))
  );
  if ((yield* field(parsed, "schemaVersion")) !== "cache-producer-workflow/v2") return yield* refuse("source-version");
  const sourceRevision = yield* field(parsed, "revision").pipe(Effect.flatMap(requireString));
  if (!hex40.test(sourceRevision)) return yield* refuse("source-revision");
  if (sourceRevision !== revision) return yield* refuse("source-revision-mismatch");
  const declared = yield* field(parsed, "toolchain").pipe(
    Effect.flatMap((toolchain) => field(toolchain, "installedDependencies"))
  );
  if ((yield* field(declared, "format")) !== "canonical-gnu-tar/v1") return yield* refuse("dependency-format");
  const declaredDigest = yield* field(declared, "sha256").pipe(Effect.flatMap(requireString));
  if (!hex64.test(declaredDigest)) return yield* refuse("dependency-digest");
  const first = yield* snapshotCacheDependencies(root, deadline, limits);
  yield* hooks.afterFirstPass ?? Effect.void;
  const second = yield* snapshotCacheDependencies(root, deadline, limits);
  yield* hooks.afterSecondPass ?? Effect.void;
  const before = indexRows(first.groups);
  const after = indexRows(second.groups);
  const changed = A.sort(
    A.filter(A.dedupe([...R.keys(before), ...R.keys(after)]), (key) => {
      const left = O.getOrNull(R.get(before, key));
      const right = O.getOrNull(R.get(after, key));
      return !groupRowEquivalence(left, right);
    }),
    Order.String
  );
  const stable = snapshotEquivalence(first, second);
  const matched = first.sha256 === declaredDigest;
  const unchanged = yield* compareCacheDiagnosticSource(source, sourceBytes, limits);
  const elapsed = ((yield* Clock.currentTimeMillis) - started) / 1000;
  const report = CacheDependencyDiagnosticReport.make({
    schemaVersion: "cache-dependency-diagnostics/v1",
    authority: "Observation only; no producer approval, qualification or digest normalization.",
    revision: sourceRevision,
    sourceReportSha256: sha256Hex(sourceBytes),
    declaredSha256: Sha256Hex.make(declaredDigest),
    status: stable && matched && unchanged ? "stable-match" : "refused-drift",
    sourceUnchanged: unchanged,
    declaredDigestMatches: matched,
    snapshotsEqual: stable,
    columns: ["package", "entries", "files", "bytes", "contentSha256", "modeSha256", "linksSha256", "headersSha256"],
    first,
    second: CacheDependencyDiagnosticSecondPass.make({
      sha256: second.sha256,
      archiveBytes: second.archiveBytes,
      changedGroups: A.map(A.take(changed, changedGroupLimit), (key) => [key, O.getOrNull(R.get(after, key))] as const),
      changedCount: changed.length,
      omittedChanges: Math.max(0, changed.length - changedGroupLimit),
    }),
    bounds: CacheDependencyDiagnosticBounds.make({
      aggregateArtifactBytes: limits.artifactBytes,
      archiveBytesPerPass: limits.streamBytes,
      passes: 2,
      entriesPerPass: limits.entries,
      groupsPerPass: limits.groups,
      seconds: limits.deadlineSeconds,
      retentionDays: 1,
    }),
    elapsedSeconds: Math.round(elapsed * 1000) / 1000,
  });
  const encoded = yield* S.encodeEffect(CacheDependencyDiagnosticReport)(report).pipe(
    Effect.mapError(() => CacheDependencyDiagnosticRefusal.make({ code: "invalid-value-or-shape" }))
  );
  const bytes = concatBytes(encodeCacheDiagnosticJson(encoded), newline);
  if (sourceBytes.length + bytes.length > limits.artifactBytes) return yield* refuse("aggregate-artifact-bound");
  return [bytes, report.status === "stable-match" ? 0 : 1] as const;
});

/**
 * Encode a refusal report for a fixed code.
 *
 * **Example** (Encode a deadline refusal)
 *
 * ```ts
 * import { encodeCacheDiagnosticRefusal } from "@beep/repo-cli/test/Cache"
 * const text = new TextDecoder().decode(encodeCacheDiagnosticRefusal("deadline"))
 * console.assert(text === '{"code":"deadline","schemaVersion":"cache-dependency-diagnostics/v1","status":"refused"}\n')
 * ```
 *
 * @internal
 * @param code - Fixed refusal code.
 * @returns Canonical refusal bytes with a trailing newline.
 * @category encoding
 * @since 0.0.0
 */
export const encodeCacheDiagnosticRefusal = (code: CacheDependencyDiagnosticCode): Uint8Array => {
  const report = CacheDependencyDiagnosticRefusalReport.make({
    schemaVersion: "cache-dependency-diagnostics/v1",
    status: "refused",
    code,
  });
  return concatBytes(
    encodeCacheDiagnosticJson({ schemaVersion: report.schemaVersion, status: report.status, code: report.code }),
    newline
  );
};

const publicationSize = Effect.fnUntraced(
  function* (fs: FileSystem.FileSystem, file: string) {
    const size = yield* regularFileSize(fs, file);
    if (O.isNone(size)) return O.none<number>();
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* fs.open(file, { flag: "r", noFollow: true });
        const info = yield* handle.stat;
        return info.type === "File" && Number(info.size) > 0 ? O.some(Number(info.size)) : O.none<number>();
      })
    );
  },
  Effect.orElseSucceed(O.none<number>)
);

/**
 * Select only readable regular reports whose retained bytes fit the aggregate cap.
 *
 * **Details**
 *
 * Metadata only: it never reads payloads or repeats an archive pass, so a
 * refused diagnostic still publishes whichever reports fit.
 *
 * **Example** (Plan a publication check)
 *
 * ```ts
 * import { planCacheDiagnosticPublication } from "@beep/repo-cli/test/Cache"
 * import { CacheDependencyDiagnosticLimits } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * const plan = planCacheDiagnosticPublication("report.json", "dependencies.json", CacheDependencyDiagnosticLimits.make({}))
 * console.assert(Effect.isEffect(plan))
 * ```
 *
 * @internal
 * @param source - Producer inspection report path.
 * @param diagnostic - Dependency diagnostic path.
 * @param limits - Diagnostic bounds.
 * @returns Which reports may be published.
 * @category queries
 * @since 0.0.0
 */
export const planCacheDiagnosticPublication = Effect.fn("CacheDiagnostics.publicationPlan")(function* (
  source: string,
  diagnostic: string,
  limits: CacheDependencyDiagnosticLimits
) {
  const fs = yield* FileSystem.FileSystem;
  const sourceSize = yield* publicationSize(fs, source);
  const diagnosticSize = yield* publicationSize(fs, diagnostic);
  const fits = (size: number) => size <= limits.artifactBytes;
  const diagnosticFits = O.exists(diagnosticSize, fits);
  const sourceFits = O.exists(
    sourceSize,
    (size) => fits(size) && (!diagnosticFits || size + O.getOrElse(diagnosticSize, () => 0) <= limits.artifactBytes)
  );
  return CacheDependencyPublicationPlan.make({ source: sourceFits, diagnostic: diagnosticFits });
});

/**
 * Write a diagnostic to a new private output, refusing any existing file.
 *
 * **Details**
 *
 * The output is created exclusively with mode `0600` before any expensive
 * read, so earlier evidence is never replaced. Refusals are retained as a
 * fixed-code report. Returns the exit status, or `None` when the output could
 * not be created.
 *
 * **Example** (Plan a diagnostic write)
 *
 * ```ts
 * import { writeCacheDependencyDiagnostic } from "@beep/repo-cli/test/Cache"
 * import { CacheDependencyDiagnosticLimits } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * const run = writeCacheDependencyDiagnostic("/repo", "report.json", "out.json", "a".repeat(40), CacheDependencyDiagnosticLimits.make({}))
 * console.assert(Effect.isEffect(run))
 * ```
 *
 * @internal
 * @param root - Directory containing the physical `node_modules` tree.
 * @param source - Producer inspection report path.
 * @param output - New diagnostic output path.
 * @param revision - Expected source revision.
 * @param limits - Diagnostic bounds.
 * @param hooks - Optional test hooks run after each pass.
 * @returns The exit status, or `None` when the output already existed or was unavailable.
 * @category commands
 * @since 0.0.0
 */
export const writeCacheDependencyDiagnostic = Effect.fn("CacheDiagnostics.write")(function* (
  root: string,
  source: string,
  output: string,
  revision: string,
  limits: CacheDependencyDiagnosticLimits,
  hooks: CacheDependencyDiagnosticHooks = {}
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const opened = yield* fs.open(output, { flag: "wx", mode: 0o600, noFollow: true }).pipe(Effect.option);
      if (O.isNone(opened)) return O.none<number>();
      const [bytes, exitCode] = yield* observeCacheDependencies(root, source, revision, limits, hooks).pipe(
        Effect.catchTag("CacheDependencyDiagnosticRefusal", ({ code }) =>
          Effect.succeed([encodeCacheDiagnosticRefusal(code), 1] as const)
        )
      );
      yield* opened.value.writeAll(bytes);
      return O.some(exitCode);
    })
  );
});

/**
 * Default diagnostic bounds: 4 MiB artifact, 6 GiB stream, 600k entries, 300 s.
 *
 * **Example** (Read the default deadline)
 *
 * ```ts
 * import { defaultCacheDependencyDiagnosticLimits } from "@beep/repo-cli/commands/Cache"
 * console.assert(defaultCacheDependencyDiagnosticLimits.deadlineSeconds === 300)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultCacheDependencyDiagnosticLimits = CacheDependencyDiagnosticLimits.make({});
