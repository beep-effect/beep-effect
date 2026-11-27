import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { Doc } from "@beep/cli-kit/Doc";
import { sanitize } from "@beep/cli-kit/Fmt";
import { plainInline, renderPlain, renderPlainLines } from "@beep/cli-kit/internal/renderPlain";
import { Render } from "@beep/cli-kit/Render";
import { pipe } from "effect/Function";
import * as Str from "effect/String";

const ctx = Render.contextOf({ audience: "agent" });
it.effect.prop(
  "renderPlain: verbatim rendering is idempotent through its line parser and preserves sanitized whitespace",
  [Arbitrary.schema(S.String)],
  ([text]) =>
    Effect.sync(() => {
      const input = `prefix ${text} suffix`;
      const once = renderPlain([Doc.verbatim(input)], ctx);
      const lines = pipe(sanitize(input), Str.replace(/\r\n|\r/g, "\n"), Str.split("\n"));
      const expected = A.join(lines, "\n");
      assert.strictEqual(renderPlain([Doc.verbatim(once)], ctx), once);
      assert.strictEqual(
        once,
        expected,
        "plain does not neutralize: github-log's is a separate normalization of untrusted commands"
      );
      assert.deepStrictEqual(
        Str.split(once, "\n"),
        Str.split(renderPlain([Doc.verbatim(pipe(once, Str.split("\n"), A.join("\n")))], ctx), "\n")
      );
    }),
  runs
);

it.effect.prop(
  "plain inline formatting drops decoration faithfully and has an idempotent text representation",
  [Arbitrary.schema(S.String)],
  ([text]) =>
    Effect.sync(() => {
      const value = `prefix ${text} suffix`;
      const first = plainInline([Doc.strong(Doc.em(value))], ctx);
      const rendered = A.join(
        A.map(first, (span) => span.text),
        ""
      );
      assert.strictEqual(rendered, sanitize(value));
      assert.deepStrictEqual(plainInline([Doc.text(rendered)], ctx), [{ text: rendered }]);
      assert.deepStrictEqual(
        renderPlainLines([Doc.verbatim(rendered)], ctx),
        pipe(rendered, Str.replace(/\r\n|\r/g, "\n"), Str.split("\n"))
      );
    }),
  runs
);
