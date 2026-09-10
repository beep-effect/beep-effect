/**
 * Pure cache qualification vocabulary and promotion requirements.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("cache/Cache.policy");

/**
 * States of one evidence-bound reuse claim.
 *
 * **Example** (Recognize unassessed)
 *
 * ```ts
 * import { CacheQualificationState } from "@beep/repo-configs/cache"
 * console.assert(CacheQualificationState.is["unassessed"]("unassessed"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheQualificationState = LiteralKit([
  "unassessed",
  "excluded",
  "candidate",
  "shadow",
  "qualified",
  "suspended",
]).pipe($I.annoteSchema("CacheQualificationState", { description: "States of one evidence-bound reuse claim." }));
/**
 * Decoded CacheQualificationState value.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheQualificationState = typeof CacheQualificationState.Type;

/**
 * Distinct reuse authorities; only task results can be qualified here.
 *
 * **Example** (Recognize turbo-task-result)
 *
 * ```ts
 * import { CacheReuseLayer } from "@beep/repo-configs/cache"
 * console.assert(CacheReuseLayer.is["turbo-task-result"]("turbo-task-result"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheReuseLayer = LiteralKit([
  "turbo-task-result",
  "github-actions-cache-transport",
  "quality-lane-proof",
  "yeet-full-proof",
  "hosted-required-status",
]).pipe(
  $I.annoteSchema("CacheReuseLayer", {
    description: "Distinct reuse authorities; only task results can be qualified here.",
  })
);
/**
 * Decoded CacheReuseLayer value.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheReuseLayer = typeof CacheReuseLayer.Type;

/**
 * Independent experiment obligations required by task qualification.
 *
 * **Example** (Recognize fresh-fresh)
 *
 * ```ts
 * import { CacheEvidenceKind } from "@beep/repo-configs/cache"
 * console.assert(CacheEvidenceKind.is["fresh-fresh"]("fresh-fresh"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheEvidenceKind = LiteralKit([
  "fresh-fresh",
  "fresh-remote-hit",
  "semantic-invalidation",
  "orchestration-invariance",
  "cross-root",
  "concurrency",
  "capture-safety",
  "negative-case",
  "shadow",
  "conformance",
  "trust",
]).pipe(
  $I.annoteSchema("CacheEvidenceKind", {
    description: "Independent experiment obligations required by task qualification.",
  })
);
/**
 * Decoded CacheEvidenceKind value.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheEvidenceKind = typeof CacheEvidenceKind.Type;

/**
 * Exact stable and isolated canary results remain separate.
 *
 * **Example** (Recognize stable)
 *
 * ```ts
 * import { CacheClientChannel } from "@beep/repo-configs/cache"
 * console.assert(CacheClientChannel.is["stable"]("stable"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheClientChannel = LiteralKit(["stable", "canary"]).pipe(
  $I.annoteSchema("CacheClientChannel", { description: "Exact stable and isolated canary results remain separate." })
);
/**
 * Decoded CacheClientChannel value.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheClientChannel = typeof CacheClientChannel.Type;

/**
 * Identifies one computation, reuse layer, named environment and epoch.
 *
 * **Example** (Validate CacheQualificationKey)
 *
 * ```ts
 * import { CacheQualificationKey } from "@beep/repo-configs/cache"
 * const key = CacheQualificationKey.make({ computation: "@beep/identity#lint", layer: "turbo-task-result", profile: "local-linux-x64-bun1.4.1", epoch: "pilot-v1" })
 * console.assert(key.layer === "turbo-task-result")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheQualificationKey extends S.Class<CacheQualificationKey>($I`CacheQualificationKey`)(
  {
    computation: S.NonEmptyString.check(S.isPattern(/^[^#\s]+#[^#\s]+$/)),
    layer: CacheReuseLayer,
    profile: S.NonEmptyString,
    epoch: S.NonEmptyString,
  },
  $I.annote("CacheQualificationKey", {
    description: "Identifies one computation, reuse layer, named environment and epoch.",
  })
) {}

/**
 * Binds evidence to the reviewed worksheet, config, tools, fixtures and backend.
 *
 * **Example** (Validate CacheQualificationPins)
 *
 * ```ts
 * import { CacheQualificationPins } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheQualificationPins)({ contract: "unversioned" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheQualificationPins extends S.Class<CacheQualificationPins>($I`CacheQualificationPins`)(
  {
    contract: Sha256Hex,
    configuration: Sha256Hex,
    toolchain: Sha256Hex,
    fixtures: Sha256Hex,
    backend: Sha256Hex,
  },
  $I.annote("CacheQualificationPins", {
    description: "Binds evidence to the reviewed worksheet, config, tools, fixtures and backend.",
  })
) {}

/**
 * Reviewed effective Turbo settings, including dependency and persistence boundaries.
 *
 * **Example** (Validate CacheTaskConfiguration)
 *
 * ```ts
 * import { CacheTaskConfiguration } from "@beep/repo-configs/cache"
 * const config = CacheTaskConfiguration.make({ cache: true, inputs: ["$TURBO_DEFAULT$"], env: [], passThroughEnv: [], outputs: [], dependsOn: [], persistent: false, interactive: false, interruptible: false, outputLogs: "full" })
 * console.assert(!config.persistent)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheTaskConfiguration extends S.Class<CacheTaskConfiguration>($I`CacheTaskConfiguration`)(
  {
    cache: S.Boolean,
    inputs: S.Array(S.String),
    env: S.Array(S.String),
    passThroughEnv: S.Array(S.String),
    outputs: S.Array(S.String),
    dependsOn: S.Array(S.String),
    persistent: S.Boolean,
    interactive: S.Boolean,
    interruptible: S.Boolean,
    outputLogs: S.NonEmptyString,
  },
  $I.annote("CacheTaskConfiguration", {
    description: "Reviewed effective Turbo settings, including dependency and persistence boundaries.",
  })
) {}

/**
 * Exact executable version and digest, bound to an isolated cache namespace.
 *
 * **Example** (Reject floating client versions)
 *
 * ```ts
 * import { CacheClientPin } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheClientPin)({ version: "latest" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheClientPin extends S.Class<CacheClientPin>($I`CacheClientPin`)(
  {
    version: S.NonEmptyString.check(S.isPattern(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)),
    sha256: Sha256Hex,
    namespace: S.NonEmptyString.check(S.isPattern(/^[a-z0-9][a-z0-9._-]{0,127}$/)),
  },
  $I.annote("CacheClientPin", { description: "Exact client binary and isolated experiment namespace." })
) {}

/**
 * Content-addressed portable receipt reference; Cache verifies the referenced bytes.
 *
 * **Example** (Validate CacheEvidenceReference)
 *
 * ```ts
 * import { CacheEvidenceReference } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheEvidenceReference)({ path: "/private/raw.log", sha256: "missing" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheEvidenceReference extends S.Class<CacheEvidenceReference>($I`CacheEvidenceReference`)(
  {
    path: S.NonEmptyString.check(
      S.isPattern(/^(?:\.?[A-Za-z0-9_-][A-Za-z0-9._-]*)(?:\/\.?[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/)
    ),
    sha256: Sha256Hex,
  },
  $I.annote("CacheEvidenceReference", {
    description: "Content-addressed portable receipt reference; Cache verifies the referenced bytes.",
  })
) {}

/**
 * Reviewed disabled-to-enabled projection for one inheriting workspace configuration.
 *
 * **Details**
 * Before and after references retain immutable configuration bytes. The path
 * names their live destination. Cache verifies that only the selected task's
 * cache flag changes and binds the complete disabled configuration digest.
 *
 * **Example** (Inspect the activation boundary)
 *
 * ```ts
 * import { CacheActivationProjection } from "@beep/repo-configs/cache"
 * console.assert("sourceConfiguration" in CacheActivationProjection.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheActivationProjection extends S.Class<CacheActivationProjection>($I`CacheActivationProjection`)(
  {
    path: CacheEvidenceReference.fields.path,
    before: CacheEvidenceReference,
    after: CacheEvidenceReference,
    sourceConfiguration: Sha256Hex,
  },
  $I.annote("CacheActivationProjection", {
    description: "Exact reviewed configuration bytes and disabled fingerprint for a single task activation.",
  })
) {}

/**
 * Complete reviewed obligations for a finite executable computation.
 *
 * **Example** (Validate CacheTaskContract)
 *
 * ```ts
 * import { CacheTaskContract } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheTaskContract)({ commands: [] }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheTaskContract extends S.Class<CacheTaskContract>($I`CacheTaskContract`)(
  {
    key: CacheQualificationKey,
    pins: CacheQualificationPins,
    commands: S.NonEmptyArray(S.NonEmptyString),
    commandDigest: Sha256Hex,
    dependencies: S.Array(S.String),
    clients: S.Record(CacheClientChannel, CacheClientPin),
    semanticInputClasses: S.NonEmptyArray(S.NonEmptyString),
    orchestrationInputClasses: S.Array(S.NonEmptyString),
    negativeCases: S.NonEmptyArray(S.NonEmptyString),
    crossRoot: S.Boolean,
    configuration: CacheTaskConfiguration,
    activation: CacheActivationProjection.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CacheTaskContract", { description: "Complete reviewed obligations for a finite executable computation." })
) {}

/**
 * Validated experiment fact; its receipt remains the operational evidence authority.
 *
 * **Example** (Validate CacheQualificationObservation)
 *
 * ```ts
 * import { CacheQualificationObservation } from "@beep/repo-configs/cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheQualificationObservation)({ passed: true }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheQualificationObservation extends S.Class<CacheQualificationObservation>(
  $I`CacheQualificationObservation`
)(
  {
    key: CacheQualificationKey,
    pins: CacheQualificationPins,
    kind: CacheEvidenceKind,
    channel: CacheClientChannel,
    client: CacheClientPin,
    run: S.NonEmptyString,
    roots: S.NonEmptyArray(S.NonEmptyString),
    subjects: S.Array(S.NonEmptyString),
    passed: S.Boolean,
    receipt: CacheEvidenceReference,
  },
  $I.annote("CacheQualificationObservation", {
    description: "Validated experiment fact; its receipt remains the operational evidence authority.",
  })
) {}

/**
 * Determine whether a requested lifecycle edge is allowed; evidence is checked separately.
 *
 * **Example** (Reject a skipped shadow stage)
 *
 * ```ts
 * import { isCacheTransitionAllowed } from "@beep/repo-configs/cache"
 * console.assert(!isCacheTransitionAllowed("candidate", "qualified"))
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const isCacheTransitionAllowed: {
  (from: CacheQualificationState, to: CacheQualificationState): boolean;
  (to: CacheQualificationState): (from: CacheQualificationState) => boolean;
} = dual(2, (from: CacheQualificationState, to: CacheQualificationState): boolean => {
  const edges: Readonly<Record<CacheQualificationState, ReadonlyArray<CacheQualificationState>>> = {
    unassessed: ["excluded", "candidate"],
    excluded: ["candidate"],
    candidate: ["shadow", "excluded"],
    shadow: ["qualified", "excluded", "suspended"],
    qualified: ["suspended", "candidate"],
    suspended: ["candidate"],
  };
  return A.contains(edges[from], to);
});

const sameKey = S.toEquivalence(CacheQualificationKey);
const samePins = S.toEquivalence(CacheQualificationPins);
const sameClient = S.toEquivalence(CacheClientPin);
const pairKinds = CacheEvidenceKind.pickOptions(["fresh-fresh", "fresh-remote-hit"]);

const contractPromotionFailures = (
  contract: CacheTaskContract,
  observations: ReadonlyArray<CacheQualificationObservation>
): ReadonlyArray<string> => {
  let failures = A.empty<string>();
  if (contract.key.layer !== "turbo-task-result") failures = A.append(failures, "reuse-layer-owned-elsewhere");
  if (!contract.configuration.cache) failures = A.append(failures, "reuse-disabled-contract");
  if (contract.configuration.persistent || contract.configuration.interactive)
    failures = A.append(failures, "non-finite-command");
  if (A.some(observations, (entry) => !sameKey(entry.key, contract.key) || !samePins(entry.pins, contract.pins))) {
    failures = A.append(failures, "evidence-identity-drift");
  }
  if (A.some(observations, (entry) => !entry.passed)) failures = A.append(failures, "failed-observation");
  if (contract.clients.stable.namespace === contract.clients.canary.namespace)
    failures = A.append(failures, "namespace-overlap");
  if (A.some(observations, (entry) => !sameClient(entry.client, contract.clients[entry.channel])))
    failures = A.append(failures, "client-profile-drift");
  return failures;
};

const isolatedPairFailures = (channel: CacheClientChannel, rows: ReadonlyArray<CacheQualificationObservation>) =>
  A.flatMap(pairKinds, (kind) => {
    const pairs = A.filter(rows, (entry) => entry.kind === kind && A.length(A.dedupe(entry.roots)) >= 2);
    const insufficient =
      A.length(A.dedupe(A.map(pairs, (entry) => entry.run))) < 3 ||
      A.length(A.dedupe(A.map(pairs, (entry) => entry.receipt.sha256))) < 3 ||
      A.length(A.dedupe(A.flatMap(pairs, (entry) => entry.roots))) < 6;
    return insufficient ? [`${channel}:missing-isolated-${kind}`] : [];
  });

const shadowFailures = (channel: CacheClientChannel, rows: ReadonlyArray<CacheQualificationObservation>) => {
  const shadows = A.filter(rows, (entry) => entry.kind === "shadow");
  const insufficient =
    A.length(A.dedupe(A.map(shadows, (entry) => entry.run))) < 10 ||
    A.length(A.dedupe(A.map(shadows, (entry) => entry.receipt.sha256))) < 10;
  return insufficient ? [`${channel}:missing-shadow-decisions`] : [];
};

const subjectFailures = (
  contract: CacheTaskContract,
  channel: CacheClientChannel,
  rows: ReadonlyArray<CacheQualificationObservation>
) => {
  const requirements: ReadonlyArray<readonly [CacheEvidenceKind, ReadonlyArray<string>]> = [
    ["semantic-invalidation", contract.semanticInputClasses],
    [
      "orchestration-invariance",
      O.isSome(contract.activation)
        ? A.dedupe(A.append(contract.orchestrationInputClasses, "activation-projection"))
        : contract.orchestrationInputClasses,
    ],
    ["negative-case", contract.negativeCases],
  ];
  return A.flatMap(requirements, ([kind, subjects]) => {
    const observed = A.filter(rows, (entry) => entry.kind === kind && A.length(entry.subjects) === 1);
    return A.map(
      A.filter(subjects, (subject) => !A.some(observed, (entry) => A.contains(entry.subjects, subject))),
      (subject) => `${channel}:missing-${kind}:${subject}`
    );
  });
};

const requiredKindFailures = (
  contract: CacheTaskContract,
  channel: CacheClientChannel,
  rows: ReadonlyArray<CacheQualificationObservation>
) => {
  const required: ReadonlyArray<CacheEvidenceKind> = [
    "concurrency",
    "capture-safety",
    "conformance",
    "trust",
    ...(contract.crossRoot ? (["cross-root"] satisfies ReadonlyArray<CacheEvidenceKind>) : []),
  ];
  return A.map(
    A.filter(required, (kind) => !A.some(rows, (entry) => entry.kind === kind)),
    (kind) => `${channel}:missing-${kind}`
  );
};

/**
 * Report missing or contradictory promotion evidence after Cache has verified receipt content and provenance.
 *
 * **Example** (Reject a contract without evidence)
 *
 * ```ts
 * import * as Cache from "@beep/repo-configs/cache"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as A from "effect/Array"
 * const digest = Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000")
 * const key = Cache.CacheQualificationKey.make({ computation: "fixture#lint", layer: "turbo-task-result", profile: "fixture", epoch: "v1" })
 * const configuration = Cache.CacheTaskConfiguration.make({ cache: true, inputs: ["$TURBO_DEFAULT$"], env: [], passThroughEnv: [], outputs: [], dependsOn: [], persistent: false, interactive: false, interruptible: false, outputLogs: "full" })
 * const contract = Cache.CacheTaskContract.make({
 *   key, configuration, commands: ["biome check ."], commandDigest: digest, dependencies: [],
 *   pins: Cache.CacheQualificationPins.make({ contract: digest, configuration: digest, toolchain: digest, fixtures: digest, backend: digest }),
 *   clients: {
 *     stable: Cache.CacheClientPin.make({ version: "2.10.12", sha256: digest, namespace: "fixture-stable" }),
 *     canary: Cache.CacheClientPin.make({ version: "2.10.13-canary.1", sha256: digest, namespace: "fixture-canary" })
 *   },
 *   semanticInputClasses: ["files"], orchestrationInputClasses: [], negativeCases: ["missing-script"], crossRoot: false
 * })
 * console.assert(A.contains(Cache.cachePromotionFailures(contract, []), "stable:missing-isolated-fresh-fresh"))
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const cachePromotionFailures: {
  (contract: CacheTaskContract, observations: ReadonlyArray<CacheQualificationObservation>): ReadonlyArray<string>;
  (observations: ReadonlyArray<CacheQualificationObservation>): (contract: CacheTaskContract) => ReadonlyArray<string>;
} = dual(
  2,
  (contract: CacheTaskContract, observations: ReadonlyArray<CacheQualificationObservation>): ReadonlyArray<string> => {
    const valid = A.filter(
      observations,
      (entry) =>
        entry.passed &&
        sameKey(entry.key, contract.key) &&
        samePins(entry.pins, contract.pins) &&
        sameClient(entry.client, contract.clients[entry.channel])
    );
    return A.appendAll(
      contractPromotionFailures(contract, observations),
      A.flatMap(CacheClientChannel.Options, (channel) => {
        const rows = A.filter(valid, (entry) => entry.channel === channel);
        return [
          ...isolatedPairFailures(channel, rows),
          ...shadowFailures(channel, rows),
          ...subjectFailures(contract, channel, rows),
          ...requiredKindFailures(contract, channel, rows),
        ];
      })
    );
  }
);
