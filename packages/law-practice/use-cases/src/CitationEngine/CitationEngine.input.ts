/** Server-only source and extraction-option components; no client transport.
 * Builtin names/defaults adapt eyecite 2.7.6, Free Law Project, BSD-2-Clause.
 * See THIRD_PARTY_NOTICES.md.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { CitationMentionReceipt } from "@beep/law-practice-domain/values";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CitationEngineAbsoluteMaxima } from "./CitationEngine.limits.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.input");
/** Pinned builtin cleaner names; custom callables belong to injected services.
 * **Example** (Recognize HTML cleaning)
 * ```ts
 * import { CitationBuiltinCleanerName } from "@beep/law-practice-use-cases/server"
 * console.log(CitationBuiltinCleanerName.is.html("html")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationBuiltinCleanerName = LiteralKit([
  "html",
  "inline_whitespace",
  "all_whitespace",
  "underscores",
  "xml",
]).pipe(
  $I.annoteSchema("CitationBuiltinCleanerName", {
    description: "Pinned builtin selection; never an executable request callback.",
  })
);
/** Schema-derived builtin name.
 * **Example** (Type a cleaner)
 * ```ts
 * import type { CitationBuiltinCleanerName } from "@beep/law-practice-use-cases/server"
 * const cleaner: CitationBuiltinCleanerName = "html"
 * console.log(cleaner) // "html"
 * ```
 * @category models
 * @since 0.0.0
 */
export type CitationBuiltinCleanerName = typeof CitationBuiltinCleanerName.Type;
/** Original named container behavior, including one-shot generator consumption.
 * **Example** (Recognize a list)
 * ```ts
 * import { CitationCleanerContainerKind } from "@beep/law-practice-use-cases/server"
 * console.log(CitationCleanerContainerKind.is.list("list")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationCleanerContainerKind = LiteralKit(["list", "tuple", "generator"]).pipe(
  $I.annoteSchema("CitationCleanerContainerKind", { description: "Named server-owned cleaner container mode." })
);
/** Schema-derived container mode.
 * **Example** (Type a container)
 * ```ts
 * import type { CitationCleanerContainerKind } from "@beep/law-practice-use-cases/server"
 * const container: CitationCleanerContainerKind = "list"
 * console.log(container) // "list"
 * ```
 * @category models
 * @since 0.0.0
 */
export type CitationCleanerContainerKind = typeof CitationCleanerContainerKind.Type;
/** Which original primitive argument receives this source manifestation.
 * **Example** (Recognize markup input)
 * ```ts
 * import { CitationSourceRole } from "@beep/law-practice-use-cases/server"
 * console.log(CitationSourceRole.is.markup("markup")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationSourceRole = LiteralKit(["plain", "markup"]).pipe(
  $I.annoteSchema("CitationSourceRole", { description: "Source argument role without guessing from raw text content." })
);
/** Schema-derived source role.
 * **Example** (Type a source role)
 * ```ts
 * import type { CitationSourceRole } from "@beep/law-practice-use-cases/server"
 * const role: CitationSourceRole = "plain"
 * console.log(role) // "plain"
 * ```
 * @category models
 * @since 0.0.0
 */
