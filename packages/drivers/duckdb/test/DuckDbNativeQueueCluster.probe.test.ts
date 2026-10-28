import { DuckDbTestLayer } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { assert } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as SqlMessageStorage from "effect/cluster/SqlMessageStorage";
import * as SqlRunnerStorage from "effect/cluster/SqlRunnerStorage";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as PersistedQueue from "effect/persistence/PersistedQueue";
import type * as Crypto from "effect/Crypto";
import type * as Scope from "effect/Scope";
import type * as SqlClient from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";

const nativeMessage = (value: unknown): string => {
  if (P.hasProperty(value, "reason")) return nativeMessage(value.reason);
  if (P.hasProperty(value, "cause") && value.cause !== undefined) return nativeMessage(value.cause);
  return P.hasProperty(value, "message") && P.isString(value.message) ? value.message : "missing native error";
};
const probes: ReadonlyArray<
  readonly [
    string,
    Effect.Effect<void, SqlError, Crypto.Crypto | Scope.Scope | SqlClient.SqlClient | ShardingConfig.ShardingConfig>,
  ]
> = [
  ["queue", PersistedQueue.makeStoreSql().pipe(Effect.asVoid)],
  ["message", SqlMessageStorage.makeEncoded().pipe(Effect.asVoid)],
  ["runner", SqlRunnerStorage.make({}).pipe(Effect.asVoid)],
];
it.layer(Layer.mergeAll(DuckDbTestLayer, ShardingConfig.layerDefaults, NodeCrypto.layer), { timeout: "30 seconds" })(
  (it) => {
    for (const [name, program] of probes) {
      it.effect(`unchanged upstream ${name} probe`, () =>
        Effect.gen(function* () {
          const exit = yield* program.pipe(Effect.exit);
          if (Exit.isFailure(exit)) {
            assert.include(exit.cause.pipe(Cause.squash, nativeMessage), "AUTOINCREMENT");
          }
          assert.strictEqual(Exit.isFailure(exit), name !== "message");
        })
      );
    }

    it.effect("unchanged message storage fails to save a current 64-bit id", () =>
      Effect.gen(function* () {
        const storage = yield* SqlMessageStorage.makeEncoded();
        const exit = yield* storage
          .saveEnvelope({
            envelope: {
              _tag: "Request",
              requestId: "9007199254740993",
              address: { shardId: { group: "default", id: 1 }, entityType: "Probe", entityId: "probe" },
              tag: "probe",
              payload: null,
              headers: {},
            },
            primaryKey: null,
            deliverAt: 1793131200123,
          })
          .pipe(Effect.exit);
        assert.include(
          Exit.match(exit, { onSuccess: () => "unexpected success", onFailure: flow(Cause.squash, nativeMessage) }),
          "INT32"
        );
      })
    );
  }
);
