import { CyclicDependencyError, DomainError, NoSuchFileError } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

describe("Error types", () => {
  describe("NoSuchFileError", () => {
    it.effect("should create with path and message", () =>
      Effect.sync(() => {
        const error = NoSuchFileError.make({
          path: "/some/missing/file.ts",
          message: "File not found",
        });
        expect(error._tag).toBe("NoSuchFileError");
        expect(error.path).toBe("/some/missing/file.ts");
        expect(error.message).toBe("File not found");
      })
    );

    it.effect(
      "should be catchable by tag in Effect",
      Effect.fn(function* () {
        const result = yield* Effect.fail(NoSuchFileError.make({ path: "/missing", message: "not found" })).pipe(
          Effect.catchTag("NoSuchFileError", (e) => Effect.succeed(`caught: ${e.path}`))
        );
        expect(result).toBe("caught: /missing");
      })
    );
  });

  describe("DomainError", () => {
    it.effect("should create with message only", () =>
      Effect.sync(() => {
        const error = DomainError.make({ message: "Something failed" });
        expect(error._tag).toBe("DomainError");
        expect(error.message).toBe("Something failed");
        expect(error.cause).toBeUndefined();
      })
    );

    it.effect("should create with message and cause", () =>
      Effect.sync(() => {
        const underlying = new Error("root cause");
        const error = DomainError.make({
          message: "Wrapper error",
          cause: underlying,
        });
        expect(error._tag).toBe("DomainError");
        expect(error.message).toBe("Wrapper error");
        expect(error.cause).toBe(underlying);
      })
    );

    it.effect(
      "should be catchable by tag in Effect",
      Effect.fn(function* () {
        const result = yield* Effect.fail(DomainError.make({ message: "domain fail" })).pipe(
          Effect.catchTag("DomainError", (e) => Effect.succeed(`caught: ${e.message}`))
        );
        expect(result).toBe("caught: domain fail");
      })
    );
  });

  describe("CyclicDependencyError", () => {
    it.effect("should create with message and cycles", () =>
      Effect.sync(() => {
        const error = CyclicDependencyError.make({
          message: "Cyclic dependencies detected",
          cycles: [["@beep/a", "@beep/b", "@beep/a"]],
        });
        expect(error._tag).toBe("CyclicDependencyError");
        expect(error.message).toBe("Cyclic dependencies detected");
        expect(error.cycles).toEqual([["@beep/a", "@beep/b", "@beep/a"]]);
      })
    );

    it.effect("should support multiple cycles", () =>
      Effect.sync(() => {
        const error = CyclicDependencyError.make({
          message: "Multiple cycles",
          cycles: [
            ["@beep/a", "@beep/b", "@beep/a"],
            ["@beep/c", "@beep/d", "@beep/e", "@beep/c"],
          ],
        });
        expect(error.cycles).toHaveLength(2);
      })
    );

    it.effect(
      "should be catchable by tag in Effect",
      Effect.fn(function* () {
        const result = yield* Effect.fail(
          CyclicDependencyError.make({
            message: "cycle",
            cycles: [["a", "b", "a"]],
          })
        ).pipe(Effect.catchTag("CyclicDependencyError", (e) => Effect.succeed(`caught ${e.cycles.length} cycle(s)`)));
        expect(result).toBe("caught 1 cycle(s)");
      })
    );
  });
});
