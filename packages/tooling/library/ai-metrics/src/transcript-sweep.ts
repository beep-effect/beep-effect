/**
 * Bounded fair processing of explicitly declared transcript candidates.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { hashPrivateIdentifier } from "./privacy.ts";
import {
  makeTranscriptIntakeJournal,
  TranscriptAcceptance,
  TranscriptIntakeError,
  TranscriptScheduleInput,
} from "./transcript-intake.ts";
import { readTranscriptPage, TranscriptPage, TranscriptPageError, TranscriptPageInput } from "./transcript-page.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("transcript-sweep");
/**
 * Private candidate declaration and per-sweep resource limits.
 *
 * **Example** (Inspect transcript sweep input)
 * ```ts
 * import { TranscriptSweepInput } from "@beep/repo-ai-metrics/transcript-sweep"
 * console.log(typeof TranscriptSweepInput.make)
 * ```
 * **Details** At most 4096 declared files and 32 selected reads. Retired entries remain counted but are not opened. This is explicit candidate processing, not recursive discovery or proof of harness coverage. The declaration must remain private.
 * @category models
 * @since 0.0.0
 */
export class TranscriptSweepInput extends S.Opaque<TranscriptSweepInput, { readonly brand: unique symbol }>()(
  S.Struct({
    sources: S.Array(
      S.Struct({
        path: TranscriptPageInput.fields.path,
        source: TranscriptPageInput.fields.source,
        retired: S.Boolean,
      })
    ).check(S.isMaxLength(4096)),
    hashSalt: TranscriptPageInput.fields.hashSalt,
    maxSources: TranscriptScheduleInput.fields.limit,
    maxBytes: TranscriptPageInput.fields.maxBytes,
    maxLineBytes: TranscriptPageInput.fields.maxLineBytes,
    maxFrames: TranscriptPageInput.fields.maxFrames,
  })
    .check(
      S.makeFilter((value) => value.maxBytes > value.maxLineBytes, {
        identifier: "SweepReadBounds",
        title: "Sweep read bounds",
        message: "Page must exceed line bound",
      })
    )
    .pipe(
      $I.annoteSchema("TranscriptSweepInput", { description: "Explicit private source candidates and read limits." })
    )
) {}
/**
 * Metadata-only result for one selected source.
 *
 * **Example** (Inspect transcript sweep outcome)
 * ```ts
 * import { TranscriptSweepOutcome } from "@beep/repo-ai-metrics/transcript-sweep"
 * console.log(TranscriptSweepOutcome.cases.Accepted)
 * ```
 * **Details** Accepted means a local page/cursor commit, not export. Idle can include an incomplete tail. Failed reads or admissions retain the prior accepted cursor. No raw path or content is included.
 * @category models
 * @since 0.0.0
 */
export const TranscriptSweepOutcome = S.TaggedUnion({
  Accepted: {
    sourceId: Sha256Hex,
    receipt: TranscriptAcceptance,
    reset: TranscriptPage.fields.reset,
    waitingForPartialLine: S.Boolean,
    remainingBytes: S.Natural,
  },
  Idle: { sourceId: Sha256Hex, waitingForPartialLine: S.Boolean },
  Failed: { sourceId: Sha256Hex, error: S.Union([TranscriptPageError, TranscriptIntakeError]) },
}).pipe(
  $I.annoteSchema("TranscriptSweepOutcome", { description: "Safe local processing outcome for a selected source." })
);
/**
 * Bounded sweep counts over a declared candidate set.
 *
 * **Example** (Inspect transcript sweep report)
 * ```ts
 * import { TranscriptSweepReport } from "@beep/repo-ai-metrics/transcript-sweep"
 * console.log(typeof TranscriptSweepReport.make)
 * ```
 * **Details** Counts describe the supplied list only; undiscovered files and unobserved harnesses are not inferred absent.
 * @category models
 * @since 0.0.0
 */
export class TranscriptSweepReport extends S.Opaque<TranscriptSweepReport, { readonly brand: unique symbol }>()(
  S.Struct({
    declared: S.Natural,
    retired: S.Natural,
    eligible: S.Natural,
    outcomes: S.Array(TranscriptSweepOutcome).check(S.isMaxLength(32)),
  }).pipe(
    $I.annoteSchema("TranscriptSweepReport", {
      description: "Declared-population processing counts, not fleet coverage.",
    })
  )
) {}

