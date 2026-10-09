/**
 * Shared hosted profile and resource models, including the bootstrap pattern data.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Ci/CiOperational.schemas");

/**
 * Shared pattern data owned by the schema module and projected for bootstrap use.
 *
 * **Example** (Construct pattern data)
 *
 * ```ts
 * import { CiOperationalPatterns } from "@beep/repo-cli/commands/Ci"
 * const patterns = CiOperationalPatterns.make({ goals: "^goals/", desktop: "^apps/", docs: "^docs/" })
 * console.log(patterns.docs) // "^docs/"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiOperationalPatterns extends S.Class<CiOperationalPatterns>($I`CiOperationalPatterns`)(
  {
    goals: S.NonEmptyString.annotateKey({ description: "Convention-owned goal prose pattern." }),
    desktop: S.NonEmptyString.annotateKey({ description: "Desktop Cargo and gate-owner pattern." }),
    docs: S.NonEmptyString.annotateKey({ description: "Additional Heavy docs-only paths." }),
  },
  $I.annote("CiOperationalPatterns", { description: "Canonical pattern data for hosted and bootstrap CI profiles." })
) {}

/**
 * Canonical CI patterns; `ci patterns --write` owns their pre-runtime JSON projection.
 *
 * **Example** (Read the shared docs pattern)
 *
 * ```ts
 * import { ciOperationalPatterns } from "@beep/repo-cli/commands/Ci"
 * console.log(ciOperationalPatterns.docs.startsWith("^docs/")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ciOperationalPatterns = CiOperationalPatterns.make({
  goals:
    "^(goals/(INDEX|README)\\.md|goals/[^/]+/(GOAL|PLAN|README|SPEC|DECISIONS)\\.md|goals/[^/]+/ops/manifest\\.json)$",
  desktop:
    "^(apps/professional-desktop/src-tauri/|\\.github/workflows/check\\.yml$|scripts/ci-change-profile\\.sh$|packages/tooling/tool/cli/src/commands/Ci/CiOperational)",
  docs: "^docs/|^explorations/|^research/|^\\.changeset/[^/]+\\.md$|\\.md$",
});

/**
 * Convention-owned goal prose accepted by the pre-runtime profile adapter.
 *
 * **Example** (Classify goal prose)
 *
 * ```ts
 * import { CiGoalDocument } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiGoalDocument)("goals/demo/PLAN.md")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiGoalDocument = S.String.check(S.isPattern(new RegExp(ciOperationalPatterns.goals, "u"))).annotate(
  $I.annote("CiGoalDocument", { description: "Goal prose paths shared with the pre-runtime adapter." })
);
/**
 * Convention-owned goal prose accepted by the pre-runtime profile adapter.
 *
 * **Example** (Classify goal prose)
 *
 * ```ts
 * import { CiGoalDocument } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiGoalDocument)("goals/demo/PLAN.md")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiGoalDocument = typeof CiGoalDocument.Type;

/**
 * Desktop Cargo inputs and their hosted gate owners.
 *
 * **Example** (Classify Cargo input)
 *
 * ```ts
 * import { CiDesktopInput } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiDesktopInput)("apps/professional-desktop/src-tauri/Cargo.toml")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiDesktopInput = S.String.check(S.isPattern(new RegExp(ciOperationalPatterns.desktop, "u"))).annotate(
  $I.annote("CiDesktopInput", { description: "Paths affecting the desktop Rust gate." })
);
/**
 * Desktop Cargo inputs and their hosted gate owners.
 *
 * **Example** (Classify Cargo input)
 *
 * ```ts
 * import { CiDesktopInput } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiDesktopInput)("apps/professional-desktop/src-tauri/Cargo.toml")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiDesktopInput = typeof CiDesktopInput.Type;

/**
 * Safe resource lane names used as metric basenames.
 *
 * **Example** (Guard a lane name)
 *
 * ```ts
 * import { CiResourceLane } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiResourceLane)("check")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiResourceLane = S.String.check(S.isPattern(/^[a-z][a-z0-9-]{0,63}$/u)).annotate(
  $I.annote("CiResourceLane", { description: "Safe metric basename for a runner resource lane." })
);
/**
 * Safe resource lane names used as metric basenames.
 *
 * **Example** (Guard a lane name)
 *
 * ```ts
 * import { CiResourceLane } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiResourceLane)("check")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiResourceLane = typeof CiResourceLane.Type;

/**
 * Lane profiles exported to GitHub and the shell adapter.
 *
 * **Example** (Construct a profile)
 *
 * ```ts
 * import { CiChangeProfile } from "@beep/repo-cli/commands/Ci"
 * console.log(CiChangeProfile.make({ goalsOnly: false, desktopRustRelevant: true }).goalsOnly)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiChangeProfile extends S.Class<CiChangeProfile>($I`CiChangeProfile`)(
  { goalsOnly: S.Boolean, desktopRustRelevant: S.Boolean },
  $I.annote("CiChangeProfile", { description: "Hosted goals and Rust lane execution profile." })
) {}

/**
 * One host-wide resource sample; values are KiB, ticks and pages.
 *
 * **Example** (Construct a sample)
 *
 * ```ts
 * import { CiResourceSample } from "@beep/repo-cli/commands/Ci"
 * console.log(CiResourceSample.make({ epoch: 1, total: 10, available: 8, cpu: 10, idle: 8, swapIn: 0, swapOut: 0 }).total)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiResourceSample extends S.Class<CiResourceSample>($I`CiResourceSample`)(
  {
    epoch: S.Finite,
    total: S.Finite.check(S.isGreaterThan(0)),
    available: S.Finite.check(S.isGreaterThan(0)),
    cpu: S.Finite,
    idle: S.Finite,
    swapIn: S.Finite,
    swapOut: S.Finite,
  },
  $I.annote("CiResourceSample", { description: "Host-wide procfs counters for runner measurement." })
) {}

const CiEnvironmentMode = LiteralKit([
  "not requested",
  "local-only",
  "read-write (trusted push)",
  "read-only (same-repository pull request)",
  "exported (trusted push)",
  "blank",
]);

/**
 * A sanitized mode label alongside redacted GitHub environment entries.
 *
 * **Example** (Construct an unrequested export)
 *
 * ```ts
 * import { CiEnvironmentSelection } from "@beep/repo-cli/commands/Ci"
 * console.log(CiEnvironmentSelection.make({ mode: "not requested", entries: [] }).mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiEnvironmentSelection extends S.Class<CiEnvironmentSelection>($I`CiEnvironmentSelection`)(
  { mode: CiEnvironmentMode, entries: S.Array(S.Tuple([S.String, S.Redacted(S.String)])) },
  $I.annote("CiEnvironmentSelection", { description: "Trusted event export selection with values kept redacted." })
) {}
