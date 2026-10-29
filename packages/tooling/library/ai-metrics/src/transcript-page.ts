/**
 * Bounded incremental transcript pages with metadata-only output and proposed cursors.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Line } from "@beep/jsonl/Line";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseSourceEventTime } from "./internal/source-event-time.ts";
import { hashPrivateIdentifier } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("transcript-page");
const Offset = S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)).pipe(
  $I.annoteSchema("Offset", { description: "Exactly representable physical file byte offset or count." })
);
const Source = LiteralKit(["codex", "claude"]).pipe(
  $I.annoteSchema("Source", { description: "Supported transcript formats, not desktop/CLI coverage claims." })
);
const OptionalHash = S.OptionFromOptionalKey(Sha256Hex);
const Session = S.Struct({ id: OptionalHash, conflicted: S.Boolean }).pipe(
  $I.annoteSchema("Session", {
    description:
      "Explicit session evidence carried across pages, withdrawn permanently on conflict within a file generation.",
  })
);
const emptySession = () => Session.make({ id: O.none(), conflicted: false });

/**
 * Restartable source position; committing it requires durable acceptance of its page.
 *
 * **Example**
 * ```ts
 * import { TranscriptCursor } from "@beep/repo-ai-metrics/transcript-page"
 * import * as S from "effect/Schema"
 * console.log(S.is(TranscriptCursor)({})) // false
 * ```
 * **Details** Contains hashes and offsets only. Anchors detect observed replacement, truncation and rewrites near the prefix/cursor; they cannot prove absence of an unobserved rewrite elsewhere. Discard mode advances through an oversized line without retaining it.
 * @category models
 * @since 0.0.0
 */
export class TranscriptCursor extends S.Opaque<TranscriptCursor, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("transcript-cursor/v1"),
    source: Source,
    pathHash: Sha256Hex,
    namespaceId: Sha256Hex,
    fileIdentity: Sha256Hex,
    generationId: Sha256Hex,
    offset: Offset,
    lineNumber: Offset,
    prefixLength: Offset.check(S.isLessThanOrEqualTo(256)),
    prefixHash: Sha256Hex,
    anchorLength: Offset.check(S.isLessThanOrEqualTo(256)),
    anchorHash: Sha256Hex,
    discarding: S.Boolean,
    discardStart: Offset,
    session: Session,
  })
    .check(
      S.makeFilter((value) => value.anchorLength <= value.offset && value.discardStart <= value.offset, {
        identifier: "CursorBounds",
        title: "Cursor bounds",
        description: "Cursor anchors and discarded-line starts must be within consumed bytes.",
        message: "Invalid cursor bounds",
      })
    )
    .pipe(
      $I.annoteSchema("TranscriptCursor", { description: "Proposed source cursor, separate from export receipts." })
    )
) {}

const TokenCount = S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
const Usage = S.Struct({
  basis: S.Literals(["message", "last-request", "cumulative"]),
  input: S.OptionFromOptionalKey(TokenCount),
  output: S.OptionFromOptionalKey(TokenCount),
  cacheRead: S.OptionFromOptionalKey(TokenCount),
  cacheWrite: S.OptionFromOptionalKey(TokenCount),
}).pipe(
  $I.annoteSchema("Usage", {
    description: "Provider usage with its counting basis; absent counters are unknown, never inferred zero.",
  })
);

/**
 * Allowlisted metadata from one source record, with no prompt or tool payload.
 *
 * **Example**
 * ```ts
 * import { TranscriptMetadata } from "@beep/repo-ai-metrics/transcript-page"
 * import * as S from "effect/Schema"
 * console.log(S.is(TranscriptMetadata)({})) // false
 * ```
 * **Details** Logical message IDs are grouping evidence, not unique event IDs: streamed updates may share them. Model and working-directory values remain hashes. Cumulative usage must not be summed as per-request usage.
 * @category models
 * @since 0.0.0
 */
export class TranscriptMetadata extends S.Opaque<TranscriptMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.Literals(["session", "message", "tool-call", "tool-result", "usage", "other"]),
    session: Session,
    logicalMessageId: OptionalHash,
    workingDirectoryHash: OptionalHash,
    modelHash: OptionalHash,
    sourceTime: S.OptionFromOptionalKey(
      S.String.check(
        S.makeFilter((value) => O.isSome(parseSourceEventTime(value)), {
          identifier: "ValidSourceTime",
          title: "Valid source time",
          description: "Strict explicit-zone source timestamp within OTLP bounds.",
          message: "Invalid source time",
        })
      )
    ),
    usage: S.OptionFromOptionalKey(Usage),
  }).pipe(
    $I.annoteSchema("TranscriptMetadata", {
      description: "Positive metadata projection; arbitrary source strings never escape.",
    })
  )
) {}

