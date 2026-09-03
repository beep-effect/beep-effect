/**
 * `beep goals set-status` — the single writer for goal-packet status.
 *
 * Per-slug mode atomically updates the manifest (`initiative.status`,
 * `lifecycle` when present, `initiative.updated`), rewrites the README
 * `Lifecycle:` line, and regenerates `goals/INDEX.md` in one operation,
 * refusing with typed errors on unknown slugs/statuses or READMEs without a
 * recognizable status line. Packets that opted into event sourcing (an
 * `ops/events/` directory exists) additionally flow the transition through
 * the guarded packet-core writer: `--preview` prints the fold-backed
 * transition plan without writing, and a real write appends the CAS events
 * (seeding a genesis event on the first transition) and regenerates the
 * derived `ops/trace.json` projection before the manifest edit — refusing
 * before any manifest edit on a moved tip, fork, or integrity issue (an
 * interrupted multi-event append leaves only valid chain events behind, never
 * a projection or manifest change). `--migrate` runs the
 * mechanical census-locked migration over every packet (dry-run by default,
 * `--write` to apply).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import { Console, DateTime, Effect, FileSystem, Path } from "effect";
import * as R from "effect/Record";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { applyJsoncModification } from "../../internal/cli/Jsonc.ts";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import {
  GoalManifestInvalidError,
  GoalPacketNotFoundError,
  GoalReadmeStatusLineError,
  GoalStatusInputError,
} from "./Goals.errors.ts";
import { decodeGoalManifest, GoalPhaseStatus, GoalStatus, isGoalStatus } from "./Goals.schemas.ts";
import {
  goalManifestPhases,
  isJsonRecord,
  listGoalPackets,
  parseGoalManifestText,
  rewriteReadmeLifecycleToken,
} from "./Inventory.ts";
import { planGoalPacketMigration } from "./Migration.ts";
import { PacketStreamError } from "./PacketCore/PacketCore.errors.ts";
import { isPacketSlug, isPacketStage } from "./PacketCore/PacketCore.schemas.ts";
import { PacketEventStore, PacketStreamLocator } from "./PacketCore/PacketEventStore.ts";
import {
  PacketCoreLive,
  PacketTransitionRequest,
  PacketTransitionWriter,
} from "./PacketCore/PacketTransitionWriter.ts";
import { PORTFOLIO_INDEX_PATH, writePortfolioIndex } from "./PortfolioIndex.ts";
import type { GoalManifest, GoalPhase } from "./Goals.schemas.ts";
import type { GoalPacketRecord } from "./Inventory.ts";
import type { GoalPacketMigration } from "./Migration.ts";
import type { PacketStage } from "./PacketCore/PacketCore.schemas.ts";
import type { PacketTransitionPlan } from "./PacketCore/PacketTransitionWriter.ts";

const STATUS_DOMAIN = A.join(GoalStatus.Options, " | ");

const applyMigrationPlan = Effect.fn("Goals.applyMigrationPlan")(function* (
  record: GoalPacketRecord,
  plan: GoalPacketMigration,
  write: boolean
) {
  for (const edit of plan.edits) {
    yield* Console.log(`[goals:migrate] ${plan.slug}: ${edit}`);
  }
  if (write && plan.manifestText !== undefined) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.makeDirectory(path.dirname(record.manifestPath), { recursive: true });
    yield* fs.writeFileString(record.manifestPath, plan.manifestText);
  }
  if (write && plan.readmeText !== undefined) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(record.readmePath, plan.readmeText);
  }
});

type GoalsMigrationCounts = {
  readonly backfills: number;
  readonly changedManifests: number;
  readonly changedReadmes: number;
  readonly parked: number;
};

const emptyGoalsMigrationCounts: GoalsMigrationCounts = {
  backfills: 0,
  changedManifests: 0,
  changedReadmes: 0,
  parked: 0,
};

const addGoalsMigrationCounts = (left: GoalsMigrationCounts, right: GoalsMigrationCounts): GoalsMigrationCounts => ({
  backfills: left.backfills + right.backfills,
  changedManifests: left.changedManifests + right.changedManifests,
  changedReadmes: left.changedReadmes + right.changedReadmes,
  parked: left.parked + right.parked,
});

const processGoalMigration = Effect.fn("Goals.processGoalMigration")(function* (
  record: GoalPacketRecord,
  write: boolean
) {
  const plan = planGoalPacketMigration(record);
  if (plan.parked !== undefined) {
    yield* Console.error(`[goals:migrate] PARKED ${plan.slug}: ${plan.parked}`);
    return { ...emptyGoalsMigrationCounts, parked: 1 };
  }

  yield* applyMigrationPlan(record, plan, write);
  return {
    backfills: plan.manifestText !== undefined && plan.isBackfill === true ? 1 : 0,
    changedManifests: plan.manifestText !== undefined && plan.isBackfill !== true ? 1 : 0,
    changedReadmes: plan.readmeText === undefined ? 0 : 1,
    parked: 0,
  };
});

const runGoalsMigration = Effect.fn("Goals.runGoalsMigration")(function* (options: { readonly write: boolean }) {
  const records = yield* listGoalPackets();
  let counts = emptyGoalsMigrationCounts;
  for (const record of records)
    counts = addGoalsMigrationCounts(counts, yield* processGoalMigration(record, options.write));

  const mode = options.write ? "applied" : "planned (dry-run; rerun with --write to apply)";
  yield* Console.log(
    `[goals:migrate] ${mode}: ${counts.changedManifests} manifest edit(s), ${counts.backfills} backfill(s), ${counts.changedReadmes} README edit(s), ${counts.parked} parked.`
  );
});

const stageTokenOf = (phase: GoalPhase, index: number): PacketStage => {
  const id = phase.id;
  return id !== undefined && isPacketStage(id) ? id : `phase-${index + 1}`;
};

/**
 * Map a goal manifest's phases onto a genesis stage/ordinal pair.
 *
 * **Details**
 *
 * The packet-core fold is stage-vocabulary-agnostic; the goals writers own
 * mapping manifest phases onto a genesis stage/ordinal pair (D3). The chosen
 * position is the last in-progress phase, else the last complete phase, else
 * the first declared phase.
 *
 * **Example** (A manifest without phases has no position)
 *
 * ```ts
 * import { GoalManifest, goalStagePosition } from "@beep/repo-cli/test/Goals"
 * import * as O from "effect/Option"
 *
 * const manifest = GoalManifest.make({
 *   initiative: { id: "demo", status: "active" },
 *   completionGate: {
 *     operator: "yeet",
 *     requiresPullRequest: true,
 *     requiresMergeable: true,
 *     statement: "Ship via yeet.",
 *     grandfathered: false,
 *   },
 * })
 * console.log(O.isNone(goalStagePosition(manifest))) // true
 * ```
 *
 * @param manifest - Decoded goal manifest.
 * @returns The genesis stage/ordinal pair, or `None` without phases.
 * @category utilities
 * @since 0.0.0
 */
