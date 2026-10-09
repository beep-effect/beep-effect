import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { AnnotationOptions, Block, Column, Counter, CountsRow, Doc, Inline, LinkTarget, StatusRef, TreeNode } from "../../effected/cli/Doc.ts";

import { Render } from "../../effected/cli/Render.ts";
import { Fmt } from "../../effected/cli/Fmt.ts";
import { contextOf } from "./helpers/renderContext.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, observe?: (value: T) => unknown): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    if (observe !== undefined) assert.deepStrictEqual(observe(decoded), observe(value));
  }), runs);
};

// Opaque callbacks are preserved by reference by the codec. Exercise their
// observable results as well, including callbacks nested inside containers.
const callbacks = (block: Block): ReadonlyArray<unknown> => {
  const results: Array<unknown> = [];
  if ("overflow" in block && block.overflow !== undefined) results.push(block.overflow(3));
  if ("total" in block && block.total !== undefined) results.push(block.total(block.counters));
  switch (block._tag) {
    case "List": return [...results, ...A.flatMap(block.items, callbacks)];
    case "Section": return [...results, ...A.flatMap(block.children, callbacks)];
    case "Collapsible":
    case "Callout": return [...results, ...A.flatMap(block.body, callbacks)];
    default: return results;
  }
};

describe("Doc schema round trips", () => {
  roundTrips("StatusRef", StatusRef);
  roundTrips("LinkTarget", LinkTarget);
  roundTrips("Inline", Inline);
  roundTrips("TreeNode", TreeNode);
  roundTrips("Column", Column);
  roundTrips("Counter", Counter);
  roundTrips("Block", Block, callbacks);
  roundTrips("AnnotationOptions", AnnotationOptions);
  roundTrips("CountsRow", CountsRow);

  it.effect.prop("normalizing inline content is idempotent and preserves its order", [Inline.pipe(S.Array, Arbitrary.schema)], ([content]) => Effect.sync(() => {
    const normalized = Doc.paragraph(content);
    assert.deepStrictEqual(normalized.content, content);
    assert.deepStrictEqual(Doc.paragraph(normalized.content), normalized);
  }), runs);
});

const lineText = S.Array(S.Literals(["a", " ", "界", "👨‍👩‍👧"])).pipe(Arbitrary.schema, Arbitrary.map(A.join("")));
it.effect.prop("README fidelity: wrap false keeps a line whole at any width", [lineText, Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 80 })))], ([middle, width]) => Effect.gen(function* () {
  const text = `x${middle}x`;
  const ctx = yield* contextOf({ width, color: "none" });
  const doc = Doc.line(text, { wrap: false });
  const rendered = Render.plain([doc], ctx);
  assert.strictEqual(rendered, text);
  assert.strictEqual(Render.plain([Doc.line(rendered, { wrap: false })], ctx), rendered);
}), runs);

const hostileLine = S.Array(S.Literals(["a", "界", "\u001b[31m", "\u001b[0m", "\u0007", "\t", "\u001b]8;;https://evil\u0007"])).pipe(Arbitrary.schema, Arbitrary.map(A.join("")));
it.effect.prop("README fidelity: document strings cannot inject colour, controls or links", [hostileLine], ([middle]) => Effect.gen(function* () {
  const text = `x${middle}x`;
  const ctx = yield* contextOf({ color: "none" });
  const rendered = Render.plain([Doc.line(text, { wrap: false })], ctx);
  assert.strictEqual(rendered, Fmt.sanitize(text));
  assert.notInclude(rendered, "\u001b");
  assert.notInclude(rendered, "\u0007");
  assert.strictEqual(Render.plain([Doc.line(rendered, { wrap: false })], ctx), rendered);
}), runs);
