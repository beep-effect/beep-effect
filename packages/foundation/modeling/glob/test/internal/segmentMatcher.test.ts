import { Minimatch } from "@beep/glob/internal/minimatch";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { legacyOracle } from "../legacyOracle.ts";

it.effect("repeated segments preserve contextual dots, negation tails, optional branches and Unicode classes", () =>
  Effect.sync(() => {
    for (const [suite, pattern, candidate, options, expected] of legacyOracle.matches) {
      if (suite === "repeated-segments")
        assert.strictEqual(
          new Minimatch(pattern, options).match(candidate),
          expected,
          `${pattern}, ${candidate}, dot=${options.dot}, nocase=${options.nocase}`
        );
    }
  })
);
