/**
 * Packet-convention migration command surfaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import { Console, DateTime, Effect, FileSystem, Layer, Path } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import { GoalStatusInputError } from "../Goals.errors.ts";
import { listGoalPackets } from "../Inventory.ts";
import { PacketStreamError } from "../PacketCore/PacketCore.errors.ts";
import { isPacketSlug, PacketRoot } from "../PacketCore/PacketCore.schemas.ts";
import { PacketStreamLocator } from "../PacketCore/PacketEventStore.ts";
import { PacketCoreLive } from "../PacketCore/PacketTransitionWriter.ts";
import { lintGoalFleet, planManifestTranslation } from "./ManifestTranslation.ts";
import { TranslationReport } from "./Migration.schemas.ts";
import {
  applyPacketGenesisSeed,
  PacketForkRepairApplier,
  PacketForkRepairApplierLive,
  planPacketGenesisSeed,
} from "./PacketMutation.ts";
import type { GoalPacketRecord } from "../Inventory.ts";
import type { ManifestTranslation, PacketGenesisSeed } from "./Migration.schemas.ts";

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

const planConventionMigration = Effect.fn("Goals.planConventionMigration")(function* (
  mode: "preview" | "apply",
  at: string
) {
  const records = yield* listGoalPackets();
  const plans = A.map(records, planManifestTranslation);
  const translations = A.getSomes(A.map(plans, (plan) => plan.translation));
  let seeds = A.empty<PacketGenesisSeed>();
  for (const translation of translations) {
    const record = O.getOrUndefined(A.findFirst(records, (item) => item.slug === translation.slug));
    if (record !== undefined) {
      const seed = yield* planPacketGenesisSeed(record, translation.content, at);
      if (O.isSome(seed)) seeds = A.append(seeds, seed.value);
    }
  }
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

const applyConventionPlan = Effect.fn("Goals.applyConventionPlan")(function* (
  plan: ConventionPlan,
  reportPath: string
) {
  const blocking =
    A.some(plan.report.issues, (item) => item.severity === "violation") ||
    A.some(plan.report.fleetFindings, (item) => item.severity === "violation");
  if (blocking) return yield* PacketStreamError.new("fleet", "migration report contains violations; apply refused");
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const translation of plan.report.translations) {
    yield* fs
      .writeFileString(translation.manifestPath, translation.content)
      .pipe(
        Effect.mapError((error) =>
          PacketStreamError.new(translation.slug, `manifest translation write failed: ${String(error)}`)
        )
      );
  }
  for (const seed of plan.report.seeds) yield* applyPacketGenesisSeed(seed);
  yield* fs
    .makeDirectory(path.dirname(reportPath), { recursive: true })
    .pipe(Effect.mapError((error) => PacketStreamError.new("fleet", `report directory failed: ${String(error)}`)));
  yield* fs
    .writeFileString(reportPath, renderTranslationReport(plan.report))
    .pipe(Effect.mapError((error) => PacketStreamError.new("fleet", `report write failed: ${String(error)}`)));
});

const postApplyProof = (report: TranslationReport): string => `
## Post-apply verification

- remaining translations: ${A.length(report.translations)}
- remaining genesis seeds: ${A.length(report.seeds)}
- translation issues: ${A.length(report.issues)}
- fleet findings: ${A.length(report.fleetFindings)}
`;

const writeVerifiedReport = Effect.fn("Goals.writeVerifiedConventionReport")(function* (
  reportPath: string,
  applied: TranslationReport,
  after: TranslationReport
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .writeFileString(reportPath, `${renderTranslationReport(applied)}${postApplyProof(after)}`)
    .pipe(Effect.mapError((error) => PacketStreamError.new("fleet", `verified report write failed: ${String(error)}`)));
});

const atFlag = Flag.string("at").pipe(
  Flag.optional,
  Flag.withDescription("Explicit ISO adoption timestamp for deterministic genesis events; defaults to now")
);
const reportFlag = Flag.string("report").pipe(
  Flag.withDefault(PACKET_CONVENTION_REPORT_PATH),
  Flag.withDescription("Committed Markdown report path written on apply")
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
      const plan = yield* planConventionMigration(mode, timestamp);
      const rendered = renderTranslationReport(plan.report);
      yield* Console.log(rendered);
      if (mode === "preview") {
        yield* Console.log("[goals:migrate-conventions] preview only — nothing written.");
        return;
      }
      yield* applyConventionPlan(plan, report);
      const after = yield* planConventionMigration("preview", timestamp);
      const clean =
        !A.isReadonlyArrayNonEmpty(after.report.translations) &&
        !A.isReadonlyArrayNonEmpty(after.report.seeds) &&
        !A.isReadonlyArrayNonEmpty(after.report.issues) &&
        !A.isReadonlyArrayNonEmpty(after.report.fleetFindings);
      yield* writeVerifiedReport(report, plan.report, after.report);
      if (!clean) {
        return yield* PacketStreamError.new(
          "fleet",
          "post-apply preview is not empty; inspect the committed migration report"
        );
      }
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
).pipe(Command.withDescription("Preview or apply the goal-fleet v2 convention migration"));
