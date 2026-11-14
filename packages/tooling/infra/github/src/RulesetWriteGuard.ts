/**
 * The last-moment check on ruleset 10240248: the stack builds the body it
 * writes from a capture of the live ruleset (it carries the live
 * `beep-reviewer` check through), so a
 * `beep reviewer ruleset release|require --apply` that lands between that
 * capture and the write would be overwritten.
 * This module wraps the shipped `GitHub.Ruleset` provider: inside the
 * provider's update path, immediately before the PUT, it re-reads the live
 * ruleset and refuses, writing nothing, if it differs from the capture.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as GitHub from "@alchemy.run/github";
import { $InfraGithubId } from "@beep/identity/packages";
import * as Repos from "@distilled.cloud/github/repos";
import * as ProviderModule from "alchemy/Provider";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { decodeLiveRuleset, diffFields, FieldDiff, liveFields } from "./RulesetGuard.ts";
import type { LiveRuleset } from "./RulesetGuard.ts";

const $I = $InfraGithubId.create("RulesetWriteGuard");

/**
 * Raised inside the ruleset provider's update path when the live ruleset no
 * longer equals the capture the plan was built from; the PUT is not sent.
 *
 * **Example** (Inspect a refusal)
 *
 * ```ts
 * import { RulesetChangedSinceCapture } from "@beep/infra-github/RulesetWriteGuard"
 *
 * const refused = RulesetChangedSinceCapture.make({ rulesetId: 10240248, diffs: [] })
 * console.log(refused._tag) // "RulesetChangedSinceCapture"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RulesetChangedSinceCapture extends S.TaggedError<
  RulesetChangedSinceCapture,
  { readonly brand: unique symbol }
>($I`RulesetChangedSinceCapture`)(
  "RulesetChangedSinceCapture",
  { rulesetId: S.Int, diffs: S.Array(FieldDiff) },
  $I.annote("RulesetChangedSinceCapture", {
    description: "The live ruleset changed after the capture the plan was built from; nothing was written.",
  })
) {}

/**
 * Raised when the capture carries no ruleset id, so the write guard cannot
 * name the ruleset to re-read; the deploy fails closed.
 *
 * **Example** (A capture without an id)
 *
 * ```ts
 * import { CaptureWithoutId } from "@beep/infra-github/RulesetWriteGuard"
 *
 * console.log(CaptureWithoutId.make({ rulesetName: "main" })._tag) // "CaptureWithoutId"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CaptureWithoutId extends S.TaggedError<CaptureWithoutId, { readonly brand: unique symbol }>(
  $I`CaptureWithoutId`
)(
  "CaptureWithoutId",
  { rulesetName: S.String },
  $I.annote("CaptureWithoutId", { description: "The ruleset capture has no id to re-read before the write." })
) {}

/**
 * Raised when the ruleset the provider would write is not the captured one:
 * the reconcile has no prior output (its create path POSTs a new ruleset) or
 * its state names a different ruleset id. Nothing is sent.
 *
 * **Example** (A write aimed at another ruleset)
 *
 * ```ts
 * import { RulesetTargetIsNotTheCapture } from "@beep/infra-github/RulesetWriteGuard"
 * import * as O from "effect/Option"
 *
 * const refused = RulesetTargetIsNotTheCapture.make({ rulesetName: "main", capturedId: 10240248, targetId: O.none() })
 * console.log(refused._tag) // "RulesetTargetIsNotTheCapture"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RulesetTargetIsNotTheCapture extends S.TaggedError<
  RulesetTargetIsNotTheCapture,
  { readonly brand: unique symbol }
>($I`RulesetTargetIsNotTheCapture`)(
  "RulesetTargetIsNotTheCapture",
  { rulesetName: S.String, capturedId: S.Int, targetId: S.Option(S.Int) },
  $I.annote("RulesetTargetIsNotTheCapture", {
    description: "The ruleset write would create a ruleset or target another id than the capture; nothing was sent.",
  })
) {}

/**
 * Every guarded field in which two strictly decoded readings of the same
 * ruleset differ, server-managed fields excluded.
 *
 * **Example** (A capture equals itself)
 *
 * ```ts
 * import { decodeLiveRuleset } from "@beep/infra-github/RulesetGuard"
 * import { compareCaptures } from "@beep/infra-github/RulesetWriteGuard"
 * import * as Effect from "effect/Effect"
 *
 * const capture = Effect.runSync(decodeLiveRuleset({
 *   name: "main", target: "branch", enforcement: "active",
 *   conditions: { ref_name: { include: [], exclude: [] } }, bypass_actors: [], rules: [],
 * }))
 * console.log(Effect.runSync(compareCaptures(capture, capture))) // []
 * ```
 *
 * @param capture - The reading the plan was built from.
 * @param live - The reading taken immediately before the write.
 * @returns The differing fields; empty when nothing changed.
 * @category utilities
 * @since 0.0.0
 */
