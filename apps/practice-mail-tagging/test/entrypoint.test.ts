/**
 * The process boundary: a program runs only when its module is the process
 * entrypoint, and importing the executable starts nothing.
 */

import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";
import { makeRunEntrypoint, runEntrypoint } from "@/entrypoint";
import type { RunMain } from "@/entrypoint";

const capturing = () => {
  const started = { programs: A.empty<unknown>() };
  const run: RunMain = (effect) => {
    started.programs = A.append(started.programs, effect);
  };
  return { started, run };
};

describe("runEntrypoint", () => {
  it("hands the provided program to the runner when the module is the entrypoint", () => {
    const { started, run } = capturing();

    makeRunEntrypoint(run)({ isMain: true, program: Effect.void });

    expect(started.programs).toHaveLength(1);
    expect(A.every(started.programs, Effect.isEffect)).toBe(true);
  });

  it("starts nothing when the module was imported", () => {
    const { started, run } = capturing();

    makeRunEntrypoint(run)({ isMain: false, program: Effect.void });
    runEntrypoint({ isMain: false, program: Effect.void });

    expect(started.programs).toHaveLength(0);
  });

  it.effect("importing the executable defines the command line and runs nothing", () =>
    Effect.gen(function* () {
      const bin = yield* Effect.promise(() => import("@/bin"));

      expect(R.keys(bin)).toEqual([]);
    })
  );
});
