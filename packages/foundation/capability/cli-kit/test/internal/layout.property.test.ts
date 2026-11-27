import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { Doc } from "@beep/cli-kit/Doc";
import { sanitize } from "@beep/cli-kit/Fmt";
import { displayWidth } from "@beep/cli-kit/internal/displayWidth";
import { flatten, paintSpans, truncateSpans, widthOf, wrapSpans } from "@beep/cli-kit/internal/layout";
import { Render } from "@beep/cli-kit/Render";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Str from "effect/String";

const ctx = Render.contextOf({ audience: "agent" });
const width = S.Int.check(S.isBetween({ minimum: 1, maximum: 40 }));
it.effect.prop(
  "flattening and painting preserve sanitized content and have an idempotent plain representation",
  [Arbitrary.schema(S.String)],
  ([text]) =>
    Effect.sync(() => {
      const flat = flatten([Doc.strong(Doc.em(Doc.text(text)))], ctx);
      const rendered = paintSpans(flat, ctx);
      assert.strictEqual(rendered, sanitize(text));
      const parsed = flatten([Doc.text(rendered)], ctx);
      assert.strictEqual(paintSpans(parsed, ctx), rendered);
      assert.deepStrictEqual(flatten([Doc.text(paintSpans(parsed, ctx))], ctx), parsed);
      assert.strictEqual(widthOf(flat), displayWidth(sanitize(text)));
    }),
  runs
);
it.effect.prop(
  "truncation is idempotent and wrapping has a faithful canonical line representation",
  [Arbitrary.schema(S.String), Arbitrary.schema(width)],
  ([text, columns]) =>
    Effect.sync(() => {
      const spans = flatten([Doc.text(text)], ctx);
      const clipped = truncateSpans(spans, columns, "…");
      assert.deepStrictEqual(truncateSpans(clipped, columns, "…"), clipped);
      assert.isAtMost(widthOf(clipped), columns);
      const wrapped = wrapSpans(spans, columns);
      const lines = A.map(wrapped, (line) => paintSpans(line, ctx));
      const reparsed = A.map(lines, (line) => flatten([Doc.text(line)], ctx));
      assert.deepStrictEqual(
        A.map(reparsed, (line) => paintSpans(line, ctx)),
        lines,
        "each canonical output line reparses on its own, blank lines retained"
      );
      assert.deepStrictEqual(
        A.map(reparsed, (line) =>
          pipe(
            wrapSpans(line, columns),
            A.map((part) => paintSpans(part, ctx)),
            A.join("\n")
          )
        ),
        lines
      );
      const words = Str.replace(/\s/g, "")(sanitize(text));
      assert.strictEqual(pipe(lines, A.join(""), Str.replace(/\s/g, "")), words);
    }),
  runs
);
