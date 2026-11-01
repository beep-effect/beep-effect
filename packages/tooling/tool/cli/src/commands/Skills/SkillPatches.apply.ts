/**
 * Strict unified-diff application for vendored skill patch series.
 *
 * **Details**
 *
 * This is the inverse of the patch rendering in `Skills.patches.ts`: it
 * replays a plain Git unified diff onto an in-memory skill tree. It is strict
 * on purpose. Every hunk must match the file's lines exactly at the position
 * its header records, including whether each line ends in a newline. There is
 * no offset search and no fuzz, so a patch either reproduces the tree it was
 * generated against or fails with a typed {@link SkillPatchApplyError}. A
 * pin bump whose pristine tree moved under a patch therefore surfaces as a
 * conflict, never as a silently shifted hunk.
 *
 * Supported sections are the ones the patch writer emits: modified files
 * (with or without a mode change), new files, and deleted files. Renames,
 * copies, and binary diffs are refused as `unsupported-patch`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { asArrayBufferView, concatBytes } from "../../internal/cli/Bytes.ts";
import { DiffLine, diffLines, joinDiffLines, sameDiffLine } from "./internal/DiffLines.ts";
import { appendFramedText, hashBytes } from "./internal/SkillTree.ts";
import { SkillPatchApplyError } from "./Skills.errors.ts";
import { SkillTreeMode, SkillUpstreamContentFile } from "./Skills.schemas.ts";
import { SkillHunkReport } from "./SkillsRelock.schemas.ts";
import { SkillPatchHunk } from "./SkillsReview.schemas.ts";
import type * as Digest from "effect/crypto/Digest";
import type { SkillPatchApplyReason, SkillsCommandError } from "./Skills.errors.ts";
import type { SkillHunkStatus } from "./SkillsRelock.schemas.ts";

const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const textEncoder = new TextEncoder();
const isSkillTreeMode = S.is(SkillTreeMode);

const NO_NEWLINE_MARKER = "\\ No newline at end of file";
const DEV_NULL = "/dev/null";
const SECTION_HEADER = "diff --git ";
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;
const HUNK_KINDS = [" ", "-", "+"] as const;
const UNSUPPORTED_HEADERS = [
  "similarity index ",
  "dissimilarity index ",
  "rename from ",
  "rename to ",
  "copy from ",
  "copy to ",
  "Binary files ",
  "GIT binary patch",
];

type HunkLine = { readonly kind: (typeof HUNK_KINDS)[number]; readonly line: DiffLine };
type HunkRange = {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
};
type Hunk = HunkRange & { readonly lines: ReadonlyArray<HunkLine> };
type FileChange = "modify" | "create" | "delete";
type FileSection = {
  readonly path: string;
  readonly change: FileChange;
  readonly oldMode: O.Option<SkillTreeMode>;
  readonly newMode: O.Option<SkillTreeMode>;
  readonly hunks: ReadonlyArray<Hunk>;
};
type Cursor = { readonly lines: ReadonlyArray<string>; index: number };
type Remaining = { readonly old: number; readonly new: number };
type Applied = { readonly output: ReadonlyArray<DiffLine>; readonly consumed: number };

const fail =
  (patch: string, file: string, reason: SkillPatchApplyReason) =>
  (message: string): Effect.Effect<never, SkillPatchApplyError> =>
    Effect.fail(SkillPatchApplyError.make({ patch, file, reason, message }));

const peek = (cursor: Cursor): O.Option<string> => A.get(cursor.lines, cursor.index);
const current = (cursor: Cursor): string => O.getOrElse(peek(cursor), () => "");
const atSectionEnd = (cursor: Cursor): boolean =>
  O.isNone(peek(cursor)) || Str.startsWith(SECTION_HEADER)(current(cursor));

const isUnsafePath = (candidate: string): boolean =>
  Str.startsWith("/")(candidate) || Str.includes("\0")(candidate) || A.contains(Str.split(candidate, "/"), "..");

// `diff --git a/P b/P`: both sides name the same path, because the series never renames.
const sameSidesPath = (header: string): O.Option<string> => {
  const rest = Str.slice(SECTION_HEADER.length)(header);
  const pathLength = (Str.length(rest) - 5) / 2;
  const candidate = Str.slice(2, 2 + pathLength)(rest);
  return O.liftPredicate(candidate, (value) => Str.isNonEmpty(value) && Str.Equivalence(rest, `a/${value} b/${value}`));
};

const sectionPath = Effect.fn("SkillPatches.sectionPath")(function* (
  patch: string,
  header: string
): Effect.fn.Return<string, SkillPatchApplyError> {
  const candidate = sameSidesPath(header);
  if (O.isNone(candidate)) {
    return yield* fail(patch, "", "unsupported-patch")(`Unsupported or malformed file header: ${header}`);
  }
  return isUnsafePath(candidate.value)
    ? yield* fail(patch, candidate.value, "malformed-patch")(`Unsafe patch path: ${candidate.value}`)
    : candidate.value;
});

const modeOf = (patch: string, file: string, value: string): Effect.Effect<SkillTreeMode, SkillPatchApplyError> =>
  isSkillTreeMode(value)
    ? Effect.succeed(value)
    : fail(patch, file, "malformed-patch")(`Unsupported file mode ${value} for ${file}.`);

const parseCount = (value: string | undefined): number => (value === undefined ? 1 : Number.parseInt(value, 10));

const parseHunkRange = Effect.fn("SkillPatches.parseHunkRange")(function* (
  patch: string,
  file: string,
  header: string
): Effect.fn.Return<HunkRange, SkillPatchApplyError> {
  const match = HUNK_HEADER.exec(header);
  if (match === null) {
    return yield* fail(patch, file, "malformed-patch")(`Expected a hunk header in ${file}, found: ${header}`);
  }
  return {
    oldStart: Number.parseInt(match[1] ?? "0", 10),
    oldCount: parseCount(match[2]),
    newStart: Number.parseInt(match[3] ?? "0", 10),
    newCount: parseCount(match[4]),
  };
});

// One body line plus the `\ No newline at end of file` marker that may follow it.
const readHunkLine = Effect.fn("SkillPatches.readHunkLine")(function* (
  patch: string,
  file: string,
  cursor: Cursor
): Effect.fn.Return<HunkLine, SkillPatchApplyError> {
  const raw = current(cursor);
  const kind = A.findFirst(HUNK_KINDS, (prefix) => Str.startsWith(prefix)(raw));
  if (O.isNone(kind)) {
    return yield* fail(patch, file, "malformed-patch")(`A hunk in ${file} ends before its line counts.`);
  }
  cursor.index += 1;
  const noNewline = Str.Equivalence(current(cursor), NO_NEWLINE_MARKER);
  cursor.index += noNewline ? 1 : 0;
  return { kind: kind.value, line: DiffLine.make({ text: Str.slice(1)(raw), eol: !noNewline }) };
});

const consume = (remaining: Remaining, kind: HunkLine["kind"]): Remaining => ({
  old: remaining.old - (kind === "+" ? 0 : 1),
  new: remaining.new - (kind === "-" ? 0 : 1),
});

const parseHunk = Effect.fn("SkillPatches.parseHunk")(function* (
  patch: string,
  file: string,
  cursor: Cursor
): Effect.fn.Return<Hunk, SkillPatchApplyError> {
  const header = current(cursor);
  const range = yield* parseHunkRange(patch, file, header);
  cursor.index += 1;
  let remaining: Remaining = { old: range.oldCount, new: range.newCount };
  let lines = A.empty<HunkLine>();
  while (remaining.old > 0 || remaining.new > 0) {
    const line = yield* readHunkLine(patch, file, cursor);
    remaining = consume(remaining, line.kind);
    lines = A.append(lines, line);
  }
  return Math.min(remaining.old, remaining.new) < 0
    ? yield* fail(patch, file, "malformed-patch")(`Hunk ${header} in ${file} has more lines than it declares.`)
    : { ...range, lines };
});

type HeaderRule = {
  readonly prefix: string;
  readonly apply: (
    patch: string,
    section: FileSection,
    value: string
  ) => Effect.Effect<FileSection, SkillPatchApplyError>;
};

const requireSide =
  (patch: string, section: FileSection, label: string, expected: string) =>
  (value: string): Effect.Effect<FileSection, SkillPatchApplyError> =>
    Str.Equivalence(value, expected)
      ? Effect.succeed(section)
      : fail(patch, section.path, "malformed-patch")(`Unexpected ${label} header for ${section.path}: ${value}`);

// `index <old>..<new> <mode>` pins an unchanged mode; the abbreviated object ids are informative only.
const indexMode = (patch: string, section: FileSection, value: string) =>
  O.match(A.get(Str.split(value, " "), 1), {
    onNone: () => Effect.succeed(section),
    onSome: (mode) =>
      Effect.map(modeOf(patch, section.path, mode), (pinned) => ({
        ...section,
        oldMode: O.some(pinned),
        newMode: O.some(pinned),
      })),
  });

const HEADER_RULES: ReadonlyArray<HeaderRule> = [
  {
    prefix: "new file mode ",
    apply: (patch, section, value) =>
      Effect.map(modeOf(patch, section.path, value), (mode) => ({
        ...section,
        change: "create",
        newMode: O.some(mode),
      })),
  },
  {
    prefix: "deleted file mode ",
    apply: (patch, section, value) =>
      Effect.map(modeOf(patch, section.path, value), (mode) => ({
        ...section,
        change: "delete",
        oldMode: O.some(mode),
      })),
  },
  {
    prefix: "old mode ",
    apply: (patch, section, value) =>
      Effect.map(modeOf(patch, section.path, value), (mode) => ({ ...section, oldMode: O.some(mode) })),
  },
  {
    prefix: "new mode ",
    apply: (patch, section, value) =>
      Effect.map(modeOf(patch, section.path, value), (mode) => ({ ...section, newMode: O.some(mode) })),
  },
  { prefix: "index ", apply: indexMode },
  {
    prefix: "--- ",
    apply: (patch, section, value) =>
      requireSide(patch, section, "old-side", section.change === "create" ? DEV_NULL : `a/${section.path}`)(value),
  },
  {
    prefix: "+++ ",
    apply: (patch, section, value) =>
      requireSide(patch, section, "new-side", section.change === "delete" ? DEV_NULL : `b/${section.path}`)(value),
  },
];

const applyHeaderLine = (
  patch: string,
  section: FileSection,
  line: string
): Effect.Effect<FileSection, SkillPatchApplyError> =>
  O.match(
    A.findFirst(HEADER_RULES, (rule) => Str.startsWith(rule.prefix)(line)),
    {
      onNone: () =>
        Str.isEmpty(line)
          ? Effect.succeed(section)
          : fail(patch, section.path, "malformed-patch")(`Unexpected line in the ${section.path} section: ${line}`),
      onSome: (rule) => rule.apply(patch, section, Str.slice(rule.prefix.length)(line)),
    }
  );

const parseSectionLine = Effect.fn("SkillPatches.parseSectionLine")(function* (
  patch: string,
  cursor: Cursor,
  section: FileSection
): Effect.fn.Return<FileSection, SkillPatchApplyError> {
  const line = current(cursor);
  if (A.some(UNSUPPORTED_HEADERS, (prefix) => Str.startsWith(prefix)(line))) {
    return yield* fail(
      patch,
      section.path,
      "unsupported-patch"
    )(`Unsupported patch section for ${section.path}: ${line}`);
  }
  if (Str.startsWith("@@ ")(line)) {
    return { ...section, hunks: A.append(section.hunks, yield* parseHunk(patch, section.path, cursor)) };
  }
  cursor.index += 1;
  return yield* applyHeaderLine(patch, section, line);
});

const parseSection = Effect.fn("SkillPatches.parseSection")(function* (
  patch: string,
  cursor: Cursor
): Effect.fn.Return<FileSection, SkillPatchApplyError> {
  const path = yield* sectionPath(patch, current(cursor));
  cursor.index += 1;
  let section: FileSection = { path, change: "modify", oldMode: O.none(), newMode: O.none(), hunks: A.empty() };
  while (!atSectionEnd(cursor)) {
    section = yield* parseSectionLine(patch, cursor, section);
  }
  return section;
});

const parseSectionStart = (patch: string, cursor: Cursor, line: string) =>
  Str.startsWith(SECTION_HEADER)(line)
    ? parseSection(patch, cursor)
    : fail(patch, "", "malformed-patch")(`Expected a "diff --git" header, found: ${line}`);

// Parses every file section; blank lines between sections are skipped, any other text outside one is refused.
const parsePatch = Effect.fn("SkillPatches.parsePatch")(function* (
  patch: string,
  text: string
): Effect.fn.Return<ReadonlyArray<FileSection>, SkillPatchApplyError> {
  const cursor: Cursor = { lines: Str.split(text, "\n"), index: 0 };
  let sections = A.empty<FileSection>();
  while (O.isSome(peek(cursor))) {
    const line = current(cursor);
    cursor.index += Str.isEmpty(line) ? 1 : 0;
    sections = Str.isEmpty(line) ? sections : A.append(sections, yield* parseSectionStart(patch, cursor, line));
  }
  return A.isReadonlyArrayEmpty(sections)
    ? yield* fail(patch, "", "malformed-patch")("The patch carries no file sections.")
    : sections;
});

// One side of a hunk: every line except the other side's additions or removals.
const sideOf = (lines: ReadonlyArray<HunkLine>, excluded: HunkLine["kind"]): ReadonlyArray<DiffLine> =>
  A.map(
    A.filter(lines, (entry) => entry.kind !== excluded),
    (entry) => entry.line
  );

// Git names the line before an empty side, so a zero-count side starts after it.
const sideStart = (start: number, count: number): number => (count === 0 ? start : start - 1);

const linesEqual = (actual: ReadonlyArray<DiffLine>, expected: ReadonlyArray<DiffLine>): boolean =>
  A.length(actual) === A.length(expected) &&
  A.every(A.zip(actual, expected), ([left, right]) => sameDiffLine(left, right));

const decodeText = Effect.fn("SkillPatches.decodeText")(function* (
  patch: string,
  file: SkillUpstreamContentFile
): Effect.fn.Return<string, SkillPatchApplyError> {
  return yield* Effect.try({
    try: () => textDecoder.decode(asArrayBufferView(file.bytes)),
    catch: () =>
      SkillPatchApplyError.make({
        patch,
        file: file.path,
        reason: "binary-content",
        message: `${file.path} is not UTF-8 text, so a text patch cannot apply to it.`,
      }),
  });
});

// A hunk applies at the position its header records, after the previous hunk, against the
// original line numbers; its removed and context lines must equal the file's lines there, and
// its new side must land where the new-side header says.
const applyHunk = Effect.fn("SkillPatches.applyHunk")(function* (
  patch: string,
  file: string,
  original: ReadonlyArray<DiffLine>,
  applied: Applied,
  hunk: Hunk
): Effect.fn.Return<Applied, SkillPatchApplyError> {
  const start = sideStart(hunk.oldStart, hunk.oldCount);
  if (start < applied.consumed) {
    return yield* fail(patch, file, "malformed-patch")(`A hunk in ${file} overlaps or precedes the one before it.`);
  }
  if (!linesEqual(A.take(A.drop(original, start), hunk.oldCount), sideOf(hunk.lines, "+"))) {
    return yield* fail(
      patch,
      file,
      "context-mismatch"
    )(`The hunk at line ${hunk.oldStart} does not match ${file}; strict apply never searches nearby lines.`);
  }
  const output = A.appendAll(applied.output, A.take(A.drop(original, applied.consumed), start - applied.consumed));
  if (sideStart(hunk.newStart, hunk.newCount) !== A.length(output)) {
    return yield* fail(
      patch,
      file,
      "malformed-patch"
    )(
      `The hunk at line ${hunk.oldStart} in ${file} declares new-side line ${hunk.newStart}, which is not where it lands.`
    );
  }
  return { output: A.appendAll(output, sideOf(hunk.lines, "-")), consumed: start + hunk.oldCount };
});

const applyHunks = Effect.fn("SkillPatches.applyHunks")(function* (
  patch: string,
  file: string,
  original: ReadonlyArray<DiffLine>,
  hunks: ReadonlyArray<Hunk>
): Effect.fn.Return<ReadonlyArray<DiffLine>, SkillPatchApplyError> {
  const applied = yield* Effect.reduce(
    hunks,
    (): Applied => ({ output: A.empty(), consumed: 0 }),
    (state, hunk) => applyHunk(patch, file, original, state, hunk)
  );
  return A.appendAll(applied.output, A.drop(original, applied.consumed));
});

// New-file sections need the file absent; modify and delete sections need it present.
const requirePresence = (
  patch: string,
  section: FileSection,
  existing: O.Option<SkillUpstreamContentFile>
): Effect.Effect<void, SkillPatchApplyError> => {
  const creating = section.change === "create";
  if (creating === O.isSome(existing)) {
    return creating
      ? fail(patch, section.path, "file-exists")(`New-file patch for ${section.path}, but the file already exists.`)
      : fail(patch, section.path, "file-missing")(`Patch changes ${section.path}, but the file does not exist.`);
  }
  return Effect.void;
};

const requireOldMode = (
  patch: string,
  section: FileSection,
  existing: O.Option<SkillUpstreamContentFile>
): Effect.Effect<void, SkillPatchApplyError> => {
  const mismatch = O.flatMap(existing, (file) =>
    O.filter(section.oldMode, (expected) => !Str.Equivalence(file.mode, expected))
  );
  return O.match(mismatch, {
    onNone: () => Effect.void,
    onSome: (expected) =>
      fail(patch, section.path, "mode-mismatch")(`${section.path} does not have the patch's old mode ${expected}.`),
  });
};

// The patched file takes the section's new mode, else its old mode, else a plain file's.
const setSectionLines = (
  tree: HashMap.HashMap<string, SkillUpstreamContentFile>,
  section: FileSection,
  existing: O.Option<SkillUpstreamContentFile>,
  lines: ReadonlyArray<DiffLine>
): HashMap.HashMap<string, SkillUpstreamContentFile> =>
  HashMap.set(
    tree,
    section.path,
    SkillUpstreamContentFile.make({
      path: section.path,
      mode: O.getOrElse(
        O.orElse(section.newMode, () => O.map(existing, (file) => file.mode)),
        (): SkillTreeMode => "100644"
      ),
      bytes: textEncoder.encode(joinDiffLines(lines)),
    })
  );

const applySection = Effect.fn("SkillPatches.applySection")(function* (
  patch: string,
  tree: HashMap.HashMap<string, SkillUpstreamContentFile>,
  section: FileSection
): Effect.fn.Return<HashMap.HashMap<string, SkillUpstreamContentFile>, SkillPatchApplyError> {
  const existing = HashMap.get(tree, section.path);
  yield* requirePresence(patch, section, existing);
  yield* requireOldMode(patch, section, existing);
  // A mode-only section never decodes its file, so a binary file keeps its bytes.
  if (section.change === "modify" && A.isReadonlyArrayEmpty(section.hunks) && O.isSome(existing)) {
    const file = existing.value;
    return HashMap.set(
      tree,
      section.path,
      SkillUpstreamContentFile.make({
        path: file.path,
        mode: O.getOrElse(section.newMode, () => file.mode),
        bytes: file.bytes,
      })
    );
  }
  const before = yield* O.match(existing, {
    onNone: () => Effect.succeed(""),
    onSome: (file) => decodeText(patch, file),
  });
  const after = yield* applyHunks(patch, section.path, diffLines(before), section.hunks);
  if (section.change === "delete") {
    return A.isReadonlyArrayEmpty(after)
      ? HashMap.remove(tree, section.path)
      : yield* fail(
          patch,
          section.path,
          "incomplete-delete"
        )(`Delete patch for ${section.path} leaves ${A.length(after)} line(s).`);
  }
  return setSectionLines(tree, section, existing, after);
});

/**
 * Applies one Git unified-diff patch to an in-memory skill tree, exactly.
 *
 * **Details**
 *
 * Sections apply in the order the patch lists them. A hunk applies only where
 * its header says and only when every context and removed line equals the
 * file's line there, newline included; anything else refuses with
 * `context-mismatch`. New-file sections require the file to be absent,
 * modify and delete sections require it present with the patch's old mode,
 * and a delete must consume every line. The returned tree is sorted by path.
 *
 * **Example** (Replay a one-line change)
 *
 * ```ts
 * import { applySkillPatch } from "@beep/repo-cli/commands/Skills/SkillPatches.apply"
 * import { SkillUpstreamContentFile } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as Effect from "effect/Effect"
 *
 * const encoder = new TextEncoder()
 * const tree = [SkillUpstreamContentFile.make({ path: "SKILL.md", mode: "100644", bytes: encoder.encode("a\nb\nc\n") })]
 * const patch = [
 *   "diff --git a/SKILL.md b/SKILL.md",
 *   "index 000000000000..111111111111 100644",
 *   "--- a/SKILL.md",
 *   "+++ b/SKILL.md",
 *   "@@ -1,3 +1,3 @@",
 *   " a",
 *   "-b",
 *   "+B",
 *   " c",
 *   "",
 * ].join("\n")
 *
 * const patched = Effect.runSync(applySkillPatch("0001-skill-md.patch", patch, tree))
 * console.log(new TextDecoder().decode(patched[0]?.bytes)) // "a\nB\nc\n"
 * ```
 *
 * @param patch - The patch's repo-relative path, used in error messages.
 * @param text - Unified-diff text, one or more file sections with exact-context hunks.
 * @param tree - The tree to patch, keyed by skill-relative path.
 * @returns The patched tree, sorted by path.
 * @effects Pure; fails with {@link SkillPatchApplyError} on any mismatch and never partially applies.
 * @category utilities
 * @since 0.0.0
 */
