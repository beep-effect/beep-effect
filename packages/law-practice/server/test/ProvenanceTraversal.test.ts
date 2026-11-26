import { GenerationFact } from "@beep/epistemics/Admission";
import { ClaimId } from "@beep/epistemics/ClaimCore";
import { IRI } from "@beep/identity/Iri";
import { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import { ActivityPin, ActivityStart } from "@beep/jsonc/ActivityStart";
import {
  DistinctionProposition,
  LawClaimArrows,
  LawClaimCore,
  LawPrincipalId,
  LawProposedClaimRecord,
  logicalKey,
  ScopeRef,
} from "@beep/law-practice-domain/values/LawClaim";
import { MatterGrant, MatterScope } from "@beep/law-practice-domain/values/MatterScope";
import { LawClaimStoreMemory } from "@beep/law-practice-server/ClaimStore";
import { MatterAuthorityConfig, MatterAuthorityLayer } from "@beep/law-practice-server/MatterAuthority";
import { ProvenanceTraversalLive } from "@beep/law-practice-server/ProvenanceTraversal";
import { LawClaimProposals, ProposedClaimEntry } from "@beep/law-practice-use-cases/ClaimStore";
import { LawPrincipal } from "@beep/law-practice-use-cases/MatterWall";
import { ProvenanceResult, ProvenanceTraversal } from "@beep/law-practice-use-cases/ProvenanceTraversal";
import { ActivityId } from "@beep/schema/ContentHash";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { it } from "@beep/test-runner";
import { mintCaptureId } from "@beep/text/Capture";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import type { ContentHash } from "@beep/schema/ContentHash";

const matterA = LawPractice.MatterId.make(1);
const matterB = LawPractice.MatterId.make(2);
const principalA = LawPrincipalId.make(7);
const principalAB = LawPrincipalId.make(8);
const scopeA = ScopeRef.make("matter:provenance-a");
const scopeB = ScopeRef.make("matter:provenance-b");

const config = MatterAuthorityConfig.make({
  scopes: [
    MatterScope.make({
      matter: matterA,
      scopeRefs: HashSet.make(scopeA),
      familyKeys: HashSet.empty(),
      mailFolders: HashSet.empty(),
    }),
    MatterScope.make({
      matter: matterB,
      scopeRefs: HashSet.make(scopeB),
      familyKeys: HashSet.empty(),
      mailFolders: HashSet.empty(),
    }),
  ],
  grants: [
    MatterGrant.make({ principal: principalA, matters: HashSet.make(matterA) }),
    MatterGrant.make({ principal: principalAB, matters: HashSet.make(matterA, matterB) }),
  ],
});

const proposition = DistinctionProposition.make({
  authority: "office-action",
  applicationNumber: "16/123,456",
  claimNumber: 1,
  ground: "102",
  referenceDocument: "US 9,876,543 B2",
  detail: { kind: "missing_limitation", limitation: "a hinged lid" },
});

const hashOf = (digit: string): `sha256:${string}` => `sha256:${Str.repeat(64)(digit)}`;

const identityIn = (scopeRef: ScopeRef) =>
  SourceTextIdentity.make({
    scopeRef,
    sourceRef: "source",
    locator: SourceTextLocator.make("fixture.txt"),
    sourceDigest: SourceTextDigest.make(hashOf("1")),
    textDigest: SourceTextDigest.make(hashOf("1")),
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });

const recordUsing = (digit: string, used: ReadonlyArray<ContentHash>) =>
  ActivityRecord.make({
    id: ActivityId.make(hashOf(digit)),
    start: ActivityStart.make({
      operation: IRI.make("https://example.test/ops/run"),
      pin: ActivityPin.cases.Engine.make({ engine: "fixture", edition: "1" }),
      promptDigest: O.none(),
      used: HashSet.fromIterable(used),
      started: DateTime.makeUnsafe(0),
    }),
    generated: HashSet.empty(),
    ended: DateTime.makeUnsafe(5),
    outcome: "completed",
  });

const entryIn = Effect.fn("ProvenanceTraversalTest.entryIn")(function* (
  scope: ScopeRef,
  activities: ReadonlyArray<ActivityRecord>,
  captures: ReadonlyArray<SourceTextIdentity>
) {
  const activity = ActivityId.make(hashOf("f"));
  const core = LawClaimCore.make({
    proposition,
    logicalKey: logicalKey(proposition),
    supportAtCreation: HashSet.empty(),
    derivedFrom: HashSet.empty(),
    supersedes: O.none(),
    generatedBy: activity,
    assertedBy: { _tag: "Person", principal: principalA },
    valid: { _tag: "Unknown" },
    knowledgeStart: DateTime.makeUnsafe(1_000),
    scope,
  });
  const claim = yield* LawClaimArrows.mint(core);
  return ProposedClaimEntry.make({
    record: LawProposedClaimRecord.make({ claim, core, stance: "proposed" }),
    generation: GenerationFact.make({ activity, at: DateTime.makeUnsafe(1_000) }),
    activities: HashSet.fromIterable(activities),
    captures: HashSet.fromIterable(captures),
  });
});

const seeded = Effect.fn("ProvenanceTraversalTest.seeded")(function* () {
  const store = yield* Layer.build(LawClaimStoreMemory);
  const proposals = Context.get(store, LawClaimProposals);
  const captureA = yield* mintCaptureId(identityIn(scopeA));
  const captureB = yield* mintCaptureId(identityIn(scopeB));
  const extract = recordUsing("a", [captureA, captureB]);
  const propose = recordUsing("b", [captureA]);
  const claimA = yield* entryIn(scopeA, [extract, propose], [identityIn(scopeA), identityIn(scopeB)]);
  const claimB = yield* entryIn(scopeB, [recordUsing("c", [captureB])], [identityIn(scopeB)]);
  yield* proposals.appendProposed(claimA);
  yield* proposals.appendProposed(claimB);
  const digest = yield* Digest.Digest;
  const traverseAs = Effect.fn("ProvenanceTraversalTest.traverseAs")(function* (principal: LawPrincipalId) {
    const built = yield* Layer.build(
      ProvenanceTraversalLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeedContext(store),
            MatterAuthorityLayer(config),
            Layer.succeed(LawPrincipal, { principal }),
            Layer.succeed(Digest.Digest, digest)
          )
        )
      )
    );
    return Context.get(built, ProvenanceTraversal);
  });
  return { captureA, captureB, claimA, claimB, extract, propose, traverseAs };
});

