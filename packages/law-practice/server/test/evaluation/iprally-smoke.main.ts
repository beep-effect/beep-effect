/** Non-US, non-gold IPRally smoke entrypoint; never converts its teacher graph. */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import {
  ClaimSelfCheck,
  ClaimSelfCheckLive,
  UsptoClaims,
  UsptoClaimsError,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { LiteralKit } from "@beep/schema";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("test/evaluation/iprally-smoke.main");
class SmokeInput extends S.Opaque<SmokeInput, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceId: S.NonEmptyString,
    country: S.String.check(S.isPattern(/^(?!US)[A-Z]{2}$/)),
    ipcCodes: S.String.check(S.isPattern(/^F/)),
    tokens: S.Int.check(S.isGreaterThan(0)),
    sourceCommit: S.NonEmptyString,
    archiveSha256: S.NonEmptyString,
    inputText: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("SmokeInput", {
      description: "Pinned non-US mechanical teacher-input token reconstruction, supplied externally.",
    })
  )
) {}
const shared = {
  basis: S.tag("non-US-non-gold"),
  sourceId: S.String,
  country: S.String,
  ipcCodes: S.String,
  tokens: S.Int,
  sourceCommit: S.String,
  archiveSha256: S.String,
};
const SmokeResult = LiteralKit(["checked", "normalization-failed", "checking-failed"])
  .toTaggedUnion("status")({
    checked: {
      ...shared,
      claims: S.Int,
      trees: S.Int,
      findings: S.Int,
      undecomposed: S.Int,
      manualReviewPatterns: S.Int,
    },
    "normalization-failed": { ...shared, reason: S.String },
    "checking-failed": { ...shared, reason: S.String },
  })
  .pipe(
    $I.annoteSchema("SmokeResult", {
      description: "Coverage smoke only; no agreement or structural accuracy against teacher output.",
    })
  );
const encode = S.encodeEffect(S.fromJsonString(SmokeResult));

const smokeInputJson = S.fromJsonString(SmokeInput);

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const filename = yield* Config.String("IPRALLY_SMOKE_INPUT");
  const input = yield* S.decodeEffect(smokeInputJson)(yield* fs.readFileString(filename));
  const common = {
    sourceId: input.sourceId,
    country: input.country,
    ipcCodes: input.ipcCodes,
    tokens: input.tokens,
    sourceCommit: input.sourceCommit,
    archiveSha256: input.archiveSha256,
  };
  const result = yield* normalizePatentClaims([["1", input.inputText]]).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.succeed(SmokeResult.cases["normalization-failed"].make({ ...common, reason: error._tag })),
      onSuccess: (claims) =>
        ClaimSelfCheck.use((service) => service.check(claims)).pipe(
          Effect.match({
            onFailure: (error) => SmokeResult.cases["checking-failed"].make({ ...common, reason: error.reason }),
            onSuccess: (report) =>
              SmokeResult.cases.checked.make({
                ...common,
                claims: claims.length,
                trees: report.trees.length,
                findings: report.findings.length,
                undecomposed: report.undecomposed.length,
                manualReviewPatterns: A.length(
                  A.filter(report.findings, (finding) => finding.kind === "pattern-not-covered")
                ),
              }),
          })
        ),
    })
  );
  yield* Console.log(yield* encode(result));
});

const unavailable = Layer.succeed(UsptoClaims, {
  claims: Effect.fn("IprallySmoke.noPublicFetch")(() =>
    Effect.fail(
      UsptoClaimsError.make({
        reason: "unavailable",
        message: "This smoke reads a pinned token reconstruction and does not fetch USPTO documents.",
      })
    )
  ),
});
BunRuntime.runMain(
  Effect.gen(function* () {
    const services = yield* Layer.build(
      Layer.mergeAll(BunServices.layer, ClaimSelfCheckLive.pipe(Layer.provide(unavailable)))
    );
    yield* program.pipe(Effect.provide(services));
  }).pipe(Effect.scoped)
);
