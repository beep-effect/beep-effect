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
  CandorRecordReadError,
  CandorRecordReader,
  CandorRecordSnapshot,
  UncoveredEvent,
} from "@beep/law-practice-use-cases/CandorPolicy";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { PromotionGateRequest, PromotionSubjectRef, PromotionTenantRef } from "@beep/shared-use-cases/PromotionGate";
import { PromotionGate } from "@beep/shared-use-cases/server";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";

const subject = PromotionSubjectRef.make({ id: "application-16138242", kind: "patent-application" });
const request = PromotionGateRequest.make({ subject, tenantRef: PromotionTenantRef.make("org-law-fixture") });
const otherTenantRequest = PromotionGateRequest.make({
  subject,
  tenantRef: PromotionTenantRef.make("org-other-fixture"),
});
const citingApplication = S.decodeSync(CitingApplicationIdentity)({
  applicationNumber: "16138242",
  kind: "UsptoNormalized",
});
const scope = CandorFilingScope.make({ citingApplication, orgId: Shared.OrganizationId.make(1) });

const supportingLayers = Layer.mergeAll(
  Layer.succeed(
    CandorPromotionSubjectResolver,
    CandorPromotionSubjectResolver.of({
      resolve: (candidate): Effect.Effect<CandorFilingScope, CandorPromotionSubjectResolutionError> =>
        candidate.tenantRef === request.tenantRef
          ? Effect.succeed(scope)
          : Effect.fail(
              CandorPromotionSubjectResolutionError.make({
                reason: "tenant-mismatch",
                request: candidate,
              })
            ),
    })
  ),
  Layer.succeed(
    CandorRecordReader,
    CandorRecordReader.of({
      snapshotForFiling: Effect.fn("CandorRecordReader.snapshotForFiling")(() =>
        Effect.succeed(CandorRecordSnapshot.make({ dispositions: [], events: [] }))
      ),
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
      const verdict = yield* gate.evaluate(request);

      expect(verdict.outcome).toBe("clear");
    }).pipe(provideScopedLayer(gateLayer(CandorGateVerdict.make({ scope, uncovered: [] }))))
  );

  it.effect("maps an uncovered candor verdict to an opaque blocked value", () =>
    Effect.gen(function* () {
      const gate = yield* PromotionGate;
      const verdict = yield* gate.evaluate(request);

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
      const verdict = yield* gate.evaluate(request);

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
                        reason: "mapping-unavailable",
                        request: unresolved,
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
                  snapshotForFiling: Effect.fn("CandorRecordReader.snapshotForFiling")(() =>
                    Effect.succeed(CandorRecordSnapshot.make({ dispositions: [], events: [] }))
                  ),
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

  it.effect("fails closed when the same subject is requested under another tenant", () =>
    Effect.gen(function* () {
      const gate = yield* PromotionGate;
      const verdict = yield* gate.evaluate(otherTenantRequest);

      expect(verdict.outcome).toBe("blocked");
      if (verdict.outcome === "blocked") {
        expect(verdict.reason).toBe("law-practice-candor-policy-unavailable");
      }
    }).pipe(provideScopedLayer(gateLayer(CandorGateVerdict.make({ scope, uncovered: [] }))))
  );

  it.effect("fails closed when candor policy evaluation cannot read its record", () =>
    Effect.gen(function* () {
      const gate = yield* PromotionGate;
      const verdict = yield* gate.evaluate(request);

      expect(verdict.outcome).toBe("blocked");
      if (verdict.outcome === "blocked") {
        expect(verdict.reason).toBe("law-practice-candor-policy-unavailable");
      }
    }).pipe(
      provideScopedLayer(
        CandorPromotionGateLive.pipe(
          Layer.provide(
            Layer.mergeAll(
              supportingLayers,
              Layer.succeed(
                CandorPolicy,
                CandorPolicy.of({
                  evaluate: Effect.fn("CandorPolicy.evaluate")(() =>
                    Effect.fail(CandorRecordReadError.fromReason("snapshot-unavailable", "record unavailable"))
                  ),
                })
              )
            )
          )
        )
      )
    )
  );
});