export const goalStagePosition = (
  manifest: GoalManifest
): O.Option<{ readonly stage: PacketStage; readonly ordinal: number }> => {
  const phases = goalManifestPhases(manifest);
  let inProgress = O.none<number>();
  let complete = O.none<number>();
  let index = 0;
  for (const phase of phases) {
    if (GoalPhaseStatus.is["in-progress"](phase.status)) {
      inProgress = O.some(index);
    }
    if (GoalPhaseStatus.is.complete(phase.status)) {
      complete = O.some(index);
    }
    index += 1;
  }
  const chosen = pipe(
    inProgress,
    O.orElse(() => complete),
    O.orElse(() => (A.isReadonlyArrayNonEmpty(phases) ? O.some(0) : O.none<number>()))
  );
  return pipe(
    chosen,
    O.flatMap((position) =>
      pipe(
        A.get(phases, position),
        O.map((phase) => ({ stage: stageTokenOf(phase, position), ordinal: position }))
      )
    )
  );
};

const shortTip: (id: string) => string = Str.slice(0, 12);

/**
 * Render one planned packet event as an operator preview line.
 *
 * **Example** (Render a drafted status-set event)
 *
 * ```ts
 * import { PacketEvent, previewEventLine } from "@beep/repo-cli/test/Goals"
 *
 * const event = PacketEvent.make({
 *   schemaVersion: "packet-event/v1",
 *   packet: "demo",
 *   root: "goals",
 *   seq: 1,
 *   expectedRevision: 0,
 *   at: "2026-08-17T00:00:00.000Z",
 *   actor: "operator",
 *   body: { type: "packet-created", status: "active" },
 * })
 * console.log(previewEventLine(event)) // "would append 1 packet-created: genesis status=active"
 * ```
 *
 * @param event - Drafted event from a guarded-writer plan.
 * @returns One human-readable preview line.
 * @category utilities
 * @since 0.0.0
 */
