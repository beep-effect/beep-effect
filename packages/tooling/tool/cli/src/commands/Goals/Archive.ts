/**
 * `beep goals archive` — plan (and, from slice 3, execute) moving terminal
 * packets to the public archive repository.
 *
 * **Details**
 *
 * `--plan` prints the content-addressed plan: per packet the files the
 * tombstone keeps, the files that move, the HEAD tree hash, and every inbound
 * link with its archive URL. `--json` prints the encoded plan instead. `--write`
 * is part of the stable surface but refuses with `archive-write-not-implemented`
 * until the push, verify, tombstone and link-rewrite steps land.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { optionalProp } from "@beep/repo-cli-kit/cli/OptionRecord";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ArchivePlan } from "./Archive.schemas.ts";
import { ArchivePlanner, ArchivePlannerLive } from "./Archive.service.ts";
import { ArchiveError } from "./Goals.errors.ts";
import { HarvestKind } from "./Harvest.schemas.ts";
import { harvestKindRoots } from "./Harvest.ts";
import { canonicalJsonTextPretty } from "./PacketCore/PacketDigest.ts";

const encodePlan = S.encodeUnknownEffect(ArchivePlan);

/**
 * Default archive repository of `beep goals archive`.
 *
 * **Example** (Read the default repository)
 *
 * ```ts
 * import { DEFAULT_ARCHIVE_REPO } from "@beep/repo-cli/commands/Goals/Archive"
 *
 * console.log(DEFAULT_ARCHIVE_REPO) // "beep-effect/beep-effect-goals-archive"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_ARCHIVE_REPO = "beep-effect/beep-effect-goals-archive";

/**
 * Render a human-readable summary of an archive plan, one line per packet.
 *
 * **Example** (Summarize an empty plan)
 *
 * ```ts
 * import { renderArchivePlanSummary } from "@beep/repo-cli/commands/Goals/Archive"
 * import { ArchivePlan } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * const plan = ArchivePlan.make({
 *   schemaVersion: "archive-plan/v1",
 *   planId: "d".repeat(64),
 *   repo: "beep-effect/beep-effect-goals-archive",
 *   sourceCommit: "c".repeat(40),
 *   entries: [],
 * })
 * console.log(renderArchivePlanSummary(plan)[0]?.startsWith("[goals:archive] plan")) // true
 * ```
 *
 * @param plan - Plan to summarize.
 * @returns The summary lines.
 * @category formatting
 * @since 0.0.0
 */
export const renderArchivePlanSummary = (plan: ArchivePlan): ReadonlyArray<string> => [
  `[goals:archive] plan ${plan.planId} -> ${plan.repo} from ${plan.sourceCommit}: ${A.length(plan.entries)} packet(s)`,
  ...A.map(
    plan.entries,
    (entry) =>
      `- ${entry.root}/${entry.slug} (${entry.status}): keep ${A.length(entry.keep)}, remove ${A.length(entry.remove)}, inbound links ${A.length(entry.inboundLinks)}, tree ${entry.localTreeHash}`
  ),
  `[goals:archive] totals: keep ${A.length(A.flatMap(plan.entries, (entry) => entry.keep))}, remove ${A.length(A.flatMap(plan.entries, (entry) => entry.remove))}, inbound links ${A.length(A.flatMap(plan.entries, (entry) => entry.inboundLinks))}`,
];

/**
 * Runs `beep goals archive`: compute and print the plan, or refuse `--write`
 * until execution lands.
 *
 * **Example** (Build the plan effect)
 *
 * ```ts
 * import { runGoalsArchive } from "@beep/repo-cli/commands/Goals/Archive"
 * import * as Effect from "effect/Effect"
 *
 * const program = runGoalsArchive({
 *   kind: "goals",
 *   slugs: [],
 *   batch: 3,
 *   repo: "beep-effect/beep-effect-goals-archive",
 *   plan: true,
 *   json: false,
 *   write: false,
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Parsed command options.
 * @param repoRoot - Checkout to plan from; defaults to the enclosing repository root.
 * @category use-cases
 * @since 0.0.0
 */
