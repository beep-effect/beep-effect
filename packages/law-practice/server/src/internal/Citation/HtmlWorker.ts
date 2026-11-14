/**
 * Parent-owned one-process-per-operation HTML supervisor. Only retirement
 * tasks are detached: their explicit daemon lifetime preserves exact child
 * ownership after caller cancellation or a cleanup deadline. No replacement
 * is admitted while a quarantined child remains unacknowledged.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationCleanerProduced,
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationCleanerTextAllocation, citationCleanerHtmlTextOutput } from "./CleanerTextIdentity.ts";
import { CitationHtmlInputFailure, makeCitationHtmlInput } from "./HtmlInput.ts";
import {
  CitationHtmlWorkerFailure,
  CitationHtmlWorkerJob,
  preflightCitationHtmlControlFrames,
  preflightCitationHtmlJob,
} from "./HtmlWorkerProtocol.ts";
import { CitationHtmlWorkerStartup, prepareCitationHtmlRpc } from "./HtmlWorkerRpc.ts";
import { makeCitationMarkupWorker } from "./MarkupWorker.ts";
import type { CitationCleanerWork } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const NativeStorage = S.toType(CitationPythonUnicodeStorage);

const $I = $LawPracticeServerId.create("internal/Citation/HtmlWorker");
/**
 * Complete native stage text and original operation-owned charge tickets.
 * The charge fields preserve live issuance; decoding cannot mint authority.
 * @internal @category models @since 0.0.0
 */
export class CitationHtmlCleanerStage extends S.Opaque<CitationHtmlCleanerStage, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16)),
    charges: CitationCleanerProduced.fields.charges,
    allocation: CitationCleanerTextAllocation,
  }).pipe(
    $I.annoteSchema("CitationHtmlCleanerStage", {
      description: "Complete bounded HTML text plus live text reservations, pending runtime value issuance.",
    })
  )
) {}
const failure = (reason: CitationHtmlWorkerFailure["reason"]) => CitationHtmlWorkerFailure.make({ reason });
const invalidRuntime = () => failure("invalid-runtime");
const invalidInput = () => CitationHtmlInputFailure.make({ reason: "invalid-input" });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "clean", limit });
const Text = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16));
const StageText = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16));
const Output = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16));
const WorkerStartupJson = S.fromJsonString(CitationHtmlWorkerStartup).pipe(
  $I.annoteSchema("WorkerStartupJson", {
    description: "Captured static boundary codec for bounded citation processing.",
  })
);
/**
 * Capture Clock, process spawner and owning Scope. Returned methods have
 * R = never. Admission includes preparation; one clean timer covers preparation,
 * startup and all traffic/native work. Mandatory retirement has its separate
 * cleanup window and must acknowledge exit before publication/permit reuse.
 * Scope teardown stops admission and retains bounded retirement daemons for
 * any ownership still quarantined after its cleanup window.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationHtmlWorker = Effect.fn("Citation.makeHtmlWorker")(function* (
  decodedLimits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime
) {
  const limits = CitationEngineLimits.make({
    ...decodedLimits,
    cleanDeadline: decodedLimits.cleanDeadline.pipe(Duration.toMillis, Duration.millis),
    operationDeadline: decodedLimits.operationDeadline.pipe(Duration.toMillis, Duration.millis),
    queueDeadline: decodedLimits.queueDeadline.pipe(Duration.toMillis, Duration.millis),
    cleanupDeadline: decodedLimits.cleanupDeadline.pipe(Duration.toMillis, Duration.millis),
  });
  const path = yield* Path.Path;
  const assetPath = yield* path
    .fromFileUrl(new URL("../../../assets/citation-html/kernel.wasm", import.meta.url))
    .pipe(Effect.mapError(invalidRuntime));
  const argument = yield* S.encodeEffect(WorkerStartupJson)(
    CitationHtmlWorkerStartup.make({ maximum: limits.processMessageBytes, assetPath })
  ).pipe(Effect.mapError(invalidRuntime));
  const preparation = yield* makeCitationHtmlInput(limits);
  const worker = yield* makeCitationMarkupWorker(limits, runtime, argument, "clean", failure);
  const validateSource = Effect.fnUntraced(function* (input: unknown, kind: "raw" | "text" | "bytes" | "unicode") {
    if (kind === "bytes") {
      yield* S.decodeUnknownEffect(S.Uint8Array)(input).pipe(Effect.mapError(invalidInput));
    } else if (kind === "unicode") {
      yield* S.decodeUnknownEffect(NativeStorage)(input).pipe(Effect.mapError(invalidInput));
    } else {
      const text = yield* S.decodeUnknownEffect(kind === "text" ? StageText : Text)(input).pipe(
        Effect.mapError(invalidInput)
      );
      if (kind === "raw" && Str.length(text) > limits.sourceUtf16) return yield* safety("sourceUtf16");
    }
  });
  const clean = Effect.fn("Citation.cleanHtmlProcess")(function* (
    input: unknown,
    remaining: number,
    kind: "raw" | "text" | "bytes" | "unicode"
  ) {
    yield* validateSource(input, kind);
    const outputUtf16 = yield* S.decodeEffect(Output)(remaining).pipe(Effect.mapError(invalidRuntime));
    if (outputUtf16 > limits.producedTextUtf16) return yield* safety("producedTextUtf16");
    yield* preflightCitationHtmlControlFrames(limits.processMessageBytes);
    return yield* worker.run(
      Effect.gen(function* () {
        const prepare =
          kind === "bytes"
            ? preparation.prepareBytes
            : kind === "unicode"
              ? preparation.prepareUnicode
              : preparation.prepareStage;
        const prepared = yield* prepare(input, (layout) =>
          preflightCitationHtmlJob(layout, outputUtf16, limits.processMessageBytes).pipe(Effect.asVoid)
        );
        return yield* prepareCitationHtmlRpc(
          CitationHtmlWorkerJob.make({
            encoding: prepared.encoding,
            bytes: prepared.bytes,
            fullHtml: prepared.fullHtml,
            outputUtf16,
          }),
          limits.processMessageBytes
        );
      })
    );
  });

  const stage = Effect.fn("Citation.stageHtmlProcess")(
    (input: unknown, work: CitationCleanerWork, kind: Parameters<typeof clean>[2]) =>
      work
        .withTextCapacity((remaining) =>
          clean(input, remaining, kind).pipe(Effect.map((text) => ({ value: text, units: Str.length(text) })))
        )
        .pipe(
          Effect.map(({ value, charges }) =>
            CitationHtmlCleanerStage.make({ ...citationCleanerHtmlTextOutput(value), charges })
          )
        )
  );
  return {
    snapshot: worker.snapshot,
    reap: worker.reap,
    clean: (input: unknown) => clean(input, limits.producedTextUtf16, "raw"),
    cleanBytes: (input: unknown) => clean(input, limits.producedTextUtf16, "bytes"),
    cleanUnicode: (input: unknown) => clean(input, limits.producedTextUtf16, "unicode"),
    stageBytes: (input: unknown, work: CitationCleanerWork) => stage(input, work, "bytes"),
    stageUnicode: (input: unknown, work: CitationCleanerWork) => stage(input, work, "unicode"),
    stage: (input: unknown, work: CitationCleanerWork) => stage(input, work, "text"),
  };
});
