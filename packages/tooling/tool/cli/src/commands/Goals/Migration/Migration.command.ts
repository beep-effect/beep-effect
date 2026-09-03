/**
 * Packet-convention migration command surfaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import { Console, DateTime, Effect, FileSystem, Layer, Path, Result } from "effect";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import { writeContainedFileString } from "../../../internal/cli/FsGuards.ts";
import { GoalStatusInputError } from "../Goals.errors.ts";
import { listGoalPacketsStrict } from "../Inventory.ts";
import { PacketStreamError } from "../PacketCore/PacketCore.errors.ts";
import { isPacketSlug, PacketEventTimestamp, PacketRoot } from "../PacketCore/PacketCore.schemas.ts";
import { PacketStreamLocator } from "../PacketCore/PacketEventStore.ts";
import { PacketCoreLive } from "../PacketCore/PacketTransitionWriter.ts";
import { lintGoalFleet, planManifestTranslation } from "./ManifestTranslation.ts";
import { TranslationReport } from "./Migration.schemas.ts";
import {
  applyPacketGenesisSeed,
  isRecoverableGenesisSeed,
  PacketForkRepairApplier,
  PacketForkRepairApplierLive,
  planPacketGenesisRecovery,
  planPacketGenesisSeed,
  quarantineOwnedGenesisEvents,
} from "./PacketMutation.ts";
import type { GoalPacketRecord } from "../Inventory.ts";
import type { ManifestTranslation, ManifestTranslationPlan, PacketGenesisSeed } from "./Migration.schemas.ts";

/**
 * Default committed report path for a fleet migration apply.
 *
 * **Example** (Read the report path)
 *
 * ```ts
 * import { PACKET_CONVENTION_REPORT_PATH } from "@beep/repo-cli/commands/Goals/Migration/Migration.command"
 *
 * console.log(PACKET_CONVENTION_REPORT_PATH.endsWith("fleet-migration-report.md")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACKET_CONVENTION_REPORT_PATH = "goals/packet-convention-migration/history/fleet-migration-report.md";

const migrationLayer = PacketForkRepairApplierLive.pipe(Layer.provideMerge(PacketCoreLive));

const requireExclusiveMode = (
  preview: boolean,
  apply: boolean,
  usage: string
): Effect.Effect<"preview" | "apply", GoalStatusInputError> => {
  if (preview === apply)
    return Effect.fail(GoalStatusInputError.new(`${usage}; choose exactly one of --preview or --apply.`));
  return Effect.succeed(apply ? "apply" : "preview");
};

const printForkPlan = Effect.fn("Goals.printForkPlan")(function* (
  locator: PacketStreamLocator,
  mode: "preview" | "apply"
) {
  const applier = yield* PacketForkRepairApplier;
  if (mode === "preview") {
    const plan = yield* applier.preview(locator);
    if (O.isNone(plan)) {
      yield* Console.log(`[goals:repair-fork] ${locator.root}/${locator.packet}: no fork found.`);
      return;
    }
    yield* Console.log(`[goals:repair-fork] preview ${locator.root}/${locator.packet}`);
    yield* Console.log(`[goals:repair-fork] survivor ${pipe(plan.value.survivor, Str.slice(0, 12))}`);
    yield* Console.log(
      `[goals:repair-fork] rebase=${A.length(plan.value.rebaseDrafts)} remove=${A.length(plan.value.filesToRemove)}`
    );
    for (const fileName of plan.value.filesToRemove) yield* Console.log(`[goals:repair-fork] remove ${fileName}`);
    yield* Console.log("[goals:repair-fork] preview only — nothing written.");
    return;
  }
  const outcome = yield* applier.apply(locator);
  if (O.isNone(outcome)) {
    yield* Console.log(`[goals:repair-fork] ${locator.root}/${locator.packet}: no fork found; nothing written.`);
    return;
  }
  yield* Console.log(
    `[goals:repair-fork] ${locator.root}/${locator.packet}: repaired to revision ${outcome.value.revision}; trace regenerated.`
  );
});

const repairSlugArgument = Argument.string("slug").pipe(
  Argument.withDescription("Packet slug under the selected root"),
  Argument.optional
);
const repairRootFlag = Flag.choice("root", PacketRoot.Options).pipe(
  Flag.withDefault(PacketRoot.Enum.goals),
  Flag.withDescription("Packet root containing the stream")
);
const previewFlag = Flag.boolean("preview").pipe(Flag.withDefault(false), Flag.withDescription("Plan without writing"));
const applyFlag = Flag.boolean("apply").pipe(Flag.withDefault(false), Flag.withDescription("Apply the verified plan"));

type RepairForkCommandInput = {
  readonly slug: O.Option<string>;
  readonly root: PacketRoot;
  readonly preview: boolean;
  readonly apply: boolean;
};

/**
 * `beep goals repair-fork` staged single-packet mutator.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { goalsRepairForkCommand } from "@beep/repo-cli/commands/Goals/Migration/Migration.command"
 *
 * console.log(goalsRepairForkCommand.name) // "repair-fork"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const goalsRepairForkCommand = Command.make(
  "repair-fork",
  { slug: repairSlugArgument, root: repairRootFlag, preview: previewFlag, apply: applyFlag },
  Effect.fn(function* ({ slug, root, preview, apply }: RepairForkCommandInput) {
    return yield* Effect.gen(function* () {
      const usage = "Usage: beep goals repair-fork <slug> --root goals|explorations --preview|--apply";
      const mode = yield* requireExclusiveMode(preview, apply, usage);
      if (O.isNone(slug) || !isPacketSlug(slug.value)) return yield* GoalStatusInputError.new(usage);
      const path = yield* Path.Path;
      const packetPath = path.join(root, slug.value);
      const fs = yield* FileSystem.FileSystem;
      const present = yield* fs.exists(packetPath).pipe(Effect.orElseSucceed(() => false));
      if (!present) return yield* GoalStatusInputError.new(`Packet directory "${packetPath}" does not exist.`);
      return yield* printForkPlan(PacketStreamLocator.make({ packet: slug.value, root, packetPath }), mode);
    }).pipe(
      Effect.catchTags({
        GoalStatusInputError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:repair-fork] ${error.message}`);
          return yield* failWithReportedExit(`goals repair-fork: ${error.message}`);
        }),
        PacketStreamError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:repair-fork] ${error.message}`);
          return yield* failWithReportedExit(`goals repair-fork: ${error.message}`);
        }),
      })
    );
  })
).pipe(
  Command.withDescription("Preview or apply one staged packet-stream fork repair"),
  Command.provide(migrationLayer)
);

type ConventionPlan = {
  readonly report: TranslationReport;
  readonly records: ReadonlyArray<GoalPacketRecord>;
};

const planConventionSeed = Effect.fnUntraced(function* (
  record: GoalPacketRecord,
  plan: ManifestTranslationPlan,
  at: string
) {
  if (O.isSome(plan.translation)) {
    return yield* planPacketGenesisSeed(record, plan.translation.value.content, at);
  }
  if (record.manifestText === undefined || A.isReadonlyArrayNonEmpty(plan.issues)) {
    return O.none<PacketGenesisSeed>();
  }
  return yield* planPacketGenesisRecovery(record, record.manifestText);
});

const planConventionSeeds = Effect.fnUntraced(function* (
  records: ReadonlyArray<GoalPacketRecord>,
  plans: ReadonlyArray<ManifestTranslationPlan>,
  at: string
) {
  let seeds = A.empty<PacketGenesisSeed>();
  for (const [record, plan] of A.zip(records, plans)) {
    const seed = yield* planConventionSeed(record, plan, at);
    if (O.isSome(seed)) seeds = A.append(seeds, seed.value);
  }
  return seeds;
});

const planConventionMigration = Effect.fn("Goals.planConventionMigration")(function* (
  mode: "preview" | "apply",
  at: string
) {
  const records = yield* listGoalPacketsStrict().pipe(
    Effect.mapError((error) => PacketStreamError.new("fleet", `goal inventory scan failed: ${error.message}`))
  );
  const invalidRecord = A.findFirst(records, (record) => !isPacketSlug(record.slug));
  if (O.isSome(invalidRecord)) {
    return yield* PacketStreamError.new(
      "fleet",
      `goal inventory contains invalid packet directory "${invalidRecord.value.slug}"`
    );
  }
  const plans = A.map(records, planManifestTranslation);
  const translations = A.getSomes(A.map(plans, (plan) => plan.translation));
  const seeds = yield* planConventionSeeds(records, plans, at);
  return {
    records,
    report: TranslationReport.make({
      schemaVersion: "packet-convention-report/v1",
      mode,
      probes: A.map(plans, (plan) => plan.probe),
      translations,
      issues: A.flatMap(plans, (plan) => plan.issues),
      assumptions: A.flatMap(plans, (plan) => plan.assumptions),
      fleetFindings: lintGoalFleet(records),
      seeds,
    }),
  } satisfies ConventionPlan;
});

const countDrift = (
  translations: ReadonlyArray<ManifestTranslation>,
  kind: ManifestTranslation["drift"][number]
): number => A.length(A.filter(translations, (translation) => A.contains(translation.drift, kind)));

type ConventionReportCoordinates = {
  readonly root: string;
  readonly target: string;
};

const conventionReportCoordinates = Effect.fn("Goals.conventionReportCoordinates")(function* (reportPath: string) {
  const path = yield* Path.Path;
  const root = path.resolve("goals/packet-convention-migration/history");
  const target = path.resolve(reportPath);
  const relative = path.relative(root, target);
  if (relative === "" || path.isAbsolute(relative) || relative === ".." || Str.startsWith(`..${path.sep}`)(relative)) {
    return yield* PacketStreamError.new(
      "fleet",
      `report path must be a file beneath goals/packet-convention-migration/history; received "${reportPath}"`
    );
  }
  return { root, target } satisfies ConventionReportCoordinates;
});

/**
 * Render a concise committed migration report with explicit Issues and Assumptions.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import { renderTranslationReport } from "@beep/repo-cli/commands/Goals/Migration/Migration.command"
 * import { TranslationReport } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 *
 * const text = renderTranslationReport(TranslationReport.make({
 *   schemaVersion: "packet-convention-report/v1",
 *   mode: "preview",
 *   probes: [], translations: [], issues: [], assumptions: [], fleetFindings: [], seeds: [],
 * }))
 * console.log(text.includes("## Issues")) // true
 * ```
 *
 * @param report - Full in-memory migration plan.
 * @returns Stable Markdown report without embedded manifest or event payloads.
 * @category formatting
 * @since 0.0.0
 */