/**
 * One physical source occurrence or an explicit rejection, never raw text.
 *
 * **Example**
 * ```ts
 * import { TranscriptFrame } from "@beep/repo-ai-metrics/transcript-page"
 * console.log(TranscriptFrame.cases.Accepted)
 * ```
 * **Details** Occurrence IDs distinguish repeated identical lines and copied files. Content hashes identify duplicate candidates without claiming they are the same logical event. Oversize rejection can span several pages with one occurrence ID.
 * @category models
 * @since 0.0.0
 */
export const TranscriptFrame = S.TaggedUnion({
  Accepted: {
    occurrenceId: Sha256Hex,
    start: Offset,
    end: Offset,
    contentHash: Sha256Hex,
    metadata: TranscriptMetadata,
  },
  Rejected: {
    occurrenceId: Sha256Hex,
    start: Offset,
    end: Offset,
    reason: S.Literals(["invalid-utf8", "invalid-json", "invalid-shape", "line-too-long", "blank"]),
    complete: S.Boolean,
  },
}).pipe(
  $I.annoteSchema("TranscriptFrame", { description: "Metadata or payload-free rejection for a bounded source range." })
);

/**
 * Bounded read budget and optional previously committed cursor.
 *
 * **Example**
 * ```ts
 * import { TranscriptPageInput } from "@beep/repo-ai-metrics/transcript-page"
 * import * as S from "effect/Schema"
 * console.log(S.is(TranscriptPageInput)({})) // false
 * ```
 * **Details** Private path and salt are ephemeral. Page size must exceed the line limit so growth can be classified without starvation. Reads never write the source or persist a cursor.
 * @category models
 * @since 0.0.0
 */
export class TranscriptPageInput extends S.Opaque<TranscriptPageInput, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    source: Source,
    hashSalt: S.Redacted(S.String),
    cursor: S.OptionFromOptionalKey(TranscriptCursor),
    maxBytes: S.Int.check(S.isBetween({ minimum: 2, maximum: 1_048_576 })),
    maxLineBytes: S.Int.check(S.isBetween({ minimum: 1, maximum: 262_144 })),
    maxFrames: S.Int.check(S.isBetween({ minimum: 1, maximum: 4096 })),
  })
    .check(
      S.makeFilter((value) => value.maxBytes > value.maxLineBytes, {
        identifier: "PageReadBounds",
        title: "Page read bounds",
        description: "A page must include one byte beyond the maximum line length.",
        message: "Page must exceed the line bound",
      })
    )
    .pipe($I.annoteSchema("TranscriptPageInput", { description: "Explicit bounded incremental read request." }))
) {}

/**
 * Proposed metadata page; its cursor is not an intake or backend acknowledgment.
 *
 * **Example**
 * ```ts
 * import { TranscriptPage } from "@beep/repo-ai-metrics/transcript-page"
 * import * as S from "effect/Schema"
 * console.log(S.is(TranscriptPage)({})) // false
 * ```
 * **Details** A reset reports observed identity changes. Partial tails remain unconsumed unless they exceed the line limit. The sampled end bounds the read even while the file grows.
 * @category models
 * @since 0.0.0
 */
export class TranscriptPage extends S.Opaque<TranscriptPage, { readonly brand: unique symbol }>()(
  S.Struct({
    cursor: TranscriptCursor,
    frames: S.Array(TranscriptFrame).check(S.isMaxLength(4096)),
    reset: S.Literals(["new", "none", "replaced", "truncated", "rewritten"]),
    sampledEnd: Offset,
    bytesRead: Offset,
    waitingForPartialLine: S.Boolean,
  }).pipe($I.annoteSchema("TranscriptPage", { description: "Safe source page and proposed cursor for atomic intake." }))
) {}

/**
 * Payload-free read failure: the caller retains its previous durable cursor.
 *
 * **Example**
 * ```ts
 * import { TranscriptPageError } from "@beep/repo-ai-metrics/transcript-page"
 * console.log(TranscriptPageError.make({ reason: "unavailable" }).reason)
 * ```
 * **Details** Filesystem and parse causes are never attached because they can contain paths or private source content.
 * @category errors
 * @since 0.0.0
 */
export class TranscriptPageError extends S.TaggedError<TranscriptPageError, { readonly brand: unique symbol }>(
  $I`TranscriptPageError`
)(
  "TranscriptPageError",
  {
    reason: S.Literals([
      "unavailable",
      "unstable",
      "identity-unavailable",
      "invalid-cursor",
      "missing-salt",
      "timed-out",
    ]),
  },
  $I.annote("TranscriptPageError", { description: "Safe failure of a bounded source read." })
) {
  override get message(): string {
    return `Transcript page read failed (${this.reason}).`;
  }
}