export const applySkillPatch = Effect.fn("SkillPatches.applySkillPatch")(function* (
  patch: string,
  text: string,
  tree: ReadonlyArray<SkillUpstreamContentFile>
): Effect.fn.Return<ReadonlyArray<SkillUpstreamContentFile>, SkillPatchApplyError> {
  const sections = yield* parsePatch(patch, text);
  let files = HashMap.fromIterable(A.map(tree, (file) => [file.path, file] as const));
  for (const section of sections) {
    files = yield* applySection(patch, files, section);
  }
  return files.pipe(
    HashMap.values,
    A.fromIterable,
    A.sortWith((file) => file.path, Str.Order)
  );
});

// ---------------------------------------------------------------------------
// Per-hunk replay classification (B-5 report only; never a write path, B27).
// ---------------------------------------------------------------------------

type HunkVerdict = {
  readonly hunk: number;
  readonly oldStart: number;
  readonly identity: ReadonlyArray<Uint8Array>;
  readonly status: SkillHunkStatus;
  readonly shift: number;
  readonly detail: string;
};

type Classified = {
  readonly verdicts: ReadonlyArray<HunkVerdict>;
  readonly tree: HashMap.HashMap<string, SkillUpstreamContentFile>;
};

// A hunk's identity frames the file path and every body line with its kind and newline
// state, never the line numbers, so a hunk upstream merely shifted keeps its identity.
const hunkIdentity = (file: string, hunk: Hunk): ReadonlyArray<Uint8Array> =>
  A.reduce(hunk.lines, appendFramedText(A.empty<Uint8Array>(), file), (chunks, entry) =>
    appendFramedText(appendFramedText(chunks, `${entry.kind}${entry.line.text}`), entry.line.eol ? "eol" : "no-eol")
  );

