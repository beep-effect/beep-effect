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
import { makeInMemoryProfessionalRuntimeSdk, runRuntimeFixture } from "@beep/agents-use-cases/test";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { RuntimeFixtureInput } from "@beep/agents-use-cases/test";

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
const roundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
};

describe("@beep/agents-use-cases", () => {
  it("runs deterministic fixtures into structured candidate output sets", () =>
    Effect.gen(function* () {
      const outputSet = yield* runRuntimeFixture(lawFixture);

      expect(outputSet).toBeInstanceOf(CandidateOutputSet);
      expect(outputSet.scenarioId).toBe("law-patent-intake");
      expect(outputSet.claims).toHaveLength(3);
      expect(outputSet.contextPacket.scope.workspaceId).toBe("workspace-law-fixture");

      const encoded = Result.getOrThrow(S.encodeResult(CandidateOutputSet)(outputSet));
      expect(encoded.scenarioId).toBe("law-patent-intake");
      expect(encoded.contextPacket.schemaVersion).toBe("runtime-data-loop.expected.context-packet.v1");
      expect(encoded.contextPacket.generatedAt).toBe("2026-05-01T14:13:30Z");
      expect(encoded.claims[1]?.eventDate).toBe("2026-06-12");
    }));

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

    expect(Result.getOrThrow(S.encodeResult(RuntimeEvidenceRef)(evidence))).toStrictEqual({
      artifactId: "email-001",
    });
    expect(Result.getOrThrow(S.encodeResult(RuntimeEvidenceRef)(spannedEvidence))).toStrictEqual({
      artifactId: "email-001",
      spanId: "email-001-s2",
      spanIds: ["email-001-s2", "email-001-s3"],
    });
    expect(Result.getOrThrow(S.encodeResult(RuntimeCandidateClaim)(claim))).toMatchObject({
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
    expect(Result.getOrThrow(S.encodeResult(RuntimeActivity)(activity))).toStrictEqual({
      activityId: "activity-001",
      activityType: "artifact_ingested",
      artifactId: "email-001",
      principalId: "principal-agent-runtime-fixture",
    });
  });

  it("serves context packets through the in-memory SDK facade", () =>
    Effect.gen(function* () {
      const sdk = makeInMemoryProfessionalRuntimeSdk([lawFixture]);
      const packet = yield* sdk.getContextPacket(
        GetContextPacket.make({
          artifactId: lawFixture.email.artifactId,
          scenarioId: lawFixture.email.scenarioId,
          scope: lawScope,
        })
      );

      expect(packet.scope).toEqual(lawScope);
      expect(packet.request.artifactId).toBe(lawFixture.email.artifactId);
    }));

  it("accepts matching candidate output proposals", () =>
    Effect.gen(function* () {
      const sdk = makeInMemoryProfessionalRuntimeSdk([lawFixture]);
      const outputSet = yield* runRuntimeFixture(lawFixture);
      const accepted = yield* sdk.proposeCandidateOutputSet(
        ProposeCandidateOutputSet.make({
          outputSet,
          producedByPrincipalId: "principal-agent-runtime-fixture",
          scope: lawScope,
        })
      );

      expect(accepted).toStrictEqual(outputSet);
    }));

  it("round-trips touched runtime schemas with schema-derived arbitraries", () => {
    const schemas: ReadonlyArray<S.Codec<unknown>> = [
      RuntimeScope,
      RuntimeEvidenceRef,
      RuntimeCandidateClaim,
      RuntimeActivity,
      SdkContextPacket,
      CandidateOutputSet,
    ];

    for (const schema of schemas) {
      fc.assert(
        fc.property(S.toArbitrary(schema), (value) => roundTrip(schema, value)),
        fcRuns(10)
      );
    }
  });
});
