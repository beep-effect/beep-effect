/**
 * Record one sanitized successful provider extraction for offline golden replay.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ANTHROPIC_DEFAULT_MODEL, AnthropicLanguageModelLive } from "@beep/anthropic";
import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { GroundedExtraction, LangExtractRequest } from "@beep/langextract/Extraction";
import {
  allowRemoteExtractionPolicyLayer,
  LangExtractService,
  layer as LangExtractServiceLive,
} from "@beep/langextract/Service";
import { ExtractionExample, ExtractionExampleItem, ExtractionTarget } from "@beep/langextract/Target";
import { DocumentId } from "@beep/nlp/Core";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { VENICE_CHAT_MODEL, VeniceAI, VeniceAiLanguageModel } from "@beep/venice-ai";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Config, DateTime, Effect, FileSystem, Layer, Match, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { strToU8 } from "fflate";
import {
  PROVIDER_RECORDING_DOCUMENT_ID,
  ProviderCandidate,
  ProviderCandidateListFromJsonString,
  ProviderRecording,
  ProviderRecordingFromJsonString,
} from "@/domain/Bundle";
import { IsoTimestamp } from "@/domain/Ontology";
import { RFQ_A_OUTLOOK_BODY } from "@/fixtures/Sources";
import { verifyProviderRecording } from "@/workflows/ProviderRecording";

const $I = $LejeuneBoltWorkbenchId.create("server/provider-smoke");
const RECORDING_PATH = "src/fixtures/provider-recording.json";
const DEFAULT_REVIEW_RECORDING_PATH = ".beep/lejeune-provider-recording-review.json";
const ProviderKind = LiteralKit(["anthropic", "venice-ai"]);
const RecordingMode = LiteralKit(["freeze", "reviewed-refresh"]);
const RecordingTargetKind = LiteralKit(["frozen", "review-candidate"]);

/**
 * Typed failure at the live-provider recording boundary.
 *
 * **Example** (Identify a write-once conflict)
 *
 * ```ts
 * import { ProviderSmokeError } from "../server/provider-smoke"
 *
 * const error = ProviderSmokeError.make({
 *   message: "The frozen recording already exists.",
 *   stage: "preflight"
 * })
 *
 * console.log(error._tag) // ProviderSmokeError
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProviderSmokeError extends S.TaggedError<ProviderSmokeError>($I`ProviderSmokeError`)(
  "ProviderSmokeError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })),
    message: S.NonEmptyString,
    stage: S.NonEmptyString,
  },
  $I.annoteError<ProviderSmokeError>("ProviderSmokeError", {
    title: "LeJeune provider smoke error",
    description: "A typed failure while extracting or atomically writing a sanitized provider recording.",
  })
) {}

class RecordingTarget extends S.Class<RecordingTarget>($I`RecordingTarget`)(
  {
    kind: RecordingTargetKind,
    mode: RecordingMode,
    path: S.NonEmptyString,
  },
  $I.annote("RecordingTarget", {
    description: "A preflighted write-once destination for a frozen recording or review candidate.",
  })
) {}

const providerSmokeError = (stage: string, message: string): ProviderSmokeError =>
  ProviderSmokeError.make({ message, stage });

const providerSmokeErrorWithCause = (stage: string, message: string, cause: unknown): ProviderSmokeError =>
  ProviderSmokeError.make({ cause, message, stage });

const configuredProviderKind = Config.string("LEJEUNE_PROVIDER").pipe(
  Config.withDefault("anthropic"),
  Effect.flatMap(S.decodeUnknownEffect(ProviderKind)),
  Effect.mapError((cause) =>
    providerSmokeErrorWithCause("configuration", "The selected provider is not authorized for this smoke.", cause)
  )
);

const configuredRecordingMode = Config.string("LEJEUNE_RECORDING_MODE").pipe(
  Config.withDefault("freeze"),
  Effect.flatMap(S.decodeUnknownEffect(RecordingMode)),
  Effect.mapError((cause) =>
    providerSmokeErrorWithCause("configuration", "The provider recording mode is invalid.", cause)
  )
);

const request = LangExtractRequest.make({
  documentId: DocumentId.make("lejeune-provider-smoke-rfq-a"),
  examples: [
    ExtractionExample.make({
      extractions: [
        ExtractionExampleItem.make({ label: "project", text: "River Pier Retrofit" }),
        ExtractionExampleItem.make({ label: "delivery_date", text: "2026-09-01" }),
        ExtractionExampleItem.make({ label: "finish", text: "plain" }),
      ],
      text: "SYNTHETIC RFQ | Project River Pier Retrofit | Delivery 2026-09-01 | Finish plain",
    }),
  ],
  targets: [
    ExtractionTarget.make({ kind: "entity", name: "project" }),
    ExtractionTarget.make({ kind: "attribute", name: "delivery_date" }),
    ExtractionTarget.make({ kind: "attribute", name: "finish" }),
  ],
  text: RFQ_A_OUTLOOK_BODY,
});

const removeOwnedTemporary = Effect.fn("LeJeuneProviderSmoke.removeOwnedTemporary")(function* (temporary: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(temporary)
    .pipe(
      Effect.mapError((cause) =>
        providerSmokeErrorWithCause("cleanup", "Could not inspect the temporary recording.", cause)
      )
    );
  if (exists) {
    yield* fs
      .remove(temporary)
      .pipe(
        Effect.mapError((cause) =>
          providerSmokeErrorWithCause("cleanup", "Could not remove the temporary recording.", cause)
        )
      );
  }
});

const writeRecordingAtomically = Effect.fn("LeJeuneProviderSmoke.writeRecordingAtomically")(function* (
  target: string,
  recordingJson: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const parent = path.dirname(target);
  yield* fs
    .makeDirectory(parent, { recursive: true })
    .pipe(
      Effect.mapError((cause) =>
        providerSmokeErrorWithCause("recording-write", "The recording parent directory could not be created.", cause)
      )
    );
  const targetExists = yield* fs
    .exists(target)
    .pipe(
      Effect.mapError((cause) =>
        providerSmokeErrorWithCause("preflight", "The recording target could not be inspected.", cause)
      )
    );
  if (targetExists) {
    return yield* providerSmokeError("preflight", "The recording target already exists and will not be overwritten.");
  }
  yield* Effect.acquireUseRelease(
    fs
      .makeTempFile({ directory: parent, prefix: `.${path.basename(target)}.`, suffix: ".staging" })
      .pipe(
        Effect.mapError((cause) =>
          providerSmokeErrorWithCause("recording-write", "A temporary recording file could not be allocated.", cause)
        )
      ),
    (temporary) =>
      fs.writeFileString(temporary, `${recordingJson}\n`).pipe(
        Effect.mapError((cause) =>
          providerSmokeErrorWithCause("recording-write", "The temporary recording could not be written.", cause)
        ),
        Effect.andThen(
          fs.exists(target).pipe(
            Effect.mapError((cause) =>
              providerSmokeErrorWithCause("preflight", "The recording target could not be rechecked.", cause)
            ),
            Effect.flatMap((exists) =>
              exists
                ? providerSmokeError(
                    "preflight",
                    "The recording target appeared during publication; no overwrite occurred."
                  )
                : fs
                    .link(temporary, target)
                    .pipe(
                      Effect.mapError((cause) =>
                        providerSmokeErrorWithCause(
                          "recording-write",
                          "The sanitized provider recording could not be published atomically without overwrite.",
                          cause
                        )
                      )
                    )
            )
          )
        )
      ),
    removeOwnedTemporary
  );
});

const prepareRecordingTarget = Effect.fn("LeJeuneProviderSmoke.prepareRecordingTarget")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const mode = yield* configuredRecordingMode;
  const reviewRecordingPath = yield* Config.nonEmptyString("LEJEUNE_REVIEW_RECORDING_OUT").pipe(
    Config.withDefault(DEFAULT_REVIEW_RECORDING_PATH),
    Effect.mapError((cause) =>
      providerSmokeErrorWithCause("configuration", "The review recording output path is invalid.", cause)
    )
  );
  const frozenTarget = path.resolve(RECORDING_PATH);
  const target = RecordingMode.$match(mode, {
    freeze: () => frozenTarget,
    "reviewed-refresh": () => path.resolve(reviewRecordingPath),
  });
  if (Str.Equivalence(target, frozenTarget) && Str.Equivalence(mode, "reviewed-refresh")) {
    return yield* providerSmokeError(
      "preflight",
      "Reviewed refresh output must be separate from the checked-in frozen recording."
    );
  }
  const targetExists = yield* fs
    .exists(target)
    .pipe(
      Effect.mapError((cause) =>
        providerSmokeErrorWithCause("preflight", "The recording target could not be inspected.", cause)
      )
    );
  if (targetExists) {
    return yield* providerSmokeError("preflight", "The recording target already exists and will not be overwritten.");
  }
  return RecordingTarget.make({
    kind: RecordingMode.$match(mode, {
      freeze: () => RecordingTargetKind.Options[0],
      "reviewed-refresh": () => RecordingTargetKind.Options[1],
    }),
    mode,
    path: target,
  });
});

const recordProviderSmoke = Effect.fn("LeJeuneProviderSmoke.record")(function* (target: RecordingTarget) {
  const service = yield* LangExtractService;
  const provider = yield* configuredProviderKind;
  const model = yield* Match.value(provider).pipe(
    Match.when("anthropic", () =>
      Config.nonEmptyString("AI_ANTHROPIC_MODEL").pipe(Config.withDefault(ANTHROPIC_DEFAULT_MODEL))
    ),
    Match.when("venice-ai", () =>
      Config.nonEmptyString("LEJEUNE_VENICE_MODEL").pipe(Config.withDefault(VENICE_CHAT_MODEL))
    ),
    Match.exhaustive,
    Effect.mapError((cause) =>
      providerSmokeErrorWithCause("configuration", "The provider model configuration is invalid.", cause)
    )
  );
  yield* Effect.annotateCurrentSpan("lejeune.provider", provider);
  yield* Effect.annotateCurrentSpan("lejeune.recording_target", target.kind);
  const result = yield* service
    .extract(request)
    .pipe(
      Effect.mapError((cause) =>
        providerSmokeErrorWithCause("provider-extraction", "The selected provider extraction failed.", cause)
      )
    );
  const groundedExtractions = pipe(
    result.extractions,
    A.filter(GroundedExtraction.isAnyOf(["match_exact", "match_lesser", "match_fuzzy"]))
  );
  const candidates = yield* Effect.forEach(
    groundedExtractions,
    (extraction) =>
      S.decodeUnknownEffect(ProviderCandidate)({ label: extraction.label, text: extraction.text }).pipe(
        Effect.mapError((cause) =>
          providerSmokeErrorWithCause(
            "provider-extraction",
            "The provider returned a candidate outside the authorized label set.",
            cause
          )
        )
      ),
    { concurrency: 1 }
  );
  if (!A.isReadonlyArrayNonEmpty(candidates)) {
    return yield* providerSmokeError(
      "provider-extraction",
      "The selected provider returned no source-grounded candidates for the smoke request."
    );
  }
  const candidateJson = yield* S.encodeUnknownEffect(ProviderCandidateListFromJsonString)(candidates).pipe(
    Effect.mapError((cause) =>
      providerSmokeErrorWithCause("serialization", "The sanitized provider candidates could not be encoded.", cause)
    )
  );
  const verifiedCandidates = yield* S.decodeEffect(ProviderCandidateListFromJsonString)(candidateJson).pipe(
    Effect.mapError((cause) =>
      providerSmokeErrorWithCause(
        "provider-extraction",
        "The provider response did not contain the exact required candidate set.",
        cause
      )
    )
  );
  const responseSha256 = yield* Sha256HexFromBytes.decodeEffect(strToU8(candidateJson)).pipe(
    Effect.mapError((cause) =>
      providerSmokeErrorWithCause("hashing", "The sanitized provider candidates could not be hashed.", cause)
    )
  );
  const recordedAt = IsoTimestamp.make(
    DateTime.formatIso(DateTime.makeUnsafe(yield* Effect.clockWith((clock) => clock.currentTimeMillis)))
  );
  const recording = ProviderRecording.make({
    candidates: verifiedCandidates,
    documentId: PROVIDER_RECORDING_DOCUMENT_ID,
    model,
    provider,
    recordedAt,
    responseSha256,
  });
  const verifiedRecording = yield* verifyProviderRecording(recording, RFQ_A_OUTLOOK_BODY).pipe(
    Effect.mapError((cause) =>
      providerSmokeErrorWithCause(
        "provider-integrity",
        "The sanitized provider recording failed integrity checks.",
        cause
      )
    )
  );
  const recordingJson = yield* S.encodeEffect(ProviderRecordingFromJsonString)(verifiedRecording).pipe(
    Effect.mapError((cause) =>
      providerSmokeErrorWithCause("serialization", "The sanitized provider recording could not be encoded.", cause)
    )
  );
  yield* writeRecordingAtomically(target.path, recordingJson);
  yield* Effect.logInfo("Recorded a sanitized provider extraction for offline review.").pipe(
    Effect.annotateLogs({
      "lejeune.candidate_count": A.length(candidates),
      "lejeune.provider": provider,
      "lejeune.recording_mode": target.mode,
    })
  );
});

const VeniceLanguageModelLive = Layer.unwrap(
  Config.nonEmptyString("LEJEUNE_VENICE_MODEL").pipe(
    Config.withDefault(VENICE_CHAT_MODEL),
    Effect.map((model) => VeniceAiLanguageModel.layer({ model }).pipe(Layer.provide(VeniceAI.layer)))
  )
);
const languageModelLayerFor = (provider: typeof ProviderKind.Type) =>
  Match.value(provider).pipe(
    Match.when("anthropic", () => AnthropicLanguageModelLive),
    Match.when("venice-ai", () => VeniceLanguageModelLive),
    Match.exhaustive
  );
const LanguageModelLayer = Layer.unwrap(configuredProviderKind.pipe(Effect.map(languageModelLayerFor)));
const ProviderLayer = LangExtractServiceLive.pipe(
  Layer.provideMerge(Layer.merge(LanguageModelLayer, allowRemoteExtractionPolicyLayer))
);
const RuntimeLayer = Layer.merge(BunServices.layer, BunCrypto.layer);
const AppLayer = ProviderLayer.pipe(Layer.provideMerge(RuntimeLayer));
const main = Effect.scoped(
  Layer.build(RuntimeLayer).pipe(
    Effect.flatMap((runtimeContext) =>
      prepareRecordingTarget().pipe(
        Effect.provide(runtimeContext),
        Effect.flatMap((target) =>
          Layer.build(AppLayer).pipe(
            Effect.mapError((cause) =>
              providerSmokeErrorWithCause("provider-runtime", "The provider runtime could not be initialized.", cause)
            ),
            Effect.flatMap((context) => recordProviderSmoke(target).pipe(Effect.provide(context)))
          )
        )
      )
    )
  )
);

if (import.meta.main) {
  BunRuntime.runMain(main);
}
