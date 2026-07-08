/**
 * Windows Recycle Bin `$I` metadata parsing and `$I`/`$R` pairing helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { DateTime, Effect, Match, MutableHashMap, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CorpusCommandError } from "./Corpus.errors.js";
import { RecycleBinOriginal, RecycleBinPairedEntry, RecycleBinPairing } from "./Corpus.schemas.js";
import type { RecycleBinEntryKind, RecycleBinScanEntry } from "./Corpus.schemas.js";

const headerBytes = 24;
const v1PathBytes = 520;
const v2PathLengthOffset = 24;
const v2PathOffset = 28;
const filetimeUnixEpochDiff = BigInt("116444736000000000");
const filetimeTicksPerMillisecond = BigInt(10_000);
const maxDateMilliseconds = BigInt(8_640_000_000_000_000);
const recycleBinNamePattern = /^\$([IR])([^.]+.*)$/u;
const utf16Decoder = new TextDecoder("utf-16le");

const decodeRecycleBinOriginal = S.decodeUnknownEffect(RecycleBinOriginal);

const metadataParseError = (message: string): CorpusCommandError =>
  CorpusCommandError.make({ message: `Invalid $I recycle-bin metadata: ${message}` });

const readUtf16PathUntilNul = (bytes: Uint8Array): string => {
  const decoded = utf16Decoder.decode(bytes);
  const nulIndex = decoded.indexOf("\u0000");
  return nulIndex === -1 ? decoded : decoded.slice(0, nulIndex);
};

const filetimeToIso = (filetime: bigint): Effect.Effect<string, CorpusCommandError> => {
  const epochMilliseconds = (filetime - filetimeUnixEpochDiff) / filetimeTicksPerMillisecond;
  return epochMilliseconds > maxDateMilliseconds || epochMilliseconds < -maxDateMilliseconds
    ? Effect.fail(metadataParseError(`deletion FILETIME ${filetime} is outside the representable date range`))
    : Effect.succeed(DateTime.formatIso(DateTime.makeUnsafe(Number(epochMilliseconds))));
};

const originalNameFromPath = (originalPath: string): string =>
  pipe(
    originalPath,
    Str.split(/[\\/]/u),
    A.filter(Str.isNonEmpty),
    A.last,
    O.getOrElse(() => originalPath)
  );

const v1Path = (bytes: Uint8Array): Effect.Effect<string, CorpusCommandError> =>
  bytes.length < headerBytes + v1PathBytes
    ? Effect.fail(metadataParseError(`v1 record needs ${headerBytes + v1PathBytes} bytes, found ${bytes.length}`))
    : Effect.succeed(readUtf16PathUntilNul(bytes.subarray(headerBytes, headerBytes + v1PathBytes)));

const v2Path = (bytes: Uint8Array, view: DataView): Effect.Effect<string, CorpusCommandError> => {
  if (bytes.length < v2PathOffset) {
    return Effect.fail(metadataParseError(`v2 record needs at least ${v2PathOffset} bytes, found ${bytes.length}`));
  }
  const pathCharacters = view.getUint32(v2PathLengthOffset, true);
  const pathEnd = v2PathOffset + pathCharacters * 2;
  return bytes.length < pathEnd
    ? Effect.fail(
        metadataParseError(`v2 record declares ${pathCharacters} path characters but holds ${bytes.length} bytes`)
      )
    : Effect.succeed(readUtf16PathUntilNul(bytes.subarray(v2PathOffset, pathEnd)));
};

/**
 * Parse one `$I` recycle-bin metadata file into its recovered original facts.
 *
 * Supports format v1 (Windows Vista-8.1, fixed 520-byte path) and v2
 * (Windows 10+, length-prefixed path).
 *
 * @effects Parses the supplied bytes in memory and fails with `CorpusCommandError` for invalid metadata; it does not read or write files.
 * @example
 * ```ts
 * import { parseRecycleBinMetadata } from "@beep/repo-cli/commands/Corpus"
 * import { Effect } from "effect"
 *
 * const path = "C:\\Clients\\spec.docx"
 * const bytes = new Uint8Array(28 + (path.length + 1) * 2)
 * const view = new DataView(bytes.buffer)
 * view.setBigUint64(0, 2n, true)
 * view.setBigUint64(8, 11n, true)
 * view.setBigUint64(16, 133_600_000_000_000_000n, true)
 * view.setUint32(24, path.length + 1, true)
 * Array.from(path).forEach((char, index) => view.setUint16(28 + index * 2, char.charCodeAt(0), true))
 *
 * Effect.runPromise(parseRecycleBinMetadata(bytes)).then((original) => console.log(original.originalName)) // "spec.docx"
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const parseRecycleBinMetadata = Effect.fn("Corpus.parseRecycleBinMetadata")(function* (bytes: Uint8Array) {
  if (bytes.length < headerBytes) {
    return yield* metadataParseError(`record needs at least ${headerBytes} header bytes, found ${bytes.length}`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rawVersion = view.getBigUint64(0, true);
  const originalSize = view.getBigUint64(8, true);
  const filetime = view.getBigUint64(16, true);

  if (originalSize > BigInt(Number.MAX_SAFE_INTEGER)) {
    return yield* metadataParseError(`original size ${originalSize} exceeds the safe integer range`);
  }

  const versionAndPath = yield* Match.value(rawVersion).pipe(
    Match.when(BigInt(1), () => v1Path(bytes).pipe(Effect.map((path) => ({ path, version: "v1" as const })))),
    Match.when(BigInt(2), () => v2Path(bytes, view).pipe(Effect.map((path) => ({ path, version: "v2" as const })))),
    Match.orElse(() => Effect.fail(metadataParseError(`unsupported format version ${rawVersion}`)))
  );

  if (Str.isEmpty(versionAndPath.path)) {
    return yield* metadataParseError("recovered original path is empty");
  }

  const deletedAtIso = yield* filetimeToIso(filetime);

  return yield* decodeRecycleBinOriginal({
    deletedAtFiletime: filetime.toString(),
    deletedAtIso,
    originalName: originalNameFromPath(versionAndPath.path),
    originalPath: versionAndPath.path,
    originalSizeBytes: Number(originalSize),
    version: versionAndPath.version,
  }).pipe(CorpusCommandError.mapError("Recovered $I fields failed schema validation"));
});

/**
 * Classify a file name as a `$I` metadata or `$R` content artifact.
 *
 * The pair key is the shared suffix after the `$I`/`$R` prefix (random token
 * plus original extension), which is what Windows keeps identical across a
 * deleted file's metadata/content pair.
 *
 * @param fileName - Base file name to classify.
 * @returns The artifact kind and pair key, or none for non-recycle-bin names.
 * @example
 * ```ts
 * import { classifyRecycleBinName } from "@beep/repo-cli/commands/Corpus"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(classifyRecycleBinName("$I0CB4M9.docx"))) // true
 * console.log(O.isNone(classifyRecycleBinName("README.md"))) // true
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const classifyRecycleBinName = (
  fileName: string
): O.Option<{ readonly kind: RecycleBinEntryKind; readonly pairKey: string }> =>
  pipe(
    O.fromNullishOr(recycleBinNamePattern.exec(fileName)),
    O.map((match) => ({
      kind: match[1] === "I" ? ("metadata" as const) : ("content" as const),
      pairKey: match[2] ?? "",
    })),
    O.filter((entry) => Str.isNonEmpty(entry.pairKey))
  );

/**
 * Pair `$I` metadata entries with `$R` content entries on their pair key.
 *
 * Entries sharing a pair key with both kinds present join into a matched
 * pair; leftovers land in the unmatched buckets. Callers scope pair keys
 * (for example by parent directory) before invoking.
 *
 * @param entries - Scan entries to pair.
 * @returns Matched pairs plus unmatched metadata and content leftovers.
 * @example
 * ```ts
 * import { pairRecycleBinEntries, RecycleBinScanEntry } from "@beep/repo-cli/commands/Corpus"
 *
 * const pairing = pairRecycleBinEntries([
 *   RecycleBinScanEntry.make({ kind: "metadata", pairKey: "A1.docx", relativePath: "$IA1.docx" }),
 *   RecycleBinScanEntry.make({ kind: "content", pairKey: "A1.docx", relativePath: "$RA1.docx" }),
 *   RecycleBinScanEntry.make({ kind: "content", pairKey: "B2.pdf", relativePath: "$RB2.pdf" })
 * ])
 *
 * console.log(`${pairing.matched.length},${pairing.unmatchedContent.length}`) // "1,1"
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const pairRecycleBinEntries = (entries: ReadonlyArray<RecycleBinScanEntry>): RecycleBinPairing => {
  const sorted = A.sort(
    entries,
    Order.mapInput(Str.Order, (entry: RecycleBinScanEntry) => entry.relativePath)
  );
  const metadataByKey = MutableHashMap.empty<string, RecycleBinScanEntry>();
  const contentByKey = MutableHashMap.empty<string, RecycleBinScanEntry>();
  const overflow: Array<RecycleBinScanEntry> = [];

  for (const entry of sorted) {
    const bucket = entry.kind === "metadata" ? metadataByKey : contentByKey;
    if (MutableHashMap.has(bucket, entry.pairKey)) {
      overflow.push(entry);
    } else {
      MutableHashMap.set(bucket, entry.pairKey, entry);
    }
  }

  const matched: Array<RecycleBinPairedEntry> = [];
  const unmatchedMetadata: Array<RecycleBinScanEntry> = [];
  const unmatchedContent: Array<RecycleBinScanEntry> = [];

  for (const [pairKey, metadata] of metadataByKey) {
    const content = O.getOrUndefined(MutableHashMap.get(contentByKey, pairKey));
    if (content === undefined) {
      unmatchedMetadata.push(metadata);
    } else {
      MutableHashMap.remove(contentByKey, pairKey);
      matched.push(
        RecycleBinPairedEntry.make({
          contentRelativePath: content.relativePath,
          metadataRelativePath: metadata.relativePath,
          pairKey,
        })
      );
    }
  }

  for (const content of MutableHashMap.values(contentByKey)) {
    unmatchedContent.push(content);
  }
  for (const entry of overflow) {
    (entry.kind === "metadata" ? unmatchedMetadata : unmatchedContent).push(entry);
  }

  return RecycleBinPairing.make({
    matched: A.sort(
      matched,
      Order.mapInput(Str.Order, (pair: RecycleBinPairedEntry) => pair.pairKey)
    ),
    unmatchedContent: A.sort(
      unmatchedContent,
      Order.mapInput(Str.Order, (entry: RecycleBinScanEntry) => entry.relativePath)
    ),
    unmatchedMetadata: A.sort(
      unmatchedMetadata,
      Order.mapInput(Str.Order, (entry: RecycleBinScanEntry) => entry.relativePath)
    ),
  });
};
