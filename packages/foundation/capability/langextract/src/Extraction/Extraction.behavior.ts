/**
 * Model-output parsing behavior for the extraction boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { Effect, Match } from "effect";
import * as A from "effect/Array";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import { MAX_EXTRACTION_CANDIDATES } from "./Extraction.config.ts";
import { LangExtractError } from "./Extraction.errors.ts";
import { ExtractionCandidate } from "./Extraction.model.ts";

const $I = $LangExtractId.create("Extraction");

const ModelOutputCandidates = S.Array(ExtractionCandidate)
  .check(
    S.isMaxLength(MAX_EXTRACTION_CANDIDATES, {
      identifier: $I`ModelOutputCandidatesMaxLengthCheck`,
      title: "Model Output Candidate Limit",
      description: "Checks that one language-model response stays within the bounded extraction-candidate limit.",
      message: `Language model output must contain at most ${MAX_EXTRACTION_CANDIDATES} extraction candidates.`,
    })
  )
  .pipe(
    $I.annoteSchema("ModelOutputCandidates", {
      description: "Bounded extraction candidates accepted from one language-model response.",
    })
  );

const ModelOutputJson = S.fromJsonString(S.Unknown).pipe(
  $I.annoteSchema("ModelOutputJson", {
    description: "JSON text emitted by a language model before response-shape validation.",
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeUnknownEffect: S.decodeUnknownEffect(schema),
  }))
);

class ModelOutputObject extends S.Class<ModelOutputObject>($I`ModelOutputObject`)(
  {
    extractions: ModelOutputCandidates,
  },
  $I.annote("ModelOutputObject", {
    description: "Internal JSON object shape returned by a language model.",
  })
) {}

const ModelOutput = S.Union([ModelOutputObject, ModelOutputCandidates]).pipe(
  $I.annoteSchema("ModelOutput", {
    description: "Accepted array or object-envelope shape for one language-model extraction response.",
  }),
  SchemaUtils.withStatics((schema) => {
    const isCandidateArray = S.is(ModelOutputCandidates);

    return {
      decodeUnknownEffect: S.decodeUnknownEffect(schema),
      toCandidates: (output: typeof schema.Type): ReadonlyArray<ExtractionCandidate> =>
        Match.value(output).pipe(
          Match.when(isCandidateArray, (candidates) => candidates),
          Match.orElse((envelope) => envelope.extractions)
        ),
    };
  })
);

const stripJsonFence = (text: string): string => {
  const trimmed = Str.trim(text);
  return Str.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)(trimmed).pipe(
    O.flatMap(A.get(1)),
    O.map(Str.trim),
    O.getOrElse(() => trimmed)
  );
};

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
    ModelOutputJson.decodeUnknownEffect,
    Effect.mapError(() =>
      LangExtractError.fromReason("model-output-parse-failed", {
        details: { cause: "json-parse-failed" },
        message: "Language model output was not valid JSON.",
      })
    ),
    Effect.flatMap(ModelOutput.decodeUnknownEffect),
    Effect.catchTag("SchemaError", () =>
      Effect.fail(
        LangExtractError.fromReason("model-output-schema-invalid", {
          details: { cause: "schema-decode-failed" },
          message: "Language model output did not match the LangExtract response schema.",
        })
      )
    ),
    Effect.map(ModelOutput.toCandidates),
    Effect.withSpan("LangExtract.parseModelOutput")
  );
