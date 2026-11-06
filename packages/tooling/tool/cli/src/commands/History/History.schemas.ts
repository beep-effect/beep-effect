/**
 * Commit-message overlay models: the tracked map of corrected messages, the
 * canonical note body projected from each row, and the `--check` report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitCommitSha } from "../Codex/Findings.capture.schemas.ts";
import type * as Effect from "effect/Effect";

const $I = $RepoCliId.create("commands/History/History.schemas");

/**
 * Repository-relative path of the tracked commit-message map.
 *
 * **Example** (Locate the map)
 *
 * ```ts
 * import { HISTORY_COMMIT_MESSAGE_MAP_PATH } from "@beep/repo-cli/commands/History"
 *
 * console.log(HISTORY_COMMIT_MESSAGE_MAP_PATH) // "docs/history/commit-message-map.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HISTORY_COMMIT_MESSAGE_MAP_PATH = "docs/history/commit-message-map.json";

/**
 * The notes ref the overlay is published on.
 *
 * **Example** (Name the overlay ref)
 *
 * ```ts
 * import { HISTORY_NOTES_REF } from "@beep/repo-cli/commands/History"
 *
 * console.log(HISTORY_NOTES_REF) // "refs/notes/history"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HISTORY_NOTES_REF = "refs/notes/history";

/**
 * The longest subject line a map row may carry, matching the repo's
 * commitlint header limit for these rows.
 *
 * **Example** (Read the subject limit)
 *
 * ```ts
 * import { HISTORY_SUBJECT_MAX_LENGTH } from "@beep/repo-cli/commands/History"
 *
 * console.log(HISTORY_SUBJECT_MAX_LENGTH) // 72
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HISTORY_SUBJECT_MAX_LENGTH = 72;

/** The message's lines, with the trailing newline(s) a map row may end with dropped first. */
const messageLines = (message: string): ReadonlyArray<string> => Str.split("\n")(Str.replace(/\n+$/u, "")(message));

/** The first line of a message. */
const subjectOf = (message: string): string => A.headNonEmpty(Str.split("\n")(message));

/**
 * A conventional commit message for one map row: a non-empty subject of at
 * most {@link HISTORY_SUBJECT_MAX_LENGTH} characters, optionally followed by
 * a blank line and a body.
 *
 * **Details**
 *
 * Trailing newlines are allowed (most July rows end with one) and ignored by
 * the line checks. Lines may not end in whitespace and the body may not hold
 * two consecutive blank lines: both are what `git notes add`'s stripspace
 * cleanup would rewrite, so a valid row's canonical body is already in the
 * form git stores.
 *
 * **Example** (Validate map messages)
 *
 * ```ts
 * import { HistoryCommitMessage } from "@beep/repo-cli/commands/History"
 * import * as S from "effect/Schema"
 *
 * const isMessage = S.is(HistoryCommitMessage)
 *
 * console.log(isMessage("fix(cli): handle empty input\n\nDetails.")) // true
 * console.log(isMessage("fix(cli): handle empty input\nno blank line")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HistoryCommitMessage = S.String.check(
  S.makeFilter(
    (message: string) => Str.isNonEmpty(Str.trim(subjectOf(message))),
    $I.annote("HistoryCommitMessageSubjectPresent", {
      title: "History commit message subject present",
      description: "The first line of a corrected commit message is not blank.",
      message: "Expected a non-empty subject line",
    })
  ),
  S.makeFilter(
    (message: string) => Str.length(subjectOf(message)) <= HISTORY_SUBJECT_MAX_LENGTH,
    $I.annote("HistoryCommitMessageSubjectLength", {
      title: "History commit message subject length",
      description: "The subject line of a corrected commit message is at most 72 characters.",
      message: `Expected a subject line of at most ${HISTORY_SUBJECT_MAX_LENGTH} characters`,
    })
  ),
  S.makeFilter(
    (message: string) => {
      const lines = messageLines(message);
      return lines.length < 2 || lines[1] === "";
    },
    $I.annote("HistoryCommitMessageBlankSecondLine", {
      title: "History commit message blank second line",
      description: "A corrected commit message with a body separates it from the subject by one blank line.",
      message: "Expected a blank second line between the subject and the body",
    })
  ),
  S.makeFilter(
    (message: string) => A.every(messageLines(message), (line) => Str.trimEnd(line) === line),
    $I.annote("HistoryCommitMessageNoTrailingWhitespace", {
      title: "History commit message has no trailing whitespace",
      description: "No line of a corrected commit message ends in whitespace.",
      message: "Expected no line to end in whitespace",
    })
  ),
  S.makeFilter(
    (message: string) => !Str.includes("\n\n\n")(Str.replace(/\n+$/u, "")(message)),
    $I.annote("HistoryCommitMessageSingleBlankLines", {
      title: "History commit message has single blank lines",
      description: "A corrected commit message never holds two consecutive blank lines.",
      message: "Expected no two consecutive blank lines",
    })
  )
).pipe(
  $I.annoteSchema("HistoryCommitMessage", {
    description: "A conventional commit message for one row of the commit-message overlay map.",
  })
);

/**
 * Decoded type of {@link HistoryCommitMessage}.
 *
 * @category models
 * @since 0.0.0
 */
