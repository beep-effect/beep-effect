/** Standalone read-only retention report entrypoint. */
import { RetentionPolicy, RetentionQuery } from "@beep/epistemic-domain/values/Retention";
import { RetentionAuthorityReaderDrizzle, rebuildRetentionStore } from "@beep/epistemic-server/Retention";
import { RetentionCalibrationRegistry, RetentionUnavailable } from "@beep/epistemic-use-cases/Retention";
import { makeDrizzleLayer } from "@beep/postgres";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as PgClient from "@effect/sql-pg/PgClient";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const ArgumentPaths = S.Struct({
  query: S.NonEmptyString,
  store: S.NonEmptyString,
  policy: S.OptionFromNullOr(S.NonEmptyString),
});
const database = PgClient.layerFrom(
  Effect.gen(function* () {
    const url = yield* Config.Redacted("BEEP_RETENTION_DATABASE_URL");
    return yield* PgClient.make({ url, maxConnections: 1 });
  })
);
const authority = RetentionAuthorityReaderDrizzle.pipe(Layer.provide(makeDrizzleLayer()), Layer.provide(database));
const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const args = yield* S.decodeUnknownEffect(ArgumentPaths)({
    query: process.argv[2],
    store: process.argv[3],
    policy: process.argv[4] ?? null,
  }).pipe(
    Effect.mapError(() =>
      RetentionUnavailable.make({
        operation: "arguments",
        message: "Usage: retention-report.ts <query.json> <dedicated-store-directory> [policy.json]",
      })
    )
  );
  const query = yield* S.decodeEffect(S.fromJsonString(RetentionQuery))(yield* fs.readFileString(args.query));
  const policy = yield* O.match(args.policy, {
    onNone: () => Effect.succeedNone,
    onSome: Effect.fn("RetentionCLI.readPolicy")(function* (file) {
      return O.some(yield* S.decodeEffect(S.fromJsonString(RetentionPolicy))(yield* fs.readFileString(file)));
    }),
  });
  const context = yield* Layer.build(authority);
  const report = yield* rebuildRetentionStore(args.store, query, policy).pipe(Effect.provideContext(context));
  yield* Console.log(
    `Wrote report.json and report.txt; ${report.visibleCount} visible edges; policy ${report.admission.state}.`
  );
}).pipe(
  Layer.effectDiscard,
  Layer.provide(Layer.merge(RetentionCalibrationRegistry.inert, NodeServices.layer)),
  Layer.build,
  Effect.scoped
);
NodeRuntime.runMain(main);
