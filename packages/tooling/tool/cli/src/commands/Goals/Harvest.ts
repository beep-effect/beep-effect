/**
 * `beep goals harvest` — write or verify the harvest provenance ledger.
 *
 * **Details**
 *
 * The default run collects every packet of the selected roots and writes the
 * JSON Lines ledger to `--out` (default
 * `explorations/packet-archive-and-alpha-harvest/research/harvest/ledger.jsonl`).
 * `--check` re-collects and exits non-zero when the ledger on disk differs.
 * The comparison ignores `generatedAt` and the read commit (`sourceCommit`
 * and each row's `commit`), because committing the ledger moves HEAD.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { HarvestKind, HarvestLedger, HarvestRow, HarvestSource } from "./Harvest.schemas.ts";
import { HarvestProjector, HarvestProjectorLive, renderHarvestLedger } from "./Harvest.service.ts";
import { PacketRoot } from "./PacketCore/PacketCore.schemas.ts";

/**
 * Repo-relative default target of `beep goals harvest`.
 *
 * **Example** (Read the default target)
 *
 * ```ts
 * import { DEFAULT_HARVEST_LEDGER_PATH } from "@beep/repo-cli/commands/Goals/Harvest"
 *
 * console.log(DEFAULT_HARVEST_LEDGER_PATH.endsWith("ledger.jsonl")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_HARVEST_LEDGER_PATH =
  "explorations/packet-archive-and-alpha-harvest/research/harvest/ledger.jsonl";

/**
 * Packet roots a harvest kind reads.
 *
 * **Example** (Expand `all`)
 *
 * ```ts
 * import { harvestKindRoots } from "@beep/repo-cli/commands/Goals/Harvest"
 *
 * console.log(harvestKindRoots("all")) // ["goals", "explorations"]
 * ```
 *
 * @param kind - The `--kind` value.
 * @returns The packet roots to collect.
 * @category mapping
 * @since 0.0.0
 */
export const harvestKindRoots = (kind: HarvestKind): ReadonlyArray<PacketRoot> =>
  HarvestKind.match(kind, {
    goals: () => [PacketRoot.Enum.goals],
    explorations: () => [PacketRoot.Enum.explorations],
    all: () => PacketRoot.literals,
  });

/**
 * Rewrite a ledger's read-commit fields and timestamp to a reference ledger's,
 * so two ledgers compare on provenance content alone.
 *
 * **Example** (Normalize an empty ledger)
 *
 * ```ts
 * import { normalizeHarvestLedgerForCheck } from "@beep/repo-cli/commands/Goals/Harvest"
 * import { HarvestLedger } from "@beep/repo-cli/commands/Goals/Harvest.schemas"
 *
 * const make = (commit: string, generatedAt: string) =>
 *   HarvestLedger.make({ schemaVersion: "harvest-ledger/v1", sourceCommit: commit, generatedAt, rowCount: 0, rows: [] })
 * const normalized = normalizeHarvestLedgerForCheck(make("a".repeat(40), "x"), make("b".repeat(40), "y"))
 * console.log(normalized.sourceCommit === "b".repeat(40)) // true
 * ```
 *
 * @param ledger - Ledger to normalize (usually the one on disk).
 * @param reference - Ledger whose commit and timestamp are adopted (the fresh collection).
 * @returns The normalized ledger.
 * @category mapping
 * @since 0.0.0
 */
export const normalizeHarvestLedgerForCheck: {
  (ledger: HarvestLedger, reference: HarvestLedger): HarvestLedger;
  (reference: HarvestLedger): (ledger: HarvestLedger) => HarvestLedger;
} = dual(
  2,
  (ledger: HarvestLedger, reference: HarvestLedger): HarvestLedger =>
    HarvestLedger.make({
      schemaVersion: ledger.schemaVersion,
      sourceCommit: reference.sourceCommit,
      generatedAt: reference.generatedAt,
      rowCount: ledger.rowCount,
      rows: A.map(ledger.rows, (row) => HarvestRow.make({ ...row, commit: reference.sourceCommit })),
    })
);

