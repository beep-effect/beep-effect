import { ClaimVersion } from "@beep/party-domain/Claim";
import { logicalKey, Proposition, partiesOf } from "@beep/party-domain/Proposition";
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
      expect(yield* S.encodeEffect(ClaimVersion)(decoded)).toEqual(row);
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

  it("preserves semantic roles and framed identities for account, organization and context claims", () => {
    const cases: ReadonlyArray<{
      readonly input: unknown;
      readonly key: string;
      readonly parties: ReadonlyArray<number>;
    }> = [
      {
        input: { _tag: "AccountIdentifier", account: "party-acct:a", identifier: "party-ident:a" },
        key: "17:AccountIdentifier12:party-acct:a13:party-ident:a",
        parties: [],
      },
      {
        input: { _tag: "MailboxKind", account: "party-acct:a", kind: "shared" },
        key: "11:MailboxKind12:party-acct:a",
        parties: [],
      },
      {
        input: { _tag: "AccountControl", account: "party-acct:a", controller: 2, relation: "operated-by" },
        key: "14:AccountControl12:party-acct:a1:211:operated-by",
        parties: [2],
      },
      {
        input: { _tag: "VoiceAuthor", voice: "party-voice:a", author: 2 },
        key: "11:VoiceAuthor13:party-voice:a1:2",
        parties: [2],
      },
      {
        input: { _tag: "PartyName", party: 1, nameKind: "legal", value: "Acme" },
        key: "9:PartyName1:15:legal4:Acme",
        parties: [1],
      },
      {
        input: { _tag: "Membership", member: 1, organization: 2, role: null, title: null },
        key: "10:Membership1:11:2",
        parties: [1, 2],
      },
      {
        input: { _tag: "ReportsTo", subordinate: 1, superior: 2, organization: null },
        key: "9:ReportsTo1:11:2",
        parties: [1, 2],
      },
      {
        input: { _tag: "DelegateOf", delegate: 1, principal: 2, account: null },
        key: "10:DelegateOf1:11:2",
        parties: [1, 2],
      },
      {
        input: { _tag: "ContextRole", party: 1, context: "party-ctx:a", role: "https://example.test/witness" },
        key: "11:ContextRole1:111:party-ctx:a28:https://example.test/witness",
        parties: [1],
      },
      {
        input: { _tag: "External", subject: 1, object: 2, predicate: "https://example.test/knows" },
        key: "8:External1:126:https://example.test/knows1:2",
        parties: [1, 2],
      },
    ];
    for (const fixture of cases) {
      const value = Result.getOrThrow(S.decodeUnknownResult(Proposition)(fixture.input));
      expect(logicalKey(value)).toBe(fixture.key);
      expect(partiesOf(value)).toEqual(fixture.parties);
    }
  });

  it("keeps delimiter-bearing name payloads unambiguous", () => {
    const a = Proposition.cases.PartyName.make({ party: PartyId.make(1), nameKind: "legal", value: "a|b:2" });
    const b = Proposition.cases.PartyName.make({ party: PartyId.make(1), nameKind: "legal", value: "a|b:20" });
    expect(logicalKey(a)).not.toEqual(logicalKey(b));
  });
});
