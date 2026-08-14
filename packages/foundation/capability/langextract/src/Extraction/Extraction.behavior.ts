/**
 * Model-output parsing behavior for the extraction boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import { MAX_EXTRACTION_CANDIDATES } from "./Extraction.config.ts";
import { LangExtractError } from "./Extraction.errors.ts";
import { ExtractionCandidate } from "./Extraction.model.ts";

const $I = $LangExtractId.create("Extraction");

const ModelOutputCandidates = S.Array(ExtractionCandidate).check(
  S.isMaxLength(MAX_EXTRACTION_CANDIDATES, {
    message: `Language model output must contain at most ${MAX_EXTRACTION_CANDIDATES} extraction candidates.`,
  })
);

class ModelOutputObject extends S.Class<ModelOutputObject>($I`ModelOutputObject`)(
  {
    extractions: ModelOutputCandidates,
  },
  $I.annote("ModelOutputObject", {
    description: "Internal JSON object shape returned by a language model.",
  })
) {}

const ModelOutput = S.Union([ModelOutputObject, ModelOutputCandidates]);
const decodeModelOutputJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeModelOutputPayload = S.decodeUnknownEffect(ModelOutput);
type ParsedModelOutput = ReadonlyArray<ExtractionCandidate> | ModelOutputObject;
const isCandidateArray = (output: ParsedModelOutput): output is ReadonlyArray<ExtractionCandidate> => A.isArray(output);

const stripJsonFence = (text: string): string => {
  const trimmed = Str.trim(text);
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed);
  return O.fromNullOr(fenced).pipe(
    O.flatMap(A.get(1)),
    O.map(Str.trim),
    O.getOrElse(() => trimmed)
  );
};

const outputToCandidates = (output: ParsedModelOutput): ReadonlyArray<ExtractionCandidate> =>
  isCandidateArray(output) ? output : output.extractions;

/**
 * Decode a model text response into extraction candidates.
 *
 * **Example** (Parse model JSON output)
 *
 * ```ts
 * import { parseModelOutput } from "@beep/langextract/Extraction"
 * import { Effect } from "effect"
 *
 * const program = parseModelOutput('{"extractions":[{"label":"person","text":"Ada Lovelace"}]}')
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Decodes model text in Effect so malformed output returns a typed LangExtractError.
 * @category parsing
 * @since 0.0.0
 */
export const parseModelOutput: (text: string) => Effect.Effect<ReadonlyArray<ExtractionCandidate>, LangExtractError> =
  flow(
    stripJsonFence,
    decodeModelOutputJson,
    Effect.mapError(() =>
      LangExtractError.fromReason("model-output-parse-failed", {
        details: { cause: "json-parse-failed" },
        message: "Language model output was not valid JSON.",
      })
    ),
    Effect.flatMap(decodeModelOutputPayload),
    Effect.catchTag("SchemaError", () =>
      Effect.fail(
        LangExtractError.fromReason("model-output-schema-invalid", {
          details: { cause: "schema-decode-failed" },
          message: "Language model output did not match the LangExtract response schema.",
        })
      )
    ),
    Effect.map(outputToCandidates),
    Effect.withSpan("LangExtract.parseModelOutput")
  );
