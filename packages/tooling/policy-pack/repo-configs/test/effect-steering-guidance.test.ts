import { fileURLToPath } from "node:url";
import { it } from "@beep/test-runner";
import { Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

const skillFilePath = fileURLToPath(
  new URL("../../../../../.claude/skills/effect-first-development/SKILL.md", import.meta.url)
);

const readText = Effect.fn(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(path);
});

it.layer(NodeServices.layer, { timeout: "10 seconds" })("effect steering guidance", (it) => {
  describe("effect steering guidance", () => {
    it.effect(
      "aligns the canonical skill with flat control flow guidance",
      Effect.fn(function* () {
        const source = yield* readText(skillFilePath);

        expect(source).toContain("Prefer the flattest equivalent form first");
        expect(source).toContain("Before I keep an `O.match(...)`");
        expect(source).toContain(
          "Before keeping `O.match(...)`, check whether `O.map(...)`, `O.flatMap(...)`, `O.liftPredicate(...)`, and `O.getOrElse(...)` express the same control flow more flatly."
        );
        expect(source).toContain("R.getSomes({...})");
        expect(source).toContain("O.all({...})");
        expect(source).toContain("S.OptionFrom*");
        expect(source).toContain("onNone: () => ({})");
        expect(Str.contains(source, "Prefer `effect/Boolean` `Bool.match(...)` over `Match.when(true/false)`.")).toBe(
          false
        );
      })
    );
  });
});