/**
 * Reserve a fair source slice, then atomically accept each bounded metadata page.
 *
 * **Example** (Run a bounded transcript sweep)
 * ```ts
 * import { runTranscriptSweep } from "@beep/repo-ai-metrics/transcript-sweep"
 * console.log(typeof runTranscriptSweep)
 * ```
 * **Details** Scheduling advances before reading, independently of page acceptance. A crash can delay reserved sources until the next wrap but cannot advance their accepted byte positions. One bad source does not abort the rest. A worker must supply a scoped private SQLite connection and enforce hard process/resource limits; this function never starts the held forwarder.
 * @category services
 * @since 0.0.0
 */
export const runTranscriptSweep = Effect.fn("AiMetrics.runTranscriptSweep")(function* (
  config: TranscriptIntakeConfig,
  input: TranscriptSweepInput
) {
  const path = yield* Path.Path;
  const salt = Redacted.value(input.hashSalt);
  if (Str.trim(salt) === "") return yield* TranscriptPageError.make({ reason: "missing-salt" });
  const hash = (value: string) => hashPrivateIdentifier(value, O.some(salt));
  if ((yield* hash("ai-metrics-hash-salt-namespace/v1")) !== config.namespaceId)
    return yield* TranscriptIntakeError.make({ reason: "namespace" });
  const candidates = yield* Effect.forEach(input.sources, (source) =>
    Effect.gen(function* () {
      const resolvedPath = path.resolve(source.path);
      const pathHash = yield* hash(resolvedPath);
      return {
        ...source,
        path: resolvedPath,
        pathHash,
        sourceId: yield* hash(`transcript-source/v1:${source.source}:${pathHash}`),
      };
    })
  );
  if (A.dedupe(A.map(candidates, (source) => source.sourceId)).length !== candidates.length)
    return yield* TranscriptIntakeError.make({ reason: "configuration" });
  const eligible = A.filter(candidates, (source) => !source.retired);
  const journal = yield* makeTranscriptIntakeJournal(config);
  const selected = yield* journal.reserveSources(
    TranscriptScheduleInput.make({
      candidates: A.map(eligible, (source) => source.sourceId),
      limit: input.maxSources,
    })
  );
  const outcomes = yield* Effect.forEach(selected, (sourceId) =>
    Effect.gen(function* () {
      const source = A.findFirst(eligible, (source) => source.sourceId === sourceId);
      if (O.isNone(source)) return yield* TranscriptIntakeError.make({ reason: "configuration" });
      const processSource = Effect.gen(function* () {
        const previous = yield* journal.readCursor(source.value.source, source.value.pathHash);
        const page = yield* readTranscriptPage(
          TranscriptPageInput.make({
            path: source.value.path,
            source: source.value.source,
            hashSalt: input.hashSalt,
            cursor: previous,
            maxBytes: input.maxBytes,
            maxLineBytes: input.maxLineBytes,
            maxFrames: input.maxFrames,
          })
        );
        if (
          page.frames.length === 0 &&
          (O.isNone(previous) || (page.reset === "none" && page.cursor.offset === previous.value.offset))
        )
          return TranscriptSweepOutcome.cases.Idle.make({
            sourceId,
            waitingForPartialLine: page.waitingForPartialLine,
          });
        return TranscriptSweepOutcome.cases.Accepted.make({
          sourceId,
          receipt: yield* journal.acceptPage(page, previous),
          reset: page.reset,
          waitingForPartialLine: page.waitingForPartialLine,
          remainingBytes: page.sampledEnd - page.cursor.offset,
        });
      });
      const result = yield* Effect.result(processSource);
      return Result.isFailure(result)
        ? TranscriptSweepOutcome.cases.Failed.make({ sourceId, error: result.failure })
        : result.success;
    })
  );
  return TranscriptSweepReport.make({
    declared: candidates.length,
    retired: candidates.length - eligible.length,
    eligible: eligible.length,
    outcomes,
  });
});
