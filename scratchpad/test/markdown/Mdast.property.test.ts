import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Mdast, MdastDecodeError } from "../../effected/markdown/Mdast.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({ text: S.String, code: S.String, label: S.String });

describe("Mdast properties", () => {
  it.effect.prop("MdastDecodeError schema round-trips without decode failure", [Arbitrary.schema(MdastDecodeError)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(MdastDecodeError)(value);
    const decoded = yield* S.decodeEffect(MdastDecodeError)(encoded);
    assert.ok(S.toEquivalence(MdastDecodeError)(value, decoded));
  }), runs);
  it.effect.prop("foreign projection stabilizes and preserves text, code and association labels", [Arbitrary.schema(Sample)], ([sample]) => Effect.gen(function* () {
    const root = yield* Mdast.fromMdast({ type: "root", children: [
      { type: "paragraph", children: [{ type: "text", value: sample.text }] },
      { type: "code", value: sample.code },
      { type: "definition", identifier: "id", label: sample.label, url: "./target" },
    ] });
    const plain = Mdast.toMdast(root);
    const content = yield* S.decodeUnknownEffect(S.Struct({
      children: S.Tuple([
        S.Struct({ children: S.Tuple([S.Struct({ value: S.String })]) }),
        S.Struct({ value: S.String }),
        S.Struct({ label: S.String }),
      ]),
    }))(plain);
    assert.strictEqual(content.children[0].children[0].value, sample.text);
    assert.strictEqual(content.children[1].value, sample.code);
    assert.strictEqual(content.children[2].label, sample.label);
    const admitted = yield* Mdast.fromMdast(plain);
    assert.deepStrictEqual(Mdast.toMdast(admitted), plain);
    assert.deepStrictEqual(Mdast.toMdast(yield* Mdast.fromMdast(Mdast.toMdast(admitted))), plain);
    const [paragraph, code, definition] = admitted.children;
    if (paragraph?.type === "paragraph") assert.strictEqual(paragraph.children[0]?.type === "text" ? paragraph.children[0].value : undefined, sample.text);
    assert.strictEqual(code?.type === "code" ? code.value : undefined, sample.code === "" ? "" : `${sample.code}${sample.code.endsWith("\r") ? "\r\n" : "\n"}`);
    assert.strictEqual(definition?.type === "definition" ? definition.url : undefined, "./target");
  }), runs);
});