export type HistoryCommitMessage = typeof HistoryCommitMessage.Type;

/**
 * The tracked commit-message map: full commit SHA on `main` to its corrected
 * conventional message.
 *
 * **Gotchas**
 *
 * A record whose key schema is refined treats a key that fails the
 * refinement as an excess property, which default decoding silently drops.
 * Decode the file through {@link decodeHistoryCommitMessageMap}, which turns
 * excess properties into errors, so an abbreviated SHA fails instead of
 * vanishing.
 *
 * **Example** (Validate a one-row map)
 *
 * ```ts
 * import { HistoryCommitMessageMap } from "@beep/repo-cli/commands/History"
 * import * as S from "effect/Schema"
 *
 * const row = { "6f33208961bfc08f406841f842689fed5942c19c": "chore(repos): remove a vendored copy" }
 *
 * console.log(S.is(HistoryCommitMessageMap)(row)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HistoryCommitMessageMap = S.Record(GitCommitSha, HistoryCommitMessage).pipe(
  $I.annoteSchema("HistoryCommitMessageMap", {
    description: "Commit SHA on main to the corrected conventional commit message published as its history note.",
  })
);

/**
 * Decoded type of {@link HistoryCommitMessageMap}.
 *
 * @category models
 * @since 0.0.0
 */
export type HistoryCommitMessageMap = typeof HistoryCommitMessageMap.Type;

const decodeMapText = S.decodeEffect(S.fromJsonString(HistoryCommitMessageMap), {
  errors: "all",
  onExcessProperty: "error",
});

