import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Yaml } from "../../../../effected/yaml/Yaml.ts";
import { YamlFormat } from "../../../../effected/yaml/YamlFormat.ts";
import { CommentFields, EscapedComment, joinComments, rawCommentText } from "../../../../effected/yaml/internal/composer/comments.ts";

const runs = { arbitrary: fcRuns(100) };
// Restrict generated document comments to printable ASCII and tabs; YAML
// rejects control characters. Hashes and spaces-only spellings remain legal.
const tokenText = Str.replaceAll(/[^\x20-\x7e\t]/g, " ");

describe("composer comment property floor", () => {
  it.effect.prop("CommentFields encode/decode preserves optional fields and never fails", [Arbitrary.schema(CommentFields)], ([fields]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(CommentFields)(fields);
    const decoded = yield* S.decodeEffect(CommentFields)(encoded);
    assert.strictEqual(S.toEquivalence(CommentFields)(decoded, fields), true);
  }), runs);

  it.effect.prop("EscapedComment encode/decode preserves text and offset and never fails", [Arbitrary.schema(EscapedComment)], ([comment]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(EscapedComment)(comment);
    const decoded = yield* S.decodeEffect(EscapedComment)(encoded);
    assert.strictEqual(S.toEquivalence(EscapedComment)(decoded, comment), true);
  }), runs);

  it.effect.prop("raw comment capture is faithful through rendering and formatting is idempotent", [Arbitrary.schema(S.String)], ([input]) => Effect.gen(function* () {
    const raw = tokenText(input);
    const stored = rawCommentText(`#${raw}`);
    const rendered = `#${/^ +$/.test(stored) ? Str.slice(0, -1)(stored) : stored}`;
    assert.strictEqual(rendered, `#${raw}`);
    assert.strictEqual(rawCommentText(rendered), stored);
    const source = `${rendered}\nkey: 1\n`;
    const formatted = YamlFormat.formatToString(source);
    assert.strictEqual(YamlFormat.formatToString(formatted), formatted);
    assert.strictEqual(Str.startsWith(`${rendered}\n`)(formatted), true);
    const parsed = yield* Yaml.parse(source);
    assert.deepStrictEqual(yield* Yaml.parse(yield* Yaml.stringify(parsed)), parsed);
  }), runs);

  it.effect.prop("joined comment tokens retain both spellings across an idempotent format pass", [Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([a, b]) => Effect.gen(function* () {
    const first = tokenText(a);
    const second = tokenText(b);
    const joined = joinComments(rawCommentText(`#${first}`), rawCommentText(`#${second}`));
    assert.strictEqual(joined, `${rawCommentText(`#${first}`)}\n${rawCommentText(`#${second}`)}`);
    const source = `#${first}\n#${second}\nkey: 1\n`;
    const formatted = YamlFormat.formatToString(source);
    assert.strictEqual(YamlFormat.formatToString(formatted), formatted);
    assert.strictEqual(Str.startsWith(`#${first}\n#${second}\n`)(formatted), true);
    const parsed = yield* Yaml.parse(source);
    assert.deepStrictEqual(yield* Yaml.parse(yield* Yaml.stringify(parsed)), parsed);
  }), runs);
});
