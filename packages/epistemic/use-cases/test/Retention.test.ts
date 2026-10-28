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
      const report = yield* generateRetentionReport(
        yield* S.decodeEffect(RetentionQuery)(queryInput),
        O.some(policy)
      ).pipe(provideFixture(yield* makeSnapshot(), O.none()));
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
        const early = yield* generateRetentionReport(
          yield* S.decodeEffect(RetentionQuery)({ ...queryInput, knownAt: 1500 }),
          O.some(policy)
        ).pipe(provideFixture(snapshot, O.none()));
        const later = yield* generateRetentionReport(
          yield* S.decodeEffect(RetentionQuery)(queryInput),
          O.some(policy)
        ).pipe(provideFixture(snapshot, O.none()));
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
        const beforeValid = yield* generateRetentionReport(
          yield* S.decodeEffect(RetentionQuery)({ ...queryInput, validAt: 999 }),
          O.none()
        ).pipe(provideFixture(snapshot, O.none()));
        expect(beforeValid.rows).toEqual([]);
        const rejected = yield* generateRetentionReport(
          yield* S.decodeEffect(RetentionQuery)({ ...queryInput, dispositions: ["rejected"] }),
          O.none()
        ).pipe(provideFixture(snapshot, O.none()));
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
      const first = yield* generateRetentionReport(yield* S.decodeEffect(RetentionQuery)(queryInput), O.none()).pipe(
        provideFixture(snapshot, O.none())
      );
      const second = yield* generateRetentionReport(
        yield* S.decodeEffect(RetentionQuery)({ ...queryInput, logicalKeys: [keyMissing, keyA, keyB] }),
        O.none()
      ).pipe(provideFixture(permuted, O.none()));
      expect(yield* encodeRetentionReport(first)).toBe(yield* encodeRetentionReport(second));
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
      const report = yield* generateRetentionReport(
        yield* S.decodeEffect(RetentionQuery)(queryInput),
        O.some(policy)
      ).pipe(provideFixture(snapshot, O.some(receipt)));
      expect(report.admission.state).toBe("calibrated");
      expect(renderRetentionReport(report)).toContain(`Budget ratio: ${report.payloadBytes / 10}`);
      expect(A.map(report.rows, (row) => row.tier)).toEqual(["warm", "evictable"]);
      expect(O.getOrUndefined(report.rows[0]?.decay ?? O.none())).toBe(0.5);
      expect(O.getOrUndefined(report.pressureRatio)).toBe(report.payloadBytes / 10);
      const noPolicy = yield* generateRetentionReport(yield* S.decodeEffect(RetentionQuery)(queryInput), O.none()).pipe(
        provideFixture(snapshot, O.some(receipt))
      );
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
      const boundary = yield* generateRetentionReport(
        yield* S.decodeEffect(RetentionQuery)({ ...queryInput, knownAt: 2000 }),
        O.none()
      ).pipe(provideFixture(snapshot, O.none()));
      expect(boundary.rows[0]?.version).toBe(2);
      expect(boundary.rows[0]?.sourceDisposition).toBe("rejected");
      const empty = yield* generateRetentionReport(
        yield* S.decodeEffect(RetentionQuery)({ ...queryInput, logicalKeys: [] }),
        O.none()
      ).pipe(provideFixture(snapshot, O.none()));
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
        const report = yield* generateRetentionReport(
          yield* S.decodeEffect(RetentionQuery)(queryInput),
          O.some(yield* S.decodeEffect(RetentionPolicy)(policyInput))
        ).pipe(provideFixture(yield* makeSnapshot(), O.some(altered)));
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
      const unresolved = yield* generateRetentionReport(
        yield* S.decodeEffect(RetentionQuery)(queryInput),
        O.none()
      ).pipe(provideFixture(RetentionSnapshot.make({ ...snapshot, dispositions: [] }), O.none()));
      expect(unresolved.rows[0]?.sourceDisposition).toBe("unresolved");
      const bounded = RetentionSnapshot.make({
        ...snapshot,
        edges: A.map(snapshot.edges, (edge) =>
          EdgeVersion.make({ ...edge, validTo: O.some(DateTime.makeUnsafe(1500)) })
        ),
      });
      const expired = yield* generateRetentionReport(yield* S.decodeEffect(RetentionQuery)(queryInput), O.none()).pipe(
        provideFixture(bounded, O.none())
      );
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
      const report = yield* generateRetentionReport(yield* S.decodeEffect(RetentionQuery)(queryInput), O.none()).pipe(
        provideFixture(overlapping, O.none())
      );
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
      const rejected = yield* generateRetentionReport(
        yield* S.decodeEffect(RetentionQuery)(queryInput),
        O.some(policy)
      ).pipe(provideFixture(yield* makeSnapshot(), O.none()), Effect.result);
      assertFailure(
        rejected,
        RetentionUnavailable.make({ operation: "policy", message: "Retention boundary validation failed" })
      );
      const report = yield* generateRetentionReport(yield* S.decodeEffect(RetentionQuery)(queryInput), O.none()).pipe(
        provideFixture(yield* makeSnapshot(), O.none())
      );
      expect(Reflect.set(report, "visibleCount", -1)).toBe(true);
      assertFailure(
        yield* encodeRetentionReport(report).pipe(Effect.result),
        RetentionUnavailable.make({ operation: "encode", message: "Retention boundary validation failed" })
      );
    })
  );
  it.layer(RetentionCalibrationRegistry.inert)("shipped inert registry", (it) => {
    it.effect("uses the shipped inert registry even for a schema-valid candidate", () =>
      Effect.gen(function* () {
        const snapshot = yield* makeSnapshot();
        const report = yield* generateRetentionReport(
          yield* S.decodeEffect(RetentionQuery)(queryInput),
          O.some(yield* S.decodeEffect(RetentionPolicy)(policyInput))
        ).pipe(
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
