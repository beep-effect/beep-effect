import { EdgeAsOfQuery, RecordEdgeFact, SupersedeEdgeFact } from "@beep/epistemic-use-cases/EdgeAuthority";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownRecordEdgeFactOption = S.decodeUnknownOption(RecordEdgeFact);
const decodeUnknownSupersedeEdgeFactOption = S.decodeUnknownOption(SupersedeEdgeFact);
const decodeUnknownRecordEdgeFact = S.decodeUnknownEffect(RecordEdgeFact);
const encodeRecordEdgeFact = S.encodeEffect(RecordEdgeFact);
const decodeUnknownSupersedeEdgeFact = S.decodeUnknownEffect(SupersedeEdgeFact);
const encodeSupersedeEdgeFact = S.encodeEffect(SupersedeEdgeFact);
const decodeEdgeAsOfQuery = S.decodeEffect(EdgeAsOfQuery);
const encodeEdgeAsOfQuery = S.encodeEffect(EdgeAsOfQuery);

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

const expectOrgScopeFailure = (exit: Exit.Exit<unknown, S.SchemaError>) => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    expect(S.isSchemaError(error) ? error.message : "").toMatch(/\["identity"\]\["orgScope"\]/);
  }
};

describe("@beep/epistemic-use-cases edge authority commands", () => {
  it.effect("round-trips RecordEdgeFact through its epoch-millis encoding", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownRecordEdgeFact(recordEncoded);

      expect(O.isNone(decoded.validTo)).toBe(true);
      expect(decoded.identity.relation).toBe("supports");
      expect(yield* encodeRecordEdgeFact(decoded)).toStrictEqual(recordEncoded);
    })
  );

  it.effect("round-trips SupersedeEdgeFact including the closed valid interval", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownSupersedeEdgeFact(supersedeEncoded);

      expect(decoded.expectedVersion).toBe(1);
      expect(O.isSome(decoded.validTo)).toBe(true);
      expect(yield* encodeSupersedeEdgeFact(decoded)).toStrictEqual(supersedeEncoded);
    })
  );

  it.effect("round-trips EdgeAsOfQuery on both axes", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeEdgeAsOfQuery(asOfEncoded);

      expect(yield* encodeEdgeAsOfQuery(decoded)).toStrictEqual(asOfEncoded);
    })
  );

  it("rejects a record command with no validFrom, so no edge can be asserted without a known valid time", () => {
    expect(O.isNone(decodeUnknownRecordEdgeFactOption(withoutValidFrom(recordEncoded)))).toBe(true);
  });

  it("rejects a supersede command with no validFrom", () => {
    expect(O.isNone(decodeUnknownSupersedeEdgeFactOption(withoutValidFrom(supersedeEncoded)))).toBe(true);
  });

  // EdgeAsOfQuery carries both axes and no cross-field check, so its arbitrary generates
  // freely; the write commands require orgScope/orgId agreement, which a generate-and-filter
  // arbitrary would essentially never satisfy.
  it.effect.prop(
    "round-trips schema-derived as-of queries without changing the encoded shape",
    { query: EdgeAsOfQuery },
    Effect.fnUntraced(function* ({ query }) {
      const encoded = yield* encodeEdgeAsOfQuery(query);
      const decoded = yield* decodeEdgeAsOfQuery(encoded);

      // Both axes survive the millis boundary for every generated instant, not just the fixture.
      expect(yield* encodeEdgeAsOfQuery(decoded)).toStrictEqual(encoded);
      expect(typeof encoded.knownAt).toBe("number");
      expect(typeof encoded.validAt).toBe("number");

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect("rejects a record command whose identity org scope names a different organization", () =>
    Effect.gen(function* () {
      const mismatched = { ...recordEncoded, identity: { ...identity, orgScope: "2" } };

      expect(O.isNone(decodeUnknownRecordEdgeFactOption(mismatched))).toBe(true);
      expectOrgScopeFailure(yield* Effect.exit(decodeUnknownRecordEdgeFact(mismatched)));
    })
  );

  it.effect("rejects a supersede command whose identity org scope names a different organization", () =>
    Effect.gen(function* () {
      const mismatched = { ...supersedeEncoded, identity: { ...identity, orgScope: "2" } };

      expect(O.isNone(decodeUnknownSupersedeEdgeFactOption(mismatched))).toBe(true);
      expectOrgScopeFailure(yield* Effect.exit(decodeUnknownSupersedeEdgeFact(mismatched)));
    })
  );

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
