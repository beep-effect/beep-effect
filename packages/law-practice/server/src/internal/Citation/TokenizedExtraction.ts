/** Connect the original builtin tokenizer to get_citations construction.
 * eyecite 2.7.6, Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { captureCitationExtractionChildren } from "./ExtractionChildren.ts";
import {
  CitationExtractionLoopConfiguration,
  CitationExtractionLoopInput,
  CitationExtractionLoopResult,
  makeCitationExtractionLoop,
} from "./ExtractionLoop.ts";
import { detachCitationMetadataConfiguration, makeCitationMetadataStage } from "./MetadataComposition.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { CitationTokenizerConfiguration, CitationTokenizerResult, makeCitationTokenizer } from "./Tokenizer.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/TokenizedExtraction");
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "missing-token"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed tokenizer/loop handoff failures without native input or partial models.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationTokenizedExtractionFailure extends S.TaggedError<
  CitationTokenizedExtractionFailure,
  { readonly brand: unique symbol }
>($I`CitationTokenizedExtractionFailure`)(
  "CitationTokenizedExtractionFailure",
  { reason: Reason },
  $I.annoteError<CitationTokenizedExtractionFailure>("CitationTokenizedExtractionFailure", {
    description: "Native text extraction failed without text, tokens, nested causes or partial output.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationTokenizedExtractionFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationTokenizedExtractionConfiguration extends S.Opaque<
  CitationTokenizedExtractionConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({ tokenizer: CitationTokenizerConfiguration, loop: CitationExtractionLoopConfiguration }).pipe(
    $I.annoteSchema("CitationTokenizedExtractionConfiguration", {
      description: "Existing owned tokenizer and construction configurations; no raw-request program authority.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationTokenizedExtractionInput extends S.Opaque<
  CitationTokenizedExtractionInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plain: CitationExtractionLoopInput.fields.plain,
    markup: CitationExtractionLoopInput.fields.markup,
    geometry: CitationExtractionLoopInput.fields.geometry,
    removeAmbiguous: CitationExtractionLoopInput.fields.removeAmbiguous,
  }).pipe(
    $I.annoteSchema("CitationTokenizedExtractionInput", {
      description: "Owned native Document text and optional prepared maps; no caller-supplied words, tokens or models.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationTokenizedExtractionResult extends S.Opaque<
  CitationTokenizedExtractionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    tokenizer: CitationTokenizerResult,
    extraction: CitationExtractionLoopResult,
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationTokenizedExtractionResult", {
      description: "Completed builtin tokenization and extraction with one enclosing reservation total.",
    })
  )
) {}
const Input = S.toType(CitationTokenizedExtractionInput);
const Configuration = S.toType(CitationTokenizedExtractionConfiguration);
const ConfigurationJson = Configuration.pipe(S.toCodecJson);
const own = Effect.fn("Citation.ownTokenizedExtraction")(function* (
  _limits: CitationEngineLimits,
  configuration: CitationTokenizedExtractionConfiguration
) {
  const config = yield* detachCitationMetadataConfiguration(ConfigurationJson, configuration, () =>
    fail("invalid-configuration")
  );
  const children = yield* captureCitationExtractionChildren();
  return { config, children };
});
const prepare = Effect.fn("Citation.tokenizeAndExtract")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof own>>,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  return yield* Effect.gen(function* () {
    const tokenizer = yield* makeCitationTokenizer(limits, runtime, owned.config.tokenizer);
    const loop = yield* makeCitationExtractionLoop(limits, runtime, owned.config.loop);
    const tokenized = yield* tokenizer.run(request.plain);
    const input = yield* makeCitationRegexInput(limits, "source");
    const source = yield* input.prepareUnicode(tokenized.source, () => Effect.void);
    const tokens = HashMap.fromIterable(A.map(tokenized.tokens, (row) => Tuple.make(row.id, row.seed)));
    const lookup = (id: number) => Effect.fromOption(HashMap.get(tokens, id), () => fail("missing-token"));
    const words = yield* Effect.forEach(
      tokenized.assembly.items,
      Effect.fnUntraced(function* (item) {
        if (item._tag === "Text") {
          const data = yield* source.slice(item, () => Effect.void);
          return { kind: "Text", data, start: null, groups: {} };
        }
        const token = yield* lookup(item.id);
        return { kind: token.kind, data: token.data, start: token.start, groups: token.groups };
      }),
      { concurrency: 1 }
    );
    const citations = yield* Effect.forEach(
      tokenized.assembly.citations,
      Effect.fnUntraced(function* ([index, id]) {
        const token = yield* lookup(id);
        return { index, token };
      }),
      { concurrency: 1 }
    );
    const extraction = yield* loop.extract({ ...request, plain: tokenized.source, words, tokens: citations });
    return { tokenizer: tokenized, extraction };
  }).pipe(Effect.provideContext(owned.children));
});
/** Tokenize native Document text and construct/filter citations under one captured
 * admission, Scope, deadline and text authority. Input cleaning and the joke
 * shortcut remain upstream entry duties. Returned extract requires R=never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTokenizedExtraction = makeCitationMetadataStage({
  method: "extract",
  schema: Configuration,
  invalid: () => fail("invalid-configuration"),
  own,
  prepare,
  project: (result, reservedUnits) => {
    const completed = CitationTokenizedExtractionResult.make({ ...result, reservedUnits });
    // Retain the loop's proved cross-list identity after structural validation.
    const restored: CitationTokenizedExtractionResult = { ...completed, extraction: result.extraction };
    return restored;
  },
});
