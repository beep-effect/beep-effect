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

import { assert, describe, it } from "@effect/vitest";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import { Yaml, YamlFormat } from "../../../effected/yaml/index.ts";
import { loadAllTestCases } from "./support/suite.ts";

const allCases = loadAllTestCases();

/** Deep comparison that treats NaN as equal to itself (parity with the conformance harness). */
function deepEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) {
		return true;
	}
	if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((v, i) => deepEqual(v, b[i]));
	}
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (!P.isObject(a) || !P.isObject(b)) return false;
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (keysA.length !== keysB.length) return false;
	return keysA.every((k) => deepEqual(a[k], b[k]));
}

// ── Known-defect ledgers (exact-match ratchets) ─────────────────────────────
//
// Every id below is a REAL open defect on a corpus-exotic shape, pinned so the
// property still guards the rest of the corpus while the defect is tracked.
// The assertion compares the failure set EXACTLY: a new failure fails the
// suite (regression), and a fixed case fails it too until its id is removed
// here (the ratchet). Do not add an id without classifying it against the
// released line first.
//
// Classification, verified against origin/main (the released 0.7.0 engine) on
// 2026-08-12:
// - PRE-EXISTING on main (explicit-key, empty-key, tag-only and block-scalar
//   edge shapes; independent of this branch): M2N8/00, M2N8/01, T26H, T4YY,
//   WZ62 (idempotence); F6MC, R4YG, T26H, T4YY, WZ62, X38W, ZWK4 (meaning).
//
// NKF9, RZP5 and XW4D sat here as "comment-convergence gaps" until #348 found
// what they actually were: two comment-LOSS defects, not slow convergence.
// RZP5/XW4D — the explicit-key branch of the block-mapping stringifier never
// emitted the value node's own `commentBefore`, unlike every sibling branch.
// NKF9 — a mapping whose last pair had a null value swallowed the terminal
// own-line comment while looking for a value that was not there, losing it on
// a SINGLE pass. Both fixed; ids removed from this ledger.
const KNOWN_NON_IDEMPOTENT: ReadonlyArray<string> = ["M2N8/00", "M2N8/01", "T26H", "T4YY", "WZ62"];

const KNOWN_MEANING_CHANGES: ReadonlyArray<string> = ["F6MC", "R4YG", "T26H", "T4YY", "WZ62", "X38W", "ZWK4"];

describe("format properties over the yaml-test-suite corpus", () => {
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
			"idempotence failures diverged from the pinned ledger — a new id is a regression; a missing id is a fix to record",
		);
	});

	it("format preserves meaning on every parseable corpus input (modulo the pinned ledger)", () => {
		const failures: string[] = [];
		for (const tc of allCases) {
			const before = Yaml.parseAllResult(tc.yaml);
			if (Result.isFailure(before)) continue; // unparseable input — idempotence above still covers it
			const formatted = YamlFormat.formatToString(tc.yaml);
			const after = Yaml.parseAllResult(formatted);
			if (Result.isFailure(after) || !deepEqual(Result.getOrThrow(after), Result.getOrThrow(before))) {
				failures.push(tc.id);
			}
		}
		assert.deepStrictEqual(
			[...failures].sort(),
			[...KNOWN_MEANING_CHANGES].sort(),
			"meaning-preservation failures diverged from the pinned ledger — a new id is a regression; a missing id is a fix to record",
		);
	});
});
