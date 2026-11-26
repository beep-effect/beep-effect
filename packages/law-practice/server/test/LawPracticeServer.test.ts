import { LangExtractRequest } from "@beep/langextract/Extraction";
import {
  layer as LangExtractLayer,
  LangExtractService,
  remoteExtractionPolicyFromConfig,
} from "@beep/langextract/Service";
import {
  Claim,
  Distinction,
  DistinctionDetail,
  OfficeAction,
  PriorArtReference,
  Rejection,
} from "@beep/law-practice-domain";
import { OfficeActionDistinctionGate } from "@beep/law-practice-domain/values/LawClaim";
import { LawPracticeServerLive } from "@beep/law-practice-server/layer";
import { LawClaimProposals } from "@beep/law-practice-use-cases/ClaimStore";
import { IrToLaw, IrToLawExtractionError } from "@beep/law-practice-use-cases/IrToLaw";
import { OfficeActionReview, officeActionExtractionTargets } from "@beep/law-practice-use-cases/OfficeActionReview";
import { it } from "@beep/test-runner";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Model from "effect/ai/Model";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  EXPECTED_DISTINCTION_LIMITATION,
  EXPECTED_DISTINCTION_QUOTE,
  makeOfficeActionReviewInput,
  OFFICE_ACTION_FIXTURE,
} from "./fixture.ts";
import { matterWallGrantingEveryScopeLayer } from "./MatterWall.fixtures.ts";

const isIrToLawExtractionError = S.is(IrToLawExtractionError);
const LawEntitiesJson = S.fromJsonString(
  S.Struct({
    claim: Claim,
    distinction: Distinction,
    officeAction: OfficeAction,
    priorArtReference: PriorArtReference,
    rejection: Rejection,
  }),
  { space: 2 }
);

const OFFICE_ACTION_MODEL_OUTPUT = `{"extractions":[{"label":"office_action","text":"Office Action"},{"label":"claim","text":"A widget comprising a lid and a base."},{"label":"rejection_reference","text":"Smith"},{"label":"distinction","text":"a hinge coupling the lid to the base"}]}`;

const MINIMAL_FOLD_DISTINCTION_MODEL_OUTPUT = `{"extractions":[{"label":"office_action","text":"Office Action"},{"label":"claim","text":"A widget comprising a lid and a base."},{"label":"rejection_reference","text":"Smith"},{"label":"distinction","text":"a hinge coupling \\n the lid to the base"}]}`;

const UNALIGNED_DISTINCTION_MODEL_OUTPUT = `{"extractions":[{"label":"office_action","text":"Office Action"},{"label":"claim","text":"A widget comprising a lid and a base."},{"label":"rejection_reference","text":"Smith"},{"label":"distinction","text":"an impossible limitation"}]}`;

const MISSING_DISTINCTION_MODEL_OUTPUT = `{"extractions":[{"label":"office_action","text":"Office Action"},{"label":"claim","text":"A widget comprising a lid and a base."},{"label":"rejection_reference","text":"Smith"}]}`;

const fixtureDigest = SourceTextDigest.make(
  `sha256:${process.getBuiltinModule("node:crypto").createHash("sha256").update(OFFICE_ACTION_FIXTURE).digest("hex")}`
);
const makeExtractionRequest = (): LangExtractRequest =>
  LangExtractRequest.make({
    source: SourceTextIdentity.make({
      scopeRef: "matter.spike",
      sourceRef: "office-action-review-test",
      locator: SourceTextLocator.make("office-action.txt"),
      sourceDigest: fixtureDigest,
      textDigest: fixtureDigest,
      extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
      normalizationVersion: "raw/1",
    }),
    targets: officeActionExtractionTargets,
    text: OFFICE_ACTION_FIXTURE,
  });

const makeLanguageModelLayer = (
  text: string
): Layer.Layer<LanguageModel.LanguageModel | Model.ProviderName | Model.ModelName> =>
  Model.make(
    "test",
    "stub-model",
    Layer.succeed(LanguageModel.LanguageModel, {
      generateObject: () => Effect.die("generateObject is not used by law-practice tests") as never,
      generateText: () => Effect.succeed({ text }) as never,
      streamText: () => Stream.empty as never,
    } as unknown as LanguageModel.LanguageModel)
  );

const TestLangExtractLayer = LangExtractLayer.pipe(Layer.provide(remoteExtractionPolicyFromConfig));

const makeLawPracticeServerTestLayer = (modelOutput: string) =>
  Layer.mergeAll(LawPracticeServerLive, TestLangExtractLayer).pipe(
    Layer.provide(makeLanguageModelLayer(modelOutput)),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_LANGEXTRACT_ALLOW_REMOTE: "true" }))),
    Layer.provide(Layer.mergeAll(BunCrypto.layer, matterWallGrantingEveryScopeLayer))
  );

const expectReviewExtractionError = Effect.fn("law_practice.server.test.expect_review_extraction_error")(function* (
  reason: IrToLawExtractionError["reason"],
  assert?: (error: IrToLawExtractionError) => void
) {
  const review = yield* OfficeActionReview;
  const input = yield* makeOfficeActionReviewInput();

  const error = yield* review.review(input).pipe(Effect.flip);

  pipe(isIrToLawExtractionError(error), assertTrue);
  if (isIrToLawExtractionError(error)) {
    expect(error.reason).toBe(reason);
    expect(error.label).toBe("distinction");
    assert?.(error);
  }
});

