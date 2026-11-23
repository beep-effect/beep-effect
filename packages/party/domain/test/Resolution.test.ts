import { ClaimLedger, mergeClaimLedgers } from "@beep/party-domain/Claim";
import { PartyKey } from "@beep/party-domain/PartyKey";
import { Proposition } from "@beep/party-domain/Proposition";
import { ConflictingReview, ResolutionScope, resolveParties } from "@beep/party-domain/Resolution";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { partyClaim, retraction } from "./fixtures/claims.ts";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import type { PartyClaim } from "./fixtures/claims.ts";

const scope = (asOf: number) =>
  ResolutionScope.make({ scope: "synthetic", asOf: DateTime.makeUnsafe(asOf), validAt: DateTime.makeUnsafe(0) });
const pair = (tag: "SameParty" | "DistinctParty", left: number, right: number) =>
  Proposition.cases[tag].make({ left: PartyId.make(left), right: PartyId.make(right) });
const claim = (operation: string, proposition: Proposition, knowledgeStart = 1) =>
  partyClaim({ proposition, knowledgeStart, operation });
const ledgerOf = (rows: ReadonlyArray<PartyClaim>, ...extra: ReadonlyArray<ClaimLedger>) =>
  mergeClaimLedgers([...A.map(rows, (row) => row.ledger), ...extra]);
const reversed = (ledger: ClaimLedger) => ClaimLedger.make({ ...ledger, claims: A.reverse(ledger.claims) });
const survivors = (ledger: ClaimLedger, at = 10) =>
  A.map(resolveParties(ledger, scope(at)).representatives, (row) => [row.party, row.survivor]);
type ClaimFailure = Effect.Error<ReturnType<typeof partyClaim>>;
const before = (left: PartyClaim, right: PartyClaim) => Str.Order(left.claim, right.claim) < 0;
const ascending = (rows: ReadonlyArray<PartyClaim>) =>
  A.every(A.zip(rows, A.drop(rows, 1)), ([left, right]) => before(left, right));
const ordered = Effect.fnUntraced(function* <Rows extends ReadonlyArray<PartyClaim>>(
  make: (salt: string) => Effect.Effect<Rows, ClaimFailure, Digest.Digest>,
  accept: (rows: Rows) => boolean
) {
  for (const salt of A.map(A.range(0, 127), (n) => `${n}`)) {
    const rows = yield* make(salt);
    if (accept(rows)) return rows;
  }
  return yield* Effect.die("no salt produced the requested claim-id order");
});

