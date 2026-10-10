import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type {
  RawDiagnostic,
  RawEntry,
  RawParse,
  RawSection,
  Splice,
} from "./internal/config.ts";
import {
  applySplice,
  GitConfigDiagnosticCode,
  isValidKey,
  isValidSectionName,
  matchesKey,
  matchesSection,
  scan,
  sectionIndent,
  sectionInsertOffset,
  serializeHeader,
  serializeValue,
} from "./internal/config.ts";

const $I = $ScratchpadId.create("effected/git/GitConfig");

/**
 * One structural problem found while parsing git-config text.
 *
 * **Details**
 *
 * Carries the kit's shared diagnostic core: a `code` from the
 * `GitConfigErrorCode` union, a human `message`, the character
 * `offset`/`length` span, and the zero-based `line`/`character` position
 * derived from the offset.
 *
 * **Example** (Recognize a structural diagnostic)
 *
 * ```ts
 * import { GitConfig, GitConfigDiagnostic } from "@beep/scratchpad/effected/git/GitConfig";
 * import * as Result from "effect/Result";
 * import * as S from "effect/Schema";
 * const parsed = GitConfig.parseResult("[broken");
 * if (Result.isFailure(parsed)) {
 *   console.log(S.is(GitConfigDiagnostic)(parsed.failure.diagnostics[0])); // true
 * }
 * ```
 *
 * @public
 * @category diagnostics
 * @since 0.0.0
 */
export class GitConfigDiagnostic extends S.Class<GitConfigDiagnostic>($I`GitConfigDiagnostic`)({
  /** What kind of malformation this is. */
  code: GitConfigDiagnosticCode.annotateKey({ description: "What kind of malformation this is." }),
  /** A human-readable description of the problem. */
  message: S.String.annotateKey({ description: "A human-readable description of the problem." }),
  /** The character offset where the problem starts. */
  offset: S.Finite.annotateKey({ description: "The character offset where the problem starts." }),
  /** The length of the problematic span. */
  length: S.Finite.annotateKey({ description: "The length of the problematic span." }),
  /** Zero-based line of `offset`. */
  line: S.Finite.annotateKey({ description: "Zero-based line of `offset`." }),
  /** Zero-based character-in-line of `offset`. */
  character: S.Finite.annotateKey({ description: "Zero-based character-in-line of `offset`." }),
}, $I.annote("GitConfigDiagnostic", { description: "One structural problem found while parsing git-config text." })) {
}