export const previewEventLine = (event: PacketTransitionPlan["events"][number]): string => {
  const body = event.body;
  if (body.type === "status-set") {
    return `would append ${event.seq} status-set: ${body.previous} -> ${body.status}`;
  }
  if (body.type === "packet-created") {
    const stage = body.stage === undefined ? "" : ` stage=${body.stage}@${body.ordinal}`;
    return `would append ${event.seq} packet-created: genesis status=${body.status}${stage}`;
  }
  if (body.type === "risk-tier-overridden") {
    const previous = body.previous === undefined ? "none" : body.previous;
    return `would append ${event.seq} risk-tier-overridden: ${previous} -> ${body.tier} (${body.reason})`;
  }
  return `would append ${event.seq} stage-entered: ${body.stage}@${body.ordinal}`;
};

const printTransitionPreview = Effect.fn("Goals.printTransitionPreview")(function* (
  slug: string,
  status: GoalStatus,
  previous: string,
  plan: O.Option<PacketTransitionPlan>
) {
  yield* Console.log(`[goals:set-status] preview ${slug}: ${previous} -> ${status}`);
  if (O.isNone(plan)) {
    yield* Console.log(
      "[goals:set-status] stream: none (a packet opts in by creating ops/events/); a write edits the manifest, README Lifecycle line, and goals/INDEX.md."
    );
    yield* Console.log("[goals:set-status] preview only — nothing written.");
    return;
  }
  const transition = plan.value;
  const tipText = pipe(
    O.fromUndefinedOr(transition.currentTip),
    O.match({ onNone: () => "empty", onSome: (tip) => `${tip.seq}@${shortTip(tip.id)}` })
  );
  yield* Console.log(`[goals:set-status] stream: revision ${transition.currentRevision}, tip ${tipText}`);
  if (transition.disposition === "skipped") {
    yield* Console.log(
      `[goals:set-status] outcome: skipped; stream already derives status ${status}, so no event or trace write is planned.`
    );
    yield* Console.log("[goals:set-status] preview only — nothing written.");
    return;
  }
  for (const event of transition.events) {
    yield* Console.log(`[goals:set-status] ${previewEventLine(event)}`);
  }
  const derived = O.fromUndefinedOr(transition.derivedAfter);
  if (O.isSome(derived)) {
    yield* Console.log(
      `[goals:set-status] derived after: revision=${derived.value.revision} status=${derived.value.status ?? "—"} furthest=${derived.value.furthestStage ?? "—"} resume=${derived.value.resumeStage ?? "—"}`
    );
  }
  yield* Console.log(`[goals:set-status] trace: ${transition.tracePath} (regenerated on write)`);
  yield* Console.log("[goals:set-status] preview only — nothing written.");
});

