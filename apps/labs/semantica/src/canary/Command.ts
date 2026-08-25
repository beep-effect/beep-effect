import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";

const $I = $SemanticaId.create("canary/Command");

/**
 * Canary stages exposed by the headless Semantica command.
 *
 * **Example** (Check a stage)
 *
 * ```ts
 * import { CanaryStage } from "@/canary/Command"
 *
 * console.log(CanaryStage.is.c0("c0")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CanaryStage = LiteralKit(["c0", "c1", "c2"]).pipe(
  $I.annoteSchema("CanaryStage", {
    description: "Headless Semantica canary stages available through the lab command.",
  })
);

/**
 * Runtime value accepted by {@link CanaryStage}.
 *
 * @see {@link CanaryStage} for the runtime schema and stage helpers.
 * @category models
 * @since 0.0.0
 */
export type CanaryStage = typeof CanaryStage.Type;

/**
 * Parsed options shared by every Semantica canary stage.
 *
 * **Example** (Create offline options)
 *
 * ```ts
 * import { CanaryOptions } from "@/canary/Command"
 * import * as O from "effect/Option"
 *
 * const options = CanaryOptions.make({
 *   manifest: "w1.manifest.json",
 *   offline: true,
 *   paper: O.some("paper-001")
 * })
 * console.log(options.offline) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CanaryOptions extends S.Class<CanaryOptions>($I`CanaryOptions`)(
  {
    manifest: S.NonEmptyString,
    offline: S.Boolean,
    paper: S.OptionFromNullOr(S.NonEmptyString),
  },
  $I.annote("CanaryOptions", {
    description: "Manifest, paper selection, and replay mode parsed for one canary stage.",
  })
) {}

/**
 * Reports that a requested canary stage has no P1 implementation.
 *
 * **Example** (Inspect the requested stage)
 *
 * ```ts
 * import { CanaryOptions, StageNotImplemented } from "@/canary/Command"
 * import * as O from "effect/Option"
 *
 * const error = StageNotImplemented.make({
 *   message: "Canary stage c0 is not implemented.",
 *   stage: "c0",
 *   options: CanaryOptions.make({
 *     manifest: "w1.manifest.json",
 *     offline: true,
 *     paper: O.none()
 *   })
 * })
 * console.log(error._tag) // "StageNotImplemented"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class StageNotImplemented extends S.TaggedError<StageNotImplemented>($I`StageNotImplemented`)(
  "StageNotImplemented",
  {
    message: S.String,
    options: CanaryOptions,
    stage: CanaryStage,
  },
  $I.annoteError<StageNotImplemented>("StageNotImplemented", {
    description: "Expected failure raised when a scaffolded canary stage is invoked before its implementation lands.",
  })
) {}

const manifest = Flag.path("manifest").pipe(
  Flag.withDefault("w1.manifest.json"),
  Flag.withDescription("Committed W1 corpus manifest (id, sha256, bytes per paper); never a directory.")
);
const offline = Flag.boolean("offline").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Replay from the content-addressed provider cache with the network off.")
);
const paper = Flag.string("paper").pipe(
  Flag.optional,
  Flag.withDescription("Restrict the stage to one W1 paper id from the manifest.")
);

const stageDescriptions: Record<CanaryStage, string> = {
  c0: "C0 spine: parse, CanonicalText, chunk, extract, ledger, EvalReport over F1 + W1.",
  c1: "C1 projections: dimension-keyed vector table and RDF rebuild-from-ledger.",
  c2: "C2 reasoning: rho-df closure against the EYE oracle, crash injection, Tier-L bars.",
};

const CanaryFlags = { manifest, offline, paper };

const failStage = Effect.fn("SemanticaCanary.failStage")(function* (stage: CanaryStage, options: CanaryOptions) {
  return yield* StageNotImplemented.make({
    message: `Canary stage ${stage} is not implemented.`,
    options,
    stage,
  });
});

const makeStageCommand = (stage: CanaryStage) =>
  Command.make(stage, CanaryFlags, (options) => failStage(stage, CanaryOptions.make(options))).pipe(
    Command.withDescription(stageDescriptions[stage])
  );

/**
 * Headless Semantica canary command with C0, C1, and C2 subcommands.
 *
 * **Details**
 *
 * P1 exposes the final command shape while each stage fails with
 * {@link StageNotImplemented}. Stage services replace that failure in P2 and later.
 *
 * **Example** (Create a programmatic runner)
 *
 * ```ts
 * import { CanaryCommand } from "@/canary/Command"
 * import { Command } from "effect/unstable/cli"
 *
 * const runCanary = Command.runWith(CanaryCommand, { version: "0.0.0" })
 * console.log(typeof runCanary) // "function"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const CanaryCommand = Command.make("canary").pipe(
  Command.withDescription("Headless Semantica canary over F1 + the W1 manifest; each stage runs live, then --offline."),
  Command.withSubcommands([
    makeStageCommand(CanaryStage.Enum.c0),
    makeStageCommand(CanaryStage.Enum.c1),
    makeStageCommand(CanaryStage.Enum.c2),
  ])
);