const sectionIdentity = (section: FileSection): ReadonlyArray<Uint8Array> =>
  A.reduce(
    [section.path, section.change, O.getOrElse(section.oldMode, () => "-"), O.getOrElse(section.newMode, () => "-")],
    A.empty<Uint8Array>(),
    appendFramedText
  );

// Candidate starts nearest the recorded one first (earlier wins a tie), never before the
// previous hunk's end, so a shifted match is the smallest move that fits.
const shiftedStarts = (recorded: number, from: number, last: number): ReadonlyArray<number> =>
  A.sortWith(
    A.filter(A.range(from, Math.max(from, last)), (start) => start <= last && start !== recorded),
    (start) => Math.abs(start - recorded) * 2 + (start < recorded ? 0 : 1),
    Order.Number
  );

const matchesAt = (original: ReadonlyArray<DiffLine>, start: number, oldSide: ReadonlyArray<DiffLine>): boolean =>
  linesEqual(A.take(A.drop(original, start), A.length(oldSide)), oldSide);

const conflictedSection = (section: FileSection, detail: string): ReadonlyArray<HunkVerdict> =>
  A.isReadonlyArrayEmpty(section.hunks)
    ? [{ hunk: 0, oldStart: 0, identity: sectionIdentity(section), status: "conflicted", shift: 0, detail }]
    : A.map(section.hunks, (hunk, index) => ({
        hunk: index + 1,
        oldStart: hunk.oldStart,
        identity: hunkIdentity(section.path, hunk),
        status: "conflicted",
        shift: 0,
        detail,
      }));

