/** Compose original HTML discovery and both exact Document map directions.
 * eyecite 2.7.6 models.Document, Free Law Project, BSD-2-Clause;
 * see THIRD_PARTY_NOTICES.md. Cleaning precedes this private stage.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { makeCitationDiffWorker } from "./DiffWorker.ts";
import {
  CitationHtmlDiscoveryConfiguration,
  copyCitationHtmlDiscoveryConfiguration,
  makeCitationHtmlDiscoveryRunner,
} from "./HtmlDiscovery.ts";
import { CitationHtmlTagGeometryInput } from "./HtmlTagGeometry.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { CitationSpanOffsetsPlan } from "./SpanOffsets.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlGeometryPreparation");
const Reason = LiteralKit(["invalid-configuration", "invalid-input"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed preparation failures without source or partial geometry." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationHtmlGeometryPreparationFailure extends S.TaggedError<
  CitationHtmlGeometryPreparationFailure,
  { readonly brand: unique symbol }
>($I`CitationHtmlGeometryPreparationFailure`)(
  "CitationHtmlGeometryPreparationFailure",
  { reason: Reason },
  $I.annoteError<CitationHtmlGeometryPreparationFailure>("CitationHtmlGeometryPreparationFailure", {
    description: "Invalid trusted preparation configuration without markup, source paths or nested causes.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlGeometryPreparationConfiguration extends S.Opaque<
  CitationHtmlGeometryPreparationConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({ discovery: CitationHtmlDiscoveryConfiguration, diffRuntime: CitationNativeProcessRuntime }).pipe(
    $I.annoteSchema("CitationHtmlGeometryPreparationConfiguration", {
      description: "Captured fixed discovery programs and owned diff runtime; never supplied by a raw-text request.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationPreparedHtmlSource extends S.Opaque<
  CitationPreparedHtmlSource,
  { readonly brand: unique symbol }
>()(
  S.Struct({ plain: CitationPythonUnicodeStorage, markup: CitationPythonUnicodeStorage }).pipe(
    $I.annoteSchema("CitationPreparedHtmlSource", {
      description:
        "Original markup and its already-cleaned native plain text, supplied by the enclosing document owner.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationPreparedHtmlGeometry extends S.Opaque<
  CitationPreparedHtmlGeometry,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    geometry: CitationHtmlTagGeometryInput,
    reservedUnits: S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationPreparedHtmlGeometry", {
      description: "Complete native source geometry and invocation reservation count; no partial plan is published.",
    })
  )
) {}
const invalid = () => CitationHtmlGeometryPreparationFailure.make({ reason: "invalid-configuration" });
const PreparedHtmlValue = S.toType(CitationPreparedHtmlSource).pipe(
  $I.annoteSchema("PreparedHtmlValue", {
    description: "Captured static boundary codec for bounded citation processing.",
  })
);
export const copyCitationHtmlGeometryConfiguration = Effect.fn("Citation.ownHtmlGeometryConfiguration")(function* (
  limits: CitationEngineLimits,
  config: CitationHtmlGeometryPreparationConfiguration
) {
  const discovery = yield* copyCitationHtmlDiscoveryConfiguration(limits, config.discovery);
  return CitationHtmlGeometryPreparationConfiguration.make({
    discovery,
    diffRuntime: CitationNativeProcessRuntime.make({ ...config.diffRuntime }),
  });
});
/** Run within one captured operation and budget. Resolve cleaned plain input
 * after placeholder generation, matching the original constructor's error order.
 * The effect parameter is trusted server composition, never request data.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationHtmlGeometry = Effect.fn("Citation.prepareOwnedHtmlGeometry")(function* <E>(
  limits: CitationEngineLimits,
  regexRuntime: CitationNativeProcessRuntime,
  config: CitationHtmlGeometryPreparationConfiguration,
  markup: unknown,
  plainInput: Effect.Effect<unknown, E>
) {
  const input = yield* makeCitationRegexInput(limits);
  const discovery = yield* makeCitationHtmlDiscoveryRunner(limits, regexRuntime, config.discovery);
  const masked = yield* discovery.placeholder(markup);
  const plainValue = yield* plainInput;
  const plain = yield* input.prepareUnicode(plainValue, () => Effect.void);
  const placeholder = yield* input.prepareUnicode(masked.placeholder, () => Effect.void);
  const diff = yield* makeCitationDiffWorker(limits, config.diffRuntime);
  const forwardSteps = yield* diff.evaluate(plain.value.storage, placeholder.value.storage);
  const backwardSteps = yield* diff.evaluate(masked.source.value.storage, plain.value.storage);
  const tags = yield* discovery.emphasis(masked.source.value.storage);
  return CitationHtmlTagGeometryInput.make({
    plain: plain.value.storage,
    forward: CitationSpanOffsetsPlan.make({ before: plain.layout, after: placeholder.layout, steps: forwardSteps }),
    backward: CitationSpanOffsetsPlan.make({ before: masked.source.layout, after: plain.layout, steps: backwardSteps }),
    tags,
  });
});
const prepare = Effect.fn("Citation.prepareHtmlGeometry")(function* (
  limits: CitationEngineLimits,
  regexRuntime: CitationNativeProcessRuntime,
  config: CitationHtmlGeometryPreparationConfiguration,
  raw: unknown
) {
  const source = yield* S.decodeUnknownEffect(PreparedHtmlValue)(raw).pipe(
    Effect.mapError(() => CitationHtmlGeometryPreparationFailure.make({ reason: "invalid-input" }))
  );
  return yield* prepareCitationHtmlGeometry(limits, regexRuntime, config, source.markup, Effect.succeed(source.plain));
});
/** Capture the existing admitted operation and cumulative native text owner.
 * The method has R=never and preserves placeholder/forward/backward/emphasis
 * source order. Four independently retired children precede publication.
 * This is the post-cleaning path, not Document's argument-mode constructor.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationHtmlGeometryPreparation = makeCitationMetadataStage({
  method: "prepare",
  schema: S.toType(CitationHtmlGeometryPreparationConfiguration),
  invalid,
  own: copyCitationHtmlGeometryConfiguration,
  prepare,
  project: (geometry, reservedUnits) => CitationPreparedHtmlGeometry.make({ geometry, reservedUnits }),
});
