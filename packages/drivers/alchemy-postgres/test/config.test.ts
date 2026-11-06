import {
  AlchemyPostgresConfig,
  AlchemyPostgresError,
  AlchemyPostgresOperation,
  ProvenanceMapping,
} from "@beep/alchemy-postgres";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("AlchemyPostgresConfig", () => {
  it.effect("fills constructor defaults", () =>
    Effect.sync(() => {
      const config = AlchemyPostgresConfig.make({});
      expect(config.tablePrefix).toBe("alchemy_");
      expect(config.pollMillis).toBe(250);
      expect(config.deliveryBatchSize).toBe(100);
      expect(O.isNone(config.provenance)).toBe(true);
    })
  );

  it.effect("keeps an explicit provenance mapping", () =>
    Effect.sync(() => {
      const mapping = ProvenanceMapping.make({
        contextKey: "Documents/CurrentActor",
        principalField: "principal",
        sourceKindField: "sourceKind",
      });
      const config = AlchemyPostgresConfig.make({ tablePrefix: "vault_", provenance: O.some(mapping) });
      expect(config.tablePrefix).toBe("vault_");
      expect(O.getOrThrow(config.provenance).contextKey).toBe("Documents/CurrentActor");
    })
  );
});

describe("AlchemyPostgresError", () => {
  it.effect("wraps an unknown cause with its operation and table", () =>
    Effect.sync(() => {
      const error = AlchemyPostgresError.fromUnknown(
        "commit",
        new Error("deadlock detected"),
        "alchemy_aggregate_event"
      );
      expect(error._tag).toBe("AlchemyPostgresError");
      expect(AlchemyPostgresOperation.is.commit(error.operation)).toBe(true);
      expect(O.getOrThrow(error.table)).toBe("alchemy_aggregate_event");
      expect(O.getOrThrow(error.message)).toBe("deadlock detected");
      expect(O.isSome(error.cause)).toBe(true);
    })
  );

  it.effect("leaves message and cause empty for a non-error cause", () =>
    Effect.sync(() => {
      const error = AlchemyPostgresError.fromUnknown("listen");
      expect(O.isNone(error.table)).toBe(true);
      expect(O.isNone(error.message)).toBe(true);
    })
  );
});
