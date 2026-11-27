import { GateReport, Totals, Unit } from "@beep/gate-report/GateReport";
import { HistoryConfig } from "@beep/gate-report/History";
import { Item } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { HistoryScope } from "@beep/repo-gate-run/GateHistoryRecord";
import { GateHistorySqliteOptions, layerSqlite } from "@beep/repo-gate-run/GateHistorySqlite";
import { GateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const RUNS = 25;
const typedHistoryErrorExit = 2;
const [filename = "", writer = "0"] = process.argv.slice(2);

const report = (run: number): GateReport =>
  GateReport.make({
    gate: "test",
    subject: "@beep/glob",
    itemKind: "test",
    runId: `w${writer}-r${run}`,
    startedAt: DateTime.makeUnsafe(1_000_000 + Number(writer) * 1000 + run),
    durationMs: 1,
    inputFingerprint: `w${writer}-r${run}`,
    reason: "failed",
    outcome: "some-fail",
    units: [Unit.make({ id: "src/math.test.ts", kind: "file" })],
    items: A.map(["adds", "subtracts", "divides"], (name, index) =>
      Item.make({
        key: ItemKey.cases.TestKey.make({ file: "src/math.test.ts", fullName: `math > ${name}` }),
        unit: "src/math.test.ts",
        path: ["math"],
        name,
        outcome: (run + index) % 2 === 0 ? "failed" : "passed",
      })
    ),
    totals: Totals.make({ collected: 3 }),
  });

const storeBuiltOnDemand = () =>
  layerSqlite(
    GateHistorySqliteOptions.make({ filename, config: HistoryConfig.make({ retryAttempts: 8, retryBaseMs: 20 }) })
  );

const program = Effect.gen(function* () {
  const history = yield* GateHistoryStore;
  const scope = HistoryScope.make({ branch: `writer-${writer}` });
  yield* Effect.forEach(A.range(0, RUNS - 1), (run) => history.ingest(report(run), scope), {
    concurrency: 1,
    discard: true,
  });
}).pipe(
  Effect.catchTag("GateHistoryError", (error) =>
    Console.error(`typed ${error.reason}: ${error.message}`).pipe(
      Effect.andThen(Effect.sync(() => process.exit(typedHistoryErrorExit)))
    )
  )
);

/** Where this script lives, for the test that spawns it as a separate process. */
export const historyWriterPath = import.meta.filename;

if (import.meta.main) {
  await Effect.runPromise(
    storeBuiltOnDemand().pipe(
      Layer.build,
      Effect.flatMap((context) => Effect.provideContext(program, context)),
      Effect.scoped
    )
  );
}
