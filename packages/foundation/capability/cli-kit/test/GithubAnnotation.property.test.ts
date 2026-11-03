import { AnnotationOptions } from "@beep/cli-kit/Doc";
import { AnnotationLevel, GithubAnnotation, GithubAnnotationProperties } from "@beep/cli-kit/GithubAnnotation";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const unescape = (text: string) =>
  pipe(
    text,
    Str.replace(/%3A/g, ":"),
    Str.replace(/%2C/g, ","),
    Str.replace(/%0D/g, "\r"),
    Str.replace(/%0A/g, "\n"),
    Str.replace(/%25/g, "%")
  );
const unescapeMessage = (text: string) =>
  pipe(text, Str.replace(/%0D/g, "\r"), Str.replace(/%0A/g, "\n"), Str.replace(/%25/g, "%"));

const reconstruct = (annotation: AnnotationOptions, fields: Record<string, string>) => ({
  level: annotation.level,
  ...(annotation.title === undefined ? {} : { title: fields.title }),
  ...(annotation.file === undefined ? {} : { file: fields.file }),
  ...(annotation.line === undefined ? {} : { line: Number(fields.line) }),
  ...(annotation.endLine === undefined ? {} : { endLine: Number(fields.endLine) }),
  ...(annotation.col === undefined ? {} : { col: Number(fields.col) }),
  ...(annotation.endColumn === undefined ? {} : { endColumn: Number(fields.endColumn) }),
});

it.effect.prop(
  "annotation formatting preserves message and metadata through the workflow grammar",
  [Arbitrary.schema(AnnotationOptions), Arbitrary.schema(S.String)],
  ([annotation, message]) =>
    Effect.sync(() => {
      const formatted = GithubAnnotation.format(annotation, message);
      const end = 2 + O.getOrThrow(Str.indexOf("::")(Str.slice(2)(formatted)));
      const header = Str.slice(2, end)(formatted);
      const firstSpace = O.getOrElse(Str.indexOf(" ")(header), () => -1);
      const level = firstSpace < 0 ? header : Str.slice(0, firstSpace)(header);
      assert.strictEqual(level, annotation.level);
      const pairs = firstSpace < 0 ? [] : pipe(header, Str.slice(firstSpace + 1), Str.split(","));
      const fields: Record<string, string> = {};
      for (const pair of pairs) {
        const equals = O.getOrThrow(Str.indexOf("=")(pair));
        fields[Str.slice(0, equals)(pair)] = unescape(Str.slice(equals + 1)(pair));
      }
      const decodedMessage = unescapeMessage(Str.slice(end + 2)(formatted));
      assert.strictEqual(decodedMessage, message);
      const reconstructed = reconstruct(annotation, fields);
      assertTrue(AnnotationOptions.pipe(S.toEquivalence)(reconstructed, annotation));
      assert.strictEqual(GithubAnnotation.format(reconstructed, decodedMessage), formatted);
      assert.strictEqual(A.join(Str.split(formatted, "\n"), ""), formatted);
    }),
  runs
);

const roundTrip = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name} encodes and decodes without failure or loss`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};
roundTrip("AnnotationLevel", AnnotationLevel);
roundTrip("GithubAnnotationProperties", GithubAnnotationProperties);

it("annotation options reuse the metadata fields and preserve severity order and absent properties", () => {
  assert.deepStrictEqual(AnnotationLevel.literals, ["error", "warning", "notice"]);
  for (const key of ["level", "file", "line", "col", "endLine", "endColumn", "title"] as const) {
    assert.strictEqual(AnnotationOptions.fields[key], GithubAnnotationProperties.fields[key]);
  }
  assert.strictEqual(GithubAnnotation.format({ level: "notice" }, "ready"), "::notice::ready");
  assert.isTrue(S.is(GithubAnnotationProperties)({ level: "notice" }));
  assert.isFalse(S.is(GithubAnnotationProperties)({ level: "notice", file: undefined }));
});
