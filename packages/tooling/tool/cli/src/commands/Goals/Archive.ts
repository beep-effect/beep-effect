/**
 * `beep goals archive` — plan (and, from slice 3, execute) moving terminal
 * packets to the public archive repository.
 *
 * **Details**
 *
 * `--plan` prints the content-addressed plan: per packet the files the
 * tombstone keeps, the files that move, the HEAD tree hash, and every inbound
 * link with its archive URL. `--json` prints the encoded plan instead.
 * `--write --expect <planId>` recomputes the plan, refuses when its id differs,
 * mirrors every packet into the local archive checkout (`--archive-dir`),
 * verifies each tree hash, and only then rewrites inbound links, tombstones the
 * packets on `main`, and writes the receipt to `.beep/archive/receipts/`.
 * `--dry-run` reports what `--write` would do and touches nothing.
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
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { ArchivePlan, ArchiveReceipt, ArchiveReceiptEntry, ArchiveRecord } from "./Archive.schemas.ts";
import { ArchivePlanner, ArchivePlannerLive } from "./Archive.service.ts";
import {
  ArchiveStore,
  ArchiveWorkspace,
  archiveCommitMessage,
  InboundLinkRewriter,
  makeArchiveStore,
  makeInboundLinkRewriter,
  makeTombstoneWriter,
  TombstoneWriter,
} from "./ArchiveExecution.service.ts";
import { ArchiveError } from "./Goals.errors.ts";
import { HarvestKind } from "./Harvest.schemas.ts";
import { harvestKindRoots } from "./Harvest.ts";
import { canonicalJsonTextPretty } from "./PacketCore/PacketDigest.ts";
import type { ArchiveWorkspaceShape } from "./ArchiveExecution.service.ts";

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
 * Default archive checkout, relative to the repository root.
 *
 * **Example** (Read the default checkout)
 *
 * ```ts
 * import { DEFAULT_ARCHIVE_DIR } from "@beep/repo-cli/commands/Goals/Archive"
 *
 * console.log(DEFAULT_ARCHIVE_DIR) // ".repos/goals-archive"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_ARCHIVE_DIR = ".repos/goals-archive";

/**
 * Repo-relative directory of archive receipts (ignored by git).
 *
 * @category configuration
 * @since 0.0.0
 */
export const ARCHIVE_RECEIPTS_DIR = ".beep/archive/receipts";

const encodeReceipt = S.encodeUnknownEffect(ArchiveReceipt);

/**
 * Render what `--write` would do for a plan, without doing it.
 *
 * **Example** (Describe an empty dry run)
 *
 * ```ts
 * import { renderArchiveDryRun } from "@beep/repo-cli/commands/Goals/Archive"
 * import { ArchivePlan } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * const plan = ArchivePlan.make({
 *   schemaVersion: "archive-plan/v1",
 *   planId: "d".repeat(64),
 *   repo: "beep-effect/beep-effect-goals-archive",
 *   sourceCommit: "c".repeat(40),
 *   entries: [],
 * })
 * const lines = renderArchiveDryRun({ plan, archiveDir: "/archive", kindLabel: "goals" })
 * console.log(lines[0]?.startsWith("[goals:archive] dry run")) // true
 * ```
 *
 * @param input - The verified plan, the absolute archive checkout path and the `--kind` value.
 * @returns The dry-run report lines.
 * @category formatting
 * @since 0.0.0
 */
export const renderArchiveDryRun = (input: {
  readonly plan: ArchivePlan;
  readonly archiveDir: string;
  readonly kindLabel: string;
}): ReadonlyArray<string> => [
  `[goals:archive] dry run of plan ${input.plan.planId}; nothing was written.`,
  `- archive checkout ${input.archiveDir}: commit "${archiveCommitMessage({ kindLabel: input.kindLabel, count: A.length(input.plan.entries), sourceCommit: input.plan.sourceCommit })}", then refresh ARCHIVE-INDEX.md`,
  ...A.flatMap(input.plan.entries, (entry) => [
    `- ${entry.root}/${entry.slug}: mirror ${A.length(entry.keep) + A.length(entry.remove)} file(s) and verify tree ${entry.localTreeHash}; delete ${A.length(entry.remove)} file(s) on main; regenerate README.md; write the manifest archive block; rewrite ${A.length(entry.inboundLinks)} inbound link(s)`,
    ...A.map(entry.inboundLinks, (link) => `  - ${link.file}:${link.line} ${link.destination} -> ${link.rewrittenTo}`),
  ]),
  `- receipt: ${ARCHIVE_RECEIPTS_DIR}/${input.plan.planId}.json`,
];

