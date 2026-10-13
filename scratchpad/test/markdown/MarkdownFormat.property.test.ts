import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Subject from "../../effected/markdown/MarkdownFormat.ts";
import { assertDefined } from "@effect/vitest/utils";
import * as Str from "effect/String";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import { MarkdownEdit } from "../../effected/markdown/MarkdownEdit.ts";
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and never fails`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("MarkdownFormat schema property floor", () => {
  roundTrips("CodeBlockStyle", Subject.CodeBlockStyle);
  roundTrips("MarkdownFormattingOptions", Subject.MarkdownFormattingOptions);
  roundTrips("MarkdownModificationErrorCode", Subject.MarkdownModificationErrorCode);
  roundTrips("MarkdownModificationError", Subject.MarkdownModificationError);
});


describe("MarkdownFormat surgical fidelity", () => {
  it.effect.prop("modify preserves every source byte outside the selected node", [Arbitrary.schema(S.String)], ([replacement]) => Effect.gen(function* () {
    const prefix = "<!-- keep spacing -->\r\n\r\n# Heading\r\n\r\n";
    const suffix = "\r\n\r\n<!-- tail   -->\r\n";
    const source = `${prefix}original${suffix}`;
    const document = yield* MarkdownDocument.parse(source);
    const paragraph = document.find("paragraph");
    assertDefined(paragraph);
    const edits = yield* Subject.MarkdownFormat.modify(document, paragraph, replacement);
    assert.strictEqual(edits.length, 1);
    const [edit] = edits;
    assertDefined(edit);
    assert.strictEqual(edit.offset, prefix.length);
    assert.strictEqual(edit.length, "original".length);
    const output = MarkdownEdit.applyAll(source, edits);
    assert.strictEqual(Str.substring(0, prefix.length)(output), prefix);
    assert.strictEqual(Str.substring(output.length - suffix.length)(output), suffix);
    assert.strictEqual(yield* Subject.MarkdownFormat.modifyToString(document, paragraph, replacement), output);
  }), runs);
});
