/**
 * Requests and local observations for the real identity lint pilot.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import {
  CacheClientChannel,
  CacheClientPin,
  CacheEvidenceReference,
  CacheQualificationKey,
} from "@beep/repo-configs/cache";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { CacheLocalOrigin, CacheSyntheticCheck, CacheSyntheticRun } from "./Cache.experiment.schemas.ts";
import { CacheDependencyTree, CacheExecutablePin } from "./Cache.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.pilot.schemas");

/**
 * Select two read-only registered worktrees and exact local experiment tools.
 *
 * **Example** (Inspect the immutable proposal reference)
 *
 * ```ts
 * import { CachePilotRequest } from "@beep/repo-cli/commands/Cache"
 * console.assert("activation" in CachePilotRequest.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePilotRequest extends S.Class<CachePilotRequest>($I`CachePilotRequest`)(
  {
    channel: CacheClientChannel,
    client: CacheClientPin,
    executable: S.NonEmptyString,
    biomeExecutable: S.NonEmptyString,
    nodeExecutable: S.NonEmptyString,
    dependencies: CacheEvidenceReference,
    worktrees: S.Tuple([S.NonEmptyString, S.NonEmptyString]),
    activation: CacheEvidenceReference,
    selection: LiteralKit(["full", "controls"]).pipe(
      S.withDecodingDefaultKey(Effect.succeed<"full">("full")),
      S.withConstructorDefault(Effect.succeed<"full">("full"))
    ),
  },
  $I.annote("CachePilotRequest", {
    description:
      "A bounded real-lint experiment using registered read-only worktrees and a verified activation preview.",
  })
) {}

/**
 * Native grouped task stream before removing its single orchestration line.
 *
 * **Example** (Describe a disabled authoritative execution)
 *
 * ```ts
 * import { CachePilotLogInput } from "@beep/repo-cli/commands/Cache"
 * const input = CachePilotLogInput.make({
 *   computation: "@beep/identity#lint", taskHash: "0123456789abcdef",
 *   origin: "fresh", cacheEnabled: false, truncated: false,
 *   stdout: "@beep/identity:lint: cache bypass, force executing 0123456789abcdef\n",
 *   stderr: "",
 * })
 * console.assert(input.origin === "fresh")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePilotLogInput extends S.Class<CachePilotLogInput>($I`CachePilotLogInput`)(
  {
    computation: CacheQualificationKey.fields.computation,
    taskHash: CacheSyntheticRun.fields.taskHash,
    origin: CacheLocalOrigin,
    cacheEnabled: S.Boolean,
    stdout: S.String,
    stderr: S.String,
    truncated: S.Boolean,
  },
  $I.annote("CachePilotLogInput", {
    description: "Bounded separate process streams and the exact selected-task identity observed in a native summary.",
  })
) {}

/**
 * A selected task's native cache and execution facts.
 *
 * **Example** (Inspect the execution verdict)
 *
 * ```ts
 * import { CachePilotTask } from "@beep/repo-cli/commands/Cache"
 * console.assert("exitCode" in CachePilotTask.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePilotTask extends S.Class<CachePilotTask>($I`CachePilotTask`)(
  {
    computation: CacheQualificationKey.fields.computation,
    taskHash: CacheSyntheticRun.fields.taskHash,
    origin: CacheLocalOrigin,
    exitCode: S.Int,
    inputsDigest: Sha256Hex,
  },
  $I.annote("CachePilotTask", {
    description: "Observed task identity, local origin, exit verdict and expanded-input digest.",
  })
) {}

/**
 * Classify executed pilot observations separately from a blocked dependency graph.
 *
 * **Example** (Recognize a dependency block)
 *
 * ```ts
 * import { CachePilotOutcome } from "@beep/repo-cli/commands/Cache"
 * console.assert("Blocked" in CachePilotOutcome.cases)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CachePilotOutcome = S.TaggedUnion({
  Executed: {
    selected: CachePilotTask,
    logSha256: Sha256Hex,
    logBytes: NonNegativeInt,
    replayLogMatches: S.Boolean,
  },
  Blocked: { failedDependencies: S.NonEmptyArray(CachePilotTask) },
}).pipe(
  $I.annoteSchema("CachePilotOutcome", { description: "Executed task evidence or a graph blocked before that task." })
);
/**
 * Native task execution or attributed non-execution.
 *
 * @category models
 * @since 0.0.0
 */
export type CachePilotOutcome = typeof CachePilotOutcome.Type;

