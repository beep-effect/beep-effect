import { GenerationFact } from "@beep/epistemics/Admission";
import {
  DistinctionProposition,
  LawAdmission,
  LawClaimArrows,
  LawClaimCore,
  LawPrincipalId,
  LawProposedClaimRecord,
  LawRevision,
  logicalKey,
  ScopeRef,
} from "@beep/law-practice-domain/values/LawClaim";
import { LawClaimStoreMemory } from "@beep/law-practice-server/ClaimStore";
import {
  AdmissionBinding,
  LawClaimAdmissions,
  LawClaimProposals,
  ProposedClaimEntry,
  ProposedClaimLookup,
} from "@beep/law-practice-use-cases/ClaimStore";
import { ActivityId } from "@beep/schema/ContentHash";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";

const proposition = DistinctionProposition.make({
  authority: "office-action",
  applicationNumber: "16/123,456",
  claimNumber: 1,
  ground: "102",
  referenceDocument: "US 9,876,543 B2",
  detail: { kind: "missing_limitation", limitation: "a hinged lid" },
});

const activityOf = (digit: string) => ActivityId.make(`sha256:${Str.repeat(64)(digit)}`);

const entryIn = Effect.fn("ClaimStoreMemoryTest.entryIn")(function* (
  scope: ScopeRef,
  knowledgeStart: number,
  activity = activityOf("b")
) {
  const core = LawClaimCore.make({
    proposition,
    logicalKey: logicalKey(proposition),
    supportAtCreation: HashSet.empty(),
    derivedFrom: HashSet.empty(),
    supersedes: O.none(),
    generatedBy: activity,
    assertedBy: { _tag: "Person", principal: LawPrincipalId.make(7) },
    valid: { _tag: "Unknown" },
    knowledgeStart: DateTime.makeUnsafe(knowledgeStart),
    scope,
  });
  const claim = yield* LawClaimArrows.mint(core);
  return ProposedClaimEntry.make({
    record: LawProposedClaimRecord.make({ claim, core, stance: "proposed" }),
    generation: GenerationFact.make({ activity, at: DateTime.makeUnsafe(knowledgeStart) }),
    activities: HashSet.empty(),
    captures: HashSet.empty(),
  });
});

const storeLayer = Layer.merge(LawClaimStoreMemory, Digest.layerWebCrypto);

