/** Admitted native annotation operation composed from original eyecite stages.
 * Free Law Project eyecite 2.7.6, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationPythonUnicodeStorage,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { captureCitationOperationChildren } from "./Admission.ts";
import { CitationAnnotationReplacement, makeCitationAnnotationAssembly } from "./AnnotationAssembly.ts";
import {
  captureCitationAnnotationReservation,
  citationAnnotationSafety,
  failCitationAnnotationUnicode,
} from "./AnnotationBudget.ts";
import { CitationAnnotationAnnotator } from "./AnnotationCallback.ts";
import { prepareCitationAnnotationSourceMap, prepareCitationAnnotations } from "./AnnotationPreparation.ts";
import { makeCitationSkipAnnotationSpans } from "./AnnotationSkip.ts";
import { CitationAnnotationSpanProcessor } from "./AnnotationSpan.ts";
import { makeCitationWrapAnnotationSpans } from "./AnnotationWrap.ts";
import {
  CitationHtmlGeometryPreparationConfiguration,
  copyCitationHtmlGeometryConfiguration,
} from "./HtmlGeometryPreparation.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { CitationRegexOperation } from "./RegexPolicy.ts";
import { CitationXmlBalance, makeCitationXmlWorker } from "./XmlWorker.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { makeCitationSpanOffsets } from "./SpanOffsets.ts";

const $I = $LawPracticeServerId.create("internal/Citation/AnnotationEntry");
/** @internal @category models @since 0.0.0 */
export const CitationAnnotationMode = LiteralKit(["unchecked", "skip", "wrap"]).pipe(
  $I.annoteSchema("CitationAnnotationMode", {
    description: "Original markup policy, validated before reading other request components.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationAnnotationMode = typeof CitationAnnotationMode.Type;
/** @internal @category errors @since 0.0.0 */
export class CitationAnnotationEntryFailure extends S.TaggedError<
  CitationAnnotationEntryFailure,
  { readonly brand: unique symbol }
>($I`CitationAnnotationEntryFailure`)(
  "CitationAnnotationEntryFailure",
  { reason: S.Literals(["invalid-input", "invalid-configuration"]) },
  $I.annoteError<CitationAnnotationEntryFailure>("CitationAnnotationEntryFailure", {
    description: "Closed native annotation entry refusal without source, replacement or partial output.",
  })
) {}
/** An installed native updater bypasses implicit mapping and selects source even
 * when empty. It is a captured server capability, never an input callable.
 * @internal @category services @since 0.0.0
 */
export class CitationAnnotationOffsetUpdater extends Context.Service<
  CitationAnnotationOffsetUpdater,
  Pick<Effect.Success<ReturnType<typeof makeCitationSpanOffsets>>, "update">
>()($I`CitationAnnotationOffsetUpdater`) {}
/** @internal @category models @since 0.0.0 */
export class CitationAnnotationEntryConfiguration extends S.Opaque<
  CitationAnnotationEntryConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({ geometry: CitationHtmlGeometryPreparationConfiguration, xmlRuntime: CitationNativeProcessRuntime }).pipe(
    $I.annoteSchema("CitationAnnotationEntryConfiguration", {
      description:
        "Installed discovery/diff/XML configuration; regex runtime is independently captured by the shared stage owner.",
    })
  )
) {}
const empty = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array() });
const ModeProbe = S.Struct({
  mode: CitationAnnotationMode.pipe(S.withDecodingDefaultKey(Effect.succeed("unchecked"))),
}).pipe(
  $I.annoteSchema("ModeProbe", {
    description: "Validate the original mode before inspecting potentially ignored fields.",
  })
);
const SourceProbe = S.Struct({
  source: CitationPythonUnicodeStorage.pipe(S.withDecodingDefaultKey(Effect.succeed(empty))),
}).pipe(
  $I.annoteSchema("SourceProbe", {
    description: "Optional original source_text, including the supplied-updater empty branch.",
  })
);
const PlainProbe = S.Struct({ plain: CitationPythonUnicodeStorage }).pipe(
  $I.annoteSchema("PlainProbe", {
    description: "Original plain text; deliberately unread when a supplied updater selects source.",
  })
);
const RowsProbe = S.Struct({
  replacements: S.Array(CitationAnnotationReplacement).check(
    S.isMaxLength(CitationEngineAbsoluteMaxima.annotationReplacements)
  ),
}).pipe(
  $I.annoteSchema("RowsProbe", {
    description:
      "Primitive ordered-input tuples; arbitrary host/iterator protocols remain separate qualification work.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationAnnotationEntryResult extends S.Opaque<
  CitationAnnotationEntryResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({ text: CitationPythonUnicodeStorage, reservedUnits: S.Natural }).pipe(
    $I.annoteSchema("CitationAnnotationEntryResult", {
      description:
        "One complete annotated native string and captured operation allocation count; no verified source anchor is issued.",
    })
  )
) {}
const invalid = () => CitationAnnotationEntryFailure.make({ reason: "invalid-input" });
const configurationFailure = () => CitationAnnotationEntryFailure.make({ reason: "invalid-configuration" });
const nativeEqual = S.toEquivalence(S.toType(CitationPythonUnicodeStorage));
const own = Effect.fn("Citation.ownAnnotationEntry")(function* (
  limits: CitationEngineLimits,
  configuration: CitationAnnotationEntryConfiguration
) {
  const geometry = yield* copyCitationHtmlGeometryConfiguration(limits, configuration.geometry);
  const children = yield* captureCitationOperationChildren();
  const callback = yield* Effect.serviceOption(CitationAnnotationAnnotator);
  const updater = yield* Effect.serviceOption(CitationAnnotationOffsetUpdater);
  return {
    geometry,
    children,
    callback,
    updater,
    xmlRuntime: CitationNativeProcessRuntime.make({ ...configuration.xmlRuntime }),
  };
});
const prepare = Effect.fn("Citation.prepareAnnotationEntry")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof own>>,
  raw: unknown
) {
  const mode = yield* S.decodeUnknownEffect(ModeProbe)(raw).pipe(Effect.mapError(invalid));
  const unicode = yield* makeCitationPythonUnicode(limits, "annotate").pipe(Effect.mapError(configurationFailure));
  const reserve = yield* captureCitationAnnotationReservation;
  const word = Effect.fn("Citation.prepareAnnotationSourceWord")(function* (value: CitationPythonUnicodeStorage) {
    return yield* unicode
      .fromStorageReserved(value, (units) =>
        units > limits.sourceUtf16
          ? Effect.fail(CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "sourceUtf16" }))
          : reserve(units)
      )
      .pipe(
        Effect.catchTag("CitationPythonUnicodeFailure", (error) =>
          failCitationAnnotationUnicode(limits, invalid, error)
        )
      );
  });
  const supplied = yield* S.decodeUnknownEffect(SourceProbe)(raw).pipe(Effect.mapError(invalid));
  const source = yield* word(supplied.source);
  const select = Effect.gen(function* () {
    if (O.isSome(owned.updater)) return { source, updater: owned.updater };
    const input = yield* S.decodeUnknownEffect(PlainProbe)(raw).pipe(Effect.mapError(invalid));
    const plain = yield* word(input.plain);
    if (source.pythonLength === 0 || nativeEqual(source.storage, plain.storage))
      return { source: plain, updater: O.none() };
    const mapped = yield* prepareCitationAnnotationSourceMap(
      limits,
      runtime,
      owned.geometry,
      plain.storage,
      source.storage
    );
    return { source: mapped.source, updater: O.some(mapped.updater) };
  });
  const selected = yield* select;
  const input = yield* S.decodeUnknownEffect(RowsProbe)(raw).pipe(Effect.mapError(invalid));
  if (input.replacements.length > limits.annotationReplacements)
    return yield* CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "annotationReplacements" });
  const replacements = yield* Effect.forEach(
    input.replacements,
    Effect.fn("Citation.ownAnnotationReplacement")(function* (row) {
      const before = yield* unicode
        .fromStorageReserved(row.before, reserve)
        .pipe(
          Effect.catchTag("CitationPythonUnicodeFailure", (error) =>
            failCitationAnnotationUnicode(limits, invalid, error)
          )
        );
      const after = yield* unicode
        .fromStorageReserved(row.after, reserve)
        .pipe(
          Effect.catchTag("CitationPythonUnicodeFailure", (error) =>
            failCitationAnnotationUnicode(limits, invalid, error)
          )
        );
      return CitationAnnotationReplacement.make({ ...row, before: before.storage, after: after.storage });
    })
  );
  const ordered = yield* prepareCitationAnnotations(limits, replacements, selected.updater);
  const render = Effect.gen(function* () {
    if (mode.mode === "unchecked") {
      const assembly = yield* makeCitationAnnotationAssembly(limits);
      return yield* assembly.assemble(selected.source, ordered);
    }
    const xml = yield* makeCitationXmlWorker(limits, owned.xmlRuntime);
    const processor = yield* (
      mode.mode === "skip" ? makeCitationSkipAnnotationSpans() : makeCitationWrapAnnotationSpans(limits, runtime)
    ).pipe(Effect.provideService(CitationXmlBalance, xml));
    const assembly = yield* makeCitationAnnotationAssembly(limits).pipe(
      Effect.provideService(CitationAnnotationSpanProcessor, processor)
    );
    return yield* assembly.assemble(selected.source, ordered);
  });
  return yield* render;
});
const prepareOwned = Effect.fn("Citation.annotateOwnedEntry")(
  (
    limits: CitationEngineLimits,
    runtime: CitationNativeProcessRuntime,
    owned: Effect.Success<ReturnType<typeof own>>,
    raw: unknown
  ) =>
    prepare(limits, runtime, owned, raw).pipe(
      Effect.updateContext((context: Context.Context<Effect.Services<ReturnType<typeof prepare>>>) => {
        const clean = context.pipe(Context.omit(CitationAnnotationAnnotator, CitationAnnotationSpanProcessor));
        return O.isSome(owned.callback) ? Context.add(clean, CitationAnnotationAnnotator, owned.callback.value) : clean;
      }),
      Effect.provideContext(owned.children),
      Effect.catchTag("CitationSafetyLimitExceeded", (error) => error.pipe(citationAnnotationSafety, Effect.fail))
    )
);
const install = makeCitationMetadataStage({
  method: "annotate",
  schema: S.toType(CitationAnnotationEntryConfiguration),
  invalid: configurationFailure,
  own,
  prepare: prepareOwned,
  project: (text: CitationPythonUnicodeStorage, reservedUnits: number) =>
    CitationAnnotationEntryResult.make({ text, reservedUnits }),
});
/** One admitted native operation with fresh Scope/budget by default. The native
 * profile composes default DMP mapping or a captured updater, all markup modes
 * and an optional captured annotator. General host values, builtin difflib and
 * verified raw-source/public engine dispatch remain separate required work.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationAnnotationEntry = Effect.fn("Citation.makeAnnotationEntry")(
  (policy: unknown, runtime: unknown, configuration: unknown) =>
    install(policy, runtime, configuration).pipe(Effect.provideService(CitationRegexOperation, "annotate"))
);