/**
 * A local real-pilot execution with separate graph and task observations.
 *
 * **Example** (Inspect the non-execution boundary)
 *
 * ```ts
 * import { CachePilotRun } from "@beep/repo-cli/commands/Cache"
 * console.assert("outcome" in CachePilotRun.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePilotRun extends S.Class<CachePilotRun>($I`CachePilotRun`)(
  {
    nativeRuntimeKeyObserved: S.Boolean,
    id: S.NonEmptyString,
    root: LiteralKit(["root-a", "root-b"]),
    cacheEnabled: S.Boolean,
    graphExitCode: S.Int,
    outcome: CachePilotOutcome,
    dependencies: S.Array(CachePilotTask),
    summarySha256: Sha256Hex,
    sourceTreeUnchanged: S.Boolean,
  },
  $I.annote("CachePilotRun", {
    description: "One bounded local observation; missing tasks are never counted as executions.",
  })
) {}

/**
 * Bind a local shadow decision to its authoritative execution and replay pair.
 *
 * **Example** (Inspect the authoritative run reference)
 *
 * ```ts
 * import { CachePilotShadow } from "@beep/repo-cli/commands/Cache"
 * console.assert("authoritative" in CachePilotShadow.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePilotShadow extends S.Class<CachePilotShadow>($I`CachePilotShadow`)(
  {
    id: S.NonEmptyString,
    authoritative: S.NonEmptyString,
    producer: S.NonEmptyString,
    replay: S.NonEmptyString,
    environmentNames: S.Array(S.NonEmptyString),
    expectedInputHash: LiteralKit(["stable", "changed"]),
    inputHashExpectationMet: S.Boolean,
    equivalent: S.Boolean,
  },
  $I.annote("CachePilotShadow", {
    description:
      "A local cross-worktree replay compared against fresh authority with an explicit perturbation expectation.",
  })
) {}

/**
 * Compare a seeded local cache against a changed configuration or manifest.
 *
 * **Example** (Inspect the perturbation evidence)
 *
 * ```ts
 * import { CachePilotMutation } from "@beep/repo-cli/commands/Cache"
 * console.assert("changedPath" in CachePilotMutation.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePilotMutation extends S.Class<CachePilotMutation>($I`CachePilotMutation`)(
  {
    id: S.NonEmptyString,
    changedPath: CacheEvidenceReference.fields.path,
    beforeSha256: Sha256Hex,
    afterSha256: S.OptionFromOptionalKey(Sha256Hex),
    baseline: S.NonEmptyString,
    changed: S.NonEmptyString,
    replay: S.NonEmptyString,
    expectedBaselineExit: S.Int,
    expectedChangedExit: S.Int,
    passed: S.Boolean,
  },
  $I.annote("CachePilotMutation", {
    description:
      "Exact changed file bytes, native run references and expected verdicts for one local invalidation control.",
  })
) {}

/**
 * Attribute a native setup refusal or absent selected script without counting an execution.
 *
 * **Example** (Inspect the absence boundary)
 *
 * ```ts
 * import { CachePilotNonExecution } from "@beep/repo-cli/commands/Cache"
 * console.assert("selectedExecutionObserved" in CachePilotNonExecution.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePilotNonExecution extends S.Class<CachePilotNonExecution>($I`CachePilotNonExecution`)(
  {
    id: S.NonEmptyString,
    reason: LiteralKit(["missing-root-config", "malformed-root-config", "malformed-child-config", "absent-script"]),
    exitCode: S.Int,
    stdoutSha256: Sha256Hex,
    stderrSha256: Sha256Hex,
    summaryPresent: S.Boolean,
    selectedExecutionObserved: S.Boolean,
    passed: S.Boolean,
  },
  $I.annote("CachePilotNonExecution", {
    description: "Bounded native evidence for a setup refusal or a configured task whose package script is absent.",
  })
) {}

/**
 * Local real-pilot results with no signed-remote or promotion authority.
 *
 * **Details**
 *
 * `toolchainDigest` binds the reviewed installation. `runtimeKeyDigest` uses
 * the requested native Turbo client and is provided as the declared
 * `BEEP_CACHE_TOOLCHAIN_DIGEST` input. Each run records whether native metadata
 * confirms that key; the named missing-child control can remove its declaration.
 *
 * **Example** (Inspect the explicit authority limit)
 *
 * ```ts
 * import { CachePilotReceipt } from "@beep/repo-cli/commands/Cache"
 * console.assert("authority" in CachePilotReceipt.fields)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CachePilotReceipt extends S.Class<CachePilotReceipt>($I`CachePilotReceipt`)(
  {
    schemaVersion: S.Literal("cache-pilot-local/v5"),
    clientSelection: S.Literal("pinned-native-skip-infer"),
    runtimeKeying: S.Literal("toolchain-sha256-env/v1"),
    runtimeKeyDigest: Sha256Hex,
    authority: S.Literal("local-observation-only"),
    key: CacheQualificationKey,
    sourceRevision: GitObjectId,
    channel: CacheClientChannel,
    client: CacheClientPin,
    bun: CacheExecutablePin,
    biome: CacheExecutablePin,
    node: CacheExecutablePin,
    installedDependencies: CacheDependencyTree,
    activation: CacheEvidenceReference,
    configurationDigest: Sha256Hex,
    toolchainDigest: Sha256Hex,
    runs: S.Array(CachePilotRun),
    checks: S.Array(CacheSyntheticCheck),
    shadowDecisions: S.Array(CachePilotShadow),
    selection: CachePilotRequest.fields.selection,
    mutations: S.Array(CachePilotMutation),
    nonExecutions: S.Array(CachePilotNonExecution),
    remaining: S.NonEmptyArray(S.NonEmptyString),
  },
  $I.annote("CachePilotReceipt", {
    description: "Versioned local pilot observations; signed replay and full qualification remain separate.",
  })
) {}
