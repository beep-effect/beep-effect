/**
 * Deterministic provider-neutral prompt construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { LangExtractError } from "@beep/langextract/Extraction";
import { ExtractionExample } from "@beep/langextract/Target";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import { Effect } from "effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import type { LangExtractRequest } from "@beep/langextract/Extraction";

const $I = $LangExtractId.create("Service");

const PromptExampleEnvelope = ExtractionExample.mapFields(({ extractions }) => ({ extractions })).pipe(
  SchemaUtils.withStatics((schema) => ({
    encodeEffectFromJsonString: S.encodeEffect(S.fromJsonString(schema)),
  })),
  $I.annoteSchema("PromptExampleEnvelope", {
    description: "JSON envelope containing expected extractions for one few-shot LangExtract prompt example.",
  })
);

const renderTarget = (target: LangExtractRequest["targets"][number]): string => {
  const attributes = A.match(target.attributes, {
    onEmpty: () => "",
    onNonEmpty: (attributes) => ` attributes=${A.join(attributes, ",")}`,
  });
  const description = O.match(target.description, {
    onNone: () => "",
    onSome: (description) => ` description=${description}`,
  });
  return `- ${target.name} kind=${target.kind}${attributes}${description}`;
};

const renderExample = Effect.fnUntraced(function* (example: ExtractionExample) {
  const encoded = yield* PromptExampleEnvelope.encodeEffectFromJsonString({
    extractions: example.extractions,
  }).pipe(
    Effect.mapError(() =>
      LangExtractError.fromReason("prompt-encoding-failed", {
        message: "Could not encode a LangExtract prompt example.",
      })
    )
  );
  return `${example.text}\n${encoded}`;
});

const renderExamples = (examples: LangExtractRequest["examples"]): Effect.Effect<string, LangExtractError> =>
  A.match(examples, {
    onEmpty: () => Effect.succeed(""),
    onNonEmpty: (examples) =>
      Effect.map(Effect.forEach(examples, renderExample), (rendered) => `\nExamples:\n${A.join(rendered, "\n\n")}`),
  });

/**
 * Build the deterministic provider-neutral extraction prompt.
 *
 * **Example** (Build extraction prompt)
 *
 * ```ts
 * import { LangExtractRequest } from "@beep/langextract/Extraction"
 * import { buildPrompt } from "@beep/langextract/Service"
 * import { ExtractionTarget } from "@beep/langextract/Target"
 * import { DocumentId } from "@beep/nlp/Core"
 * import { Effect } from "effect"
 *
 * const request = LangExtractRequest.make({
 *   documentId: DocumentId.make("doc-1"),
 *   targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
 *   text: "Ada Lovelace wrote notes."
 * })
 * Effect.runPromise(buildPrompt(request)).then(console.log)
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const buildPrompt = Effect.fn("LangExtractService.buildPrompt")(function* (request: LangExtractRequest) {
  const examples = yield* renderExamples(request.examples);
  return `Extract structured information from the source text.
Return only JSON using this shape: {"extractions":[{"label":"target-name","text":"source text","attributes":{},"confidence":0.0}]}.
Use exact text copied from the source whenever possible. Do not invent offsets.

Targets:
${pipe(request.targets, A.map(renderTarget), A.join("\n"))}${examples}

Source:
${request.text}`;
});
