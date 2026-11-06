import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Mdast, MdastDecodeError } from "@beep/markdown/Mdast";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Root } from "@beep/markdown/MarkdownNode";

const ProjectedContent = S.Struct({
  children: S.Tuple([
    S.Struct({ children: S.Tuple([S.Struct({ value: S.String })]) }),
    S.Struct({ value: S.String }),
    S.Struct({ label: S.String }),
  ]),
});

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({ text: S.String, code: S.String, label: S.String });

type Block = Root["children"][number] | undefined;

/** The first text child's value of a paragraph block. */
const paragraphText = (block: Block): string | undefined => {
  const first = block?.type === "paragraph" ? block.children[0] : undefined;
  return first?.type === "text" ? first.value : undefined;
};

const codeValue = (block: Block): string | undefined => (block?.type === "code" ? block.value : undefined);

const definitionUrl = (block: Block): string | undefined => (block?.type === "definition" ? block.url : undefined);

/** A code value as the engine carries it: the final line terminator restored (CR content keeps its LF). */
const carriedCodeValue = (code: string): string =>
  code === "" ? "" : `${code}${Str.endsWith("\r")(code) ? "\r\n" : "\n"}`;

describe("Mdast properties", () => {
  it.effect.prop(
    "MdastDecodeError schema round-trips without decode failure",
    [Arbitrary.schema(MdastDecodeError)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(MdastDecodeError)(value);
        const decoded = yield* S.decodeEffect(MdastDecodeError)(encoded);
        assert.ok(S.toEquivalence(MdastDecodeError)(value, decoded));
      }),
    runs
  );
  it.effect.prop(
    "foreign projection stabilizes and preserves text, code and association labels",
    [Arbitrary.schema(Sample)],
    ([sample]) =>
      Effect.gen(function* () {
        const root = yield* Mdast.fromMdast({
          type: "root",
          children: [
            { type: "paragraph", children: [{ type: "text", value: sample.text }] },
            { type: "code", value: sample.code },
            { type: "definition", identifier: "id", label: sample.label, url: "./target" },
          ],
        });
        const plain = Mdast.toMdast(root);
        const content = yield* S.decodeUnknownEffect(ProjectedContent)(plain);
        assert.strictEqual(content.children[0].children[0].value, sample.text);
        assert.strictEqual(content.children[1].value, sample.code);
        assert.strictEqual(content.children[2].label, sample.label);
        const admitted = yield* Mdast.fromMdast(plain);
        assert.deepStrictEqual(Mdast.toMdast(admitted), plain);
        const fromMdast1 = yield* Mdast.fromMdast(Mdast.toMdast(admitted));
        assert.deepStrictEqual(Mdast.toMdast(fromMdast1), plain);
        const [paragraph, code, definition] = admitted.children;
        assert.strictEqual(paragraphText(paragraph), sample.text);
        assert.strictEqual(codeValue(code), carriedCodeValue(sample.code));
        assert.strictEqual(definitionUrl(definition), "./target");
      }),
    runs
  );
});
