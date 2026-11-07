import {
  AlchemyPostgresConfig,
  AlchemyPostgresError,
  AlchemyPostgresOperation,
  AlchemyPostgresUnsupported,
  ProvenanceMapping,
} from "@beep/alchemy-postgres";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("AlchemyPostgresConfig", () => {
  it.effect("fills constructor defaults", () =>
    Effect.sync(() => {
      const config = AlchemyPostgresConfig.make({});
      expect(config.tablePrefix).toBe("alchemy_");
      expect(config.pollMillis).toBe(250);
      expect(config.deliveryBatchSize).toBe(100);
      assertNone(config.provenance);
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
      const cause = new Error("deadlock detected");
      const error = AlchemyPostgresError.fromUnknown("commit", cause, "alchemy_aggregate_event");
      expect(error._tag).toBe("AlchemyPostgresError");
      expect(AlchemyPostgresOperation.is.commit(error.operation)).toBe(true);
      expect(O.getOrThrow(error.table)).toBe("alchemy_aggregate_event");
      expect(O.getOrThrow(error.message)).toBe("deadlock detected");
      assertSome(error.cause, cause);
    })
  );

  it.effect("leaves message and cause empty for a non-error cause", () =>
    Effect.sync(() => {
      const error = AlchemyPostgresError.fromUnknown("listen");
      assertNone(error.table);
      assertNone(error.message);
    })
  );
});

describe("AlchemyPostgresUnsupported", () => {
  it.effect("names the concept, the definition and when support lands", () =>
    Effect.sync(() => {
      const error = AlchemyPostgresUnsupported.make({ concept: "view", definition: "Statement" });
      expect(error._tag).toBe("AlchemyPostgresUnsupported");
      expect(error.message).toBe(
        "view Statement cannot be hosted: @beep/alchemy-postgres does not support views until PR 2b"
      );
    })
  );
});