export type CitationSourceRole = typeof CitationSourceRole.Type;
/** One raw source component. Identity/text are independently checked against the
 * injected canonical source resolver before any verified capability is issued.
 * This component is not the complete multi-source/retained-document engine API.
 * **Example** (Inspect raw source ownership)
 * ```ts
 * import { CitationEngineSourceInput } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineSourceInput.fields.sourceText !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineSourceInput extends S.Opaque<CitationEngineSourceInput, { readonly brand: unique symbol }>()(
  S.Struct({
    source: SourceTextIdentity,
    sourceText: S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16)),
    role: CitationSourceRole.pipe(S.withDecodingDefaultKey(Effect.succeed<"plain">("plain"))),
  }).pipe(
    $I.annoteSchema("CitationEngineSourceInput", {
      description: "Server-only raw identity/text component; structural data alone grants no source proof.",
    })
  )
) {}
/** Select an installed server cleaner plan without serializing its callbacks.
 * **Example** (Choose captured server behavior)
 * ```ts
 * import { CitationEngineCleanerPlan } from "@beep/law-practice-use-cases/server"
 * const selection = CitationEngineCleanerPlan.make({ plan: "quotes/v1" })
 * console.log(selection.plan)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineCleanerPlan extends S.Opaque<CitationEngineCleanerPlan, { readonly brand: unique symbol }>()(
  S.Struct({ plan: S.NonEmptyString.check(S.isMaxLength(4096)) }).pipe(
    $I.annoteSchema("CitationEngineCleanerPlan", {
      description: "A bounded installed plan selector; live cleaner containers and callbacks remain server-owned.",
    })
  )
) {}
/** Named extraction modes. None and an empty cleaner list remain distinct;
 * callable cleaners and tokenizer implementations are captured server ports.
 * **Example** (Decode normal defaults)
 * ```ts
 * import { CitationEngineExtractionOptions } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 * const defaults = S.decodeEffect(CitationEngineExtractionOptions)({})
 * console.log(typeof defaults) // "object"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineExtractionOptions extends S.Opaque<
  CitationEngineExtractionOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    cleanSteps: S.Union([
      S.Array(CitationBuiltinCleanerName).check(S.isMaxLength(CitationEngineAbsoluteMaxima.resolutionIterations)),
      CitationEngineCleanerPlan,
    ]).pipe(S.NullOr, S.withDecodingDefaultKey(Effect.succeed(null))),
    container: CitationCleanerContainerKind.pipe(S.withDecodingDefaultKey(Effect.succeed<"list">("list"))),
    removeAmbiguous: S.Boolean.pipe(S.withDecodingDefaultKey(Effect.succeed(false))),
  }).pipe(
    $I.annoteSchema("CitationEngineExtractionOptions", {
      description:
        "Schema-owned builtin or captured-plan selection with original None/list distinction and no executable fields.",
    })
  )
) {}

const SourceSlot = S.Struct({
  source: CitationEngineSourceInput.fields.source,
  sourceText: CitationEngineSourceInput.fields.sourceText,
}).pipe(
  $I.annoteSchema("SourceSlot", { description: "One independently verifiable raw source in a named argument slot." })
);
/** Raw primitive plain/markup arguments with independent source identities.
 * Null means no supplied source; an empty supplied text retains its identity.
 * Slot names own the roles. Custom callables remain captured server services.
 * This covers primitive sources, not retained Document dispatch.
 * **Example** (Inspect paired source ownership)
 * ```ts
 * import { CitationEngineSourcePairInput } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineSourcePairInput.fields.plain !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineSourcePairInput extends S.Opaque<
  CitationEngineSourcePairInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plain: S.NullOr(SourceSlot).pipe(S.withDecodingDefaultKey(Effect.succeed(null))),
    markup: S.NullOr(SourceSlot).pipe(S.withDecodingDefaultKey(Effect.succeed(null))),
    ...CitationEngineExtractionOptions.fields,
  }).pipe(
    $I.annoteSchema("CitationEngineSourcePairInput", {
      description: "Server-only primitive source pair and named modes; decoding alone grants no source proof.",
    })
  )
) {}

/** Raw source and structural mention receipts for re-verification before legal
 * resolution. Receipts never grant source authority; the engine verifies the
 * source, anchors and mention IDs against its captured implementation identity.
 * Frozen edition spellings and policy are obtained from installed services.
 * **Example** (Inspect resolver evidence input)
 * ```ts
 * import { CitationEngineResolutionInput } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineResolutionInput.fields.mentions !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineResolutionInput extends S.Opaque<
  CitationEngineResolutionInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    source: CitationEngineSourceInput.fields.source,
    sourceText: CitationEngineSourceInput.fields.sourceText,
    mentions: S.Array(CitationMentionReceipt).check(S.isMaxLength(CitationEngineAbsoluteMaxima.mentions)),
  }).pipe(
    $I.annoteSchema("CitationEngineResolutionInput", {
      description:
        "Raw canonical source and bounded structural occurrence receipts; no caller policy, vocabulary or proof authority.",
    })
  )
) {}

/** Raw canonical source and a captured server cleaner-plan selector. A plan name
 * selects registered behavior; it never contains an iterator or callback.
 * **Example** (Inspect cleaner selection)
 * ```ts
 * import { CitationEngineCleanInput } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineCleanInput.fields.plan !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineCleanInput extends S.Opaque<CitationEngineCleanInput, { readonly brand: unique symbol }>()(
  S.Struct({
    source: CitationEngineSourceInput.fields.source,
    sourceText: CitationEngineSourceInput.fields.sourceText,
    plan: S.NonEmptyString.check(S.isMaxLength(4096)),
  }).pipe(
    $I.annoteSchema("CitationEngineCleanInput", {
      description:
        "Raw source identity/text and a bounded installed server-plan name, without executable request data.",
    })
  )
) {}
