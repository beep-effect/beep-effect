import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as O from "effect/Option";
import { assertDefined } from "@effect/vitest/utils";
import { Block, type Counter, Doc } from "../../effected/cli/Doc.ts";
import { Status } from "../../effected/cli/Status.ts";

it.effect("an absent link target preserves an existing inline label", () => Effect.sync(() => {
  const label = Doc.code("a.ts");
  assert.strictEqual(Doc.link(undefined, label), label);
}));

it.effect("overflow callbacks normalize strings and retain structured inline content", () => Effect.sync(() => {
  const list = Doc.list([], { overflow: (hidden) => [String(hidden), Doc.code("hidden")] });
  assert.deepStrictEqual(list.overflow?.(3), [Doc.text("3"), Doc.code("hidden")]);
  const table = Doc.table([], [], { overflow: (hidden) => `${hidden} more` });
  assert.deepStrictEqual(table.overflow?.(2), [Doc.text("2 more")]);
}));

it.effect("strong and emphasis flatten array inputs without losing inline order", () => Effect.sync(() => {
  const code = Doc.code("count");
  const content = [Doc.text("total "), code, Doc.text(" items")];
  assert.deepStrictEqual(Doc.strong(["total ", code], " items"), { _tag: "Strong", content });
  assert.deepStrictEqual(Doc.em("total ", [code, " items"]), { _tag: "Emphasis", content });
}));

// The union property can omit an optional total on every generated Counts
// node. Derive that declaration directly from the public AST so its generator
// and callback behavior are exercised regardless of union-member selection.
it.effect("Block's generated total callback survives encoding and controls the observed total", () => Effect.gen(function* () {
  const ast = SchemaAST.isSuspend(Block.ast) ? Block.ast.thunk() : Block.ast;
  const field = SchemaAST.isUnion(ast)
    ? A.findFirst(A.flatMap(ast.types, (member) => SchemaAST.isObjects(member) ? member.propertySignatures : []), (property) => property.name === "total")
    : O.none();
  if (O.isNone(field)) return yield* Effect.die("Block must declare its total callback");
  const schema = S.make<S.Codec<(counters: ReadonlyArray<Counter>) => number>>(field.value.type);
  const [total] = yield* Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: 1, seed: 0 });
  assertDefined(total);
  const expected = total([]);
  const counter = Doc.counter(Status.core, "success", { key: "ok", label: "items", n: 2 });
  const block = Doc.counts({ counters: [counter], total, layout: "inline" });
  const decoded = yield* S.decodeEffect(Block)(yield* S.encodeEffect(Block)(block));
  if (decoded._tag !== "Counts") return yield* Effect.die("Counts must retain its tag");
  assert.strictEqual(Doc.total(block), expected);
  assert.strictEqual(Doc.total(decoded), expected);
  assert.notStrictEqual(expected, 2);
}));