type ClassifyState = { readonly applied: Applied; readonly verdicts: ReadonlyArray<HunkVerdict> };

const shiftDetail = (shift: number): string =>
  shift === 0
    ? ""
    : `Matches exactly ${Math.abs(shift)} line(s) ${shift > 0 ? "below" : "above"} its recorded position; strict apply refuses it.`;

// One hunk: its recorded start if it matches there, else the nearest exact shifted match;
// a hunk that matches nowhere is reported and left out of the in-memory result.
const classifyHunk =
  (path: string, original: ReadonlyArray<DiffLine>) =>
  (state: ClassifyState, hunk: Hunk, index: number): ClassifyState => {
    const oldSide = sideOf(hunk.lines, "+");
    const recorded = sideStart(hunk.oldStart, hunk.oldCount);
    const base = { hunk: index + 1, oldStart: hunk.oldStart, identity: hunkIdentity(path, hunk) };
    const exact = recorded >= state.applied.consumed && matchesAt(original, recorded, oldSide);
    const landing = exact
      ? O.some(recorded)
      : A.findFirst(shiftedStarts(recorded, state.applied.consumed, A.length(original) - A.length(oldSide)), (start) =>
          matchesAt(original, start, oldSide)
        );
    return O.match(landing, {
      onNone: () => ({
        applied: state.applied,
        verdicts: A.append(state.verdicts, {
          ...base,
          status: "conflicted",
          shift: 0,
          detail: `The hunk at line ${hunk.oldStart} matches nowhere in ${path}.`,
        }),
      }),
      onSome: (start) => {
        const shift = start - recorded;
        const kept = A.take(A.drop(original, state.applied.consumed), start - state.applied.consumed);
        return {
          applied: {
            output: A.appendAll(A.appendAll(state.applied.output, kept), sideOf(hunk.lines, "-")),
            consumed: start + A.length(oldSide),
          },
          verdicts: A.append(state.verdicts, {
            ...base,
            status: shift === 0 ? "applied" : "fuzz-applied",
            shift,
            detail: shiftDetail(shift),
          }),
        };
      },
    });
  };

