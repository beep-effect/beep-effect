import { LogicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity";
import { LiteralKit } from "@beep/schema";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as S from "effect/Schema";
import type { BeliefVersionRef } from "@beep/epistemic-domain/values/Contradiction";
import type { EdgeEndpoint } from "@beep/epistemic-domain/values/EdgeEndpoint";
import type { IdCodec } from "@beep/epistemics/Factory";

type Equals<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;

const HeadEdgeEndpoint = LiteralKit(["claim", "evidence", "entity", "observation"]).toTaggedUnion("kind")({
  claim: { claimId: Epistemic.CandidateClaimId.annotateKey({ description: "claim" }) },
  evidence: { evidenceId: Epistemic.EvidenceId.annotateKey({ description: "evidence" }) },
  entity: { entityRef: S.NonEmptyString.pipe(S.brand("EdgeEntityRef")).annotateKey({ description: "entity" }) },
  observation: {
    observationRef: S.NonEmptyString.pipe(S.brand("EdgeObservationRef")).annotateKey({ description: "observation" }),
  },
});

const HeadBeliefVersionRef = S.Struct({
  edgeVersionId: Epistemic.EdgeVersionId.annotateKey({ description: "edge version" }),
  logicalKey: LogicalEdgeKey.annotateKey({ description: "logical key" }),
  version: S.Int.check(S.isGreaterThan(0)).annotateKey({ description: "version" }),
});

const edgeEndpointTypeMatchesHead: Equals<EdgeEndpoint, typeof HeadEdgeEndpoint.Type> = true;
const edgeEndpointEncodedMatchesHead: Equals<typeof EdgeEndpoint.Encoded, typeof HeadEdgeEndpoint.Encoded> = true;
const beliefRefFieldsMatchHead: Equals<
  S.Struct.Type<typeof BeliefVersionRef.fields>,
  typeof HeadBeliefVersionRef.Type
> = true;
const beliefRefEncodedMatchesHead: Equals<typeof BeliefVersionRef.Encoded, typeof HeadBeliefVersionRef.Encoded> = true;

describe("factory bindings keep the pre-factory types", () => {
  it("binds EdgeEndpoint and BeliefVersionRef to the same Type and Encoded as before", () => {
    expect(
      [
        edgeEndpointTypeMatchesHead,
        edgeEndpointEncodedMatchesHead,
        beliefRefFieldsMatchHead,
        beliefRefEncodedMatchesHead,
      ],
      "the Head schemas restate the pre-factory definitions without identity annotations, which carry no types"
    ).toStrictEqual([true, true, true, true]);
  });

  it("accepts the shared-domain entity ids as IdCodec", () => {
    const ids: ReadonlyArray<IdCodec> = [Epistemic.EvidenceId, Epistemic.CandidateClaimId, Epistemic.EdgeVersionId];
    expect(ids).toHaveLength(3);
  });
});
