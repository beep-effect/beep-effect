/**
 * Captured builtin cleaner dispatch through owned values, reserved literal
 * stages and parent-owned native text/byte workers. Source behavior adapts
 * eyecite 2.7.6 clean.py; Free Law Project, BSD-2-Clause. See notices.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCleanerFailure, CitationCleanerProduced } from "./CleanerPipeline.ts";
import { CitationBuiltinCleanerName, CitationCleanerValues } from "./CleanerValues.ts";
import { makeCitationHtmlWorker } from "./HtmlWorker.ts";
import { makeCitationLiteralCleaners } from "./LiteralCleaners.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type { CitationCleanerObject, CitationCleanerWork } from "./CleanerPipeline.ts";
import type { CitationHtmlCompletionFailure } from "./HtmlCompletion.ts";
import type { CitationHtmlInputFailure } from "./HtmlInput.ts";
import type { CitationHtmlKernelFailure } from "./HtmlKernel.ts";
import type { CitationHtmlWorkerFailure } from "./HtmlWorkerProtocol.ts";
import type { CitationLiteralCleanerFailure } from "./LiteralCleaners.ts";

const $I = $LawPracticeServerId.create("internal/Citation/BuiltinCleaners");
/**
 * Builtin function invocation after source membership/get/callability dispatch.
 * Values must already be issued by the captured owner. No host coercion or
 * structural kind inference is performed. Registry and cursor ownership remain
 * separate; this service does not replace Python hash/equality behavior.
 * @internal @category services @since 0.0.0
 */
export class CitationBuiltinCleaners extends Context.Service<
  CitationBuiltinCleaners,
  {
    readonly invoke: (
      name: unknown,
      value: CitationCleanerObject,
      work: CitationCleanerWork
    ) => Effect.Effect<CitationCleanerProduced, CitationCleanerFailure | CitationSafetyLimitExceeded>;
  }
>()($I`CitationBuiltinCleaners`) {}
const fail = (reason: CitationCleanerFailure["reason"]) => CitationCleanerFailure.make({ reason });
type Failure =
  | CitationCleanerFailure
  | CitationSafetyLimitExceeded
  | CitationLiteralCleanerFailure
  | CitationHtmlInputFailure
  | CitationHtmlKernelFailure
  | CitationHtmlCompletionFailure
  | CitationHtmlWorkerFailure;
const kernelFailure = (reason: CitationHtmlKernelFailure["reason"]) =>
  Match.value(reason).pipe(
    Match.when("parse-error", () => fail("html-parse-error")),
    Match.when("unicode-decode-error", () => fail("html-unicode-decode-error")),
    Match.orElse(() => fail("runtime-failed"))
  );
const translate = (error: Failure): CitationCleanerFailure | CitationSafetyLimitExceeded =>
  Match.value(error).pipe(
    Match.tags({
      CitationCleanerFailure: (error) => error,
      CitationSafetyLimitExceeded: (error) => error,
      CitationHtmlKernelFailure: (error) => kernelFailure(error.reason),
      CitationHtmlInputFailure: (error) =>
        error.reason === "unicode-encoding-declaration"
          ? fail("html-unicode-encoding-declaration")
          : fail("runtime-failed"),
    }),
    Match.orElse(() => fail("runtime-failed"))
  );
/**
 * Capture the value service, limits/Clock and native worker owner once. Returned
 * invocation has R = never; enclosing clean_text keeps its shared work/timers.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationBuiltinCleaners = Effect.fn("Citation.makeBuiltinCleaners")(function* (
  policy: unknown,
  runtime: unknown
) {
  const values = yield* CitationCleanerValues;
  const literal = yield* makeCitationLiteralCleaners(policy);
  const html = yield* makeCitationHtmlWorker(policy, runtime);
  const invoke = Effect.fn("Citation.invokeBuiltinCleaner")(function* (
    input: unknown,
    value: CitationCleanerObject,
    work: CitationCleanerWork
  ) {
    const name = yield* S.decodeUnknownEffect(CitationBuiltinCleanerName)(input).pipe(
      Effect.mapError(() => fail("unknown-step"))
    );
    if (name !== "html") {
      const citationResult1 = yield* values.getUnicode(value);
      const source = yield* Effect.fromOption(citationResult1, () => fail("builtin-input-type"));
      const output = yield* literal.stageUnicode(name, source.storage, work);
      const result = yield* values.materializeUnicode(value, output, output.storage);
      return CitationCleanerProduced.make({ value: result, charges: output.charges });
    }
    const text = yield* values.getUnicode(value);
    const output = O.isSome(text)
      ? yield* html.stageUnicode(text.value.storage, work)
      : yield* values
          .getBytes(value)
          .pipe(
            Effect.flatMap((bytes) =>
              O.isSome(bytes) ? html.stageBytes(bytes.value, work) : Effect.fail(fail("builtin-input-type"))
            )
          );
    const result = yield* values.materialize(value, output);
    return CitationCleanerProduced.make({ value: result, charges: output.charges });
  }, Effect.mapError(translate));
  return CitationBuiltinCleaners.of({ invoke });
});
