import { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import {
  RetentionCalibration,
  RetentionPolicy,
  RetentionQuery,
  RetentionSnapshot,
  retentionPayloadBytes,
} from "@beep/epistemic-domain/values/Retention";
import {
  encodeRetentionReport,
  generateRetentionReport,
  RetentionAuthorityReader,
  RetentionCalibrationRegistry,
  RetentionUnavailable,
  renderRetentionReport,
} from "@beep/epistemic-use-cases/Retention";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertNone, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  keyA,
  keyB,
  keyMissing,
  makeCalibration,
  makeSnapshot,
  policyInput,
  provideFixture,
  queryInput,
} from "./helpers/Retention.ts";

// Generate ordered windows constructively; filtering equal size-zero integers exhausts the generator.
const PolicyPositive = RetentionPolicy.fields.hotThroughMillis.check(S.isLessThanOrEqualTo(1_000_000));
const PolicyArbitrary = Arbitrary.schema(
  S.Struct({
    hotThroughMillis: PolicyPositive,
    warmThroughMillis: PolicyPositive,
    coldThroughMillis: PolicyPositive,
    decayScaleMillis: PolicyPositive,
    payloadBudgetBytes: PolicyPositive,
  })
).pipe(
  Arbitrary.map((parts) =>
    RetentionPolicy.make({
      ...parts,
      warmThroughMillis: parts.hotThroughMillis + parts.warmThroughMillis,
      coldThroughMillis: parts.hotThroughMillis + parts.warmThroughMillis + parts.coldThroughMillis,
    })
  )
);