const classifyHunks = (
  section: FileSection,
  original: ReadonlyArray<DiffLine>
): { readonly verdicts: ReadonlyArray<HunkVerdict>; readonly lines: ReadonlyArray<DiffLine> } => {
  const initial: ClassifyState = { applied: { output: A.empty(), consumed: 0 }, verdicts: A.empty() };
  const final = A.reduce(section.hunks, initial, classifyHunk(section.path, original));
  return {
    verdicts: final.verdicts,
    lines: A.appendAll(final.applied.output, A.drop(original, final.applied.consumed)),
  };
};

const sectionBlocker = (
  patch: string,
  section: FileSection,
  existing: O.Option<SkillUpstreamContentFile>
): Effect.Effect<O.Option<string>> =>
  requirePresence(patch, section, existing).pipe(
    Effect.andThen(requireOldMode(patch, section, existing)),
    Effect.as(O.none<string>()),
    Effect.catchTag("SkillPatchApplyError", (error) => Effect.succeedSome(error.message))
  );

const classifySection = Effect.fn("SkillPatches.classifySection")(function* (
  patch: string,
  tree: HashMap.HashMap<string, SkillUpstreamContentFile>,
  section: FileSection
): Effect.fn.Return<Classified> {
  const existing = HashMap.get(tree, section.path);
  const blocker = yield* sectionBlocker(patch, section, existing);
  if (O.isSome(blocker)) {
    return { verdicts: conflictedSection(section, blocker.value), tree };
  }
  const before = yield* O.match(existing, {
    onNone: () => Effect.succeedSome(""),
    onSome: (file) => Effect.option(decodeText(patch, file)),
  });
  if (O.isNone(before)) {
    return { verdicts: conflictedSection(section, `${section.path} is not UTF-8 text.`), tree };
  }
  const { verdicts, lines } = classifyHunks(section, diffLines(before.value));
  const headerRow: ReadonlyArray<HunkVerdict> = A.isReadonlyArrayEmpty(section.hunks)
    ? [{ hunk: 0, oldStart: 0, identity: sectionIdentity(section), status: "applied", shift: 0, detail: "" }]
    : A.empty();
  if (section.change === "delete") {
    const leftover = A.isReadonlyArrayNonEmpty(lines);
    const deleteRow: ReadonlyArray<HunkVerdict> = leftover
      ? [
          {
            hunk: 0,
            oldStart: 0,
            identity: sectionIdentity(section),
            status: "conflicted",
            shift: 0,
            detail: `Delete patch for ${section.path} leaves ${A.length(lines)} line(s).`,
          },
        ]
      : A.empty();
    return {
      verdicts: A.appendAll(A.appendAll(headerRow, verdicts), deleteRow),
      tree: leftover ? tree : HashMap.remove(tree, section.path),
    };
  }
  return {
    verdicts: A.appendAll(headerRow, verdicts),
    tree: setSectionLines(tree, section, existing, lines),
  };
});