// Links written in files the plan deletes or regenerates are dropped with them.
const rewritableLinks = (plan: ArchivePlan) => {
  const replaced = HashSet.fromIterable(
    A.flatMap(plan.entries, (entry) => A.append(entry.remove, `${entry.root}/${entry.slug}/README.md`))
  );
  return A.filter(
    A.flatMap(plan.entries, (entry) => entry.inboundLinks),
    (link) => !HashSet.has(replaced, link.file)
  );
};

/**
 * Execute a verified archive plan: push, verify, rewrite inbound links,
 * tombstone, and write the receipt. Nothing on `main` changes unless every
 * mirrored tree hash matches.
 *
 * **Example** (Build the execution effect)
 *
 * ```ts
 * import { executeArchivePlan } from "@beep/repo-cli/commands/Goals/Archive"
 * import { ArchivePlan } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 * import * as Effect from "effect/Effect"
 *
 * const plan = ArchivePlan.make({
 *   schemaVersion: "archive-plan/v1",
 *   planId: "d".repeat(64),
 *   repo: "beep-effect/beep-effect-goals-archive",
 *   sourceCommit: "c".repeat(40),
 *   entries: [],
 * })
 * const workspace = { repoRoot: "/repo", archiveDir: "/archive", repo: plan.repo, kindLabel: "goals" }
 * console.log(Effect.isEffect(executeArchivePlan(plan, workspace))) // true
 * ```
 *
 * @param plan - The plan whose id the operator confirmed with `--expect`.
 * @param workspace - Main checkout, archive checkout and archive identity.
 * @returns Effect yielding the receipt.
 * @category use-cases
 * @since 0.0.0
 */
export const executeArchivePlan = Effect.fn("Goals.executeArchivePlan")(function* (
  plan: ArchivePlan,
  workspace: ArchiveWorkspaceShape
) {
  const store = yield* ArchiveStore;
  const tombstones = yield* TombstoneWriter;
  const rewriter = yield* InboundLinkRewriter;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { commit } = yield* store.push(plan);
  const verdicts = yield* store.verify(plan, commit);
  const mismatched = A.filter(verdicts, (verdict) => !verdict.verified);
  if (A.isReadonlyArrayNonEmpty(mismatched)) {
    return yield* ArchiveError.new(
      "archive-verify-mismatch",
      A.headNonEmpty(mismatched).slug,
      workspace.archiveDir,
      `archive commit ${commit} tree differs from the plan for ${A.join(
        A.map(mismatched, (verdict) => `${verdict.root}/${verdict.slug}`),
        ", "
      )}; main is untouched`
    );
  }
  const now = yield* DateTime.now;
  const archivedAt = DateTime.formatIso(now);
  const hashes = HashMap.fromIterable(
    A.map(verdicts, (verdict) => [`${verdict.root}/${verdict.slug}`, verdict.archiveTreeHash] as const)
  );
  const receipt = ArchiveReceipt.make({
    schemaVersion: "archive-receipt/v1",
    planId: plan.planId,
    archiveCommit: commit,
    entries: A.map(plan.entries, (entry) =>
      ArchiveReceiptEntry.make({
        root: entry.root,
        slug: entry.slug,
        record: ArchiveRecord.make({
          repo: plan.repo,
          path: `${entry.root}/${entry.slug}`,
          commit,
          contentHash: O.getOrElse(HashMap.get(hashes, `${entry.root}/${entry.slug}`), () => entry.localTreeHash),
          archivedAt,
          sourceCommit: plan.sourceCommit,
        }),
        verified: true,
      })
    ),
  });
  const rewritten = yield* rewriter.rewrite(rewritableLinks(plan));
  yield* tombstones.apply(plan, receipt);
  const receiptDir = path.join(workspace.repoRoot, ARCHIVE_RECEIPTS_DIR);
  const encoded = yield* encodeReceipt(receipt).pipe(Effect.orDie);
  yield* fs.makeDirectory(receiptDir, { recursive: true }).pipe(
    Effect.flatMap(() =>
      fs.writeFileString(path.join(receiptDir, `${plan.planId}.json`), canonicalJsonTextPretty(encoded))
    ),
    Effect.mapError((error) => ArchiveError.new("tombstone-conflict", null, receiptDir, error.message))
  );
  yield* Console.log(
    `[goals:archive] archived ${A.length(plan.entries)} packet(s) at ${commit}; verified ${A.length(verdicts)} tree(s); rewrote ${rewritten} link(s); receipt ${ARCHIVE_RECEIPTS_DIR}/${plan.planId}.json`
  );
  return receipt;
});