export const compareCaptures = Effect.fn("InfraGithub.compareCaptures")(function* (
  capture: LiveRuleset,
  live: LiveRuleset
) {
  return yield* diffFields(liveFields(capture), liveFields(live));
});

const RulesetProvider = ProviderModule.Provider<GitHub.Ruleset>("GitHub.Ruleset");

const verifyUnchanged = Effect.fn("InfraGithub.verifyRulesetUnchanged")(function* (
  capture: LiveRuleset,
  owner: string,
  repository: string,
  targetId: O.Option<number>
) {
  const rulesetId = yield* Effect.fromOption(O.fromNullishOr(capture.id)).pipe(
    Effect.mapError(() => CaptureWithoutId.make({ rulesetName: capture.name }))
  );
  // Without a prior output the shipped reconcile POSTs a new ruleset; with another id it writes that one.
  if (!O.contains(targetId, rulesetId)) {
    return yield* RulesetTargetIsNotTheCapture.make({ rulesetName: capture.name, capturedId: rulesetId, targetId });
  }
  const read = yield* Repos.getRepoRuleset({ owner, repo: repository, ruleset_id: rulesetId });
  // The same strict decode the guard uses: an unreadable live shape refuses the write too.
  const live = yield* decodeLiveRuleset(read);
  const diffs = yield* compareCaptures(capture, live);
  if (A.isReadonlyArrayNonEmpty(diffs)) return yield* RulesetChangedSinceCapture.make({ rulesetId, diffs });
});

/**
 * The shipped `GitHub.Ruleset` provider with the write guard in its update
 * path. For the ruleset named like the capture, `reconcile` first refuses a
 * write that is not aimed at the captured id ({@link RulesetTargetIsNotTheCapture}:
 * the create path, or state naming another ruleset), then re-reads the
 * live ruleset and fails with {@link RulesetChangedSinceCapture} (sending no
 * PUT) unless it equals the capture; every other ruleset, and every other
 * lifecycle method, is the shipped provider unchanged. A provider registered
 * for the resource type directly takes precedence over the `GitHub.providers()`
 * collection, so merging this layer beside the collection is enough.
 *
 * **Example** (Register the guarded provider)
 *
 * ```ts
 * import { decodeLiveRuleset } from "@beep/infra-github/RulesetGuard"
 * import { guardedRulesetProvider } from "@beep/infra-github/RulesetWriteGuard"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const capture = Effect.runSync(decodeLiveRuleset({
 *   id: 10240248, name: "main", target: "branch", enforcement: "active",
 *   conditions: { ref_name: { include: [], exclude: [] } }, bypass_actors: [], rules: [],
 * }))
 * console.log(Layer.isLayer(guardedRulesetProvider(capture)))
 * ```
 *
 * @param capture - The strictly decoded capture the plan was built from.
 * @returns A layer providing the guarded `GitHub.Ruleset` provider.
 * @category layers
 * @since 0.0.0
 */
export const guardedRulesetProvider = (capture: LiveRuleset) =>
  ProviderModule.effect(
    GitHub.Ruleset,
    Effect.gen(function* () {
      const base = yield* RulesetProvider;
      return {
        ...base,
        reconcile: Effect.fn("InfraGithub.guardedRulesetReconcile")(function* (
          input: Parameters<typeof base.reconcile>[0]
        ) {
          if (input.news.name === capture.name) {
            yield* verifyUnchanged(
              capture,
              input.news.owner,
              input.news.repository,
              O.map(O.fromNullishOr(input.output), (output) => output.rulesetId)
            );
          }
          return yield* base.reconcile(input);
        }),
      };
    })
  ).pipe(Layer.provide(GitHub.RulesetProvider()));
