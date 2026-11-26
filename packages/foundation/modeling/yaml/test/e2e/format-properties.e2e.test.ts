/**
 * Format properties over the full yaml-test-suite corpus.
 *
 * The conformance harness (yaml-test-suite.e2e.test.ts) is parse-side: it
 * validates parse success/failure, JSON equivalence and canonical output. It
 * never runs the FORMAT path, so a format-round-trip defect — the keep-chomp
 * scalar that grew a newline on every pass, the original P0's write side, the
 * %TAG orphaning — is invisible to it by construction. These two properties
 * close that gap over the same corpus:
 *
 *   1. IDEMPOTENCE: formatToString(formatToString(x)) === formatToString(x).
 *      `format` is pure and total (refusal returns the input byte-identical),
 *      so this property is well-defined for EVERY input, valid or malformed.
 *   2. MEANING PRESERVATION: when x parses, formatToString(x) must parse to
 *      the same value stream. A parse failure on the formatted output of a
 *      parseable input is corruption and fails outright.
 *
 * Both run as aggregate assertions (one loop per property) so the corpus adds
 * two tests, not two-per-case, and a failure lists every offending case id.
 */

import { Yaml, YamlFormat } from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import { loadAllTestCases } from "./support/suite.ts";

const allCases = loadAllTestCases();

function deepEqualWithNaN(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (A.isArray(a) || A.isArray(b)) return A.isArray(a) && A.isArray(b) && arraysEqual(a, b);
  return P.isObject(a) && P.isObject(b) && recordsEqual(a, b);
}

function arraysEqual(a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean {
  return a.length === b.length && A.every(a, (v, i) => deepEqualWithNaN(v, b[i]));
}

function recordsEqual(a: { readonly [x: PropertyKey]: unknown }, b: { readonly [x: PropertyKey]: unknown }): boolean {
  const keysA = R.keys(a);
  return keysA.length === R.keys(b).length && A.every(keysA, (k) => deepEqualWithNaN(a[k], b[k]));
}

const KNOWN_NON_IDEMPOTENT: ReadonlyArray<string> = ["T26H", "T4YY"];

const KNOWN_MEANING_CHANGES: ReadonlyArray<string> = ["T26H", "T4YY", "ZWK4"];

describe("format properties over the yaml-test-suite corpus", () => {
  for (const id of ["WZ62", "X38W"]) {
    it(`${id} formats to a fixed point while preserving tagged and anchored keys`, () => {
      const tc = O.getOrThrow(A.findFirst(allCases, (entry) => entry.id === id));
      const before = Result.getOrThrow(Yaml.parseAllResult(tc.yaml));
      const formatted = YamlFormat.formatToString(tc.yaml);
      const after = Result.getOrThrow(Yaml.parseAllResult(formatted));
      assert.deepStrictEqual(after, before);
      assert.strictEqual(YamlFormat.formatToString(formatted), formatted);
    });
  }

  it("format is idempotent on every corpus input (modulo the pinned ledger)", () => {
    const failures: string[] = [];
    for (const tc of allCases) {
      const once = YamlFormat.formatToString(tc.yaml);
      const twice = YamlFormat.formatToString(once);
      if (twice !== once) failures.push(tc.id);
    }
    assert.deepStrictEqual(
      [...failures].sort(),
      [...KNOWN_NON_IDEMPOTENT].sort(),
      "idempotence failures diverged from the pinned ledger — a new id is a regression; a missing id is a fix to record"
    );
  });

  it("format preserves meaning on every parseable corpus input (modulo the pinned ledger)", () => {
    const failures: string[] = [];
    for (const tc of allCases) {
      const before = Yaml.parseAllResult(tc.yaml);
      if (Result.isFailure(before)) continue;
      const formatted = YamlFormat.formatToString(tc.yaml);
      const after = Yaml.parseAllResult(formatted);
      if (Result.isFailure(after) || !deepEqualWithNaN(Result.getOrThrow(after), Result.getOrThrow(before))) {
        failures.push(tc.id);
      }
    }
    assert.deepStrictEqual(
      [...failures].sort(),
      [...KNOWN_MEANING_CHANGES].sort(),
      "meaning-preservation failures diverged from the pinned ledger — a new id is a regression; a missing id is a fix to record"
    );
  });
});