/**
 * Runs `beep goals archive`: print the plan, or execute it after the
 * `--expect` id check (`--dry-run` only reports).
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
 *   dryRun: false,
 *   archiveDir: ".repos/goals-archive",
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
    readonly expect?: string;
    readonly dryRun: boolean;
    readonly archiveDir: string;
  },
  repoRoot?: string
) {
  const path = yield* Path.Path;
  const root = repoRoot ?? (yield* findRepoRoot().pipe(Effect.orElseSucceed(() => ".")));
  if (options.plan === options.write) {
    return yield* ArchiveError.new("archive-input-invalid", null, root, "pass exactly one of --plan or --write");
  }
  if (options.write && options.expect === undefined) {
    return yield* ArchiveError.new(
      "archive-input-invalid",
      null,
      root,
      "--write needs --expect <planId> from a reviewed --plan"
    );
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
    ...optionalProp("batchSize", O.fromUndefinedOr(options.batch)),
    repo,
    repoRoot: root,
  });
  if (options.plan) {
    if (options.json) {
      const encoded = yield* encodePlan(plan).pipe(Effect.orDie);
      yield* Console.log(canonicalJsonTextPretty(encoded));
    } else {
      yield* Effect.forEach(renderArchivePlanSummary(plan), (line) => Console.log(line), { discard: true });
    }
    return O.none<ArchiveReceipt>();
  }
  if (options.expect !== plan.planId) {
    return yield* ArchiveError.new(
      "archive-plan-mismatch",
      null,
      root,
      `--expect ${options.expect ?? ""} does not match the recomputed plan ${plan.planId}; review the new plan with --plan`
    );
  }
  const archiveDir = path.resolve(root, options.archiveDir);
  if (options.dryRun) {
    yield* Effect.forEach(
      renderArchiveDryRun({ plan, archiveDir, kindLabel: options.kind }),
      (line) => Console.log(line),
      {
        discard: true,
      }
    );
    return O.none<ArchiveReceipt>();
  }
  const workspace: ArchiveWorkspaceShape = { repoRoot: root, archiveDir, repo, kindLabel: options.kind };
  const receipt = yield* executeArchivePlan(plan, workspace).pipe(
    Effect.provideServiceEffect(ArchiveStore, makeArchiveStore),
    Effect.provideServiceEffect(TombstoneWriter, makeTombstoneWriter),
    Effect.provideServiceEffect(InboundLinkRewriter, makeInboundLinkRewriter),
    Effect.provideService(ArchiveWorkspace, workspace)
  );
  return O.some(receipt);
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
  Flag.withDescription("Archive repository as <owner>/<repo> (used for URLs and the manifest archive block)")
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
  Flag.withDescription("Execute the plan whose id --expect names")
);
const expectFlag = Flag.String("expect").pipe(
  Flag.optional,
  Flag.withDescription("Plan id printed by --plan; --write refuses when the recomputed plan differs")
);
const dryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("With --write: report what would be written and change nothing")
);
const archiveDirFlag = Flag.String("archive-dir").pipe(
  Flag.withDefault(DEFAULT_ARCHIVE_DIR),
  Flag.withDescription("Local checkout of the archive repository (relative to the repository root)")
);

/**
 * `bun run beep goals archive` — plan or execute moving terminal packets to the archive repository.
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
    expect: expectFlag,
    dryRun: dryRunFlag,
    archiveDir: archiveDirFlag,
  },
  Effect.fn("Goals.archiveCommand")(function* ({
    kind,
    slug,
    batch,
    repo,
    plan,
    json,
    write,
    expect,
    dryRun,
    archiveDir,
  }) {
    yield* runGoalsArchive({
      kind,
      slugs: slug,
      ...optionalProp("batch", batch),
      repo,
      plan,
      json,
      write,
      ...optionalProp("expect", expect),
      dryRun,
      archiveDir,
    });
  })
).pipe(
  Command.withDescription(
    "Plan (--plan [--json]) or execute (--write --expect <planId> [--dry-run]) moving terminal packets to the archive repo"
  ),
  Command.provide(ArchivePlannerLive)
);