/**
 * The document could not be parsed as git-config text.
 *
 * **Details**
 *
 * Malformed input always fails through this typed error, never as a defect.
 * `diagnostics` is an array even when only one is populated — the array is
 * the cross-package diagnostic contract.
 *
 * **Example** (Inspect a parse failure)
 *
 * ```ts
 * import { GitConfigParseError } from "@beep/scratchpad/effected/git/GitConfig";
 * const error = GitConfigParseError.make({ input: "[broken", diagnostics: [] });
 * console.log(error.message); // malformed git-config text
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GitConfigParseError extends S.TaggedError<GitConfigParseError>($I`GitConfigParseError`)("GitConfigParseError", {
  /** The raw input that failed to parse. */
  input: S.String.annotateKey({ description: "The raw input that failed to parse." }),
  /** Every structural problem found, in document order. */
  diagnostics: S.Array(GitConfigDiagnostic).annotateKey({ description: "Every structural problem found, in document order." }),
}, $I.annote("GitConfigParseError", { description: "The document could not be parsed as git-config text." })) {
  /**
   * Renders the first diagnostic and the total count into a one-line message.
   *
   * **Example** (Render the error message)
   *
   * ```ts
   * import { GitConfigParseError } from "@beep/scratchpad/effected/git/GitConfig";
   * const error = GitConfigParseError.make({ input: "[broken", diagnostics: [] });
   * console.log(error.message); // malformed git-config text
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const first = this.diagnostics[0];
    const head = first === undefined ? "malformed git-config text" : `${first.message} (line ${first.line + 1})`;
    return this.diagnostics.length > 1 ? `${head} — and ${this.diagnostics.length - 1} more` : head;
  }
}

/**
 * A surgical edit could not be applied to a {@link GitConfig} document.
 *
 * **Example** (Describe a missing variable)
 *
 * ```ts
 * import { GitConfigEditError } from "@beep/scratchpad/effected/git/GitConfig";
 * const error = GitConfigEditError.make({
 *   op: "unset", reason: "missingKey", section: "core", key: "editor",
 * });
 * console.log(error.message); // unset: [core] editor does not exist
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GitConfigEditError extends S.TaggedError<GitConfigEditError>($I`GitConfigEditError`)("GitConfigEditError", {
  /** The edit operation that was refused. */
  op: S.Literals(["set", "append", "unset", "unsetAll", "addSection", "removeSection", "renameSection"]).annotateKey({ description: "The edit operation that was refused." }),
  /** Why it was refused. */
  reason: S.Literals([
    "missingSection",
    "missingKey",
    "invalidSectionName",
    "invalidSubsection",
    "invalidKey",
    "invalidValue",
  ]).annotateKey({ description: "Why it was refused." }),
  /** The section name the edit addressed. */
  section: S.String.annotateKey({ description: "The section name the edit addressed." }),
  /** The subsection name the edit addressed, when it had one. */
  subsection: S.optionalKey(S.String).annotateKey({ description: "The subsection name the edit addressed, when it had one." }),
  /** The variable name the edit addressed, when it had one. */
  key: S.optionalKey(S.String).annotateKey({ description: "The variable name the edit addressed, when it had one." }),
}, $I.annote("GitConfigEditError", { description: "A surgical edit could not be applied to a GitConfig document." })) {
  /**
   * Renders the refused operation into a one-line message.
   *
   * **Example** (Render the error message)
   *
   * ```ts
   * import { GitConfigEditError } from "@beep/scratchpad/effected/git/GitConfig";
   * const error = GitConfigEditError.make({ op: "unset", reason: "missingSection", section: "core" });
   * console.log(error.message); // unset: section [core] does not exist
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const address = this.subsection === undefined ? `[${this.section}]` : `[${this.section} "${this.subsection}"]`;
    const target = this.key === undefined ? address : `${address} ${this.key}`;
    return this.reason === "missingSection"
      ? `${this.op}: section ${address} does not exist`
      : this.reason === "missingKey"
        ? `${this.op}: ${target} does not exist`
        : this.reason === "invalidSectionName"
          ? `${this.op}: invalid section name "${this.section}"`
          : this.reason === "invalidSubsection"
            ? `${this.op}: invalid subsection name`
            : this.reason === "invalidKey"
              ? `${this.op}: invalid variable name "${this.key ?? ""}"`
              : `${this.op}: the value cannot be represented in git-config syntax`;
  }
}

/**
 * One variable line of a git-config document.
 *
 * **Details**
 *
 * `value` is the DECODED value (quotes removed, escapes resolved, unquoted
 * trailing whitespace discarded). An absent `value` is git's bare-`key`
 * boolean-true shorthand — the distinction is preserved here even though the
 * lookup methods on {@link GitConfig} decode it as `"true"`.
 *
 * **Example** (Preserve the bare boolean shorthand)
 *
 * ```ts
 * import { GitConfigEntry } from "@beep/scratchpad/effected/git/GitConfig";
 * const entry = GitConfigEntry.make({ key: "bare", offset: 7, length: 6 });
 * console.log(entry.value === undefined); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitConfigEntry extends S.Class<GitConfigEntry>($I`GitConfigEntry`)({
  /** The variable name, raw spelling preserved (names compare case-insensitively). */
  key: S.String.annotateKey({ description: "The variable name, raw spelling preserved (names compare case-insensitively)." }),
  /** The decoded value; absent for the bare boolean-true shorthand. */
  value: S.optionalKey(S.String).annotateKey({ description: "The decoded value; absent for the bare boolean-true shorthand." }),
  /** Character offset of the entry span (after `]` for an inline declaration). */
  offset: S.Finite.annotateKey({ description: "Character offset of the entry span (after `]` for an inline declaration)." }),
  /** Length through the entry's final newline (continuation lines included). */
  length: S.Finite.annotateKey({ description: "Length through the entry's final newline (continuation lines included)." }),
}, $I.annote("GitConfigEntry", { description: "One variable line of a git-config document." })) {
}

