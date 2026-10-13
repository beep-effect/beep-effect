import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { TomlLocalDate } from "../../effected/toml/TomlDateTime.ts";
it.effect("month validation precedes calendar lookup and Gregorian century rules hold", () => Effect.gen(function* () {
  for (const month of [0, 13]) {
    const result = yield* S.decodeEffect(TomlLocalDate)({ year: 2024, month, day: 1 }).pipe(Effect.flip);
    assert.include(result.message, "month");
  }
  assert.strictEqual(TomlLocalDate.make({ year: 2000, month: 2, day: 29 }).toString(), "2000-02-29");
  const century = yield* S.decodeEffect(TomlLocalDate)({ year: 1900, month: 2, day: 29 }).pipe(Effect.flip);
  assert.include(century.message, "day");
}));
