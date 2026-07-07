import {
  ExtractionCandidate,
  GroundedExtraction,
  LangExtractError,
  LangExtractRequest,
  parseModelOutput,
} from "@beep/langextract/Extraction";
import { ExtractionTarget } from "@beep/langextract/Target";
import { DocumentId } from "@beep/nlp/Core";
import { Contract, UnitInterval } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ExtractionCandidates = S.Array(ExtractionCandidate);
const ExtractionCandidatesArbitrary = S.toArbitrary(ExtractionCandidates);
const ExtractionCandidatesEquivalence = S.toEquivalence(ExtractionCandidates);
const encodeCandidateArrayJson = S.encodeUnknownEffect(S.fromJsonString(ExtractionCandidates));
const encodeCandidateEnvelopeJson = S.encodeUnknownEffect(
  S.fromJsonString(S.Struct({ extractions: ExtractionCandidates }))
);
const encodeGroundedExtraction = S.encodeUnknownEffect(GroundedExtraction);

describe("parseModelOutput", () => {
  it.effect(
    "decodes fenced JSON objects",
    Effect.fnUntraced(function* () {
      const candidates = yield* parseModelOutput(`\`\`\`json
{"extractions":[{"label":"person","text":"Alice","confidence":0.9}]}
\`\`\``);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]?.label).toBe("person");
      expect(candidates[0]?.confidence).toBe(0.9);
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
      { numRuns: 50 }
    ));

  it.effect(
    "keeps grounded-constructor encoded optional-key shape unchanged",
    Effect.fnUntraced(function* () {
      const unaligned = GroundedExtraction.fromCandidate(
        ExtractionCandidate.make({ label: "person", text: "Ada Lovelace" }),
        "unaligned"
      );
      const aligned = GroundedExtraction.fromCandidate(
        ExtractionCandidate.make({
          attributes: { source: "fixture" },
          confidence: UnitInterval.make(0.9),
          label: "person",
          text: "Ada Lovelace",
        }),
        "match_exact",
        Contract.Span.make({ end: NonNegativeInt.make(12), start: NonNegativeInt.make(0) }),
        "Ada Lovelace"
      );

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
    "maps invalid output to a typed LangExtract error",
    Effect.fnUntraced(function* () {
      const error = yield* parseModelOutput(`{"extractions":[{"label":"","text":"Alice"}]}`).pipe(Effect.flip);

      expect(error).toBeInstanceOf(LangExtractError);
      expect(error.reason).toBe("model-output-schema-invalid");
      expect(error.details?.cause).toBe("schema-decode-failed");
    })
  );

  it.effect(
    "maps malformed JSON to a parse failure",
    Effect.fnUntraced(function* () {
      const error = yield* parseModelOutput(`{"extractions":[`).pipe(Effect.flip);

      expect(error).toBeInstanceOf(LangExtractError);
      expect(error.reason).toBe("model-output-parse-failed");
      expect(error.details?.cause).toBe("json-parse-failed");
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

      const request = yield* S.decodeUnknownEffect(LangExtractRequest)({
        documentId: DocumentId.make("doc-1"),
        targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
        text: "Alice founded Acme.",
      });

      expect(request.targets).toHaveLength(1);
    })
  );
});
