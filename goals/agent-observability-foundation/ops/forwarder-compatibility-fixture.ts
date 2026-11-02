/** Synthetic file-local rollback proof; never use a real forwarder database. */
import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { AiMetricsForwarderInput, runAiMetricsForwarder } from "@beep/repo-ai-metrics/forwarder";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";

const root = process.argv[2];
const previousModulePath = process.argv[3];
if (!root || !root.includes("forwarder-compatibility-")) throw new Error("Owned synthetic root required");
if (!previousModulePath) throw new Error("Previous forwarder module required");
const old = S.decodeUnknownSync(
  S.Struct({
    AiMetricsForwarderInput: S.declare<typeof AiMetricsForwarderInput>(
      (value): value is typeof AiMetricsForwarderInput => P.hasProperty(value, "make") && P.isFunction(value.make)
    ),
    runAiMetricsForwarder: S.declare<typeof runAiMetricsForwarder>((value): value is typeof runAiMetricsForwarder =>
      P.isFunction(value)
    ),
  })
)(await import(previousModulePath));
const fields = AiMetricsForwarderInput.make({
  homeDir: `${root}/home`,
  repoRoot: `${root}/repo`,
  dataRoot: O.some(`${root}/data`),
  codexSessionsRoot: O.some(`${root}/home/.codex/sessions`),
  claudeProjectsRoot: O.some(`${root}/missing`),
  hashSalt: O.some("synthetic-rollback-salt"),
  rawArchiveKey: Redacted.make(Base64.encode(new Uint8Array(32).fill(9))),
  includeAll: true,
  maxFiles: 1,
  parquetExportMode: "none",
  target: "local",
});
const countRow = S.Tuple([S.Struct({ n: S.Int.check(S.isGreaterThanOrEqualTo(0)) })]);
const db = DuckDb.makeNodeLayer(
  DuckDbConnectionOptions.make({ databasePath: `${root}/data/derived/ai-metrics.duckdb` })
);
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const first = yield* runAiMetricsForwarder(AiMetricsForwarderInput.make(fields));
    const database = yield* DuckDb;
    const before = yield* database.query(
      "SELECT scope_id,cursor_hash FROM ai_metrics_discovery_cursors ORDER BY scope_id"
    );
    const records = yield* S.decodeUnknownEffect(countRow)(
      yield* database.query("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM ai_metrics_source_files")
    );
    const previous = yield* old.runAiMetricsForwarder(old.AiMetricsForwarderInput.make(fields));
    const after = yield* database.query(
      "SELECT scope_id,cursor_hash FROM ai_metrics_discovery_cursors ORDER BY scope_id"
    );
    const retained = yield* S.decodeUnknownEffect(countRow)(
      yield* database.query("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM ai_metrics_source_files")
    );
    if (
      first.sourceFileCount !== 1 ||
      previous.sourceFileCount !== 1 ||
      before.length === 0 ||
      JSON.stringify(before) !== JSON.stringify(after) ||
      retained[0].n < records[0].n
    )
      throw new Error("Compatibility assertions failed");
    return {
      result: "passed",
      currentSelected: first.sourceFileCount,
      previousSelected: previous.sourceFileCount,
      cursorRows: before.length,
      oldImplementationPreservedCursorTable: true,
      sourceRowsBefore: records[0].n,
      sourceRowsAfter: retained[0].n,
      realSourcesRead: false,
      historicalDatabaseOpened: false,
      servicesChanged: false,
    };
  }).pipe(
    Effect.provide(db),
    Effect.provide(Layer.merge(NodeServices.layer, NodeCrypto.layer)),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown({ BEEP_AGENT_EVIDENCE_ROOT: `${root}/hooks`, XDG_STATE_HOME: `${root}/state` })
    ),
    Effect.scoped
  )
);
console.log(JSON.stringify(result));
