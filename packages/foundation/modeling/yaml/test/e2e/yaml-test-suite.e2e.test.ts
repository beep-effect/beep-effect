/**
 * Official yaml-test-suite compliance tests.
 *
 * Runs the full yaml-test-suite (https://github.com/yaml/yaml-test-suite)
 * against the engine to validate YAML 1.2 spec compliance across four
 * assertion families: parse success/failure, JSON equivalence, canonical
 * output byte-equality, and stringify roundtrip.
 */

import { ParseOptionsInput, StringifyOptionsInput } from "@beep/yaml/internal/options";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertExitSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
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
import type { TestCase } from "./support/suite.ts";

const allCases = loadAllTestCases();

function shouldSkipAssertion(id: string, assertion: string): boolean {
  return SKIP_ASSERTIONS[id]?.includes(assertion) ?? false;
}

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

const parseOptions = () => ParseOptionsInput.make({ uniqueKeys: false });

const parseDocumentValues = (yaml: string) =>
  parseAllDocuments(yaml, parseOptions()).pipe(
    Effect.map((docs) =>
      A.map(docs, (doc) => {
        const anchors = buildAnchorMap(doc.contents);
        return getNodeValue(doc.contents, anchors);
      })
    )
  );

const assertJsonMatch = Effect.fn(function* (tc: TestCase) {
  if (tc.isMultiDocument) {
    const values = yield* parseDocumentValues(tc.yaml);
    assert.isTrue(deepEqualWithNaN(values, tc.json), `JSON mismatch for ${tc.id}`);
  } else {
    const value = yield* parse(tc.yaml, parseOptions());
    assert.isTrue(deepEqualWithNaN(value, tc.json), `JSON mismatch for ${tc.id}`);
  }
});

const canonicalOutput = Effect.fn(function* (tc: TestCase) {
  if (tc.isMultiDocument) {
    const docs = yield* parseAllDocuments(tc.yaml, parseOptions());
    const parts = A.map(docs, (doc) =>
      stringifyDocument(doc, StringifyOptionsInput.make({ forceDefaultStyles: true }))
    );
    const joined = A.join(parts, "");
    return applyMultiDocCanonical(joined, docs);
  }
  const doc = yield* parseDocument(tc.yaml, parseOptions());
  const raw = stringifyDocument(doc, StringifyOptionsInput.make({ forceDefaultStyles: true }));
  return applySingleDocCanonical(raw, doc, tc.yaml);
});

const assertRoundtrip = Effect.fn(function* (tc: TestCase, value: unknown) {
  const stringified = stringify(value);
  const reparsed = yield* parse(stringified, parseOptions());
  assert.isTrue(deepEqualWithNaN(reparsed, value), `Roundtrip mismatch for ${tc.id}`);
});

const assertStringifyRoundtrip = Effect.fn(function* (tc: TestCase) {
  if (tc.isMultiDocument) {
    const values = yield* parseDocumentValues(tc.yaml);
    for (const value of values) {
      yield* assertRoundtrip(tc, value);
    }
  } else {
    const value = yield* parse(tc.yaml, parseOptions());
    yield* assertRoundtrip(tc, value);
  }
});

function registerErrorCase(tc: TestCase): void {
  it.effect("should reject invalid YAML", () =>
    Effect.gen(function* () {
      const result = yield* parse(tc.yaml, parseOptions()).pipe(Effect.asVoid, Effect.exit);
      assertExitFailure(result, result.pipe(Exit.getCause, O.getOrThrow));
    })
  );
}

function registerValidCase(tc: TestCase): void {
  it.effect("should parse successfully", () =>
    Effect.gen(function* () {
      const result = yield* parse(tc.yaml, parseOptions()).pipe(Effect.asVoid, Effect.exit);
      assertExitSuccess(result, undefined);
    })
  );

  if (tc.json !== undefined && !shouldSkipAssertion(tc.id, "json")) {
    it.effect("should match expected JSON output", () => assertJsonMatch(tc));
  }

  if (tc.outYaml !== undefined && !shouldSkipAssertion(tc.id, "output")) {
    const expected = tc.outYaml;
    it.effect("should match canonical output", () =>
      Effect.gen(function* () {
        const stringified = yield* canonicalOutput(tc);
        assert.strictEqual(stringified, expected);
      })
    );
  }

  if (!shouldSkipAssertion(tc.id, "roundtrip")) {
    it.effect("should survive stringify roundtrip", () => assertStringifyRoundtrip(tc));
  }
}

describe("yaml-test-suite compliance", () => {
  for (const tc of allCases) {
    if (SKIP[tc.id] !== undefined && SKIP[tc.id] !== "") {
      it.skip(`[${tc.id}] ${tc.name} (SKIP: ${SKIP[tc.id]})`, () => {});
      continue;
    }

    describe(`[${tc.id}] ${tc.name}`, () => (tc.isError ? registerErrorCase(tc) : registerValidCase(tc)));
  }
});