/**
 * Decodes the map file's JSON text, reporting every invalid row rather than
 * only the first, and failing on any key that is not a full commit SHA.
 *
 * **Example** (Decode map text)
 *
 * ```ts
 * import { decodeHistoryCommitMessageMap } from "@beep/repo-cli/commands/History"
 * import * as Effect from "effect/Effect"
 *
 * const program = decodeHistoryCommitMessageMap('{"6f33208961bfc08f406841f842689fed5942c19c":"chore: x"}')
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeHistoryCommitMessageMap = (text: string): Effect.Effect<HistoryCommitMessageMap, S.SchemaError> =>
  decodeMapText(text);

/**
 * The canonical note body for one map row: the message with its trailing
 * newlines removed, then exactly one newline.
 *
 * **Details**
 *
 * This is the byte-for-byte text a `refs/notes/history` note must hold, and
 * the writer must produce exactly it. It equals what `git notes add -m
 * <message>` stores, because git's stripspace cleanup also collapses the
 * end of the text to one newline; the map rows themselves may end with one
 * newline or none.
 *
 * **Example** (Project a row to its note body)
 *
 * ```ts
 * import { historyNoteBody } from "@beep/repo-cli/commands/History"
 *
 * console.log(historyNoteBody("chore: x\n") === "chore: x\n") // true
 * console.log(historyNoteBody("chore: x") === "chore: x\n") // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const historyNoteBody = (message: HistoryCommitMessage): string => `${Str.replace(/\n+$/u, "")(message)}\n`;

/**
 * Inputs of one `beep history notes --check` run.
 *
 * **Example** (Describe a check of the default ref)
 *
 * ```ts
 * import { HistoryNotesCheckOptions } from "@beep/repo-cli/commands/History"
 *
 * const options = HistoryNotesCheckOptions.make({
 *   root: "/repo",
 *   mapPath: "docs/history/commit-message-map.json",
 *   ref: "refs/notes/history",
 *   base: "origin/main",
 *   requirePublished: false,
 * })
 * console.log(options.base) // "origin/main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HistoryNotesCheckOptions extends S.Opaque<HistoryNotesCheckOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    root: S.String.pipe($I.annoteKey("HistoryNotesCheckOptions.root", { description: "Repository root to check." })),
    mapPath: S.String.pipe(
      $I.annoteKey("HistoryNotesCheckOptions.mapPath", {
        description: "Path of the commit-message map, relative to the repository root.",
      })
    ),
    ref: S.String.pipe(
      $I.annoteKey("HistoryNotesCheckOptions.ref", { description: "The local notes ref compared against the map." })
    ),
    base: S.String.pipe(
      $I.annoteKey("HistoryNotesCheckOptions.base", { description: "The ref every map key must be reachable from." })
    ),
    requirePublished: S.Boolean.pipe(
      $I.annoteKey("HistoryNotesCheckOptions.requirePublished", {
        description: "Whether an absent notes ref fails the check instead of passing with a notice.",
      })
    ),
  }).pipe($I.annoteSchema("HistoryNotesCheckOptions", { description: "Inputs of one history notes check." }))
) {}

/**
 * The outcome of one `beep history notes --check` run. Every SHA list is
 * sorted ascending so the report is deterministic.
 *
 * **Example** (Represent an unpublished, valid map)
 *
 * ```ts
 * import { HistoryNotesCheckReport } from "@beep/repo-cli/commands/History"
 *
 * const report = HistoryNotesCheckReport.make({
 *   mapPath: "docs/history/commit-message-map.json",
 *   ref: "refs/notes/history",
 *   base: "origin/main",
 *   requirePublished: false,
 *   rows: 940,
 *   unreachable: [],
 *   published: false,
 *   notes: 0,
 *   matching: 0,
 *   missing: [],
 *   extra: [],
 *   differing: [],
 * })
 * console.log(report.published) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HistoryNotesCheckReport extends S.Opaque<HistoryNotesCheckReport, { readonly brand: unique symbol }>()(
  S.Struct({
    mapPath: S.String.pipe(
      $I.annoteKey("HistoryNotesCheckReport.mapPath", { description: "Repository-relative path of the checked map." })
    ),
    ref: S.String.pipe($I.annoteKey("HistoryNotesCheckReport.ref", { description: "The notes ref compared." })),
    base: S.String.pipe(
      $I.annoteKey("HistoryNotesCheckReport.base", { description: "The ref map keys were checked against." })
    ),
    requirePublished: S.Boolean.pipe(
      $I.annoteKey("HistoryNotesCheckReport.requirePublished", {
        description: "Whether an absent notes ref counts as a failure.",
      })
    ),
    rows: S.Int.pipe($I.annoteKey("HistoryNotesCheckReport.rows", { description: "Number of decoded map rows." })),
    unreachable: S.Array(GitCommitSha).pipe(
      $I.annoteKey("HistoryNotesCheckReport.unreachable", {
        description: "Map keys that are not reachable from the base ref.",
      })
    ),
    published: S.Boolean.pipe(
      $I.annoteKey("HistoryNotesCheckReport.published", { description: "Whether the notes ref exists locally." })
    ),
    notes: S.Int.pipe(
      $I.annoteKey("HistoryNotesCheckReport.notes", { description: "Number of notes on the notes ref." })
    ),
    matching: S.Int.pipe(
      $I.annoteKey("HistoryNotesCheckReport.matching", {
        description: "Number of map rows whose note holds exactly the canonical body.",
      })
    ),
    missing: S.Array(GitCommitSha).pipe(
      $I.annoteKey("HistoryNotesCheckReport.missing", { description: "Map rows with no note on the notes ref." })
    ),
    extra: S.Array(S.String).pipe(
      $I.annoteKey("HistoryNotesCheckReport.extra", {
        description: "Annotated objects that carry a note but have no map row.",
      })
    ),
    differing: S.Array(GitCommitSha).pipe(
      $I.annoteKey("HistoryNotesCheckReport.differing", {
        description: "Map rows whose note blob differs from the blob of the canonical body.",
      })
    ),
  }).pipe($I.annoteSchema("HistoryNotesCheckReport", { description: "The outcome of one history notes check." }))
) {}
