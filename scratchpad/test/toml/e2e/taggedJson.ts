import { dual } from "effect/Function";
// The tagged-JSON comparator for the toml-test corpus. Expected files encode
// leaves as `{"type": T, "value": string}` with T one of the eight tags;
// containers are plain JSON objects/arrays. `assertMatchesTagged` recurses
// the two shapes together and throws assert failures carrying the key path.
//
// Datetimes compare STRUCTURALLY: the expected string is re-parsed through
// the scanner's own `classifyValueToken`, so a `T`-vs-space separator or a
// `Z`-vs-`+00:00` spelling difference cannot cause a false mismatch — same
// fields means same value.

import { assert } from "@effect/vitest";
import * as Equal from "effect/Equal";
import { classifyValueToken } from "../../../effected/toml/internal/scanner.ts";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "../../../effected/toml/TomlDateTime.ts";

/** The eight toml-test leaf tags. */
const LEAF_TAGS = new Set([
	"string",
	"integer",
	"float",
	"bool",
	"datetime",
	"datetime-local",
	"date-local",
	"time-local",
]);

interface TaggedLeaf {
	readonly type: string;
	readonly value: string;
}

/**
 * Whether `candidate` is a tagged leaf: exactly the keys `type` and `value`,
 * both strings, with `type` in the tag set. A genuine TOML table named
 * `{type, value}` cannot collide — its values would themselves be tagged
 * objects, not raw strings.
 */
function isTaggedLeaf(candidate: unknown): candidate is TaggedLeaf {
	if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
		return false;
	}
	const record = candidate as Record<string, unknown>;
	return (
		Object.keys(record).length === 2 &&
		typeof record.type === "string" &&
		typeof record.value === "string" &&
		LEAF_TAGS.has(record.type)
	);
}

/** A datetime class widened to what an `instanceof` check needs. */
type DateTimeClass = (new (...args: never[]) => object) & { readonly name: string };

const DATETIME_CLASSES: Record<"datetime" | "datetime-local" | "date-local" | "time-local", DateTimeClass> = {
	datetime: TomlOffsetDateTime,
	"datetime-local": TomlLocalDateTime,
	"date-local": TomlLocalDate,
	"time-local": TomlLocalTime,
};

const INF_SPELLINGS: Record<string, number> = {
	inf: Number.POSITIVE_INFINITY,
	"+inf": Number.POSITIVE_INFINITY,
	"-inf": Number.NEGATIVE_INFINITY,
};

function assertLeaf(actual: unknown, expected: TaggedLeaf, path: string): void {
	switch (expected.type) {
		case "string": {
			assert.strictEqual(actual, expected.value, `${path}: string mismatch`);
			return;
		}
		case "integer": {
			assert.isTrue(
				typeof actual === "number" || typeof actual === "bigint",
				`${path}: expected an integer (number | bigint), got ${typeof actual}`,
			);
			if (typeof actual === "number") {
				assert.isTrue(Number.isInteger(actual), `${path}: expected an integer, got non-integral number ${actual}`);
			}
			assert.isTrue(
				BigInt(expected.value) === BigInt(actual as number | bigint),
				`${path}: expected integer ${expected.value}, got ${String(actual)}`,
			);
			return;
		}
		case "float": {
			assert.isTrue(typeof actual === "number", `${path}: expected a float (number), got ${typeof actual}`);
			const spelledInfinity = INF_SPELLINGS[expected.value];
			if (spelledInfinity !== undefined) {
				assert.strictEqual(actual, spelledInfinity, `${path}: expected ${expected.value}`);
				return;
			}
			if (expected.value.includes("nan")) {
				assert.isTrue(Number.isNaN(actual), `${path}: expected nan, got ${String(actual)}`);
				return;
			}
			assert.isTrue(
				Object.is(actual, Number(expected.value)),
				`${path}: expected float ${expected.value}, got ${String(actual)}`,
			);
			return;
		}
		case "bool": {
			assert.strictEqual(actual, expected.value === "true", `${path}: bool mismatch`);
			return;
		}
		case "datetime":
		case "datetime-local":
		case "date-local":
		case "time-local": {
			const cls = DATETIME_CLASSES[expected.type];
			assert.isTrue(actual instanceof cls, `${path}: expected a ${cls.name}`);
			const reparsed = classifyValueToken(expected.value, 0);
			assert.isTrue(
				reparsed instanceof cls,
				`${path}: corpus expected value ${expected.value} did not classify as ${cls.name}`,
			);
			assert.isTrue(Equal.equals(actual, reparsed), `${path}: expected ${expected.value}, got ${String(actual)}`);
			return;
		}
		default: {
			assert.fail(`${path}: unknown toml-test tag ${expected.type}`);
		}
	}
}

/**
 * Assert that `actual` (a `Toml.parse` result) matches `expected` (the parsed
 * tagged-JSON expectation). Containers recurse with exact key sets / lengths;
 * leaves dispatch on the tag. Throws assert failures carrying `path`.
 */
export function assertMatchesTagged(actual: unknown, expected: unknown, path: string): void;
export function assertMatchesTagged(expected: unknown, path: string): (actual: unknown) => void;
export function assertMatchesTagged(
	...args: [actual: unknown, expected: unknown, path: string] | [expected: unknown, path: string]
): void | ((actual: unknown) => void) {
	return args.length === 3
		? assertMatchesTaggedDual(args[0], args[1], args[2])
		: assertMatchesTaggedDual(args[0], args[1]);
}

const assertMatchesTaggedDual: {
	(actual: unknown, expected: unknown, path: string): void;
	(expected: unknown, path: string): (actual: unknown) => void;
} = dual(3, function assertMatchesTagged(actual: unknown, expected: unknown, path: string): void {
	if (isTaggedLeaf(expected)) {
		assertLeaf(actual, expected, path);
		return;
	}
	if (Array.isArray(expected)) {
		assert.isTrue(Array.isArray(actual), `${path}: expected an array, got ${typeof actual}`);
		const actualArray = actual as ReadonlyArray<unknown>;
		assert.strictEqual(actualArray.length, expected.length, `${path}: array length mismatch`);
		for (let i = 0; i < expected.length; i++) {
			assertMatchesTagged(actualArray[i], expected[i], `${path}[${i}]`);
		}
		return;
	}
	assert.isTrue(
		typeof expected === "object" && expected !== null,
		`${path}: corpus expectation is not an object, array or tagged leaf`,
	);
	assert.isTrue(
		typeof actual === "object" && actual !== null && !Array.isArray(actual),
		`${path}: expected a table, got ${Array.isArray(actual) ? "array" : typeof actual}`,
	);
	const expectedRecord = expected as Record<string, unknown>;
	const actualRecord = actual as Record<string, unknown>;
	const expectedKeys = Object.keys(expectedRecord).sort();
	const actualKeys = Object.keys(actualRecord).sort();
	assert.deepStrictEqual(actualKeys, expectedKeys, `${path}: key set mismatch`);
	for (const key of expectedKeys) {
		assertMatchesTagged(actualRecord[key], expectedRecord[key], `${path}.${key}`);
	}
});
