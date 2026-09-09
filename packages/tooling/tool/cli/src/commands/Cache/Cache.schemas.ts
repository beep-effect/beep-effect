/**
 * Cache recovery and evidence schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import {
  CacheActivationProjection,
  CachePolicyBaseline,
  CacheQualificationEntry,
  CacheQualificationKey,
  CacheReviewDecision,
  CacheTaskConfiguration,
} from "@beep/repo-configs/cache";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { CacheCensusEntrypointReview } from "./Cache.entrypoints.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.schemas");

/**
 * Cache posture inferred for one Turbo run.
 *
 * **Example** (Recognize a remote-eligible run)
 *
 * ```ts
 * import { CacheRunMode } from "@beep/repo-cli/commands/Cache"
 *
 * console.log(CacheRunMode.is["remote-eligible"]("remote-eligible")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheRunMode = LiteralKit(["remote-eligible", "local-only", "forced", "disabled"]).pipe(
  $I.annoteSchema("CacheRunMode", { description: "Cache posture inferred for one Turbo summary run." })
);

/**
 * Cache posture inferred for one Turbo run.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheRunMode = typeof CacheRunMode.Type;

/**
 * Wall-clock distribution for one cache posture.
 *
 * **Example** (Validate a wall-time row)
 *
 * ```ts
 * import { CacheWallTime } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CacheWallTime)({ mode: "local-only", runs: 2, p50Ms: 100, p95Ms: 150 })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheWallTime extends S.Class<CacheWallTime>($I`CacheWallTime`)(
  {
    mode: CacheRunMode,
    runs: NonNegativeInt,
    p50Ms: NonNegativeInt,
    p95Ms: NonNegativeInt,
  },
  $I.annote("CacheWallTime", { description: "Turbo run wall-clock percentiles grouped by cache posture." })
) {}

/**
 * Lambda cache access counters imported from sanitized log rows.
 *
 * **Example** (Validate aggregate access counters)
 *
 * ```ts
 * import { CacheLambdaSummary } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CacheLambdaSummary)({ rows: 3, reads: 2, hits: 1, puts: 1 })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheLambdaSummary extends S.Class<CacheLambdaSummary>($I`CacheLambdaSummary`)(
  {
    rows: NonNegativeInt,
    reads: NonNegativeInt,
    hits: NonNegativeInt,
    puts: NonNegativeInt,
  },
  $I.annote("CacheLambdaSummary", { description: "Aggregate remote-cache access counts without secret data." })
) {}

/**
 * Versioned remote-cache dashboard report.
 *
 * **Example** (Inspect the dashboard schema)
 *
 * ```ts
 * import { CacheDashboardReport } from "@beep/repo-cli/commands/Cache"
 *
 * console.log(CacheDashboardReport.ast._tag) // "Transformation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDashboardReport extends S.Class<CacheDashboardReport>($I`CacheDashboardReport`)(
  {
    schema: S.tag("cache-dashboard/v1"),
    generatedAt: S.String,
    runFiles: NonNegativeInt,
    eligibleFirstTouches: NonNegativeInt,
    remoteHits: NonNegativeInt,
    eligibleRemoteHitRate: S.Finite,
    excludedForcedOrDisabled: NonNegativeInt,
    correctnessViolations: S.Array(S.String),
    wallTimes: S.Array(CacheWallTime),
    lambda: CacheLambdaSummary,
  },
  $I.annote("CacheDashboardReport", {
    description: "First-touch remote-cache rate, timing distributions, and correctness tripwires.",
  })
) {}

/**
 * One lane executed by cache warming.
 *
 * **Example** (Validate a warm-lane receipt)
 *
 * ```ts
 * import { CacheWarmLane } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CacheWarmLane)({ command: ["bun", "x", "turbo"], durationMs: 42, exitCode: 0 })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheWarmLane extends S.Class<CacheWarmLane>($I`CacheWarmLane`)(
  {
    command: S.Array(S.String),
    durationMs: NonNegativeInt,
    exitCode: S.Int,
  },
  $I.annote("CacheWarmLane", { description: "One cache-warm subprocess receipt." })
) {}

/**
 * Versioned receipt for an operator cache-warm run.
 *
 * **Example** (Inspect the warm-receipt schema)
 *
 * ```ts
 * import { CacheWarmReceipt } from "@beep/repo-cli/commands/Cache"
 *
 * console.log(CacheWarmReceipt.ast._tag) // "Transformation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheWarmReceipt extends S.Class<CacheWarmReceipt>($I`CacheWarmReceipt`)(
  {
    schema: S.tag("cache-warm/v1"),
    generatedAt: S.String,
    revision: S.String,
    bunVersion: S.String,
    lanes: S.Array(CacheWarmLane),
  },
  $I.annote("CacheWarmReceipt", {
    description: "Exact-main, pinned-toolchain cache recovery receipt.",
  })
) {}

/**
 * Cache command failure safe to render at the CLI boundary.
 *
 * **Example** (Create a typed command failure)
 *
 * ```ts
 * import { CacheCommandError } from "@beep/repo-cli/commands/Cache"
 *
 * console.log(CacheCommandError.make({ message: "cache probe failed" })._tag) // "CacheCommandError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CacheCommandError extends S.TaggedError<CacheCommandError>($I`CacheCommandError`)(
  "CacheCommandError",
  { message: S.String, cause: S.optionalKey(S.Defect()) },
  $I.annoteError<CacheCommandError>("CacheCommandError", {
    description: "A cache command precondition or subprocess failure.",
  })
) {
  /**
   * Map an unknown failure into a cache command error.
   *
   * @param message - Human-readable failure context.
   * @param cause - Optional underlying failure.
   * @returns A typed cache command error.
   */
  static readonly new = (message: string, cause?: unknown): CacheCommandError =>
    cause === undefined ? CacheCommandError.make({ message }) : CacheCommandError.make({ message, cause });

  /**
   * Map an Effect error into a cache command error with context.
   *
   * @param message - Human-readable failure context.
   * @returns A transform mapping an Effect error into a cache command error.
   */
  static readonly mapError =
    (message: string) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(
        Effect.mapError((cause) => (S.is(CacheCommandError)(cause) ? cause : CacheCommandError.new(message, cause)))
      );
}