const toReports = Effect.fn("SkillPatches.toReports")(function* (
  patch: string,
  file: string,
  verdicts: ReadonlyArray<HunkVerdict>
): Effect.fn.Return<ReadonlyArray<SkillHunkReport>, SkillsCommandError, Digest.Digest> {
  return yield* Effect.forEach(
    verdicts,
    Effect.fnUntraced(function* (verdict) {
      return SkillHunkReport.make({
        patch,
        file,
        hunk: verdict.hunk,
        hunkHash: yield* hashBytes(concatBytes(verdict.identity), `${patch}:${file}:hunk-${verdict.hunk}`),
        oldStart: verdict.oldStart,
        status: verdict.status,
        shift: verdict.shift,
        detail: verdict.detail,
      });
    })
  );
});

/**
 * Classifies every hunk of one patch against a tree, for the replay report only.
 *
 * **Details**
 *
 * Each hunk is tried exactly where its header says (`applied`), then at the
 * nearest position where its context and removed lines match exactly
 * (`fuzz-applied`, with the offset in `shift`), and otherwise it is
 * `conflicted`. A file section that cannot apply at all (a missing or
 * already-present file, an old-mode mismatch, binary content) marks every
 * one of its hunks `conflicted`, and a patch that does not parse becomes one
 * `conflicted` row. The returned tree applies every non-conflicted hunk in
 * memory so later patches classify against the best available tree.
 *
 * This is never a write path (B27): the strict {@link applySkillPatch} is the
 * only applier whose output may be recorded or written.
 *
 * **Example** (Classify a hunk that moved down one line)
 *
 * ```ts
 * import { classifySkillPatchHunks } from "@beep/repo-cli/commands/Skills/SkillPatches.apply"
 * import { SkillUpstreamContentFile } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { NodeCrypto } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 *
 * const encoder = new TextEncoder()
 * const tree = [SkillUpstreamContentFile.make({ path: "SKILL.md", mode: "100644", bytes: encoder.encode("new\na\nb\nc\n") })]
 * const patch = [
 *   "diff --git a/SKILL.md b/SKILL.md",
 *   "--- a/SKILL.md",
 *   "+++ b/SKILL.md",
 *   "@@ -1,3 +1,3 @@",
 *   " a",
 *   "-b",
 *   "+B",
 *   " c",
 *   "",
 * ].join("\n")
 *
 * const classified = Effect.runSync(
 *   classifySkillPatchHunks("0001-skill-md.patch", patch, tree).pipe(Effect.provide(NodeCrypto.layer))
 * )
 * console.log(classified.rows[0]?.status, classified.rows[0]?.shift) // "fuzz-applied" 1
 * ```
 *
 * @param patch - The patch's repo-relative path, recorded on every row.
 * @param text - Unified-diff text.
 * @param tree - The tree to classify against, keyed by skill-relative path.
 * @returns One row per hunk (or per hunk-less section) and the best-effort patched tree, sorted by path.
 * @category utilities
 * @since 0.0.0
 */