describe("cannot-link-first resolution", () => {
  it.layer(Digest.layerWebCrypto)("resolution", (it) => {
    it.effect("ignores redundant merge edges and applies reversed veto endpoints", () =>
      Effect.gen(function* () {
        const rows = yield* ordered(
          (salt) =>
            Effect.all(
              [
                claim(`a-${salt}`, pair("SameParty", 1, 2)),
                claim(`b-${salt}`, pair("SameParty", 2, 1)),
                claim(`c-${salt}`, pair("SameParty", 1, 3)),
                claim("d", pair("DistinctParty", 3, 2)),
              ],
              { concurrency: 1 }
            ),
          ([a, b, c]) => before(a, c) && before(b, c)
        );
        const ledger = ledgerOf(rows);
        expect(survivors(ledger)).toEqual([
          [1, 1],
          [2, 1],
          [3, 3],
        ]);
        expect(resolveParties(ledger, scope(10)).reviewCases).toHaveLength(1);
      })
    );

    it.effect("a late veto splits a prior merge only from its knowledge time", () =>
      Effect.gen(function* () {
        const merge = yield* claim("merge", pair("SameParty", 1, 2));
        const veto = yield* claim("veto", pair("DistinctParty", 1, 2), 5);
        const ledger = ledgerOf([merge, veto], retraction({ claim: veto.claim, at: 9 }));
        expect(survivors(ledger, 4)).toEqual([
          [1, 1],
          [2, 1],
        ]);
        expect(survivors(ledger, 5)).toEqual([
          [1, 1],
          [2, 2],
        ]);
        expect(resolveParties(ledger, scope(5)).reviewCases).toHaveLength(1);
        expect(survivors(ledger, 9)).toEqual([
          [1, 1],
          [2, 1],
        ]);
        expect(resolveParties(ledger, scope(9)).reviewCases).toEqual([]);
      })
    );

    it.effect("ignores claims recorded in another partition", () =>
      Effect.gen(function* () {
        const merge = yield* claim("merge", pair("SameParty", 1, 2));
        const foreign = yield* partyClaim({ proposition: pair("SameParty", 2, 3), knowledgeStart: 1, scope: "other" });
        expect(survivors(ledgerOf([merge, foreign]))).toEqual([
          [1, 1],
          [2, 1],
        ]);
      })
    );

    it.effect("equal-time vetoes win in both claim-id orders and preserve each original key", () =>
      Effect.gen(function* () {
        const assignments = yield* ordered(
          (salt) =>
            Effect.forEach(
              [
                { party: 1, token: "1" },
                { party: 2, token: "2" },
              ],
              ({ party, token }) =>
                claim(
                  `key-${party}-${salt}`,
                  Proposition.cases.KeyAssignment.make({
                    party: PartyId.make(party),
                    key: PartyKey.make(`pk:v1:${Str.repeat(64)(token)}`),
                  }),
                  0
                ),
              { concurrency: 1 }
            ),
          ascending
        );
        const pairAt = (salt: string) =>
          Effect.all(
            [claim(`merge-${salt}`, pair("SameParty", 1, 2), 5), claim(`veto-${salt}`, pair("DistinctParty", 1, 2), 5)],
            { concurrency: 1 }
          );
        for (const mergeFirst of [true, false]) {
          const [merge, veto] = yield* ordered(pairAt, ([merge, veto]) => before(merge, veto) === mergeFirst);
          const ledger = ledgerOf([...assignments, merge, veto]);
          const view = resolveParties(ledger, scope(5));
          expect(survivors(ledger, 5)).toEqual([
            [1, 1],
            [2, 2],
          ]);
          expect(A.map(view.keys, (row) => [row.key, row.party, row.survivor])).toEqual([
            [`pk:v1:${Str.repeat(64)("1")}`, 1, 1],
            [`pk:v1:${Str.repeat(64)("2")}`, 2, 2],
          ]);
          expect(view.reviewCases).toEqual([
            ConflictingReview.make({
              blockedClaim: merge.claim,
              vetoClaims: [veto.claim],
              left: PartyId.make(1),
              right: PartyId.make(2),
              scope: scope(5),
            }),
          ]);
          expect(resolveParties(reversed(ledger), scope(5))).toEqual(view);
        }
      })
    );

    it.effect("equal-time competing merges replay by id independently of input order", () =>
      Effect.gen(function* () {
        const [a, b] = yield* ordered(
          (salt) =>
            Effect.all([claim(`a-${salt}`, pair("SameParty", 1, 2)), claim(`b-${salt}`, pair("SameParty", 2, 3))], {
              concurrency: 1,
            }),
          ([a, b]) => before(a, b)
        );
        const veto = yield* claim("z", pair("DistinctParty", 1, 3));
        const ledger = ledgerOf([b, veto, a]);
        const view = resolveParties(ledger, scope(10));
        expect(survivors(ledger)).toEqual([
          [1, 1],
          [2, 1],
          [3, 3],
        ]);
        expect(view.reviewCases[0]?.blockedClaim).toBe(b.claim);
        expect(resolveParties(reversed(ledger), scope(10))).toEqual(view);
      })
    );

    it.effect("retraction of an earlier merge re-enables a previously blocked edge", () =>
      Effect.gen(function* () {
        const rows = yield* ordered(
          (salt) =>
            Effect.all(
              [
                claim(`a-${salt}`, pair("SameParty", 1, 2)),
                claim(`b-${salt}`, pair("SameParty", 2, 3)),
                claim("v", pair("DistinctParty", 1, 3)),
              ],
              { concurrency: 1 }
            ),
          ([a, b]) => before(a, b)
        );
        const first = O.getOrThrow(A.head(rows));
        const ledger = ledgerOf(rows, retraction({ claim: first.claim, at: 5 }));
        expect(survivors(ledger, 4)).toEqual([
          [1, 1],
          [2, 1],
          [3, 3],
        ]);
        expect(resolveParties(ledger, scope(4)).reviewCases).toHaveLength(1);
        expect(survivors(ledger, 5)).toEqual([
          [1, 1],
          [2, 2],
          [3, 2],
        ]);
        expect(resolveParties(ledger, scope(5)).reviewCases).toEqual([]);
      })
    );

    it.effect("a cycle stays connected when one edge is retracted", () =>
      Effect.gen(function* () {
        const rows = yield* Effect.all(
          [
            claim("a", pair("SameParty", 1, 2)),
            claim("b", pair("SameParty", 2, 3)),
            claim("c", pair("SameParty", 1, 3)),
          ],
          { concurrency: 1 }
        );
        const ledger = ledgerOf(rows, retraction({ claim: O.getOrThrow(A.head(rows)).claim, at: 5 }));
        expect(survivors(ledger)).toEqual([
          [1, 1],
          [2, 1],
          [3, 1],
        ]);
      })
    );

    it.effect("orders blocking vetoes by code point and retains every one", () =>
      Effect.gen(function* () {
        const rows = yield* Effect.all(
          [
            claim("m1", pair("SameParty", 1, 2)),
            claim("m2", pair("SameParty", 2, 3)),
            claim("v1", pair("DistinctParty", 1, 3), 0),
            claim("v2", pair("DistinctParty", 3, 1), 0),
          ],
          { concurrency: 1 }
        );
        const view = resolveParties(ledgerOf(rows), scope(10));
        const vetoes: ReadonlyArray<ClaimId> = A.sort(
          A.map(A.drop(rows, 2), (row) => row.claim),
          Order.String
        );
        expect(view.reviewCases[0]?.vetoClaims).toEqual(vetoes);
        expect(A.length(view.reviewCases)).toBe(1);
      })
    );
  });
});
