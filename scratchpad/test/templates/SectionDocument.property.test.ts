import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SectionDocument, SectionParseError, SectionReconciliation } from "../../effected/templates/SectionDocument.ts";
import { CommentStyle } from "../../effected/templates/CommentStyle.ts";
import { SectionId } from "../../effected/templates/Section.ts";
import { Eol, SectionDialect } from "../../effected/templates/SectionDialect.ts";
const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(name + " decodes its encoded values without failure", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(equivalent(decoded, value));
    }), runs);
};

describe("SectionDocument schema properties", () => {
  roundTrips("SectionDocument", SectionDocument);
  roundTrips("SectionParseError", SectionParseError);
  roundTrips("SectionReconciliation", SectionReconciliation);
});


it.effect.prop("reconcile is idempotent and preserves every byte outside the declared span, including BOM",
  [Arbitrary.schema(S.String), Arbitrary.schema(S.String), Arbitrary.schema(S.String), Arbitrary.schema(Eol)],
  ([prefix, suffix, value, eol]) => Effect.gen(function* () {
    const safe = (text: string) => text.replace(/\r/g, "").replace(/\n/g, "\nuser:");
    const before = `\uFEFFuser:${safe(prefix)}${eol}${eol}`;
    const after = `${eol}${eol}user:${safe(suffix)}`;
    const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
    const old = id.section("old", { run: "before" });
    const next = id.section(`data:${safe(value)}`, { run: "after" });
    const oldBlock = yield* Effect.fromResult(SectionDialect.default.render(old, eol));
    const parsed = yield* SectionDocument.parse(before + oldBlock + after);
    const first = yield* Effect.fromResult(parsed.reconcile([next]));
    const expectedBlock = yield* Effect.fromResult(SectionDialect.default.render(next, parsed.eol));
    assert.strictEqual(first.text, before + expectedBlock + after);
    const formatted = yield* Effect.fromResult(SectionDocument.parseResult(first.text));
    const second = yield* Effect.fromResult(formatted.reconcile([next]));
    assert.strictEqual(second.text, first.text);
    assert.isFalse(second.changed);
    assert.deepStrictEqual(second.outcomes.map((outcome) => outcome._tag), ["Unchanged"]);
    assert.strictEqual(formatted.check(next)._tag, "UpToDate");
    const reparsed = yield* SectionDocument.parse(formatted.text);
    assert.isTrue(S.toEquivalence(SectionDocument)(reparsed, formatted));
  }), runs);


const BlankCharacter = S.Literals([" ", "\t", "\n"]);
const BlankPrefix = S.Array(BlankCharacter);

it.effect.prop("first insertion preserves every byte of empty and blank prefixes and reaches a fixed point",
  [Arbitrary.schema(BlankPrefix), Arbitrary.schema(S.Boolean), Arbitrary.schema(S.String), Arbitrary.schema(Eol)],
  ([whitespace, bom, value, eol]) => Effect.gen(function* () {
    const prefix = (bom ? "\uFEFF" : "") + whitespace.map((character) => character === "\n" ? eol : character).join("");
    const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
    const section = id.section(`data:${value.replace(/\r/g, "").replace(/\n/g, "\ndata:")}`);
    const parsed = yield* SectionDocument.parse(prefix);
    const block = yield* Effect.fromResult(SectionDialect.default.render(section, parsed.eol));
    const separator = prefix === "" || prefix.endsWith(parsed.eol + parsed.eol) ? "" : prefix.endsWith(parsed.eol) ? parsed.eol : parsed.eol + parsed.eol;
    const first = yield* Effect.fromResult(parsed.reconcile([section]));
    assert.strictEqual(first.text, prefix + separator + block + parsed.eol);
    assert.strictEqual(first.text.slice(0, prefix.length), prefix);
    assert.deepStrictEqual(first.outcomes.map((outcome) => outcome._tag), ["Created"]);
    const formatted = yield* SectionDocument.parse(first.text);
    assert.strictEqual(formatted.check(section)._tag, "UpToDate");
    const second = yield* Effect.fromResult(formatted.reconcile([section]));
    assert.strictEqual(second.text, first.text);
    assert.isFalse(second.changed);
    assert.deepStrictEqual(second.outcomes.map((outcome) => outcome._tag), ["Unchanged"]);
    const reparsed = yield* SectionDocument.parse(formatted.text);
    assert.isTrue(S.toEquivalence(SectionDocument)(reparsed, formatted));
  }), runs);
