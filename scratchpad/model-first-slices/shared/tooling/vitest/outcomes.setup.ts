import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "@beep/utils/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Metric from "effect/Metric";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { afterAll } from "vitest";

// Story outcome coverage, measured at run time (D8): the library counts every command an
// aggregate decides in its `domain.commands` metric, tagged with the aggregate, the command and
// the outcome ("accepted" or the rejection's tag). After each test file, this appends what the
// file executed to node_modules/.cache/proto-outcomes, which `bun run outcomes` reads.
const Executed = S.Struct({ aggregate: S.String, command: S.String, outcome: S.String });
const encodeExecuted = S.encodeEffect(S.fromJsonString(Executed));

const record = Effect.gen(function* () {
  const snapshots = yield* Metric.snapshot;
  const rows = A.flatMap(snapshots, (snapshot) =>
    snapshot.id === "domain.commands" && snapshot.type === "Counter" && Number(snapshot.state.count) > 0
      ? [
          {
            aggregate: String(snapshot.attributes?.["domain.aggregate"]),
            command: String(snapshot.attributes?.["domain.command"]),
            outcome: String(snapshot.attributes?.["domain.outcome"]),
          },
        ]
      : [],
  );
  if (A.isReadonlyArrayEmpty(rows)) return;
  const executed = yield* Effect.forEach(rows, (row) => encodeExecuted(row), { concurrency: 1 });
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cache = yield* path.fromFileUrl(new URL("../../../node_modules/.cache/proto-outcomes/", import.meta.url));
  const dir = path.resolve(cache);
  const now = yield* Clock.currentTimeMillis;
  yield* fs.makeDirectory(dir, { recursive: true });
  yield* fs.writeFileString(path.join(dir, `${process.pid}-${now}.jsonl`), `${A.join(executed, "\n")}\n`);
});

afterAll(() => Effect.runPromise(record.pipe(Effect.provide(NodeServices.layer))));
