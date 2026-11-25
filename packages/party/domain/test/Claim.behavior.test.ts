import {
  ClaimLedger,
  ClaimReviewRecord,
  ClaimStance,
  claimLog,
  claimsAtScope,
  mergeClaimLedgers,
  ReviewState,
  readClaims,
} from "@beep/party-domain/Claim";
import { Proposition } from "@beep/party-domain/Proposition";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import { at, interval, partyClaim, retraction } from "./fixtures/claims.ts";

const pair = (left: number, right: number) =>
  Proposition.cases.SameParty.make({ left: PartyId.make(left), right: PartyId.make(right) });
const scope = (asOf: number, validAt = 0, states: ReadonlyArray<ReviewState["_tag"]> = ["Accepted"]) => ({
  scope: "synthetic",
  asOf: at(asOf),
  validAt: at(validAt),
  states,
});
const selected = (ledger: ClaimLedger, asOf: number, validAt = 0, states?: ReadonlyArray<ReviewState["_tag"]>) =>
  A.map(claimsAtScope(ledger, scope(asOf, validAt, states)), (row) => row.record.claim);

describe("party claim reads", () => {
  it.layer(Digest.layerWebCrypto)("joins", (it) => {
    it.effect("joins only records known by the explicit time and never invents a missing review", () =>
      Effect.gen(function* () {
        const first = yield* partyClaim({ proposition: pair(1, 2), knowledgeStart: 1 });
        const later = ClaimReviewRecord.make({
          claim: first.claim,
          at: at(5),
          review: ReviewState.cases.Proposed.make({}),
        });
        const ledger = mergeClaimLedgers([first.ledger, ClaimLedger.make({ reviews: [later] })]);
        const before = O.getOrThrow(A.head(readClaims(ledger, at(0))));
        TestUtils.assertNone(before.review);
        TestUtils.assertNone(before.evidence);
        TestUtils.assertNone(before.signals);
        TestUtils.assertSome(
          O.map(before.knowledge, (interval) => interval.start),
          at(1)
        );
        const middle = O.getOrThrow(A.head(pipe(ledger, readClaims(at(4)))));
        TestUtils.assertSome(
          O.map(middle.review, (event) => event.review._tag),
          "Accepted"
        );
        const after = O.getOrThrow(A.head(readClaims(ledger, at(5))));
        TestUtils.assertSome(
          O.map(after.review, (event) => event.review._tag),
          "Proposed"
        );
      })
    );

    it.effect("keeps identical simultaneous observations and drops contradictory ones", () =>
      Effect.gen(function* () {
        const first = yield* partyClaim({ proposition: pair(1, 2), knowledgeStart: 1 });
        const replayed = mergeClaimLedgers([first.ledger, first.ledger]);
        TestUtils.assertSome(
          O.map(O.getOrThrow(A.head(readClaims(replayed, at(1)))).review, (event) => event.review._tag),
          "Accepted"
        );
        const contradictory = mergeClaimLedgers([
          first.ledger,
          ClaimLedger.make({
            reviews: [
              ClaimReviewRecord.make({ claim: first.claim, at: at(1), review: ReviewState.cases.Proposed.make({}) }),
            ],
          }),
        ]);
        TestUtils.assertNone(O.getOrThrow(A.head(readClaims(contradictory, at(1)))).review);
        expect(selected(contradictory, 1)).toEqual([]);
      })
    );

    it.effect("omits records without generation receipts from the append-law projection", () =>
      Effect.gen(function* () {
        const first = yield* partyClaim({ proposition: pair(1, 2), knowledgeStart: 1 });
        const ungenerated = ClaimLedger.make({ ...first.ledger, generations: [] });
        expect(claimLog(ungenerated)).toEqual([]);
        TestUtils.assertNone(O.getOrThrow(A.head(readClaims(ungenerated, at(1)))).knowledge);
        expect(selected(ungenerated, 1)).toEqual([]);
        expect(A.map(claimLog(first.ledger), (entry) => entry.claim)).toEqual([first.claim]);
      })
    );
  });

  it.layer(Digest.layerWebCrypto)("scoped selection", (it) => {
    it.effect("selects by partition, knowledge interval, valid time, review state and direct retraction", () =>
      Effect.gen(function* () {
        const original = yield* partyClaim({ proposition: pair(1, 2), knowledgeStart: 1 });
        const successor = yield* partyClaim({ proposition: pair(1, 2), knowledgeStart: 4, supersedes: original.claim });
        const bounded = yield* partyClaim({
          proposition: pair(3, 4),
          knowledgeStart: 1,
          validTime: interval({ from: 10, to: O.some(at(20)) }),
        });
        const foreign = yield* partyClaim({ proposition: pair(5, 6), knowledgeStart: 1, scope: "other" });
        const proposed = yield* partyClaim({
          proposition: pair(7, 8),
          knowledgeStart: 1,
          review: ReviewState.cases.Proposed.makeOption({}),
        });
        const unreviewed = yield* partyClaim({ proposition: pair(9, 10), knowledgeStart: 1, review: O.none() });
        const retracted = yield* partyClaim({ proposition: pair(11, 12), knowledgeStart: 1 });
        const ledger = mergeClaimLedgers([
          original.ledger,
          bounded.ledger,
          foreign.ledger,
          proposed.ledger,
          unreviewed.ledger,
          retracted.ledger,
          retraction({ claim: retracted.claim, at: 3 }),
          successor.ledger,
        ]);
        expect(selected(ledger, 0)).toEqual([]);
        expect(selected(ledger, 2)).toEqual([original.claim, retracted.claim]);
        expect(selected(ledger, 3)).toEqual([original.claim]);
        expect(selected(ledger, 4)).toEqual([successor.claim]);
        expect(selected(ledger, 4, 15)).toEqual([bounded.claim, successor.claim]);
        expect(selected(ledger, 4, 20)).toEqual([successor.claim]);
        expect(selected(ledger, 4, 0, ["Proposed"])).toEqual([proposed.claim]);
        expect(A.map(pipe(ledger, claimsAtScope({ ...scope(4), scope: "other" })), (row) => row.record.claim)).toEqual([
          foreign.claim,
        ]);
      })
    );
  });

  it.layer(Digest.layerWebCrypto)("merge", (it) => {
    it.effect("concatenates every independent record stream without embedding them in cores", () =>
      Effect.gen(function* () {
        const first = yield* partyClaim({ proposition: pair(1, 2), knowledgeStart: 1 });
        const second = yield* partyClaim({ proposition: pair(3, 4), knowledgeStart: 2 });
        const generatedBy = first.record.core.generatedBy;
        const extra = ClaimLedger.make({
          ...retraction({ claim: first.claim, at: 3 }),
          challenges: [{ _tag: "ByActivity", from: second.claim, to: first.claim, kind: "rebut", generatedBy }],
          stances: [ClaimStance.cases.Proposed.make({ claim: first.claim, generatedBy, at: at(1) })],
        });
        const merged = mergeClaimLedgers([first.ledger, second.ledger, extra]);
        expect(merged.claims).toEqual([...first.ledger.claims, ...second.ledger.claims]);
        expect(merged.generations).toHaveLength(2);
        expect(merged.evidence).toHaveLength(2);
        expect(merged.reviews).toHaveLength(2);
        expect(merged.signals).toHaveLength(2);
        expect(merged.challenges).toEqual(extra.challenges);
        expect(merged.retractions).toEqual(extra.retractions);
        expect(merged.stances).toEqual(extra.stances);
        expect(merged.admissions).toEqual([]);
        expect(mergeClaimLedgers([]).claims).toEqual([]);
      })
    );
  });
});
