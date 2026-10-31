/**
 * Read-only claim self-check tool and attorney review-item projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { TextQuote } from "@beep/law-practice-domain/values";
import {
  AntecedentFinding,
  ClaimDecompositionError,
  claimNumberOfPath,
} from "@beep/law-practice-domain/values/ClaimElement";
import { ReviewItem, ReviewItemId } from "@beep/law-practice-domain/values/ReviewItem";
import { BoxFileId, SourceRef } from "@beep/law-practice-domain/values/SourceRef";
import { annotateFourHints, FourHintAnnotations } from "@beep/mcp-kit";
import * as A from "effect/Array";
import * as Tool from "effect/ai/Tool";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ClaimFindingCandidate,
  ClaimSelfCheck,
  ClaimSelfCheckError,
  ClaimSelfCheckInput,
} from "./ClaimSelfCheck/index.ts";

const $I = $LawPracticeUseCasesId.create("ClaimSelfCheck.tools");
const maxReviewResponseBytes = 1024 * 1024;
const textEncoder = new TextEncoder();
const reviewEncodingError = () =>
  ClaimSelfCheckError.make({ reason: "candidate-mapping-failed", message: "The review result could not be encoded." });
const encodeCandidate = flow(
  S.encodeEffect(S.fromJsonString(ClaimFindingCandidate)),
  Effect.mapError(reviewEncodingError)
);
const encodeReviewItem = flow(S.encodeEffect(S.fromJsonString(ReviewItem)), Effect.mapError(reviewEncodingError));
const encodeUnchecked = flow(
  S.encodeEffect(S.fromJsonString(S.Array(ClaimDecompositionError))),
  Effect.mapError(reviewEncodingError)
);

/**
 * Normalized document and optional genuine Box source for a local self-check.
 *
 * **Example** (Inspect request fields)
 *
 * ```ts
 * import { ClaimSelfCheckReviewRequest } from "@beep/law-practice-use-cases/server"
 * console.log(Object.keys(ClaimSelfCheckReviewRequest.fields)) // ["input", "boxFileId"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSelfCheckReviewRequest extends S.Opaque<
  ClaimSelfCheckReviewRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    input: ClaimSelfCheckInput.annotateKey({ description: "Normalized claims and provenance supplied by the caller." }),
    boxFileId: BoxFileId.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Actual Box source file, when known; absence never creates a synthetic Box identifier.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ClaimSelfCheckReviewRequest", {
      description: "Local advisory claim review; no source fetching or persistence.",
    })
  )
) {}

/**
 * Advisory review items with their candidate/evidence envelopes and coverage failures.
 *
 * **Example** (Inspect result fields)
 *
 * ```ts
 * import { ClaimSelfCheckReviewResult } from "@beep/law-practice-use-cases/server"
 * console.log(Object.keys(ClaimSelfCheckReviewResult.fields)) // ["items", "candidates", "undecomposed"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSelfCheckReviewResult extends S.Opaque<
  ClaimSelfCheckReviewResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    items: S.Array(ReviewItem.cases["claim-finding"]).annotateKey({
      description: "One plain-language, unreviewed claim-finding item per candidate.",
    }),
    candidates: S.Array(ClaimFindingCandidate).annotateKey({
      description: "The exact candidate and term-span evidence each item refers to; nothing is stored.",
    }),
    undecomposed: S.Array(ClaimDecompositionError).annotateKey({
      description: "Claims that were not checked. No findings is clean only when this is empty too.",
    }),
  }).pipe(
    $I.annoteSchema("ClaimSelfCheckReviewResult", {
      description: "Read-only self-check proposals, evidence and explicit coverage gaps.",
    })
  )
) {}

/**
 * Local advisory antecedent check, declared read-only and closed-world.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { ClaimSelfCheckTool } from "@beep/law-practice-use-cases/server"
 * console.log(ClaimSelfCheckTool.name) // "claim_self_check"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const ClaimSelfCheckTool = annotateFourHints(
  Tool.make("claim_self_check", {
    description:
      "Check the supplied normalized patent claims for possible antecedent and dependency issues. Returns advisory, candidate-unreviewed claim-finding review items with the complete claim quoted, candidate evidence and unchecked claims. Responses are limited to 1 MiB; an oversized result is an explicit failure requiring a smaller claim set with dependency context, never a clean result. It fetches and stores nothing. Always report unchecked claims and patterns needing manual review; no findings alone does not mean every claim was checked.",
    parameters: ClaimSelfCheckReviewRequest,
    success: ClaimSelfCheckReviewResult,
    failure: ClaimSelfCheckError,
    failureMode: "return",
  }),
  FourHintAnnotations.make({ readOnly: true, destructive: false, idempotent: true, openWorld: false })
);

const explanation = (finding: AntecedentFinding): string =>
  AntecedentFinding.match(finding, {
    "missing-antecedent": () =>
      "An earlier introduction for this phrase was not found in its dependency chain. Review whether an introduction is needed.",
    "ambiguous-antecedent": () =>
      "Several earlier phrases may supply the introduction. Review which one this phrase refers to.",
    "antecedent-outside-chain": () =>
      "A possible introduction occurs outside this claim's dependency chain. Review the dependency and the referring phrase.",
    "number-mismatch": () =>
      "The possible introduction and this phrase differ in grammatical number. Review the singular or plural wording.",
    "pattern-not-covered": () =>
      "This wording is outside the patterns covered by this automatic check. It needs manual review; no antecedent conclusion is made.",
  });

const dependencyContext = (finding: AntecedentFinding): string =>
  AntecedentFinding.guards["pattern-not-covered"](finding)
    ? ""
    : ` Claims checked: ${A.join(
        A.map(finding.chain, (claim) => `${claim}`),
        " → "
      )}.`;

/**
 * Project self-check candidates into source-quoted attorney review items without writing state.
 *
 * **Example** (Create a reusable program)
 *
 * ```ts
 * import { claimSelfCheckReview } from "@beep/law-practice-use-cases/server"
 * console.log(typeof claimSelfCheckReview) // "function"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const claimSelfCheckReview = Effect.fn("ClaimSelfCheck.review")(function* (
  request: ClaimSelfCheckReviewRequest
): Effect.fn.Return<ClaimSelfCheckReviewResult, ClaimSelfCheckError, ClaimSelfCheck> {
  const checked = yield* (yield* ClaimSelfCheck).candidates(ClaimSelfCheckInput.make(request.input));
  const oversized = () =>
    ClaimSelfCheckError.make({
      reason: "review-response-too-large",
      message: `No review result was delivered because it exceeds 1 MiB. All supplied claims still require review; ${A.length(checked.undecomposed)} could not be checked. Retry with a smaller claim set and its dependency context.`,
    });
  // Count the encoded wire representation, including UTF-8 and JSON escaping.
  // Fail during projection so repeated full-claim quotations cannot accumulate
  // into an arbitrarily amplified response before the limit is applied.
  let responseBytes = textEncoder.encode(yield* encodeUnchecked(checked.undecomposed)).byteLength + 64;
  if (responseBytes > maxReviewResponseBytes) return yield* oversized();
  const items = yield* Effect.forEach(
    checked.candidates,
    Effect.fnUntraced(function* (mapped: ClaimFindingCandidate) {
      const { candidate, finding } = mapped;
      const number = claimNumberOfPath(finding.referring.path);
      const claim = yield* Effect.fromOption(
        A.findFirst(request.input.document.claims, (value) => value.claimNumber === number),
        () =>
          ClaimSelfCheckError.make({
            reason: "candidate-mapping-failed",
            claimNumber: number,
            message: "The finding has no source claim to quote.",
          })
      );
      const sourceRefs = O.toArray(
        O.map(request.boxFileId, (boxFileId) =>
          SourceRef.make({ boxFileId, quote: TextQuote.make({ exact: claim.claimText }) })
        )
      );
      const item = ReviewItem.cases["claim-finding"].make({
        itemId: ReviewItemId.make(`claim-finding:${candidate.publicId}`),
        claimId: candidate.id,
        label: O.some("Antecedent check — candidate, unreviewed"),
        text: `Claim ${number}: “${claim.claimText}”\nPhrase: “${finding.referring.anchor.quote}”. ${explanation(finding)}${dependencyContext(finding)}`,
        sourceRefs,
      });
      responseBytes +=
        textEncoder.encode(yield* encodeReviewItem(item)).byteLength +
        textEncoder.encode(yield* encodeCandidate(mapped)).byteLength +
        2;
      if (responseBytes > maxReviewResponseBytes) return yield* oversized();
      return item;
    })
  );
  return ClaimSelfCheckReviewResult.make({ items, candidates: checked.candidates, undecomposed: checked.undecomposed });
});
