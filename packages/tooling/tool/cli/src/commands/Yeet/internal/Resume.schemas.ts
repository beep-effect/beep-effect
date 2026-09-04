/**
 * Schemas for validating `yeet resume` input and describing resolved local commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PrNumber, PrRepository } from "./Provenance.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Resume.schemas");
const ResumeStatus = LiteralKit(["resumable", "not-resumable"]).pipe(
  $I.annoteSchema("ResumeStatus", {
    description: "Whether a recorded local agent has a supported exact resume command.",
  })
);

/**
 * Positive one-based integer used to select a recorded resume agent.
 *
 * **Example** (Reject zero as an agent selection)
 *
 * ```ts
 * import { PositiveInt } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PositiveInt)(1)) // true
 * console.log(S.is(PositiveInt)(0)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PositiveInt = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PositiveInt", { description: "Positive one-based integer used for resume selection." })
);

/**
 * Decoded positive integer produced by {@link PositiveInt}.
 *
 * **Example** (Annotate a validated selection)
 *
 * ```ts
 * import type { PositiveInt } from "@beep/repo-cli/test/Yeet"
 *
 * const selection: PositiveInt = 1
 * console.log(selection) // 1
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PositiveInt = typeof PositiveInt.Type;

const prNumberPattern = /^[1-9][0-9]*$/u;
const prUrlPattern = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/([1-9][0-9]*)(?:\/)?$/iu;
const PrRefInput = S.NonEmptyString.check(
  S.makeFilter<string>(
    (value) =>
      O.isSome(Str.match(prNumberPattern)(value)) ||
      O.isSome(Str.match(prUrlPattern)(value)) || {
        path: [],
        issue: "Expected a positive PR number or github.com PR URL",
      },
    {
      identifier: $I`PrRefInputCheck`,
      title: "Pull request reference",
      description: "A positive PR number or exact github.com pull-request URL.",
    }
  )
);

class PrRefValue extends S.Class<PrRefValue>($I`PrRefValue`)(
  { pr: PrNumber, repository: S.OptionFromNullOr(PrRepository) },
  $I.annote("PrRefValue", { description: "Decoded pull-request number and optional URL repository identity." })
) {}

/**
 * Pull-request number and optional GitHub repository decoded for `yeet resume`.
 *
 * **Example** (Decode a pull-request URL)
 *
 * ```ts
 * import { PrRef } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const ref = S.decodeSync(PrRef)("https://github.com/beep-effect/beep-effect/pull/42")
 * console.log(ref.repository) // { _id: "Option", _tag: "Some", ... }
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PrRef = PrRefInput.pipe(
  S.decodeTo(
    PrRefValue,
    SchemaTransformation.transform<typeof PrRefValue.Encoded, string>({
      decode: (value) => {
        const match = Str.match(prUrlPattern)(value);
        if (
          O.isNone(match) ||
          match.value[1] === undefined ||
          match.value[2] === undefined ||
          match.value[3] === undefined
        ) {
          return { pr: globalThis.Number.parseInt(value, 10), repository: null };
        }
        return {
          pr: globalThis.Number.parseInt(match.value[3], 10),
          repository: {
            host: "github.com",
            owner: Str.toLowerCase(match.value[1]),
            name: Str.toLowerCase(match.value[2]),
          },
        };
      },
      encode: (value) =>
        value.repository === null
          ? `${value.pr}`
          : `https://github.com/${value.repository.owner}/${value.repository.name}/pull/${value.pr}`,
    })
  ),
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
 * console.log(ref.pr) // 42
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
 *   ref: { pr: 42, repository: O.none() },
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
    agent: S.OptionFromNullOr(PositiveInt),
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
