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
import { decodeJournalLines, replayTailWaits } from "@/backfill/JournalReplay";
import { ReplayArmSpec, ReplayEtaEstimator, ReplayReport, SimulationInputError } from "@/backfill/Schemas";
import { PosInt } from "@/projection/PosInt";

// SCHE-06 tail-wait A/B (PLAN slice 12): replay a recorded admission journal
// root (its `journal-archive/*.ndjson` day segments, then `journal.ndjson`)
// through every arm and print the aggregate report as JSON. Usage:
//   bun run scripts/backfill-ab.ts <admission-root> [--since <epoch-millis>] [--eta-permille <n>]
// The report holds counts and wait quantiles only: no paths, origins or nonces.
const encodeReport = S.encodeUnknownEffect(S.fromJsonString(ReplayReport));

const flagNumber = (argv: ReadonlyArray<string>, flag: string, fallback: number, valid: (value: number) => boolean) =>
  O.match(
    A.findFirstIndex(argv, (arg) => arg === flag),
    {
      onNone: () => Effect.succeed(fallback),
      onSome: (index) =>
        O.match(A.get(argv, index + 1), {
          onNone: () => Effect.fail(SimulationInputError.make({ message: `${flag} needs a value.` })),
          onSome: (raw) =>
            Effect.fromOption(O.liftPredicate(Number(raw), valid)).pipe(
              Effect.mapError(() => SimulationInputError.make({ message: `${flag} ${raw} is not a valid value.` }))
            ),
        }),
    }
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
  const since = yield* flagNumber(argv, "--since", 0, (value) => Number.isSafeInteger(value) && value >= 0);
  const permille = yield* flagNumber(
    argv,
    "--eta-permille",
    900,
    (value) => Number.isInteger(value) && value >= 1 && value <= 1000
  );

  if (!(yield* fs.exists(path.join(root, "journal.ndjson")))) {
    return yield* SimulationInputError.make({ message: `No admission journal at ${root}/journal.ndjson.` });
  }

  const optionalArchiveDirectory = path.join(root, "journal-archive");
  const segments = yield* fs
    .readDirectory(optionalArchiveDirectory)
    .pipe(
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound" ? Effect.succeed(A.empty<string>()) : Effect.fail(error)
      )
    );
  const files = A.append(
    A.map(A.sort(A.filter(segments, Str.endsWith(".ndjson")), Order.String), (name) =>
      path.join(optionalArchiveDirectory, name)
    ),
    path.join(root, "journal.ndjson")
  );
  const texts = yield* Effect.forEach(files, (file) => fs.readFileString(file), { concurrency: 1 });
  const lines = A.filter(A.flatMap(texts, Str.split("\n")), Str.isNonEmpty);
  const read = yield* decodeJournalLines(lines);
  yield* Console.error(
    `[backfill-ab] ${read.opaqueLines} of ${A.length(lines)} journal lines carry no replay row (routed rows, torn tails) and were skipped.`
  );
  const events = A.filter(read.events, (event) => !("enqueuedAtMillis" in event) || event.enqueuedAtMillis >= since);
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
  platform.pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