// Decode only fields used by the positive projection. Source payloads and text
// are not included, even temporarily, in any returned or persisted schema.
const Text = S.String.check(S.isMaxLength(4096));
const RawUsage = S.Struct({
  input_tokens: S.optionalKey(TokenCount),
  output_tokens: S.optionalKey(TokenCount),
  cached_input_tokens: S.optionalKey(TokenCount),
  cache_read_input_tokens: S.optionalKey(TokenCount),
  cache_creation_input_tokens: S.optionalKey(TokenCount),
});
const RawRecord = S.Struct({
  type: Text,
  timestamp: S.optionalKey(Text),
  sessionId: S.optionalKey(Text),
  cwd: S.optionalKey(Text),
  message: S.optionalKey(
    S.Struct({ id: S.optionalKey(Text), model: S.optionalKey(Text), usage: S.optionalKey(RawUsage) })
  ),
  payload: S.optionalKey(
    S.Struct({
      type: S.optionalKey(Text),
      id: S.optionalKey(Text),
      cwd: S.optionalKey(Text),
      model: S.optionalKey(Text),
      info: S.optionalKey(
        S.Struct({ last_token_usage: S.optionalKey(RawUsage), total_token_usage: S.optionalKey(RawUsage) })
      ),
    })
  ),
});
const safeTime = (value: string | undefined) =>
  O.fromUndefinedOr(value).pipe(
    O.flatMap(parseSourceEventTime),
    O.map((time) => time.text)
  );
const failure = (reason: TranscriptPageError["reason"]) => TranscriptPageError.make({ reason });

const project = Effect.fn("AiMetrics.projectTranscriptRecord")(function* (
  row: typeof RawRecord.Type,
  source: typeof Source.Type,
  session: typeof Session.Type,
  salt: string
) {
  const path = yield* Path.Path;
  const hash = (value: string) => hashPrivateIdentifier(value, O.some(salt));
  const hashOptional = (value: string | undefined) =>
    value === undefined || value === "" ? Effect.succeedNone : hash(value).pipe(Effect.asSome);
  const sessionId = source === "claude" ? row.sessionId : row.type === "session_meta" ? row.payload?.id : undefined;
  const candidate = yield* hashOptional(sessionId);
  const conflicted =
    session.conflicted || (O.isSome(session.id) && O.isSome(candidate) && session.id.value !== candidate.value);
  const nextSession = Session.make({ conflicted, id: conflicted ? O.none() : O.orElse(candidate, () => session.id) });
  const cwd = source === "claude" ? row.cwd : row.type === "session_meta" ? row.payload?.cwd : undefined;
  const payloadType = row.payload?.type;
  const kind: TranscriptMetadata["kind"] =
    row.type === "session_meta"
      ? "session"
      : row.type === "assistant" || row.type === "user" || payloadType === "message"
        ? "message"
        : payloadType === "function_call" || payloadType === "custom_tool_call"
          ? "tool-call"
          : payloadType === "function_call_output" || payloadType === "custom_tool_call_output"
            ? "tool-result"
            : payloadType === "token_count"
              ? "usage"
              : "other";
  const rawUsage =
    source === "claude" && row.type === "assistant"
      ? row.message?.usage
      : source === "codex" && row.type === "event_msg" && payloadType === "token_count"
        ? (row.payload?.info?.last_token_usage ?? row.payload?.info?.total_token_usage)
        : undefined;
  const usage =
    rawUsage === undefined
      ? O.none()
      : O.some(
          Usage.make({
            basis:
              source === "claude"
                ? "message"
                : row.payload?.info?.last_token_usage === undefined
                  ? "cumulative"
                  : "last-request",
            input: O.fromUndefinedOr(rawUsage.input_tokens),
            output: O.fromUndefinedOr(rawUsage.output_tokens),
            cacheRead: O.fromUndefinedOr(
              source === "claude" ? rawUsage.cache_read_input_tokens : rawUsage.cached_input_tokens
            ),
            cacheWrite: O.fromUndefinedOr(source === "claude" ? rawUsage.cache_creation_input_tokens : undefined),
          })
        );
  return TranscriptMetadata.make({
    kind,
    session: nextSession,
    sourceTime: safeTime(row.timestamp),
    usage,
    logicalMessageId: yield* hashOptional(
      source === "claude" ? row.message?.id : row.type === "response_item" ? row.payload?.id : undefined
    ),
    workingDirectoryHash: yield* hashOptional(
      cwd !== undefined && path.isAbsolute(cwd) ? path.normalize(cwd) : undefined
    ),
    modelHash: yield* hashOptional(source === "claude" ? row.message?.model : row.payload?.model),
  });
});

