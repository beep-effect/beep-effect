import { it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import { GlobSet } from "../../effected/glob/GlobSet.ts";
import { InvalidPattern } from "../../effected/glob/internal/assertValidPattern.ts";
import { Minimatch } from "../../effected/glob/internal/minimatch.ts";

it.effect("GlobSet schema construction preserves unexpected engine defects", () => Effect.gen(function* () {
  const defect = InvalidPattern.make({ message: "engine wiring defect" });
  const spy = vi.spyOn(Minimatch.prototype, "make").mockImplementationOnce(() => { throw defect; });
  try {
    assertExitFailure(yield* Effect.exit(Effect.sync(() => GlobSet.make({ patterns: ["valid"] }))), Cause.die(defect));
  } finally {
    spy.mockRestore();
  }
}));

it.effect("GlobSet compileResult preserves unexpected engine defects", () => Effect.gen(function* () {
  const defect = InvalidPattern.make({ message: "engine wiring defect" });
  const spy = vi.spyOn(Minimatch.prototype, "make").mockImplementationOnce(() => { throw defect; });
  try {
    assertExitFailure(yield* Effect.exit(Effect.sync(() => GlobSet.compileResult(["valid"]))), Cause.die(defect));
  } finally {
    spy.mockRestore();
  }
}));