/**
 * One section of a git-config document.
 *
 * **Details**
 *
 * `name` preserves the raw spelling (section names compare
 * case-insensitively); `subsection` is the decoded subsection name, which
 * compares case-SENSITIVELY; the deprecated `[section.subsection]` dotted
 * form lowercases the subsection while scanning. The span runs from the
 * header's line start to the next section header (or the end of the text),
 * so trailing comments and blank lines belong to the section above them.
 *
 * **Example** (Preserve a quoted subsection name)
 *
 * ```ts
 * import { GitConfigSection } from "@beep/scratchpad/effected/git/GitConfig";
 * const section = GitConfigSection.make({
 *   name: "remote", subsection: "Origin", offset: 0, length: 18, entries: [],
 * });
 * console.log(section.subsection); // Origin
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitConfigSection extends S.Class<GitConfigSection>($I`GitConfigSection`)({
  /** The section name, raw spelling preserved. */
  name: S.String.annotateKey({ description: "The section name, raw spelling preserved." }),
  /** The decoded subsection name, when present. */
  subsection: S.optionalKey(S.String).annotateKey({ description: "The decoded subsection name, when present." }),
  /** Character offset of the header's line start. */
  offset: S.Finite.annotateKey({ description: "Character offset of the header's line start." }),
  /** Length of the whole section span (header through the next header's line start). */
  length: S.Finite.annotateKey({ description: "Length of the whole section span (header through the next header's line start)." }),
  /** The section's variable lines, in document order. */
  entries: S.Array(GitConfigEntry).annotateKey({ description: "The section's variable lines, in document order." }),
}, $I.annote("GitConfigSection", { description: "One section of a git-config document." })) {
}

/**
 * One `include` / `includeIf` directive found in the document.
 *
 * **Details**
 *
 * Recognized and surfaced, deliberately NOT resolved — following an include
 * means filesystem IO and condition evaluation, which a pure document model
 * must not do. `condition` is the `includeIf` condition (e.g.
 * `gitdir:~/work/`); it is absent for a plain `include`.
 *
 * **Example** (Keep an include path unresolved)
 *
 * ```ts
 * import { GitConfigInclude } from "@beep/scratchpad/effected/git/GitConfig";
 * const include = GitConfigInclude.make({ path: "~/work/config", condition: "gitdir:~/work/" });
 * console.log(include.path); // ~/work/config
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitConfigInclude extends S.Class<GitConfigInclude>($I`GitConfigInclude`)({
  /** The include path exactly as written (not resolved, not expanded). */
  path: S.String.annotateKey({ description: "The include path exactly as written (not resolved, not expanded)." }),
  /** The `includeIf` condition, when this came from an `includeIf` section. */
  condition: S.optionalKey(S.String).annotateKey({ description: "The `includeIf` condition, when this came from an `includeIf` section." }),
}, $I.annote("GitConfigInclude", { description: "One `include` / `includeIf` directive found in the document." })) {
}

/** The offset of every line start in `text`, ascending — computed once per parse so mapping many diagnostics stays linear. */
const lineStarts = (text: string): readonly [number, ...Array<number>] => {
  const starts: [number, ...Array<number>] = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
};

/** Computes the zero-based line/character of `offset` against a precomputed line index (binary search). */
const positionOf = (
  starts: readonly [number, ...Array<number>],
  offset: number,
): { readonly line: number; readonly character: number } => {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    const start = starts[mid];
    if (start !== undefined && start <= offset) low = mid;
    else high = mid - 1;
  }
  return { line: low, character: offset - (starts[low] ?? starts[0]) };
};

const toDiagnostic = (starts: readonly [number, ...Array<number>], raw: RawDiagnostic): GitConfigDiagnostic => {
  const { line, character } = positionOf(starts, raw.offset);
  return GitConfigDiagnostic.make({
    code: raw.code,
    message: raw.message,
    offset: raw.offset,
    length: raw.length,
    line,
    character,
  });
};

const fromRaw = (text: string, raw: RawParse): GitConfig =>
  GitConfig.make({
    text,
    sections: raw.sections.map((section) =>
      GitConfigSection.make({
        name: section.name,
        ...O.getSomesStruct({ subsection: O.fromUndefinedOr(section.subsection) }),
        offset: section.offset,
        length: section.contentEnd - section.offset,
        entries: section.entries.map((entry) =>
          GitConfigEntry.make({
            key: entry.key,
            ...O.getSomesStruct({ value: O.fromUndefinedOr(entry.value) }),
            offset: entry.offset,
            length: entry.length,
          }),
        ),
      }),
    ),
  });

