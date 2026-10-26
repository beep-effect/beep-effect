import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { zipManifest } from "@beep/github-actions/internal/archiveCommands";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
// The caller rejects CR/LF in paths. Empty strings are preserved as blank lines.
const paths = S.String.pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((files) => A.map(files, (file) => Str.replaceAll(/[\r\n]/g, "_")(file)))
);
const parse = (text: string): Array<string> => (text === "" ? [] : pipe(text, Str.slice(0, -1), Str.split("\n")));
it.effect.prop(
  "zip manifest formatting is idempotent through parsing and preserves every representable path byte and order",
  [paths],
  ([files]) =>
    Effect.sync(() => {
      const text = zipManifest(files);
      assert.deepStrictEqual(parse(text), files);
      assert.strictEqual(zipManifest(parse(text)), text);
      assert.deepStrictEqual(parse(zipManifest(parse(text))), parse(text));
    }),
  runs
);
