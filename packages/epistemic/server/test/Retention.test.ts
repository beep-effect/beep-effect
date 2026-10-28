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
  renderRetentionReport,
} from "@beep/epistemic-use-cases/Retention";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
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
} from "./fixtures/Retention.ts";

describe("retention reporting", () => {
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
        expect(A.every(later.rows, (row) => row.tier === "unclassified" && O.isNone(row.decay))).toBe(true);
        expect(O.isNone(later.pressureRatio)).toBe(true);
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
        expect(report.admission.state).toBe("inert");
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
        expect(O.isNone(S.decodeOption(RetentionPolicy)({ ...policyInput, ...patch }))).toBe(true);
      }
    })
  );
});
