import { RULE_NAMES, RULES } from "@beep/lint-rules";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { LinterProcessError, validateLinterProcess } from "./codec.ts";
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

describe("native linter process outcomes", () => {
  for (const exitCode of [0, 1]) {
    it.effect(`accepts lint exit ${exitCode} with stderr`, () =>
      Effect.gen(function* () {
        const result = yield* Effect.sync(() =>
          Bun.spawnSync([
            "bun",
            "-e",
            `process.stdout.write("{}"); process.stderr.write("warning"); process.exit(${exitCode})`,
          ])
        );
        const accepted = yield* validateLinterProcess(result);
        expect(accepted.exitCode).toBe(exitCode);
        expect(accepted.stderr.toString()).toBe("warning");
      })
    );
  }

  it.effect("retains abnormal exit status and both diagnostic streams", () =>
    Effect.gen(function* () {
      const result = yield* Effect.sync(() =>
        Bun.spawnSync([
          "bun",
          "-e",
          'process.stdout.write("partial report"); process.stderr.write("invalid configuration"); process.exit(2)',
        ])
      );
      assertFailure(
        yield* Effect.result(validateLinterProcess(result)),
        LinterProcessError.make({
          exitCode: 2,
          stdout: "partial report",
          stderr: "invalid configuration",
          signal: O.none(),
          timedOut: false,
          outputTruncated: false,
        })
      );
    })
  );

  for (const { name, ...termination } of [
    { name: "timeout", exitedDueToTimeout: true },
    { name: "buffer limit", exitedDueToMaxBuffer: true },
    { name: "signal", signalCode: "SIGTERM" },
  ]) {
    it.effect(`rejects interrupted output ${name}`, () =>
      Effect.gen(function* () {
        const result = yield* Effect.sync(() => Bun.spawnSync(["bun", "-e", 'process.stdout.write("{}");']));
        const interrupted = { ...result, ...termination };
        assertFailure(
          yield* Effect.result(validateLinterProcess(interrupted)),
          LinterProcessError.make({
            exitCode: 0,
            stdout: "{}",
            stderr: "",
            signal: O.fromNullishOr(interrupted.signalCode),
            timedOut: name === "timeout",
            outputTruncated: name === "buffer limit",
          })
        );
      })
    );
  }
});

it.effect("bounds abnormal subprocess stream diagnostics", () =>
  Effect.gen(function* () {
    const result = yield* Effect.sync(() =>
      Bun.spawnSync([
        "bun",
        "-e",
        'process.stdout.write("x".repeat(5000)); process.stderr.write("y".repeat(5000)); process.exit(2)',
      ])
    );
    assertFailure(
      yield* Effect.result(validateLinterProcess(result)),
      LinterProcessError.make({
        exitCode: 2,
        stdout: Str.repeat(4096)("x"),
        stderr: Str.repeat(4096)("y"),
        signal: O.none(),
        timedOut: false,
        outputTruncated: false,
      })
    );
  })
);
