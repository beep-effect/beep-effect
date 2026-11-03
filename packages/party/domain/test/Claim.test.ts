import { ClaimVersion } from "@beep/party-domain/Claim";
import { logicalKey, Proposition } from "@beep/party-domain/Proposition";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";

const absent = { _tag: "Absent", reason: "not-assessed" };
const proposition = Proposition.cases.SameParty.make({ left: PartyId.make(1), right: PartyId.make(2) });
const row = {
  id: "party-cv:1",
  logicalKey: logicalKey(proposition),
  proposition,
  supportedBy: ["party-asrt:1"],
  challengedBy: [],
  validTime: { _tag: "Interval", validFrom: 0, validTo: null },
  knowledge: { recordedAt: 10, expiredAt: null },
  supersedes: null,
  review: { _tag: "Proposed" },
  signals: {
    sourceTrust: absent,
    sourceAssertedConfidence: absent,
    extractorConfidence: absent,
    validator: absent,
    reviewer: absent,
  },
};

describe("party claim binding", () => {
  it.effect.prop(
    "preserves claim envelopes and symmetric keys for generated party endpoints",
    [Proposition.cases.SameParty],
    ([proposition]) =>
      Effect.gen(function* () {
        const reverse = Proposition.cases.SameParty.make({ left: proposition.right, right: proposition.left });
        const input = { ...row, proposition, logicalKey: logicalKey(proposition) };
        const decoded = yield* S.decodeUnknownEffect(ClaimVersion)(input);
        const encoded = yield* S.encodeEffect(ClaimVersion)(decoded);
        return logicalKey(reverse) === logicalKey(proposition) && encoded.logicalKey === input.logicalKey;
      }),
    { arbitrary: { runs: 100, seed: "party-claim-endpoints" } }
  );

  it.effect("round-trips the shared envelope with party-owned ids", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeUnknownEffect(ClaimVersion)(row);
      const encoded = yield* S.encodeEffect(ClaimVersion)(decoded);
      expect(encoded).toEqual(row);
      expect(SchemaAST.resolveIdentifier(ClaimVersion.ast)).toContain("party-domain");
    })
  );

  it("rejects inconsistent logical keys and foreign version identifiers", () => {
    const decode = S.decodeUnknownResult(ClaimVersion);
    pipe(decode({ ...row, logicalKey: "unrelated" }), Result.isFailure, TestUtils.assertTrue);
    pipe(decode({ ...row, id: "cv:1" }), Result.isFailure, TestUtils.assertTrue);
  });

  it("orders symmetric endpoints numerically and rejects self-relations", () => {
    const a = Proposition.cases.SameParty.make({ left: PartyId.make(2), right: PartyId.make(10) });
    const b = Proposition.cases.SameParty.make({ left: PartyId.make(10), right: PartyId.make(2) });
    expect(logicalKey(a)).toEqual(logicalKey(b));
    pipe(S.decodeResult(Proposition)({ _tag: "SameParty", left: 1, right: 1 }), Result.isFailure, TestUtils.assertTrue);
  });

  it("keeps delimiter-bearing name payloads unambiguous", () => {
    const a = Proposition.cases.PartyName.make({ party: PartyId.make(1), nameKind: "legal", value: "a|b:2" });
    const b = Proposition.cases.PartyName.make({ party: PartyId.make(1), nameKind: "legal", value: "a|b:20" });
    expect(logicalKey(a)).not.toEqual(logicalKey(b));
  });
});
