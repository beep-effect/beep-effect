import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { Doc } from "../../../effected/cli/Doc.ts";
import { Render } from "../../../effected/cli/Render.ts";
import { renderPlain, renderPlainLines, plainInline } from "../../../effected/cli/internal/renderPlain.ts";
import { sanitize } from "../../../effected/cli/Fmt.ts";
const ctx = Render.contextOf({ audience: "agent" });
it.effect.prop("renderPlain: verbatim rendering is idempotent through its line parser and preserves sanitized whitespace", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const input = `prefix ${text} suffix`;
  const once = renderPlain([Doc.verbatim(input)], ctx);
  const lines = sanitize(input).replace(/\r\n|\r/g, "\n").split("\n");
  const expected = A.join(lines, "\n");
  // github-log neutralization is a separate, intentional normalization of untrusted commands.
  assert.strictEqual(renderPlain([Doc.verbatim(once)], ctx), once);
  assert.strictEqual(once, expected);
  assert.deepStrictEqual(once.split("\n"), renderPlain([Doc.verbatim(once.split("\n").join("\n"))], ctx).split("\n"));
}), runs);

it.effect.prop("plain inline formatting drops decoration faithfully and has an idempotent text representation", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const value = `prefix ${text} suffix`;
  const first = plainInline([Doc.strong(Doc.em(value))], ctx);
  const rendered = A.join(A.map(first, (span) => span.text), "");
  assert.strictEqual(rendered, sanitize(value));
  assert.deepStrictEqual(plainInline([Doc.text(rendered)], ctx), [{ text: rendered }]);
  assert.deepStrictEqual(renderPlainLines([Doc.verbatim(rendered)], ctx), rendered.replace(/\r\n|\r/g, "\n").split("\n"));
}), runs);
