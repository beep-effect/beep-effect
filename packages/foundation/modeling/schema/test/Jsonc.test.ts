import { $SchemaId } from "@beep/identity";
import { decodeJsoncTextAs, JsoncTextToUnknown } from "@beep/schema/Jsonc";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Cause, Effect, Exit, pipe } from "effect";
import * as S from "effect/Schema";

const decodeJsoncTextToUnknown = S.decodeEffect(JsoncTextToUnknown);
const encodeJsoncTextToUnknown = S.encodeEffect(JsoncTextToUnknown);

const $I = $SchemaId.create("jsonc_test");

class JsoncPerson extends S.Class<JsoncPerson>($I`JsoncPerson`)(
  {
    name: S.String,
    age: S.Finite,
  },
  $I.annote("JsoncPerson", {
    description: "Typed JSONC person fixture used in schema tests.",
  })
) {}

describe("Jsonc", () => {
  it.effect(
    "decodes JSONC text with comments and trailing commas into typed schema values",
    Effect.fnUntraced(function* () {
      const person = yield* decodeJsoncTextAs(JsoncPerson)(`{
        // comment
        "name": "Ada",
        "age": 36,
      }`);

      expect(person).toBeInstanceOf(JsoncPerson);
      expect(person.name).toBe("Ada");
      expect(person.age).toBe(36);
    })
  );

  it.effect(
    "maps invalid JSONC into SchemaIssue.InvalidValue",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(decodeJsoncTextToUnknown(`{ "name": }`));

      pipe(result, Exit.isFailure, assertTrue);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(rendered).toContain("Invalid JSONC input");
        expect(rendered).toContain("ValueExpected");
      }
    })
  );

  it.effect(
    "fails to encode unknown values back into JSONC text",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        encodeJsoncTextToUnknown({
          name: "Ada",
        })
      );

      pipe(result, Exit.isFailure, assertTrue);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(rendered).toContain("Encoding unknown values to JSONC text is not supported");
      }
    })
  );
});
