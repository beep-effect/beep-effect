import { describe, expect, it } from "@effect/vitest";
import parser from "@typescript-eslint/parser";
import { Effect } from "effect";
import * as A from "effect/Array";
import { Linter } from "eslint";
import plugin from "./lint-fixtures/oxlint-plugin-xstate-effect.mjs";

/** Executes the imported ESLint-compatible rule against its original TypeScript fixtures. */
const lint = Effect.fnUntraced(function* (fixture: string) {
  const source = yield* Effect.promise(() =>
    Bun.file(new URL(`./lint-fixtures/${fixture}.ts.txt`, import.meta.url)).text()
  );
  return new Linter().verify(
    source,
    {
      files: ["**/*.ts"],
      languageOptions: { parser },
      plugins: { "xstate-effect": plugin },
      rules: { "xstate-effect/no-inline-effect": "error" },
    },
    { filename: `${fixture}.ts` }
  );
});

describe("xstate-effect/no-inline-effect", () => {
  it.live(
    "reports inline Effect actions and inline spawned Effect logic",
    Effect.fnUntraced(function* () {
      const diagnostics = yield* lint("inline-effect");
      expect(A.every(diagnostics, (diagnostic) => diagnostic.ruleId === "xstate-effect/no-inline-effect")).toBe(true);
      expect(A.filter(diagnostics, (diagnostic) => diagnostic.messageId === "inlineAction")).toHaveLength(2);
      expect(A.filter(diagnostics, (diagnostic) => diagnostic.messageId === "inlineSpawn")).toHaveLength(2);
    })
  );

  it.live(
    "reports nothing for declared actions and declared spawned actors",
    Effect.fnUntraced(function* () {
      expect(yield* lint("declared-effect")).toEqual([]);
    })
  );
});
