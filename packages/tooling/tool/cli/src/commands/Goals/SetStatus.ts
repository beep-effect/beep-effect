/**
 * `beep goals set-status` — the single writer for goal-packet status.
 *
 * Per-slug mode atomically updates the manifest (`initiative.status`,
 * `lifecycle` when present, `initiative.updated`), rewrites the README
 * `Lifecycle:` line, and regenerates `goals/INDEX.md` in one operation,
 * refusing with typed errors on unknown slugs/statuses or READMEs without a
 * recognizable status line. `--migrate` runs the mechanical census-locked
 * migration over every packet (dry-run by default, `--write` to apply).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import { Console, DateTime, Effect, FileSystem, Path } from "effect";
import * as R from "effect/Record";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.js";
import { applyJsoncModification } from "../../internal/cli/Jsonc.js";
import {
  GoalManifestInvalidError,
  GoalPacketNotFoundError,
  GoalReadmeStatusLineError,
  GoalStatusInputError,
} from "./Goals.errors.js";
import { decodeGoalManifest, GoalStatus, isGoalStatus } from "./Goals.schemas.js";
import { listGoalPackets, parseGoalManifestText, rewriteReadmeLifecycleToken } from "./Inventory.js";
import { planGoalPacketMigration } from "./Migration.js";
import { PORTFOLIO_INDEX_PATH, writePortfolioIndex } from "./PortfolioIndex.js";
import type { GoalStatusValue } from "./Goals.schemas.js";

const STATUS_DOMAIN = A.join(GoalStatus.Options, " | ");

const runGoalsMigration = Effect.fn("Goals.runGoalsMigration")(function* (options: { readonly write: boolean }) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const records = yield* listGoalPackets();

  let changedManifests = 0;
  let changedReadmes = 0;
  let backfills = 0;
  let parked = 0;

  for (const record of records) {
    const plan = planGoalPacketMigration(record);
    if (plan.parked !== undefined) {
      parked += 1;
      yield* Console.error(`[goals:migrate] PARKED ${plan.slug}: ${plan.parked}`);
      continue;
    }
    for (const edit of plan.edits) {
      yield* Console.log(`[goals:migrate] ${plan.slug}: ${edit}`);
    }
    if (plan.manifestText !== undefined) {
      if (plan.isBackfill === true) {
        backfills += 1;
      } else {
        changedManifests += 1;
      }
      if (options.write) {
        yield* fs.makeDirectory(path.dirname(record.manifestPath), { recursive: true });
        yield* fs.writeFileString(record.manifestPath, plan.manifestText);
      }
    }
    if (plan.readmeText !== undefined) {
      changedReadmes += 1;
      if (options.write) {
        yield* fs.writeFileString(record.readmePath, plan.readmeText);
      }
    }
  }

  const mode = options.write ? "applied" : "planned (dry-run; rerun with --write to apply)";
  yield* Console.log(
    `[goals:migrate] ${mode}: ${changedManifests} manifest edit(s), ${backfills} backfill(s), ${changedReadmes} README edit(s), ${parked} parked.`
  );
});

const setStatusForSlug = Effect.fn("Goals.setStatusForSlug")(function* (slug: string, status: GoalStatusValue) {
  const fs = yield* FileSystem.FileSystem;
  const records = yield* listGoalPackets();
  const record = yield* pipe(
    A.findFirst(records, (candidate) => candidate.slug === slug),
    O.match({
      onNone: () => Effect.fail(GoalPacketNotFoundError.new(slug, `No goal packet directory "goals/${slug}".`)),
      onSome: Effect.succeed,
    })
  );

  const manifestText = record.manifestText;
  if (manifestText === undefined) {
    return yield* GoalPacketNotFoundError.new(
      slug,
      `"${record.manifestPath}" is missing; backfill it (see \`bun run beep goals set-status --migrate\`) before setting a status.`
    );
  }
  const parsed = parseGoalManifestText(manifestText);
  if (O.isNone(parsed)) {
    return yield* GoalManifestInvalidError.new(slug, `"${record.manifestPath}" does not parse as JSON.`);
  }
  yield* decodeGoalManifest(parsed.value).pipe(
    Effect.mapError((issue) =>
      GoalManifestInvalidError.new(slug, `"${record.manifestPath}" does not decode as GoalManifest: ${issue.message}`)
    )
  );

  const readmeText = record.readmeText;
  if (readmeText === undefined) {
    return yield* GoalReadmeStatusLineError.new(
      slug,
      `"${record.readmePath}" is missing; every packet needs a README status line.`
    );
  }
  const rewrittenReadme = rewriteReadmeLifecycleToken(readmeText, status);
  if (O.isNone(rewrittenReadme)) {
    return yield* GoalReadmeStatusLineError.new(
      slug,
      `"${record.readmePath}" has no recognizable "Lifecycle:" status line; add one under "## Status" (see goals/_template/README.md) and rerun.`
    );
  }

  const manifest = parsed.value as Readonly<Record<string, unknown>>;
  const now = yield* DateTime.now;
  const today = pipe(DateTime.formatIso(now), Str.slice(0, 10));

  let nextManifest = applyJsoncModification({ content: manifestText, path: ["initiative", "status"], value: status });
  if (R.has(manifest, "lifecycle")) {
    nextManifest = applyJsoncModification({ content: nextManifest, path: ["lifecycle"], value: status });
  }
  nextManifest = applyJsoncModification({ content: nextManifest, path: ["initiative", "updated"], value: today });

  yield* fs.writeFileString(record.manifestPath, nextManifest);
  yield* fs.writeFileString(record.readmePath, rewrittenReadme.value);
  yield* writePortfolioIndex();
  yield* Console.log(
    `[goals:set-status] ${slug} -> ${status} (manifest, README Lifecycle line, ${PORTFOLIO_INDEX_PATH}).`
  );
});

const slugArgument = Argument.string("slug").pipe(
  Argument.withDescription("Goal packet slug under goals/"),
  Argument.optional
);
const statusArgument = Argument.string("status").pipe(
  Argument.withDescription(`Canonical status: ${STATUS_DOMAIN}`),
  Argument.optional
);
const migrateFlag = Flag.boolean("migrate").pipe(
  Flag.withDescription("Run the mechanical census-locked status migration over every packet")
);
const migrateWriteFlag = Flag.boolean("write").pipe(
  Flag.withDescription("Apply --migrate edits (default is a dry-run report)")
);

/**
 * `bun run beep goals set-status` — single writer for goal-packet status.
 *
 * @example
 * ```ts
 * import { goalsSetStatusCommand } from "@beep/repo-cli/commands/Goals/SetStatus"
 *
 * console.log(goalsSetStatusCommand.name)
 * ```
 * @category commands
 * @since 0.0.0
 */
