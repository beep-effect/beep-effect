/**
 * The append-only hunk ledger (`.agents/skill-patches/ledger.jsonl`, B20) and
 * the queries the review ritual and the replay report run over it.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { openDirectoryHandle } from "../../../internal/repo-run/DirectoryHandle.ts";
import { SkillsCommandError } from "../Skills.errors.ts";
import { SkillHunkLedgerRow } from "../SkillsReview.schemas.ts";
import { PATCH_ROOT } from "./PatchStaging.ts";

/**
 * File name of the ledger inside {@link PATCH_ROOT}.
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const HUNK_LEDGER_FILE = "ledger.jsonl";

/**
 * Repo-relative path of the hunk ledger.
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const HUNK_LEDGER_PATH = `${PATCH_ROOT}/${HUNK_LEDGER_FILE}`;

const LedgerRowJson = S.fromJsonString(SkillHunkLedgerRow);
const decodeLedgerRow = S.decodeUnknownEffect(LedgerRowJson);
const encodeLedgerRow = S.encodeEffect(LedgerRowJson);
type NodeFs = typeof import("node:fs");
const nodeFs = (): NodeFs => process.getBuiltinModule("node:fs");
const heldEntry = (fd: number, name: string): string => `/proc/self/fd/${fd}/${name}`;
const unsafeLedger = (message: string) => SkillsCommandError.make({ message, file: HUNK_LEDGER_PATH });
const attempt = <A>(operation: string, thunk: () => A): Effect.Effect<A, SkillsCommandError> =>
  Effect.try({
    try: thunk,
    catch: (cause) => SkillsCommandError.new(cause, `Failed to ${operation} ${HUNK_LEDGER_PATH}.`, HUNK_LEDGER_PATH),
  });
const closeQuietly = (fd: number) => Effect.ignore(attempt("close", () => nodeFs().closeSync(fd)));

const openChildDirectory = Effect.fn("HunkLedger.openChildDirectory")(function* (
  parentFd: number,
  name: string,
  create: boolean
) {
  const boundParent = yield* attempt("bind descriptor for", () => nodeFs().statSync(`/proc/self/fd/${parentFd}`)).pipe(
    Effect.mapError(() => unsafeLedger(`Descriptor-bound ${HUNK_LEDGER_PATH} IO is unsupported on this platform.`))
  );
  if (!boundParent.isDirectory())
    return yield* unsafeLedger(`Descriptor-bound ${HUNK_LEDGER_PATH} IO is unsupported on this platform.`);
  const entry = heldEntry(parentFd, name);
  const opened = yield* openDirectoryHandle(entry);
  if (O.isSome(opened)) return opened;
  const existing = yield* attempt("inspect parent of", () => nodeFs().lstatSync(entry, { throwIfNoEntry: false }));
  if (existing !== undefined)
    return yield* unsafeLedger(`Refusing a symlinked or non-directory ancestor of ${HUNK_LEDGER_PATH}.`);
  if (!create) return O.none();
  yield* attempt("create parent of", () => nodeFs().mkdirSync(entry, { mode: 0o700 }));
  const created = yield* openDirectoryHandle(entry);
  if (O.isNone(created)) return yield* unsafeLedger(`Cannot bind the newly created parent of ${HUNK_LEDGER_PATH}.`);
  return created;
});

const ledgerDirectory = Effect.fn("HunkLedger.directory")(function* (repoRoot: string, create: boolean) {
  const root = yield* openDirectoryHandle(repoRoot);
  if (O.isNone(root)) return yield* unsafeLedger("Cannot bind the repository root for hunk-ledger IO.");
  let directory: O.Option<typeof root.value> = root;
  for (const segment of Str.split("/")(PATCH_ROOT)) {
    if (O.isNone(directory)) return O.none();
    directory = yield* openChildDirectory(directory.value.fd, segment, create);
  }
  return directory;
});

const inspectLedgerFile = Effect.fn("HunkLedger.inspectFile")(function* (entry: string) {
  const info = yield* attempt("inspect", () => nodeFs().lstatSync(entry, { throwIfNoEntry: false }));
  if (info !== undefined && (!info.isFile() || info.nlink !== 1))
    return yield* unsafeLedger(`Refusing a symlinked or multiply linked ${HUNK_LEDGER_PATH}.`);
  return info !== undefined;
});

const requireRegularLedger = Effect.fn("HunkLedger.requireRegularFile")(function* (fd: number) {
  const info = yield* attempt("inspect opened", () => nodeFs().fstatSync(fd));
  if (!info.isFile() || info.nlink !== 1)
    return yield* unsafeLedger(`Refusing a non-regular or multiply linked ${HUNK_LEDGER_PATH}.`);
});

const readLedgerText = (repoRoot: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const directory = yield* ledgerDirectory(repoRoot, false);
      if (O.isNone(directory)) return "";
      const entry = heldEntry(directory.value.fd, HUNK_LEDGER_FILE);
      if (!(yield* inspectLedgerFile(entry))) return "";
      const fs = nodeFs();
      return yield* Effect.acquireUseRelease(
        attempt("open", () =>
          fs.openSync(entry, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
        ),
        Effect.fnUntraced(function* (fd) {
          yield* requireRegularLedger(fd);
          return yield* attempt("read", () => fs.readFileSync(fd, { encoding: "utf8" }));
        }),
        closeQuietly
      );
    })
  );

const appendLedgerText = (repoRoot: string, text: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const directory = yield* ledgerDirectory(repoRoot, true);
      if (O.isNone(directory)) return yield* unsafeLedger("Cannot bind the hunk-ledger directory.");
      const entry = heldEntry(directory.value.fd, HUNK_LEDGER_FILE);
      yield* inspectLedgerFile(entry);
      const fs = nodeFs();
      yield* Effect.acquireUseRelease(
        attempt("open", () =>
          fs.openSync(
            entry,
            fs.constants.O_WRONLY |
              fs.constants.O_APPEND |
              fs.constants.O_CREAT |
              fs.constants.O_NOFOLLOW |
              fs.constants.O_NONBLOCK,
            0o600
          )
        ),
        Effect.fnUntraced(function* (fd) {
          yield* requireRegularLedger(fd);
          yield* attempt("append to", () => fs.writeFileSync(fd, text));
        }),
        closeQuietly
      );
    })
  );

/**
 * The fields that key a ledger row.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type HunkLedgerKey = Pick<
  SkillHunkLedgerRow,
  "skill" | "oldRevision" | "newRevision" | "patchSetHash" | "hunkHash"
>;

const sameKey = (left: HunkLedgerKey, right: HunkLedgerKey): boolean =>
  Str.Equivalence(left.skill, right.skill) &&
  Str.Equivalence(left.oldRevision, right.oldRevision) &&
  Str.Equivalence(left.newRevision, right.newRevision) &&
  Str.Equivalence(left.patchSetHash, right.patchSetHash) &&
  Str.Equivalence(left.hunkHash, right.hunkHash);

const sameHunk = (skill: string, hunkHash: string) => (row: SkillHunkLedgerRow) =>
  Str.Equivalence(row.skill, skill) && Str.Equivalence(row.hunkHash, hunkHash);

/**
 * Reads every ledger row in append order; a missing ledger is empty.
 *
 * **Details**
 *
 * Blank lines are skipped. A line that does not decode fails typed with its
 * line number, so a hand-mangled ledger never silently loses a decision.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const readHunkLedger = Effect.fn("HunkLedger.read")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<SkillHunkLedgerRow>, SkillsCommandError> {
  const text = yield* readLedgerText(repoRoot);
  const lines = A.filter(
    A.map(Str.split("\n")(text), (line, index) => [index + 1, Str.trim(line)] as const),
    ([, line]) => Str.isNonEmpty(line)
  );
  return yield* Effect.forEach(
    lines,
    ([lineNumber, line]) =>
      decodeLedgerRow(line).pipe(
        SkillsCommandError.mapError(
          `${HUNK_LEDGER_PATH}:${lineNumber} is not a skills-hunk-ledger/v1 row.`,
          HUNK_LEDGER_PATH
        )
      ),
    { concurrency: 1 }
  );
});

/**
 * Appends rows to the ledger, one JSON object per line, creating it when absent.
 *
 * @internal
 * @category commands
 * @since 0.0.0
 */
