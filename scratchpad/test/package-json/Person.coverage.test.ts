import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Person } from "../../effected/package-json/Person.ts";
describe("hand-built person encoding", () => {
  it.effect("includes a URL when no remembered object is available", () => Effect.gen(function* () {
    const value = Person.make({ name: "Ada", url: "https://ada.dev" });
    assert.deepStrictEqual(yield* S.encodeEffect(Person.schema)(value), { name: "Ada", url: "https://ada.dev" });
  }));
});
