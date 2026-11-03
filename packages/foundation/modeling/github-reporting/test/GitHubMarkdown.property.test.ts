import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GitHubMarkdown } from "@beep/github-reporting/GitHubMarkdown";
import { Markdown } from "@beep/markdown/Markdown";
import { Root } from "@beep/markdown/MarkdownNode";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const Word = S.String.check(S.isPattern(/^[a-z]{1,20}$/u));
// Source coordinates describe the original spelling, not markdown semantics.
const semantics = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, semantics);
  if (P.isObject(value))
    return R.fromEntries(
      A.map(
        A.filter(R.toEntries(value), ([key]) => key !== "position"),
        ([key, child]) => [key, semantics(child)]
      )
    );
  return value;
};
const fidelity = Effect.fnUntraced(function* (text: string) {
  const parsed = yield* Markdown.parse(text);
  const formatted = yield* Markdown.stringify(parsed);
  const reparsed = yield* Markdown.parse(formatted);
  const value1 = yield* S.encodeEffect(Root)(reparsed);
  const argument = semantics(value1);
  const value2 = yield* S.encodeEffect(Root)(parsed);
  assert.deepStrictEqual(argument, semantics(value2));
  const stringify2 = yield* Markdown.stringify(reparsed);
  assert.strictEqual(stringify2, formatted);
});

describe("GitHubMarkdown formatter properties", () => {
  const formatters = [
    ["heading", (text: string) => GitHubMarkdown.heading(text)],
    ["link", (text: string) => GitHubMarkdown.link(text, `https://example.test/${text}`)],
    ["code", (text: string) => GitHubMarkdown.code(text)],
    ["codeBlock", (text: string) => GitHubMarkdown.codeBlock(`${text}\n${text}`, "ts")],
    ["list", (text: string) => GitHubMarkdown.list([text, `**${text}**`])],
    ["ordered list", (text: string) => GitHubMarkdown.list([text, text], { ordered: true })],
    ["details", (text: string) => GitHubMarkdown.details(text, GitHubMarkdown.code(text))],
    ["raw", (text: string) => GitHubMarkdown.raw(`**${text}**\n`)],
    ["table", (text: string) => GitHubMarkdown.table(["value"], [[text]])],
    ["tableFor", (text: string) => GitHubMarkdown.tableFor(S.Struct({ value: S.String })).render([{ value: text }])],
  ] as const;
  for (const [name, render] of formatters) {
    it.effect.prop(
      `${name}: parse/stringify/parse fidelity and canonical formatting idempotence`,
      [Arbitrary.schema(Word)],
      ([text]) => fidelity(render(text)),
      runs
    );
  }
  it.effect.prop(
    "raw formatting is itself idempotent and preserves arbitrary bytes",
    [Arbitrary.schema(S.String)],
    ([text]) =>
      Effect.sync(() => {
        const formatted = GitHubMarkdown.raw(text);
        assert.strictEqual(formatted, text);
        assert.strictEqual(GitHubMarkdown.raw(formatted), formatted);
      }),
    runs
  );
  it.effect.prop(
    "pipes and newlines in table cells preserve column count and inline content",
    [Arbitrary.schema(Word), Arbitrary.schema(Word)],
    ([left, right]) =>
      Effect.gen(function* () {
        const value = `${left} || ${right}\nnext`;
        const rendered = GitHubMarkdown.table(["range", "outcome"], [[value, "ok"]]);
        assert.include(rendered, `${left} \\|\\| ${right}<br>next`);
        const parsed = yield* Markdown.parse(rendered);
        const table = parsed.children[0];
        assert.isDefined(table);
        if (table?.type !== "table") return assert.fail("expected a parsed table");
        assert.lengthOf(table.children, 2);
        for (const row of table.children) assert.lengthOf(row.children, 2);
        yield* fidelity(rendered);
        assert.strictEqual(
          GitHubMarkdown.tableFor(S.Struct({ range: S.String, outcome: S.String })).render([
            { range: value, outcome: "ok" },
          ]),
          rendered
        );
      }),
    runs
  );
});
