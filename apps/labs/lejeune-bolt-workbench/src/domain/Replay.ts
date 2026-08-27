/**
 * Immutable bundle assembly and provider-independent golden replay.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { strToU8 } from "fflate";
import {
  GoldenReplayReceipt,
  ImmutableDemoBundle,
  ImmutableDemoBundleFromJsonString,
  MutableReviewLedger,
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
 * **Example** (Inspect the bundle field)
 *
 * ```ts
 * import { ReplayBuild } from "@/domain/Replay"
 *
 * console.log(ReplayBuild.fields.bundle !== undefined) // true
 * ```
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

const hashBundle = Effect.fn("LeJeuneReplay.hashBundle")(function* (bundle: ImmutableDemoBundle) {
  const encoded = yield* S.encodeEffect(ImmutableDemoBundleFromJsonString)(bundle);
  return yield* Sha256HexFromBytes.decodeEffect(strToU8(encoded));
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
export const replayOffline = Effect.fn("LeJeuneReplay.offline")(function* (providerRecording: ProviderRecording) {
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
    bundleVersion: "lejeune-demo-bundle/v1",
    certificates: referenceData.certificates,
    finishes: referenceData.finishes,
    fixtures,
    mutableCorpusDisposition: "delete-or-promote",
    mutableCorpusDispositionDate: "2026-09-30",
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
    dispositionDate: "2026-09-30",
    schemaVersion: "lejeune-review-ledger/v1",
  });
  const receipt = GoldenReplayReceipt.make({
    bundleIdentity,
    networkAvailable: false,
    projection,
    providerAvailable: false,
    replayMode: "recorded-offline",
  });
  return ReplayBuild.make({ bundle, mutableLedger, receipt });
});
