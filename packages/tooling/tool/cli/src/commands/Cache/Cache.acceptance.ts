/**
 * Derive content-addressed policy observations from authenticated producer bundles.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  CacheClientChannel,
  CacheEvidenceKind,
  CacheEvidenceReference,
  CacheQualificationKey,
  CacheQualificationObservation,
  CacheTaskContract,
  cachePromotionFailures,
} from "@beep/repo-configs/cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CacheProducerImportPreview, CacheProducerImportRequest } from "./Cache.acceptance.schemas.ts";
import {
  CacheSignedPilotCaptureControl,
  CacheSignedPilotFreshPair,
  CacheSignedPilotMutation,
  CacheSignedPilotNonExecution,
  CacheSignedPilotPair,
  CacheSignedPilotPolicyRefusal,
  CacheSignedPilotReceipt,
  CacheSignedPilotShadow,
} from "./Cache.pilot.signed.schemas.ts";
import { CacheProducerEvidenceFragment } from "./Cache.producer.schemas.ts";
import {
  openCacheProducerVerifier,
  validateCacheProducerApproval,
  validateCacheProducerBinding,
} from "./Cache.producer.ts";
import { CacheProtocolExecution } from "./Cache.protocol.runner.schemas.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheProducerTrustLocations } from "./Cache.acceptance.schemas.ts";
import type { CacheProducerApproval, CacheProducerBundle } from "./Cache.producer.schemas.ts";

const DerivedEvidenceKind = CacheEvidenceKind.pick([
  "fresh-fresh",
  "fresh-remote-hit",
  "shadow",
  "semantic-invalidation",
  "orchestration-invariance",
  "negative-case",
  "concurrency",
  "cross-root",
  "conformance",
  "capture-safety",
  "trust",
]);
const changesSemanticHash = S.is(
  CacheSignedPilotShadow.fields.case.pick([
    "source-comment",
    "added-source",
    "readme",
    "declared-env",
    "declared-env-empty",
  ])
);
const encodePilot = S.encodeEffect(S.fromJsonString(CacheSignedPilotReceipt));
const encodeCaptureControl = S.encodeEffect(S.fromJsonString(CacheSignedPilotCaptureControl));
const encodeProtocol = S.encodeEffect(S.fromJsonString(CacheProtocolExecution));
const encodeFresh = S.encodeEffect(S.fromJsonString(CacheSignedPilotFreshPair));
const encodePair = S.encodeEffect(S.fromJsonString(CacheSignedPilotPair));
const encodeShadow = S.encodeEffect(S.fromJsonString(CacheSignedPilotShadow));
const encodeMutation = S.encodeEffect(S.fromJsonString(CacheSignedPilotMutation));
const encodeNonExecution = S.encodeEffect(S.fromJsonString(CacheSignedPilotNonExecution));
const encodePolicyRefusal = S.encodeEffect(S.fromJsonString(CacheSignedPilotPolicyRefusal));
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

/**
 * Prepare independently hashed comparison evidence without changing qualification.
 *
 * **Details**
 * Authentication must precede persistence or admission. This projection checks
 * the complete bundle and reviewed policy digest, then derives comparisons, input controls, native overlap and refusals from
 * measured relationships. It deliberately
 * emits no evidence for obligations absent from those comparisons. The complete
 * promotion policy must still run over both channels before any transition.
 *
 * **Example** (Reference deterministic evidence projection)
 * ```ts
 * import { deriveCacheProducerEvidence } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof deriveCacheProducerEvidence === "function")
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const deriveCacheProducerEvidence = Effect.fn("Producer.deriveEvidence")(function* (
  bundle: CacheProducerBundle,
  approval: CacheProducerApproval
) {
  yield* validateCacheProducerApproval(approval);
  yield* validateCacheProducerBinding(bundle, approval.binding);
  const { pilot } = bundle;
  if (O.isSome(approval.contract.signedExecution)) {
    const execution = approval.contract.signedExecution.value;
    if (
      !S.toEquivalence(CacheQualificationKey)(pilot.baseKey, execution.sourceKey) ||
      !S.toEquivalence(CacheEvidenceReference)(pilot.activation, execution.activationRequest)
    )
      return yield* CacheCommandError.new("Signed evidence differs from its approved source or activation request.");
  }
  const fragments = A.empty<CacheProducerEvidenceFragment>();
  const retain = Effect.fn("Producer.retainComparison")(function* (
    kind: typeof DerivedEvidenceKind.Type,
    run: string,
    roots: CacheQualificationObservation["roots"],
    contents: string,
    subjects: CacheQualificationObservation["subjects"] = []
  ) {
    const sha256 = yield* hashBytes(new TextEncoder().encode(contents));
    const reference = CacheEvidenceReference.make({ path: `evidence/producer/${sha256}.json`, sha256 });
    fragments.push(
      CacheProducerEvidenceFragment.make({
        reference,
        contents,
        observation: CacheQualificationObservation.make({
          key: pilot.key,
          pins: approval.contract.pins,
          kind,
          channel: pilot.channel,
          client: pilot.client,
          run,
          roots,
          subjects,
          passed: true,
          receipt: reference,
        }),
      })
    );
  });
  if (O.isSome(approval.contract.signedExecution)) {
    const baseline = yield* A.head(pilot.pairs).pipe(
      Effect.fromOption(() => CacheCommandError.new("Signed activation evidence requires a native baseline pair."))
    );
    yield* retain(
      "orchestration-invariance",
      "activation-projection",
      [baseline.authorityRoot, baseline.producerRoot],
      yield* encodePilot(pilot),
      ["activation-projection"]
    );
  }
  for (const pair of pilot.freshPairs) {
    const contents = yield* encodeFresh(pair);
    const roots = [pair.leftRoot, pair.rightRoot] satisfies CacheQualificationObservation["roots"];
    yield* retain("fresh-fresh", `fresh-${pair.id}`, roots, contents);
    const overlaps = O.zipWith(
      pair.left.selectedTaskInterval,
      pair.right.selectedTaskInterval,
      (left, right) => Math.max(left.startTime, right.startTime) < Math.min(left.endTime, right.endTime)
    );
    if (O.contains(true)(overlaps)) yield* retain("concurrency", `overlap-${pair.id}`, roots, contents);
  }
  for (const pair of pilot.pairs) {
    const contents = yield* encodePair(pair);
    const roots = [pair.producerRoot, pair.replayRoot] satisfies CacheQualificationObservation["roots"];
    yield* retain("fresh-remote-hit", `remote-${pair.id}`, roots, contents);
    yield* retain("cross-root", `cross-root-${pair.id}`, roots, contents);
    yield* retain("trust", `reader-protection-${pair.id}`, [pair.replayRoot], contents);
  }
  for (const shadow of pilot.shadows) {
    const contents = yield* encodeShadow(shadow);
    const roots = [
      shadow.comparison.producerRoot,
      shadow.comparison.replayRoot,
    ] satisfies CacheQualificationObservation["roots"];
    yield* retain("shadow", shadow.case, roots, contents);
    if (shadow.case !== "baseline")
      yield* retain(
        changesSemanticHash(shadow.case) ? "semantic-invalidation" : "orchestration-invariance",
        `input-${shadow.case}`,
        roots,
        contents,
        [shadow.case]
      );
  }
  for (const mutation of pilot.mutations)
    yield* retain(
      "semantic-invalidation",
      `mutation-${mutation.case}`,
      [mutation.comparison.producerRoot, mutation.comparison.replayRoot],
      yield* encodeMutation(mutation),
      [mutation.case]
    );
  for (const control of pilot.captureControls)
    yield* retain(
      "capture-safety",
      `capture-${control.case}`,
      [control.isolationRoot],
      yield* encodeCaptureControl(control)
    );
  for (const observation of pilot.nonExecutions)
    yield* retain(
      "negative-case",
      `refusal-${observation.reason}`,
      [observation.isolationRoot],
      yield* encodeNonExecution(observation),
      [observation.reason]
    );
  yield* retain(
    "negative-case",
    "refusal-missing-child-config",
    [pilot.policyRefusal.isolationRoot],
    yield* encodePolicyRefusal(pilot.policyRefusal),
    [pilot.policyRefusal.reason]
  );
  yield* retain(
    "conformance",
    "complete-native-protocol",
    A.map(bundle.protocol.roots, (root) => root.sha256),
    yield* encodeProtocol(bundle.protocol)
  );
  return fragments;
});

const encodeImport = S.encodeEffect(CacheProducerImportRequest);
const decodeImport = S.decodeUnknownEffect(CacheProducerImportRequest);

/**
 * Authenticate both channels using independent stores and report policy gaps.
 *
 * **Details**
 * Submitted reports cannot choose a policy or issuer path. Both private approvals
 * must contain the same reviewed contract. Reverification after derivation
 * detects approval changes, revocation and expiry before returning the preview.
 * This function writes no evidence, ledger, configuration or issuer material.
 *
 * **Example** (Reference authenticated import preparation)
 * ```ts
 * import { previewCacheProducerImport } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof previewCacheProducerImport === "function")
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const previewCacheProducerImport = Effect.fn("Producer.previewImport")(function* (
  submitted: CacheProducerImportRequest,
  trust: CacheProducerTrustLocations
) {
  const request = yield* encodeImport(submitted).pipe(Effect.flatMap(decodeImport));
  const stable = yield* openCacheProducerVerifier(trust.stable);
  const canary = yield* openCacheProducerVerifier(trust.canary);
  const verifiers = { stable, canary };
  const approvals = yield* Effect.all({
    stable: stable.verify(request.observations.stable.envelope, request.observations.stable.observation),
    canary: canary.verify(request.observations.canary.envelope, request.observations.canary.observation),
  });
  const contract = approvals.stable.contract;
  if (!S.toEquivalence(CacheTaskContract)(contract, approvals.canary.contract))
    return yield* CacheCommandError.new("Channel approvals do not describe the same reviewed task contract.");
  const fragments = A.empty<CacheProducerEvidenceFragment>();
  for (const channel of CacheClientChannel.literals) {
    const report = request.observations[channel];
    if (report.observation.pilot.channel !== channel)
      return yield* CacheCommandError.new("Import channel does not match its authenticated report.");
    fragments.push(...(yield* deriveCacheProducerEvidence(report.observation, approvals[channel])));
  }
  for (const channel of CacheClientChannel.literals) {
    const report = request.observations[channel];
    yield* verifiers[channel].verify(report.envelope, report.observation);
  }
  return CacheProducerImportPreview.make({
    contract,
    fragments,
    failures: cachePromotionFailures(
      contract,
      A.map(fragments, (fragment) => fragment.observation)
    ),
  });
});

/**
 * Require authenticated evidence to satisfy every reviewed policy obligation.
 *
 * **Details**
 * This is the shared policy prerequisite for persistence and operational checks.
 * It retains the producer envelopes' existing expiry and revocation rules; it
 * does not extend receipt lifetime, write a ledger or validate the live checkout.
 * Callers must also establish the current source/configuration and pilot scope.
 *
 * **Example** (Reference strict import validation)
 * ```ts
 * import { validateCacheProducerImport } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof validateCacheProducerImport === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheProducerImport = Effect.fn("Producer.validateImport")(function* (
  submitted: CacheProducerImportRequest,
  trust: CacheProducerTrustLocations
) {
  const preview = yield* previewCacheProducerImport(submitted, trust);
  if (A.isReadonlyArrayNonEmpty(preview.failures))
    return yield* CacheCommandError.new(
      "Authenticated producer evidence does not satisfy the complete reviewed policy."
    );
  return preview;
});
