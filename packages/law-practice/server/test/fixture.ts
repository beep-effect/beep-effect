/**
 * Synthetic office-action fixture shared by the integration test.
 *
 * A small, self-contained office-action text carrying claim 1, a §102
 * anticipation rejection citing one prior-art reference (Smith), and a
 * distinguishing limitation. The reference name appears once so the bare
 * entity surface has a unique source anchor. The distinguishing phrase appears
 * in Title Case (`"A Hinge Coupling The Lid To The Base"`) while the review loop's distinction
 * candidate is lower case, so deterministic alignment takes the case-insensitive
 * `match_lesser` path and the re-slice recovers the original-case substring.
 *
 * Well under the langextract caps (source < 100k, candidate < 4096). Local test
 * helper (not a `src` module).
 */

import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { OfficeActionReviewInput } from "@beep/law-practice-use-cases/OfficeActionReview";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { Effect } from "effect";
import * as S from "effect/Schema";

export const OFFICE_ACTION_FIXTURE =
  "Office Action\n\n" +
  "Claim 1 stands rejected under 35 U.S.C. 102 as anticipated by Smith.\n" +
  "Claim 1 recites: A widget comprising a lid and a base.\n\n" +
  "Applicant respectfully traverses. The reference fails to disclose " +
  "A Hinge Coupling The Lid To The Base, a limitation present in claim 1.\n";

/**
 * Original-case substring the distinction anchor is expected to recover
 * (Title Case in the source; the candidate is lower case — the `match_lesser`
 * re-slice).
 */
export const EXPECTED_DISTINCTION_QUOTE = "A Hinge Coupling The Lid To The Base";

/**
 * Lower-case limitation text the distinction's `missing_limitation` detail is
 * expected to carry (the candidate phrase the loop extracts).
 */
export const EXPECTED_DISTINCTION_LIMITATION = "a hinge coupling the lid to the base";

const OFFICE_ACTION_SHA256 = "f47322b0cd43c1f12eb6a6d97232ef22b1ff2274019687cd30124ee049bb61b7";
const OFFICE_ACTION_PROCESS_SHA256 = "9351216357999af1a32bb2e5e02a0f4983c32f93ff59dfee4a8979946a22de23";

const decodeArtifactId = S.decodeUnknownEffect(ArtifactId);
const decodeContentDigest = S.decodeUnknownEffect(ContentDigest);
const decodeOperationId = S.decodeUnknownEffect(OperationId);
const decodePosixPath = S.decodeUnknownEffect(PosixPath);

export const makeOfficeActionReviewInput = Effect.fn("LawPracticeServerTest.makeOfficeActionReviewInput")(function* () {
  const relativePath = yield* decodePosixPath("fixtures/law-practice/office-action-spike.txt");
  const artifactId = yield* decodeArtifactId(`artifact:${OFFICE_ACTION_SHA256}`);
  const digest = yield* decodeContentDigest(`sha256:${OFFICE_ACTION_SHA256}`);
  const operationId = yield* decodeOperationId(`operation:${OFFICE_ACTION_PROCESS_SHA256}`);

  return OfficeActionReviewInput.make({
    matterFixtureKey: "matter.spike",
    officeActionFixtureKey: "office-action.spike",
    operationId,
    sourceArtifact: SourceArtifact.make({
      digest,
      extension: "txt",
      id: artifactId,
      locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
      name: "office-action-spike.txt",
      relativePath,
      sizeBytes: NonNegativeInt.make(OFFICE_ACTION_FIXTURE.length),
      text: OFFICE_ACTION_FIXTURE,
    }),
  });
});