export const renderTranslationReport = (report: TranslationReport): string => {
  const translationLines = A.map(
    report.translations,
    (item) =>
      `- \`${item.slug}\`: ${A.join(item.edits, "; ")} (${A.join(item.drift, ", ")}); seed=${A.some(report.seeds, (seed) => seed.slug === item.slug) ? "yes" : "no"}`
  );
  const issueLines = A.appendAll(
    A.map(report.issues, (item) => `- ${item.severity}: \`${item.slug}\` — ${item.message}`),
    A.map(report.fleetFindings, (item) => `- ${item.severity}: \`${item.slug}\` [${item.kind}] — ${item.message}`)
  );
  const assumptionLines = A.map(report.assumptions, (item) => `- \`${item.slug}\` — ${item.message}`);
  return `${A.join(
    [
      "# Packet convention migration report",
      "",
      `Mode: \`${report.mode}\``,
      `Probed: ${A.length(report.probes)} goal manifests`,
      `Translations: ${A.length(report.translations)}`,
      `Genesis seeds: ${A.length(report.seeds)}`,
      "",
      "## Drift summary",
      "",
      `- breaking: ${countDrift(report.translations, "breaking")} packets`,
      `- additive: ${countDrift(report.translations, "additive")} packets`,
      `- cosmetic: ${countDrift(report.translations, "cosmetic")} packets`,
      "",
      "## Translations",
      "",
      ...(A.isReadonlyArrayNonEmpty(translationLines) ? translationLines : ["None."]),
      "",
      "## Issues",
      "",
      ...(A.isReadonlyArrayNonEmpty(issueLines) ? issueLines : ["None."]),
      "",
      "## Assumptions",
      "",
      ...(A.isReadonlyArrayNonEmpty(assumptionLines) ? assumptionLines : ["None."]),
      "",
      "## Fleet lint",
      "",
      `Duplicate slugs: ${A.length(A.filter(report.fleetFindings, (item) => item.kind === "duplicate-slug"))}`,
      `Dependency cycles: ${A.length(A.filter(report.fleetFindings, (item) => item.kind === "dependency-cycle"))}`,
      `Unreachable packet references: ${A.length(A.filter(report.fleetFindings, (item) => item.kind === "unreachable-packet"))}`,
      `Known but not-yet-v2 references: ${A.length(A.filter(report.fleetFindings, (item) => item.kind === "unmigrated-reference"))}`,
    ],
    "\n"
  )}\n`;
};

type ManifestSnapshot = {
  readonly packetRoot: string;
  readonly path: string;
  readonly original: string;
  readonly expected: string;
  readonly slug: string;
};

type SeedSnapshot = {
  readonly eventsDirectory: string;
  readonly packetRoot: string;
  readonly priorEventsPresent: boolean;
  readonly priorTrace: O.Option<string>;
  readonly seed: PacketGenesisSeed;
};

const ensureMigrationApplicable = Effect.fn("Goals.ensureMigrationApplicable")(function* (report: TranslationReport) {
  const blocking =
    A.some(report.issues, (item) => item.severity === "violation") ||
    A.some(report.fleetFindings, (item) => item.severity === "violation");
  if (blocking) return yield* PacketStreamError.new("fleet", "migration report contains violations; apply refused");
});

const snapshotManifestTranslations = Effect.fn("Goals.snapshotManifestTranslations")(function* (plan: ConventionPlan) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let snapshots = A.empty<ManifestSnapshot>();
  for (const translation of plan.report.translations) {
    const record = A.findFirst(plan.records, (item) => item.slug === translation.slug);
    if (O.isNone(record) || record.value.manifestText === undefined) {
      return yield* PacketStreamError.new(translation.slug, "manifest source disappeared after planning");
    }
    const content = yield* fs
      .readFileString(translation.manifestPath)
      .pipe(
        Effect.mapError((error) =>
          PacketStreamError.new(translation.slug, `manifest snapshot failed: ${error.message}`)
        )
      );
    if (content !== record.value.manifestText) {
      return yield* PacketStreamError.new(translation.slug, "manifest changed after planning; re-run preview");
    }
    snapshots = A.append(snapshots, {
      packetRoot: path.resolve(record.value.packetPath),
      path: path.resolve(translation.manifestPath),
      original: content,
      expected: translation.content,
      slug: translation.slug,
    });
  }
  return snapshots;
});

const readOptionalSnapshot = Effect.fn("Goals.readOptionalSnapshot")(function* (filePath: string, context: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(filePath).pipe(
    Effect.asSome,
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeed(O.none<string>())
    ),
    Effect.mapError((error) => PacketStreamError.new("fleet", `${context}: ${error.message}`))
  );
});

const snapshotGenesisSeeds = Effect.fn("Goals.snapshotGenesisSeeds")(function* (
  seeds: ReadonlyArray<PacketGenesisSeed>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let snapshots = A.empty<SeedSnapshot>();
  for (const seed of seeds) {
    const streamPresent = yield* fs
      .exists(seed.eventsDirectory)
      .pipe(
        Effect.mapError((error) => PacketStreamError.new(seed.slug, `event stream inspection failed: ${error.message}`))
      );
    if (streamPresent && !(yield* isRecoverableGenesisSeed(seed))) {
      return yield* PacketStreamError.new(seed.slug, "event stream appeared after planning; re-run preview");
    }
    snapshots = A.append(snapshots, {
      eventsDirectory: path.resolve(seed.eventsDirectory),
      packetRoot: path.resolve(path.dirname(path.dirname(seed.eventsDirectory))),
      priorEventsPresent: streamPresent,
      priorTrace: yield* readOptionalSnapshot(seed.tracePath, `trace snapshot failed for ${seed.slug}`),
      seed,
    });
  }
  return snapshots;
});

const rollbackManifest = Effect.fn("Goals.rollbackManifest")(function* (snapshot: ManifestSnapshot) {
  const fs = yield* FileSystem.FileSystem;
  const current = yield* fs
    .readFileString(snapshot.path)
    .pipe(
      Effect.mapError((error) =>
        PacketStreamError.new(snapshot.slug, `manifest rollback read failed: ${error.message}`)
      )
    );
  if (current !== snapshot.expected) {
    return yield* PacketStreamError.new(
      snapshot.slug,
      "manifest rollback conflict: bytes changed after migration wrote them"
    );
  }
  yield* writeContainedFileString(snapshot.packetRoot, snapshot.path, snapshot.original).pipe(
    Effect.mapError((error) =>
      PacketStreamError.new(snapshot.slug, `manifest rollback restore failed: ${error.message}`)
    )
  );
});

const rollbackSeed = Effect.fn("Goals.rollbackSeed")(function* (snapshot: SeedSnapshot) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!snapshot.priorEventsPresent) {
    const eventPath = path.join(snapshot.eventsDirectory, snapshot.seed.eventFileName);
    const entries = yield* fs
      .readDirectory(snapshot.eventsDirectory)
      .pipe(
        Effect.mapError((error) =>
          PacketStreamError.new(snapshot.seed.slug, `seed rollback scan failed: ${error.message}`)
        )
      );
    if (A.length(entries) !== 1 || entries[0] !== snapshot.seed.eventFileName) {
      return yield* PacketStreamError.new(
        snapshot.seed.slug,
        "seed rollback conflict: event directory contains foreign bytes"
      );
    }
    const eventText = yield* fs
      .readFileString(eventPath)
      .pipe(
        Effect.mapError((error) =>
          PacketStreamError.new(snapshot.seed.slug, `seed rollback event read failed: ${error.message}`)
        )
      );
    if (eventText !== snapshot.seed.eventText) {
      return yield* PacketStreamError.new(snapshot.seed.slug, "seed rollback conflict: event bytes changed");
    }
  }
  const traceText = yield* fs
    .readFileString(snapshot.seed.tracePath)
    .pipe(
      Effect.mapError((error) =>
        PacketStreamError.new(snapshot.seed.slug, `seed rollback trace read failed: ${error.message}`)
      )
    );
  if (traceText !== snapshot.seed.traceText) {
    return yield* PacketStreamError.new(snapshot.seed.slug, "seed rollback conflict: trace bytes changed");
  }
  yield* O.match(snapshot.priorTrace, {
    onNone: () =>
      fs
        .remove(snapshot.seed.tracePath)
        .pipe(
          Effect.mapError((error) =>
            PacketStreamError.new(snapshot.seed.slug, `seed rollback trace remove failed: ${error.message}`)
          )
        ),
    onSome: (original) =>
      writeContainedFileString(snapshot.packetRoot, path.resolve(snapshot.seed.tracePath), original).pipe(
        Effect.mapError((error) =>
          PacketStreamError.new(snapshot.seed.slug, `seed rollback trace restore failed: ${error.message}`)
        )
      ),
  });
  if (!snapshot.priorEventsPresent) yield* quarantineOwnedGenesisEvents(snapshot.seed, "seed rollback");
});

const rollbackConventionMutation = Effect.fn("Goals.rollbackConventionMutation")(function* (
  writtenManifests: ReadonlyArray<ManifestSnapshot>,
  appliedSeeds: ReadonlyArray<SeedSnapshot>
) {
  let failures = A.empty<string>();
  for (const snapshot of A.reverse(appliedSeeds)) {
    const result = yield* Effect.result(rollbackSeed(snapshot));
    if (Result.isFailure(result)) failures = A.append(failures, result.failure.message);
  }
  for (const snapshot of A.reverse(writtenManifests)) {
    const result = yield* Effect.result(rollbackManifest(snapshot));
    if (Result.isFailure(result)) failures = A.append(failures, result.failure.message);
  }
  if (A.isReadonlyArrayNonEmpty(failures)) {
    return yield* PacketStreamError.new("fleet", `rollback incomplete: ${A.join(failures, "; ")}`);
  }
});

const promoteManifestTranslation = Effect.fn("Goals.promoteManifestTranslation")(function* (
  translation: ManifestTranslation,
  snapshots: ReadonlyArray<ManifestSnapshot>
) {
  const fs = yield* FileSystem.FileSystem;
  const snapshot = A.findFirst(snapshots, (item) => item.slug === translation.slug);
  if (O.isNone(snapshot)) {
    return yield* PacketStreamError.new(translation.slug, "manifest snapshot missing before promotion");
  }
  const current = yield* fs
    .readFileString(snapshot.value.path)
    .pipe(
      Effect.mapError((error) =>
        PacketStreamError.new(translation.slug, `manifest promotion recheck failed: ${error.message}`)
      )
    );
  if (current !== snapshot.value.original) {
    return yield* PacketStreamError.new(translation.slug, "manifest changed before promotion; apply refused");
  }
  yield* writeContainedFileString(snapshot.value.packetRoot, snapshot.value.path, snapshot.value.expected).pipe(
    Effect.mapError((error) =>
      PacketStreamError.new(translation.slug, `manifest translation write failed: ${error.message}`)
    )
  );
  return snapshot.value;
});

const promoteGenesisSeed = Effect.fn("Goals.promoteGenesisSeed")(function* (
  seed: PacketGenesisSeed,
  snapshots: ReadonlyArray<SeedSnapshot>
) {
  const snapshot = A.findFirst(snapshots, (item) => item.seed.slug === seed.slug);
  if (O.isNone(snapshot)) {
    return yield* PacketStreamError.new(seed.slug, "seed snapshot missing before promotion");
  }
  yield* applyPacketGenesisSeed(seed);
  return snapshot.value;
});

const ensurePostApplyClean = Effect.fn("Goals.ensurePostApplyClean")(function* (report: TranslationReport) {
  const dirty =
    A.isReadonlyArrayNonEmpty(report.translations) ||
    A.isReadonlyArrayNonEmpty(report.seeds) ||
    A.isReadonlyArrayNonEmpty(report.issues) ||
    A.isReadonlyArrayNonEmpty(report.fleetFindings);
  if (dirty) {
    return yield* PacketStreamError.new("fleet", "post-apply preview is not empty; all writes were rolled back");
  }
});

const applyConventionPlan = Effect.fn("Goals.applyConventionPlan")(function* (
  plan: ConventionPlan,
  reportPath: string,
  at: string
) {
  yield* ensureMigrationApplicable(plan.report);
  const reportCoordinates = yield* conventionReportCoordinates(reportPath);
  const manifestSnapshots = yield* snapshotManifestTranslations(plan);
  const seedSnapshots = yield* snapshotGenesisSeeds(plan.report.seeds);
  let writtenManifests = A.empty<ManifestSnapshot>();
  let appliedSeeds = A.empty<SeedSnapshot>();

  const mutation = Effect.gen(function* () {
    for (const translation of plan.report.translations) {
      writtenManifests = A.append(writtenManifests, yield* promoteManifestTranslation(translation, manifestSnapshots));
    }
    for (const seed of plan.report.seeds) {
      appliedSeeds = A.append(appliedSeeds, yield* promoteGenesisSeed(seed, seedSnapshots));
    }
    const after = yield* planConventionMigration("preview", at);
    yield* ensurePostApplyClean(after.report);
    yield* writeContainedFileString(
      reportCoordinates.root,
      reportCoordinates.target,
      `${renderTranslationReport(plan.report)}${postApplyProof(after.report)}`
    ).pipe(
      Effect.mapError((error) => PacketStreamError.new("fleet", `verified report write failed: ${error.message}`))
    );
    return after.report;
  });
  return yield* mutation.pipe(
    Effect.matchEffect({
      onFailure: (original) =>
        rollbackConventionMutation(writtenManifests, appliedSeeds).pipe(
          Effect.matchEffect({
            onFailure: (cleanup) =>
              Effect.fail(PacketStreamError.new("fleet", `${original.message}; rollback failed: ${cleanup.message}`)),
            onSuccess: () => Effect.fail(original),
          })
        ),
      onSuccess: Effect.succeed,
    })
  );
});

const postApplyProof = (report: TranslationReport): string => `
## Post-apply verification