/**
 * Read a fixed-size source page through one pinned file handle.
 *
 * **Example**
 * ```ts
 * import { readTranscriptPage } from "@beep/repo-ai-metrics/transcript-page"
 * console.log(typeof readTranscriptPage) // function
 * ```
 * **Details** The call requests a ten-second cooperative timeout; its owning worker must enforce a hard process limit for uninterruptible platform I/O. Reads use at most 1 MiB per sampled page, re-read once for stability, plus at most 1281 anchor/boundary bytes, and at most 4096 frames. A cursor mismatch fails rather than adopting another source. Source bytes are never archived or returned. The caller must journal frames and cursor together before advancing; retries with the same cursor reproduce occurrence IDs.
 * @category services
 * @since 0.0.0
 */
export const readTranscriptPage = Effect.fn("AiMetrics.readTranscriptPage")(function* (input: TranscriptPageInput) {
  const salt = Redacted.value(input.hashSalt);
  if (Str.trim(salt) === "") return yield* failure("missing-salt");
  const program = Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const hash = (value: string) => hashPrivateIdentifier(value, O.some(salt));
      const hashBytes = (bytes: Uint8Array) => hash(Hex.encode(bytes));
      const resolvedPath = path.resolve(input.path);
      const pathHash = yield* hash(resolvedPath);
      const namespaceId = yield* hash("ai-metrics-hash-salt-namespace/v1");
      const previous = input.cursor;
      if (
        O.isSome(previous) &&
        (previous.value.pathHash !== pathHash ||
          previous.value.namespaceId !== namespaceId ||
          previous.value.source !== input.source)
      )
        return yield* failure("invalid-cursor");
      // Refuse obvious special files before open; noFollow closes the final
      // symlink race on supported platforms. The owning worker still needs a
      // hard wall-clock limit for uninterruptible platform I/O.
      if ((yield* fs.stat(resolvedPath)).type !== "File") return yield* failure("identity-unavailable");
      const handle = yield* fs.open(resolvedPath, { flag: "r", noFollow: true });
      const info = yield* handle.stat;
      if (info.type !== "File" || O.isNone(info.ino) || info.size > BigInt(Number.MAX_SAFE_INTEGER))
        return yield* failure("identity-unavailable");
      const fileIdentity = yield* hash(
        `${info.dev}:${info.ino.value}:${O.match(info.birthtime, { onNone: () => "unknown", onSome: (time) => time.getTime().toString() })}`
      );
      const size = Number(info.size);
      let bytesRead = 0;
      const readAt = Effect.fnUntraced(function* (offset: number, length: number) {
        const buffer = new Uint8Array(length);
        let used = 0;
        while (used < length) {
          const amount = yield* handle.read(buffer.subarray(used), { position: BigInt(offset + used) });
          if (amount === 0) return yield* failure("unstable");
          used += amount;
          bytesRead += amount;
        }
        return buffer;
      });
      let reset: TranscriptPage["reset"] = O.isNone(previous) ? "new" : "none";
      if (O.isSome(previous)) {
        const prior = previous.value;
        if (fileIdentity !== prior.fileIdentity) reset = "replaced";
        else if (size < prior.offset || size < prior.prefixLength) reset = "truncated";
        else if (
          (yield* hashBytes(yield* readAt(0, prior.prefixLength))) !== prior.prefixHash ||
          (yield* hashBytes(yield* readAt(prior.offset - prior.anchorLength, prior.anchorLength))) !== prior.anchorHash
        )
          reset = "rewritten";
      }
      if (
        reset === "none" &&
        O.isSome(previous) &&
        !previous.value.discarding &&
        previous.value.offset > 0 &&
        (yield* readAt(previous.value.offset - 1, 1))[0] !== 10
      )
        return yield* failure("invalid-cursor");
      const resumed = reset === "none" && O.isSome(previous) ? O.some(previous.value) : O.none();
      let offset = O.match(resumed, { onNone: () => 0, onSome: (cursor) => cursor.offset });
      let lineNumber = O.match(resumed, { onNone: () => 0, onSome: (cursor) => cursor.lineNumber });
      let discarding = O.match(resumed, { onNone: () => false, onSome: (cursor) => cursor.discarding });
      let discardStart = O.match(resumed, { onNone: () => 0, onSome: (cursor) => cursor.discardStart });
      let session = O.match(resumed, { onNone: emptySession, onSome: (cursor) => cursor.session });
      const prefixLength = Math.min(256, size);
      const prefixHash = yield* hashBytes(yield* readAt(0, prefixLength));
      const generationId = O.isSome(resumed)
        ? resumed.value.generationId
        : yield* hash(
            `source-generation/v1:${input.source}:${pathHash}:${fileIdentity}:${reset}:${O.match(previous, { onNone: () => "initial", onSome: (cursor) => cursor.generationId })}`
          );
      const start = offset;
      const bytes = yield* readAt(start, Math.min(input.maxBytes, size - start));
      const frames: Array<typeof TranscriptFrame.Type> = [];
      let local = 0;
      let waitingForPartialLine = false;
      while (local < bytes.length && frames.length < input.maxFrames) {
        const newline = bytes.indexOf(10, local);
        const complete = newline !== -1;
        const end = complete ? newline + 1 : bytes.length;
        const length = (complete ? newline : end) - local;
        const occurrenceStart = discarding ? discardStart : start + local;
        const occurrenceId = yield* hash(`source-occurrence/v1:${generationId}:${occurrenceStart}`);
        if (discarding || length > input.maxLineBytes) {
          frames.push(
            TranscriptFrame.cases.Rejected.make({
              occurrenceId,
              start: occurrenceStart,
              end: start + end,
              reason: "line-too-long",
              complete,
            })
          );
          discardStart = occurrenceStart;
          discarding = !complete;
        } else if (!complete) {
          waitingForPartialLine = true;
          break;
        } else {
          const frameBytes = bytes.subarray(local, end);
          const decoded = Result.try(() =>
            new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(frameBytes)
          );
          if (Result.isFailure(decoded))
            frames.push(
              TranscriptFrame.cases.Rejected.make({
                occurrenceId,
                start: occurrenceStart,
                end: start + end,
                reason: "invalid-utf8",
                complete: true,
              })
            );
          else {
            const text = occurrenceStart === 0 ? Str.replace(/^\uFEFF/u, "")(decoded.success) : decoded.success;
            const line = A.head(Line.split(text));
            const parsed = O.isSome(line) ? Line.parseResult(line.value) : Result.fail(undefined);
            const row = Result.isSuccess(parsed) ? S.decodeUnknownOption(RawRecord)(parsed.success.value) : O.none();
            if (O.isNone(row))
              frames.push(
                TranscriptFrame.cases.Rejected.make({
                  occurrenceId,
                  start: occurrenceStart,
                  end: start + end,
                  reason: Str.trim(text) === "" ? "blank" : Result.isFailure(parsed) ? "invalid-json" : "invalid-shape",
                  complete: true,
                })
              );
            else {
              const metadata = yield* project(row.value, input.source, session, salt);
              session = metadata.session;
              frames.push(
                TranscriptFrame.cases.Accepted.make({
                  occurrenceId,
                  start: occurrenceStart,
                  end: start + end,
                  contentHash: yield* hashBytes(frameBytes),
                  metadata,
                })
              );
            }
          }
        }
        local = end;
        offset = start + local;
        if (complete) {
          lineNumber += 1;
          discarding = false;
          discardStart = offset;
        }
      }
      // Re-read this bounded page and prefix before returning. A source mutation
      // during the read is refused; the caller keeps its previous durable cursor.
      const again = yield* readAt(start, bytes.length);
      if (
        (yield* hashBytes(again)) !== (yield* hashBytes(bytes)) ||
        (yield* hashBytes(yield* readAt(0, prefixLength))) !== prefixHash
      )
        return yield* failure("unstable");
      const anchorLength = Math.min(256, offset);
      const cursor = TranscriptCursor.make({
        source: input.source,
        pathHash,
        namespaceId,
        fileIdentity,
        generationId,
        offset,
        lineNumber,
        prefixLength,
        prefixHash,
        anchorLength,
        anchorHash: yield* hashBytes(yield* readAt(offset - anchorLength, anchorLength)),
        discarding,
        discardStart,
        session,
      });
      return TranscriptPage.make({
        cursor,
        frames,
        reset,
        sampledEnd: size,
        bytesRead,
        waitingForPartialLine,
      });
    })
  ).pipe(
    Effect.catchTags({
      PlatformError: () => Effect.fail(failure("unavailable")),
      AiMetricsPrivacyError: () => Effect.fail(failure("unavailable")),
    })
  );
  return yield* program.pipe(
    Effect.timeoutOption("10 seconds"),
    Effect.flatMap(O.match({ onNone: () => Effect.fail(failure("timed-out")), onSome: Effect.succeed }))
  );
});
