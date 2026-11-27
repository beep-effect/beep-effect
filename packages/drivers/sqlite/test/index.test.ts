import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";

const isBunRuntime = P.isNotUndefined(process.versions.bun);

describe.skipIf(!isBunRuntime)("@beep/sqlite (bun:sqlite entry point, Bun runtime only)", () => {
  it.effect("resolves the package entry point through its alias", () =>
    Effect.promise(() => import("@beep/sqlite")).pipe(
      Effect.map((Package) => {
        expect(Package).toBeTypeOf("object");
      })
    )
  );
});