/**
 * JSON codec for dashboard reports.
 *
 * **Example** (Inspect the dashboard codec)
 *
 * ```ts
 * import { CacheDashboardReportJson } from "@beep/repo-cli/commands/Cache"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(CacheDashboardReportJson.decode("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CacheDashboardReportJson = JsonStringCodec(CacheDashboardReport);

/**
 * JSON codec for warm receipts.
 *
 * **Example** (Inspect the warm-receipt codec)
 *
 * ```ts
 * import { CacheWarmReceiptJson } from "@beep/repo-cli/commands/Cache"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(CacheWarmReceiptJson.decode("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CacheWarmReceiptJson = JsonStringCodec(CacheWarmReceipt);

/**
 * All declared scripts of one actual workspace, including nested wrappers.
 *
 * **Example** (Inspect CacheCensusWorkspace)
 *
 * ```ts
 * import { CacheCensusWorkspace } from "@beep/repo-cli/commands/Cache"
 * const workspace = CacheCensusWorkspace.make({ name: "@beep/identity", directory: "packages/foundation/modeling/identity", scripts: { lint: "bun run beep:lint", "beep:lint": "biome check ." } })
 * console.assert(workspace.scripts.lint === "bun run beep:lint")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheCensusWorkspace extends S.Class<CacheCensusWorkspace>($I`CacheCensusWorkspace`)(
  {
    name: S.NonEmptyString,
    directory: S.NonEmptyString,
    scripts: S.Record(S.String, S.String),
  },
  $I.annote("CacheCensusWorkspace", {
    description: "All declared scripts of one actual workspace, including nested wrappers.",
  })
) {}

/**
 * A configured graph node joined to manifest script presence and effective Turbo settings.
 *
 * **Example** (Inspect CacheCensusNode)
 *
 * ```ts
 * import { CacheCensusNode } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheCensusNode)({ id: "@beep/identity#transit" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheCensusNode extends S.Class<CacheCensusNode>($I`CacheCensusNode`)(
  {
    id: S.NonEmptyString,
    workspace: S.NonEmptyString,
    task: S.NonEmptyString,
    command: S.OptionFromOptionalKey(S.String),
    commandDigest: Sha256Hex,
    dependencies: S.Array(S.String),
    configuration: CacheTaskConfiguration,
    inputCount: NonNegativeInt,
    inputsDigest: Sha256Hex,
  },
  $I.annote("CacheCensusNode", {
    description: "A configured graph node joined to manifest script presence and effective Turbo settings.",
  })
) {}

/**
 * Portable source file and its exact digest, without captured source or environment contents.
 *
 * **Example** (Inspect CacheCensusSource)
 *
 * ```ts
 * import { CacheCensusSource } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheCensusSource)({ path: "turbo.json", sha256: "unverified" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheCensusSource extends S.Class<CacheCensusSource>($I`CacheCensusSource`)(
  {
    path: S.NonEmptyString,
    sha256: Sha256Hex,
  },
  $I.annote("CacheCensusSource", {
    description: "Portable source file and its exact digest, without captured source or environment contents.",
  })
) {}

/**
 * Reproducible configured/executable census with explicit outstanding entrypoint review.
 *
 * **Example** (Inspect CacheCensusReport)
 *
 * ```ts
 * import { CacheCensusReport } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * const rejected = S.decodeUnknownEffect(CacheCensusReport)({ schemaVersion: "cache-executable-census/v0" }).pipe(Effect.isFailure)
 * console.assert(await Effect.runPromise(rejected))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheCensusReport extends S.Class<CacheCensusReport>($I`CacheCensusReport`)(
  {
    schemaVersion: S.tag("cache-executable-census/v1"),
    revision: S.NonEmptyString,
    turboVersion: S.NonEmptyString,
    rootScripts: S.Record(S.String, S.String),
    globalConfiguration: S.Json,
    workspaces: S.Array(CacheCensusWorkspace),
    nodes: S.Array(CacheCensusNode),
    sources: S.Array(CacheCensusSource),
    entrypointSources: S.Array(S.String),
    entrypointReview: CacheCensusEntrypointReview.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    unresolved: S.Array(S.String),
  },
  $I.annote("CacheCensusReport", {
    description: "Reproducible configured/executable census with explicit outstanding entrypoint review.",
  })
) {}

/**
 * Hash-relevant command/configuration definition without ordinary source-content task hashes.
 *
 * **Example** (Keep graph-only definitions distinct)
 *
 * ```ts
 * import { CacheCensusDefinition } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheCensusDefinition)({ id: "fixture#transit" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheCensusDefinition extends S.Class<CacheCensusDefinition>($I`CacheCensusDefinition`)(
  {
    id: CacheCensusNode.fields.id,
    command: CacheCensusNode.fields.command,
    commandDigest: CacheCensusNode.fields.commandDigest,
    dependencies: CacheCensusNode.fields.dependencies,
    configuration: CacheCensusNode.fields.configuration,
  },
  $I.annote("CacheCensusDefinition", {
    description: "A command and effective graph definition, excluding ordinary source file values.",
  })
) {}

/**
 * Reviewed computation dependency closure and complete production Turbo source identity.
 *
 * **Example** (Reject an unbound configuration)
 *
 * ```ts
 * import { CacheComputationConfiguration } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheComputationConfiguration)({ nodes: [] }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheComputationConfiguration extends S.Class<CacheComputationConfiguration>(
  $I`CacheComputationConfiguration`
)(
  {
    computation: CacheQualificationKey.fields.computation,
    globalConfiguration: S.Json,
    nodes: S.NonEmptyArray(CacheCensusDefinition),
    sources: S.Array(CacheCensusSource),
  },
  $I.annote("CacheComputationConfiguration", {
    description: "Computation dependency closure, global settings and production Turbo configuration digests.",
  })
) {}

/**
 * Observed executable version bound to the exact installed file bytes.
 *
 * **Example** (Reject a version-only tool claim)
 *
 * ```ts
 * import { CacheExecutablePin } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheExecutablePin)({ version: "1.4.1" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheExecutablePin extends S.Class<CacheExecutablePin>($I`CacheExecutablePin`)(
  { version: S.NonEmptyString, sha256: Sha256Hex },
  $I.annote("CacheExecutablePin", { description: "Exact observed executable version and binary digest." })
) {}

/**
 * A package-tree link restricted to the installed tree or a declared workspace.
 *
 * **Example** (Inspect workspace-link evidence)
 *
 * ```ts
 * import { CacheDependencyLink } from "@beep/repo-cli/commands/Cache"
 * console.assert("Workspace" in CacheDependencyLink.cases)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheDependencyLink = S.TaggedUnion({
  Internal: { path: S.NonEmptyString, target: S.NonEmptyString },
  Workspace: { path: S.NonEmptyString, target: S.NonEmptyString, workspace: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("CacheDependencyLink", {
    description: "Validated relative symlink topology of an installed dependency tree.",
  })
);
/**
 * An installed-tree or declared-workspace link.
 * @category models
 * @since 0.0.0
 */
