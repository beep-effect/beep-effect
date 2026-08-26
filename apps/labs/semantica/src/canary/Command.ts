import { $SemanticaId } from "@beep/identity/packages";
import { Console, Effect, FileSystem, Path } from "effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { CorpusManifest, ManifestWriteFailed } from "@/corpus/Manifest";
import { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import { CanaryStage } from "@/schema/Eval";

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
 *     manifest: "fixtures/w1.manifest.json",
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

const stageDescriptions: Record<CanaryStage, string> = {
  c0: "C0 spine: parse, CanonicalText, chunk, extract, ledger, EvalReport over F1 + W1.",
  c1: "C1 projections: dimension-keyed vector table and RDF rebuild-from-ledger.",
  c2: "C2 reasoning: rho-df closure against the EYE oracle, crash injection, Tier-L bars.",
};

const CanaryFlags = { manifest: stageManifest, offline, paper };

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

/**
 * Headless Semantica canary command with manifest, C0, C1, and C2 subcommands.
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
    ManifestCommand,
    makeStageCommand(CanaryStage.Enum.c0),
    makeStageCommand(CanaryStage.Enum.c1),
    makeStageCommand(CanaryStage.Enum.c2),
  ])
);
