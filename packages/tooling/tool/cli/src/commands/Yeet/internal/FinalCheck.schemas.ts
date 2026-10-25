/**
 * Schema-first models for `yeet final-check`, the scoped replay of the hosted
 * gates a lane must pass before it may call a pull request final.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { QualityTaskStep } from "../../../internal/process/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/FinalCheck.schemas");

/**
 * The hosted gate families `yeet final-check` replays, in run order.
 *
 * **Details**
 *
 * Each gate names the hosted check context it stands in for. The order runs
 * the cheapest gates first so a red surfaces before the Turbo-heavy ones.
 *
 * **Example** (List the final-check gates)
 *
 * ```ts
 * import { FinalCheckGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FinalCheckGate.literals[0]) // "expectation-rewrite"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FinalCheckGate = LiteralKit([
  "expectation-rewrite",
  "cheap-gates",
  "lint-policy",
  "lint",
  "repo-sanity",
  "effect-diagnostics",
  "check",
  "docgen",
  "fallow",
  "coverage",
]).pipe(
  $I.annoteSchema("FinalCheckGate", {
    description: "A hosted gate family replayed by yeet final-check before a lane calls its pull request final.",
  })
);

/**
 * A hosted gate family replayed by `yeet final-check`.
 *
 * @category models
 * @since 0.0.0
 */
export type FinalCheckGate = typeof FinalCheckGate.Type;

/**
 * Outcome of one final-check step.
 *
 * **Example** (Check a step status)
 *
 * ```ts
 * import { FinalCheckStepStatus } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FinalCheckStepStatus.is.failed("failed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FinalCheckStepStatus = LiteralKit(["passed", "failed", "skipped"]).pipe(
  $I.annoteSchema("FinalCheckStepStatus", {
    description: "Outcome of one yeet final-check step: passed, failed, or skipped with a recorded reason.",
  })
);

/**
 * Outcome of one final-check step.
 *
 * @category models
 * @since 0.0.0
 */
export type FinalCheckStepStatus = typeof FinalCheckStepStatus.Type;

/**
 * One executed (or skipped) final-check step and the hosted context it covers.
 *
 * **Example** (Record a passed step)
 *
 * ```ts
 * import { FinalCheckStepResult } from "@beep/repo-cli/test/Yeet"
 *
 * const step = FinalCheckStepResult.make({
 *   gate: "check",
 *   label: "final-check:check",
 *   hostedContext: "Heavy / Check",
 *   command: "bun run beep ci lane check --affected --base abc --summarize",
 *   status: "passed",
 *   durationMs: 1200,
 * })
 * console.log(step.status) // "passed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinalCheckStepResult extends S.Opaque<FinalCheckStepResult, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: FinalCheckGate,
    label: S.String,
    hostedContext: S.String,
    command: S.String,
    status: FinalCheckStepStatus,
    durationMs: S.Finite,
    reason: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("FinalCheckStepResult", {
      description: "One executed or skipped yeet final-check step, its command, and the hosted context it replays.",
    })
  )
) {}

/**
 * How an edited test expectation relates to the diff that edited it.
 *
 * **Details**
 *
 * `masks-base-red`: the old expectation already failed on the merge base, so
 * the edit makes an inherited red pass without a source fix. `follows-diff`:
 * the old expectation passed on the merge base, so the diff's own source
 * change moved the output. `unverified`: the base run could not be performed.
 *
 * **Example** (Check a rewrite classification)
 *
 * ```ts
 * import { ExpectationRewriteClassification } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ExpectationRewriteClassification.is["masks-base-red"]("masks-base-red")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExpectationRewriteClassification = LiteralKit(["masks-base-red", "follows-diff", "unverified"]).pipe(
  $I.annoteSchema("ExpectationRewriteClassification", {
    description: "Whether an edited test expectation masks a red already present on the merge base.",
  })
);

/**
 * How an edited test expectation relates to the diff that edited it.
 *
 * @category models
 * @since 0.0.0
 */
export type ExpectationRewriteClassification = typeof ExpectationRewriteClassification.Type;

/**
 * An existing test assertion the diff rewrote (a removed assertion line
 * replaced by an added one in the same hunk), or an edited snapshot file.
 *
 * **Example** (Describe a rewritten expectation)
 *
 * ```ts
 * import { ExpectationRewrite } from "@beep/repo-cli/test/Yeet"
 *
 * const rewrite = ExpectationRewrite.make({
 *   testFile: "packages/tooling/tool/cli/test/yeet.test.ts",
 *   line: 2375,
 *   removed: 'expect(markdown).toContain("@beep/repo")',
 *   added: 'expect(markdown).toContain("\\\\@beep/repo")',
 * })
 * console.log(rewrite.line) // 2375
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExpectationRewrite extends S.Opaque<ExpectationRewrite, { readonly brand: unique symbol }>()(
  S.Struct({
    testFile: S.String,
    baseFile: S.optionalKey(S.String),
    line: S.Finite,
    removed: S.String,
    added: S.String,
  }).pipe(
    $I.annoteSchema("ExpectationRewrite", {
      description:
        "An existing test assertion or snapshot the diff rewrote, located by test file and new line; baseFile is the test file's path on the merge base when a rename moved it.",
    })
  )
) {}

/**
 * The base-run verdict for one test file whose expectations were rewritten.
 *
 * **Example** (Record a masking rewrite)
 *
 * ```ts
 * import { ExpectationRewriteVerdict } from "@beep/repo-cli/test/Yeet"
 *
 * const verdict = ExpectationRewriteVerdict.make({
 *   testFile: "packages/tooling/tool/cli/test/yeet.test.ts",
 *   classification: "masks-base-red",
 *   rewrites: 1,
 *   detail: "the old test fails on the merge base",
 * })
 * console.log(verdict.classification) // "masks-base-red"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExpectationRewriteVerdict extends S.Opaque<ExpectationRewriteVerdict, { readonly brand: unique symbol }>()(
  S.Struct({
    testFile: S.String,
    classification: ExpectationRewriteClassification,
    rewrites: S.Finite,
    detail: S.String,
  }).pipe(
    $I.annoteSchema("ExpectationRewriteVerdict", {
      description: "Whether the old version of a rewritten test file passed on the merge base.",
    })
  )
) {}

/**
 * Overall final-check verdict.
 *
 * **Example** (Check a verdict)
 *
 * ```ts
 * import { FinalCheckVerdict } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FinalCheckVerdict.is.pass("pass")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FinalCheckVerdict = LiteralKit(["pass", "fail"]).pipe(
  $I.annoteSchema("FinalCheckVerdict", {
    description:
      "Overall yeet final-check verdict: pass only when no step failed and every gate ran or was skipped with a reason.",
  })
);

/**
 * Overall final-check verdict.
 *
 * @category models
 * @since 0.0.0
 */
