import { Effect, Option, Result, Schema } from "effect";
import type {
  RawDiagnostic,
  RawEntry,
  RawParse,
  RawSection,
  Splice,
} from "./internal/config.ts";
import {
  applySplice,
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

/**
 * One structural problem found while parsing git-config text.
 *
 * @remarks
 * Carries the kit's shared diagnostic core: a `code` from the
 * `GitConfigErrorCode` union, a human `message`, the character
 * `offset`/`length` span, and the zero-based `line`/`character` position
 * derived from the offset.
 *
 * @public
 */
export class GitConfigDiagnostic extends Schema.Class<GitConfigDiagnostic>("GitConfigDiagnostic")({
  /** What kind of malformation this is. */
  code: Schema.Literals([
    "invalidSectionHeader",
    "invalidKey",
    "invalidLine",
    "unterminatedQuote",
    "invalidEscape",
    "unexpectedCharacter",
  ]),
  /** A human-readable description of the problem. */
  message: Schema.String,
  /** The character offset where the problem starts. */
  offset: Schema.Finite,
  /** The length of the problematic span. */
  length: Schema.Finite,
  /** Zero-based line of `offset`. */
  line: Schema.Finite,
  /** Zero-based character-in-line of `offset`. */
  character: Schema.Finite,
}) {
}

/**
 * The document could not be parsed as git-config text.
 *
 * @remarks
 * Malformed input always fails through this typed error, never as a defect.
 * `diagnostics` is an array even when only one is populated — the array is
 * the cross-package diagnostic contract.
 *
 * @public
 */
export class GitConfigParseError extends Schema.TaggedError<GitConfigParseError>()("GitConfigParseError", {
  /** The raw input that failed to parse. */
  input: Schema.String,
  /** Every structural problem found, in document order. */
  diagnostics: Schema.Array(GitConfigDiagnostic),
}) {
  /** Renders the first diagnostic and the total count into a one-line message. */
  override get message(): string {
    const first = this.diagnostics[0];
    const head = first === undefined ? "malformed git-config text" : `${first.message} (line ${first.line + 1})`;
    return this.diagnostics.length > 1 ? `${head} — and ${this.diagnostics.length - 1} more` : head;
  }
}

/**
 * A surgical edit could not be applied to a {@link GitConfig} document.
 *
 * @public
 */
export class GitConfigEditError extends Schema.TaggedError<GitConfigEditError>()("GitConfigEditError", {
  /** The edit operation that was refused. */
  op: Schema.Literals(["set", "append", "unset", "unsetAll", "addSection", "removeSection", "renameSection"]),
  /** Why it was refused. */
  reason: Schema.Literals([
    "missingSection",
    "missingKey",
    "invalidSectionName",
    "invalidSubsection",
    "invalidKey",
    "invalidValue",
  ]),
  /** The section name the edit addressed. */
  section: Schema.String,
  /** The subsection name the edit addressed, when it had one. */
  subsection: Schema.optionalKey(Schema.String),
  /** The variable name the edit addressed, when it had one. */
  key: Schema.optionalKey(Schema.String),
}) {
  /** Renders the refused operation into a one-line message. */
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
 * @remarks
 * `value` is the DECODED value (quotes removed, escapes resolved, unquoted
 * trailing whitespace discarded). An absent `value` is git's bare-`key`
 * boolean-true shorthand — the distinction is preserved here even though the
 * lookup methods on {@link GitConfig} decode it as `"true"`.
 *
 * @public
 */
export class GitConfigEntry extends Schema.Class<GitConfigEntry>("GitConfigEntry")({
  /** The variable name, raw spelling preserved (names compare case-insensitively). */
  key: Schema.String,
  /** The decoded value; absent for the bare boolean-true shorthand. */
  value: Schema.optionalKey(Schema.String),
  /** Character offset of the entry's line start. */
  offset: Schema.Finite,
  /** Length through the entry's final newline (continuation lines included). */
  length: Schema.Finite,
}) {
}

/**
 * One section of a git-config document.
 *
 * @remarks
 * `name` preserves the raw spelling (section names compare
 * case-insensitively); `subsection` is the decoded subsection name, which
 * compares case-SENSITIVELY for the quoted form and case-insensitively for
 * the deprecated `[section.subsection]` dotted form. The span runs from the
 * header's line start to the next section header (or the end of the text),
 * so trailing comments and blank lines belong to the section above them.
 *
 * @public
 */
export class GitConfigSection extends Schema.Class<GitConfigSection>("GitConfigSection")({
  /** The section name, raw spelling preserved. */
  name: Schema.String,
  /** The decoded subsection name, when present. */
  subsection: Schema.optionalKey(Schema.String),
  /** Character offset of the header's line start. */
  offset: Schema.Finite,
  /** Length of the whole section span (header through the next header's line start). */
  length: Schema.Finite,
  /** The section's variable lines, in document order. */
  entries: Schema.Array(GitConfigEntry),
}) {
}

/**
 * One `include` / `includeIf` directive found in the document.
 *
 * @remarks
 * Recognized and surfaced, deliberately NOT resolved — following an include
 * means filesystem IO and condition evaluation, which a pure document model
 * must not do. `condition` is the `includeIf` condition (e.g.
 * `gitdir:~/work/`); it is absent for a plain `include`.
 *
 * @public
 */
export class GitConfigInclude extends Schema.Class<GitConfigInclude>("GitConfigInclude")({
  /** The include path exactly as written (not resolved, not expanded). */
  path: Schema.String,
  /** The `includeIf` condition, when this came from an `includeIf` section. */
  condition: Schema.optionalKey(Schema.String),
}) {
}

/** The offset of every line start in `text`, ascending — computed once per parse so mapping many diagnostics stays linear. */
const lineStarts = (text: string): ReadonlyArray<number> => {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
};

/** Computes the zero-based line/character of `offset` against a precomputed line index (binary search). */
const positionOf = (
  starts: ReadonlyArray<number>,
  offset: number,
): { readonly line: number; readonly character: number } => {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if ((starts[mid] as number) <= offset) low = mid;
    else high = mid - 1;
  }
  return { line: low, character: offset - (starts[low] as number) };
};

const toDiagnostic = (starts: ReadonlyArray<number>, raw: RawDiagnostic): GitConfigDiagnostic => {
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
        ...(section.subsection !== undefined ? { subsection: section.subsection } : {}),
        offset: section.offset,
        length: section.contentEnd - section.offset,
        entries: section.entries.map((entry) =>
          GitConfigEntry.make({
            key: entry.key,
            ...(entry.value !== undefined ? { value: entry.value } : {}),
            offset: entry.offset,
            length: entry.length,
          }),
        ),
      }),
    ),
  });

