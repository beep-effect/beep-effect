import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlAlias, YamlScalar } from "../../../../effected/yaml/YamlNode.ts";
import { YamlToken } from "../../../../effected/yaml/YamlToken.ts";
import { coveringToken, insideScalarSpan, isScalarContinuationLine, positionAt, walkScalars } from "../../../../effected/yaml/internal/rules/util.ts";

it.effect("span queries respect gaps, boundaries and multiline content", () => Effect.sync(() => {
  const scalar = YamlToken.make({ kind: "scalar", text: "a\nb", offset: 2, length: 3, line: 0, character: 2 });
  const space = YamlToken.make({ kind: "whitespace", text: " ", offset: 7, length: 1, line: 1, character: 3 });
  const tokens = [scalar, space];
  assert.strictEqual(coveringToken(tokens, 0), undefined);
  assert.strictEqual(coveringToken(tokens, 2), scalar);
  assert.strictEqual(coveringToken(4)(tokens), scalar);
  assert.strictEqual(coveringToken(tokens, 5), undefined);
  assert.strictEqual(coveringToken(tokens, 8), undefined);
  assert.isTrue(insideScalarSpan(3)(tokens));
  assert.isFalse(insideScalarSpan(tokens, 7));
  assert.isTrue(isScalarContinuationLine(3, 4)(tokens));
  assert.isFalse(isScalarContinuationLine(tokens, 2, 2));
  assert.isFalse(isScalarContinuationLine(tokens, 7, 7));
  assert.isFalse(isScalarContinuationLine(tokens, 9, 9));
  assert.deepStrictEqual(positionAt([], 2), { line: 0, character: 0 });
  const lines = [{ text: "abc", offset: 2, number: 0 }, { text: "x", offset: 6, number: 1 }];
  assert.deepStrictEqual(positionAt(lines, 0), { line: 0, character: 0 });
  assert.deepStrictEqual(positionAt(4)(lines), { line: 0, character: 2 });
  assert.deepStrictEqual(positionAt(lines, 6), { line: 1, character: 0 });
}));

it.effect("scalar traversal skips aliases and null while retaining the supplied role", () => Effect.sync(() => {
  const visited: Array<string> = [];
  const visit = (_scalar: YamlScalar, role: string) => { visited.push(role); };
  walkScalars(YamlAlias.make({ name: "a", offset: 0, length: 2 }), "root", visit);
  walkScalars(null, "root", visit);
  walkScalars("item", visit)(YamlScalar.make({ value: "x", style: "plain", offset: 0, length: 1 }));
  assert.deepStrictEqual(visited, ["item"]);
}));
