import { classifyValueToken } from "@beep/toml/internal/scanner";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "@beep/toml/TomlDateTime";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";

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

function isTaggedLeaf(candidate: unknown): candidate is TaggedLeaf {
  if (!P.isObject(candidate)) {
    return false;
  }
  const record = candidate;
  return (
    R.size(record) === 2 &&
    typeof record.type === "string" &&
    typeof record.value === "string" &&
    LEAF_TAGS.has(record.type)
  );
}

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

type LeafAsserter = (actual: unknown, expected: TaggedLeaf, path: string) => void;

const assertStringLeaf: LeafAsserter = (actual, expected, path) => {
  assert.strictEqual(actual, expected.value, `${path}: string mismatch`);
};

const assertIntegerLeaf: LeafAsserter = (actual, expected, path) => {
  if (!P.isNumber(actual) && !P.isBigInt(actual)) {
    assert.fail(`${path}: expected an integer (number | bigint), got ${typeof actual}`);
  }
  if (typeof actual === "number") {
    assert.isTrue(Number.isInteger(actual), `${path}: expected an integer, got non-integral number ${actual}`);
  }
  assert.isTrue(
    BigInt(expected.value) === BigInt(actual),
    `${path}: expected integer ${expected.value}, got ${String(actual)}`
  );
};

const assertFloatLeaf: LeafAsserter = (actual, expected, path) => {
  assert.isTrue(typeof actual === "number", `${path}: expected a float (number), got ${typeof actual}`);
  const spelledInfinity = INF_SPELLINGS[expected.value];
  if (spelledInfinity !== undefined) {
    assert.strictEqual(actual, spelledInfinity, `${path}: expected ${expected.value}`);
    return;
  }
  if (Str.includes("nan")(expected.value)) {
    assert.isTrue(Number.isNaN(actual), `${path}: expected nan, got ${String(actual)}`);
    return;
  }
  assert.isTrue(
    Object.is(actual, Number(expected.value)),
    `${path}: expected float ${expected.value}, got ${String(actual)}`
  );
};

const assertBoolLeaf: LeafAsserter = (actual, expected, path) => {
  assert.strictEqual(actual, expected.value === "true", `${path}: bool mismatch`);
};

const dateTimeLeafAsserter =
  (cls: DateTimeClass): LeafAsserter =>
  (actual, expected, path) => {
    assert.isTrue(actual instanceof cls, `${path}: expected a ${cls.name}`);
    const reparsed = classifyValueToken(expected.value, 0);
    assert.isTrue(
      reparsed instanceof cls,
      `${path}: corpus expected value ${expected.value} did not classify as ${cls.name}`
    );
    assert.isTrue(Equal.equals(actual, reparsed), `${path}: expected ${expected.value}, got ${String(actual)}`);
  };

const LEAF_ASSERTERS: Record<string, LeafAsserter> = {
  string: assertStringLeaf,
  integer: assertIntegerLeaf,
  float: assertFloatLeaf,
  bool: assertBoolLeaf,
  datetime: dateTimeLeafAsserter(DATETIME_CLASSES.datetime),
  "datetime-local": dateTimeLeafAsserter(DATETIME_CLASSES["datetime-local"]),
  "date-local": dateTimeLeafAsserter(DATETIME_CLASSES["date-local"]),
  "time-local": dateTimeLeafAsserter(DATETIME_CLASSES["time-local"]),
};

function assertLeaf(actual: unknown, expected: TaggedLeaf, path: string): void {
  const asserter = R.has(LEAF_ASSERTERS, expected.type) ? LEAF_ASSERTERS[expected.type] : undefined;
  if (asserter === undefined) {
    assert.fail(`${path}: unknown toml-test tag ${expected.type}`);
  }
  asserter(actual, expected, path);
}

function assertArrayMatches(actual: unknown, expected: ReadonlyArray<unknown>, path: string): void {
  if (!A.isArray(actual)) {
    assert.fail(`${path}: expected an array, got ${typeof actual}`);
  }
  const actualArray = actual;
  assert.strictEqual(actualArray.length, expected.length, `${path}: array length mismatch`);
  for (let i = 0; i < expected.length; i++) {
    assertMatchesTagged(actualArray[i], expected[i], `${path}[${i}]`);
  }
}

function assertTableMatches(actual: unknown, expected: unknown, path: string): void {
  if (!P.isObject(expected)) {
    assert.fail(`${path}: corpus expectation is not an object, array or tagged leaf`);
  }
  if (!P.isObject(actual)) {
    assert.fail(`${path}: expected a table, got ${A.isArray(actual) ? "array" : typeof actual}`);
  }
  const expectedRecord = expected;
  const actualRecord = actual;
  const expectedKeys = R.keys(expectedRecord).sort();
  const actualKeys = R.keys(actualRecord).sort();
  assert.deepStrictEqual(actualKeys, expectedKeys, `${path}: key set mismatch`);
  for (const key of expectedKeys) {
    assertMatchesTagged(actualRecord[key], expectedRecord[key], `${path}.${key}`);
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
  if (A.isArray(expected)) {
    assertArrayMatches(actual, expected, path);
    return;
  }
  assertTableMatches(actual, expected, path);
});
