/**
 * Official yaml-test-suite compliance tests.
 *
 * Runs the full yaml-test-suite (https://github.com/yaml/yaml-test-suite)
 * against the engine to validate YAML 1.2 spec compliance across four
 * assertion families: parse success/failure, JSON equivalence, canonical
 * output byte-equality, and stringify roundtrip.
 */

import { assert, describe, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { applyMultiDocCanonical, applySingleDocCanonical } from "./support/canonical.ts";
import {
	buildAnchorMap,
	getNodeValue,
	parse,
	parseAllDocuments,
	parseDocument,
	stringify,
	stringifyDocument,
} from "./support/engine.ts";
import { SKIP, SKIP_ASSERTIONS } from "./support/skip-map.ts";
import { loadAllTestCases } from "./support/suite.ts";

const allCases = loadAllTestCases();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shouldSkipAssertion(id: string, assertion: string): boolean {
	return SKIP_ASSERTIONS[id]?.includes(assertion) ?? false;
}

/**
 * Deep comparison that handles NaN equality.
 */
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

	const keysA = Object.keys(a as Record<string, unknown>);
	const keysB = Object.keys(b as Record<string, unknown>);
	if (keysA.length !== keysB.length) return false;
	return keysA.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

describe("yaml-test-suite compliance", () => {
	for (const tc of allCases) {
		// Skip entirely if in SKIP map
		if ((SKIP[tc.id] !== undefined && SKIP[tc.id] !== "")) {
			it.skip(`[${tc.id}] ${tc.name} (SKIP: ${SKIP[tc.id]})`, () => {});
			continue;
		}

		describe(`[${tc.id}] ${tc.name}`, () => {
			if (tc.isError) {
				// ----- Error tests: YAML should be rejected -----
				it.effect("should reject invalid YAML", () =>
					Effect.gen(function* () {
						const result = yield* Effect.result(parse(tc.yaml, { uniqueKeys: false }));
						assert.isTrue(Result.isFailure(result), `Expected parse error for ${tc.id}`);
					}),
				);
			} else {
				// ----- Valid tests -----

				// 4a. Parse success
				it.effect("should parse successfully", () =>
					Effect.gen(function* () {
						const result = yield* Effect.result(parse(tc.yaml, { uniqueKeys: false }));
						assert.isTrue(Result.isSuccess(result), `Expected parse success for ${tc.id}`);
					}),
				);

				// 4b. JSON match
				if (tc.json !== undefined && !shouldSkipAssertion(tc.id, "json")) {
					it.effect("should match expected JSON output", () =>
						Effect.gen(function* () {
							if (tc.isMultiDocument) {
								const values = yield* parseAllDocuments(tc.yaml, { uniqueKeys: false }).pipe(
									Effect.map((docs) =>
										docs.map((doc) => {
											const anchors = buildAnchorMap(doc.contents);
											return getNodeValue(doc.contents, anchors);
										}),
									),
								);
								assert.isTrue(deepEqual(values, tc.json), `JSON mismatch for ${tc.id}`);
							} else {
								const value = yield* parse(tc.yaml, { uniqueKeys: false });
								assert.isTrue(deepEqual(value, tc.json), `JSON mismatch for ${tc.id}`);
							}
						}),
					);
				}

				// 4c. Canonical output match (out.yaml)
				if (tc.outYaml !== undefined && !shouldSkipAssertion(tc.id, "output")) {
					const expected = tc.outYaml;
					it.effect("should match canonical output", () =>
						Effect.gen(function* () {
							if (tc.isMultiDocument) {
								const docs = yield* parseAllDocuments(tc.yaml, { uniqueKeys: false });
								const parts = docs.map((doc) => stringifyDocument(doc, { forceDefaultStyles: true }));
								const joined = parts.join("");
								const stringified = applyMultiDocCanonical(joined, docs);
								assert.strictEqual(stringified, expected);
							} else {
								const doc = yield* parseDocument(tc.yaml, { uniqueKeys: false });
								const raw = stringifyDocument(doc, { forceDefaultStyles: true });
								const stringified = applySingleDocCanonical(raw, doc, tc.yaml);
								assert.strictEqual(stringified, expected);
							}
						}),
					);
				}

				// 4d. Stringify roundtrip
				if (!shouldSkipAssertion(tc.id, "roundtrip")) {
					it.effect("should survive stringify roundtrip", () =>
						Effect.gen(function* () {
							if (tc.isMultiDocument) {
								const values = yield* parseAllDocuments(tc.yaml, { uniqueKeys: false }).pipe(
									Effect.map((docs) =>
										docs.map((doc) => {
											const anchors = buildAnchorMap(doc.contents);
											return getNodeValue(doc.contents, anchors);
										}),
									),
								);
								for (const value of values) {
									const stringified = stringify(value);
									const reparsed = yield* parse(stringified, { uniqueKeys: false });
									assert.isTrue(deepEqual(reparsed, value), `Roundtrip mismatch for ${tc.id}`);
								}
							} else {
								const value = yield* parse(tc.yaml, { uniqueKeys: false });
								const stringified = stringify(value);
								const reparsed = yield* parse(stringified, { uniqueKeys: false });
								assert.isTrue(deepEqual(reparsed, value), `Roundtrip mismatch for ${tc.id}`);
							}
						}),
					);
				}
			}
		});
	}
});
