import { SourceTextResolver } from "@beep/file-processing/SourceText";
import { CitingApplicationIdentity } from "@beep/law-practice-domain";
import {
  CandorPromotionGateLive,
  CandorPromotionSubjectResolutionError,
  CandorPromotionSubjectResolver,
} from "@beep/law-practice-server/CandorPromotionGate";
import {
  CandorFilingScope,
  CandorGateVerdict,
  CandorPolicy,
  CandorRecordReader,
  UncoveredEvent,
} from "@beep/law-practice-use-cases/CandorPolicy";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { PromotionGate, PromotionSubjectRef } from "@beep/shared-use-cases/PromotionGate";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";

const subject = PromotionSubjectRef.make({ id: "application-16138242", kind: "patent-application" });
const citingApplication = S.decodeUnknownSync(CitingApplicationIdentity)({
  applicationNumber: "16138242",
  kind: "UsptoNormalized",
});
const scope = CandorFilingScope.make({ citingApplication, orgId: Shared.OrganizationId.make(1) });

const supportingLayers = Layer.mergeAll(
  Layer.succeed(
    CandorPromotionSubjectResolver,
    CandorPromotionSubjectResolver.of({
      resolve: Effect.fn("CandorPromotionSubjectResolver.resolve")(() => Effect.succeed(scope)),
    })
  ),
  Layer.succeed(
    CandorRecordReader,
    CandorRecordReader.of({
      dispositionsForFiling: Effect.fn("CandorRecordReader.dispositionsForFiling")(() => Effect.succeed([])),
      eventsForFiling: Effect.fn("CandorRecordReader.eventsForFiling")(() => Effect.succeed([])),
    })
  ),
  Layer.succeed(
    SourceTextResolver,
    SourceTextResolver.of({
      resolve: Effect.fn("SourceTextResolver.resolve")(() => Effect.die("unused source resolver")),
    })
  ),
  BunCrypto.layer
);

const gateLayer = (verdict: CandorGateVerdict) =>
  CandorPromotionGateLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        supportingLayers,
        Layer.succeed(
          CandorPolicy,
          CandorPolicy.of({ evaluate: Effect.fn("CandorPolicy.evaluate")(() => Effect.succeed(verdict)) })
        )
      )
    )
  );

describe("CandorPromotionGate", () => {
  it.effect("maps a covered candor verdict to the shared clear value", () =>
    Effect.gen(function* () {
      const gate = yield* PromotionGate;
      const verdict = yield* gate.evaluate(subject);

      expect(verdict.outcome).toBe("clear");
    }).pipe(provideScopedLayer(gateLayer(CandorGateVerdict.make({ scope, uncovered: [] }))))
  );

  it.effect("maps an uncovered candor verdict to an opaque blocked value", () =>
    Effect.gen(function* () {
      const gate = yield* PromotionGate;
      const verdict = yield* gate.evaluate(subject);

      expect(verdict.outcome).toBe("blocked");
      if (verdict.outcome === "blocked") {
        expect(verdict.reason).toBe("law-practice-candor-policy-blocked");
      }
    }).pipe(
      provideScopedLayer(
        gateLayer(
          CandorGateVerdict.make({
            scope,
            uncovered: [UncoveredEvent.make({ eventId: 1, reason: "no-disposition" })],
          })
        )
      )
    )
  );

  it.effect("fails closed when the shared subject cannot be resolved", () =>
    Effect.gen(function* () {
      const gate = yield* PromotionGate;
      const verdict = yield* gate.evaluate(subject);

      expect(verdict.outcome).toBe("blocked");
      if (verdict.outcome === "blocked") {
        expect(verdict.reason).toBe("law-practice-candor-policy-unavailable");
      }
    }).pipe(
      provideScopedLayer(
        CandorPromotionGateLive.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(
                CandorPromotionSubjectResolver,
                CandorPromotionSubjectResolver.of({
                  resolve: Effect.fn("CandorPromotionSubjectResolver.resolve")((unresolved) =>
                    Effect.fail(
                      CandorPromotionSubjectResolutionError.make({
                        reason: "subject mapping unavailable",
                        subject: unresolved,
                      })
                    )
                  ),
                })
              ),
              Layer.succeed(
                CandorPolicy,
                CandorPolicy.of({
                  evaluate: Effect.fn("CandorPolicy.evaluate")(() =>
                    Effect.succeed(CandorGateVerdict.make({ scope, uncovered: [] }))
                  ),
                })
              ),
              Layer.succeed(
                CandorRecordReader,
                CandorRecordReader.of({
                  dispositionsForFiling: Effect.fn("CandorRecordReader.dispositionsForFiling")(() =>
                    Effect.succeed([])
                  ),
                  eventsForFiling: Effect.fn("CandorRecordReader.eventsForFiling")(() => Effect.succeed([])),
                })
              ),
              Layer.succeed(
                SourceTextResolver,
                SourceTextResolver.of({
                  resolve: Effect.fn("SourceTextResolver.resolve")(() => Effect.die("unused source resolver")),
                })
              ),
              BunCrypto.layer
            )
          )
        )
      )
    )
  );
});