const sortedIds = (ids: Iterable<string>) => A.sort(A.fromIterable(ids), Order.String);

const foundOf = (result: ProvenanceResult) =>
  ProvenanceResult.match(result, {
    Found: ({ provenance }) =>
      O.some({
        activities: sortedIds(HashSet.map(provenance.activities, (record) => record.id)),
        captures: sortedIds(provenance.captures),
        admissions: provenance.admissions.length,
      }),
    Missing: () => O.none(),
  });

describe("ProvenanceTraversal", () => {
  it.layer(Digest.layerWebCrypto)("over the memory claim store", (it) => {
    it.effect("omits an activity that used a capture outside the principal's grants, with that capture", () =>
      Effect.gen(function* () {
        const fixture = yield* seeded();
        const traversal = yield* fixture.traverseAs(principalA);
        const result = yield* traversal.fromClaim(fixture.claimA.record.claim);
        assertSome(foundOf(result), { activities: [fixture.propose.id], captures: [fixture.captureA], admissions: 0 });
      })
    );

    it.effect("returns every activity and capture to a principal granted both matters", () =>
      Effect.gen(function* () {
        const fixture = yield* seeded();
        const traversal = yield* fixture.traverseAs(principalAB);
        const result = yield* traversal.fromClaim(fixture.claimA.record.claim);
        assertSome(foundOf(result), {
          activities: sortedIds([fixture.extract.id, fixture.propose.id]),
          captures: sortedIds([fixture.captureA, fixture.captureB]),
          admissions: 0,
        });
      })
    );

    it.effect("answers a denied claim with the Missing value an absent claim gets", () =>
      Effect.gen(function* () {
        const fixture = yield* seeded();
        const traversal = yield* fixture.traverseAs(principalA);
        const denied = yield* traversal.fromClaim(fixture.claimB.record.claim);
        const absent = yield* traversal.fromClaim(ClaimId.make(hashOf("0")));
        expect(denied).toEqual(ProvenanceResult.cases.Missing.make({}));
        expect(absent).toEqual(denied);
      })
    );
  });
});
