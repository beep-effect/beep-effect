import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Doc } from "../../../effected/cli/Doc.ts";
import { Render } from "../../../effected/cli/Render.ts";
import { renderGithubLog } from "../../../effected/cli/internal/renderGithubLog.ts";
it.effect("untitled sections keep trusted annotations and neutralize untrusted text", () => Effect.sync(() => {
  const ctx = Render.contextOf({ audience: "agent" });
  assert.strictEqual(renderGithubLog([Doc.section(undefined, [Doc.annotation({ level: "notice" }, "ok"), Doc.paragraph("::error::untrusted")])], ctx), "::notice::ok\n\n\u200b::error::untrusted");
}));
