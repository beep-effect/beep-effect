import { trustedNode } from "@beep/markdown/internal/nodes";
import { inlineOutput, stringifyTree } from "@beep/markdown/internal/stringify";
import { Markdown } from "@beep/markdown/Markdown";
import { InlineCode, Paragraph, Position, Root, Table, TableCell, TableRow, Text } from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

describe("stringify scalability", () => {
  it("serializes a schema-valid 150000-row shallow table under the Node vitest runner", () => {
    const row = TableRow.make({ children: [TableCell.make({ children: [] })] });
    const root = Root.make({ children: [Table.make({ children: A.makeBy(150_000, () => row) })] });
    assert.isTrue(S.is(Root)(root));
    const result = Markdown.stringifyResult(root);
    assertSuccess(
      Result.map(result, () => undefined),
      undefined
    );
    assert.strictEqual(Result.getOrThrow(result), `|  |\n| --- |\n${Str.repeat(149_999)("|  |\n")}`);
  });

  for (const size of [4_000, 8_000, 16_000]) {
    it(`reads adjacent text values linearly for ${size} siblings without merging nodes`, () => {
      let reads = 0;
      const children = A.makeBy(
        size,
        () =>
          new Proxy(Text.make({ value: "x" }), {
            get(target, key, receiver) {
              if (key === "value") reads += 1;
              return Reflect.get(target, key, receiver);
            },
          })
      );
      const paragraph = trustedNode<Paragraph>({ type: "paragraph", children, position: Position.synthetic });
      const before = paragraph.children;
      const root = trustedNode<Root>({ type: "root", children: [paragraph], position: Position.synthetic });
      reads = 0;
      assert.strictEqual(Result.getOrThrow(Markdown.stringifyResult(root)), `${Str.repeat(size)("x")}\n`);
      assert.isAtMost(reads, size * 4);
      assert.isAtLeast(
        reads,
        size,
        "make copies its input and would drop the read-counting proxies, so the tree is assembled as the parser does it and the serializer reads the proxies themselves"
      );
      assert.strictEqual(paragraph.children, before);
      assert.strictEqual(paragraph.children.length, size);
      for (let index = 0; index < size; index += 1) {
        assert.strictEqual(paragraph.children[index], children[index]);
      }
    });
  }
});

describe("inline emission scales linearly", () => {
  it.effect("inspects exactly linear chunk text and detects growing-output reads", () =>
    Effect.gen(function* () {
      let work = 0;
      const tail = inlineOutput.tail;
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          inlineOutput.tail = (text) => {
            work += text.length;
            return tail(text);
          };
        }),
        () =>
          Effect.sync(() => {
            inlineOutput.tail = tail;
          })
      );
      const workAt = (reps: number): number => {
        const tree = Result.getOrThrow(
          Markdown.parseResult(Str.repeat(reps)("a_b &amp; www.x.com http://x *y* [z] ![w](u) # 1. "))
        );
        work = 0;
        stringifyTree(tree);
        return work;
      };
      const small = workAt(1000);
      const medium = workAt(2000);
      const large = workAt(4000);
      assert.isAbove(small, 0, "the serializer must enter the metered seam");
      assert.isAbove(medium, small);
      assert.strictEqual(large - medium, 2 * (medium - small));

      const quadraticWork = (reps: number): number => {
        work = 0;
        let output = "";
        for (let index = 0; index < reps; index += 1) {
          output += "x";
          inlineOutput.tail(output);
        }
        return work;
      };
      const badSmall = quadraticWork(100);
      const badMedium = quadraticWork(200);
      const badLarge = quadraticWork(400);
      assert.isAbove(badSmall, 0);
      assert.isAbove(
        badLarge - badMedium,
        2 * (badMedium - badSmall),
        "negative control: the former shape, inspecting the whole growing output per child, must read as superlinear"
      );
    })
  );
});

describe("compiled serializer dispatch", () => {
  const source = O.getOrThrow(
    R.get(
      import.meta.glob<string>("../src/internal/stringify.ts", { query: "?raw", import: "default", eager: true }),
      "../src/internal/stringify.ts"
    )
  );

  it("builds every Match dispatcher once, at module level", () => {
    const built = A.length(A.fromIterable(Str.matchAll(/Match\.type</g)(source)));
    const moduleLevel = A.length(A.fromIterable(Str.matchAll(/^const \w+ = Match\.type</gm)(source)));
    assert.isAtLeast(built, 3);
    assert.strictEqual(
      moduleLevel,
      built,
      "every Match.type initializes a module-level constant: one built per node would rebuild a matcher on every child"
    );
    assert.isFalse(Str.includes("Match.value(")(source), "no Match.value exists: it would build a matcher per node");
  });

  it("serializes 10000 inline-code siblings through the compiled dispatch", () => {
    const root = Root.make({
      children: [Paragraph.make({ children: A.makeBy(10_000, () => InlineCode.make({ value: "x" })) })],
    });
    for (let sample = 0; sample < 3; sample += 1) {
      assert.strictEqual(stringifyTree(root), `${Str.repeat(10_000)("`x`")}\n`);
    }
  });
});