/**
 * Re-scans a document's text, which must be clean: `GitConfig` instances are
 * only ever built from text that scanned without diagnostics, so a failure
 * here is a wiring bug (a hand-built `GitConfig.make({ text, ... })` with
 * text that never parsed) and dies as a defect rather than failing typed.
 */
const reparse = (text: string): RawParse => {
  const raw = scan(text);
  if (raw.diagnostics.length > 0) {
    throw new Error(
      "GitConfig invariant violated: the document text does not scan cleanly. Construct GitConfig via GitConfig.parse / parseResult, never by hand from arbitrary text.",
    );
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
 * @remarks
 * The model is text-first: `stringify` returns the stored text, so an
 * unmodified document round-trips **byte-for-byte** — comments, blank lines,
 * indentation, quoting and key spelling all survive untouched. Every edit
 * operation computes a minimal text splice, applies it, and re-parses, so
 * edited documents preserve all formatting outside the edited span (this is
 * what lets `.gitmodules` edits survive in git's own formatting).
 *
 * Semantics are git-config's, not generic INI: section and variable names
 * compare case-insensitively, quoted subsection names case-sensitively (the
 * deprecated `[a.b]` dotted form case-insensitively), keys may be
 * multi-valued (`getAll`/`append`), a bare `key` line is boolean true, and
 * `include`/`includeIf` directives are surfaced by {@link GitConfig.includes}
 * but never resolved.
 *
 * Instances are immutable by discipline — every edit returns a NEW
 * `GitConfig`. Construct via `parse`/`parseResult`; a hand-built
 * `GitConfig.make` over text that does not scan cleanly dies as a defect at
 * the first operation (bad wiring, not bad input).
 *
 * @example
 * ```ts
 * import { GitConfig } from "./index.ts";
 * import { Effect, Option, Result } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* GitConfig.parse('[remote "origin"]\n\turl = git@example.com:o/r.git\n');
 *   const url = config.get("remote", "origin", "url"); // Option.some("git@example.com:o/r.git")
 *   const edited = config.set("remote", "origin", "pushurl", "git@example.com:o/fork.git");
 *   return { url: Option.getOrNull(url), text: Result.isSuccess(edited) ? edited.success.stringify() : config.text };
 * });
 * ```
 *
 * @public
 */
export class GitConfig extends Schema.Class<GitConfig>("GitConfig")({
  /** The document's source text — `stringify` returns exactly this. */
  text: Schema.String,
  /** The sections scanned from `text`, in document order. */
  sections: Schema.Array(GitConfigSection),
}) {
  /**
   * Parses git-config text into a lossless document — the pure, synchronous
   * primitive.
   *
   * @remarks
   * Malformed input fails typed with every diagnostic found, never as a
   * defect. Effect consumers want {@link GitConfig.parse}, which is defined
   * in terms of this behind its named span.
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
   * @remarks
   * Defined in terms of {@link GitConfig.parseResult} — synchronous callers
   * can use that variant directly.
   */
  static readonly parse = Effect.fn("GitConfig.parse")((text: string) =>
    Effect.fromResult(GitConfig.parseResult(text)),
  );

  /** The document's source text, byte-for-byte — identity for an unmodified document. */
  stringify(): string {
    return this.text;
  }

  /**
   * The effective value of `key` in `[section]` / `[section "subsection"]`,
   * last occurrence wins (git's read semantics across duplicate sections).
   *
   * @remarks
   * A bare `key` line decodes as `"true"` here, matching git's boolean
   * semantics for a value-less variable; the entry model
   * (`GitConfigEntry.value`) preserves the distinction.
   */
  get(section: string, subsection: string | undefined, key: string): Option.Option<string> {
    const values = this.getAll(section, subsection, key);
    const last = values[values.length - 1];
    return last === undefined ? Option.none() : Option.some(last);
  }

  /** Every value of `key` in matching sections, in document order (multi-valued keys). */
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

  /** Every `include` / `includeIf` directive in the document — surfaced, never resolved. */
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
            ...(section.subsection !== undefined ? { condition: section.subsection } : {}),
          }),
        );
      }
    }
    return directives;
  }

  /**
   * Sets `key` to `value`: replaces the LAST occurrence's value in place
   * (preserving the line's formatting and any trailing comment), appends a
   * new line to the last matching section when the key is absent, and
   * creates the section at the end of the document when none matches.
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

  /** Removes the LAST occurrence of `key` in matching sections; fails typed when it does not exist. */
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
        content: "",
      })),
    );
  }

  /** Removes EVERY occurrence of `key` in matching sections; fails typed when none exists. */
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
          content: "",
        });
      }
    }
    if (targets.length === 0) return Result.fail(editError("unsetAll", "missingKey", section, subsection, key));
    let text = this.text;
    for (const splice of targets.toReversed()) text = applySplice(text, splice);
    return Result.succeed(rebuild(text));
  }

  /** Appends a new empty `[section]` / `[section "subsection"]` at the end of the document. */
  addSection(section: string, subsection: string | undefined): Result.Result<GitConfig, GitConfigEditError> {
    const invalid = validateAddress("addSection", section, subsection, undefined, undefined);
    if (invalid !== undefined) return Result.fail(invalid);
    return Result.succeed(rebuild(appendAtEof(this.text, `${serializeHeader(section, subsection)}\n`)));
  }

  /**
   * Removes EVERY matching section — header, entries, and the comments and
   * blank lines inside its span (which runs to the next header). Fails typed
   * when none matches.
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
    ...(subsection !== undefined ? { subsection } : {}),
    ...(key !== undefined ? { key } : {}),
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