export const runGoalsArchive = Effect.fn("Goals.runGoalsArchive")(function* (
  options: {
    readonly kind: HarvestKind;
    readonly slugs: ReadonlyArray<string>;
    readonly batch?: number;
    readonly repo: string;
    readonly plan: boolean;
    readonly json: boolean;
    readonly write: boolean;
  },
  repoRoot?: string
) {
  const root = repoRoot ?? (yield* findRepoRoot().pipe(Effect.orElseSucceed(() => ".")));
  if (options.write) {
    return yield* ArchiveError.new(
      "archive-write-not-implemented",
      null,
      root,
      "write not implemented until slice 3; review the plan with --plan"
    );
  }
  if (!options.plan) {
    return yield* ArchiveError.new("archive-input-invalid", null, root, "pass --plan (or --write from slice 3)");
  }
  if (options.batch !== undefined && options.batch < 1) {
    return yield* ArchiveError.new(
      "archive-input-invalid",
      null,
      root,
      `--batch must be at least 1, got ${options.batch}`
    );
  }
  const repo = yield* S.decodeEffect(ArchivePlan.fields.repo)(options.repo).pipe(
    Effect.mapError(() =>
      ArchiveError.new("archive-input-invalid", null, root, `--repo must be <owner>/<repo>, got ${options.repo}`)
    )
  );
  const planner = yield* ArchivePlanner;
  const plan = yield* planner.plan({
    kinds: harvestKindRoots(options.kind),
    slugs: options.slugs,
    ...(options.batch === undefined ? {} : { batchSize: options.batch }),
    repo,
    repoRoot: root,
  });
  if (options.json) {
    const encoded = yield* encodePlan(plan).pipe(Effect.orDie);
    yield* Console.log(canonicalJsonTextPretty(encoded));
  } else {
    yield* Effect.forEach(renderArchivePlanSummary(plan), (line) => Console.log(line), { discard: true });
  }
  return plan;
});

const kindFlag = Flag.Literals("kind", HarvestKind.literals).pipe(
  Flag.withDefault(HarvestKind.Enum.all),
  Flag.withDescription("Packet roots to archive: goals, explorations, or all (goals first)")
);
const slugFlag = Flag.String("slug").pipe(
  Flag.atLeast(0),
  Flag.withDescription("Restrict the plan to these terminal packet slugs (repeatable)")
);
const batchFlag = Flag.Int("batch").pipe(
  Flag.optional,
  Flag.withDescription("Take the first <n> archivable packets in index order")
);
const repoFlag = Flag.String("repo").pipe(
  Flag.withDefault(DEFAULT_ARCHIVE_REPO),
  Flag.withDescription("Archive repository as <owner>/<repo>")
);
const planFlag = Flag.Boolean("plan").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Compute and print the archive plan without changing anything")
);
const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the plan as canonical JSON instead of a summary")
);
const writeFlag = Flag.Boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Execute the plan (not implemented until slice 3; refuses)")
);

/**
 * `bun run beep goals archive` — plan moving terminal packets to the archive repository.
 *
 * **Example** (Read the subcommand identity)
 *
 * ```ts
 * import { goalsArchiveCommand } from "@beep/repo-cli/commands/Goals/Archive"
 *
 * console.log(goalsArchiveCommand.name) // "archive"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const goalsArchiveCommand = Command.make(
  "archive",
  {
    kind: kindFlag,
    slug: slugFlag,
    batch: batchFlag,
    repo: repoFlag,
    plan: planFlag,
    json: jsonFlag,
    write: writeFlag,
  },
  Effect.fn("Goals.archiveCommand")(function* ({ kind, slug, batch, repo, plan, json, write }) {
    yield* runGoalsArchive({
      kind,
      slugs: slug,
      ...optionalProp("batch", batch),
      repo,
      plan,
      json,
      write,
    });
  })
).pipe(
  Command.withDescription(
    "Plan (--plan [--json]) moving terminal packets to the archive repo; --write refuses until slice 3"
  ),
  Command.provide(ArchivePlannerLive)
);