export const classifySkillPatchHunks = Effect.fn("SkillPatches.classifySkillPatchHunks")(function* (
  patch: string,
  text: string,
  tree: ReadonlyArray<SkillUpstreamContentFile>
): Effect.fn.Return<
  { readonly rows: ReadonlyArray<SkillHunkReport>; readonly tree: ReadonlyArray<SkillUpstreamContentFile> },
  SkillsCommandError,
  Digest.Digest
> {
  const parsed = yield* Effect.result(parsePatch(patch, text));
  if (Result.isFailure(parsed)) {
    const rows = yield* toReports(patch, parsed.failure.file, [
      {
        hunk: 0,
        oldStart: 0,
        identity: appendFramedText(A.empty<Uint8Array>(), text),
        status: "conflicted",
        shift: 0,
        detail: parsed.failure.message,
      },
    ]);
    return { rows, tree };
  }
  let files = HashMap.fromIterable(A.map(tree, (file) => [file.path, file] as const));
  let rows = A.empty<SkillHunkReport>();
  for (const section of parsed.success) {
    const classified = yield* classifySection(patch, files, section);
    files = classified.tree;
    rows = A.appendAll(rows, yield* toReports(patch, section.path, classified.verdicts));
  }
  return {
    rows,
    tree: files.pipe(
      HashMap.values,
      A.fromIterable,
      A.sortWith((file) => file.path, Str.Order)
    ),
  };
});

