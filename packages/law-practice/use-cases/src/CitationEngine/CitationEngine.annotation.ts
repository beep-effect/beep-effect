/** Server-only annotation request data; callable behavior is captured in ports.
 * Native tuple behavior adapts eyecite 2.7.6, Free Law Project, BSD-2-Clause.
 * See THIRD_PARTY_NOTICES.md.
 * @packageDocumentation @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CitationEngineSourcePairInput } from "./CitationEngine.input.ts";
import { CitationEngineAbsoluteMaxima } from "./CitationEngine.limits.ts";
import { CitationPythonUnicodeStorage } from "./CitationEngine.runtime.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.annotation");
/** Named original annotation markup policy.
 * **Example** (Recognize wrap mode)
 * ```ts
 * import { CitationAnnotationMode } from "@beep/law-practice-use-cases/server"
 * console.log(CitationAnnotationMode.is.wrap("wrap")) // true
 * ```
 * @category models @since 0.0.0
 */
export const CitationAnnotationMode = LiteralKit(["unchecked", "skip", "wrap"]).pipe(
  $I.annoteSchema("CitationAnnotationMode", {
    description: "Original markup policy, validated before reading other request components.",
  })
);
/** @category models @since 0.0.0 */
export type CitationAnnotationMode = typeof CitationAnnotationMode.Type;
/** Prepared primitive annotation. Positions use Python points; no source proof is issued.
 * **Example** (Inspect replacement coordinates)
 * ```ts
 * import { CitationAnnotationReplacement } from "@beep/law-practice-use-cases/server"
 * console.log(CitationAnnotationReplacement.fields.start !== undefined) // true
 * ```
 * @category models @since 0.0.0
 */
export class CitationAnnotationReplacement extends S.Opaque<
  CitationAnnotationReplacement,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    start: S.Int,
    end: S.Int,
    before: CitationPythonUnicodeStorage,
    after: CitationPythonUnicodeStorage,
  }).pipe(
    $I.annoteSchema("CitationAnnotationReplacement", {
      description: "Native primitive annotation tuple after source-defined sorting and offset preparation.",
    })
  )
) {}
/** Primitive raw-source annotation request. Positions are Python code-point
 * offsets, including the source-defined negative and out-of-range slice rules;
 * they never assert verified UTF-16 anchors. Plain may be omitted only when a
 * captured offset updater selects markup. Validation of ignored slots remains
 * lazy at the service boundary. No request field contains a callback.
 * **Example** (Inspect annotation mode ownership)
 * ```ts
 * import { CitationEngineAnnotationInput } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineAnnotationInput.fields.mode !== undefined) // true
 * ```
 * @category models @since 0.0.0
 */
export class CitationEngineAnnotationInput extends S.Opaque<
  CitationEngineAnnotationInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plain: S.optionalKey(CitationEngineSourcePairInput.fields.plain),
    markup: CitationEngineSourcePairInput.fields.markup,
    mode: CitationAnnotationMode.pipe(S.withDecodingDefaultKey(Effect.succeed("unchecked"))),
    replacements: S.Array(CitationAnnotationReplacement).check(
      S.isMaxLength(CitationEngineAbsoluteMaxima.annotationReplacements)
    ),
  }).pipe(
    $I.annoteSchema("CitationEngineAnnotationInput", {
      description:
        "Primitive annotation data with raw source identities, named markup mode and native replacement tuples.",
    })
  )
) {}
