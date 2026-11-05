import { ClaimVersion } from "@beep/party-domain/Claim";
import { PartyKey } from "@beep/party-domain/PartyKey";
import { logicalKey, Proposition } from "@beep/party-domain/Proposition";
import { ConflictingReview, ResolutionScope, resolveParties } from "@beep/party-domain/Resolution";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const scope = (asOf: number) =>
  ResolutionScope.make({ asOf: DateTime.makeUnsafe(asOf), validAt: DateTime.makeUnsafe(0) });
const absent = { _tag: "Absent", reason: "not-assessed" };
const pair = (tag: "SameParty" | "DistinctParty", left: number, right: number) =>
  Proposition.cases[tag].make({ left: PartyId.make(left), right: PartyId.make(right) });
const claim = (id: string, proposition: Proposition, recordedAt = 1, expiredAt: number | null = null) =>
  S.decodeUnknownEffect(ClaimVersion)({
    id: `party-cv:${id}`,
    proposition,
    logicalKey: logicalKey(proposition),
    supportedBy: ["party-asrt:test"],
    challengedBy: [],
    supersedes: null,
    knowledge: { recordedAt, expiredAt },
    validTime: { _tag: "Interval", validFrom: 0, validTo: null },
    review: {
      _tag: "Accepted",
      disposition: {
        disposition: "accepted",
        reviewer: "party-user:test",
        basis: "1234567812345678123456781234567812345678123456781234567812345678",
        reviewedAt: recordedAt,
        reason: "Synthetic review",
      },
    },
    signals: {
      sourceTrust: absent,
      sourceAssertedConfidence: absent,
      extractorConfidence: absent,
      validator: absent,
      reviewer: absent,
    },
  });
const survivors = (versions: ReadonlyArray<ClaimVersion>, at = 10) =>
  A.map(resolveParties(versions, scope(at)).representatives, (row) => [row.party, row.survivor]);

describe("cannot-link-first resolution", () => {
  it.effect("ignores redundant merge edges and applies reversed veto endpoints", () =>
    Effect.gen(function* () {
      const rows = yield* Effect.all([
        claim("a", pair("SameParty", 1, 2)),
        claim("b", pair("SameParty", 2, 1)),
        claim("c", pair("SameParty", 1, 3)),
        claim("d", pair("DistinctParty", 3, 2)),
      ]);
      expect(survivors(rows)).toEqual([
        [1, 1],
        [2, 1],
        [3, 3],
      ]);
      expect(resolveParties(rows, scope(10)).reviewCases).toHaveLength(1);
    })
  );
  it.effect("a late veto splits a prior merge only from its knowledge time", () =>
    Effect.gen(function* () {
      const rows = yield* Effect.all([
        claim("merge", pair("SameParty", 1, 2)),
        claim("veto", pair("DistinctParty", 1, 2), 5, 9),
      ]);
      expect(survivors(rows, 4)).toEqual([
        [1, 1],
        [2, 1],
      ]);
      expect(survivors(rows, 5)).toEqual([
        [1, 1],
        [2, 2],
      ]);
      expect(resolveParties(rows, scope(5)).reviewCases).toHaveLength(1);
      expect(survivors(rows, 9)).toEqual([
        [1, 1],
        [2, 1],
      ]);
      expect(resolveParties(rows, scope(9)).reviewCases).toEqual([]);
    })
  );

  it.effect("equal-time vetoes win in both claim-id orders and preserve each original key", () =>
    Effect.gen(function* () {
      const assignments = yield* Effect.forEach(
        [
          { party: 1, token: "1" },
          { party: 2, token: "2" },
        ],
        ({ party, token }) =>
          claim(
            `key-${party}`,
            Proposition.cases.KeyAssignment.make({
              party: PartyId.make(party),
              key: PartyKey.make(`pk:v1:${Str.repeat(64)(token)}`),
            }),
            0
          )
      );
      for (const { mergeId, vetoId } of [
        { mergeId: "a", vetoId: "z" },
        { mergeId: "z", vetoId: "a" },
      ]) {
        const merge = yield* claim(mergeId, pair("SameParty", 1, 2), 5);
        const veto = yield* claim(vetoId, pair("DistinctParty", 1, 2), 5);
        const rows = [...assignments, merge, veto];
        const view = resolveParties(rows, scope(5));
        expect(survivors(rows, 5)).toEqual([
          [1, 1],
          [2, 2],
        ]);
        expect(A.map(view.keys, (row) => [row.key, row.party, row.survivor])).toEqual([
          [`pk:v1:${Str.repeat(64)("1")}`, 1, 1],
          [`pk:v1:${Str.repeat(64)("2")}`, 2, 2],
        ]);
        expect(view.reviewCases).toEqual([
          ConflictingReview.make({
            blockedClaim: merge.id,
            vetoClaims: [veto.id],
            left: PartyId.make(1),
            right: PartyId.make(2),
            scope: scope(5),
          }),
        ]);
        expect(resolveParties(A.reverse(rows), scope(5))).toEqual(view);
      }
    })
  );

  it.effect("equal-time competing merges replay by id independently of input order", () =>
    Effect.gen(function* () {
      const rows = yield* Effect.all([
        claim("a", pair("SameParty", 1, 2)),
        claim("b", pair("SameParty", 2, 3)),
        claim("z", pair("DistinctParty", 1, 3)),
      ]);
      const view = resolveParties(rows, scope(10));
      expect(survivors(rows)).toEqual([
        [1, 1],
        [2, 1],
        [3, 3],
      ]);
      expect(view.reviewCases[0]?.blockedClaim).toBe("party-cv:b");
      expect(resolveParties(A.reverse(rows), scope(10))).toEqual(view);
    })
  );

  it.effect("retraction of an earlier merge re-enables a previously blocked edge", () =>
    Effect.gen(function* () {
      const rows = yield* Effect.all([
        claim("a", pair("SameParty", 1, 2), 1, 5),
        claim("b", pair("SameParty", 2, 3)),
        claim("v", pair("DistinctParty", 1, 3)),
      ]);
      expect(survivors(rows, 4)).toEqual([
        [1, 1],
        [2, 1],
        [3, 3],
      ]);
      expect(survivors(rows, 5)).toEqual([
        [1, 1],
        [2, 2],
        [3, 2],
      ]);
      expect(resolveParties(rows, scope(5)).reviewCases).toEqual([]);
    })
  );

  it.effect("a cycle stays connected when one edge expires", () =>
    Effect.gen(function* () {
      const rows = yield* Effect.all([
        claim("a", pair("SameParty", 1, 2), 1, 5),
        claim("b", pair("SameParty", 2, 3)),
        claim("c", pair("SameParty", 1, 3)),
      ]);
      expect(survivors(rows)).toEqual([
        [1, 1],
        [2, 1],
        [3, 1],
      ]);
    })
  );

  it.effect("orders non-BMP ids by Unicode code point and retains every blocking veto", () =>
    Effect.gen(function* () {
      const rows = yield* Effect.all([
        claim("\u{10000}", pair("SameParty", 1, 2)),
        claim("\ue000", pair("SameParty", 2, 3)),
        claim("v1", pair("DistinctParty", 1, 3)),
        claim("v2", pair("DistinctParty", 1, 3)),
      ]);
      const view = resolveParties(rows, scope(10));
      expect(survivors(rows)).toEqual([
        [1, 1],
        [2, 2],
        [3, 2],
      ]);
      expect(view.reviewCases[0]?.vetoClaims).toEqual(["party-cv:v1", "party-cv:v2"]);
    })
  );
});