- remaining translations: ${A.length(report.translations)}
- remaining genesis seeds: ${A.length(report.seeds)}
- translation issues: ${A.length(report.issues)}
- fleet findings: ${A.length(report.fleetFindings)}
`;

const atFlag = Flag.string("at").pipe(
  Flag.optional,
  Flag.withDescription("Explicit ISO adoption timestamp for deterministic genesis events; defaults to now")
);
const reportFlag = Flag.string("report").pipe(
  Flag.withDefault(PACKET_CONVENTION_REPORT_PATH),
  Flag.withDescription("Markdown report path beneath goals/packet-convention-migration/history")
);

type MigrateConventionsCommandInput = {
  readonly preview: boolean;
  readonly apply: boolean;
  readonly at: O.Option<string>;
  readonly report: string;
};

/**
 * `beep goals migrate-conventions` fleet preview/apply command.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { goalsMigrateConventionsCommand } from "@beep/repo-cli/commands/Goals/Migration/Migration.command"
 *
 * console.log(goalsMigrateConventionsCommand.name) // "migrate-conventions"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const goalsMigrateConventionsCommand = Command.make(
  "migrate-conventions",
  { preview: previewFlag, apply: applyFlag, at: atFlag, report: reportFlag },
  Effect.fn(function* ({ preview, apply, at, report }: MigrateConventionsCommandInput) {
    return yield* Effect.gen(function* () {
      const usage = "Usage: beep goals migrate-conventions --preview|--apply [--at <ISO timestamp>]";
      const mode = yield* requireExclusiveMode(preview, apply, usage);
      const timestamp = O.isSome(at) ? at.value : DateTime.formatIso(yield* DateTime.now);
      if (!S.is(PacketEventTimestamp)(timestamp)) {
        return yield* GoalStatusInputError.new(`--at must be a full ISO-8601 date-time; received "${timestamp}".`);
      }
      if (mode === "apply") yield* conventionReportCoordinates(report);
      const plan = yield* planConventionMigration(mode, timestamp);
      const rendered = renderTranslationReport(plan.report);
      yield* Console.log(rendered);
      if (mode === "preview") {
        yield* Console.log("[goals:migrate-conventions] preview only — nothing written.");
        return;
      }
      yield* ensureMigrationApplicable(plan.report);
      const hasMutations =
        A.isReadonlyArrayNonEmpty(plan.report.translations) || A.isReadonlyArrayNonEmpty(plan.report.seeds);
      if (!hasMutations) {
        yield* Console.log("[goals:migrate-conventions] fleet already conforms; existing report preserved.");
        return;
      }
      yield* applyConventionPlan(plan, report, timestamp);
      yield* Console.log(
        `[goals:migrate-conventions] applied ${A.length(plan.report.translations)} translation(s), ${A.length(plan.report.seeds)} seed(s); post-apply preview empty; report ${report}.`
      );
    }).pipe(
      Effect.catchTags({
        GoalStatusInputError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:migrate-conventions] ${error.message}`);
          return yield* failWithReportedExit(`goals migrate-conventions: ${error.message}`);
        }),
        PacketStreamError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:migrate-conventions] ${error.message}`);
          return yield* failWithReportedExit(`goals migrate-conventions: ${error.message}`);
        }),
      })
    );
  })
).pipe(
  Command.withDescription("Preview or apply the goal-fleet v2 convention migration"),
  Command.provide(migrationLayer)
);