/** A hand-built document violated the clean-text invariant. */
class GitConfigInvariantError extends S.TaggedError<GitConfigInvariantError>($I`GitConfigInvariantError`)(
  "GitConfigInvariantError",
  {
    message: S.String.annotateKey({ description: "The violated document invariant." }),
  },
  $I.annote("GitConfigInvariantError", { description: "A GitConfig document contains text that does not scan cleanly." }),
) {}

/**
 * Re-scans a document's text, which must be clean: `GitConfig` instances are
 * only ever built from text that scanned without diagnostics, so a failure
 * here is a wiring bug (a hand-built `GitConfig.make({ text, ... })` with
 * text that never parsed) and dies as a defect rather than failing typed.
 */
const reparse = (text: string): RawParse => {
  const raw = scan(text);
  if (raw.diagnostics.length > 0) {
    throw GitConfigInvariantError.make({
      message: "GitConfig invariant violated: the document text does not scan cleanly. Construct GitConfig via GitConfig.parse / parseResult, never by hand from arbitrary text.",
    });
  }
  return raw;
};

/** The last entry matching `key` across `sections`, with its owning section. */
const lastMatchingEntry = (
  sections: ReadonlyArray<RawSection>,
  key: string,
): { readonly section: RawSection; readonly entry: RawEntry } | undefined => {
  let found: {
    readonly section: RawSection;
    readonly entry: RawEntry
  } | undefined;
  for (const section of sections) {
    for (const entry of section.entries) {
      if (matchesKey(entry, key)) found = { section, entry };
    }
  }
  return found;
};

/** Appends `content` at the end of `text`, inserting a newline separator when the text does not end with one. */
const appendAtEof = (text: string, content: string): string =>
  text === "" ? content : text.endsWith("\n") ? text + content : `${text}\n${content}`;