describe("LawClaimStoreMemory", () => {
  it.layer(storeLayer)("proposals", (it) => {
    it.effect("stores a proposal and finds it by claim, lookup and generating activity", () =>
      Effect.gen(function* () {
        const proposals = yield* LawClaimProposals;
        const entry = yield* entryIn(ScopeRef.make("matter:store-a"), 1_000);
        yield* proposals.appendProposed(entry);
        const byClaim = yield* proposals.get(entry.record.claim);
        const byLookup = yield* proposals.findProposed(
          ProposedClaimLookup.make({
            scope: entry.record.core.scope,
            logicalKey: entry.record.core.logicalKey,
            supportAtCreation: entry.record.core.supportAtCreation,
          })
        );
        const generation = yield* proposals.generation(entry.generation.activity);
        const activities = yield* proposals.activities(entry.record.claim);
        assertSome(byClaim, entry.record);
        assertSome(byLookup, entry.record);
        assertSome(generation, entry.generation);
        expect(HashSet.size(activities)).toBe(0);
      })
    );

    it.effect("refuses to re-append a claim from another generating activity", () =>
      Effect.gen(function* () {
        const proposals = yield* LawClaimProposals;
        const scope = ScopeRef.make("matter:store-b");
        const first = yield* entryIn(scope, 1_000, activityOf("c"));
        yield* proposals.appendProposed(first);
        const same = yield* proposals.appendProposed(first).pipe(Effect.exit);
        const other = yield* entryIn(scope, 1_000, activityOf("d"));
        const forged = ProposedClaimEntry.make({ ...other, record: first.record });
        const refused = yield* proposals.appendProposed(forged).pipe(Effect.flip);
        expect(same._tag).toBe("Success");
        expect(refused).toMatchObject({ _tag: "LawClaimStoreError", operation: "append-proposed" });
      })
    );

    it.effect("keeps every proposal appended concurrently from different scopes", () =>
      Effect.gen(function* () {
        const proposals = yield* LawClaimProposals;
        const entries = yield* Effect.forEach(
          A.range(0, 7),
          (index) => entryIn(ScopeRef.make(`matter:store-concurrent-${index}`), 1_000 + index, activityOf(`${index}`)),
          { concurrency: 1 }
        );
        yield* Effect.forEach(
          entries,
          (entry) => proposals.withPartition(entry.record.core.scope, () => proposals.appendProposed(entry)),
          {
            concurrency: "unbounded",
          }
        );
        const stored = yield* Effect.forEach(entries, (entry) => proposals.get(entry.record.claim), { concurrency: 1 });
        expect(A.getSomes(stored)).toEqual(A.map(entries, (entry) => entry.record));
      })
    );

    it.effect("runs a partition body with the scope's latest knowledge start, one body at a time", () =>
      Effect.gen(function* () {
        const proposals = yield* LawClaimProposals;
        const scope = ScopeRef.make("matter:store-c");
        const empty = yield* proposals.withPartition(scope, Effect.succeed);
        assertNone(empty);
        const early = yield* entryIn(scope, 2_000, activityOf("e"));
        const late = yield* entryIn(ScopeRef.make("matter:store-c"), 5_000, activityOf("f"));
        yield* proposals.appendProposed(early);
        yield* proposals.appendProposed(late);
        const latest = yield* proposals.withPartition(scope, Effect.succeed);
        assertSome(latest, DateTime.makeUnsafe(5_000));
        const inside = yield* Ref.make(0);
        const peak = yield* Ref.make(0);
        const body = Effect.fn("ClaimStoreMemoryTest.partitionBody")(function* () {
          const now = yield* Ref.updateAndGet(inside, (count) => count + 1);
          yield* Ref.update(peak, (seen) => Math.max(seen, now));
          yield* Effect.yieldNow;
          yield* Ref.update(inside, (count) => count - 1);
        });
        yield* Effect.all([proposals.withPartition(scope, body), proposals.withPartition(scope, body)], {
          concurrency: 2,
        });
        const observedPeak = yield* Ref.get(peak);
        expect(observedPeak).toBe(1);
      })
    );
  });

  it.layer(storeLayer)("admissions", (it) => {
    it.effect("answers a missing binding until one is opened, then the bound claim", () =>
      Effect.gen(function* () {
        const admissions = yield* LawClaimAdmissions;
        const entry = yield* entryIn(ScopeRef.make("matter:store-d"), 1_000);
        const request = {
          actor: LawPrincipalId.make(7),
          action: "admit-distinction",
          revision: LawRevision.make("revision-1"),
          scope: entry.record.core.scope,
        } as const;
        const missing = yield* admissions.binding(request);
        yield* admissions.openAdmission(AdmissionBinding.make({ ...request, claim: entry.record.claim }));
        const bound = yield* admissions.binding(request);
        const other = yield* admissions.binding({ ...request, revision: LawRevision.make("revision-2") });
        const stored = yield* admissions.admissions(entry.record.claim);
        expect(missing).toMatchObject({ _tag: "Unavailable", reason: "missing" });
        expect(bound).toMatchObject({ _tag: "Claim", claim: entry.record.claim });
        expect(other).toMatchObject({ _tag: "Unavailable", reason: "missing" });
        expect(stored).toEqual([]);
      })
    );

    it.effect("stores an admission under its claim only", () =>
      Effect.gen(function* () {
        const admissions = yield* LawClaimAdmissions;
        const entry = yield* entryIn(ScopeRef.make("matter:store-e"), 1_000);
        const digest = SourceTextDigest.make(`sha256:${Str.repeat(64)("1")}`);
        const receipt = TextAnchorVerificationReceipt.make({
          source: SourceTextIdentity.make({
            scopeRef: entry.record.core.scope,
            sourceRef: "source",
            locator: SourceTextLocator.make("fixture.txt"),
            sourceDigest: digest,
            textDigest: digest,
            extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
            normalizationVersion: "1",
          }),
          anchor: TextAnchor.make({ startChar: 0, endChar: 4, quote: "fact" }),
        });
        const binding = {
          actor: LawPrincipalId.make(7),
          scope: entry.record.core.scope,
          action: "admit-distinction",
          revision: LawRevision.make("revision-1"),
        } as const;
        const admission = LawAdmission.make({
          claim: entry.record.claim,
          ...binding,
          grounding: [receipt],
          token: {
            ...binding,
            issuedAt: DateTime.makeUnsafe(0),
            attestation: Sha256PrefixedDigest.make(`sha256:${Str.repeat(64)("a")}`),
          },
          at: DateTime.makeUnsafe(1),
          clearsRetraction: O.none(),
        });
        yield* admissions.appendAdmission(admission);
        const stored = yield* admissions.admissions(entry.record.claim);
        const other = yield* entryIn(ScopeRef.make("matter:store-f"), 1_000);
        const none = yield* admissions.admissions(other.record.claim);
        expect(stored).toEqual([admission]);
        expect(none).toEqual([]);
      })
    );
  });
});
