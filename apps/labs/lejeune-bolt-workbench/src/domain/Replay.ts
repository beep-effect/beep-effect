/**
 * Immutable bundle assembly and provider-independent golden replay.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { strToU8 } from "fflate";
import {
  BUNDLE_VERSION,
  GoldenReplayReceipt,
  ImmutableDemoBundle,
  ImmutableDemoBundleFromJsonString,
  MUTABLE_CORPUS_DISPOSITION_DATE,
  MutableReviewLedger,
  PROVIDER_RECORDING_SOURCE_TEXT,
  verifyProviderRecording,
} from "@/domain/Bundle";
import { buildNormalizedFixtures } from "@/domain/Normalize";
import { buildProjectionSnapshot, ProjectionInput } from "@/domain/Projections";
import { buildReferenceData } from "@/domain/ReferenceData";
import { evaluateRules } from "@/domain/Rules";
import { buildFixtureArtifacts } from "@/fixtures/Sources";
import type { ProviderRecording } from "@/domain/Bundle";

const $I = $LejeuneBoltWorkbenchId.create("domain/Replay");

/**
 * Complete immutable bundle, separate mutable ledger, and offline receipt.
 *
 * @category models
 * @since 0.0.0
 */
class ReplayBuild extends S.Class<ReplayBuild>($I`ReplayBuild`)(
  {
    bundle: ImmutableDemoBundle,
    mutableLedger: MutableReviewLedger,
    receipt: GoldenReplayReceipt,
  },
  $I.annote("ReplayBuild", {
    description: "One deterministic offline replay result with mutable review state outside bundle identity.",
  })
) {}

const ReplayOperation = LiteralKit(["encode-bundle", "hash-bundle"]);

class ReplayError extends S.TaggedError<ReplayError>($I`ReplayError`)(
  "ReplayError",
  {
    cause: S.Defect({ includeStack: true }),
    message: S.NonEmptyString,
    operation: ReplayOperation,
  },
  $I.annoteError<ReplayError>("ReplayError", {
    title: "LeJeune replay error",
    description: "A closed encoding or hashing failure while constructing the deterministic replay receipt.",
  })
) {}

const hashBundle = Effect.fnUntraced(function* (bundle: ImmutableDemoBundle) {
  const encoded = yield* S.encodeEffect(ImmutableDemoBundleFromJsonString)(bundle).pipe(
    Effect.mapError((cause) =>
      ReplayError.make({
        cause,
        message: "The immutable demo bundle could not be encoded.",
        operation: "encode-bundle",
      })
    )
  );
  return yield* Sha256HexFromBytes.decodeEffect(strToU8(encoded)).pipe(
    Effect.mapError((cause) =>
      ReplayError.make({ cause, message: "The immutable demo bundle could not be hashed.", operation: "hash-bundle" })
    )
  );
});

/**
 * Build the complete immutable bundle and offline receipt from one sanitized provider recording.
 *
 * **Details**
 *
 * The recording is data, not an active provider. This Effect requests only local crypto and
 * projection services; it has no language-model, HTTP-client, provider, or network requirement.
 * Mutable approvals and expert claims are returned in a separate ledger and do not affect identity.
 *
 * **Example** (Inspect the replay constructor)
 *
 * ```ts
 * import { replayOffline } from "@/domain/Replay"
 *
 * console.log(typeof replayOffline === "function") // true
 * ```
 *
 * @category replay
 * @since 0.0.0
 */
export const replayOffline = Effect.fn("lejeune.replay.offline")(function* (providerRecording: ProviderRecording) {
  yield* verifyProviderRecording(providerRecording, PROVIDER_RECORDING_SOURCE_TEXT);
  const artifacts = yield* buildFixtureArtifacts;
  const fixtures = yield* buildNormalizedFixtures(artifacts);
  const rules = yield* evaluateRules(fixtures);
  const referenceData = buildReferenceData(fixtures);
  const projection = yield* buildProjectionSnapshot(
    ProjectionInput.make({
      certificates: referenceData.certificates,
      fixtures,
      offers: referenceData.offers,
      rules,
    })
  );
  const bundle = ImmutableDemoBundle.make({
    bundleVersion: BUNDLE_VERSION,
    certificates: referenceData.certificates,
    finishes: referenceData.finishes,
    fixtures,
    mutableCorpusDisposition: "delete-or-promote",
    mutableCorpusDispositionDate: MUTABLE_CORPUS_DISPOSITION_DATE,
    offers: referenceData.offers,
    projection,
    providerRecording,
    rules,
    standards: referenceData.standards,
    tools: referenceData.tools,
  });
  const bundleIdentity = yield* hashBundle(bundle);
  const mutableLedger = MutableReviewLedger.make({
    approvals: [],
    claims: [],
    disposition: "delete-or-promote",
    dispositionDate: MUTABLE_CORPUS_DISPOSITION_DATE,
    schemaVersion: "lejeune-review-ledger/v1",
  });
  const receipt = GoldenReplayReceipt.make({
    bundleVersion: BUNDLE_VERSION,
    bundleIdentity,
    networkAvailable: false,
    projection,
    providerAvailable: false,
    replayMode: "recorded-offline",
  });
  return ReplayBuild.make({ bundle, mutableLedger, receipt });
});
