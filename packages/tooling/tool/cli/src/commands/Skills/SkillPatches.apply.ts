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
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { asArrayBufferView } from "../../internal/cli/Bytes.ts";
import { DiffLine, diffLines, joinDiffLines, sameDiffLine } from "./internal/DiffLines.ts";
import { SkillPatchApplyError } from "./Skills.errors.ts";
import { SkillTreeMode, SkillUpstreamContentFile } from "./Skills.schemas.ts";
import type { SkillPatchApplyReason } from "./Skills.errors.ts";

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
  const mode = O.getOrElse(
    O.orElse(section.newMode, () => O.map(existing, (file) => file.mode)),
    (): SkillTreeMode => "100644"
  );
  return HashMap.set(
    tree,
    section.path,
    SkillUpstreamContentFile.make({ path: section.path, mode, bytes: textEncoder.encode(joinDiffLines(after)) })
  );
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
