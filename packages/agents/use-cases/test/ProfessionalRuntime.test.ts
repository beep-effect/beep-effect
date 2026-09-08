import {
  CandidateOutputSet,
  GetContextPacket,
  ProposeCandidateOutputSet,
  RuntimeActivity,
  RuntimeCandidateClaim,
  RuntimeEvidenceRef,
  RuntimeScope,
  SdkContextPacket,
} from "@beep/agents-use-cases/public";
import {
  makeInMemoryProfessionalRuntimeSdk,
  RuntimeFixtureInput,
  runRuntimeFixture,
} from "@beep/agents-use-cases/test";
import { PromotionBlockReason, PromotionGateVerdict, PromotionSubjectRef } from "@beep/shared-use-cases/PromotionGate";
import { PromotionGate } from "@beep/shared-use-cases/server";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref, Result } from "effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { PromotionGateRequest } from "@beep/shared-use-cases/PromotionGate";

const lawFixture: RuntimeFixtureInput = {
  body: A.join(
    [
      "[span:law-email-001-s2] We need help preparing a provisional patent application.",
      "[span:law-email-001-s3] The public prototype demonstration is planned for June 12, 2026.",
      "[span:law-email-001-s4] Avery Chen and Priya Raman are the main contributors.",
      "[span:law-email-001-s5] Please schedule an intake call next week.",
    ],
    "\n"
  ),
  email: {
    artifactId: "email-artifact-law-001",
    scenarioId: "law-patent-intake",
    sourceSpans: ["law-email-001-s2", "law-email-001-s3", "law-email-001-s4", "law-email-001-s5"],
    subject: "Provisional patent help",
    threadId: "thread-law-001",
  },
  promotionSubjects: [
    PromotionSubjectRef.make({
      id: "application-16138242",
      kind: "patent-application",
    }),
  ],
  seed: {
    organization: {
      organizationId: "org-law-fixture",
    },
    scenarioId: "law-patent-intake",
    workspace: {
      workspaceId: "workspace-law-fixture",
    },
  },
};

const lawScope = RuntimeScope.make({
  organizationId: lawFixture.seed.organization.organizationId,
  threadId: lawFixture.email.threadId,
  workspaceId: lawFixture.seed.workspace.workspaceId,
});
const clearPromotionGate = PromotionGate.of({
  evaluate: Effect.fn("PromotionGate.evaluate")((request) =>
    Effect.sync(() => {
      expect(request.subject).toStrictEqual(lawFixture.promotionSubjects[0]);
      expect(request.tenantRef).toBe(lawScope.organizationId);
      return PromotionGateVerdict.cases.clear.make({});
    })
  ),
});
const roundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
};