/**
 * Load and decode one goal packet's manifest surfaces by slug.
 *
 * **Details**
 *
 * Shared front door for the guarded goals writers: resolves the packet
 * record, requires a parseable manifest, and decodes it as
 * {@link GoalManifest}, failing with the same typed errors every writer
 * reports. README surfaces are not touched here — `set-status` layers its
 * README lifecycle-line handling on top.
 *
 * **Example** (Reference the loader)
 *
 * ```ts
 * import { loadGoalPacketManifest } from "@beep/repo-cli/test/Goals"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(loadGoalPacketManifest("some-goal"))) // true
 * ```
 *
 * @param slug - Goal packet directory name under `goals/`.
 * @returns The packet record, raw manifest text/object, and decoded manifest.
 * @category utilities
 * @since 0.0.0
 */
export const loadGoalPacketManifest = Effect.fn("Goals.loadGoalPacketManifest")(function* (slug: string) {
  const records = yield* listGoalPackets();
  const record = yield* pipe(
    A.findFirst(records, (candidate) => candidate.slug === slug),
    Effect.fromOption(() => GoalPacketNotFoundError.new(slug, `No goal packet directory "goals/${slug}".`))
  );

  const manifestText = record.manifestText;
  if (manifestText === undefined) {
    return yield* GoalPacketNotFoundError.new(
      slug,
      `"${record.manifestPath}" is missing; backfill it (see \`bun run beep goals set-status --migrate\`) before running a goals writer.`
    );
  }
  const parsed = parseGoalManifestText(manifestText);
  if (O.isNone(parsed)) {
    return yield* GoalManifestInvalidError.new(slug, `"${record.manifestPath}" does not parse as JSON.`);
  }
  const decoded = yield* decodeGoalManifest(parsed.value).pipe(
    Effect.mapError((issue) =>
      GoalManifestInvalidError.new(slug, `"${record.manifestPath}" does not decode as GoalManifest: ${issue.message}`)
    )
  );
  const manifest: Readonly<Record<string, unknown>> = isJsonRecord(parsed.value) ? parsed.value : {};
  return { record, manifestText, manifest, decoded };
});

const loadPacketSurfaces = Effect.fn("Goals.loadPacketSurfaces")(function* (slug: string, status: GoalStatus) {
  const { decoded, manifest, manifestText, record } = yield* loadGoalPacketManifest(slug);

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

  return { record, manifestText, manifest, decoded, rewrittenReadme: rewrittenReadme.value };
});

const planStreamTransition = Effect.fn("Goals.planStreamTransition")(function* (
  slug: string,
  status: GoalStatus,
  decoded: GoalManifest,
  record: GoalPacketRecord,
  at: string
) {
  const store = yield* PacketEventStore;
  const writer = yield* PacketTransitionWriter;
  const streamPresent = yield* store.hasStream(record.packetPath);
  if (!streamPresent) {
    return O.none<PacketTransitionPlan>();
  }
  if (!isPacketSlug(slug)) {
    return yield* PacketStreamError.new(
      slug,
      `directory name "${slug}" is not a valid packet slug for an event stream.`
    );
  }
  const position = goalStagePosition(decoded);
  const request = PacketTransitionRequest.make({
    locator: PacketStreamLocator.make({ packet: slug, root: "goals", packetPath: record.packetPath }),
    status,
    previousStatus: decoded.initiative.status,
    ...optionalProp(
      "genesisStage",
      O.map(position, (value) => value.stage)
    ),
    ...optionalProp(
      "genesisOrdinal",
      O.map(position, (value) => value.ordinal)
    ),
    actor: "operator",
    at,
  });
  return O.some(yield* writer.plan(request));
});

