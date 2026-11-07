/** Server-only tokenizer contract and native token/assembly data.
 * Behavioral fields adapt eyecite 2.7.6, Free Law Project, BSD-2-Clause;
 * see THIRD_PARTY_NOTICES.md. These plans grant no source-proof authority.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Bytes from "effect/Bytes";
import * as Context from "effect/Context";
import * as Equivalence from "effect/Equivalence";
import * as S from "effect/Schema";
import { CitationEngineAbsoluteMaxima } from "./CitationEngine.limits.ts";
import { CitationPythonUnicodeStorage } from "./CitationEngine.runtime.ts";
import type * as Effect from "effect/Effect";
import type { CitationSafetyLimitExceeded } from "./CitationEngine.safety.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.tokenizer");
const Kind = LiteralKit([
  "Token",
  "CitationToken",
  "SectionToken",
  "SupraToken",
  "IdToken",
  "ParagraphToken",
  "StopWordToken",
  "PlaceholderCitationToken",
  "CaseReferenceToken",
]).pipe($I.annoteSchema("Kind", { description: "Pinned builtin token class classification." }));
const TokenPosition = S.Int.check(
  S.isBetween({
    minimum: -CitationEngineAbsoluteMaxima.producedTextUtf16,
    maximum: CitationEngineAbsoluteMaxima.producedTextUtf16,
  })
).pipe($I.annoteSchema("TokenPosition", { description: "Bounded signed native token code-point position." }));
const Native = S.NullOr(
  CitationPythonUnicodeStorage.pipe(
    S.overrideToEquivalence(() => Equivalence.Struct({ width: Equivalence.Number, bytes: Bytes.Equivalence }))
  )
).pipe($I.annoteSchema("Native", { description: "Optional native Unicode storage with exact byte equivalence." }));
const Groups = S.Record(S.String.check(S.isMaxLength(256)), Native).pipe(
  $I.annoteSchema("Groups", { description: "Captured native group values with absent/null keys preserved." })
);
const Editions = S.Array(S.Natural)
  .check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates))
  .pipe($I.annoteSchema("Editions", { description: "Edition ordinals bound to the captured frozen population." }));
/** Native token fields with frozen-population edition ordinals; this is not a semantic citation or source proof.
 * Positions are native code-point indices; they are not verified UTF-16 anchors.
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationTokenSeed } from "@beep/law-practice-use-cases/server"
 * console.log(CitationTokenSeed.fields.groups !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationTokenSeed extends S.Opaque<CitationTokenSeed, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: Kind,
    data: Native,
    start: TokenPosition,
    end: TokenPosition,
    groups: Groups,
    exact: Editions,
    variation: Editions,
    short: S.Boolean,
  }).pipe(
    $I.annoteSchema("CitationTokenSeed", {
      description:
        "Owned native source token fields; absent/null group keys and literal surrogate words stay distinct.",
    })
  )
) {}
const TextPosition = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16)).pipe(
  $I.annoteSchema("TextPosition", { description: "Bounded native code-point position in an assembly text gap." })
);
const Text = S.TaggedStruct("Text", { start: TextPosition, end: TextPosition }).pipe(
  $I.annoteSchema("Text", { description: "Native source text-gap range, not a verified anchor." })
);
const Token = S.TaggedStruct("Token", { id: S.Natural }).pipe(
  $I.annoteSchema("Token", { description: "Operation-local token reference in assembly order." })
);
const Item = S.Union([Text, Token]).pipe(
  $I.annoteSchema("Item", { description: "Ordered native text gap or captured token reference." })
);
/** Mixed token/text spans and exact special-token indices in the captured tokenizer’s local identity space.
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationAssemblyResult } from "@beep/law-practice-use-cases/server"
 * console.log(CitationAssemblyResult.fields.items !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationAssemblyResult extends S.Opaque<CitationAssemblyResult, { readonly brand: unique symbol }>()(
  S.Struct({
    items: S.Array(Item).check(S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)),
    citations: S.Array(S.Tuple([S.Natural, S.Natural])).check(S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)),
  }).pipe(
    $I.annoteSchema("CitationAssemblyResult", {
      description: "Mixed token/text plans and exact special-token indices; identities refer to the captured host.",
    })
  )
) {}
const Reason = LiteralKit(["invalid-configuration", "invalid-source", "stage-failed"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed declared tokenizer execution failures." })
);
/** Declared tokenizer-port refusal without source, pattern bodies or nested native failures.
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationTokenizerFailure } from "@beep/law-practice-use-cases/server"
 * console.log(CitationTokenizerFailure.make({ reason: "invalid-source" }).reason) // "invalid-source"
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CitationTokenizerFailure extends S.TaggedError<
  CitationTokenizerFailure,
  { readonly brand: unique symbol }
>($I`CitationTokenizerFailure`)(
  "CitationTokenizerFailure",
  { reason: Reason },
  $I.annoteError<CitationTokenizerFailure>("CitationTokenizerFailure", {
    description: "Tokenizer composition failed without source payloads, patterns or causes.",
  })
) {}
/** Completed native tokenization plan. Adapters must bind edition ordinals and own immutable snapshots.
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationTokenizerResult } from "@beep/law-practice-use-cases/server"
 * console.log(CitationTokenizerResult.fields.patternsChecked !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationTokenizerResult extends S.Opaque<CitationTokenizerResult, { readonly brand: unique symbol }>()(
  S.Struct({
    source: CitationPythonUnicodeStorage,
    patternsChecked: S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.patternEvaluations)),
    assembly: CitationAssemblyResult,
    tokens: S.Array(S.Struct({ id: S.Natural, seed: CitationTokenSeed })).check(
      S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)
    ),
  }).pipe(
    $I.annoteSchema("CitationTokenizerResult", {
      description: "Complete native tokenizer plan with no partial-result success path or verified mention authority.",
    })
  )
) {}

/** Captured tokenizer for the existing native token-plan profile. Install the
 * adapter inside its owning operation Scope and allocation budget. Runtime
 * configuration and native worker controls remain server implementation details.
 * Source input is decoded against CitationPythonUnicodeStorage before execution.
 * Canonical mutable/custom-tokenizer object protocols remain qualification work;
 * publishing this interface does not close their accounting rows.
 * **Example** (Capture a tokenizer dependency)
 * ```ts
 * import { CitationTokenizer } from "@beep/law-practice-use-cases/server"
 * import * as Effect from "effect/Effect"
 * const captured = Effect.gen(function* () { return yield* CitationTokenizer })
 * console.log(typeof captured) // "object"
 * ```
 * @category services
 * @since 0.0.0
 */
export class CitationTokenizer extends Context.Service<
  CitationTokenizer,
  {
    readonly tokenize: (
      source: unknown
    ) => Effect.Effect<CitationTokenizerResult, CitationTokenizerFailure | CitationSafetyLimitExceeded>;
  }
>()($I`CitationTokenizer`) {}