// Sequential: the schema-arbitrary round-trip below runs 6 schemas x the
// BEEP_FC_NUM_RUNS floor (400 in the PR deep sweep) = 2,400 encode/decode
// cycles and saturates a CI core. Under the global `sequence.concurrent`
// default that CPU-bound test starves its millisecond-fast fixture siblings
// past the deep-sweep timeout; running the suite sequentially keeps the fast
// tests instant and gives the heavy property its own core.
describe("@beep/agents-use-cases", { concurrent: false }, () => {
  it.effect("runs deterministic fixtures into structured candidate output sets", () =>
    Effect.gen(function* () {
      const outputSet = yield* runRuntimeFixture(lawFixture);

      expect(outputSet).toBeInstanceOf(CandidateOutputSet);
      expect(outputSet.scenarioId).toBe("law-patent-intake");
      expect(outputSet.claims).toHaveLength(3);
      expect(outputSet.contextPacket.scope.workspaceId).toBe("workspace-law-fixture");

      const encoded = Result.getOrThrow(CandidateOutputSet.encodeResult(outputSet));
      expect(encoded.scenarioId).toBe("law-patent-intake");
      expect(encoded.contextPacket.schemaVersion).toBe("runtime-data-loop.expected.context-packet.v1");
      expect(encoded.contextPacket.generatedAt).toBe("2026-05-01T14:13:30Z");
      expect(encoded.claims[1]?.eventDate).toBe("2026-06-12");
    })
  );

  it("keeps touched runtime DTO encoded shapes stable", () => {
    const evidence = RuntimeEvidenceRef.make({ artifactId: "email-001" });
    const spannedEvidence = RuntimeEvidenceRef.make({
      artifactId: "email-001",
      spanId: O.some("email-001-s2"),
      spanIds: O.some(["email-001-s2", "email-001-s3"]),
    });
    const claim = RuntimeCandidateClaim.make({
      claimId: "claim-001",
      claimType: "deadline_context",
      confidence: "high",
      eventDate: O.some("2026-06-12"),
      evidence: [spannedEvidence],
      lifecycle: "candidate",
      producedByPrincipalId: "principal-agent-runtime-fixture",
      statement: "The public demonstration is planned for June 12.",
      subjectRef: { id: "matter-001", kind: "matter" },
    });
    const activity = RuntimeActivity.make({
      activityId: "activity-001",
      activityType: "artifact_ingested",
      artifactId: O.some("email-001"),
      principalId: "principal-agent-runtime-fixture",
    });

    expect(Result.getOrThrow(RuntimeEvidenceRef.encodeResult(evidence))).toStrictEqual({
      artifactId: "email-001",
    });
    expect(Result.getOrThrow(RuntimeEvidenceRef.encodeResult(spannedEvidence))).toStrictEqual({
      artifactId: "email-001",
      spanId: "email-001-s2",
      spanIds: ["email-001-s2", "email-001-s3"],
    });
    expect(Result.getOrThrow(RuntimeCandidateClaim.encodeResult(claim))).toMatchObject({
      claimId: "claim-001",
      eventDate: "2026-06-12",
      evidence: [
        {
          artifactId: "email-001",
          spanId: "email-001-s2",
          spanIds: ["email-001-s2", "email-001-s3"],
        },
      ],
    });
    expect(Result.getOrThrow(RuntimeActivity.encodeResult(activity))).toStrictEqual({
      activityId: "activity-001",
      activityType: "artifact_ingested",
      artifactId: "email-001",
      principalId: "principal-agent-runtime-fixture",
    });
  });

  it.effect("serves context packets through the in-memory SDK facade", () =>
    Effect.gen(function* () {
      const sdk = makeInMemoryProfessionalRuntimeSdk({ fixtures: [lawFixture], promotionGate: clearPromotionGate });
      const packet = yield* sdk.getContextPacket(
        GetContextPacket.make({
          artifactId: lawFixture.email.artifactId,
          scenarioId: lawFixture.email.scenarioId,
          scope: lawScope,
        })
      );

      expect(packet.scope).toEqual(lawScope);
      expect(packet.request.artifactId).toBe(lawFixture.email.artifactId);
    })
  );

  it.effect("accepts matching candidate output proposals", () =>
    Effect.gen(function* () {
      const sdk = makeInMemoryProfessionalRuntimeSdk({ fixtures: [lawFixture], promotionGate: clearPromotionGate });
      const outputSet = yield* runRuntimeFixture(lawFixture);
      const accepted = yield* sdk.proposeCandidateOutputSet(
        ProposeCandidateOutputSet.make({
          outputSet,
          producedByPrincipalId: "principal-agent-runtime-fixture",
          scope: lawScope,
        })
      );

      expect(accepted).toStrictEqual(outputSet);
    })
  );

  it.effect("refuses candidate output when a vertical promotion policy blocks", () =>
    Effect.gen(function* () {
      const outputSet = yield* runRuntimeFixture(lawFixture);
      const blockedGate = PromotionGate.of({
        evaluate: Effect.fn("PromotionGate.evaluate")(() =>
          Effect.succeed(
            PromotionGateVerdict.cases.blocked.make({
              reason: PromotionBlockReason.make("vertical-policy-blocked"),
            })
          )
        ),
      });
      const sdk = makeInMemoryProfessionalRuntimeSdk({ fixtures: [lawFixture], promotionGate: blockedGate });

      const refusal = yield* sdk
        .proposeCandidateOutputSet(
          ProposeCandidateOutputSet.make({
            outputSet,
            producedByPrincipalId: "principal-agent-runtime-fixture",
            scope: lawScope,
          })
        )
        .pipe(Effect.flip);

      expect(refusal._tag).toBe("ProfessionalRuntimePromotionBlocked");
    })
  );

  it.effect("rechecks a clear promotion decision immediately before acceptance", () =>
    Effect.gen(function* () {
      const outputSet = yield* runRuntimeFixture(lawFixture);
      const evaluations = yield* Ref.make(0);
      const gate = PromotionGate.of({
        evaluate: Effect.fn("PromotionGate.evaluate")(() =>
          Ref.getAndUpdate(evaluations, (count) => count + 1).pipe(
            Effect.map((count) =>
              count === 0
                ? PromotionGateVerdict.cases.clear.make({})
                : PromotionGateVerdict.cases.blocked.make({
                    reason: PromotionBlockReason.make("vertical-policy-revision-advanced"),
                  })
            )
          )
        ),
      });
      const sdk = makeInMemoryProfessionalRuntimeSdk({ fixtures: [lawFixture], promotionGate: gate });

      const refusal = yield* sdk
        .proposeCandidateOutputSet(
          ProposeCandidateOutputSet.make({
            outputSet,
            producedByPrincipalId: "principal-agent-runtime-fixture",
            scope: lawScope,
          })
        )
        .pipe(Effect.flip);

      expect(refusal).toMatchObject({
        _tag: "ProfessionalRuntimePromotionBlocked",
        reason: "vertical-policy-revision-advanced",
      });
      expect(yield* Ref.get(evaluations)).toBe(2);
    })
  );

  it.effect("derives the tenant-bound subject instead of accepting a caller-selected clear subject", () =>
    Effect.gen(function* () {
      const outputSet = yield* runRuntimeFixture(lawFixture);
      const unrelatedId = "unrelated-clear-application";
      const gate = PromotionGate.of({
        evaluate: Effect.fn("PromotionGate.evaluate")((request: PromotionGateRequest) =>
          Effect.succeed(
            request.subject.id === unrelatedId
              ? PromotionGateVerdict.cases.clear.make({})
              : PromotionGateVerdict.cases.blocked.make({
                  reason: PromotionBlockReason.make("vertical-policy-blocked"),
                })
          )
        ),
      });
      const sdk = makeInMemoryProfessionalRuntimeSdk({ fixtures: [lawFixture], promotionGate: gate });

      const refusal = yield* sdk
        .proposeCandidateOutputSet(
          ProposeCandidateOutputSet.make({
            outputSet,
            producedByPrincipalId: "principal-agent-runtime-fixture",
            scope: lawScope,
          })
        )
        .pipe(Effect.flip);

      expect(refusal).toMatchObject({
        _tag: "ProfessionalRuntimePromotionBlocked",
        subject: { id: "application-16138242" },
      });
    })
  );

  it.effect("refuses when a later trusted promotion subject blocks", () =>
    Effect.gen(function* () {
      const blockingSubject = PromotionSubjectRef.make({ id: "application-blocked", kind: "patent-application" });
      const fixture = RuntimeFixtureInput.make({
        ...lawFixture,
        promotionSubjects: [...lawFixture.promotionSubjects, blockingSubject],
      });
      const outputSet = yield* runRuntimeFixture(fixture);
      const gate = PromotionGate.of({
        evaluate: Effect.fn("PromotionGate.evaluate")((candidate: PromotionGateRequest) =>
          Effect.succeed(
            candidate.subject.id === blockingSubject.id
              ? PromotionGateVerdict.cases.blocked.make({
                  reason: PromotionBlockReason.make("vertical-policy-blocked"),
                })
              : PromotionGateVerdict.cases.clear.make({})
          )
        ),
      });
      const sdk = makeInMemoryProfessionalRuntimeSdk({ fixtures: [fixture], promotionGate: gate });

      const refusal = yield* sdk
        .proposeCandidateOutputSet(
          ProposeCandidateOutputSet.make({
            outputSet,
            producedByPrincipalId: "principal-agent-runtime-fixture",
            scope: lawScope,
          })
        )
        .pipe(Effect.flip);

      expect(refusal).toMatchObject({
        _tag: "ProfessionalRuntimePromotionBlocked",
        subject: { id: blockingSubject.id },
      });
    })
  );

  it("round-trips bounded runtime schemas with schema-derived arbitraries", () => {
    const schemas: ReadonlyArray<S.Codec<unknown>> = [
      RuntimeScope,
      RuntimeEvidenceRef,
      RuntimeCandidateClaim,
      RuntimeActivity,
      SdkContextPacket,
    ];

    for (const schema of schemas) {
      fc.assert(
        fc.property(S.toArbitrary(schema)(fc), (value) => roundTrip(schema, value)),
        fcRuns(10)
      );
    }
    // Explicit generous cap: 2,400 schema round-trips at the deep-sweep floor
    // can approach the shared 300s testTimeout on a loaded runner even running
    // alone; give this single heavy property its own headroom without raising
    // the global cap or lowering the BEEP_FC_NUM_RUNS floor for the lane.
  }, 600_000);
});