export type CacheDependencyLink = typeof CacheDependencyLink.Type;

/**
 * A bounded canonical archive digest with separately validated link topology.
 *
 * **Details**
 *
 * The digest preserves paths, file bytes, modes and symlink targets. GNU tar
 * normalizes ownership and timestamps and dereferences hard links into bytes.
 * It does not attest registry provenance, ACLs or extended attributes.
 *
 * **Example** (Inspect the content identity)
 *
 * ```ts
 * import { CacheDependencyTree } from "@beep/repo-cli/commands/Cache"
 * console.assert("sha256" in CacheDependencyTree.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheDependencyTree extends S.Class<CacheDependencyTree>($I`CacheDependencyTree`)(
  {
    format: S.Literal("canonical-gnu-tar/v1"),
    sha256: Sha256Hex,
    regularFiles: NonNegativeInt.check(S.isLessThanOrEqualTo(400000)),
    entries: NonNegativeInt.check(S.isLessThanOrEqualTo(600000)),
    bytes: NonNegativeInt.check(S.isLessThanOrEqualTo(16 * 1024 * 1024 * 1024)),
    links: S.Array(CacheDependencyLink).check(S.isMaxLength(4096)),
  },
  $I.annote("CacheDependencyTree", {
    description: "A bounded installed tree fingerprint, independent of checkout location and file timestamps.",
  })
) {}

/**
 * An observed library or loader alias, its physical target, and exact bytes.
 *
 * **Example** (Inspect content and resolution bindings)
 *
 * ```ts
 * import { CacheLinkedFile } from "@beep/repo-cli/commands/Cache"
 * console.assert("target" in CacheLinkedFile.fields && "sha256" in CacheLinkedFile.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheLinkedFile extends S.Class<CacheLinkedFile>($I`CacheLinkedFile`)(
  {
    path: S.NonEmptyString.check(S.isPattern(/^\/[^\0\r\n]*$/)),
    target: S.NonEmptyString.check(S.isPattern(/^\/[^\0\r\n]*$/)),
    sha256: Sha256Hex,
  },
  $I.annote("CacheLinkedFile", {
    description: "Absolute loader-reported path and resolved physical target bound to a content digest.",
  })
) {}

/**
 * Explicit static linkage or the files resolved by the glibc loader.
 *
 * **Details**
 *
 * This records startup linkage under the discovery environment. It does not
 * claim coverage of later dynamic loading or asynchronous file access.
 *
 * **Example** (Represent inspected static linkage)
 *
 * ```ts
 * import { CacheLinkerResolution } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheLinkerResolution.guards.Static(CacheLinkerResolution.cases.Static.make({})))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheLinkerResolution = S.TaggedUnion({
  Static: {},
  Dynamic: { files: S.NonEmptyArray(CacheLinkedFile).check(S.isMaxLength(256)) },
}).pipe(
  $I.annoteSchema("CacheLinkerResolution", {
    description: "Inspected static linkage or bounded startup library resolution, never inferred from failure.",
  })
);
/**
 * A successfully inspected executable's startup linkage.
 * @category models
 * @since 0.0.0
 */