export type FinalCheckVerdict = typeof FinalCheckVerdict.Type;

/**
 * The receipt `yeet final-check` writes for one committed head, read by
 * `yeet ready` before it flips a draft.
 *
 * **Details**
 *
 * `complete` is true only when every {@link FinalCheckGate} ran or was skipped
 * with a reason; a `--gates` subset run is never complete and never admits
 * the flip.
 *
 * **Example** (Build a receipt)
 *
 * ```ts
 * import { FinalCheckReceipt } from "@beep/repo-cli/test/Yeet"
 *
 * const receipt = FinalCheckReceipt.make({
 *   schemaVersion: "yeet-final-check/v1",
 *   headSha: "a".repeat(40),
 *   mergeBase: "b".repeat(40),
 *   base: "origin/main",
 *   complete: true,
 *   verdict: "pass",
 *   startedAt: "2026-10-24T00:00:00.000Z",
 *   finishedAt: "2026-10-24T00:10:00.000Z",
 *   steps: [],
 *   expectationRewrites: [],
 * })
 * console.log(receipt.verdict) // "pass"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinalCheckReceipt extends S.Opaque<FinalCheckReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("yeet-final-check/v1"),
    headSha: S.String,
    mergeBase: S.String,
    base: S.String,
    complete: S.Boolean,
    verdict: FinalCheckVerdict,
    startedAt: S.String,
    finishedAt: S.String,
    steps: S.Array(FinalCheckStepResult),
    expectationRewrites: S.Array(ExpectationRewriteVerdict),
  }).pipe(
    $I.annoteSchema("FinalCheckReceipt", {
      description: "Head-pinned record of a yeet final-check run, required by yeet ready before a draft flips.",
    })
  )
) {}

/**
 * A gate the caller chose not to run locally, with the reason recorded in the
 * receipt (`--skip <gate>=<reason>`).
 *
 * **Example** (Skip coverage with a reason)
 *
 * ```ts
 * import { FinalCheckSkip } from "@beep/repo-cli/test/Yeet"
 *
 * const skip = FinalCheckSkip.make({ gate: "coverage", reason: "admission waited 10 minutes; hosted proves it" })
 * console.log(skip.gate) // "coverage"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinalCheckSkip extends S.Opaque<FinalCheckSkip, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: FinalCheckGate,
    reason: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("FinalCheckSkip", {
      description: "A final-check gate skipped locally with the reason recorded in the receipt.",
    })
  )
) {}

/**
 * Options accepted by `yeet final-check`.
 *
 * **Example** (Build options)
 *
 * ```ts
 * import { YeetFinalCheckOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const options = YeetFinalCheckOptions.make({ base: "origin/main", gates: [], skip: [], dryRun: true, failFast: false })
 * console.log(options.dryRun) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetFinalCheckOptions extends S.Opaque<YeetFinalCheckOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    base: S.String,
    gates: S.Array(S.String),
    skip: S.Array(S.String),
    dryRun: S.Boolean,
    failFast: S.Boolean,
  }).pipe(
    $I.annoteSchema("YeetFinalCheckOptions", {
      description: "Options accepted by yeet final-check: base ref, gate subset, recorded skips, dry run, fail fast.",
    })
  )
) {}

/**
 * One subprocess a final-check gate runs, with the hosted context it replays.
 *
 * **Example** (Plan a step)
 *
 * ```ts
 * import { FinalCheckPlannedStep } from "@beep/repo-cli/test/Yeet"
 * import { QualityTaskStep } from "@beep/repo-cli/test/Quality"
 *
 * const planned = FinalCheckPlannedStep.make({
 *   gate: "check",
 *   hostedContext: "Heavy / Check",
 *   step: QualityTaskStep.make({ label: "final-check:check", command: "bun", args: ["run", "check"], cwd: "." }),
 * })
 * console.log(planned.gate) // "check"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FinalCheckPlannedStep extends S.Opaque<FinalCheckPlannedStep, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: FinalCheckGate,
    hostedContext: S.String,
    step: QualityTaskStep,
  }).pipe(
    $I.annoteSchema("FinalCheckPlannedStep", {
      description: "One subprocess a yeet final-check gate runs and the hosted check context it replays.",
    })
  )
) {}
