/**
 * `beep goals set-risk-tier` — operator-only risk-tier override writer.
 *
 * **Details**
 *
 * Records an operator override of a packet's risk tier as a
 * `risk-tier-overridden` event on the packet's CAS stream through the guarded
 * writer: `--preview` prints the fold-backed plan without writing, a real
 * write appends the event (seeding a genesis event when the stream is empty)
 * and regenerates the derived `ops/trace.json` projection. Overrides are
 * recorded and challengeable — the required `--reason` travels with the event
 * — and exist only in the stream, so the command refuses packets that have
 * not opted into event sourcing instead of degrading to a manifest edit; no
 * manifest, README, or index surface is touched.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import { Console, DateTime, Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import { GoalStatusInputError } from "./Goals.errors.ts";
import { PacketStreamError } from "./PacketCore/PacketCore.errors.ts";
import { isPacketRiskTier, isPacketSlug, PacketRiskTier } from "./PacketCore/PacketCore.schemas.ts";
import { PacketStreamLocator } from "./PacketCore/PacketEventStore.ts";
import {
  PacketCoreLive,
  PacketRiskTierOverrideRequest,
  PacketTransitionWriter,
} from "./PacketCore/PacketTransitionWriter.ts";
import { goalStagePosition, loadGoalPacketManifest, previewEventLine } from "./SetStatus.ts";
import type { PacketTransitionPlan } from "./PacketCore/PacketTransitionWriter.ts";

const TIER_DOMAIN = A.join(PacketRiskTier.Options, " | ");

const planOverrideForSlug = Effect.fn("Goals.planOverrideForSlug")(function* (
  slug: string,
  tier: PacketRiskTier,
  reason: string
) {
  const { decoded, record } = yield* loadGoalPacketManifest(slug);
  if (!isPacketSlug(slug)) {
    return yield* PacketStreamError.new(
      slug,
      `directory name "${slug}" is not a valid packet slug for an event stream.`
    );
  }
  const writer = yield* PacketTransitionWriter;
  const now = yield* DateTime.now;
  const position = goalStagePosition(decoded);
  const request = PacketRiskTierOverrideRequest.make({
    locator: PacketStreamLocator.make({ packet: slug, root: "goals", packetPath: record.packetPath }),
    tier,
    reason,
    genesisStatus: decoded.initiative.status,
    ...optionalProp(
      "genesisStage",
      O.map(position, (value) => value.stage)
    ),
    ...optionalProp(
      "genesisOrdinal",
      O.map(position, (value) => value.ordinal)
    ),
    actor: "operator",
    at: DateTime.formatIso(now),
  });
  return yield* writer.planRiskTierOverride(request);
});

const printOverridePreview = Effect.fn("Goals.printOverridePreview")(function* (
  slug: string,
  tier: PacketRiskTier,
  plan: PacketTransitionPlan
) {
  yield* Console.log(`[goals:set-risk-tier] preview ${slug}: override -> ${tier}`);
  const tipText = pipe(
    O.fromUndefinedOr(plan.currentTip),
    O.match({ onNone: () => "empty", onSome: (tip) => `${tip.seq}@${pipe(tip.id, Str.slice(0, 12))}` })
  );
  yield* Console.log(`[goals:set-risk-tier] stream: revision ${plan.currentRevision}, tip ${tipText}`);
  for (const event of plan.events) {
    yield* Console.log(`[goals:set-risk-tier] ${previewEventLine(event)}`);
  }
  const derived = O.fromUndefinedOr(plan.derivedAfter);
  if (O.isSome(derived)) {
    const override = derived.value.riskTierOverride;
    yield* Console.log(
      `[goals:set-risk-tier] derived after: revision=${derived.value.revision} riskTierOverride=${override?.tier ?? "—"}`
    );
  }
  yield* Console.log(`[goals:set-risk-tier] trace: ${plan.tracePath} (regenerated on write)`);
  yield* Console.log("[goals:set-risk-tier] preview only — nothing written.");
});

type SetRiskTierInput = {
  readonly preview: boolean;
  readonly reason: string;
  readonly slug: O.Option<string>;
  readonly tier: O.Option<string>;
};

const runSetRiskTierProgram = Effect.fn("Goals.runSetRiskTierProgram")(function* (input: SetRiskTierInput) {
  if (O.isNone(input.slug) || O.isNone(input.tier)) {
    return yield* GoalStatusInputError.new(
      `Usage: beep goals set-risk-tier <slug> <tier> --reason "..." with tier one of ${TIER_DOMAIN}.`
    );
  }
  if (!isPacketRiskTier(input.tier.value)) {
    return yield* GoalStatusInputError.new(`Unknown tier "${input.tier.value}"; expected one of ${TIER_DOMAIN}.`);
  }
  const reason = Str.trim(input.reason);
  if (Str.isEmpty(reason)) {
    return yield* GoalStatusInputError.new(
      "--reason is required: every risk-tier override records a challengeable operator reason."
    );
  }
  const slug = input.slug.value;
  const tier = input.tier.value;
  const plan = yield* planOverrideForSlug(slug, tier, reason);
  if (input.preview) {
    return yield* printOverridePreview(slug, tier, plan);
  }
  const writer = yield* PacketTransitionWriter;
  const outcome = yield* writer.commit(plan);
  yield* Console.log(
    `[goals:set-risk-tier] ${slug}: appended ${outcome.appended} event(s); regenerated ${outcome.tracePath}.`
  );
  yield* Console.log(`[goals:set-risk-tier] ${slug}: risk tier override -> ${tier} (${reason}).`);
});

const slugArgument = Argument.string("slug").pipe(
  Argument.withDescription("Goal packet slug under goals/"),
  Argument.optional
);
const tierArgument = Argument.string("tier").pipe(
  Argument.withDescription(`Risk tier: ${TIER_DOMAIN}`),
  Argument.optional
);
const reasonFlag = Flag.string("reason").pipe(
  Flag.withDescription("Recorded, challengeable reason for the override (required)"),
  Flag.withDefault("")
);
const previewFlag = Flag.boolean("preview").pipe(
  Flag.withDescription("Print the guarded override plan (fold, events to append, derived state) without writing")
);

/**
 * `bun run beep goals set-risk-tier` — operator risk-tier override writer.
 *
 * **Example** (Import and log command name)
 *
 * ```ts
 * import { goalsSetRiskTierCommand } from "@beep/repo-cli/commands/Goals/SetRiskTier"
 *
 * console.log(goalsSetRiskTierCommand.name)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const goalsSetRiskTierCommand = Command.make(
  "set-risk-tier",
  { slug: slugArgument, tier: tierArgument, reason: reasonFlag, preview: previewFlag },
  Effect.fn(function* ({ preview, reason, slug, tier }) {
    return yield* runSetRiskTierProgram({ preview, reason, slug, tier }).pipe(
      Effect.catchTags({
        GoalStatusInputError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-risk-tier] ${error.message}`);
          return yield* failWithReportedExit(`goals set-risk-tier: ${error.message}`);
        }),
        GoalPacketNotFoundError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-risk-tier] ${error.message}`);
          return yield* failWithReportedExit(`goals set-risk-tier: ${error.message}`);
        }),
        GoalManifestInvalidError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-risk-tier] ${error.message}`);
          return yield* failWithReportedExit(`goals set-risk-tier: ${error.message}`);
        }),
        PacketStreamError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-risk-tier] ${error.message}`);
          return yield* failWithReportedExit(`goals set-risk-tier: ${error.message}`);
        }),
        PacketCasConflictError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:set-risk-tier] ${error.message}`);
          return yield* failWithReportedExit(`goals set-risk-tier: ${error.message}`);
        }),
      })
    );
  })
).pipe(
  Command.withDescription("Record an operator risk-tier override on a packet's event stream (stream + trace only)"),
  Command.provide(PacketCoreLive)
);
