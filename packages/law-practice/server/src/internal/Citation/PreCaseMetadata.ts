/** add_pre_citation from eyecite 2.7.6 helpers.py, Free Law Project, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationLawMetadataInput, CitationLawMetadataResult } from "./LawMetadata.ts";
import {
  citationMetadataContext,
  makeCitationPublicationMetadataOperation,
  matchCitationMetadataContext,
} from "./MetadataComposition.ts";
import { makeCitationPinCiteCleaner } from "./MetadataStrings.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationPublicationMetadataConfiguration } from "./MetadataComposition.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/PreCaseMetadata");
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "missing-capture"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed pre-case metadata failures without source text." })
);
const Value = CitationPythonUnicodeStorage.pipe(S.NullOr);
const Start = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.sourceUtf16)).pipe(
  $I.annoteSchema("Start", { description: "Unverified source span override before pre-citation extraction." })
);
const FullStart = S.Int.check(S.isBetween({ minimum: -300, maximum: CitationEngineAbsoluteMaxima.sourceUtf16 })).pipe(
  $I.annoteSchema("FullStart", {
    description: "Unverified source full start, including a negative result from a span override.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationPreCaseMetadataFailure extends S.TaggedError<
  CitationPreCaseMetadataFailure,
  { readonly brand: unique symbol }
>($I`CitationPreCaseMetadataFailure`)(
  "CitationPreCaseMetadataFailure",
  { reason: Reason },
  $I.annoteError<CitationPreCaseMetadataFailure>("CitationPreCaseMetadataFailure", {
    description: "Pre-case helper failed without retaining values or nested causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationPreCaseMetadataFailure.make({ reason });
/** Built-in citation state before the source pre-citation helper.
 * @internal @category models @since 0.0.0
 */
export class CitationPreCaseMetadataInput extends S.Opaque<
  CitationPreCaseMetadataInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    words: CitationLawMetadataInput.fields.words,
    index: CitationLawMetadataInput.fields.index,
    spanStart: Start,
    plaintiff: Value,
    defendant: Value,
    pinCiteSpanStart: S.NullOr(S.Int),
  }).pipe(
    $I.annoteSchema("CitationPreCaseMetadataInput", {
      description: "Native word context, source start and previously populated case-name/pin state.",
    })
  )
) {}
/** Only the fields written by a successful source match; no verified mention span.
 * @internal @category models @since 0.0.0
 */
export class CitationPreCaseMetadataPatch extends S.Opaque<
  CitationPreCaseMetadataPatch,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    fullSpanStart: FullStart,
    metadata: S.Struct({ pinCite: Value, antecedentGuess: Value, pinCiteSpanStart: S.NullOr(S.Int) }),
  }).pipe(
    $I.annoteSchema("CitationPreCaseMetadataPatch", {
      description: "Owned antecedent/pin updates and source start, retaining a prior pin span when no pin matched.",
    })
  )
) {}
/** Complete pre-case helper result or an unchanged source state.
 * @internal @category models @since 0.0.0
 */
export class CitationPreCaseMetadataResult extends S.Opaque<
  CitationPreCaseMetadataResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patch: S.Option(CitationPreCaseMetadataPatch),
    reservedUnits: CitationLawMetadataResult.fields.reservedUnits,
  }).pipe(
    $I.annoteSchema("CitationPreCaseMetadataResult", {
      description: "Source patch or skip/no-match with invocation allocation accounting.",
    })
  )
) {}
const Input = S.toType(CitationPreCaseMetadataInput);
const Envelope = S.Struct({ plaintiff: Value, defendant: S.Unknown }).pipe(
  $I.annoteSchema("Envelope", { description: "Read only source guard state before inspecting words or span inputs." })
);
const truthy = (value: CitationPythonUnicodeStorage | null) => value !== null && value.bytes.length > 0;
const prepare = Effect.fn("Citation.preparePreCaseMetadata")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationPublicationMetadataConfiguration,
  raw: unknown
) {
  const envelope = yield* S.decodeUnknownEffect(Envelope)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  if (truthy(envelope.plaintiff)) return O.none<CitationPreCaseMetadataPatch>();
  const defendant = yield* S.decodeUnknownEffect(Value)(envelope.defendant).pipe(
    Effect.mapError(() => fail("invalid-input"))
  );
  if (truthy(defendant)) return O.none<CitationPreCaseMetadataPatch>();
  const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  const owned = yield* matchCitationMetadataContext(
    limits,
    runtime,
    config,
    citationMetadataContext({ ...request, forward: false }),
    () => fail("missing-capture")
  );
  if (O.isNone(owned)) return O.none<CitationPreCaseMetadataPatch>();
  const pin = yield* owned.value.capture("pin_cite");
  const antecedentGuess = yield* owned.value.capture("antecedent");
  const strings = yield* makeCitationPinCiteCleaner(limits);
  const cleaned = yield* strings.cleanPinCite(pin);
  const fullSpanStart = request.spanStart - (owned.value.end - owned.value.start);
  return O.some(
    CitationPreCaseMetadataPatch.make({
      fullSpanStart,
      metadata: {
        pinCite: truthy(cleaned) ? cleaned : null,
        antecedentGuess,
        pinCiteSpanStart: truthy(pin) ? fullSpanStart : request.pinCiteSpanStart,
      },
    })
  );
});
/** Capture authenticated PRE_FULL/Year patterns and existing metadata owners.
 * Skip guards precede word decoding. Backward context and source patching share
 * one admission, deadline, fresh native Scope and invocation budget. Methods have
 * R = never and return no partial patch on failure.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPreCaseMetadata = Effect.fn("Citation.makePreCaseMetadata")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const installed = yield* makeCitationPublicationMetadataOperation(
    policy,
    runtimeInput,
    configurationInput,
    "d151b7a02a061593bb44bd881eee2dc174fff7f1b5449512f25cc2b98fb315b0",
    prepare,
    () => fail("invalid-configuration")
  );
  const apply = Effect.fn("Citation.addPreCaseMetadata")(
    (raw: unknown) =>
      installed.operation.run(
        "extract",
        Effect.gen(function* () {
          const [patch, reservedUnits] = yield* installed.run(raw);
          return CitationPreCaseMetadataResult.make({ patch, reservedUnits });
        })
      ),
    installed.timing.timed
  );
  return { apply };
});
