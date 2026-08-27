/**
 * Record one sanitized successful provider extraction for offline golden replay.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ANTHROPIC_DEFAULT_MODEL, AnthropicLanguageModelLive } from "@beep/anthropic";
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
import { strToU8 } from "fflate";
import { ProviderCandidate, ProviderRecording, ProviderRecordingFromJsonString } from "@/domain/Bundle";
import { IsoTimestamp } from "@/domain/Ontology";
import { FixtureError } from "@/fixtures/Sources";

const SOURCE_TEXT =
  "SYNTHETIC RFQ A | Project North Loop Canopy | Delivery 2026-09-12 | Domestic required | Finish MG B695 Class 55";
const RECORDING_PATH = "src/fixtures/provider-recording.json";
const ProviderKind = LiteralKit(["anthropic", "venice-ai"]);
const providerKind = Config.string("LEJEUNE_PROVIDER").pipe(
  Config.withDefault("anthropic"),
  Effect.flatMap(S.decodeUnknownEffect(ProviderKind))
);

const CandidateListFromJsonString = ProviderCandidate.pipe(S.NonEmptyArray, S.fromJsonString);

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
  text: SOURCE_TEXT,
});

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const service = yield* LangExtractService;
  const provider = yield* providerKind;
  const model = yield* Match.value(provider).pipe(
    Match.when("anthropic", () =>
      Config.nonEmptyString("AI_ANTHROPIC_MODEL").pipe(Config.withDefault(ANTHROPIC_DEFAULT_MODEL))
    ),
    Match.when("venice-ai", () =>
      Config.nonEmptyString("LEJEUNE_VENICE_MODEL").pipe(Config.withDefault(VENICE_CHAT_MODEL))
    ),
    Match.exhaustive
  );
  const result = yield* service.extract(request);
  const candidates = pipe(
    result.extractions,
    A.filter(GroundedExtraction.isAnyOf(["match_exact", "match_lesser", "match_fuzzy"])),
    A.map((extraction) => ProviderCandidate.make({ label: extraction.label, text: extraction.text }))
  );
  if (!A.isReadonlyArrayNonEmpty(candidates)) {
    return yield* FixtureError.make({
      stage: "provider-extraction",
      message: "The selected provider returned no source-grounded candidates for the smoke request.",
    });
  }
  const candidateJson = yield* S.encodeEffect(CandidateListFromJsonString)(candidates);
  const responseSha256 = yield* Sha256HexFromBytes.decodeEffect(strToU8(candidateJson));
  const recordedAt = IsoTimestamp.make(
    DateTime.formatIso(DateTime.makeUnsafe(yield* Effect.clockWith((clock) => clock.currentTimeMillis)))
  );
  const recording = ProviderRecording.make({
    candidates,
    documentId: request.documentId,
    model,
    provider,
    recordedAt,
    responseSha256,
  });
  const recordingJson = yield* S.encodeEffect(ProviderRecordingFromJsonString)(recording);
  yield* fs.writeFileString(path.resolve(RECORDING_PATH), `${recordingJson}\n`);
  yield* Effect.logInfo("Recorded sanitized provider extraction for offline replay.").pipe(
    Effect.annotateLogs({
      "lejeune.candidate_count": A.length(candidates),
      "lejeune.provider": provider,
      "lejeune.recording_path": RECORDING_PATH,
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
const LanguageModelLayer = Layer.unwrap(providerKind.pipe(Effect.map(languageModelLayerFor)));
const ProviderLayer = LangExtractServiceLive.pipe(
  Layer.provideMerge(Layer.merge(LanguageModelLayer, allowRemoteExtractionPolicyLayer))
);
const RuntimeLayer = Layer.merge(BunServices.layer, BunCrypto.layer);
const AppLayer = ProviderLayer.pipe(Layer.provideMerge(RuntimeLayer));
const main = Effect.scoped(Layer.build(Layer.effectDiscard(program).pipe(Layer.provide(AppLayer))));

BunRuntime.runMain(main);
