import {
  AlchemyPostgresConfig,
  AlchemyPostgresError,
  AlchemyPostgresOperation,
  ProvenanceMapping,
  ProvenanceMappings,
} from "@beep/alchemy-postgres";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

describe("AlchemyPostgresConfig", () => {
  it.effect("fills constructor defaults", () =>
    Effect.sync(() => {
      const config = AlchemyPostgresConfig.make({});
      expect(config.tablePrefix).toBe("alchemy_");
      expect(config.pollMillis).toBe(250);
      expect(config.deliveryBatchSize).toBe(100);
      expect(config.leaseMillis).toBe(30_000);
      assertNone(config.provenance);
      expect(config.provenanceMappings).toEqual([]);
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

describe("provenance mappings", () => {
  const actor = { contextKey: "Documents/CurrentActor", principalField: "principal", sourceKindField: "sourceKind" };
  const session = {
    contextKey: "Session/RequestContext",
    principalField: "principalKey",
    sourceKindField: "sourceKind",
  };

  it.effect("decodes one mapping per distinct context key", () =>
    Effect.sync(() => {
      const decoded = S.decodeResult(ProvenanceMappings)([actor, session]);
      pipe(decoded, Result.isSuccess, assertTrue);
    })
  );

  it.effect("rejects two mappings for the same context key", () =>
    Effect.sync(() => {
      const decoded = S.decodeResult(ProvenanceMappings)([actor, { ...session, contextKey: actor.contextKey }]);
      pipe(decoded, Result.isFailure, assertTrue);
    })
  );

  it.effect("rejects a config whose single mapping repeats a listed context key", () =>
    Effect.sync(() => {
      const mapping = ProvenanceMapping.make(actor);
      expect(() =>
        AlchemyPostgresConfig.make({ provenance: O.some(mapping), provenanceMappings: [mapping] })
      ).toThrow();
      const config = AlchemyPostgresConfig.make({
        provenance: O.some(mapping),
        provenanceMappings: [ProvenanceMapping.make(session)],
      });
      expect(config.provenanceMappings.length).toBe(1);
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