/**
 * A lossless git-config document: the source text plus the structural index
 * scanned from it.
 *
 * **Details**
 *
 * The model is text-first: `stringify` returns the stored text, so an
 * unmodified document round-trips **byte-for-byte** — comments, blank lines,
 * indentation, quoting and key spelling all survive untouched. Every edit
 * operation computes a minimal text splice, applies it, and re-parses, so
 * edited documents preserve all formatting outside the edited span (this is
 * what lets `.gitmodules` edits survive in git's own formatting).
 *
 * Semantics are git-config's, not generic INI: section and variable names
 * compare case-insensitively, quoted subsection names case-sensitively (the
 * deprecated `[a.b]` dotted form lowercases its subsection on read), keys may be
 * multi-valued (`getAll`/`append`), a bare `key` line is boolean true, and
 * `include`/`includeIf` directives are surfaced by {@link GitConfig.includes}
 * but never resolved.
 *
 * **Gotchas**
 *
 * Instances are immutable by discipline — every edit returns a NEW
 * `GitConfig`. Construct via `parse`/`parseResult`; a hand-built
 * `GitConfig.make` over text that does not scan cleanly dies as a defect at
 * the first operation (bad wiring, not bad input).
 *
 * **Example** (Read and edit a remote URL)
 *
 * ```ts
 * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import * as Result from "effect/Result";
 * const program = Effect.gen(function* () {
 *   const config = yield* GitConfig.parse('[remote "origin"]\n\turl = git@example.com:o/r.git\n');
 *   const url = config.get("remote", "origin", "url");
 *   const edited = config.set("remote", "origin", "pushurl", "git@example.com:o/fork.git");
 *   return { url: O.getOrNull(url), text: Result.isSuccess(edited) ? edited.success.stringify() : config.text };
 * });
 * const output = Effect.runSync(program);
 * console.log(output.url); // git@example.com:o/r.git
 * console.log(output.text.includes("pushurl = git@example.com:o/fork.git")); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitConfig extends S.Class<GitConfig>($I`GitConfig`)({
  /** The document's source text — `stringify` returns exactly this. */
  text: S.String.annotateKey({ description: "The document's source text — `stringify` returns exactly this." }),
  /** The sections scanned from `text`, in document order. */
  sections: S.Array(GitConfigSection).annotateKey({ description: "The sections scanned from `text`, in document order." }),
}, $I.annote("GitConfig", { description: "A lossless git-config document: the source text plus the structural index scanned from it." })) {
  /**
   * Parses git-config text into a lossless document — the pure, synchronous
   * primitive.
   *
   * **Details**
   *
   * Malformed input fails typed with every diagnostic found, never as a
   * defect. Effect consumers want {@link GitConfig.parse}, which is defined
   * in terms of this behind its named span.
   *
   * **Example** (Detect malformed text)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Result from "effect/Result";
   * console.log(Result.isFailure(GitConfig.parseResult("[broken"))); // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static parseResult(text: string): Result.Result<GitConfig, GitConfigParseError> {
    const raw = scan(text);
    if (raw.diagnostics.length > 0) {
      const starts = lineStarts(text);
      return Result.fail(
        GitConfigParseError.make({
          input: text,
          diagnostics: raw.diagnostics.map(diagnostic => toDiagnostic(starts, diagnostic)),
        }),
      );
    }
    return Result.succeed(fromRaw(text, raw));
  }

  /**
   * Parses git-config text into a lossless document.
   *
   * **Details**
   *
   * Defined in terms of {@link GitConfig.parseResult} — synchronous callers
   * can use that variant directly.
   *
   * **Example** (Parse a section in an Effect)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * const config = Effect.runSync(GitConfig.parse("[core]\n\tbare\n"));
   * console.log(config.sections.length); // 1
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly parse = Effect.fn("GitConfig.parse")((text: string) =>
    Effect.fromResult(GitConfig.parseResult(text)),
  );

  /**
   * The document's source text, byte-for-byte — identity for an unmodified document.
   *
   * **Example** (Round-trip comments and formatting)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * const text = "# preserved\n[core]\n\tbare\n";
   * const config = Effect.runSync(GitConfig.parse(text));
   * console.log(config.stringify() === text); // true
   * ```
   *
   * @category serialization
   * @since 0.0.0
   */
  stringify(): string {
    return this.text;
  }

  /**
   * The effective value of `key` in `[section]` / `[section "subsection"]`,
   * last occurrence wins (git's read semantics across duplicate sections).
   *
   * **Details**
   *
   * A bare `key` line decodes as `"true"` here, matching git's boolean
   * semantics for a value-less variable; the entry model
   * (`GitConfigEntry.value`) preserves the distinction.
   *
   * **Example** (Read the last value and a bare boolean)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   * const config = Effect.runSync(GitConfig.parse("[core]\neditor = vim\neditor = nano\nbare\n"));
   * console.log(O.getOrNull(config.get("CORE", undefined, "editor"))); // nano
   * console.log(O.getOrNull(config.get("core", undefined, "bare"))); // true
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get(section: string, subsection: string | undefined, key: string): O.Option<string> {
    const values = this.getAll(section, subsection, key);
    const last = values[values.length - 1];
    return last === undefined ? O.none() : O.some(last);
  }

  /**
   * Every value of `key` in matching sections, in document order (multi-valued keys).
   *
   * **Example** (Read repeated values in order)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * const config = Effect.runSync(GitConfig.parse("[core]\neditor = vim\neditor = nano\n"));
   * console.log(JSON.stringify(config.getAll("core", undefined, "editor"))); // ["vim","nano"]
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  getAll(section: string, subsection: string | undefined, key: string): ReadonlyArray<string> {
    const raw = reparse(this.text);
    const values: Array<string> = [];
    for (const candidate of raw.sections) {
      if (!matchesSection(candidate, section, subsection)) continue;
      for (const entry of candidate.entries) {
        if (matchesKey(entry, key)) values.push(entry.value ?? "true");
      }
    }
    return values;
  }

  /**
   * Every `include` / `includeIf` directive in the document — surfaced, never resolved.
   *
   * **Example** (Inspect a conditional include)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * const config = Effect.runSync(GitConfig.parse('[includeIf "gitdir:~/work/"]\npath = ~/work/config\n'));
   * console.log(config.includes()[0]?.condition); // gitdir:~/work/
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  includes(): ReadonlyArray<GitConfigInclude> {
    const raw = reparse(this.text);
    const directives: Array<GitConfigInclude> = [];
    for (const section of raw.sections) {
      const name = section.name.toLowerCase();
      if (name !== "include" && name !== "includeif") continue;
      if (name === "include" && section.subsection !== undefined) continue;
      if (name === "includeif" && section.subsection === undefined) continue;
      for (const entry of section.entries) {
        if (!matchesKey(entry, "path") || entry.value === undefined) continue;
        directives.push(
          GitConfigInclude.make({
            path: entry.value,
            ...O.getSomesStruct({ condition: O.fromUndefinedOr(section.subsection) }),
          }),
        );
      }
    }
    return directives;
  }

  /**
   * Sets `key` to `value`: replaces the LAST occurrence's value in place
   * (preserving the line's formatting and a trailing comment), appends a
   * new line to the last matching section when the key is absent, and
   * creates the section at the end of the document when none matches.
   *
   * **Example** (Replace the effective value)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * import * as Result from "effect/Result";
   * import * as O from "effect/Option";
   * const config = Effect.runSync(GitConfig.parse("[core]\neditor = vim\n"));
   * const edited = config.set("core", undefined, "editor", "nano");
   * if (Result.isSuccess(edited)) {
   *   console.log(O.getOrNull(edited.success.get("core", undefined, "editor"))); // nano
   * }
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  set(
    section: string,
    subsection: string | undefined,
    key: string,
    value: string,
  ): Result.Result<GitConfig, GitConfigEditError> {
    const invalid = validateAddress("set", section, subsection, key, value);
    if (invalid !== undefined) return Result.fail(invalid);
    const raw = reparse(this.text);
    const matches = raw.sections.filter((candidate) => matchesSection(candidate, section, subsection));
    const found = lastMatchingEntry(matches, key);
    if (found !== undefined) {
      const splice = replaceValueSplice(this.text, found.entry, value);
      return Result.succeed(rebuild(applySplice(this.text, splice)));
    }
    return Result.succeed(insertEntry(this.text, matches, section, subsection, key, value));
  }

  /**
   * Appends a NEW `key = value` line (multi-valued append) — after the last
   * occurrence of `key` when one exists, at the end of the last matching
   * section otherwise, creating the section when none matches.
   *
   * **Example** (Append a second value)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * import * as Result from "effect/Result";
   * const config = Effect.runSync(GitConfig.parse("[core]\neditor = vim\n"));
   * const edited = config.append("core", undefined, "editor", "nano");
   * if (Result.isSuccess(edited)) {
   *   console.log(JSON.stringify(edited.success.getAll("core", undefined, "editor"))); // ["vim","nano"]
   * }
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  append(
    section: string,
    subsection: string | undefined,
    key: string,
    value: string,
  ): Result.Result<GitConfig, GitConfigEditError> {
    const invalid = validateAddress("append", section, subsection, key, value);
    if (invalid !== undefined) return Result.fail(invalid);
    const raw = reparse(this.text);
    const matches = raw.sections.filter((candidate) => matchesSection(candidate, section, subsection));
    const found = lastMatchingEntry(matches, key);
    if (found !== undefined) {
      const indent = sectionIndent(this.text, found.section);
      const offset = found.entry.offset + found.entry.length;
      const line = `${indent}${key} = ${serializeValue(value)}\n`;
      const content = offset > 0 && this.text[offset - 1] !== "\n" ? `\n${line}` : line;
      return Result.succeed(rebuild(applySplice(this.text, {
        offset,
        length: 0,
        content,
      })));
    }
    return Result.succeed(insertEntry(this.text, matches, section, subsection, key, value));
  }

  /**
   * Removes the LAST occurrence of `key` in matching sections; fails typed when it does not exist.
   *
   * **Example** (Remove only the last value)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * import * as Result from "effect/Result";
   * import * as O from "effect/Option";
   * const config = Effect.runSync(GitConfig.parse("[core]\neditor = vim\neditor = nano\n"));
   * const edited = config.unset("core", undefined, "editor");
   * if (Result.isSuccess(edited)) {
   *   console.log(O.getOrNull(edited.success.get("core", undefined, "editor"))); // vim
   * }
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  unset(section: string, subsection: string | undefined, key: string): Result.Result<GitConfig, GitConfigEditError> {
    const raw = reparse(this.text);
    const matches = raw.sections.filter((candidate) => matchesSection(candidate, section, subsection));
    if (matches.length === 0) return Result.fail(editError("unset", "missingSection", section, subsection, key));
    const found = lastMatchingEntry(matches, key);
    if (found === undefined) return Result.fail(editError("unset", "missingKey", section, subsection, key));
    return Result.succeed(
      rebuild(applySplice(this.text, {
        offset: found.entry.offset,
        length: found.entry.length,
        content: removalSuffix(this.text, found.section, found.entry),
      })),
    );
  }

  /**
   * Removes EVERY occurrence of `key` in matching sections; fails typed when none exists.
   *
   * **Example** (Remove every value of a variable)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * import * as Result from "effect/Result";
   * import * as O from "effect/Option";
   * const config = Effect.runSync(GitConfig.parse("[core]\neditor = vim\neditor = nano\n"));
   * const edited = config.unsetAll("core", undefined, "editor");
   * if (Result.isSuccess(edited)) {
   *   console.log(O.isNone(edited.success.get("core", undefined, "editor"))); // true
   * }
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  unsetAll(section: string, subsection: string | undefined, key: string): Result.Result<GitConfig, GitConfigEditError> {
    const raw = reparse(this.text);
    const matches = raw.sections.filter((candidate) => matchesSection(candidate, section, subsection));
    if (matches.length === 0) return Result.fail(editError("unsetAll", "missingSection", section, subsection, key));
    const targets: Array<Splice> = [];
    for (const candidate of matches) {
      for (const entry of candidate.entries) {
        if (matchesKey(entry, key)) targets.push({
          offset: entry.offset,
          length: entry.length,
          content: removalSuffix(this.text, candidate, entry),
        });
      }
    }
    if (targets.length === 0) return Result.fail(editError("unsetAll", "missingKey", section, subsection, key));
    let text = this.text;
    for (const splice of targets.toReversed()) text = applySplice(text, splice);
    return Result.succeed(rebuild(text));
  }

  /**
   * Appends a new empty `[section]` / `[section "subsection"]` at the end of the document.
   *
   * **Example** (Add an empty remote section)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * import * as Result from "effect/Result";
   * const config = Effect.runSync(GitConfig.parse(""));
   * const edited = config.addSection("remote", "origin");
   * if (Result.isSuccess(edited)) {
   *   console.log(edited.success.sections[0]?.subsection); // origin
   * }
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  addSection(section: string, subsection: string | undefined): Result.Result<GitConfig, GitConfigEditError> {
    const invalid = validateAddress("addSection", section, subsection, undefined, undefined);
    if (invalid !== undefined) return Result.fail(invalid);
    return Result.succeed(rebuild(appendAtEof(this.text, `${serializeHeader(section, subsection)}\n`)));
  }

  /**
   * Removes EVERY matching section — header, entries, and the comments and
   * blank lines inside its span (which runs to the next header). Fails typed
   * when none matches.
   *
   * **Example** (Remove duplicate sections)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * import * as Result from "effect/Result";
   * const config = Effect.runSync(GitConfig.parse("[core]\neditor = vim\n[core]\neditor = nano\n"));
   * const edited = config.removeSection("core", undefined);
   * if (Result.isSuccess(edited)) {
   *   console.log(edited.success.stringify() === ""); // true
   * }
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  removeSection(section: string, subsection: string | undefined): Result.Result<GitConfig, GitConfigEditError> {
    const raw = reparse(this.text);
    const matches = raw.sections.filter((candidate) => matchesSection(candidate, section, subsection));
    if (matches.length === 0)
      return Result.fail(editError("removeSection", "missingSection", section, subsection, undefined));
    let text = this.text;
    for (const target of matches.toReversed()) {
      text = applySplice(text, {
        offset: target.offset,
        length: target.contentEnd - target.offset,
        content: "",
      });
    }
    return Result.succeed(rebuild(text));
  }

  /**
   * Rewrites the header of EVERY matching section to
   * `[newSection]` / `[newSection "newSubsection"]`, leaving the section
   * bodies untouched. Fails typed when none matches.
   *
   * **Example** (Rename a remote while keeping its body)
   *
   * ```ts
   * import { GitConfig } from "@beep/scratchpad/effected/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * import * as Result from "effect/Result";
   * import * as O from "effect/Option";
   * const config = Effect.runSync(GitConfig.parse('[remote "origin"]\nurl = https://example.com/repo.git\n'));
   * const edited = config.renameSection("remote", "origin", "remote", "upstream");
   * if (Result.isSuccess(edited)) {
   *   console.log(O.getOrNull(edited.success.get("remote", "upstream", "url"))); // https://example.com/repo.git
   * }
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  renameSection(
    section: string,
    subsection: string | undefined,
    newSection: string,
    newSubsection: string | undefined,
  ): Result.Result<GitConfig, GitConfigEditError> {
    const invalid = validateAddress("renameSection", newSection, newSubsection, undefined, undefined);
    if (invalid !== undefined) return Result.fail(invalid);
    const raw = reparse(this.text);
    const matches = raw.sections.filter((candidate) => matchesSection(candidate, section, subsection));
    if (matches.length === 0)
      return Result.fail(editError("renameSection", "missingSection", section, subsection, undefined));
    let text = this.text;
    for (const target of matches.toReversed()) {
      text = applySplice(text, {
        offset: target.bracketOffset,
        length: target.bracketLength,
        content: serializeHeader(newSection, newSubsection),
      });
    }
    return Result.succeed(rebuild(text));
  }
}

const editError = (
  op: GitConfigEditError["op"],
  reason: GitConfigEditError["reason"],
  section: string,
  subsection: string | undefined,
  key: string | undefined,
): GitConfigEditError =>
  GitConfigEditError.make({
    op,
    reason,
    section,
    ...O.getSomesStruct({ subsection: O.fromUndefinedOr(subsection) }),
    ...O.getSomesStruct({ key: O.fromUndefinedOr(key) }),
  });

/** Validates the writable parts of an edit's address; returns the typed refusal, or nothing. */
const validateAddress = (
  op: GitConfigEditError["op"],
  section: string,
  subsection: string | undefined,
  key: string | undefined,
  value: string | undefined,
): GitConfigEditError | undefined => {
  // A dot is legal in the header GRAMMAR but never in a writable section
  // NAME: the scanner treats any unquoted dot as the deprecated
  // `[section.subsection]` form and splits at the first dot, so a dotted
  // name written here (`addSection("a.b")` → `[a.b]`) would re-parse as
  // section "a" subsection "b" and never match its own address again.
  if (!isValidSectionName(section) || section.includes(".")) {
    return editError(op, "invalidSectionName", section, subsection, key);
  }
  if (subsection !== undefined && /[\n\r\0]/.test(subsection)) {
    return editError(op, "invalidSubsection", section, subsection, key);
  }
  if (key !== undefined && !isValidKey(key)) return editError(op, "invalidKey", section, subsection, key);
  if (value?.includes("\0") === true) return editError(op, "invalidValue", section, subsection, key);
  return undefined;
};

/** The splice that rewrites an existing entry's value region in place. */
const replaceValueSplice = (text: string, entry: RawEntry, value: string): Splice => {
  const serialized = serializeValue(value);
  if (entry.valueOffset === -1) {
    // Bare boolean-true shorthand: insert ` = value` right after the key.
    return { offset: entry.keyEnd, length: 0, content: ` = ${serialized}` };
  }
  // An empty value region directly followed by a comment needs a separating
  // space, or the inserted value would fuse with the `#`.
  const following = text[entry.valueOffset + entry.valueLength];
  const pad = entry.valueLength === 0 && (following === "#" || following === ";") ? " " : "";
  return {
    offset: entry.valueOffset,
    length: entry.valueLength,
    content: serialized + pad,
  };
};

/** Inserts a new `key = value` line into the last matching section, creating the section at EOF when none matches. */
const insertEntry = (
  text: string,
  matches: ReadonlyArray<RawSection>,
  section: string,
  subsection: string | undefined,
  key: string,
  value: string,
): GitConfig => {
  const target = matches[matches.length - 1];
  if (target === undefined) {
    return rebuild(appendAtEof(text, `${serializeHeader(section, subsection)}\n\t${key} = ${serializeValue(value)}\n`));
  }
  const indent = sectionIndent(text, target);
  const offset = sectionInsertOffset(target);
  const line = `${indent}${key} = ${serializeValue(value)}\n`;
  const content = offset > 0 && text[offset - 1] !== "\n" ? `\n${line}` : line;
  return rebuild(applySplice(text, { offset, length: 0, content }));
};

/**
 * Rebuilds a `GitConfig` from freshly-spliced text. The text came from our
 * own serializer over a clean document, so a scan failure here is a bug in
 * the edit engine and dies as a defect.
 */
const rebuild = (text: string): GitConfig => fromRaw(text, reparse(text));

/** Retains a header-line entry's line ending when removing its entry span. */
const removalSuffix = (text: string, section: RawSection, entry: RawEntry): string => {
  if (entry.offset <= section.bracketOffset || entry.offset >= section.bodyStart) return "";
  const end = entry.offset + entry.length;
  if (text[end - 1] === "\n") return text[end - 2] === "\r" ? "\r\n" : "\n";
  return text[end - 1] === "\r" ? "\r" : "";
};
