import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Metric from "effect/Metric";
import * as Path from "effect/Path";
import { afterAll } from "vitest";

// Story outcome coverage, measured at run time (D8): the library counts every command an
// aggregate decides in its `domain.commands` metric, tagged with the aggregate, the command and
// the outcome ("accepted" or the rejection's tag). After each test file, this appends what the
// file executed to node_modules/.cache/proto-outcomes, which `bun run outcomes` reads.
const record = Effect.gen(function* () {
  const snapshots = yield* Metric.snapshot;
  const executed = A.flatMap(snapshots, (snapshot) =>
    snapshot.id === "domain.commands" && snapshot.type === "Counter" && Number(snapshot.state.count) > 0
      ? [
          JSON.stringify({
            aggregate: String(snapshot.attributes?.["domain.aggregate"]),
            command: String(snapshot.attributes?.["domain.command"]),
            outcome: String(snapshot.attributes?.["domain.outcome"]),
          }),
        ]
      : [],
  );
  if (A.isReadonlyArrayEmpty(executed)) return;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.resolve(yield* path.fromFileUrl(new URL("../../../node_modules/.cache/proto-outcomes/", import.meta.url)));
  yield* fs.makeDirectory(dir, { recursive: true });
  yield* fs.writeFileString(path.join(dir, `${process.pid}-${Date.now()}.jsonl`), `${A.join(executed, "\n")}\n`);
});

afterAll(() => Effect.runPromise(record.pipe(Effect.provide(NodeServices.layer))));
