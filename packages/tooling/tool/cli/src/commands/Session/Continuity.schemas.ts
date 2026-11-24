/**
 * Permission continuity census inputs and sanitized observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Session/Continuity.schemas");

/**
 * Effective Codex permission fields, independent of the composer label.
 *
 * **Example** (Construct unrestricted policy)
 * ```ts import.meta.vitest name="Construct unrestricted policy"
 * import { PermissionTuple } from "@beep/repo-cli/test/Session"
 * const policy = PermissionTuple.make({ approval: "never", sandbox: "danger-full-access", profile: "disabled" })
 * policy.approval // => "never"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PermissionTuple extends S.Opaque<PermissionTuple, { readonly brand: unique symbol }>()(
  S.Struct({ approval: S.NonEmptyString, sandbox: S.NonEmptyString, profile: S.NonEmptyString }).pipe(
    $I.annoteSchema("PermissionTuple", {
      description: "Effective approval, sandbox and permission profile recorded by a Codex turn.",
    })
  )
) {}

/**
 * Disposable fixture routes; idle and relaunch are separate dormant cases.
 *
 * **Example** (Select a route)
 * ```ts import.meta.vitest name="Select a route"
 * import { ContinuityRoute } from "@beep/repo-cli/test/Session"
 * ContinuityRoute.is.fresh("fresh") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ContinuityRoute = LiteralKit([
  "fresh",
  "dormant-idle",
  "dormant-relaunch",
  "background",
  "subagent-followup",
]).pipe(
  $I.annoteSchema("ContinuityRoute", {
    description: "The launch or continuation route exercised by a disposable fixture.",
  })
);
/**
 * Fixture route decoded from the route domain.
 *
 * @category models
 * @since 0.0.0
 */
export type ContinuityRoute = typeof ContinuityRoute.Type;

/**
 * Verdict for the supplied metadata; behavioural verification is separate.
 *
 * **Example** (Recognize missing evidence)
 * ```ts import.meta.vitest name="Recognize missing evidence"
 * import { ContinuityVerdict } from "@beep/repo-cli/test/Session"
 * ContinuityVerdict.is.unknown("unknown") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ContinuityVerdict = LiteralKit(["verified", "unsatisfied", "unknown"]).pipe(
  $I.annoteSchema("ContinuityVerdict", {
    description: "Agreement, disagreement, or incomplete evidence in a metadata census.",
  })
);
/**
 * @category models
 * @since 0.0.0
 */
export type ContinuityVerdict = typeof ContinuityVerdict.Type;

/**
 * An explicitly paired Claude app record and CLI transcript.
 *
 * **Example** (Pair synthetic records)
 * ```ts import.meta.vitest name="Pair synthetic records"
 * import { ClaudeContinuityInput } from "@beep/repo-cli/test/Session"
 * const input = ClaudeContinuityInput.make({ id: "fixture", app: "app.json", transcript: "cli.jsonl", expectedMode: "auto" })
 * input.id // => "fixture"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaudeContinuityInput extends S.Opaque<ClaudeContinuityInput, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    app: S.NonEmptyString,
    transcript: S.NonEmptyString,
    expectedMode: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ClaudeContinuityInput", {
      description: "Operator-selected app/transcript pair and chosen Claude permission mode.",
    })
  )
) {}

/**
 * Explicit census scope; paths are relative to the manifest, never inferred from titles.
 *
 * **Example** (Describe an empty census)
 * ```ts import.meta.vitest name="Describe an empty census"
 * import { ContinuityInput, PermissionTuple } from "@beep/repo-cli/test/Session"
 * const input = ContinuityInput.make({ route: "fresh", expected: PermissionTuple.make({ approval: "never", sandbox: "danger-full-access", profile: "disabled" }), rollouts: [], configs: [], claude: [] })
 * input.rollouts.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContinuityInput extends S.Opaque<ContinuityInput, { readonly brand: unique symbol }>()(
  S.Struct({
    route: ContinuityRoute,
    expected: PermissionTuple,
    rollouts: S.Array(S.NonEmptyString),
    configs: S.Array(S.NonEmptyString),
    claude: S.Array(ClaudeContinuityInput),
  }).pipe(
    $I.annoteSchema("ContinuityInput", {
      description: "Explicit files and expected policies for a read-only permission census.",
    })
  )
) {}

/**
 * Sanitized metadata result; no transcript text or configuration values are copied.
 *
 * **Example** (Represent absent evidence)
 * ```ts import.meta.vitest name="Represent absent evidence"
 * import { ContinuityObservation } from "@beep/repo-cli/test/Session"
 * const row = ContinuityObservation.make({ app: "codex", id: "fixture", family: "fixture", verdict: "unknown", tuples: [], boundaries: 0, detail: "No effective turns" })
 * row.verdict // => "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContinuityObservation extends S.Opaque<ContinuityObservation, { readonly brand: unique symbol }>()(
  S.Struct({
    app: S.Literals(["codex", "claude", "config"]),
    id: S.NonEmptyString,
    family: S.NonEmptyString,
    verdict: ContinuityVerdict,
    tuples: S.Array(S.String),
    boundaries: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    detail: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ContinuityObservation", {
      description: "Sanitized effective-policy comparison for one thread, family member, app session or config.",
    })
  )
) {}
