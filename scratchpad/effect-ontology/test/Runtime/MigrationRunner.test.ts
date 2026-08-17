import { PosInt } from "@beep/schema/Int";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import {
  AllMigrations,
  Migration,
  MigrationResult,
} from "../../Runtime/Persistence/MigrationRunner.ts";

describe("MigrationRunner schemas", () => {
  it.effect("rejects non-positive migration versions", () =>
    Effect.gen(function* () {
      const error = yield* S.decodeEffect(Migration)({ version: 0, name: "invalid", sql: "SELECT 1" }).pipe(
        Effect.flip
      );

      assert.isTrue(S.isSchemaError(error));
    })
  );

  it.effect("constructs validated migration summaries", () =>
    Effect.sync(() => {
      const migration = Migration.make({
        version: PosInt.make(11),
        name: "011_example",
        sql: "SELECT 1",
      });
      const result = MigrationResult.make({ applied: [migration], skipped: [], errors: [] });

      assert.strictEqual(result.applied.length, 1);
      assert.strictEqual(AllMigrations.length, 10);
    })
  );
});
