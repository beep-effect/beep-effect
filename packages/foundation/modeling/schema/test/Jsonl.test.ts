import { $SchemaId } from "@beep/identity";
import { decodeJsonlTextAs, JsonlTextToUnknown } from "@beep/schema/Jsonl";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("jsonl_test");

class JsonlPerson extends S.Class<JsonlPerson>($I`JsonlPerson`)(
  {
    name: S.String,
    age: S.Finite,
  },
  $I.annote("JsonlPerson", {
    description: "Typed JSONL person fixture used in schema tests.",
  })
) {}

describe("Jsonl", () => {
  it.effect(
    "decodes JSONL text into typed schema values",
    Effect.fnUntraced(function* () {
      const people = yield* decodeJsonlTextAs(S.Array(JsonlPerson))(`{"name":"Ada","age":36}
{"name":"Grace","age":85}
`);

      expect(people).toHaveLength(2);
      expect(people[0]).toBeInstanceOf(JsonlPerson);
      expect(people[0].name).toBe("Ada");
      expect(people[1].age).toBe(85);
    })
  );

  it.effect(
    "rejects malformed trailing lines instead of returning a parsed prefix",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        S.decodeEffect(JsonlTextToUnknown)(`{"name":"Ada","age":36}
{invalid}
`)
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(rendered).toContain("Invalid JSONL input");
        expect(rendered).toContain("Failed to parse JSONL");
      }
    })
  );

  it.effect(
    "fails to encode unknown values back into JSONL text",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        S.encodeEffect(JsonlTextToUnknown)([
          {
            name: "Ada",
          },
        ])
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(rendered).toContain("Encoding unknown values to JSONL text is not supported");
      }
    })
  );
});