const setStatusForSlug = Effect.fn("Goals.setStatusForSlug")(function* (
  slug: string,
  status: GoalStatus,
  preview: boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const writer = yield* PacketTransitionWriter;
  const { decoded, manifest, manifestText, record, rewrittenReadme } = yield* loadPacketSurfaces(slug, status);
  const now = yield* DateTime.now;
  const today = pipe(DateTime.formatIso(now), Str.slice(0, 10));
  const plan = yield* planStreamTransition(slug, status, decoded, record, DateTime.formatIso(now));

  if (preview) {
    return yield* printTransitionPreview(slug, status, decoded.initiative.status, plan);
  }

  if (O.isSome(plan)) {
    const outcome = yield* writer.commit(plan.value);
    if (outcome.disposition === "skipped") {
      yield* Console.log(`[goals:set-status] ${slug}: skipped; stream already derives status ${status}.`);
    } else {
      yield* Console.log(
        `[goals:set-status] ${slug}: appended ${outcome.appended} event(s); regenerated ${outcome.tracePath}.`
      );
    }
  }

  let nextManifest = applyJsoncModification({ content: manifestText, path: ["initiative", "status"], value: status });
  if (R.has(manifest, "lifecycle")) {
    nextManifest = applyJsoncModification({ content: nextManifest, path: ["lifecycle"], value: status });
  }
  nextManifest = applyJsoncModification({ content: nextManifest, path: ["initiative", "updated"], value: today });

  yield* fs.writeFileString(record.manifestPath, nextManifest);
  yield* fs.writeFileString(record.readmePath, rewrittenReadme);
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
  Flag.withDefault(false),
  Flag.withDescription("Run the mechanical census-locked status migration over every packet")
);
const migrateWriteFlag = Flag.boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Apply --migrate edits (default is a dry-run report)")
);
const previewFlag = Flag.boolean("preview").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the guarded transition plan (fold, events to append, derived state) without writing")
);

type SetStatusInput = {
  readonly migrate: boolean;
  readonly preview: boolean;
  readonly write: boolean;
  readonly slug: O.Option<string>;
  readonly status: O.Option<string>;
};

const runMigrateMode = Effect.fn("Goals.runMigrateMode")(function* (input: SetStatusInput) {
  if (O.isSome(input.slug) || O.isSome(input.status)) {
    return yield* GoalStatusInputError.new("--migrate takes no slug/status arguments; it migrates every packet.");
  }
  if (input.preview) {
    return yield* GoalStatusInputError.new(
      "--migrate has its own dry-run default; --preview applies to per-slug transitions."
    );
  }
  return yield* runGoalsMigration({ write: input.write });
});

const runSetStatusProgram = Effect.fn("Goals.runSetStatusProgram")(function* (input: SetStatusInput) {
  if (input.migrate) {
    return yield* runMigrateMode(input);
  }
  if (O.isNone(input.slug) || O.isNone(input.status)) {
    return yield* GoalStatusInputError.new(
      `Usage: beep goals set-status <slug> <status> with status one of ${STATUS_DOMAIN}.`
    );
  }
  if (!isGoalStatus(input.status.value)) {
    return yield* GoalStatusInputError.new(`Unknown status "${input.status.value}"; expected one of ${STATUS_DOMAIN}.`);
  }
  return yield* setStatusForSlug(input.slug.value, input.status.value, input.preview);
});

/**
 * `bun run beep goals set-status` — single writer for goal-packet status.
 *
 * **Example** (Import and log command name)
 *
 * ```ts
 * import { goalsSetStatusCommand } from "@beep/repo-cli/commands/Goals/SetStatus"
 *
 * console.log(goalsSetStatusCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsSetStatusCommand = Command.make(
  "set-status",
  { slug: slugArgument, status: statusArgument, migrate: migrateFlag, write: migrateWriteFlag, preview: previewFlag },
  Effect.fn(function* ({ migrate, preview, slug, status, write }) {
    return yield* runSetStatusProgram({ migrate, preview, slug, status, write }).pipe(
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
        PacketStreamError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-status] ${error.message}`);
          return yield* failWithReportedExit(`goals set-status: ${error.message}`);
        }),
        PacketCasConflictError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-status] ${error.message}`);
          return yield* failWithReportedExit(`goals set-status: ${error.message}`);
        }),
      })
    );
  })
).pipe(
  Command.withDescription("Set a packet's canonical status (manifest + README + INDEX) or run --migrate"),
  Command.provide(PacketCoreLive)
);
