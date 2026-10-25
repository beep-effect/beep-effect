import { GlobSet } from "@beep/glob/GlobSet";
import { InvalidPattern } from "@beep/glob/internal/assertValidPattern";
import { Minimatch } from "@beep/glob/internal/minimatch";
import { it, vi } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";

it.effect("GlobSet schema construction preserves unexpected engine defects", () =>
  Effect.gen(function* () {
    const defect = InvalidPattern.make({ message: "engine wiring defect" });
    const spy = vi.spyOn(Minimatch.prototype, "make").mockImplementationOnce(() => {
      throw defect;
    });
    try {
      assertExitFailure(
        yield* Effect.exit(Effect.sync(() => GlobSet.make({ patterns: ["valid"] }))),
        Cause.die(new Error("Constructor adapter can only throw schema issues", { cause: Cause.die(defect) }))
      );
    } finally {
      spy.mockRestore();
    }
  })
);

it.effect("GlobSet compileResult preserves unexpected engine defects", () =>
  Effect.gen(function* () {
    const defect = InvalidPattern.make({ message: "engine wiring defect" });
    const spy = vi.spyOn(Minimatch.prototype, "make").mockImplementationOnce(() => {
      throw defect;
    });
    try {
      assertExitFailure(yield* Effect.exit(Effect.sync(() => GlobSet.compileResult(["valid"]))), Cause.die(defect));
    } finally {
      spy.mockRestore();
    }
  })
);
