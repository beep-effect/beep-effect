import { PracticeKgLocalClaimChecksLive } from "@beep/law-practice-server";
import {
  ClaimInspection,
  ClaimSelfCheck,
  UsptoClaimSource,
  UsptoClaimsError,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert, describe } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const decodeCause = S.decodeUnknownEffect(UsptoClaimsError);

describe("local claim-check acquisition boundary", () => {
  it.layer(PracticeKgLocalClaimChecksLive, { timeout: "10 seconds" })((it) => {
    it.effect.prop(
      "refuses every published source through both typed services without external capabilities",
      { source: Arbitrary.schema(UsptoClaimSource) },
      ({ source }) =>
        Effect.gen(function* () {
          const checks = yield* ClaimSelfCheck;
          const inspection = yield* ClaimInspection;
          const checkError = yield* Effect.flip(checks.checkPublished(source));
          const inspectionError = yield* Effect.flip(inspection.inspectPublished(source));
          assert.strictEqual(checkError.reason, "public-claims-unavailable");
          assert.strictEqual(inspectionError.reason, "public-source-unavailable");
          assert.include(checkError.message, "does not fetch USPTO documents");
          const cause = yield* decodeCause(inspectionError.cause);
          assert.strictEqual(cause.reason, "unavailable");
        }),
      { arbitrary: fcRuns(100) }
    );
  });
});
