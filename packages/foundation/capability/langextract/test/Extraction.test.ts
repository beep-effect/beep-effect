import {
  ExtractionCandidate,
  GroundedExtraction,
  LangExtractError,
  LangExtractRequest,
  MAX_CANDIDATE_TEXT_LENGTH,
  parseModelOutput,
} from "@beep/langextract/Extraction";
import { DocumentId } from "@beep/nlp/Core";
import { Contract, UnitInterval } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import * as O from "@beep/utils/Option";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const ExtractionCandidates = S.Array(ExtractionCandidate);
const ExtractionCandidatesArbitrary = S.toArbitrary(ExtractionCandidates)(fc);
const ExtractionCandidatesEquivalence = S.toEquivalence(ExtractionCandidates);
const encodeCandidateArrayJson = S.encodeUnknownEffect(S.fromJsonString(ExtractionCandidates));
const encodeCandidateEnvelopeJson = S.encodeUnknownEffect(
  S.fromJsonString(S.Struct({ extractions: ExtractionCandidates }))
);
const encodeGroundedExtraction = S.encodeUnknownEffect(GroundedExtraction);
const encodeLangExtractRequest = S.encodeUnknownEffect(LangExtractRequest);

describe("parseModelOutput", () => {
  it("constructs typed errors through the data-last form", () => {
    const error = LangExtractError.fromReason({ message: "Invalid model output." })("model-output-schema-invalid");

    expect(error.reason).toBe("model-output-schema-invalid");
  });

  it.effect(
    "decodes fenced JSON objects",
    Effect.fnUntraced(function* () {
      const candidates = yield* parseModelOutput(`\`\`\`json
{"extractions":[{"label":"person","text":"Alice","confidence":0.9}]}
\`\`\``);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]?.label).toBe("person");
      expect(candidates[0]?.confidence).toStrictEqual(O.some(UnitInterval.make(0.9)));
    })
  );

  it.effect(
    "decodes top-level arrays",
    Effect.fnUntraced(function* () {
      const candidates = yield* parseModelOutput(`[{"label":"organization","text":"Acme"}]`);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]?.text).toBe("Acme");
    })
  );

  it("round-trips schema-derived candidates from both accepted wire shapes", () =>
    fc.assert(
      fc.property(ExtractionCandidatesArbitrary, (candidates) => {
        const fromArray = Effect.runSync(
          Effect.gen(function* () {
            const text = yield* encodeCandidateArrayJson(candidates);
            return yield* parseModelOutput(text);
          })
        );
        const fromEnvelope = Effect.runSync(
          Effect.gen(function* () {
            const text = yield* encodeCandidateEnvelopeJson({ extractions: candidates });
            return yield* parseModelOutput(text);
          })
        );

        expect(ExtractionCandidatesEquivalence(fromArray, candidates)).toBe(true);
        expect(ExtractionCandidatesEquivalence(fromEnvelope, candidates)).toBe(true);
      }),
      fcRuns(50)
    ));

  it.effect(
    "keeps grounded-case encoded optional-key shape unchanged",
    Effect.fnUntraced(function* () {
      const unaligned = GroundedExtraction.cases.unaligned.make({ label: "person", text: "Ada Lovelace" });
      const aligned = GroundedExtraction.cases.match_exact.make({
        attributes: O.some({ source: "fixture" }),
        confidence: O.some(UnitInterval.make(0.9)),
        label: "person",
        matchedText: "Ada Lovelace",
        span: Contract.Span.make({ end: NonNegativeInt.make(12), start: NonNegativeInt.make(0) }),
        text: "Ada Lovelace",
      });

      const encodedUnaligned = yield* encodeGroundedExtraction(unaligned);
      const encodedAligned = yield* encodeGroundedExtraction(aligned);

      expect(encodedUnaligned).toEqual({
        alignmentStatus: "unaligned",
        label: "person",
        text: "Ada Lovelace",
      });
      expect(encodedAligned).toEqual({
        alignmentStatus: "match_exact",
        attributes: { source: "fixture" },
        confidence: 0.9,
        label: "person",
        matchedText: "Ada Lovelace",
        span: { end: 12, start: 0 },
        text: "Ada Lovelace",
      });
    })
  );

  it.effect(
    "rejects aligned extraction payloads without complete source evidence",
    Effect.fnUntraced(function* () {
      const missingSpan = yield* S.decodeUnknownEffect(GroundedExtraction)({
        alignmentStatus: "match_exact",
        label: "person",
        matchedText: "Ada Lovelace",
        text: "Ada Lovelace",
      }).pipe(Effect.flip);
      const missingMatchedText = yield* S.decodeUnknownEffect(GroundedExtraction)({
        alignmentStatus: "match_exact",
        label: "person",
        span: Contract.Span.make({ end: NonNegativeInt.make(12), start: NonNegativeInt.make(0) }),
        text: "Ada Lovelace",
      }).pipe(Effect.flip);

      expect(missingSpan).toBeDefined();
      expect(missingMatchedText).toBeDefined();
    })
  );

  it.effect(
    "reuses candidate bounds for grounded extraction fields",
    Effect.fnUntraced(function* () {
      const oversizedText = Str.repeat(MAX_CANDIDATE_TEXT_LENGTH + 1)("x");
      const error = yield* S.decodeEffect(GroundedExtraction)({
        alignmentStatus: "unaligned",
        label: "person",
        text: oversizedText,
      }).pipe(Effect.flip);

      expect(error).toBeDefined();
    })
  );

  it.effect(
    "rejects whitespace-only candidate evidence without normalizing source text",
    Effect.fnUntraced(function* () {
      const error = yield* S.decodeEffect(ExtractionCandidate)({
        label: "person",
        text: "   \n",
      }).pipe(Effect.flip);

      expect(error).toBeDefined();
    })
  );

  it.effect(
    "maps invalid output to a typed LangExtract error",
    Effect.fnUntraced(function* () {
      const error = yield* parseModelOutput(`{"extractions":[{"label":"","text":"Alice"}]}`).pipe(Effect.flip);

      expect(error).toBeInstanceOf(LangExtractError);
      expect(error.reason).toBe("model-output-schema-invalid");
      expect(O.getOrUndefined(error.details)?.cause).toBe("schema-decode-failed");
    })
  );

  it.effect(
    "maps malformed JSON to a parse failure",
    Effect.fnUntraced(function* () {
      const error = yield* parseModelOutput(`{"extractions":[`).pipe(Effect.flip);

      expect(error).toBeInstanceOf(LangExtractError);
      expect(error.reason).toBe("model-output-parse-failed");
      expect(O.getOrUndefined(error.details)?.cause).toBe("json-parse-failed");
    })
  );

  it.effect(
    "requires at least one extraction target",
    Effect.fnUntraced(function* () {
      const error = yield* S.decodeUnknownEffect(LangExtractRequest)({
        documentId: DocumentId.make("doc-1"),
        targets: [],
        text: "Alice founded Acme.",
      }).pipe(Effect.flip);

      expect(error).toBeDefined();

      const request = yield* S.decodeEffect(LangExtractRequest)({
        documentId: DocumentId.make("doc-1"),
        targets: [{ kind: "entity", name: "person" }],
        text: "Alice founded Acme.",
      });

      expect(request.targets).toHaveLength(1);
      expect(request.targets[0]?.attributes).toEqual([]);
      expect(O.isNone(request.targets[0]?.description)).toBe(true);
      expect(request.examples).toEqual([]);
      expect(O.isNone(request.options.fuzzyThreshold)).toBe(true);
      expect(O.isNone(request.options.maxExtractions)).toBe(true);

      expect(yield* encodeLangExtractRequest(request)).toEqual({
        documentId: "doc-1",
        examples: [],
        options: {},
        targets: [{ attributes: [], kind: "entity", name: "person" }],
        text: "Alice founded Acme.",
      });
    })
  );
});
