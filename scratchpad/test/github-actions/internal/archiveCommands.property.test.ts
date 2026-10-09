import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { zipManifest } from "../../../effected/github-actions/internal/archiveCommands.ts";
const runs = { arbitrary: fcRuns(100) };
// The caller rejects CR/LF in paths. Empty strings are preserved as blank lines.
const paths = S.String.pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((files) => files.map((file) => file.replaceAll(/[\r\n]/g, "_"))),
);
const parse = (text: string): Array<string> => (text === "" ? [] : text.slice(0, -1).split("\n"));
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
  runs,
);
