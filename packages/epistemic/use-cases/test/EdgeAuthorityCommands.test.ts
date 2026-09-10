import { EdgeAsOfQuery, RecordEdgeFact, SupersedeEdgeFact } from "@beep/epistemic-use-cases/EdgeAuthority";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeEdgeAsOfQuerySync = S.decodeSync(EdgeAsOfQuery);
const decodeUnknownRecordEdgeFactOption = S.decodeUnknownOption(RecordEdgeFact);
const decodeUnknownSupersedeEdgeFactOption = S.decodeUnknownOption(SupersedeEdgeFact);
const decodeUnknownRecordEdgeFactSync = S.decodeUnknownSync(RecordEdgeFact);
const decodeUnknownSupersedeEdgeFactSync = S.decodeUnknownSync(SupersedeEdgeFact);
const encodeEdgeAsOfQuerySync = S.encodeSync(EdgeAsOfQuery);
const encodeRecordEdgeFactSync = S.encodeSync(RecordEdgeFact);
const encodeSupersedeEdgeFactSync = S.encodeSync(SupersedeEdgeFact);

const identity = {
  evidenceScope: null,
  matterScope: null,
  orgScope: "1",
  qualifiers: { statute: "35 USC 103" },
  relation: "supports",
  source: { kind: "claim", claimId: 1 },
  target: { kind: "evidence", evidenceId: 2 },
};

const audit = {
  orgId: 1,
  recordedBy: { kind: "System", component: "Runtime" },
  schemaVersion: "0.0.0",
  source: "Agent",
};

const recordEncoded = {
  ...audit,
  fact: { note: "cited in the office action" },
  identity,
  recordedAt: 1_000,
  validFrom: 1_000,
  validTo: null,
};

const supersedeEncoded = {
  ...audit,
  expectedVersion: 1,
  fact: { note: "withdrawn by the examiner" },
  identity,
  recordedAt: 2_500,
  validFrom: 1_000,
  validTo: 2_000,
};

const asOfEncoded = {
  knownAt: 2_500,
  logicalKey: "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe",
  validAt: 1_500,
};

const withoutValidFrom = ({ validFrom: _validFrom, ...rest }: { readonly validFrom: number }) => rest;

// EdgeAsOfQuery carries both axes and no cross-field check, so its arbitrary generates
// freely; the write commands require orgScope/orgId agreement, which a generate-and-filter
// arbitrary would essentially never satisfy.
const EdgeAsOfQueryArbitrary = Arbitrary.schema(EdgeAsOfQuery);

describe("@beep/epistemic-use-cases edge authority commands", () => {
  it("round-trips RecordEdgeFact through its epoch-millis encoding", () => {
    const decoded = decodeUnknownRecordEdgeFactSync(recordEncoded);

    expect(O.isNone(decoded.validTo)).toBe(true);
    expect(decoded.identity.relation).toBe("supports");
    expect(encodeRecordEdgeFactSync(decoded)).toStrictEqual(recordEncoded);
  });

  it("round-trips SupersedeEdgeFact including the closed valid interval", () => {
    const decoded = decodeUnknownSupersedeEdgeFactSync(supersedeEncoded);

    expect(decoded.expectedVersion).toBe(1);
    expect(O.isSome(decoded.validTo)).toBe(true);
    expect(encodeSupersedeEdgeFactSync(decoded)).toStrictEqual(supersedeEncoded);
  });

  it("round-trips EdgeAsOfQuery on both axes", () => {
    const decoded = decodeEdgeAsOfQuerySync(asOfEncoded);

    expect(encodeEdgeAsOfQuerySync(decoded)).toStrictEqual(asOfEncoded);
  });

  it("rejects a record command with no validFrom, so no edge can be asserted without a known valid time", () => {
    expect(O.isNone(decodeUnknownRecordEdgeFactOption(withoutValidFrom(recordEncoded)))).toBe(true);
  });

  it("rejects a supersede command with no validFrom", () => {
    expect(O.isNone(decodeUnknownSupersedeEdgeFactOption(withoutValidFrom(supersedeEncoded)))).toBe(true);
  });

  it("round-trips schema-derived as-of queries without changing the encoded shape", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([EdgeAsOfQueryArbitrary]),
          ([query]) => {
            const encoded = encodeEdgeAsOfQuerySync(query);
            const decoded = decodeEdgeAsOfQuerySync(encoded);

            // Both axes survive the millis boundary for every generated instant, not just the fixture.
            expect(encodeEdgeAsOfQuerySync(decoded)).toStrictEqual(encoded);
            expect(typeof encoded.knownAt).toBe("number");
            expect(typeof encoded.validAt).toBe("number");

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed"));

  it("rejects a record command whose identity org scope names a different organization", () => {
    const mismatched = { ...recordEncoded, identity: { ...identity, orgScope: "2" } };

    expect(O.isNone(decodeUnknownRecordEdgeFactOption(mismatched))).toBe(true);
    expect(() => decodeUnknownRecordEdgeFactSync(mismatched)).toThrow(/\["identity"\]\["orgScope"\]/);
  });

  it("rejects a supersede command whose identity org scope names a different organization", () => {
    const mismatched = { ...supersedeEncoded, identity: { ...identity, orgScope: "2" } };

    expect(O.isNone(decodeUnknownSupersedeEdgeFactOption(mismatched))).toBe(true);
    expect(() => decodeUnknownSupersedeEdgeFactSync(mismatched)).toThrow(/\["identity"\]\["orgScope"\]/);
  });

  it("rejects an endpoint kind outside the bounded vocabulary", () => {
    expect(
      O.isNone(
        decodeUnknownRecordEdgeFactOption({
          ...recordEncoded,
          identity: { ...identity, source: { kind: "rumour", rumourRef: "hearsay" } },
        })
      )
    ).toBe(true);
  });
});
