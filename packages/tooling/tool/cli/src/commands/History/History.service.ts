/**
 * Read-only check of the commit-message overlay: the tracked map decodes,
 * every key is on the base history, and a local notes ref matches it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git, NotesCommit, NoteWrite } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import { HistoryGitError, HistoryMapError, HistoryNotesWriteError } from "./History.errors.ts";
import {
  decodeHistoryCommitMessageMap,
  HISTORY_NOTES_COMMIT_TIMESTAMP,
  HISTORY_NOTES_COMMITTER_EMAIL,
  HISTORY_NOTES_COMMITTER_NAME,
  HISTORY_NOTES_FETCH_REFSPEC,
  HISTORY_NOTES_REF,
  HistoryConfigChange,
  HistoryNotesCheckReport,
  HistoryNotesFetchOutcome,
  HistoryNotesSyncReport,
  HistoryNotesWriteReport,
  historyNoteBody,
} from "./History.schemas.ts";
import type {
  HistoryCommitMessage,
  HistoryCommitMessageMap,
  HistoryNotesCheckOptions,
  HistoryNotesWriteOptions,
} from "./History.schemas.ts";

const $I = $RepoCliId.create("commands/History/History.service");

/** How many note blobs are hashed at once when a published ref is compared. */
const HASH_CONCURRENCY = 8;

/** How many SHAs of one category the human summary lists before eliding the rest. */
const LISTED_SHAS = 20;

/**
 * The commit-message overlay operations.
 *
 * @category services
 * @since 0.0.0
 */
export interface HistoryNotesShape {
  /**
   * Decodes the map, confirms every key is reachable from `options.base`,
   * and, when `options.ref` exists locally, compares its notes with the
   * canonical bodies.
   *
   * **Details**
   *
   * Reachability is one `rev-list` of the base into a set, not one spawn per
   * row. A note matches when its blob id equals the blob id of
   * `historyNoteBody(row)`, so no note blob is read. The report never fails
   * the effect for drift; {@link historyNotesCheckProblems} decides that.
   */
  readonly check: (
    options: HistoryNotesCheckOptions
  ) => Effect.Effect<HistoryNotesCheckReport, HistoryMapError | HistoryGitError>;
  /**
   * Makes the clone at `root` fetch and display the overlay: adds
   * `+refs/notes/history:refs/notes/history` to `remote.origin.fetch` and
   * `refs/notes/history` to `notes.displayRef` when absent, then (with
   * `fetch`) fetches the ref.
   *
   * **Details**
   *
   * Idempotent: a value already present is never added twice. Linked
   * worktrees share their clone's config, so one run per clone suffices. A
   * clone without an `origin` remote gets only the display ref. A remote that
   * has not published the ref yet is a notice (`unpublished`), not a failure.
   */
  readonly sync: (options: {
    readonly root: string;
    readonly fetch: boolean;
  }) => Effect.Effect<HistoryNotesSyncReport, HistoryGitError>;
  /**
   * Rebuilds `options.ref` from the map as one parentless notes commit with
   * a fixed identity, time and message, so the same map always yields the
   * same commit and tree.
   *
   * **Details**
   *
   * The same decode, shallow and ancestry guards as `check` run first; any
   * unreachable key refuses the write before the ref changes. Each note body
   * is `historyNoteBody(row)`. When the ref already holds the computed
   * commit, nothing moves and the report says `changed: false`. The index and
   * work tree are never touched.
   */
  readonly write: (
    options: HistoryNotesWriteOptions
  ) => Effect.Effect<HistoryNotesWriteReport, HistoryMapError | HistoryGitError | HistoryNotesWriteError>;
}

