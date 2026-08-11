import { EdgeAsOfQuery, RecordEdgeFact, SupersedeEdgeFact } from "@beep/epistemic-use-cases/EdgeAuthority";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

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
const EdgeAsOfQueryArbitrary = S.toArbitrary(EdgeAsOfQuery)(fc);

describe("@beep/epistemic-use-cases edge authority commands", () => {
  it("round-trips RecordEdgeFact through its epoch-millis encoding", () => {
    const decoded = S.decodeUnknownSync(RecordEdgeFact)(recordEncoded);

    expect(O.isNone(decoded.validTo)).toBe(true);
    expect(decoded.identity.relation).toBe("supports");
    expect(S.encodeSync(RecordEdgeFact)(decoded)).toStrictEqual(recordEncoded);
  });

  it("round-trips SupersedeEdgeFact including the closed valid interval", () => {
    const decoded = S.decodeUnknownSync(SupersedeEdgeFact)(supersedeEncoded);

    expect(decoded.expectedVersion).toBe(1);
    expect(O.isSome(decoded.validTo)).toBe(true);
    expect(S.encodeSync(SupersedeEdgeFact)(decoded)).toStrictEqual(supersedeEncoded);
  });

  it("round-trips EdgeAsOfQuery on both axes", () => {
    const decoded = S.decodeSync(EdgeAsOfQuery)(asOfEncoded);

    expect(S.encodeSync(EdgeAsOfQuery)(decoded)).toStrictEqual(asOfEncoded);
  });

  it("rejects a record command with no validFrom, so no edge can be asserted without a known valid time", () => {
    expect(O.isNone(S.decodeUnknownOption(RecordEdgeFact)(withoutValidFrom(recordEncoded)))).toBe(true);
  });

  it("rejects a supersede command with no validFrom", () => {
    expect(O.isNone(S.decodeUnknownOption(SupersedeEdgeFact)(withoutValidFrom(supersedeEncoded)))).toBe(true);
  });

  it("round-trips schema-derived as-of queries without changing the encoded shape", () =>
    fc.assert(
      fc.property(EdgeAsOfQueryArbitrary, (query) => {
        const encoded = S.encodeSync(EdgeAsOfQuery)(query);
        const decoded = S.decodeSync(EdgeAsOfQuery)(encoded);

        // Both axes survive the millis boundary for every generated instant, not just the fixture.
        expect(S.encodeSync(EdgeAsOfQuery)(decoded)).toStrictEqual(encoded);
        expect(typeof encoded.knownAt).toBe("number");
        expect(typeof encoded.validAt).toBe("number");
      }),
      fcRuns(50)
    ));

  it("rejects a record command whose identity org scope names a different organization", () => {
    const mismatched = { ...recordEncoded, identity: { ...identity, orgScope: "2" } };

    expect(O.isNone(S.decodeUnknownOption(RecordEdgeFact)(mismatched))).toBe(true);
    expect(() => S.decodeUnknownSync(RecordEdgeFact)(mismatched)).toThrow(/\["identity"\]\["orgScope"\]/);
  });

  it("rejects a supersede command whose identity org scope names a different organization", () => {
    const mismatched = { ...supersedeEncoded, identity: { ...identity, orgScope: "2" } };

    expect(O.isNone(S.decodeUnknownOption(SupersedeEdgeFact)(mismatched))).toBe(true);
    expect(() => S.decodeUnknownSync(SupersedeEdgeFact)(mismatched)).toThrow(/\["identity"\]\["orgScope"\]/);
  });

  it("rejects an endpoint kind outside the bounded vocabulary", () => {
    expect(
      O.isNone(
        S.decodeUnknownOption(RecordEdgeFact)({
          ...recordEncoded,
          identity: { ...identity, source: { kind: "rumour", rumourRef: "hearsay" } },
        })
      )
    ).toBe(true);
  });
});