// ---------------------------------------------------------------------------
// Hunk listing for the review ritual and the ledger (B-6).
// ---------------------------------------------------------------------------

type ListedHunk = { readonly hunk: number; readonly identity: ReadonlyArray<Uint8Array>; readonly text: string };

const hunkLineText = (entry: HunkLine): ReadonlyArray<string> =>
  entry.line.eol ? [`${entry.kind}${entry.line.text}`] : [`${entry.kind}${entry.line.text}`, NO_NEWLINE_MARKER];

const hunkText = (hunk: Hunk): string =>
  A.join(
    [
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
      ...A.flatMap(hunk.lines, hunkLineText),
    ],
    "\n"
  );

const sectionText = (section: FileSection): string =>
  `${section.change} ${section.path} (mode ${O.getOrElse(section.oldMode, () => "-")} -> ${O.getOrElse(
    section.newMode,
    () => "-"
  )})`;

// The same identities the classifier assigns: one per hunk, or one per hunk-less section.
const listedHunks = (section: FileSection): ReadonlyArray<ListedHunk> =>
  A.isReadonlyArrayEmpty(section.hunks)
    ? [{ hunk: 0, identity: sectionIdentity(section), text: sectionText(section) }]
    : A.map(section.hunks, (hunk, index) => ({
        hunk: index + 1,
        identity: hunkIdentity(section.path, hunk),
        text: hunkText(hunk),
      }));

const toPatchHunks = Effect.fn("SkillPatches.toPatchHunks")(function* (
  patch: string,
  file: string,
  listed: ReadonlyArray<ListedHunk>
): Effect.fn.Return<ReadonlyArray<SkillPatchHunk>, SkillsCommandError, Digest.Digest> {
  return yield* Effect.forEach(
    listed,
    Effect.fnUntraced(function* (entry) {
      return SkillPatchHunk.make({
        patch,
        file,
        hunk: entry.hunk,
        hunkHash: yield* hashBytes(concatBytes(entry.identity), `${patch}:${file}:hunk-${entry.hunk}`),
        text: entry.text,
      });
    })
  );
});

/**
 * Lists every hunk of one patch with the identity the replay report assigns it.
 *
 * **Details**
 *
 * The identity rules are the classifier's: a hunk frames its file path and
 * body lines (never line numbers), a hunk-less section frames its path,
 * change, and modes, and a patch that does not parse becomes one row framing
 * its whole text. Nothing is applied, so this needs no tree; it is how the
 * review ritual shows a hunk and how `skills patch label` maps ledger rows
 * back to patches.
 *
 * **Example** (List the hunks of a one-hunk patch)
 *
 * ```ts
 * import { listSkillPatchHunks } from "@beep/repo-cli/commands/Skills/SkillPatches.apply"
 * import { NodeCrypto } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 *
 * const patch = ["diff --git a/SKILL.md b/SKILL.md", "--- a/SKILL.md", "+++ b/SKILL.md", "@@ -1,1 +1,1 @@", "-a", "+b", ""].join("\n")
 * const hunks = Effect.runSync(listSkillPatchHunks("0001-skill-md.patch", patch).pipe(Effect.provide(NodeCrypto.layer)))
 * console.log(hunks.length, hunks[0]?.text) // 1 "@@ -1,1 +1,1 @@\n-a\n+b"
 * ```
 *
 * @param patch - The patch's repo-relative path, recorded on every row.
 * @param text - Unified-diff text.
 * @returns One row per hunk or hunk-less section, in patch order.
 * @category utilities
 * @since 0.0.0
 */
export const listSkillPatchHunks = Effect.fn("SkillPatches.listSkillPatchHunks")(function* (
  patch: string,
  text: string
): Effect.fn.Return<ReadonlyArray<SkillPatchHunk>, SkillsCommandError, Digest.Digest> {
  const parsed = yield* Effect.result(parsePatch(patch, text));
  if (Result.isFailure(parsed)) {
    return yield* toPatchHunks(patch, parsed.failure.file, [
      { hunk: 0, identity: appendFramedText(A.empty<Uint8Array>(), text), text: parsed.failure.message },
    ]);
  }
  const perSection = yield* Effect.forEach(parsed.success, (section) =>
    toPatchHunks(patch, section.path, listedHunks(section))
  );
  return A.flatten(perSection);
});
