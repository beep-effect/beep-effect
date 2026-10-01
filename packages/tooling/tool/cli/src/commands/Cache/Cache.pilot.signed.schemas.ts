/**
 * Signed real-pilot observations, separate from offline local receipts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientPin } from "@beep/repo-configs/cache";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { CachePilotReceipt, CachePilotRequest, CachePilotRun, CachePilotTask } from "./Cache.pilot.schemas.ts";
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
    logBytes: NonNegativeInt,
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
    id: NonNegativeInt,
    client: CacheClientPin,
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
    schemaVersion: S.tag("cache-pilot-signed/v2"),
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
    pairs: S.Array(CacheSignedPilotPair).check(S.isMinLength(3), S.isMaxLength(3)),
  },
  $I.annote("CacheSignedPilotReceipt", {
    description:
      "Three signed real-pilot pairs bound to an explicit network profile; operational protected-receipt validation remains required.",
  })
) {}

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
