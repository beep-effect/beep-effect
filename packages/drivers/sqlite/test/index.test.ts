import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";

// `@beep/sqlite` re-exports `@effect/sql-sqlite-bun`, which imports
// `bun:sqlite`, so the entry point only resolves under the Bun runtime.
const isBunRuntime = P.isNotUndefined(process.versions.bun);

describe.skipIf(!isBunRuntime)("@beep/sqlite", () => {
  it.effect("resolves the package entry point through its alias", () =>
    Effect.promise(() => import("@beep/sqlite")).pipe(
      Effect.map((Package) => {
        expect(Package).toBeTypeOf("object");
      })
    )
  );
});
