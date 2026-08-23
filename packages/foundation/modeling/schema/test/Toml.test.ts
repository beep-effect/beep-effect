import { $SchemaId } from "@beep/identity";
import { decodeTomlTextAs, TomlTextToUnknown } from "@beep/schema/Toml";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("toml_test");

class TomlDatabase extends S.Class<TomlDatabase>($I`TomlDatabase`)(
  {
    host: S.String,
    port: S.Finite,
  },
  $I.annote("TomlDatabase", {
    description: "Nested TOML database configuration fixture used in schema tests.",
  })
) {}

class TomlConfig extends S.Class<TomlConfig>($I`TomlConfig`)(
  {
    title: S.String,
    database: TomlDatabase,
  },
  $I.annote("TomlConfig", {
    description: "Typed TOML configuration fixture used in schema tests.",
  })
) {}

describe("Toml", () => {
  it.effect(
    "decodes TOML text into typed schema values",
    Effect.fnUntraced(function* () {
      const config = yield* decodeTomlTextAs(TomlConfig)(`title = "beep"

[database]
host = "localhost"
port = 5432
`);

      expect(config).toBeInstanceOf(TomlConfig);
      expect(config.title).toBe("beep");
      expect(config.database).toBeInstanceOf(TomlDatabase);
      expect(config.database.port).toBe(5432);
    })
  );

  it.effect(
    "maps invalid TOML into SchemaIssue.InvalidValue",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(S.decodeEffect(TomlTextToUnknown)("invalid = = ="));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(rendered).toContain("Invalid TOML input");
      }
    })
  );

  it.effect(
    "fails to encode unknown values back into TOML text",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        S.encodeEffect(TomlTextToUnknown)({
          title: "beep",
        })
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(rendered).toContain("Encoding unknown values to TOML text is not supported");
      }
    })
  );
});
