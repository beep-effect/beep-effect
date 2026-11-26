import {
  DistinctionPreimage,
  DistinctionProposition,
  LawAdmissionAction,
  LawClaimArrows,
  LawPrincipalId,
  LawProposedClaimRecord,
  LawRevision,
  mintDistinctionId,
  ScopeRef,
} from "@beep/law-practice-domain/values/LawClaim";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { coreIn, proposition } from "./support/LawClaimFixtures.ts";
import type * as Shared from "@beep/shared-domain/identity/Shared";

describe("LawClaim identity", () => {
  it.layer(Digest.layerWebCrypto)("content ids", (it) => {
    it.effect("holds the law-distinction/v1 golden vector", () => DistinctionPreimage.verifyGolden());

    it.effect("mints one distinction id per proposition", () =>
      Effect.gen(function* () {
        const first = yield* mintDistinctionId(proposition);
        const again = yield* mintDistinctionId(DistinctionProposition.make({ ...proposition }));
        const other = yield* mintDistinctionId(DistinctionProposition.make({ ...proposition, claimNumber: 2 }));
        expect(again).toBe(first);
        expect(other).not.toBe(first);
        expect(first).toBe(DistinctionPreimage.golden.hash);
      })
    );

    it.effect("gives two ids to cores that differ only in scope and one id to identical cores", () =>
      Effect.gen(function* () {
        const inA = yield* LawClaimArrows.mint(coreIn(ScopeRef.make("matter:a")));
        const inB = yield* LawClaimArrows.mint(coreIn(ScopeRef.make("matter:b")));
        const inAAgain = yield* LawClaimArrows.mint(coreIn(ScopeRef.make("matter:a")));
        expect(inA).not.toBe(inB);
        expect(inAAgain).toBe(inA);
      })
    );

    it.effect("decodes a proposed record with no admission field", () =>
      Effect.gen(function* () {
        const core = coreIn(ScopeRef.make("matter:a"));
        const claim = yield* LawClaimArrows.mint(core);
        const proposed = LawProposedClaimRecord.make({ claim, core, stance: "proposed" });
        const encoded = yield* S.encodeEffect(LawProposedClaimRecord)(proposed);
        const decoded = yield* S.decodeEffect(LawProposedClaimRecord)(encoded);
        expect(decoded.claim).toBe(claim);
        expect(R.keys(LawProposedClaimRecord.fields)).toEqual(["claim", "core", "stance"]);
      })
    );
  });

  it("binds a principal that is a shared user id, a branded revision and the admission action", () => {
    const principal: Shared.UserId = LawPrincipalId.make(7);
    expect(principal).toBe(7);
    expect(S.is(LawRevision)("")).toBe(false);
    expect(LawAdmissionAction.literals).toEqual(["admit-distinction"]);
  });
});
