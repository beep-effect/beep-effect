import { $SchemaId } from "@beep/identity";
import { makeParseYaml, makeParseYamlForSchema } from "@beep/schema/test/Yaml";
import { decodeYamlTextAs, parseYaml, YamlTextToUnknown } from "@beep/schema/Yaml";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Result } from "effect";
import * as S from "effect/Schema";
import * as yaml from "yaml";

const $I = $SchemaId.create("yaml_test");

class YamlPerson extends S.Class<YamlPerson>($I`YamlPerson`)(
  {
    name: S.String,
    age: S.Finite,
  },
  $I.annote("YamlPerson", {
    description: "Typed YAML person fixture used in schema tests.",
  })
) {}

describe("Yaml", () => {
  it("parses YAML text with the public parseYaml helper", () => {
    expect(parseYaml("name: Ada\nskills:\n  - Effect\n  - Bun")).toEqual({
      name: "Ada",
      skills: ["Effect", "Bun"],
    });
  });

  it("prefers the Bun runtime parser when one is provided", () => {
    const parseWithBun = makeParseYaml(
      {
        Bun: {
          YAML: {
            parse: (input) => ({
              parser: "bun",
              input,
            }),
          },
        },
      },
      () => yaml
    );

    expect(parseWithBun("name: Ada")).toEqual({
      parser: "bun",
      input: "name: Ada",
    });
  });

  it("falls back to the yaml package when Bun is unavailable", () => {
    const parseWithoutBun = makeParseYaml({}, () => yaml);

    expect(parseWithoutBun("name: Ada\nage: 36")).toEqual({
      name: "Ada",
      age: 36,
    });
  });

  it("reports fallback parse diagnostics through the internal schema parser seam", () => {
    const parseWithoutBun = makeParseYamlForSchema({}, () => yaml);
    const result = parseWithoutBun("name: [Ada");

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.join("; ")).toContain("Flow sequence in block collection");
    }
  });

  it.effect(
    "decodes YAML text into typed schema values",
    Effect.fnUntraced(function* () {
      const person = yield* decodeYamlTextAs(YamlPerson)("name: Ada\nage: 36");

      expect(person).toBeInstanceOf(YamlPerson);
      expect(person.name).toBe("Ada");
      expect(person.age).toBe(36);
    })
  );

  it.effect(
    "maps invalid YAML into SchemaIssue.InvalidValue",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(S.decodeEffect(YamlTextToUnknown)("name: [Ada"));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(/Invalid YAML input|YAML Parse error/.test(rendered)).toBe(true);
      }
    })
  );

  it.effect(
    "fails to encode unknown values back into YAML text",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        S.encodeEffect(YamlTextToUnknown)({
          name: "Ada",
        })
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(rendered).toContain("Encoding unknown values to YAML text is not supported");
      }
    })
  );
});
