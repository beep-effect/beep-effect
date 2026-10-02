/**
 * Preserve selected task text across grouped native Turbo output.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Buffer } from "node:buffer";
import { zstdDecompressSync } from "node:zlib";
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Header } from "tar";
import { CacheSignedPilotArchive, CacheSignedPilotCaptureControl } from "./Cache.pilot.signed.schemas.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CachePilotLogInput, CacheSignedPilotLogInput } from "./Cache.pilot.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.pilot.capture");
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const archiveLogPath = "packages/foundation/modeling/identity/.turbo/turbo-lint.log";
const ArchiveLogSize = S.Natural.check(S.isLessThanOrEqualTo(64 * 1024)).annotate(
  $I.annote("ArchiveLogSize", { description: "The native pilot log's maximum uncompressed byte count." })
);
const ArchiveLogHeader = S.Struct({
  cksumValid: S.Literal(true),
  nullBlock: S.Literal(false),
  needPax: S.Literal(false),
  type: S.Literal("File"),
  path: S.Literal(archiveLogPath),
  linkpath: S.optionalKey(S.Union([S.Undefined, S.Literal("")])),
  size: ArchiveLogSize,
}).annotate(
  $I.annote("ArchiveLogHeader", {
    description: "Exact bounded regular task-log header accepted from a native signed archive.",
  })
);
const isArchiveLogHeader = S.is(ArchiveLogHeader);

/**
 * Inspect a native zstd archive without extracting any file.
 *
 * **Details**
 * Accepts the pilot's exact single-file tar layout, including zero padding and
 * two terminating blocks. Metadata, links, additional entries and trailing
 * bytes fail. Decompression is bounded before header inspection. Synthetic
 * credentials are checked over all decoded bytes, including header fields.
 * The caller must join the resulting archive identity to native wire evidence.
 *
 * **Example** (Reference the bounded archive inspector)
 * ```ts
 * import { inspectCacheSignedPilotArchive } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof inspectCacheSignedPilotArchive === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const inspectCacheSignedPilotArchive = Effect.fn("CachePilot.inspectSignedArchive")(function* (
  archive: Uint8Array,
  secrets: ReadonlyArray<Redacted.Redacted<string>>
) {
  if (archive.byteLength === 0 || archive.byteLength > 1024 * 1024)
    return yield* CacheCommandError.new("Signed pilot archive exceeds its compressed bound.");
  const bytes = yield* Effect.try({
    try: () => zstdDecompressSync(archive, { maxOutputLength: 128 * 1024 }),
    catch: () => CacheCommandError.new("Signed pilot archive decompression failed or exceeded its bound."),
  });
  if (bytes.byteLength < 1536)
    return yield* CacheCommandError.new("Signed pilot archive lacks its complete tar framing.");
  const header = yield* Effect.try({
    try: () => new Header(Buffer.from(bytes.subarray(0, 512))),
    catch: () => CacheCommandError.new("Signed pilot archive header is invalid."),
  });
  if (!isArchiveLogHeader(header))
    return yield* CacheCommandError.new("Signed pilot archive is not its expected bounded regular task log.");
  const size = header.size;
  const framedBytes = 512 + Math.ceil(size / 512) * 512 + 1024;
  if (bytes.byteLength !== framedBytes || bytes.subarray(512 + size).some((byte) => byte !== 0))
    return yield* CacheCommandError.new("Signed pilot archive has extra entries, metadata or nonzero padding.");
  const decoded = new TextDecoder().decode(bytes);
  if (A.some(secrets, (secret) => Str.includes(Redacted.value(secret))(decoded)))
    return yield* CacheCommandError.new("Signed pilot archive contains synthetic credential material.");
  return CacheSignedPilotArchive.make({
    archiveSha256: yield* hashBytes(archive),
    archiveBytes: archive.byteLength,
    decodedBytes: bytes.byteLength,
    path: archiveLogPath,
    logSha256: yield* hashBytes(bytes.subarray(512, 512 + size)),
    logBytes: size,
  });
});
const UnambiguousTerminalText = S.String.check(S.isPattern(/^[^\x00-\x08\x0b-\x1f\x7f\ufffd]*$/u)).pipe(
  $I.annoteSchema("UnambiguousTerminalText", {
    description: "Terminal text without carriage returns, escape/control bytes or replacement characters.",
  })
);
const isUnambiguous = S.is(UnambiguousTerminalText);

const validatePilotStreams = Effect.fn("CachePilot.validateStreams")(function* (
  input: CachePilotLogInput | CacheSignedPilotLogInput
) {
  if (
    input.truncated ||
    new TextEncoder().encode(input.stdout).byteLength > 1024 * 1024 ||
    new TextEncoder().encode(input.stderr).byteLength > 1024 * 1024 ||
    !isUnambiguous(input.stdout) ||
    !isUnambiguous(input.stderr)
  )
    return yield* CacheCommandError.new(
      "Pilot process streams are truncated, oversized or contain ambiguous terminal text."
    );
  if (!input.cacheEnabled && input.origin !== "fresh")
    return yield* CacheCommandError.new("A disabled pilot task cannot be a cache hit.");
});

const extractPilotLog = Effect.fn("CachePilot.extractLog")(function* (
  input: CachePilotLogInput | CacheSignedPilotLogInput
) {
  yield* validatePilotStreams(input);
  const prefix = `${Str.replace("#", ":")(input.computation)}: `;
  const selectedLines = pipe(
    A.fromIterable(Str.linesWithSeparators(input.stdout)),
    A.filter(Str.startsWith(prefix)),
    A.map(Str.slice(prefix.length))
  );
  if (A.some(A.fromIterable(Str.linesWithSeparators(input.stderr)), Str.startsWith(prefix)))
    return yield* CacheCommandError.new(
      "Selected pilot output unexpectedly appeared on the orchestration error stream."
    );
  const progress =
    input.origin !== "fresh"
      ? `cache hit, replaying logs ${input.taskHash}\n`
      : input.cacheEnabled
        ? `cache miss, executing ${input.taskHash}\n`
        : `cache bypass, force executing ${input.taskHash}\n`;
  if (!O.contains(progress)(A.head(selectedLines))) {
    if (O.contains(`cache bypass, force executing ${input.taskHash}\n`)(A.head(selectedLines)))
      return yield* CacheCommandError.new(
        "Selected pilot output reports a cache bypass instead of its expected boundary."
      );
    return yield* CacheCommandError.new("Selected pilot output is missing its exact native progress boundary.");
  }
  const text = A.join(A.drop(selectedLines, 1), "");
  if (new TextEncoder().encode(text).byteLength > 64 * 1024)
    return yield* CacheCommandError.new("Selected pilot task log exceeded its 64 KiB bound.");
  return text;
});

/**
 * Remove only the selected task's first, exactly matched Turbo progress line.
 *
 * **Details**
 * Requires native grouped output with task prefixes and separate streams.
 * Later task text is preserved verbatim, even if it resembles progress output.
 * Empty/missing groups, truncated streams and ambiguous control text fail.
 * Other tasks' prefixed output cannot become selected-task evidence.
 *
 * **Example** (Preserve task text that resembles orchestration)
 *
 * ```ts
 * import { CachePilotLogInput } from "@beep/repo-cli/commands/Cache"
 * import { extractCachePilotLog } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const input = CachePilotLogInput.make({
 *   computation: "@beep/identity#lint", taskHash: "0123456789abcdef",
 *   origin: "fresh", cacheEnabled: false, truncated: false, stderr: "",
 *   stdout: "@beep/identity:lint: cache bypass, force executing 0123456789abcdef\n" +
 *     "@beep/identity:lint: cache miss, executing 0123456789abcdef\n",
 * })
 * console.assert(Effect.isEffect(extractCachePilotLog(input)))
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const extractCachePilotLog = Effect.fn("CachePilot.extractLocalLog")(function* (input: CachePilotLogInput) {
  return yield* extractPilotLog(input);
});

/**
 * Preserve signed pilot task text using the same bounded grouped-output parser.
 *
 * **Details**
 * The caller must independently establish remote origin from native summaries
 * and direct wire/storage evidence. Log text itself cannot prove a remote hit.
 *
 * **Example** (Reference the signed capture boundary)
 * ```ts
 * import { extractCacheSignedPilotLog } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof extractCacheSignedPilotLog === "function")
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const extractCacheSignedPilotLog = Effect.fn("CachePilot.extractSignedLog")(function* (
  input: CacheSignedPilotLogInput
) {
  return yield* extractPilotLog(input);
});

/**
 * Fixed rejection required from each native capture adversary.
 *
 * **Example** (Inspect an oversized-log rejection)
 * ```ts
 * import { cacheSignedCaptureDiagnostic } from "@beep/repo-cli/test/Cache"
 * console.assert(cacheSignedCaptureDiagnostic("oversized-log").includes("64 KiB"))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const cacheSignedCaptureDiagnostic = CacheSignedPilotCaptureControl.fields.case.$match({
  "credential-output": () => "Signed pilot capture contains synthetic credential material.",
  "terminal-control": () => "Pilot process streams are truncated, oversized or contain ambiguous terminal text.",
  "oversized-log": () => "Selected pilot task log exceeded its 64 KiB bound.",
  "undeclared-output": () => "Pilot produced an undeclared persistent output beside its replay log.",
});
