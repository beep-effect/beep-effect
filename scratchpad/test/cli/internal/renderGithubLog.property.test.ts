import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { Doc } from "../../../effected/cli/Doc.ts";
import { Render } from "../../../effected/cli/Render.ts";
import { renderGithubLog } from "../../../effected/cli/internal/renderGithubLog.ts";
import { CommandNeutralizer } from "../../../effected/github-commands/index.ts";
import { sanitize } from "../../../effected/cli/Fmt.ts";
const ctx = Render.contextOf({ audience: "agent" });
it.effect.prop("renderGithubLog: verbatim rendering is idempotent through its line parser and preserves sanitized whitespace", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const input = `prefix ${text} suffix`;
  const once = renderGithubLog([Doc.verbatim(input)], ctx);
  const lines = sanitize(input).replace(/\r\n|\r/g, "\n").split("\n");
  // github-log neutralization is a separate, intentional normalization of untrusted commands.
  assert.strictEqual(renderGithubLog([Doc.verbatim(once)], ctx), once);
  assert.strictEqual(once, A.join(A.flatMap(lines, CommandNeutralizer.lines), "\n"));
  assert.deepStrictEqual(once.split("\n"), renderGithubLog([Doc.verbatim(once.split("\n").join("\n"))], ctx).split("\n"));
}), runs);

it.effect.prop("GitHub log rendering neutralizes arbitrary command payloads without changing their visible content", [Arbitrary.schema(S.String)], ([payload]) => Effect.sync(() => {
  const input = `::error::${payload}\ntext ##[warning]${payload} suffix`;
  const once = renderGithubLog([Doc.verbatim(input)], ctx);
  const lines = sanitize(input).replace(/\r\n|\r/g, "\n").split("\n");
  assert.strictEqual(once, A.join(A.flatMap(lines, CommandNeutralizer.lines), "\n"));
  assert.strictEqual(renderGithubLog([Doc.verbatim(once)], ctx), once);
}), runs);