const sourceCountLines = (ledger: HarvestLedger): ReadonlyArray<string> =>
  A.map(
    HarvestSource.literals,
    (source) => `- ${source}: ${A.length(A.filter(ledger.rows, (row) => row.source === source))}`
  );

/**
 * Runs `beep goals harvest`: collect the ledger, then write it or check it
 * against the file on disk.
 *
 * **Example** (Build the check effect)
 *
 * ```ts
 * import { runGoalsHarvest } from "@beep/repo-cli/commands/Goals/Harvest"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runGoalsHarvest({ kind: "all", out: "ledger.jsonl", check: true }))) // true
 * ```
 *
 * @param options - `kind` selects packet roots, `out` is the repo-relative target, `check` only verifies.
 * @param repoRoot - Checkout to read; defaults to the enclosing repository root.
 * @category use-cases
 * @since 0.0.0
 */
export const runGoalsHarvest = Effect.fn("Goals.runGoalsHarvest")(function* (
  options: {
    readonly kind: HarvestKind;
    readonly out: string;
    readonly check: boolean;
  },
  repoRoot?: string
) {
  const path = yield* Path.Path;
  const projector = yield* HarvestProjector;
  const root = repoRoot ?? (yield* findRepoRoot().pipe(Effect.orElseSucceed(() => ".")));
  const target = path.resolve(root, options.out);
  const fresh = yield* projector.collect({ kinds: harvestKindRoots(options.kind), repoRoot: root });
  if (!options.check) {
    yield* projector.write(fresh, target);
    yield* Console.log(`[goals:harvest] wrote ${fresh.rowCount} row(s) to ${options.out} at ${fresh.sourceCommit}:`);
    yield* Effect.forEach(sourceCountLines(fresh), (line) => Console.log(line), { discard: true });
    return fresh;
  }
  const onDisk = yield* projector.read(target);
  if (O.isNone(onDisk)) {
    yield* Console.error(`[goals:harvest] ${options.out} does not exist.`);
    return yield* failWithReportedExit("goals harvest: ledger missing; run bun run beep goals harvest.");
  }
  const expected = yield* renderHarvestLedger(fresh);
  const actual = yield* renderHarvestLedger(normalizeHarvestLedgerForCheck(onDisk.value, fresh));
  if (actual !== expected) {
    yield* Console.error(
      `[goals:harvest] ${options.out} drifts from the working tree (${onDisk.value.rowCount} row(s) on disk, ${fresh.rowCount} collected).`
    );
    return yield* failWithReportedExit("goals harvest: ledger drift; run bun run beep goals harvest.");
  }
  yield* Console.log(`[goals:harvest] OK: ${options.out} matches ${fresh.rowCount} collected row(s).`);
  return fresh;
});

const kindFlag = Flag.Literals("kind", HarvestKind.literals).pipe(
  Flag.withDefault(HarvestKind.Enum.all),
  Flag.withDescription("Packet roots to harvest: goals, explorations, or all (all also reads non-packet ledgers)")
);
const outFlag = Flag.String("out").pipe(
  Flag.withDefault(DEFAULT_HARVEST_LEDGER_PATH),
  Flag.withDescription("Repo-relative JSON Lines ledger path")
);
const checkFlag = Flag.Boolean("check").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Re-collect and exit non-zero when the ledger on disk differs (ignores time and commit)")
);

/**
 * `bun run beep goals harvest` — harvest provenance ledger writer and check.
 *
 * **Example** (Read the subcommand identity)
 *
 * ```ts
 * import { goalsHarvestCommand } from "@beep/repo-cli/commands/Goals/Harvest"
 *
 * console.log(goalsHarvestCommand.name) // "harvest"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const goalsHarvestCommand = Command.make(
  "harvest",
  { kind: kindFlag, out: outFlag, check: checkFlag },
  Effect.fn("Goals.harvestCommand")(function* ({ kind, out, check }) {
    yield* runGoalsHarvest({ kind, out, check });
  })
).pipe(
  Command.withDescription(
    "Write (default) or verify (--check) the harvest provenance ledger of packet reflections, receipts, plans and decisions"
  ),
  Command.provide(HarvestProjectorLive)
);
