import { expect, test } from "bun:test";
import { $RepoCliId } from "@beep/identity/packages";
import { PackageVerifyReport } from "@beep/repo-cli/test/Quality";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("goals/inline-schema-compile-hard-error/PackageVerificationEvidence");

// These private schemas decode the existing matrix's wire format. Supplemental
// reports reuse the package verifier's canonical schema and derived JSON codec.
const MatrixSummary = S.Struct({
  expected: S.Finite,
  completed: S.Finite,
  passed: S.Finite,
  failed: S.Finite,
}).annotate($I.annote("MatrixSummary", { description: "Recorded primary package matrix counts." }));
const MatrixResult = S.Struct({
  packageName: S.NonEmptyString,
  ok: S.Boolean,
  exitCode: S.Finite,
}).annotate($I.annote("MatrixResult", { description: "A primary package verifier's terminal result." }));
const Matrix = S.Struct({
  schemaVersion: S.Literal("inline-schema-package-verification/v2"),
  head: S.NonEmptyString,
  committedTree: S.NonEmptyString,
  supplementalReceipts: S.Array(S.NonEmptyString),
  summary: MatrixSummary,
  results: S.Array(MatrixResult),
}).annotate($I.annote("Matrix", { description: "Primary matrix and its explicitly linked supplemental receipts." }));
const Census = S.Struct({ byOwnerFamily: S.Record(S.String, S.Finite) }).annotate(
  $I.annote("Census", { description: "Opening package-owner inventory used by the original matrix." })
);
const decodeMatrix = S.decodeUnknownEffect(S.fromJsonString(Matrix));
const decodeCensus = S.decodeUnknownEffect(S.fromJsonString(Census));
const decodeSupplemental = S.decodeUnknownEffect(S.fromJsonString(S.toCodecJson(S.Array(PackageVerifyReport))));

test("primary and linked canonical receipts cover all 108 affected owners on the same head", async () => {
  const matrix = await Effect.runPromise(
    decodeMatrix(await Bun.file(new URL("../package-verification.json", import.meta.url)).text())
  );
  const census = await Effect.runPromise(
    decodeCensus(await Bun.file(new URL("../opening-census.json", import.meta.url)).text())
  );
  expect(matrix.supplementalReceipts).toEqual(["package-verification-supplemental.json"]);
  const supplemental = await Effect.runPromise(
    decodeSupplemental(await Bun.file(new URL("../package-verification-supplemental.json", import.meta.url)).text())
  );
  expect(matrix.summary).toEqual({ expected: 106, completed: 106, passed: 106, failed: 0 });
  expect(A.length(matrix.results)).toBe(matrix.summary.completed);
  for (const result of matrix.results) {
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
  }
  expect(
    A.sort(
      A.map(supplemental, (report) => report.packageName),
      Order.String
    )
  ).toEqual(["@beep/effect-drizzle", "@beep/freshbooks"]);
  for (const report of supplemental) {
    expect(report.headSha).toBe(matrix.head);
    expect(report.quick).toBe(false);
    expect(A.map(report.results, (result) => result.step)).toEqual(["audit", "docgen"]);
    for (const result of report.results) {
      expect(result.ok).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.durationMillis).toBeGreaterThan(0);
      expect(O.getOrNull(result.exitCode)).toBe(0);
    }
  }
  const owners = A.map([...matrix.results, ...supplemental], (result) => result.packageName);
  const expected = A.dedupe([
    ...R.keys(census.byOwnerFamily),
    "@beep/lint-rules",
    "@beep/effect-drizzle",
    "@beep/freshbooks",
  ]);
  expect(A.length(owners)).toBe(108);
  expect(A.length(A.dedupe(owners))).toBe(108);
  expect(A.sort(owners, Order.String)).toEqual(A.sort(expected, Order.String));
});
