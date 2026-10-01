/**
 * Signed real-pilot observations, separate from offline local receipts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientPin } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import {
  CachePilotMutation,
  CachePilotReceipt,
  CachePilotRequest,
  CachePilotRun,
  CachePilotTask,
} from "./Cache.pilot.schemas.ts";
import { CacheFixtureEvent } from "./Cache.protocol.fixture.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.pilot.signed.schemas");

/**
 * Selected-task facts permitting fresh execution or explicit remote replay.
 *
 * **Example** (Inspect remote evidence fields)
 * ```ts
 * import { CacheSignedPilotTask } from "@beep/repo-cli/commands/Cache"
 * console.assert("inputsDigest" in CacheSignedPilotTask.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheSignedPilotTask extends S.Class<CacheSignedPilotTask>($I`CacheSignedPilotTask`)(
  { ...CachePilotTask.fields, origin: LiteralKit(["fresh", "remote-hit"]) },
  $I.annote("CacheSignedPilotTask", {
    description: "Selected signed-profile task facts; dependencies retain fresh-only local observations.",
  })
) {}
const SignedOutcome = S.TaggedUnion({
  Executed: {
    selected: CacheSignedPilotTask,
    logSha256: Sha256Hex,
    logBytes: S.Natural,
    replayLogMatches: S.Boolean,
  },
}).annotate(
  $I.annote("SignedOutcome", {
    description: "A signed comparison requires an executed selected task, never a dependency-blocked graph.",
  })
);

/**
 * One signed-profile execution preserving the shared pilot integrity checks.
 *
 * **Example** (Inspect source integrity evidence)
 * ```ts
 * import { CacheSignedPilotRun } from "@beep/repo-cli/commands/Cache"
 * console.assert("sourceTreeUnchanged" in CacheSignedPilotRun.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheSignedPilotRun extends S.Class<CacheSignedPilotRun>($I`CacheSignedPilotRun`)(
  { ...CachePilotRun.fields, outcome: SignedOutcome },
  $I.annote("CacheSignedPilotRun", {
    description: "Signed selected-task execution; local hits and blocked selected tasks are not representable.",
  })
) {}

/**
 * Direct denial observations from the same mount and credential boundary as replay.
 *
 * **Details**
 * The protected key is a synthetic issuer canary. This proves reader confinement,
 * not approved workflow issuance, durable issuer trust or qualification authority.
 * When present, issuerMaterialDenied also records read/write denial for the
 * actual supervisor-selected persistent key, whose unchanged bytes the outer
 * supervisor checks. Absence of that field is not persistent issuer evidence.
 *
 * **Example** (Inspect the protected-file boundary)
 * ```ts
 * import { CacheSignedPilotProtection } from "@beep/repo-cli/commands/Cache"
 * console.assert("protectedBytesUnchanged" in CacheSignedPilotProtection.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheSignedPilotProtection extends S.Class<CacheSignedPilotProtection>($I`CacheSignedPilotProtection`)(
  {
    mechanism: S.tag("nested-reader-denial/v1"),
    protectedFiles: S.Literal(2),
    readsDenied: S.Literal(true),
    writesDenied: S.Literal(true),
    writerEnvironmentHidden: S.Literal(true),
    protectedBytesUnchanged: S.Literal(true),
    issuerMaterialDenied: S.OptionFromOptionalKey(S.Literal(true)).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("CacheSignedPilotProtection", {
    description:
      "Same-boundary reader denial for synthetic issuer material and producer record with post-replay integrity.",
  })
) {}

/**
 * Independently isolated fresh authority, signed producer and remote reader.
 *
 * **Example** (Inspect independent authority)
 * ```ts
 * import { CacheSignedPilotPair } from "@beep/repo-cli/commands/Cache"
 * console.assert("authoritative" in CacheSignedPilotPair.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheSignedPilotPair extends S.Class<CacheSignedPilotPair>($I`CacheSignedPilotPair`)(
  {
    id: S.Natural,
    client: CacheClientPin,
    authorityRoot: Sha256Hex,
    producerRoot: Sha256Hex,
    replayRoot: Sha256Hex,
    authoritative: CachePilotRun,
    producer: CacheSignedPilotRun,
    replay: CacheSignedPilotRun,
    protection: CacheSignedPilotProtection,
    events: S.Array(CacheFixtureEvent).check(S.isMaxLength(101)),
  },
  $I.annote("CacheSignedPilotPair", {
    description:
      "One empty-store namespace with separate authority, producer and reader roots and sanitized wire observations.",
  })
) {}

/**
 * Two isolated fresh executions under the same enabled signed configuration.
 *
 * **Details**
 * Both runs start with separate empty local caches. Native origins, inputs, task hashes,
 * output logs and independent summaries must be checked by the receipt validator.
 *
 * **Example** (Inspect fresh comparison roots)
 * ```ts
 * import { CacheSignedPilotFreshPair } from "@beep/repo-cli/commands/Cache"
 * console.assert("left" in CacheSignedPilotFreshPair.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheSignedPilotFreshPair extends S.Class<CacheSignedPilotFreshPair>($I`CacheSignedPilotFreshPair`)(
  { id: S.Natural, leftRoot: Sha256Hex, rightRoot: Sha256Hex, left: CachePilotRun, right: CachePilotRun },
  $I.annote("CacheSignedPilotFreshPair", {
    description: "Same-configuration fresh comparison; cache-disabled normal authority remains a separate observation.",
  })
) {}

/**
 * One of the ten required signed shadow scenarios with its independent remote comparison.
 *
 * **Details**
 * Expected hash changes are derived from the scenario by the validator;
 * a caller-supplied success flag cannot satisfy this contract.
 *
 * **Example** (Inspect signed shadow evidence)
 * ```ts
 * import { CacheSignedPilotShadow } from "@beep/repo-cli/commands/Cache"
 * console.assert("comparison" in CacheSignedPilotShadow.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheSignedPilotShadow extends S.Class<CacheSignedPilotShadow>($I`CacheSignedPilotShadow`)(
  {
    case: LiteralKit([
      "baseline",
      "source-comment",
      "added-source",
      "readme",
      "declared-env",
      "declared-env-empty",
      "orchestration-env",
      "locale",
      "timezone",
      "absolute-root",
    ]),
    comparison: CacheSignedPilotPair,
  },
  $I.annote("CacheSignedPilotShadow", {
    description: "Signed remote replay compared with fresh authority for one fixed perturbation.",
  })
) {}

/**
 * A seeded backend whose changed inputs must invalidate before signed replay.
 *
 * **Details**
 * The seed and changed producer share one isolated writer root and backend.
 * Fresh authority and replay use independent roots carrying the same mutation.
 * Missing child configuration is a separate mandatory policy-refusal control,
 * because it removes the governed runtime key and cannot be a valid replay.
 *
 * **Example** (Inspect seeded invalidation evidence)
 * ```ts
 * import { CacheSignedPilotMutation } from "@beep/repo-cli/commands/Cache"
 * console.assert("seed" in CacheSignedPilotMutation.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheSignedPilotMutation extends S.Class<CacheSignedPilotMutation>($I`CacheSignedPilotMutation`)(
  {
    case: LiteralKit([
      "root-task-config",
      "child-task-config",
      "root-lint-config",
      "lockfile",
      "package-manager",
      "generated-alias",
      "dependency-source",
    ]),
    changedPath: CachePilotMutation.fields.changedPath,
    beforeSha256: Sha256Hex,
    afterSha256: Sha256Hex,
    seed: CacheSignedPilotRun,
    comparison: CacheSignedPilotPair,
  },
  $I.annote("CacheSignedPilotMutation", {
    description: "Same-backend seed, changed fresh execution and signed replay with independently changed authority.",
  })
) {}

/**
 * Real signed comparisons without protected-producer or promotion authority.
 *
 * **Example** (Inspect the explicit profile)
 * ```ts
 * import { CacheSignedPilotReceipt } from "@beep/repo-cli/commands/Cache"
 * console.assert("signedRootConfiguration" in CacheSignedPilotReceipt.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheSignedPilotReceipt extends S.Class<CacheSignedPilotReceipt>($I`CacheSignedPilotReceipt`)(
  {
    schemaVersion: S.tag("cache-pilot-signed/v5"),
    authority: S.tag("signed-pilot-observation-only"),
    network: S.tag("private-loopback-nested-readers/v1"),
    key: CachePilotReceipt.fields.key,
    baseKey: CachePilotReceipt.fields.key,
    sourceRevision: CachePilotReceipt.fields.sourceRevision,
    channel: CachePilotReceipt.fields.channel,
    client: CacheClientPin,
    runtimeKeyDigest: Sha256Hex,
    runtimeLinker: CachePilotReceipt.fields.runtimeLinker,
    bun: CachePilotReceipt.fields.bun,
    biome: CachePilotReceipt.fields.biome,
    node: CachePilotReceipt.fields.node,
    installedDependencies: CachePilotReceipt.fields.installedDependencies,
    activation: CachePilotReceipt.fields.activation,
    configurationDigest: Sha256Hex,
    toolchainDigest: Sha256Hex,
    signedRootConfiguration: Sha256Hex,
    mutations: S.Array(CacheSignedPilotMutation).check(S.isMinLength(7), S.isMaxLength(7)),
    shadows: S.Array(CacheSignedPilotShadow).check(S.isMinLength(10), S.isMaxLength(10)),
    freshPairs: S.Array(CacheSignedPilotFreshPair).check(S.isMinLength(3), S.isMaxLength(3)),
    pairs: S.Array(CacheSignedPilotPair).check(S.isMinLength(3), S.isMaxLength(3)),
  },
  $I.annote("CacheSignedPilotReceipt", {
    description:
      "Three fresh pairs, three remote pairs, ten shadows and seven seeded mutations bound to an explicit network profile; operational protected-receipt validation remains required.",
  })
) {
  /**
   * Every baseline, shadow and mutation comparison requiring receipt validation.
   *
   * **Example** (Select all protected comparisons)
   * ```ts
   * import { CacheSignedPilotReceipt } from "@beep/repo-cli/commands/Cache"
   * const comparisons = (receipt: CacheSignedPilotReceipt) => receipt.comparisons
   * console.assert(typeof comparisons === "function")
   * ```
   *
   * @returns Every baseline, shadow and mutation comparison with a protected reader boundary.
   * @category getters
   * @since 0.0.0
   */
  get comparisons(): ReadonlyArray<CacheSignedPilotPair> {
    return A.appendAll(
      A.appendAll(
        this.pairs,
        A.map(this.shadows, (shadow) => shadow.comparison)
      ),
      A.map(this.mutations, (mutation) => mutation.comparison)
    );
  }
}

/**
 * Bind a signed experiment to a source checkout independently of the runner checkout.
 *
 * **Example** (Inspect the explicit source boundary)
 * ```ts
 * import { CacheSignedPilotRequest } from "@beep/repo-cli/commands/Cache"
 * console.assert("sourceRoot" in CacheSignedPilotRequest.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheSignedPilotRequest extends S.Class<CacheSignedPilotRequest>($I`CacheSignedPilotRequest`)(
  { sourceRoot: S.NonEmptyString, pilot: CachePilotRequest },
  $I.annote("CacheSignedPilotRequest", {
    description: "Frozen source checkout and exact native pilot request for a separately owned supervisor.",
  })
) {}