/**
 * The commit-message overlay service.
 *
 * **Example** (Request a check)
 *
 * ```ts
 * import { HistoryNotes, HistoryNotesCheckOptions } from "@beep/repo-cli/commands/History"
 * import * as Effect from "effect/Effect"
 *
 * const options = HistoryNotesCheckOptions.make({
 *   root: "/repo",
 *   mapPath: "docs/history/commit-message-map.json",
 *   ref: "refs/notes/history",
 *   base: "origin/main",
 *   requirePublished: false,
 * })
 * console.log(Effect.isEffect(HistoryNotes.use((notes) => notes.check(options)))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HistoryNotes extends Context.Service<HistoryNotes, HistoryNotesShape>()($I`HistoryNotes`) {}

const SHALLOW_REMEDIATION = "Fetch full history first (`git fetch --unshallow`, or `fetch-depth: 0` in CI).";

const gitError = (operation: string, message: string) => (cause: unknown) =>
  HistoryGitError.make({ operation, message, cause });

const sortShas = A.sort(Order.String);
/** The commit SHA of one map row. */
const rowKey = ([key]: readonly [string, HistoryCommitMessage]): string => key;
const byKey = Order.mapInput(Order.String, rowKey);

const makeHistoryNotes = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const git = yield* Git;

  const readMap = Effect.fn("HistoryNotes.readMap")(function* (root: string, mapPath: string) {
    const text = yield* fs
      .readFileString(path.join(root, mapPath))
      .pipe(
        Effect.mapError((cause) => HistoryMapError.make({ path: mapPath, message: `Cannot read ${mapPath}.`, cause }))
      );
    return yield* decodeHistoryCommitMessageMap(text).pipe(
      Effect.mapError((cause) =>
        HistoryMapError.make({ path: mapPath, message: `${mapPath} does not decode:\n${cause.message}`, cause })
      )
    );
  });

  const compareNotes = Effect.fn("HistoryNotes.compareNotes")(function* (
    options: HistoryNotesCheckOptions,
    map: HistoryCommitMessageMap,
    rows: ReadonlyArray<readonly [string, HistoryCommitMessage]>
  ) {
    const notes = yield* git
      .notesList(options.root, options.ref)
      .pipe(Effect.mapError(gitError("notes list", `Cannot list the notes on ${options.ref}.`)));
    const noteByObject = HashMap.fromIterable(A.map(notes, (entry) => [entry.object, entry.note] as const));
    const [present, missing] = A.partition(rows, ([key, message]) =>
      noteByObject.pipe(
        HashMap.get(key),
        O.map((note) => ({ key, message, note })),
        Result.fromOption(() => key)
      )
    );
    const extra = noteByObject.pipe(
      HashMap.keys,
      A.filter((object) => !R.has(map, object)),
      sortShas
    );
    const differing = yield* Effect.filter(
      present,
      ({ key, message, note }) =>
        git.hashObject(options.root, historyNoteBody(message)).pipe(
          Effect.mapBoth({
            onFailure: gitError("hash-object", `Cannot hash the canonical note body of ${key}.`),
            onSuccess: (expected) => expected !== note,
          })
        ),
      { concurrency: HASH_CONCURRENCY }
    );
    return {
      notes: notes.length,
      missing,
      extra,
      differing: A.map(differing, ({ key }) => key),
      matching: present.length - differing.length,
    };
  });

  // Decodes the map and proves every key reachable from `base`; shared by
  // check and write so both refuse a shallow clone the same way.
  const loadRows = Effect.fn("HistoryNotes.loadRows")(function* (root: string, mapPath: string, base: string) {
    const map = yield* readMap(root, mapPath);
    const rows = A.sort(R.toEntries(map), byKey);
    const keys = A.map(rows, rowKey);
    // A shallow clone's rev-list is only the shallow window, so valid keys
    // would read as unreachable: fail closed instead of reporting them.
    const shallow = yield* git
      .isShallow(root)
      .pipe(Effect.mapError(gitError("is-shallow", "Cannot tell whether this clone is shallow.")));
    if (shallow) {
      return yield* HistoryGitError.make({
        operation: "is-shallow",
        message: `Cannot prove map keys reachable from ${base} in a shallow clone. ${SHALLOW_REMEDIATION}`,
      });
    }
    const reachable = yield* git.revList(root, base).pipe(
      Effect.mapBoth({
        onFailure: gitError("rev-list", `Cannot list the commits reachable from ${base}.`),
        onSuccess: HashSet.fromIterable,
      })
    );
    const unreachable = A.filter(keys, (key) => !HashSet.has(reachable, key));
    return { map, rows, keys, unreachable };
  });

  const check: HistoryNotesShape["check"] = Effect.fn("HistoryNotes.check")(function* (options) {
    yield* Effect.annotateCurrentSpan({ ref: options.ref, base: options.base });
    const { map, rows, keys, unreachable } = yield* loadRows(options.root, options.mapPath, options.base);
    const published = yield* git
      .refExists(options.root, options.ref)
      .pipe(Effect.mapError(gitError("ref exists", `Cannot tell whether ${options.ref} exists.`)));
    const comparison = published
      ? yield* compareNotes(options, map, rows)
      : { notes: 0, missing: [], extra: [], differing: [], matching: 0 };
    return HistoryNotesCheckReport.make({
      mapPath: options.mapPath,
      ref: options.ref,
      base: options.base,
      requirePublished: options.requirePublished,
      rows: keys.length,
      unreachable,
      published,
      ...comparison,
    });
  });

  const write: HistoryNotesShape["write"] = Effect.fn("HistoryNotes.write")(function* (options) {
    yield* Effect.annotateCurrentSpan({ ref: options.ref, base: options.base });
    const { rows, unreachable } = yield* loadRows(options.root, options.mapPath, options.base);
    if (A.isReadonlyArrayNonEmpty(unreachable)) {
      return yield* HistoryNotesWriteError.make({
        message: `Refusing to write ${options.ref}: ${unreachable.length} map keys are not reachable from ${options.base} (first: ${A.headNonEmpty(unreachable)}).`,
      });
    }
    const exists = yield* git
      .refExists(options.root, options.ref)
      .pipe(Effect.mapError(gitError("ref exists", `Cannot tell whether ${options.ref} exists.`)));
    const previous = exists
      ? yield* git
          .revParse(options.root, options.ref)
          .pipe(
            Effect.mapBoth({ onFailure: gitError("rev-parse", `Cannot resolve ${options.ref}.`), onSuccess: O.some })
          )
      : O.none<string>();
    const commit = yield* git
      .replaceNotes(
        options.root,
        options.ref,
        A.map(rows, ([object, message]) => NoteWrite.make({ object, body: historyNoteBody(message) })),
        NotesCommit.make({
          message: `notes: project ${options.mapPath}`,
          name: HISTORY_NOTES_COMMITTER_NAME,
          email: HISTORY_NOTES_COMMITTER_EMAIL,
          timestamp: HISTORY_NOTES_COMMIT_TIMESTAMP,
        })
      )
      .pipe(Effect.mapError(gitError("fast-import", `Cannot write the notes on ${options.ref}.`)));
    const tree = yield* git
      .revParse(options.root, `${commit}^{tree}`)
      .pipe(Effect.mapError(gitError("rev-parse", `Cannot resolve the tree of ${commit}.`)));
    return HistoryNotesWriteReport.make({
      ref: options.ref,
      rows: rows.length,
      previous,
      commit,
      tree,
      changed: !O.contains(previous, commit),
    });
  });

  // Appends `value` to the multi-valued `key` unless some value already equals it.
  const ensureConfigValue = Effect.fn("HistoryNotes.ensureConfigValue")(function* (
    root: string,
    key: string,
    value: string
  ) {
    const values = yield* git.configGetAll(root, key).pipe(Effect.mapError(gitError("config", `Cannot read ${key}.`)));
    if (A.contains(values, value)) return HistoryConfigChange.Enum.present;
    yield* git
      .configSet(root, key, value, { add: true })
      .pipe(Effect.mapError(gitError("config", `Cannot add ${value} to ${key}.`)));
    return HistoryConfigChange.Enum.added;
  });

  const sync: HistoryNotesShape["sync"] = Effect.fn("HistoryNotes.sync")(function* (options) {
    yield* Effect.annotateCurrentSpan({ fetch: options.fetch });
    const origin = yield* git
      .remoteUrl(options.root, { remote: "origin" })
      .pipe(Effect.mapBoth({ onFailure: gitError("config", "Cannot read the origin remote."), onSuccess: O.isSome }));
    const fetchRefspec = origin
      ? yield* ensureConfigValue(options.root, "remote.origin.fetch", HISTORY_NOTES_FETCH_REFSPEC)
      : HistoryConfigChange.Enum.skipped;
    const displayRef = yield* ensureConfigValue(options.root, "notes.displayRef", HISTORY_NOTES_REF);
    const fetch =
      origin && options.fetch
        ? yield* git.fetch(options.root, { remote: "origin", ref: HISTORY_NOTES_FETCH_REFSPEC, noTags: true }).pipe(
            Effect.as(HistoryNotesFetchOutcome.Enum.fetched),
            // The remote has not published the ref yet: a notice, not a failure.
            Effect.catchTag("UnknownRefError", () => Effect.succeed(HistoryNotesFetchOutcome.Enum.unpublished)),
            Effect.mapError(gitError("fetch", `Cannot fetch ${HISTORY_NOTES_REF} from origin.`))
          )
        : HistoryNotesFetchOutcome.Enum.skipped;
    return HistoryNotesSyncReport.make({ origin, fetchRefspec, displayRef, fetch });
  });

  return HistoryNotes.of({ check, write, sync });
});