describe("retention reporting", () => {
  it.effect.prop("keeps every schema-generated candidate inert without approval", [PolicyArbitrary], ([policy]) =>
    Effect.gen(function* () {
      const value1 = yield* S.decodeEffect(RetentionQuery)(queryInput);
      const argument = generateRetentionReport(value1, O.some(policy));
      const madeSnapshot = yield* makeSnapshot();
      const report = yield* argument.pipe(provideFixture(madeSnapshot, O.none()));
      expect(report.admission.state).toBe("inert");
      assertNone(report.pressureRatio);
      for (const row of report.rows) {
        expect(row.tier).toBe("unclassified");
        assertNone(row.decay);
      }
    })
  );
  it.effect(
    "preserves both as-of axes, dispositions, tenant scope and explicit absence without activating policy",
    () =>
      Effect.gen(function* () {
        const snapshot = yield* makeSnapshot();
        const policy = yield* S.decodeEffect(RetentionPolicy)(policyInput);
        const value2 = yield* S.decodeEffect(RetentionQuery)({ ...queryInput, knownAt: 1500 });
        const early = yield* generateRetentionReport(value2, O.some(policy)).pipe(provideFixture(snapshot, O.none()));
        const value3 = yield* S.decodeEffect(RetentionQuery)(queryInput);
        const later = yield* generateRetentionReport(value3, O.some(policy)).pipe(provideFixture(snapshot, O.none()));
        expect(A.map(early.rows, (row) => [row.logicalKey, row.version, row.sourceDisposition])).toEqual([
          [keyA, 1, "active"],
          [keyB, 1, "not-applicable"],
        ]);
        expect(A.map(later.rows, (row) => [row.logicalKey, row.version, row.sourceDisposition])).toEqual([
          [keyA, 2, "rejected"],
          [keyB, 1, "not-applicable"],
        ]);
        expect(later.missingKeys).toEqual([keyMissing]);
        expect(later.admission.state).toBe("inert");
        assertTrue(A.every(later.rows, (row) => row.tier === "unclassified" && O.isNone(row.decay)));
        assertNone(later.pressureRatio);
        const value4 = yield* S.decodeEffect(RetentionQuery)({ ...queryInput, validAt: 999 });
        const beforeValid = yield* generateRetentionReport(value4, O.none()).pipe(provideFixture(snapshot, O.none()));
        expect(beforeValid.rows).toEqual([]);
        const value5 = yield* S.decodeEffect(RetentionQuery)({ ...queryInput, dispositions: ["rejected"] });
        const rejected = yield* generateRetentionReport(value5, O.none()).pipe(provideFixture(snapshot, O.none()));
        expect(A.map(rejected.rows, (row) => row.logicalKey)).toEqual([keyA]);
        expect(rejected.missingKeys).toEqual([keyMissing]);
      })
  );
  it.effect("produces identical canonical bytes and text for permuted rows, filters and keys", () =>
    Effect.gen(function* () {
      const snapshot = yield* makeSnapshot();
      const permuted = RetentionSnapshot.make({
        edges: A.reverse(snapshot.edges),
        dispositions: A.reverse(snapshot.dispositions),
      });
      const value6 = yield* S.decodeEffect(RetentionQuery)(queryInput);
      const first = yield* generateRetentionReport(value6, O.none()).pipe(provideFixture(snapshot, O.none()));
      const value7 = yield* S.decodeEffect(RetentionQuery)({ ...queryInput, logicalKeys: [keyMissing, keyA, keyB] });
      const second = yield* generateRetentionReport(value7, O.none()).pipe(provideFixture(permuted, O.none()));
      const encodedRetentionReport = yield* encodeRetentionReport(first);
      const expectation = expect(encodedRetentionReport);
      const encodedRetentionReport1 = yield* encodeRetentionReport(second);
      expectation.toBe(encodedRetentionReport1);
      expect(renderRetentionReport(first)).toBe(renderRetentionReport(second));
      expect(first.payloadBytes).toBe(retentionPayloadBytes({ nested: { a: true, z: 1 }, text: "é" }) * 2);
      expect(first.visibleCount).toBe(2);
    })
  );
  it.effect("applies policy only when a trusted production receipt binds all required coordinates", () =>
    Effect.gen(function* () {
      const snapshot = yield* makeSnapshot();
      const receipt = yield* makeCalibration();
      const policy = yield* S.decodeEffect(RetentionPolicy)(policyInput);
      const value8 = yield* S.decodeEffect(RetentionQuery)(queryInput);
      const report = yield* generateRetentionReport(value8, O.some(policy)).pipe(
        provideFixture(snapshot, O.some(receipt))
      );
      expect(report.admission.state).toBe("calibrated");
      expect(renderRetentionReport(report)).toContain(`Budget ratio: ${report.payloadBytes / 10}`);
      expect(A.map(report.rows, (row) => row.tier)).toEqual(["warm", "evictable"]);
      expect(O.getOrUndefined(report.rows[0]?.decay ?? O.none())).toBe(0.5);
      expect(O.getOrUndefined(report.pressureRatio)).toBe(report.payloadBytes / 10);
      const value9 = yield* S.decodeEffect(RetentionQuery)(queryInput);
      const noPolicy = yield* generateRetentionReport(value9, O.none()).pipe(provideFixture(snapshot, O.some(receipt)));
      expect(noPolicy.admission.state).toBe("inert");
    })
  );
  it.effect("uses inclusive tier cutoffs, exclusive temporal ends and explicit missing dispositions", () =>
    Effect.gen(function* () {
      const snapshot = yield* makeSnapshot();
      const receipt = RetentionCalibration.make({
        ...(yield* makeCalibration()),
        approvedAt: DateTime.makeUnsafe(0),
        expiresAt: DateTime.makeUnsafe(10000),
      });
      const policy = yield* S.decodeEffect(RetentionPolicy)(policyInput);
      for (const [knownAt, tier] of [
        [1100, "hot"],
        [1101, "warm"],
        [1500, "warm"],
        [1501, "cold"],
        [2000, "cold"],
        [2001, "evictable"],
      ]) {
        const query = yield* S.decodeUnknownEffect(RetentionQuery)({ ...queryInput, logicalKeys: [keyB], knownAt });
        const report = yield* generateRetentionReport(query, O.some(policy)).pipe(
          provideFixture(snapshot, O.some(receipt))
        );
        expect(report.rows[0]?.tier).toBe(tier);
      }
      const value10 = yield* S.decodeEffect(RetentionQuery)({ ...queryInput, knownAt: 2000 });
      const boundary = yield* generateRetentionReport(value10, O.none()).pipe(provideFixture(snapshot, O.none()));
      expect(boundary.rows[0]?.version).toBe(2);
      expect(boundary.rows[0]?.sourceDisposition).toBe("rejected");
      const value11 = yield* S.decodeEffect(RetentionQuery)({ ...queryInput, logicalKeys: [] });
      const empty = yield* generateRetentionReport(value11, O.none()).pipe(provideFixture(snapshot, O.none()));
      expect(empty.visibleCount).toBe(0);
      expect(empty.payloadBytes).toBe(0);
      expect(empty.missingKeys).toEqual([]);
    })
  );
  for (const [name, patch] of [
    ["synthetic", { purpose: "synthetic" }],
    ["wrong organization", { orgId: 2 }],
    ["wrong policy", { policyDigest: keyB }],
    ["future approval", { approvedAt: 2501 }],
    ["expired", { expiresAt: 2500 }],
  ] satisfies ReadonlyArray<readonly [string, Record<string, unknown>]>) {
    it.effect(`keeps ${name} calibration inert`, () =>
      Effect.gen(function* () {
        const receipt = yield* makeCalibration();
        const encoded = yield* S.encodeEffect(RetentionCalibration)(receipt);
        const altered = yield* S.decodeUnknownEffect(RetentionCalibration)({ ...encoded, ...patch });
        const value12 = yield* S.decodeEffect(RetentionQuery)(queryInput);
        const value20 = yield* S.decodeEffect(RetentionPolicy)(policyInput);
        const argument1 = generateRetentionReport(value12, O.some(value20));
        const madeSnapshot2 = yield* makeSnapshot();
        const report = yield* argument1.pipe(provideFixture(madeSnapshot2, O.some(altered)));
        expect(report.admission.state).toBe("inert");
        assertNone(report.pressureRatio);
      })
    );
  }
  it.effect("rejects unordered, non-finite, zero and negative policy data", () =>
    Effect.gen(function* () {
      for (const patch of [
        { warmThroughMillis: 100 },
        { decayScaleMillis: 0 },
        { hotThroughMillis: -1 },
        { payloadBudgetBytes: Number.POSITIVE_INFINITY },
      ]) {
        assertNone(S.decodeOption(RetentionPolicy)({ ...policyInput, ...patch }));
      }
    })
  );
  it.effect("keeps unresolved claims distinct and excludes the valid-time upper bound", () =>
    Effect.gen(function* () {
      const snapshot = yield* makeSnapshot();
      const value13 = yield* S.decodeEffect(RetentionQuery)(queryInput);
      const unresolved = yield* generateRetentionReport(value13, O.none()).pipe(
        provideFixture(RetentionSnapshot.make({ ...snapshot, dispositions: [] }), O.none())
      );
      expect(unresolved.rows[0]?.sourceDisposition).toBe("unresolved");
      const bounded = RetentionSnapshot.make({
        ...snapshot,
        edges: A.map(snapshot.edges, (edge) =>
          EdgeVersion.make({ ...edge, validTo: O.some(DateTime.makeUnsafe(1500)) })
        ),
      });
      const value14 = yield* S.decodeEffect(RetentionQuery)(queryInput);
      const expired = yield* generateRetentionReport(value14, O.none()).pipe(provideFixture(bounded, O.none()));
      expect(expired.rows).toEqual([]);
    })
  );
  it.effect("orders tied dispositions and overlapping fixture versions independently of response order", () =>
    Effect.gen(function* () {
      const snapshot = yield* makeSnapshot();
      const overlapping = RetentionSnapshot.make({
        ...snapshot,
        edges: A.reverse(A.map(snapshot.edges, (edge) => EdgeVersion.make({ ...edge, expiredAt: O.none() }))),
        dispositions: A.reverse(
          A.map(snapshot.dispositions, (disposition) =>
            ClaimDisposition.make({ ...disposition, resolvedAt: DateTime.makeUnsafe(2000) })
          )
        ),
      });
      const value15 = yield* S.decodeEffect(RetentionQuery)(queryInput);
      const report = yield* generateRetentionReport(value15, O.none()).pipe(provideFixture(overlapping, O.none()));
      expect(report.rows[0]?.sourceDisposition).toBe("superseded");
      expect(A.map(report.rows, (row) => [row.logicalKey, row.version])).toEqual([
        [keyA, 1],
        [keyA, 2],
        [keyB, 1],
      ]);
    })
  );
  it.effect("sanitizes corrupted policy and report values at serialization boundaries", () =>
    Effect.gen(function* () {
      const policy = yield* S.decodeEffect(RetentionPolicy)(policyInput);
      // Simulate a JavaScript caller corrupting a value after schema admission.
      expect(Reflect.set(policy, "payloadBudgetBytes", 0)).toBe(true);
      const value16 = yield* S.decodeEffect(RetentionQuery)(queryInput);
      const argument2 = generateRetentionReport(value16, O.some(policy));
      const madeSnapshot3 = yield* makeSnapshot();
      const rejected = yield* argument2.pipe(provideFixture(madeSnapshot3, O.none()), Effect.result);
      assertFailure(
        rejected,
        RetentionUnavailable.make({ operation: "policy", message: "Retention boundary validation failed" })
      );
      const value17 = yield* S.decodeEffect(RetentionQuery)(queryInput);
      const argument3 = generateRetentionReport(value17, O.none());
      const madeSnapshot4 = yield* makeSnapshot();
      const report = yield* argument3.pipe(provideFixture(madeSnapshot4, O.none()));
      expect(Reflect.set(report, "visibleCount", -1)).toBe(true);
      const pipe18 = yield* encodeRetentionReport(report).pipe(Effect.result);
      assertFailure(
        pipe18,
        RetentionUnavailable.make({ operation: "encode", message: "Retention boundary validation failed" })
      );
    })
  );
  it.layer(RetentionCalibrationRegistry.inert)("shipped inert registry", (it) => {
    it.effect("uses the shipped inert registry even for a schema-valid candidate", () =>
      Effect.gen(function* () {
        const snapshot = yield* makeSnapshot();
        const value19 = yield* S.decodeEffect(RetentionQuery)(queryInput);
        const value21 = yield* S.decodeEffect(RetentionPolicy)(policyInput);
        const report = yield* generateRetentionReport(value19, O.some(value21)).pipe(
          Effect.provideService(RetentionAuthorityReader, {
            read: Effect.fn("RetentionTest.inertRead")(() => Effect.succeed(snapshot)),
          })
        );
        expect(report.admission.state).toBe("inert");
        assertNone(report.pressureRatio);
      })
    );
  });
});
