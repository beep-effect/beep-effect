import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import serializer from "../../effected/cli/ui-testing-serializer.ts";
const words = S.Literals(["a", "b", " ", "\n", "\t"]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("")));
it.effect.prop("snapshot serialization is idempotent and preserves painted text and interior whitespace", [words], ([text]) => Effect.sync(() => {
  const once = serializer.serialize(`\u001b[1mprefix ${text} suffix\u001b[22m`);
  assert.strictEqual(serializer.serialize(once), once);
  assert.strictEqual(once.replaceAll("[b]", "").replaceAll("[/b]", ""), serializer.serialize(`prefix ${text} suffix`));
  assert.deepStrictEqual(once.split("\n"), serializer.serialize(once.split("\n").join("\n")).split("\n"));
}), runs);
