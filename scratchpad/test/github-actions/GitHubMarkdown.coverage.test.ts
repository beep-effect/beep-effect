import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import { GitHubMarkdown } from "../../effected/github-actions/GitHubMarkdown.ts";
it.effect("raw preserves bytes and an encoder yielding undefined renders an empty cell", () => Effect.sync(() => {
  const raw = " \r\n| already | markdown |\n";
  assert.strictEqual(GitHubMarkdown.raw(raw), raw);
  const Discarded = S.Undefined.pipe(S.decodeTo(S.String, {
    decode: SchemaGetter.transform(() => "present"),
    encode: SchemaGetter.transform(() => undefined),
  }));
  assert.strictEqual(GitHubMarkdown.tableFor(S.Struct({ discarded: Discarded })).render([{ discarded: "present" }]), "| discarded |\n| --- |\n|  |");
}));
