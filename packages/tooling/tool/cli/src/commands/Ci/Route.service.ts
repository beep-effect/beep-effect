/**
 * Service contracts of the verification route: the change classifier, the
 * route, the hosted corpus and the census/replay reader. Implementations live
 * beside them (`RouteClassify.ts`, `RouteCensus.ts`, `RouteCorpus.ts`) and are
 * provided as layers; nothing here runs a command.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { HostedRun, RouteCorpusReceipt } from "./Route.schemas.ts";
import type { ChangeSet, RouteCensus, RouteError, RoutePlan, RouteReplay } from "./Route.schemas.ts";

const $I = $RepoCliId.create("commands/Ci/Route.service");

/**
 * What the classifier reads: a repository root and the two commits whose
 * diff it classifies (`base` is the merge base, `head` the change).
 *
 * **Example** (Classify the working head against its merge base)
 *
 * ```ts
 * import { ClassifyInput } from "@beep/repo-cli/commands/Ci"
 *
 * const input = ClassifyInput.make({ repoRoot: "/repo", base: "aaaa", head: "HEAD" })
 * console.log(input.head) // "HEAD"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClassifyInput extends S.Opaque<ClassifyInput, { readonly brand: unique symbol }>()(
  S.Struct({
    repoRoot: S.NonEmptyString,
    base: S.NonEmptyString,
    head: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ClassifyInput", {
      description: "Repository root and the base and head commits whose diff is classified.",
    })
  )
) {}

/**
 * Contract of the change classifier: a total function from a commit range to
 * a {@link ChangeSet}.
 *
 * @category services
 * @since 0.0.0
 */
export interface ChangeClassifierShape {
  /** Classify every changed path between `base` and `head`; unclassifiable hunks are `unknown`, never a failure. */
  readonly classify: (input: ClassifyInput) => Effect.Effect<ChangeSet, RouteError>;
}

/**
 * The change classifier service.
 *
 * **Example** (Read the service)
 *
 * ```ts
 * import { ChangeClassifier } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const classifier = yield* ChangeClassifier
 *   return typeof classifier.classify
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ChangeClassifier extends Context.Service<ChangeClassifier, ChangeClassifierShape>()(
  $I`ChangeClassifier`
) {}

/**
 * Contract of the route: from a classified change to the lanes it requires,
 * in wave order, with the affected packages and the footprint digest.
 *
 * @category services
 * @since 0.0.0
 */
export interface VerificationRouteShape {
  /** Select the lanes the change requires under the footprint record; never reorders beyond `WaveOrder`. */
  readonly plan: (changeSet: ChangeSet) => Effect.Effect<RoutePlan, RouteError>;
}

/**
 * The verification route service.
 *
 * @category services
 * @since 0.0.0
 */
export class VerificationRoute extends Context.Service<VerificationRoute, VerificationRouteShape>()(
  $I`VerificationRoute`
) {}

/**
 * Options for capturing the hosted corpus: the window, the workflows, and
 * where the pinned files land.
 *
 * **Example** (Capture both hosted workflows since the baseline start)
 *
 * ```ts
 * import { RouteCorpusCaptureOptions } from "@beep/repo-cli/commands/Ci"
 *
 * const options = RouteCorpusCaptureOptions.make({
 *   repoRoot: "/repo",
 *   since: "2026-09-01",
 *   workflows: ["Check", "Heavy"],
 *   outDir: "goals/verification-route/research/corpus",
 * })
 * console.log(options.workflows.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteCorpusCaptureOptions extends S.Opaque<RouteCorpusCaptureOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    repoRoot: S.NonEmptyString,
    since: S.NonEmptyString,
    until: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    workflows: S.Array(S.NonEmptyString),
    outDir: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("RouteCorpusCaptureOptions", {
      description: "Capture window (UTC dates), hosted workflows and the output directory of the pinned corpus.",
    })
  )
) {}

/**
 * A loaded corpus: its receipt (verified against the file bytes) and its runs.
 *
 * @category models
 * @since 0.0.0
 */
export class RouteCorpusLoaded extends S.Opaque<RouteCorpusLoaded, { readonly brand: unique symbol }>()(
  S.Struct({
    receipt: RouteCorpusReceipt,
    runs: S.Array(HostedRun),
  }).pipe(
    $I.annoteSchema("RouteCorpusLoaded", {
      description: "A corpus whose bytes matched its receipt, with its decoded runs.",
    })
  )
) {}

/**
 * Contract of the corpus: capture hosted runs into a digest-pinned file,
 * resuming by head and never re-fetching a pinned head, and load one back
 * only when its bytes match the receipt.
 *
 * @category services
 * @since 0.0.0
 */
export interface RouteCorpusShape {
  /** Capture (or extend) the corpus and write its receipt. */
  readonly capture: (options: RouteCorpusCaptureOptions) => Effect.Effect<RouteCorpusReceipt, RouteError>;
  /** Load a corpus by its receipt path: the corpus file lives beside the receipt (`receipt.path` records its repo-relative location), and the load fails when the file's sha256 or run count differs from the receipt. */
  readonly load: (receiptPath: string) => Effect.Effect<RouteCorpusLoaded, RouteError>;
}

/**
 * The hosted corpus service.
 *
 * @category services
 * @since 0.0.0
 */
export class RouteCorpus extends Context.Service<RouteCorpus, RouteCorpusShape>()($I`RouteCorpus`) {}

/**
 * Contract of the census and replay reader over a loaded corpus.
 *
 * @category services
 * @since 0.0.0
 */
export interface RouteCensusShape {
  /** Machine time the route would not select, by atom kind and lane, with the unknown share. */
  readonly census: (corpus: RouteCorpusLoaded) => Effect.Effect<RouteCensus, RouteError>;
  /** Recall of the route over the corpus with base-green attribution. */
  readonly replay: (corpus: RouteCorpusLoaded) => Effect.Effect<RouteReplay, RouteError>;
}

/**
 * The census and replay service.
 *
 * @category services
 * @since 0.0.0
 */
export class RouteCensusReader extends Context.Service<RouteCensusReader, RouteCensusShape>()($I`RouteCensusReader`) {}
