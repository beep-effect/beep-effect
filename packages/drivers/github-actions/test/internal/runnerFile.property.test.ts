import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { delimiterFor, heredocBlock } from "@beep/github-actions/internal/runnerFile";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
// Framing and delimiter selection are not endomorphisms: applying them to their
// own output must choose a new delimiter. Canonical parse/reframe is the law.
it.effect.prop(
  "heredoc framing recovers every value byte-for-byte and canonical reformatting is idempotent",
  [Arbitrary.schema(S.String)],
  ([value]) =>
    Effect.sync(() => {
      const name = "value";
      const delimiter = delimiterFor(value);
      assert.strictEqual(Str.includes(delimiter)(value), false);
      const block = heredocBlock({ name, value });
      const header = `${name}<<${delimiter}\n`;
      const footer = `\n${delimiter}\n`;
      assert.strictEqual(Str.startsWith(header)(block), true);
      assert.strictEqual(Str.endsWith(footer)(block), true);
      const parsed = Str.slice(header.length, -footer.length)(block);
      assert.strictEqual(parsed, value);
      const reformatted = heredocBlock({ name, value: parsed });
      assert.strictEqual(reformatted, block);
      assert.strictEqual(
        heredocBlock({ name, value: Str.slice(header.length, -footer.length)(reformatted) }),
        reformatted
      );
    }),
  runs
);
