/**
 * Typed mining failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { LibraryMineProfileId } from "./Library.mine.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.mine.errors");

/**
 * A private-partition artifact was planned for an external runner lane.
 *
 * **Example** (Make a refusal)
 * ```ts
 * import { LibraryMinePrivateRouteError } from "@beep/repo-cli/commands/Research"
 * const error = LibraryMinePrivateRouteError.make({ profile: "junie", artifactIds: ["capture:abc"], message: "refused" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LibraryMinePrivateRouteError extends S.TaggedError<
  LibraryMinePrivateRouteError,
  { readonly brand: unique symbol }
>($I`LibraryMinePrivateRouteError`)(
  "LibraryMinePrivateRouteError",
  {
    profile: LibraryMineProfileId,
    artifactIds: S.Array(S.String),
    message: S.String,
  },
  $I.annote("LibraryMinePrivateRouteError", {
    description: "A private-partition artifact was planned for an external runner lane.",
  })
) {}

/**
 * A finding's span is not a verbatim substring of its bound capture text.
 *
 * **Example** (Make a span rejection)
 * ```ts
 * import { LibraryMineSpanError } from "@beep/repo-cli/commands/Research"
 * const error = LibraryMineSpanError.make({ artifactId: "capture:abc", spans: ["invented"], message: "not verbatim" })
 * console.log(error.spans.length)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LibraryMineSpanError extends S.TaggedError<LibraryMineSpanError, { readonly brand: unique symbol }>(
  $I`LibraryMineSpanError`
)(
  "LibraryMineSpanError",
  {
    artifactId: S.String,
    spans: S.Array(S.String),
    message: S.String,
  },
  $I.annote("LibraryMineSpanError", { description: "A finding span is not verbatim in its bound capture text." })
) {}

/**
 * An incomplete reading asserted an affirmative CiTO relation, or a finding names no readable capture.
 *
 * **Example** (Make an unread rejection)
 * ```ts
 * import { LibraryMineUnreadError } from "@beep/repo-cli/commands/Research"
 * const error = LibraryMineUnreadError.make({ artifactId: "capture:abc", message: "partial reading cannot support" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LibraryMineUnreadError extends S.TaggedError<LibraryMineUnreadError, { readonly brand: unique symbol }>(
  $I`LibraryMineUnreadError`
)(
  "LibraryMineUnreadError",
  {
    artifactId: S.String,
    message: S.String,
  },
  $I.annote("LibraryMineUnreadError", {
    description: "An unread or incomplete source was offered as support for an affirmative finding.",
  })
) {}

/**
 * A runner failed to launch, exited nonzero, hit quota, or returned output that failed its schema.
 *
 * **Example** (Make a runner failure)
 * ```ts
 * import { LibraryMineRunnerError } from "@beep/repo-cli/commands/Research"
 * const error = LibraryMineRunnerError.make({ quota: false, message: "exit 1" })
 * console.log(error.quota)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LibraryMineRunnerError extends S.TaggedError<LibraryMineRunnerError, { readonly brand: unique symbol }>(
  $I`LibraryMineRunnerError`
)(
  "LibraryMineRunnerError",
  {
    quota: S.Boolean,
    message: S.String,
  },
  $I.annote("LibraryMineRunnerError", { description: "A mining runner failed or returned invalid output." })
) {}

/**
 * One or more jobs of a mining batch did not complete; their receipts name each failure.
 *
 * **Example** (Make a batch failure)
 * ```ts
 * import { LibraryMineBatchError } from "@beep/repo-cli/commands/Research"
 * const error = LibraryMineBatchError.make({ failed: ["capture:abc LibraryMineSpanError"], paused: false, message: "1 job failed" })
 * console.log(error.failed.length)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LibraryMineBatchError extends S.TaggedError<LibraryMineBatchError, { readonly brand: unique symbol }>(
  $I`LibraryMineBatchError`
)(
  "LibraryMineBatchError",
  {
    failed: S.Array(S.String),
    paused: S.Boolean,
    message: S.String,
  },
  $I.annote("LibraryMineBatchError", { description: "Mining jobs that did not complete in a batch." })
) {}
