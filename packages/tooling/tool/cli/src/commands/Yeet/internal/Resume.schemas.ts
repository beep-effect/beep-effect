/**
 * Schemas for validating `yeet resume` input and describing resolved local commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { PrNumber } from "./Provenance.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Resume.schemas");
const ResumeStatus = LiteralKit(["resumable", "not-resumable"]).pipe(
  $I.annoteSchema("ResumeStatus", {
    description: "Whether a recorded local agent has a supported exact resume command.",
  })
);

/**
 * Non-empty pull-request number or GitHub pull-request URL accepted by `yeet resume`.
 *
 * **Example** (Decode a pull-request URL)
 *
 * ```ts
 * import { PrRef } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const ref = S.decodeSync(PrRef)("https://github.com/beep-effect/beep-effect/pull/42")
 * console.log(ref) // "https://github.com/beep-effect/beep-effect/pull/42"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PrRef = S.NonEmptyString.pipe(
  $I.annoteSchema("PrRef", { description: "Positive PR number or GitHub pull-request URL." })
);
/**
 * Decoded pull-request reference accepted by {@link PrRef}.
 *
 * **Example** (Annotate a decoded reference)
 *
 * ```ts
 * import { PrRef } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const ref: PrRef = S.decodeSync(PrRef)("42")
 * console.log(ref) // "42"
 * ```
 *
 * @see {@link PrRef} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type PrRef = typeof PrRef.Type;

/**
 * Validated command-line options controlling one local resume invocation.
 *
 * **Details**
 *
 * `agent` is a one-based selection only when present; `list`, `print`, `force`,
 * and `json` retain the caller's explicit CLI choices.
 *
 * **Example** (Describe a printed resume lookup)
 *
 * ```ts
 * import { ResumeOptions } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const options = ResumeOptions.make({
 *   ref: "42",
 *   list: false,
 *   print: true,
 *   force: false,
 *   json: false,
 *   agent: O.none(),
 * })
 * console.log(options.print) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResumeOptions extends S.Class<ResumeOptions>($I`ResumeOptions`)(
  {
    ref: PrRef,
    list: S.Boolean,
    print: S.Boolean,
    force: S.Boolean,
    json: S.Boolean,
    agent: S.OptionFromNullOr(PrNumber),
  },
  $I.annote("ResumeOptions", { description: "Validated CLI options for resolving and resuming a PR session." })
) {}

/**
 * Terminal-safe description of the local harness command selected for a PR.
 *
 * **Gotchas**
 *
 * The command and working directory remain workstation-local and are never
 * projected into the public pull-request footer.
 *
 * **Example** (Describe a resolved Codex command)
 *
 * ```ts
 * import { ResolvedResume } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const resolved = ResolvedResume.make({
 *   pr: 42,
 *   sequence: 1,
 *   harness: "codex",
 *   workspace: "beep-effect10",
 *   status: "resumable",
 *   command: O.some("codex resume thread-local-only"),
 *   cwd: "/worktrees/beep-effect10",
 * })
 * console.log(resolved.sequence) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolvedResume extends S.Class<ResolvedResume>($I`ResolvedResume`)(
  {
    pr: PrNumber,
    sequence: PrNumber,
    harness: S.String,
    workspace: S.String,
    status: ResumeStatus,
    command: S.OptionFromNullOr(S.String),
    cwd: S.String,
  },
  $I.annote("ResolvedResume", { description: "Local-only resolved resume command shown or executed in the terminal." })
) {}