export const appendHunkLedgerRows = Effect.fn("HunkLedger.append")(function* (
  repoRoot: string,
  rows: ReadonlyArray<SkillHunkLedgerRow>
): Effect.fn.Return<void, SkillsCommandError> {
  if (A.isReadonlyArrayEmpty(rows)) {
    return;
  }
  const lines = yield* Effect.forEach(
    rows,
    (row) =>
      encodeLedgerRow(row).pipe(
        SkillsCommandError.mapError(`Failed to encode a ${HUNK_LEDGER_PATH} row.`, HUNK_LEDGER_PATH)
      ),
    { concurrency: 1 }
  );
  yield* appendLedgerText(repoRoot, `${A.join(lines, "\n")}\n`);
});

/**
 * The latest row recorded at exactly this key, if any: the resume check.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const decisionAtKey: {
  (key: HunkLedgerKey): (rows: ReadonlyArray<SkillHunkLedgerRow>) => O.Option<SkillHunkLedgerRow>;
  (rows: ReadonlyArray<SkillHunkLedgerRow>, key: HunkLedgerKey): O.Option<SkillHunkLedgerRow>;
} = dual(
  2,
  (rows: ReadonlyArray<SkillHunkLedgerRow>, key: HunkLedgerKey): O.Option<SkillHunkLedgerRow> =>
    A.findLast(rows, (row) => sameKey(row, key))
);

/**
 * A hunk identity at one pin: what the two-strike query asks about.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type HunkAtPin = Pick<HunkLedgerKey, "skill" | "hunkHash" | "newRevision">;

/**
 * The two-strike query (B4): whether this hunk identity already had a
 * non-`applied` replay recorded at a different new revision.
 *
 * **Details**
 *
 * Clean bumps write no ledger rows, so "two consecutive bumps" is read as "a
 * recorded conflict at another pin, and a conflict again now". A hunk that is
 * re-cut gets a new identity, so the count restarts after a rebase.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const isSecondStrike: {
  (hunk: HunkAtPin): (rows: ReadonlyArray<SkillHunkLedgerRow>) => boolean;
  (rows: ReadonlyArray<SkillHunkLedgerRow>, hunk: HunkAtPin): boolean;
} = dual(2, (rows: ReadonlyArray<SkillHunkLedgerRow>, hunk: HunkAtPin): boolean =>
  A.some(
    rows,
    (row) =>
      sameHunk(hunk.skill, hunk.hunkHash)(row) &&
      row.status !== "applied" &&
      !Str.Equivalence(row.newRevision, hunk.newRevision)
  )
);

/**
 * The earlier conflict decision `--ghost` would replay for a byte-identical hunk.
 *
 * **Details**
 *
 * The candidate is the latest non-`applied` row for the same skill and hunk
 * identity at the same new revision under a different key (the base pin or
 * the patch-set hash moved). A decision about a different pin never ghosts;
 * that recurrence is the two-strike case and goes to a human.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const ghostCandidate: {
  (key: HunkLedgerKey): (rows: ReadonlyArray<SkillHunkLedgerRow>) => O.Option<SkillHunkLedgerRow>;
  (rows: ReadonlyArray<SkillHunkLedgerRow>, key: HunkLedgerKey): O.Option<SkillHunkLedgerRow>;
} = dual(
  2,
  (rows: ReadonlyArray<SkillHunkLedgerRow>, key: HunkLedgerKey): O.Option<SkillHunkLedgerRow> =>
    A.findLast(
      rows,
      (row) =>
        sameHunk(key.skill, key.hunkHash)(row) &&
        Str.Equivalence(row.newRevision, key.newRevision) &&
        !sameKey(row, key) &&
        row.status !== "applied"
    )
);

/**
 * The latest classifying row for a hunk identity: a labelled `keep` or a `drop`.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const latestClassification: {
  (
    hunk: Pick<HunkLedgerKey, "skill" | "hunkHash">
  ): (rows: ReadonlyArray<SkillHunkLedgerRow>) => O.Option<SkillHunkLedgerRow>;
  (
    rows: ReadonlyArray<SkillHunkLedgerRow>,
    hunk: Pick<HunkLedgerKey, "skill" | "hunkHash">
  ): O.Option<SkillHunkLedgerRow>;
} = dual(
  2,
  (
    rows: ReadonlyArray<SkillHunkLedgerRow>,
    hunk: Pick<HunkLedgerKey, "skill" | "hunkHash">
  ): O.Option<SkillHunkLedgerRow> =>
    A.findLast(
      rows,
      (row) =>
        sameHunk(hunk.skill, hunk.hunkHash)(row) &&
        ((row.decision === "keep" && O.isSome(row.label)) || row.decision === "drop")
    )
);
