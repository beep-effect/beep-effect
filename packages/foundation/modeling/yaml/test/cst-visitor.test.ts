import { cstEvents } from "@beep/yaml/internal/cst-visitor";
import { YamlVisitor, YamlVisitorEvent } from "@beep/yaml/YamlVisitor";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import type { Node } from "yaml";

const isCollection = (node: unknown): node is Node => isMap(node) || isSeq(node);

function projectOraclePair(
  pair: { readonly key: unknown; readonly value: unknown },
  keys: unknown[],
  values: unknown[]
): void {
  keys.push(isScalar(pair.key) ? pair.key.value : null);
  if (isScalar(pair.value) && pair.value.value !== null) values.push(String(pair.value.value));
  if (isCollection(pair.value)) projectOracle(pair.value, keys, values);
}

function projectOracle(node: Node | null | undefined, keys: unknown[], values: unknown[]): void {
  if (isMap(node)) {
    for (const pair of node.items) projectOraclePair(pair, keys, values);
  } else if (isSeq(node)) {
    projectOracleItems(node.items, keys, values);
  }
}

function projectOracleItems(items: ReadonlyArray<unknown>, keys: unknown[], values: unknown[]): void {
  for (const item of items) {
    if (isCollection(item)) projectOracle(item, keys, values);
  }
}

const projections = [
  { name: "compact mappings in a sequence", source: "- a: 1\n- b: 2\n", keys: ["a", "b"], values: ["1", "2"] },
  {
    name: "sibling first key and nested mappings",
    source: "a:\n  b: 1\n  c: 2\nd: 3\n",
    keys: ["a", "b", "c", "d"],
    values: ["1", "2", "3"],
  },
  { name: "omitted block value", source: "a:\nb: 2\n", keys: ["a", "b"], values: ["2"] },
  { name: "omitted flow value", source: "{a: , b: 2}", keys: ["a", "b"], values: ["2"] },
  { name: "consecutive omitted block values", source: "a:\nb:\nc: 3\nd:\n", keys: ["a", "b", "c", "d"], values: ["3"] },
  {
    name: "consecutive omitted flow values",
    source: "{a: , b: , c: 3, d: }",
    keys: ["a", "b", "c", "d"],
    values: ["3"],
  },
  { name: "compact mapping with omitted value", source: "- a:\n  b: 2\n", keys: ["a", "b"], values: ["2"] },
  { name: "multiline scalar value", source: "a:\n  x\nb: 2\n", keys: ["a", "b"], values: ["x", "2"] },
  {
    name: "nested mapping with omitted value",
    source: "a:\n  b: 1\n  c:\n  d: 2\ne: 3\n",
    keys: ["a", "b", "c", "d", "e"],
    values: ["1", "2", "3"],
  },
];

describe("CST key/value projections", () => {
  for (const { name, source, keys, values } of projections) {
    it.effect(name, () =>
      Effect.gen(function* () {
        const events = [...cstEvents(source)];
        const cstKeys = A.map(
          A.filter(events, (event) => event._tag === "CstKeyEvent"),
          (event) => event.source
        );
        const cstValues = A.map(
          A.filter(events, (event) => event._tag === "CstValueEvent"),
          (event) => event.source
        );
        assert.deepStrictEqual(cstKeys, keys);
        assert.deepStrictEqual(cstValues, values);
        const oracle = parseDocument(source);
        assert.deepStrictEqual(oracle.errors, []);
        const oracleKeys: unknown[] = [];
        const oracleValues: unknown[] = [];
        projectOracle(oracle.contents, oracleKeys, oracleValues);
        assert.deepStrictEqual(
          oracleKeys,
          cstKeys,
          "the oracle AST is projected independently of the composer, including omitted flow values"
        );
        assert.deepStrictEqual(
          oracleValues,
          cstValues,
          "the oracle projection recurses into nested collections; scalar sequence items carry no key/value events"
        );
        if (!Str.startsWith("{")(source)) {
          const astEvents = yield* Stream.runCollect(YamlVisitor.visit(source));
          const pairs = A.filter(astEvents, YamlVisitorEvent.$is("Pair"));
          assert.deepStrictEqual(
            A.map(pairs, (pair) => pair.key),
            cstKeys,
            "compact/block projections also agree with the lab AST; the oracle covers omitted flow values"
          );
          assert.deepStrictEqual(
            A.map(
              A.filter(pairs, (pair) => pair.value !== null),
              (pair) => String(pair.value)
            ),
            cstValues
          );
        }
      })
    );
  }
});

const rawRoleRegressions = [
  { name: "empty block key after a value", source: "a: 1\n: 2", keys: ["a", ""], values: ["1", "2"] },
  { name: "empty block key after an omitted value", source: "a:\n: 2", keys: ["a", ""], values: ["2"] },
  { name: "empty flow key after a value", source: "{a: 1, : 2}", keys: ["a", ""], values: ["1", "2"] },
  {
    name: "multiline block value fragments",
    source: "a: one\n two\nb: 2\n",
    keys: ["a", "b"],
    values: ["one", "two", "2"],
  },
  {
    name: "multiline explicit block key fragments",
    source: "? one\n two\n: value\n",
    keys: ["one", "two"],
    values: ["value"],
  },
  {
    name: "multiline flow key and value fragments",
    source: "{one\n two: value\n more, b: 2}",
    keys: ["one", "two", "b"],
    values: ["value", "more", "2"],
  },
];

describe("CST raw mapping role regressions", () => {
  for (const { name, source, keys, values } of rawRoleRegressions) {
    it.effect(name, () =>
      Effect.sync(() => {
        const events = [...cstEvents(source)];
        assert.deepStrictEqual(
          A.map(
            A.filter(events, (event) => event._tag === "CstKeyEvent"),
            (event) => event.source
          ),
          keys
        );
        assert.deepStrictEqual(
          A.map(
            A.filter(events, (event) => event._tag === "CstValueEvent"),
            (event) => event.source
          ),
          values
        );
        assert.deepStrictEqual(parseDocument(source).errors, []);
      })
    );
  }
});