describe("@beep/law-practice-server", () => {
  it.layer(makeLawPracticeServerTestLayer(OFFICE_ACTION_MODEL_OUTPUT), { timeout: "10 seconds" })(
    "office-action review loop over service-backed extraction",
    (it) => {
      it.effect(
        "IrToLaw grounds exactly one distinction to its source anchor through case-insensitive match_lesser alignment, never an unaligned fallback",
        Effect.fnUntraced(function* () {
          const langExtract = yield* LangExtractService;
          const irToLaw = yield* IrToLaw;
          const extractionResult = yield* langExtract.extract(makeExtractionRequest());
          const extractions = extractionResult.handoff.readings.pipe(HashMap.toValues, A.flatten);

          const lowerCaseCandidateOfTitleCaseSource = A.findFirst(extractions, (e) => e.label === "distinction");
          assertSome(
            O.map(lowerCaseCandidateOfTitleCaseSource, (e) => e.alignment),
            "match_lesser"
          );

          const law = yield* irToLaw.toLaw(extractionResult.handoff);

          expect(law.distinction, "exactly one well-formed Distinction").toBeInstanceOf(Distinction);
          const distinctionDetail = law.distinction.detail;
          pipe(DistinctionDetail.guards.missing_limitation(distinctionDetail), assertTrue);

          const { endChar, quote, startChar } = law.distinction.anchor;
          expect(
            Str.slice(startChar, endChar)(OFFICE_ACTION_FIXTURE),
            "the anchor re-slices the source to its own quote"
          ).toBe(quote);
          expect(quote, "the original-case substring recovered by the case-insensitive match").toBe(
            EXPECTED_DISTINCTION_QUOTE
          );

          DistinctionDetail.match(distinctionDetail, {
            missing_limitation: (detail) =>
              expect(detail.limitation, "the distinction answers with its missing limitation").toBe(
                EXPECTED_DISTINCTION_LIMITATION
              ),
          });
        })
      );

      it.effect("IrToLaw keeps the bytes of the frozen v1 law entities for the server fixture", (context) =>
        Effect.gen(function* () {
          const langExtract = yield* LangExtractService;
          const irToLaw = yield* IrToLaw;
          const extractionResult = yield* langExtract.extract(makeExtractionRequest());
          const law = yield* irToLaw.toLaw(extractionResult.handoff);
          const json = yield* S.encodeEffect(LawEntitiesJson)(law);

          yield* Effect.promise(() =>
            context.expect(`${json}\n`).toMatchFileSnapshot("./fixtures/ir-to-law-entities-v1.json")
          );
        })
      );

      it.effect(
        "review proposes the distinction claim in its capture scope and passes the office-action gate",
        Effect.fnUntraced(function* () {
          const review = yield* OfficeActionReview;
          const proposals = yield* LawClaimProposals;
          const input = yield* makeOfficeActionReviewInput();

          const result = yield* review.review(input);
          const stored = yield* proposals.get(result.proposed.claim);

          expect(result.proposed.stance).toBe("proposed");
          expect(result.proposed.core.scope).toBe(input.matterFixtureKey);
          assertSome(stored, result.proposed);
          expect(OfficeActionDistinctionGate.passes(result.assessments)).toBe(true);
          expect(HashSet.size(result.activities)).toBe(3);
        })
      );
    }
  );

  it.layer(makeLawPracticeServerTestLayer(MINIMAL_FOLD_DISTINCTION_MODEL_OUTPUT), { timeout: "10 seconds" })(
    "office-action review loop over minimal-fold extraction",
    (it) => {
      it.effect(
        "IrToLaw accepts a minimal-fold distinction and preserves its raw source anchor",
        Effect.fnUntraced(function* () {
          const langExtract = yield* LangExtractService;
          const irToLaw = yield* IrToLaw;
          const extractionResult = yield* langExtract.extract(makeExtractionRequest());
          const distinctionExtraction = A.findFirst(
            extractionResult.handoff.readings.pipe(HashMap.toValues, A.flatten),
            (extraction) => extraction.label === "distinction"
          );

          assertSome(
            O.map(distinctionExtraction, (extraction) => extraction.alignment),
            "match_minimal_fold"
          );

          const law = yield* irToLaw.toLaw(extractionResult.handoff);

          expect(law.distinction.anchor.quote).toBe(EXPECTED_DISTINCTION_QUOTE);
          expect(
            Str.slice(law.distinction.anchor.startChar, law.distinction.anchor.endChar)(OFFICE_ACTION_FIXTURE)
          ).toBe(law.distinction.anchor.quote);
        })
      );
    }
  );

  it.layer(makeLawPracticeServerTestLayer(MISSING_DISTINCTION_MODEL_OUTPUT), { timeout: "10 seconds" })(
    "office-action review loop with missing extraction output",
    (it) => {
      it.effect("review rejects a missing required distinction label before admission", () =>
        expectReviewExtractionError("required-extraction-missing")
      );
    }
  );

  it.layer(makeLawPracticeServerTestLayer(UNALIGNED_DISTINCTION_MODEL_OUTPUT), { timeout: "10 seconds" })(
    "office-action review loop with unaligned extraction output",
    (it) => {
      it.effect("review rejects unaligned distinction text before admission", () =>
        expectReviewExtractionError("required-extraction-unaligned", (error) => {
          assertSome<string>(error.alignmentStatus, "unaligned");
        })
      );
    }
  );
});
