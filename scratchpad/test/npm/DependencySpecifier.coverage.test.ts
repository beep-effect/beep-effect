import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { InvalidDependencySpecifierError } from "../../effected/npm/DependencySpecifier.ts";

it.effect("the rejected specifier is identified in its error message", () => Effect.sync(() => {
  assert.strictEqual(InvalidDependencySpecifierError.make({ input: "bad input" }).message,
    'Invalid dependency specifier "bad input": not a recognized specifier');
}));
