// fallow-ignore-file unused-file -- an operator-run A/B script (bun run scripts/backfill-ab.ts <admission-root>) that no import or package script reaches; a package script would change the lab's reviewed cache configuration. Owner: @beep/ciops. Exit: register it as an evidence script with the next reviewed cache-baseline change for this lab.
import { BunRuntime } from "@effect/platform-bun";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { replayTailWaits } from "@/backfill/JournalReplay";
import { ReplayArmSpec, ReplayEtaEstimator, ReplayReport, SimulationInputError } from "@/backfill/Schemas";
import { PosInt } from "@/projection/PosInt";
import { AdmissionJournalEvent } from "@/projection/Schemas";

// SCHE-06 tail-wait A/B (PLAN slice 12): replay a recorded admission journal
// root (its `journal-archive/*.ndjson` day segments, then `journal.ndjson`)
// through every arm and print the aggregate report as JSON. Usage:
//   bun run scripts/backfill-ab.ts <admission-root> [--since <epoch-millis>] [--eta-permille <n>]
// The report holds counts and wait quantiles only: no paths, origins or nonces.

const decodeRow = S.decodeUnknownOption(S.fromJsonString(AdmissionJournalEvent));
const encodeReport = S.encodeUnknownEffect(S.fromJsonString(ReplayReport));

const flagValue = (argv: ReadonlyArray<string>, flag: string): O.Option<string> =>
  O.flatMap(
    A.findFirstIndex(argv, (arg) => arg === flag),
    (index) => A.get(argv, index + 1)
  );

const arms = A.flatMap([10, 8, 6, 5], (capacity) =>
  A.map(
    [
      ["off", "off"],
      ["easy", "off"],
      ["off", "origin-checkout"],
      ["easy", "origin-checkout"],
    ] as const,
    ([backfill, fairness]) => ReplayArmSpec.make({ capacityTokens: PosInt.make(capacity), backfill, fairness })
  )
);

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const argv = process.argv.slice(2);
  const root = yield* Effect.fromOption(A.head(argv)).pipe(
    Effect.mapError(() =>
      SimulationInputError.make({ message: "usage: backfill-ab.ts <admission-root> [--since <epoch-millis>]" })
    )
  );
  const since = O.getOrElse(O.map(flagValue(argv, "--since"), Number), () => 0);
  const permille = O.getOrElse(O.map(flagValue(argv, "--eta-permille"), Number), () => 900);
  const archive = path.join(root, "journal-archive");
  const segments = yield* fs.readDirectory(archive).pipe(Effect.orElseSucceed(A.empty<string>));
  const files = A.append(
    A.map(A.sort(A.filter(segments, Str.endsWith(".ndjson")), Order.String), (name) => path.join(archive, name)),
    path.join(root, "journal.ndjson")
  );
  const texts = yield* Effect.forEach(files, (file) => fs.readFileString(file).pipe(Effect.orElseSucceed(() => "")), {
    concurrency: 1,
  });
  const events = A.filter(
    A.getSomes(A.map(A.flatMap(texts, Str.split("\n")), (line) => decodeRow(line))),
    (event) => !("enqueuedAtMillis" in event) || event.enqueuedAtMillis >= since
  );
  const estimator = ReplayEtaEstimator.make({
    quantilePermille: PosInt.make(permille),
    minSamples: PosInt.make(5),
    historyLimit: PosInt.make(200),
  });
  const report = yield* replayTailWaits(events, estimator, arms);
  const encoded = yield* encodeReport(report);
  yield* Console.log(encoded);
});

const platform = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);

BunRuntime.runMain(
  Layer.build(platform).pipe(
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
