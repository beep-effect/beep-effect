/**
 * Goal-packet decision file model: a lane records one decision as its own file,
 * `goals/<slug>/decisions/<YYYY-MM-DD>-<topic>.md`, with YAML frontmatter and a
 * Markdown body, and `beep goals decisions write` projects the directory into a
 * marker-delimited block of `SPEC.md` (`kind: decision`) or `PLAN.md`
 * (`kind: checkpoint`), so sibling lanes never append to the same tail.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Goals/Decisions.schemas");

/**
 * Packet-relative directory that holds decision files.
 *
 * **Example** (Log the decisions directory)
 *
 * ```ts
 * import { GOAL_DECISIONS_DIR } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 *
 * console.log(GOAL_DECISIONS_DIR) // "decisions"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GOAL_DECISIONS_DIR = "decisions";

/**
 * Where a decision file renders.
 *
 * **Details**
 *
 * `decision` entries render into the `## Decision log` block of `SPEC.md`;
 * `checkpoint` entries (the status notes lanes used to append to `PLAN.md`)
 * render into the `## Checkpoints` block of `PLAN.md`.
 *
 * **Example** (Check a kind)
 *
 * ```ts
 * import { GoalDecisionKind } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 *
 * console.log(GoalDecisionKind.is.decision("decision")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalDecisionKind = LiteralKit(["decision", "checkpoint"]).pipe(
  $I.annoteSchema("GoalDecisionKind", {
    description: "Which packet document a decision file projects into: SPEC.md (decision) or PLAN.md (checkpoint).",
  })
);

/**
 * Decision kind literal.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalDecisionKind = typeof GoalDecisionKind.Type;

/**
 * Calendar date of a decision, `YYYY-MM-DD`.
 *
 * **Example** (Validate a date)
 *
 * ```ts
 * import { GoalDecisionDate } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GoalDecisionDate)("2026-11-05")) // true
 * console.log(S.is(GoalDecisionDate)("Nov 5")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalDecisionDate = S.String.check(
  S.isPattern(
    /^\d{4}-\d{2}-\d{2}$/,
    $I.annote("GoalDecisionDatePatternCheck", {
      title: "Goal Decision Date Pattern",
      description: "An ISO calendar date (YYYY-MM-DD).",
      message: "Expected an ISO calendar date (YYYY-MM-DD)",
    })
  )
).pipe(
  $I.annoteSchema("GoalDecisionDate", {
    description: "The calendar date a decision was taken, as written in its file name and frontmatter.",
  })
);

/**
 * Decision date string.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalDecisionDate = typeof GoalDecisionDate.Type;

/**
 * Decision file name grammar: `<YYYY-MM-DD>-<topic>.md` with a lowercase
 * hyphenated topic.
 *
 * **Example** (Validate a file name)
 *
 * ```ts
 * import { GoalDecisionFileName } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GoalDecisionFileName)("2026-11-05-forward-only-migration.md")) // true
 * console.log(S.is(GoalDecisionFileName)("notes.md")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalDecisionFileName = S.String.check(
  S.isPattern(
    /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*\.md$/,
    $I.annote("GoalDecisionFileNamePatternCheck", {
      title: "Goal Decision File Name Pattern",
      description: "<YYYY-MM-DD>-<lowercase-hyphenated-topic>.md",
      message: "Expected <YYYY-MM-DD>-<topic>.md with a lowercase hyphenated topic",
    })
  )
).pipe(
  $I.annoteSchema("GoalDecisionFileName", {
    description: "File name of one decision under goals/<slug>/decisions/.",
  })
);

/**
 * Decision file name string.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalDecisionFileName = typeof GoalDecisionFileName.Type;

const SingleLine = S.String.check(
  S.isPattern(
    /^\S(?:.*\S)?$/,
    $I.annote("GoalDecisionSingleLineCheck", {
      title: "Goal Decision Single Line",
      description: "A non-empty single line without leading or trailing whitespace.",
      message: "Expected a non-empty single line",
    })
  )
);

/**
 * YAML frontmatter of a decision file.
 *
 * **Details**
 *
 * `title` and `date` make the rendered heading (`### <title>, <date>`);
 * `reversal` is the "how to reverse" the Decision Log always required;
 * `lane` (branch) and `pullRequest` attribute the decision to the lane that
 * took it. `kind` defaults to `decision`.
 *
 * **Example** (Construct frontmatter)
 *
 * ```ts
 * import { GoalDecisionFrontmatter } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 *
 * const frontmatter = GoalDecisionFrontmatter.make({
 *   title: "Forward-only migration",
 *   date: "2026-11-05",
 *   reversal: "Delete the marker block and move the entries back into the table.",
 * })
 * console.log(frontmatter.kind) // "decision"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDecisionFrontmatter extends S.Opaque<GoalDecisionFrontmatter, { readonly brand: unique symbol }>()(
  S.Struct({
    title: SingleLine,
    date: GoalDecisionDate,
    reversal: SingleLine,
    kind: GoalDecisionKind.pipe(S.withDecodingDefaultKey(Effect.succeed(GoalDecisionKind.Enum.decision))),
    lane: S.optionalKey(SingleLine),
    pullRequest: S.optionalKey(S.Int.check(S.isGreaterThan(0))),
  }).pipe(
    $I.annoteSchema("GoalDecisionFrontmatter", {
      description: "Schema-validated YAML frontmatter of a goal-packet decision file.",
    })
  )
) {}

/**
 * Namespace for {@link GoalDecisionFrontmatter} companion types.
 *
 * **Example** (Name the encoded type)
 *
 * ```ts
 * import type { GoalDecisionFrontmatter } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 *
 * const encoded: GoalDecisionFrontmatter.Encoded = {
 *   title: "Forward-only migration",
 *   date: "2026-11-05",
 *   reversal: "Move the entries back into the table.",
 * }
 * console.log(encoded.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace GoalDecisionFrontmatter {
  /**
   * Encoded representation of {@link GoalDecisionFrontmatter}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof GoalDecisionFrontmatter.Encoded;
}

/**
 * One parsed decision file: its name, frontmatter and Markdown body.
 *
 * **Example** (Construct a decision)
 *
 * ```ts
 * import { GoalDecision } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 *
 * const decision = GoalDecision.make({
 *   file: "2026-11-05-forward-only-migration.md",
 *   frontmatter: {
 *     title: "Forward-only migration",
 *     date: "2026-11-05",
 *     reversal: "Move the entries back into the table.",
 *     kind: "decision",
 *   },
 *   body: "Existing Decision Log bodies stay frozen above the generated block.",
 * })
 * console.log(decision.frontmatter.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDecision extends S.Opaque<GoalDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    file: GoalDecisionFileName,
    frontmatter: GoalDecisionFrontmatter,
    body: S.String,
  }).pipe(
    $I.annoteSchema("GoalDecision", {
      description: "One decision file under goals/<slug>/decisions/ after frontmatter decoding.",
    })
  )
) {}

/**
 * Why a decision file was rejected.
 *
 * **Example** (Construct a rejection)
 *
 * ```ts
 * import { GoalDecisionFileInvalid } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 *
 * const invalid = GoalDecisionFileInvalid.make({ file: "notes.md", message: "file name is not <YYYY-MM-DD>-<topic>.md" })
 * console.log(invalid.message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDecisionFileInvalid extends S.Opaque<GoalDecisionFileInvalid, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    message: S.String,
  }).pipe(
    $I.annoteSchema("GoalDecisionFileInvalid", {
      description: "A decision file that fails the name grammar or whose frontmatter does not decode.",
    })
  )
) {}

/**
 * The projection target of one decision kind: which packet document and
 * which `## ` heading holds the generated block.
 *
 * **Example** (Construct a target)
 *
 * ```ts
 * import { GoalDecisionTarget } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 *
 * const target = GoalDecisionTarget.make({ kind: "decision", document: "SPEC.md", heading: "Decision log" })
 * console.log(target.document)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDecisionTarget extends S.Opaque<GoalDecisionTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: GoalDecisionKind,
    document: S.Literals(["SPEC.md", "PLAN.md"]),
    heading: S.String,
  }).pipe(
    $I.annoteSchema("GoalDecisionTarget", {
      description: "Which packet document and section a decision kind projects into.",
    })
  )
) {}

/**
 * One document's projection: the committed text, the expected text and
 * whether they differ.
 *
 * **Details**
 *
 * `current` is absent when the document does not exist. `applies` is false
 * when the packet has no decision of this kind and the document carries no
 * marker block, so untouched packets stay untouched (forward-only migration).
 *
 * **Example** (Construct a projection)
 *
 * ```ts
 * import { GoalDecisionProjection } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 *
 * const projection = GoalDecisionProjection.make({
 *   target: { kind: "decision", document: "SPEC.md", heading: "Decision log" },
 *   applies: false,
 *   drift: false,
 *   expected: "",
 * })
 * console.log(projection.drift) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDecisionProjection extends S.Opaque<GoalDecisionProjection, { readonly brand: unique symbol }>()(
  S.Struct({
    target: GoalDecisionTarget,
    applies: S.Boolean,
    drift: S.Boolean,
    expected: S.String,
    current: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("GoalDecisionProjection", {
      description: "Committed versus expected text of one packet document's generated decision block.",
    })
  )
) {}

/**
 * Everything `beep goals decisions` knows about one packet.
 *
 * **Example** (Construct an empty report)
 *
 * ```ts
 * import { GoalDecisionLogReport } from "@beep/repo-cli/commands/Goals/Decisions.schemas"
 *
 * const report = GoalDecisionLogReport.make({ slug: "demo", decisions: [], invalid: [], projections: [] })
 * console.log(report.slug)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalDecisionLogReport extends S.Opaque<GoalDecisionLogReport, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.String,
    decisions: S.Array(GoalDecision),
    invalid: S.Array(GoalDecisionFileInvalid),
    projections: S.Array(GoalDecisionProjection),
  }).pipe(
    $I.annoteSchema("GoalDecisionLogReport", {
      description: "Decision files, rejected files and per-document projections of one goal packet.",
    })
  )
) {}
