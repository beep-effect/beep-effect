import { RULE_NAMES, RULES } from "@beep/lint-rules";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { runRule } from "./harness.ts";
import { SOURCES } from "./sources.ts";

describe("GritQL rules", () => {
  for (const rule of RULE_NAMES) {
    const { invalid, invalidCount, valid, messageIncludes } = SOURCES[rule];
    // Rules ship advisory: severity matches the registry value ("warn" -> "warning").
    const expectedSeverity = RULES[rule].severity === "error" ? "error" : "warning";

    describe(rule, () => {
      it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) =>
        it.effect("flags the invalid source", () =>
          Effect.gen(function* () {
            const { diagnostics } = yield* runRule(rule, invalid);
            expect(diagnostics.length).toBe(invalidCount);
            expect(diagnostics.every((d) => d.message.includes(messageIncludes))).toBe(true);
            expect(diagnostics.every((d) => d.severity === expectedSeverity)).toBe(true);
          })
        )
      );

      it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) =>
        it.effect("ignores the valid source", () =>
          Effect.gen(function* () {
            const { diagnostics } = yield* runRule(rule, valid);
            expect(diagnostics.length).toBe(0);
          })
        )
      );
    });
  }
});
