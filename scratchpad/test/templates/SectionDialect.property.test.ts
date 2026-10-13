import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { Eol, SectionDialect, SectionRenderError } from "../../effected/templates/SectionDialect.ts";
import { CommentStyle } from "../../effected/templates/CommentStyle.ts";
import { Section, SectionId, SectionKey } from "../../effected/templates/Section.ts";
import { SectionDocument } from "../../effected/templates/SectionDocument.ts";
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

describe("SectionDialect schema properties", () => {
  roundTrips("Eol", Eol);
  roundTrips("SectionDialect", SectionDialect);
  roundTrips("SectionRenderError", SectionRenderError);
});

// Content lines are prefixed so arbitrary text cannot become a boundary marker.

const StyleIndex = S.Literals([0, 1, 2, 3, 4, 5]);
const styles = [CommentStyle.hash, CommentStyle.slash, CommentStyle.semicolon, CommentStyle.dash, CommentStyle.html, CommentStyle.block] as const;

it.effect.prop("render/parse preserves content, attributes and markers and reaches a formatting fixed point",
  [Arbitrary.schema(SectionKey), Arbitrary.schema(S.String), Arbitrary.schema(Eol), Arbitrary.schema(StyleIndex)],
  ([key, value, eol, index]) => Effect.gen(function* () {
    const id = SectionId.make({ key, commentStyle: styles[index] });
    const content = `data:${value.replace(/\r/g, "").replace(/\n/g, "\ndata:")}`;
    const section = id.section(content, { origin: "property", key });
    const dialect = SectionDialect.default;
    const rendered = yield* Effect.fromResult(dialect.render(section, eol));
    const parsed = yield* SectionDocument.parse(rendered, dialect);
    const recovered = yield* Effect.fromOption(parsed.read(id));
    assert.isTrue(S.toEquivalence(Section)(recovered, section));
    const rerendered = yield* Effect.fromResult(dialect.render(recovered, eol));
    assert.strictEqual(rerendered, rendered);
    const reparsed = yield* Effect.fromResult(SectionDocument.parseResult(rerendered, dialect));
    assert.isTrue(S.toEquivalence(SectionDocument)(reparsed, parsed));
    assert.strictEqual(dialect.beginMarker(id), rendered.split(eol)[0]?.replace(' origin="property" key="' + key + '"', ""));
    assert.strictEqual(dialect.endMarker(id), rendered.split(eol).at(-1));
  }), runs);


it.effect.prop("trailing bare CR refuses LF rendering and preserves full fidelity with CRLF",
  [Arbitrary.schema(SectionKey), Arbitrary.schema(S.String), Arbitrary.schema(StyleIndex)],
  ([key, value, index]) => Effect.gen(function* () {
    const id = SectionId.make({ key, commentStyle: styles[index] });
    const content = `data:${value.replace(/\r/g, "").replace(/\n/g, "\ndata:")}\r`;
    const section = id.section(content, { origin: "property", key });
    const dialect = SectionDialect.default;
    const refused = dialect.render(section, "\n");
    if (!Result.isFailure(refused)) assert.fail("LF must refuse a trailing bare CR");
    assert.strictEqual(refused.failure.reason, "trailingCarriageReturn");
    assert.strictEqual(refused.failure.key, key);
    const rendered = yield* Effect.fromResult(dialect.render(section, "\r\n"));
    const parsed = yield* SectionDocument.parse(rendered, dialect);
    const recovered = yield* Effect.fromOption(parsed.read(id));
    assert.isTrue(S.toEquivalence(Section)(recovered, section));
    assert.strictEqual(recovered.content, content);
    const rerendered = yield* Effect.fromResult(dialect.render(recovered, "\r\n"));
    assert.strictEqual(rerendered, rendered);
    const reparsed = yield* SectionDocument.parse(rerendered, dialect);
    assert.isTrue(S.toEquivalence(SectionDocument)(reparsed, parsed));
    assert.strictEqual(parsed.check(section)._tag, "UpToDate");
    const repeated = yield* Effect.fromResult(parsed.reconcile([section]));
    assert.strictEqual(repeated.text, rendered);
    assert.isFalse(repeated.changed);
  }), runs);
