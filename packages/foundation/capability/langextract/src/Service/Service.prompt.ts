/**
 * Deterministic provider-neutral prompt construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { ExtractionExample } from "@beep/langextract/Target";
import * as A from "@beep/utils/Array";
import { identity, pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { LangExtractRequest } from "@beep/langextract/Extraction";

const $I = $LangExtractId.create("Service");

const PromptExampleEnvelope = ExtractionExample.mapFields(({ extractions }) => ({ extractions })).pipe(
  $I.annoteSchema("PromptExampleEnvelope", {
    description: "JSON envelope containing expected extractions for one few-shot LangExtract prompt example.",
  })
);
const encodePromptExampleEnvelope = S.encodeResult(S.fromJsonString(PromptExampleEnvelope));

const renderTarget = (target: LangExtractRequest["targets"][number]): string => {
  const attributes =
    P.isUndefined(target.attributes) || A.isReadonlyArrayEmpty(target.attributes)
      ? ""
      : ` attributes=${A.join(target.attributes, ",")}`;
  const description = P.isUndefined(target.description) ? "" : ` description=${target.description}`;
  return `- ${target.name} kind=${target.kind}${attributes}${description}`;
};

const renderExample = (example: ExtractionExample): string =>
  `${example.text}\n${pipe(
    encodePromptExampleEnvelope({ extractions: example.extractions }),
    Result.getOrThrowWith(identity)
  )}`;

const renderExamples = (request: LangExtractRequest): string => {
  if (P.isUndefined(request.examples) || A.isReadonlyArrayEmpty(request.examples)) {
    return "";
  }

  return `\nExamples:\n${pipe(request.examples, A.map(renderExample), A.join("\n\n"))}`;
};

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
 *
 * const request = LangExtractRequest.make({
 *   documentId: DocumentId.make("doc-1"),
 *   targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
 *   text: "Ada Lovelace wrote notes."
 * })
 * console.log(buildPrompt(request))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const buildPrompt = (
  request: LangExtractRequest
): string => `Extract structured information from the source text.
Return only JSON using this shape: {"extractions":[{"label":"target-name","text":"source text","attributes":{},"confidence":0.0}]}.
Use exact text copied from the source whenever possible. Do not invent offsets.

Targets:
${pipe(request.targets, A.map(renderTarget), A.join("\n"))}${renderExamples(request)}

Source:
${request.text}`;
