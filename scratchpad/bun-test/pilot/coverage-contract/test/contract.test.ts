import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { choose, fallback, guardedCharacters } from "../src/Branches.ts";

it.effect("executes only the selected branches", () => Effect.sync(() => {
  expect(choose(true)).toBe(1);
  expect(guardedCharacters("abc")).toBe("abc");
  expect(fallback("provided")).toBe("provided");
}));
