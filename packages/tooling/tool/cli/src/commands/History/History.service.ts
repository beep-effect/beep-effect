/**
 * Read-only check of the commit-message overlay: the tracked map decodes,
 * every key is on the base history, and a local notes ref matches it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git } from "@beep/git/Git";
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
import { HistoryGitError, HistoryMapError } from "./History.errors.ts";
import { decodeHistoryCommitMessageMap, HistoryNotesCheckReport, historyNoteBody } from "./History.schemas.ts";
import type { HistoryCommitMessage, HistoryCommitMessageMap, HistoryNotesCheckOptions } from "./History.schemas.ts";

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

  const check: HistoryNotesShape["check"] = Effect.fn("HistoryNotes.check")(function* (options) {
    yield* Effect.annotateCurrentSpan({ ref: options.ref, base: options.base });
    const map = yield* readMap(options.root, options.mapPath);
    const rows = A.sort(R.toEntries(map), byKey);
    const keys = A.map(rows, rowKey);
    const reachable = yield* git.revList(options.root, options.base).pipe(
      Effect.mapBoth({
        onFailure: gitError("rev-list", `Cannot list the commits reachable from ${options.base}.`),
        onSuccess: HashSet.fromIterable,
      })
    );
    const unreachable = A.filter(keys, (key) => !HashSet.has(reachable, key));
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

  return HistoryNotes.of({ check });
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
