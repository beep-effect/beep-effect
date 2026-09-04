/**
 * Immutable bundle assembly and provider-independent golden replay.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { strToU8 } from "fflate";
import {
  BUNDLE_VERSION,
  GoldenReplayReceipt,
  ImmutableDemoBundle,
  ImmutableDemoBundleFromJsonString,
  MUTABLE_CORPUS_DISPOSITION_DATE,
  MutableRetentionMetadata,
  MutableReviewLedger,
  PROVIDER_RECORDING_SOURCE_TEXT,
} from "@/domain/Bundle";
import { IsoDate } from "@/domain/Ontology";
import { buildReferenceData } from "@/domain/ReferenceData";
import { buildFixtureArtifacts } from "@/fixtures/Sources";
import { buildProjectionSnapshot, ProjectionInput } from "@/runtime/Projections";
import { buildNormalizedFixtures } from "@/workflows/Normalize";
import { verifyFrozenProviderRecording } from "@/workflows/ProviderRecording";
import { evaluateRules } from "@/workflows/Rules";
import type { DuckDb } from "@beep/duckdb";
import type { VerifiedSpanError } from "@beep/langextract/VerifiedSpan";
import type { SparqlQueryService } from "@beep/semantic-web";
import type * as Crypto from "effect/Crypto";
import type { SqlClient } from "effect/unstable/sql/SqlClient";
import type { ProviderRecording, RetentionAuthorization } from "@/domain/Bundle";
import type { FixtureError } from "@/fixtures/Sources";
import type { ProjectionError } from "@/runtime/Projections";
import type { ProviderRecordingIntegrityError } from "@/workflows/ProviderRecording";

const $I = $LejeuneBoltWorkbenchId.create("workflows/Replay");

/**
 * Complete immutable bundle, separate mutable state, and offline receipt.
 *
 * @category models
 * @since 0.0.0
 */
export class ReplayBuild extends S.Class<ReplayBuild>($I`ReplayBuild`)(
  {
    bundle: ImmutableDemoBundle,
    mutableLedger: MutableReviewLedger,
    retentionMetadata: MutableRetentionMetadata,
    receipt: GoldenReplayReceipt,
  },
  $I.annote("ReplayBuild", {
    description: "One deterministic replay with its review ledger and effective retention metadata outside identity.",
  })
) {}

const ReplayOperation = LiteralKit(["encode-bundle", "hash-bundle"]);

export class ReplayError extends S.TaggedError<ReplayError>($I`ReplayError`)(
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
  const encoded = yield* ImmutableDemoBundleFromJsonString.encodeEffect(bundle).pipe(
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
      ReplayError.make({
        cause,
        message: "The immutable demo bundle could not be hashed.",
        operation: "hash-bundle",
      })
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
 * Mutable approvals, expert claims, and effective retention metadata are returned outside identity.
 *
 * **Example** (Inspect the replay constructor)
 *
 * ```ts
 * import { replayOffline } from "@/workflows/Replay"
 *
 * console.log(typeof replayOffline === "function") // true
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const replayOffline = Effect.fn("lejeune.replay.offline")(function* (
  providerRecording: ProviderRecording,
  retentionAuthorization: O.Option<RetentionAuthorization> = O.none()
): Effect.fn.Return<
  ReplayBuild,
  FixtureError | ProjectionError | ProviderRecordingIntegrityError | ReplayError | VerifiedSpanError,
  Crypto.Crypto | DuckDb | SparqlQueryService | SqlClient
> {
  const frozenProviderRecording = yield* verifyFrozenProviderRecording(
    providerRecording,
    PROVIDER_RECORDING_SOURCE_TEXT
  );
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
    providerRecording: frozenProviderRecording,
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
  const retentionMetadata = MutableRetentionMetadata.make({
    disposition: "delete-or-promote",
    dispositionDate: O.match(retentionAuthorization, {
      onNone: () => IsoDate.make(MUTABLE_CORPUS_DISPOSITION_DATE),
      onSome: (authorization) => authorization.newDispositionDate,
    }),
    retentionAuthorization,
  });
  const receipt = GoldenReplayReceipt.make({
    bundleVersion: BUNDLE_VERSION,
    bundleIdentity,
    networkAvailable: false,
    projection,
    providerAvailable: false,
    replayMode: "recorded-offline",
  });
  return ReplayBuild.make({ bundle, mutableLedger, receipt, retentionMetadata });
});