export type CacheLinkerResolution = typeof CacheLinkerResolution.Type;

/**
 * Executable roles observed in the supported local lint runtime.
 *
 * **Example** (Enumerate required observations)
 *
 * ```ts
 * import { CacheRuntimeExecutable } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheRuntimeExecutable.Options.length === 6)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheRuntimeExecutable = LiteralKit(["bun", "node", "turbo", "biome", "bash", "sh"]).pipe(
  $I.annoteSchema("CacheRuntimeExecutable", {
    description: "Native runtimes, selected cache client, lint engine and script shells requiring linkage evidence.",
  })
);
/**
 * An executable role requiring startup linkage evidence.
 * @category models
 * @since 0.0.0
 */
export type CacheRuntimeExecutable = typeof CacheRuntimeExecutable.Type;

/**
 * Bounded startup resolution with exact discovery helper and loader identities.
 *
 * **Example** (Require explicit discovery provenance)
 *
 * ```ts
 * import { CacheRuntimeLinkerSnapshot } from "@beep/repo-cli/commands/Cache"
 * console.assert("loader" in CacheRuntimeLinkerSnapshot.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheRuntimeLinkerSnapshot extends S.Class<CacheRuntimeLinkerSnapshot>($I`CacheRuntimeLinkerSnapshot`)(
  {
    format: S.Literal("glibc-ldd/v1"),
    detector: CacheLinkedFile,
    loader: CacheLinkedFile,
    executables: S.Record(CacheRuntimeExecutable, CacheLinkerResolution),
  },
  $I.annote("CacheRuntimeLinkerSnapshot", {
    description: "Clean-environment glibc startup resolution for every supported executable role.",
  })
) {}

/**
 * Actual tools and platform for the explicitly supported qualification profiles.
 *
 * **Example** (Reject an unsupported profile)
 *
 * ```ts
 * import { CacheToolchainSnapshot } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheToolchainSnapshot)({ profile: "hosted-ubuntu" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheToolchainSnapshot extends S.Class<CacheToolchainSnapshot>($I`CacheToolchainSnapshot`)(
  {
    profile: LiteralKit(["local-linux-x64-bun1.4.1", "local-linux-x64-bun1.4.2"]),
    kernel: S.NonEmptyString,
    libc: S.NonEmptyString,
    bun: CacheExecutablePin,
    node: CacheExecutablePin,
    turbo: CacheExecutablePin,
    biome: CacheExecutablePin,
    installedDependencies: S.OptionFromOptionalKey(CacheDependencyTree).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    runtimeLinker: S.OptionFromOptionalKey(CacheRuntimeLinkerSnapshot).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    sources: S.Array(CacheCensusSource),
  },
  $I.annote("CacheToolchainSnapshot", {
    description: "Linux x64 glibc profile, exact binaries, launchers, lockfile and runtime declarations.",
  })
) {}

/**
 * Current configuration and toolchain evidence used to admit a candidate or detect drift.
 *
 * **Example** (Reject a digest without its observed projection)
 *
 * ```ts
 * import { CacheLiveIdentity } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheLiveIdentity)({ schemaVersion: "cache-live-identity/v1" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheLiveIdentity extends S.Class<CacheLiveIdentity>($I`CacheLiveIdentity`)(
  {
    schemaVersion: S.tag("cache-live-identity/v1"),
    key: CacheQualificationKey,
    configuration: CacheComputationConfiguration,
    configurationDigest: Sha256Hex,
    toolchain: CacheToolchainSnapshot,
    toolchainDigest: Sha256Hex,
  },
  $I.annote("CacheLiveIdentity", {
    description: "Current, content-bound computation configuration and supported runtime profile.",
  })
) {}

/**
 * Reviewed baseline replacement with a digest compare-and-swap precondition.
 *
 * **Example** (Reject a baseline without review)
 *
 * ```ts
 * import { CacheBaselineRequest } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheBaselineRequest)({ scope: ["@beep/identity#lint"] }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheBaselineRequest extends S.Class<CacheBaselineRequest>($I`CacheBaselineRequest`)(
  {
    review: CacheReviewDecision,
    scope: CachePolicyBaseline.fields.scope,
    profile: CachePolicyBaseline.fields.profile,
    epoch: CachePolicyBaseline.fields.epoch,
    previous: S.OptionFromOptionalKey(Sha256Hex),
  },
  $I.annote("CacheBaselineRequest", { description: "Explicit review and expected prior baseline digest." })
) {}

/**
 * One reviewed transition against an exact qualification ledger revision.
 *
 * **Example** (Reject an unreviewed promotion request)
 *
 * ```ts
 * import { CacheTransitionRequest } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheTransitionRequest)({ expectedRevision: 0, state: "qualified" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheTransitionRequest extends S.Class<CacheTransitionRequest>($I`CacheTransitionRequest`)(
  { expectedRevision: NonNegativeInt, entry: CacheQualificationEntry },
  $I.annote("CacheTransitionRequest", { description: "One reviewed transition and its optimistic revision guard." })
) {}

/**
 * Immutable before/after artifacts for a read-only pilot activation preview.
 *
 * **Example** (Inspect the preview request)
 *
 * ```ts
 * import { CacheActivationRequest } from "@beep/repo-cli/commands/Cache"
 * console.assert("after" in CacheActivationRequest.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheActivationRequest extends S.Class<CacheActivationRequest>($I`CacheActivationRequest`)(
  {
    computation: CacheQualificationKey.fields.computation,
    path: CacheActivationProjection.fields.path,
    before: CacheActivationProjection.fields.before,
    after: CacheActivationProjection.fields.after,
  },
  $I.annote("CacheActivationRequest", {
    description: "Exact artifacts and live destination for one pilot cache-flag preview.",
  })
) {}

/**
 * Observed disabled configuration and its validated cache-enabled projection.
 *
 * **Details**
 * The target is a computed preview. Runtime experiments must independently
 * observe that exact configuration before their evidence is accepted.
 *
 * **Example** (Inspect the preview evidence)
 *
 * ```ts
 * import { CacheActivationPreview } from "@beep/repo-cli/commands/Cache"
 * console.assert("target" in CacheActivationPreview.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CacheActivationPreview extends S.Class<CacheActivationPreview>($I`CacheActivationPreview`)(
  {
    schemaVersion: S.tag("cache-activation-preview/v1"),
    activation: CacheActivationProjection,
    source: CacheLiveIdentity,
    target: CacheLiveIdentity,
  },
  $I.annote("CacheActivationPreview", {
    description: "Validated before/after configuration projection without enabling task reuse.",
  })
) {}
