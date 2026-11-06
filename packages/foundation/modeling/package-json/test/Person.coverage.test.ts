import { Person } from "@beep/package-json/Person";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

describe("hand-built person encoding", () => {
  it.effect("includes a URL when no remembered object is available", () =>
    Effect.gen(function* () {
      const value = Person.make({ name: "Ada", url: "https://ada.dev" });
      const value1 = yield* S.encodeEffect(Person.schema)(value);
      assert.deepStrictEqual(value1, { name: "Ada", url: "https://ada.dev" });
    })
  );
});
