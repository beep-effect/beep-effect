import { ClaimAgent, ClaimCore, ClaimCreation, ClaimRecord } from "@beep/party-domain/Claim";
import { logicalKey, Proposition, partiesOf } from "@beep/party-domain/Proposition";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";
import { activityStart, analyst, at, PartyClaims, partyClaim } from "./fixtures/claims.ts";

const proposition = Proposition.cases.SameParty.make({ left: PartyId.make(1), right: PartyId.make(2) });

describe("party claim binding", () => {
  it.layer(Digest.layerWebCrypto)("checked records", (it) => {
    it.effect.prop(
      "preserves claim records and symmetric keys for generated party endpoints",
      [Proposition.cases.SameParty],
      ([proposition]) =>
        Effect.gen(function* () {
          const reverse = Proposition.cases.SameParty.make({ left: proposition.right, right: proposition.left });
          const { record } = yield* partyClaim({ proposition, knowledgeStart: 1 });
          const encoded = yield* PartyClaims.encodeClaimRecord(record);
          const decoded = yield* PartyClaims.decodeClaimRecord(encoded);
          return (
            logicalKey(reverse) === logicalKey(proposition) &&
            decoded.core.logicalKey === logicalKey(proposition) &&
            decoded.claim === record.claim
          );
        }),
      { arbitrary: { runs: 100, seed: "party-claim-endpoints" } }
    );

    it.effect("round-trips checked records with party-owned ids and content-addressed claim ids", () =>
      Effect.gen(function* () {
        const { record } = yield* partyClaim({ proposition, knowledgeStart: 10 });
        const encoded = yield* PartyClaims.encodeClaimRecord(record);
        const decoded = yield* PartyClaims.decodeClaimRecord(encoded);
        const reencoded = yield* PartyClaims.encodeClaimRecord(decoded);
        expect(reencoded).toEqual(encoded);
        expect(Str.startsWith("sha256:")(record.claim)).toBe(true);
        expect(SchemaAST.resolveIdentifier(ClaimRecord.ast)).toContain("@beep/party-domain/entities/Claim/");
        expect(SchemaAST.resolveIdentifier(ClaimCore.ast)).toContain("@beep/party-domain/entities/Claim/");
      })
    );

    it.effect("rejects inconsistent logical keys, foreign claim identifiers and mismatched content addresses", () =>
      Effect.gen(function* () {
        const { record } = yield* partyClaim({ proposition, knowledgeStart: 10 });
        const other = yield* partyClaim({ proposition, knowledgeStart: 11 });
        const encoded = yield* S.encodeEffect(ClaimRecord)(record);
        const decode = S.decodeUnknownResult(ClaimRecord);
        pipe(decode(encoded), Result.isSuccess, TestUtils.assertTrue);
        pipe(
          decode({ ...encoded, core: { ...encoded.core, logicalKey: "unrelated" } }),
          Result.isFailure,
          TestUtils.assertTrue
        );
        pipe(decode({ ...encoded, claim: "party-cv:1" }), Result.isFailure, TestUtils.assertTrue);
        const swapped = yield* PartyClaims.decodeClaimRecord({ ...encoded, claim: other.claim }).pipe(Effect.flip);
        expect(swapped).toMatchObject({ _tag: "ClaimCoreInvalid", reason: "key-mismatch" });
      })
    );
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

  it("orders native creation facts: activity start, generation end, then knowledge start", () => {
    const creation = (started: number, generatedAt: number, knowledgeStart: number) => () =>
      ClaimCreation.make({
        activity: activityStart({ operation: "creation", started }),
        generatedAt: at(generatedAt),
        knowledgeStart: at(knowledgeStart),
        scope: "synthetic",
        assertedBy: ClaimAgent.cases.Person.make({ principal: analyst }),
      });
    expect(creation(1, 1, 1)().scope).toBe("synthetic");
    expect(creation(2, 1, 3)).toThrow();
    expect(creation(1, 3, 2)).toThrow();
  });
});
