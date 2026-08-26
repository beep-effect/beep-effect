import { $SemanticaId } from "@beep/identity/packages";
import { Console, Effect, FileSystem, Layer, Path } from "effect";
import * as Bool from "effect/Boolean";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { GOLD_SUBSETS, proposeGold } from "@/canary/Gold";
import { CorpusManifest, ManifestWriteFailed } from "@/corpus/Manifest";
import { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import { GOLD_PROMPT_ARTIFACT_HASH } from "@/gold/Prompts";
import { LanguageModelRuntimeLive, XAiGoldModelIdentityLive, XAiGoldProviderLive } from "@/layers/LanguageModelLive";
import { LabConfig } from "@/runtime/Config";
import { CanaryStage } from "@/schema/Eval";
import { CanaryC0 } from "@/services/CanaryC0";
import type * as O from "effect/Option";
import type {
  AnchorRejected,
  C0ExecutionFailed,
  DocumentUnavailable,
  GoldUnavailable,
  LedgerFailed,
  ModelRevisionUnpinned,
  ReportInvalid,
} from "@/schema/Errors";
import type { GoldFile } from "@/schema/Gold";

export { CanaryStage } from "@/schema/Eval";

const $I = $SemanticaId.create("canary/Command");

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
 *   manifest: "fixtures/w1.manifest.json",
 *   offline: true,
 *   out: O.none(),
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
    out: S.OptionFromNullOr(S.NonEmptyString),
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
 *     manifest: "fixtures/w1.manifest.json",
 *     offline: true,
 *     out: O.none(),
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

const stageManifest = Flag.path("manifest").pipe(
  Flag.withDefault("fixtures/w1.manifest.json"),
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
const outputDirectory = Flag.path("out").pipe(
  Flag.optional,
  Flag.withDescription("Output directory for eval-report.json and eval-telemetry.json.")
);

const stageDescriptions: Record<CanaryStage, string> = {
  c0: "C0 spine: parse, CanonicalText, chunk, extract, ledger, EvalReport over F1 + W1.",
  c1: "C1 projections: dimension-keyed vector table and RDF rebuild-from-ledger.",
  c2: "C2 reasoning: rho-df closure against the EYE oracle, crash injection, Tier-L bars.",
};

const CanaryFlags = { manifest: stageManifest, offline, out: outputDirectory, paper };

const failStage = Effect.fn("SemanticaCanary.failStage")(function* (stage: CanaryStage, options: CanaryOptions) {
  return yield* StageNotImplemented.make({
    message: `Canary stage ${stage} is not implemented.`,
    options,
    stage,
  });
});

type CanaryStageFailure =
  | AnchorRejected
  | C0ExecutionFailed
  | DocumentUnavailable
  | GoldUnavailable
  | LedgerFailed
  | ModelRevisionUnpinned
  | ReportInvalid
  | StageNotImplemented;

const runStage = (stage: CanaryStage, options: CanaryOptions): Effect.Effect<void, CanaryStageFailure, CanaryC0> =>
  CanaryStage.$match(stage, {
    c0: () =>
      CanaryC0.pipe(
        Effect.flatMap((service) => service.run(options)),
        Effect.asVoid
      ),
    c1: () => failStage(stage, options),
    c2: () => failStage(stage, options),
  });

const makeStageCommand = (stage: CanaryStage) =>
  Command.make(stage, CanaryFlags, (options) => runStage(stage, CanaryOptions.make(options))).pipe(
    Command.withDescription(stageDescriptions[stage])
  );

const ManifestJson = S.fromJsonString(CorpusManifest, { space: 2 });

const manifestOutput = Flag.path("out").pipe(
  Flag.withDescription("Output path for the generated, pretty-printed W1 manifest.")
);

const manifestInput = Flag.path("manifest").pipe(
  Flag.withDefault("fixtures/w1.manifest.json"),
  Flag.withDescription("Committed W1 manifest to decode and verify against SEMANTICA_CORPUS_ROOT.")
);

const buildManifest = Effect.fn("SemanticaCanary.buildManifest")(function* ({ out }: { readonly out: string }) {
  const builder = yield* CorpusManifestBuilder;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const built = yield* builder.build;
  const json = yield* S.encodeEffect(ManifestJson)(built).pipe(Effect.orDie);
  yield* fs.makeDirectory(path.dirname(out), { recursive: true }).pipe(
    Effect.mapError(() =>
      ManifestWriteFailed.make({
        message: "The W1 manifest output directory could not be created.",
        manifestPath: out,
      })
    )
  );
  yield* fs.writeFileString(out, `${json}\n`).pipe(
    Effect.mapError(() =>
      ManifestWriteFailed.make({
        message: "The generated W1 manifest could not be written.",
        manifestPath: out,
      })
    )
  );
  yield* Console.log(built.corpusHash);
});

const checkManifest = Effect.fn("SemanticaCanary.checkManifest")(function* ({
  manifest,
}: {
  readonly manifest: string;
}) {
  const builder = yield* CorpusManifestBuilder;
  const checked = yield* builder.check(manifest);
  yield* Console.log(checked.corpusHash);
});

const ManifestCommand = Command.make("manifest").pipe(
  Command.withDescription("Build or check the committed manifest that defines the 25-paper W1 corpus."),
  Command.withSubcommands([
    Command.make("build", { out: manifestOutput }, buildManifest).pipe(
      Command.withDescription("Build W1 from the first 25 sorted corpus ids and write its manifest.")
    ),
    Command.make("check", { manifest: manifestInput }, checkManifest).pipe(
      Command.withDescription("Decode the W1 manifest and report row-level filesystem drift.")
    ),
  ])
);

const goldSubset = Flag.choice("subset", GOLD_SUBSETS).pipe(
  Flag.optional,
  Flag.withDescription("Propose every frozen paper in one gold subset.")
);

const runGoldProposal = Effect.fn("SemanticaCanary.runGoldProposal")(function* (options: {
  readonly manifest: string;
  readonly offline: boolean;
  readonly paper: O.Option<string>;
  readonly subset: O.Option<GoldFile["subset"]>;
}) {
  const config = yield* LabConfig;
  const selectedOffline = config.offline || options.offline;
  const selectedConfig = LabConfig.of({
    ...config,
    mode: Bool.match(selectedOffline, {
      onFalse: () => "live" as const,
      onTrue: () => "replay" as const,
    }),
    offline: selectedOffline,
  });
  const identity = XAiGoldModelIdentityLive({
    artifactHash: GOLD_PROMPT_ARTIFACT_HASH,
    model: config.goldModel,
  });
  const model = LanguageModelRuntimeLive(XAiGoldProviderLive(config.goldModel)).pipe(
    Layer.provide(identity),
    Layer.provide(Layer.succeed(LabConfig, selectedConfig))
  );
  return yield* Effect.scoped(
    Layer.build(Layer.merge(model, identity)).pipe(
      Effect.flatMap((modelContext) =>
        proposeGold({
          manifestPath: options.manifest,
          outputDirectory: "fixtures/gold/v1",
          paper: options.paper,
          subset: options.subset,
        }).pipe(Effect.provide(modelContext))
      )
    )
  );
});

const GoldCommand = Command.make("gold").pipe(
  Command.withDescription("Propose independently anchored gold-v1 labels."),
  Command.withSubcommands([
    Command.make("propose", { manifest: stageManifest, offline, paper, subset: goldSubset }, runGoldProposal).pipe(
      Command.withDescription("Propose frozen structure, entity, or relation labels through xAI or cache replay.")
    ),
  ])
);

/**
 * Headless Semantica canary command with manifest, gold, C0, C1, and C2
 * subcommands.
 *
 * **Details**
 *
 * C0 runs the parse, extraction, ledger, and evaluation workflow. C1 and C2
 * retain the typed {@link StageNotImplemented} boundary.
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
    ManifestCommand,
    GoldCommand,
    makeStageCommand(CanaryStage.Enum.c0),
    makeStageCommand(CanaryStage.Enum.c1),
    makeStageCommand(CanaryStage.Enum.c2),
  ])
);