/**
 * The live overlay service over the ambient file system, path and `Git`.
 *
 * **Example** (Inspect the live layer)
 *
 * ```ts
 * import { HistoryNotesLive } from "@beep/repo-cli/commands/History"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(HistoryNotesLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const HistoryNotesLive: Layer.Layer<HistoryNotes, never, FileSystem.FileSystem | Path.Path | Git> = Layer.effect(
  HistoryNotes,
  makeHistoryNotes
);

/**
 * The problems that fail a check, one sentence each; empty means it passed.
 *
 * **Details**
 *
 * Unreachable keys always fail. An absent notes ref fails only under
 * `requirePublished`; a present one fails on any missing, extra or differing
 * note.
 *
 * **Example** (Decide a clean unpublished check)
 *
 * ```ts
 * import { HistoryNotesCheckReport, historyNotesCheckProblems } from "@beep/repo-cli/commands/History"
 *
 * const report = HistoryNotesCheckReport.make({
 *   mapPath: "docs/history/commit-message-map.json",
 *   ref: "refs/notes/history",
 *   base: "origin/main",
 *   requirePublished: false,
 *   rows: 1,
 *   unreachable: [],
 *   published: false,
 *   notes: 0,
 *   matching: 0,
 *   missing: [],
 *   extra: [],
 *   differing: [],
 * })
 * console.log(historyNotesCheckProblems(report).length) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const historyNotesCheckProblems = (report: HistoryNotesCheckReport): ReadonlyArray<string> =>
  A.getSomes([
    O.liftPredicate(
      `${report.unreachable.length} map keys are not reachable from ${report.base}`,
      () => report.unreachable.length > 0
    ),
    O.liftPredicate(`${report.ref} is not published`, () => !report.published && report.requirePublished),
    O.liftPredicate(`${report.missing.length} map rows have no note`, () => report.missing.length > 0),
    O.liftPredicate(`${report.extra.length} notes have no map row`, () => report.extra.length > 0),
    O.liftPredicate(
      `${report.differing.length} notes differ from their canonical body`,
      () => report.differing.length > 0
    ),
  ]);

/** One labelled SHA category, listing at most {@link LISTED_SHAS} and counting the rest. */
const shaLines = (label: string, shas: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...A.map(A.take(shas, LISTED_SHAS), (sha) => `  ${label}: ${sha}`),
  ...(shas.length > LISTED_SHAS ? [`  ${label}: ... and ${shas.length - LISTED_SHAS} more`] : []),
];