export const goalsSetStatusCommand = Command.make(
  "set-status",
  { slug: slugArgument, status: statusArgument, migrate: migrateFlag, write: migrateWriteFlag },
  Effect.fn(function* ({ migrate, slug, status, write }) {
    const program = Effect.gen(function* () {
      if (migrate) {
        if (O.isSome(slug) || O.isSome(status)) {
          return yield* GoalStatusInputError.new("--migrate takes no slug/status arguments; it migrates every packet.");
        }
        return yield* runGoalsMigration({ write });
      }
      if (O.isNone(slug) || O.isNone(status)) {
        return yield* GoalStatusInputError.new(
          `Usage: beep goals set-status <slug> <status> with status one of ${STATUS_DOMAIN}.`
        );
      }
      if (!isGoalStatus(status.value)) {
        return yield* GoalStatusInputError.new(`Unknown status "${status.value}"; expected one of ${STATUS_DOMAIN}.`);
      }
      return yield* setStatusForSlug(slug.value, status.value);
    });

    return yield* program.pipe(
      Effect.catchTags({
        GoalStatusInputError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-status] ${error.message}`);
          return yield* failWithReportedExit(`goals set-status: ${error.message}`);
        }),
        GoalPacketNotFoundError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-status] ${error.message}`);
          return yield* failWithReportedExit(`goals set-status: ${error.message}`);
        }),
        GoalManifestInvalidError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-status] ${error.message}`);
          return yield* failWithReportedExit(`goals set-status: ${error.message}`);
        }),
        GoalReadmeStatusLineError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-status] ${error.message}`);
          return yield* failWithReportedExit(`goals set-status: ${error.message}`);
        }),
      })
    );
  })
).pipe(Command.withDescription("Set a packet's canonical status (manifest + README + INDEX) or run --migrate"));
