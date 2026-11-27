import { ConfigIssueRenderer } from "@beep/cli-kit/ConfigIssueRenderer";
import { SchemaIssueRenderer } from "@beep/cli-kit/SchemaIssueRenderer";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

const issueFrom = <A, I>(schema: S.Codec<A, I>, input: unknown) =>
  S.decodeUnknownEffect(schema)(input, { onExcessProperty: "error", errors: "all" }).pipe(
    Effect.flip,
    Effect.map((error) => error.issue)
  );

const Config = S.Struct({
  owner: S.optionalKey(S.String),
  groups: S.Record(S.String, S.Struct({ repos: S.Array(S.String) })),
});

const Group = S.Union([
  S.Struct({ file: S.Record(S.String, S.String) }),
  S.Struct({ value: S.Record(S.String, S.String) }),
  S.Struct({ resolved: S.Record(S.String, S.String) }),
]);

describe("SchemaIssueRenderer", () => {
  it.effect("names an unknown key with its path, in the user's words", () =>
    Effect.gen(function* () {
      const issueFrom1 = yield* issueFrom(Config, { owner: "acme", ownr: "typo", groups: {} });
      const lines = SchemaIssueRenderer.render(issueFrom1);

      assert.include(lines, "unknown key at ownr");
      assert.notInclude(
        A.join(lines, "\n"),
        "excess property",
        "core's 'Expected no excess property' describes the schema's rule, not the mistake"
      );
    })
  );

  it.effect("reports a nested path, not just the top level", () =>
    Effect.gen(function* () {
      const issueFrom2 = yield* issueFrom(Config, { groups: { g: { repos: ["r"], extra: 1 } } });
      const lines = SchemaIssueRenderer.render(issueFrom2);

      assert.include(lines, "unknown key at groups.g.extra");
    })
  );

  it.effect("keeps core's phrasing for every other leaf", () =>
    Effect.gen(function* () {
      const issueFrom3 = yield* issueFrom(Config, { groups: { g: { repos: "not-an-array" } } });
      const lines = SchemaIssueRenderer.render(issueFrom3);

      assert.strictEqual(
        A.some(lines, (line) => Str.includes("groups.g.repos")(line)),
        true
      );
      assert.strictEqual(
        A.every(lines, (line) => !Str.startsWith("unknown key")(line)),
        true
      );
    })
  );

  it.effect("reports each allowed shape of a union once, and the wrong key once", () =>
    Effect.gen(function* () {
      const namesInlineNotNestedUnderAKind = { KEEP_ME: "yes" };
      const issueFrom4 = yield* issueFrom(Group, namesInlineNotNestedUnderAKind);
      const lines = SchemaIssueRenderer.render(issueFrom4);

      assert.deepStrictEqual(lines, [
        "unknown key at KEEP_ME",
        "Missing key at file",
        "Missing key at value",
        "Missing key at resolved",
      ]);
      assert.lengthOf(
        A.filter(lines, (line) => Str.startsWith("unknown key")(line)),
        1,
        "undeduplicated, the union repeats the unknown-key line per branch, burying what was allowed"
      );
    })
  );

  it("yields no lines for anything that is not an issue tree", () => {
    for (const value of [undefined, null, "a string", 42, {}, new Error("nope")]) {
      assert.deepStrictEqual(
        SchemaIssueRenderer.render(value),
        [],
        "a renderer on an error path must never become the reason a program dies"
      );
    }
  });
});

describe("ConfigIssueRenderer", () => {
  it.effect("reads the issue off the error, so a caller does not have to", () =>
    Effect.gen(function* () {
      const error = { _tag: "ConfigValidationError", issue: yield* issueFrom(Config, { ownr: "typo", groups: {} }) };

      assert.include(
        ConfigIssueRenderer.render(deliberatelyInvalid<never>(error)),
        "unknown key at ownr",
        "the error is shaped like the optional peer's, so this suite runs without it installed"
      );
    })
  );

  it("yields no lines for an error with no issue tree, or for nothing at all", () => {
    assert.deepStrictEqual(
      ConfigIssueRenderer.render(deliberatelyInvalid<never>({ _tag: "ConfigFileNotFoundError", searched: ["/a"] })),
      []
    );
    assert.deepStrictEqual(ConfigIssueRenderer.render(deliberatelyInvalid<never>(undefined)), []);
    assert.deepStrictEqual(ConfigIssueRenderer.render(deliberatelyInvalid<never>(null)), []);
  });
});