/**
 * Renders a check report as the command's deterministic human summary.
 *
 * **Example** (Render an unpublished check)
 *
 * ```ts
 * import { HistoryNotesCheckReport, renderHistoryNotesCheck } from "@beep/repo-cli/commands/History"
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
 * console.log(renderHistoryNotesCheck(report).at(-1)) // "result: ok"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderHistoryNotesCheck = (report: HistoryNotesCheckReport): ReadonlyArray<string> => {
  const problems = historyNotesCheckProblems(report);
  return [
    `history notes check: ${report.mapPath}`,
    `  map rows: ${report.rows} decoded, ${report.rows - report.unreachable.length} reachable from ${report.base}, ${report.unreachable.length} unreachable`,
    report.published
      ? `  ${report.ref}: ${report.notes} notes; ${report.matching} match, ${report.missing.length} missing, ${report.extra.length} extra, ${report.differing.length} differ`
      : `  ${report.ref}: not yet published in this clone; nothing to compare${report.requirePublished ? "" : " (pass --require-published to fail on this)"}`,
    ...shaLines("unreachable", report.unreachable),
    ...shaLines("missing", report.missing),
    ...shaLines("extra", report.extra),
    ...shaLines("differs", report.differing),
    A.match(problems, {
      onEmpty: () => "result: ok",
      onNonEmpty: (found) => `result: failed (${A.join(found, "; ")})`,
    }),
  ];
};

/**
 * Renders a write report as the command's human summary.
 *
 * **Example** (Render an unchanged rewrite)
 *
 * ```ts
 * import { HistoryNotesWriteReport, renderHistoryNotesWrite } from "@beep/repo-cli/commands/History"
 * import * as O from "effect/Option"
 *
 * const commit = "a".repeat(40)
 * const report = HistoryNotesWriteReport.make({
 *   ref: "refs/notes/history",
 *   rows: 940,
 *   previous: O.some(commit),
 *   commit,
 *   tree: "b".repeat(40),
 *   changed: false,
 * })
 * console.log(renderHistoryNotesWrite(report)[0]) // "history notes write: refs/notes/history unchanged (940 notes)"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderHistoryNotesWrite = (report: HistoryNotesWriteReport): ReadonlyArray<string> => [
  `history notes write: ${report.ref} ${report.changed ? "updated" : "unchanged"} (${report.rows} notes)`,
  `  commit: ${report.commit}`,
  `  tree: ${report.tree}`,
  ...(report.changed ? [`  previous: ${O.getOrElse(report.previous, () => "(none)")}`] : []),
];

/**
 * Renders a sync report as the command's human summary.
 *
 * **Example** (Render a configure-only sync)
 *
 * ```ts
 * import { HistoryNotesSyncReport, renderHistoryNotesSync } from "@beep/repo-cli/commands/History"
 *
 * const report = HistoryNotesSyncReport.make({ origin: true, fetchRefspec: "added", displayRef: "present", fetch: "skipped" })
 * console.log(renderHistoryNotesSync(report)[1]) // "  remote.origin.fetch +refs/notes/history:refs/notes/history: added"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderHistoryNotesSync = (report: HistoryNotesSyncReport): ReadonlyArray<string> => [
  "history notes sync:",
  `  remote.origin.fetch ${HISTORY_NOTES_FETCH_REFSPEC}: ${report.origin ? report.fetchRefspec : "skipped (no origin remote)"}`,
  `  notes.displayRef ${HISTORY_NOTES_REF}: ${report.displayRef}`,
  `  fetch: ${HistoryNotesFetchOutcome.match(report.fetch, {
    fetched: () => `fetched ${HISTORY_NOTES_REF} from origin`,
    unpublished: () => `origin has not published ${HISTORY_NOTES_REF} yet`,
    skipped: () => "skipped",
  })}`,
];
