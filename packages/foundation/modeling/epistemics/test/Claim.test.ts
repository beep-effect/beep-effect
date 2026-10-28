import { makeClaimEnvelope, validAt, versionsAt } from "@beep/epistemics/Claim";
import { $EpistemicsId } from "@beep/identity/packages";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Str from "effect/String";

const Knows = S.TaggedStruct("Knows", { left: S.String, right: S.String });

const bind = (path: string) =>
  makeClaimEnvelope({
    $I: $EpistemicsId.create(path),
    proposition: Knows,
    logicalKey: (p) => `Knows|${Str.length(p.left)}:${p.left}|${Str.length(p.right)}:${p.right}`,
    ids: {
      claimVersion: S.String.pipe(S.brand("TestClaimVersionId")),
      assertion: S.String.pipe(S.brand("TestAssertionId")),
      activity: S.String.pipe(S.brand("TestActivityId")),
      principal: S.String.pipe(S.brand("TestPrincipalId")),
    },
  });

const { ClaimVersion } = bind("test/ClaimA");
const absent = { _tag: "Absent", reason: "not-assessed" } as const;

const encoded = (
  id: string,
  validTime: unknown,
  recordedAt: number,
  expiredAt: number | null,
  review = "Proposed"
) => ({
  id,
  logicalKey: "Knows|1:a|1:b",
  proposition: { _tag: "Knows", left: "a", right: "b" },
  supportedBy: ["asrt-1"],
  challengedBy: [],
  validTime,
  knowledge: { recordedAt, expiredAt },
  supersedes: null,
  review: { _tag: review },
  signals: {
    sourceTrust: absent,
    sourceAssertedConfidence: absent,
    extractorConfidence: absent,
    validator: absent,
    reviewer: absent,
  },
});

const decode = S.decodeUnknownEffect(ClaimVersion);
const encode = S.encodeEffect(ClaimVersion);
const at = DateTime.makeUnsafe;

describe("Claim envelope", () => {
  it.effect("round-trips an encoded claim version unchanged", () =>
    Effect.gen(function* () {
      const row = encoded("cv-1", { _tag: "Interval", validFrom: 100, validTo: null }, 50, null);
      expect(yield* encode(yield* decode(row))).toEqual(row);
    })
  );

  it.effect("rejects a logical key that disagrees with the proposition", () =>
    Effect.gen(function* () {
      const row = encoded("cv-wrong-key", { _tag: "Unknown" }, 50, null);
      const mismatched = yield* Effect.exit(decode({ ...row, logicalKey: "Knows|other|key" }));
      mismatched.pipe(Exit.isFailure, assertTrue);
      const valid = yield* decode(row);
      const mismatchedEncoding = yield* Effect.exit(encode({ ...valid, logicalKey: "Knows|other|key" }));
      mismatchedEncoding.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("keeps propositions containing separators distinct", () =>
    Effect.gen(function* () {
      const row = encoded("cv-separators", { _tag: "Unknown" }, 50, null);
      const first = {
        ...row,
        logicalKey: "Knows|3:a|b|1:c",
        proposition: { _tag: "Knows", left: "a|b", right: "c" },
      };
      const second = {
        ...row,
        logicalKey: "Knows|1:a|3:b|c",
        proposition: { _tag: "Knows", left: "a", right: "b|c" },
      };
      const a = yield* decode(first);
      const b = yield* decode(second);
      expect(a.logicalKey).not.toEqual(b.logicalKey);
      const borrowedKey = yield* Effect.exit(decode({ ...first, logicalKey: second.logicalKey }));
      borrowedKey.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("derives keys from decoded propositions in both codec directions", () =>
    Effect.gen(function* () {
      const { ClaimVersion: NumericClaim } = makeClaimEnvelope({
        $I: $EpistemicsId.create("test/DecodedPropositionKey"),
        proposition: S.Struct({ value: S.FiniteFromString }),
        logicalKey: (p) => `${p.value + 1}`,
        ids: { claimVersion: S.String, assertion: S.String, activity: S.String, principal: S.String },
      });
      const decodeNumeric = S.decodeUnknownEffect(NumericClaim);
      const encodeNumeric = S.encodeEffect(NumericClaim);
      const row = {
        ...encoded("cv-transformed", { _tag: "Unknown" }, 50, null),
        logicalKey: "2",
        proposition: { value: "1" },
      };
      const decoded = yield* decodeNumeric(row);
      expect(decoded.proposition.value).toEqual(1);
      expect(yield* encodeNumeric(decoded)).toEqual(row);
      // Applying the key function to the encoded string would concatenate to "11".
      const wrongDecode = yield* Effect.exit(decodeNumeric({ ...row, logicalKey: "11" }));
      const wrongEncode = yield* Effect.exit(encodeNumeric({ ...decoded, logicalKey: "11" }));
      wrongDecode.pipe(Exit.isFailure, assertTrue);
      wrongEncode.pipe(Exit.isFailure, assertTrue);
    })
  );

  it("gives each binding its own schema identifiers", () => {
    const other = bind("test/ClaimB").ClaimVersion;
    expect(SchemaAST.resolveIdentifier(ClaimVersion.ast)).not.toEqual(SchemaAST.resolveIdentifier(other.ast));
  });

  it.effect("rejects a review state whose disposition contradicts its tag", () =>
    Effect.gen(function* () {
      const disposition = (value: string) => ({
        disposition: value,
        reviewer: "reviewer-1",
        basis: Str.repeat(64)("a"),
        reviewedAt: 100,
        reason: "checked the basis",
      });
      const row = (review: unknown) => ({
        ...encoded("cv-review", { _tag: "Unknown" }, 50, null),
        review,
      });
      const accepted = yield* Effect.exit(decode(row({ _tag: "Accepted", disposition: disposition("accepted") })));
      const mismatched = yield* Effect.exit(decode(row({ _tag: "Accepted", disposition: disposition("rejected") })));
      accepted.pipe(Exit.isSuccess, assertTrue);
      mismatched.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("rejects an inverted Interval valid time", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decode(encoded("cv-inverted", { _tag: "Interval", validFrom: 200, validTo: 100 }, 50, null))
      );
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it("never selects unknown valid time", () => {
    expect(validAt({ _tag: "Unknown" }, at(0))).toBe(false);
  });

  it.effect("reads bitemporally: knowledge interval, valid interval and review state", () =>
    Effect.gen(function* () {
      const ledger = yield* Effect.forEach(
        [
          encoded("cv-old", { _tag: "Interval", validFrom: 0, validTo: null }, 10, 200),
          encoded("cv-new", { _tag: "Interval", validFrom: 0, validTo: null }, 200, null),
          encoded("cv-unknown", { _tag: "Unknown" }, 10, null),
        ],
        (row) => decode(row)
      );
      const ids = (asOf: number) =>
        A.map(versionsAt(ledger, { asOf: at(asOf), validAt: at(50), states: ["Proposed"] }), (v) => v.id);
      expect(ids(100)).toEqual(["cv-old"]);
      expect(ids(200)).toEqual(["cv-new"]);
      expect(versionsAt(ledger, { asOf: at(200), validAt: at(50), states: ["Accepted"] })).toEqual([]);
    })
  );
});
