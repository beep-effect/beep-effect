import { LangExtractRequest } from "@beep/langextract/Extraction";
import {
  layer as LangExtractLayer,
  LangExtractService,
  remoteExtractionPolicyFromConfig,
} from "@beep/langextract/Service";
import { Distinction, DistinctionDetail } from "@beep/law-practice-domain";
import { LawPracticeServerLive } from "@beep/law-practice-server/layer";
import { IrToLaw, IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw";
import { OfficeActionReview, officeActionExtractionTargets } from "@beep/law-practice-use-cases/OfficeActionReview";
import { DocumentId } from "@beep/nlp/Core";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Stream } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import {
  EXPECTED_DISTINCTION_LIMITATION,
  EXPECTED_DISTINCTION_QUOTE,
  makeOfficeActionReviewInput,
  OFFICE_ACTION_FIXTURE,
} from "./fixture.ts";

const OFFICE_ACTION_MODEL_OUTPUT = `{"extractions":[{"label":"office_action","text":"Office Action"},{"label":"claim","text":"A widget comprising a lid and a base."},{"label":"rejection_reference","text":"Smith"},{"label":"distinction","text":"a hinge coupling the lid to the base"}]}`;

const UNALIGNED_DISTINCTION_MODEL_OUTPUT = `{"extractions":[{"label":"office_action","text":"Office Action"},{"label":"claim","text":"A widget comprising a lid and a base."},{"label":"rejection_reference","text":"Smith"},{"label":"distinction","text":"an impossible limitation"}]}`;

const MISSING_DISTINCTION_MODEL_OUTPUT = `{"extractions":[{"label":"office_action","text":"Office Action"},{"label":"claim","text":"A widget comprising a lid and a base."},{"label":"rejection_reference","text":"Smith"}]}`;

const makeExtractionRequest = (): LangExtractRequest =>
  LangExtractRequest.make({
    documentId: DocumentId.make("office-action-review-test"),
    targets: officeActionExtractionTargets,
    text: OFFICE_ACTION_FIXTURE,
  });

const makeLanguageModelLayer = (text: string): Layer.Layer<LanguageModel.LanguageModel> =>
  Layer.succeed(LanguageModel.LanguageModel, {
    generateObject: () => Effect.die("generateObject is not used by law-practice tests") as never,
    generateText: () => Effect.succeed({ text }) as never,
    streamText: () => Stream.empty as never,
  } as LanguageModel.Service);

const TestLangExtractLayer = LangExtractLayer.pipe(Layer.provide(remoteExtractionPolicyFromConfig));

const makeLawPracticeServerTestLayer = (modelOutput: string) =>
  Layer.mergeAll(LawPracticeServerLive, TestLangExtractLayer).pipe(
    Layer.provide(makeLanguageModelLayer(modelOutput)),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_LANGEXTRACT_ALLOW_REMOTE: "true" }))),
    Layer.provide(BunCrypto.layer)
  );

const expectReviewExtractionError = Effect.fn("law_practice.server.test.expect_review_extraction_error")(function* (
  reason: IrToLawExtractionError["reason"],
  assert?: (error: IrToLawExtractionError) => void
) {
  const review = yield* OfficeActionReview;
  const input = yield* makeOfficeActionReviewInput();

  const error = yield* review.review(input).pipe(Effect.flip);

  expect(S.is(IrToLawExtractionError)(error)).toBe(true);
  if (S.is(IrToLawExtractionError)(error)) {
    expect(error.reason).toBe(reason);
    expect(error.label).toBe("distinction");
    assert?.(error);
  }
});

describe("@beep/law-practice-server", () => {
  it.layer(makeLawPracticeServerTestLayer(OFFICE_ACTION_MODEL_OUTPUT))(
    "office-action review loop over service-backed extraction",
    (it) => {
      it.effect("IrToLaw grounds exactly one distinction to its source anchor", () =>
        Effect.gen(function* () {
          const langExtract = yield* LangExtractService;
          const irToLaw = yield* IrToLaw;
          const extractionResult = yield* langExtract.extract(makeExtractionRequest());
          const extractions = extractionResult.extractions;

          // The distinction candidate is lower case vs the Title-Case source, so
          // alignment MUST take the case-insensitive `match_lesser` path (not a
          // trivial `match_exact`). This is what makes the re-slice below a real
          // grounding proof, and it rules out the fabricated span-undefined anchor
          // fallback in IrToLaw (which would yield `unaligned`/no span).
          const distinctionExtraction = extractions.find((e) => e.label === "distinction");
          expect(distinctionExtraction?.alignmentStatus).toBe("match_lesser");

          const law = yield* irToLaw.toLaw(extractions);

          // (a) exactly one Distinction, well-formed.
          expect(law.distinction).toBeInstanceOf(Distinction);
          const distinctionDetail = law.distinction.detail;
          expect(DistinctionDetail.guards.missing_limitation(distinctionDetail)).toBe(true);

          // (b) the anchor re-slices the source to its own quote, and that quote is
          // the original-case substring recovered via the case-insensitive match.
          const { endChar, quote, startChar } = law.distinction.anchor;
          expect(OFFICE_ACTION_FIXTURE.slice(startChar, endChar)).toBe(quote);
          expect(quote).toBe(EXPECTED_DISTINCTION_QUOTE);

          // (d) the distinction's answer: missing limitation + recovered anchor quote.
          DistinctionDetail.match(distinctionDetail, {
            missing_limitation: (detail) => expect(detail.limitation).toBe(EXPECTED_DISTINCTION_LIMITATION),
          });
        })
      );

      it.effect("review admits the claim, advancing it to shape_valid", () =>
        Effect.gen(function* () {
          const review = yield* OfficeActionReview;
          const input = yield* makeOfficeActionReviewInput();

          const view = yield* review.review(input);

          // (c) gate admits -> transition advances candidate -> shape_valid. The
          // claim ends at "shape_valid" (NOT lifecycle "admitted"), so admittedKeys
          // is empty — per SPEC "gate admits, lifecycle reaches shape_valid".
          expect(view.total).toBe(1);
          expect(view.counts.shape_valid).toBe(1);
          expect(view.counts.candidate).toBe(0);
          expect(view.counts.admitted).toBe(0);
          expect([...view.admittedKeys]).toEqual([]);
        })
      );
    }
  );

  it.layer(makeLawPracticeServerTestLayer(MISSING_DISTINCTION_MODEL_OUTPUT))(
    "office-action review loop with missing extraction output",
    (it) => {
      it.effect("review rejects a missing required distinction label before admission", () =>
        expectReviewExtractionError("required-extraction-missing")
      );
    }
  );

  it.layer(makeLawPracticeServerTestLayer(UNALIGNED_DISTINCTION_MODEL_OUTPUT))(
    "office-action review loop with unaligned extraction output",
    (it) => {
      it.effect("review rejects unaligned distinction text before admission", () =>
        expectReviewExtractionError("required-extraction-unaligned", (error) => {
          expect(error.alignmentStatus).toEqual(O.some("unaligned"));
        })
      );
    }
  );
});
