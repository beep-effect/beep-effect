/**
 * Lossless git-config documents: parse, query and surgically edit
 * git-config(5) text while preserving every untouched byte.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GitId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  applySplice,
  GitConfigDiagnosticCode,
  isValidKey,
  isValidSectionName,
  matchesKey,
  matchesSection,
  Splice,
  scan,
  sectionIndent,
  sectionInsertOffset,
  serializeHeader,
  serializeValue,
} from "./internal/config.ts";
import type { RawDiagnostic, RawEntry, RawParse, RawSection } from "./internal/config.ts";

const $I = $GitId.create("GitConfig");

/**
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
 * import { GitConfig, GitConfigDiagnostic } from "@beep/git/GitConfig";
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
export class GitConfigDiagnostic extends S.Opaque<GitConfigDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    /** What kind of malformation this is. */
    code: GitConfigDiagnosticCode.pipe(
      $I.annoteKey("GitConfigDiagnostic.code", { description: "What kind of malformation this is." })
    ),
    /** A human-readable description of the problem. */
    message: S.String.pipe(
      $I.annoteKey("GitConfigDiagnostic.message", { description: "A human-readable description of the problem." })
    ),
    /** The character offset where the problem starts. */
    offset: S.Finite.pipe(
      $I.annoteKey("GitConfigDiagnostic.offset", { description: "The character offset where the problem starts." })
    ),
    /** The length of the problematic span. */
    length: S.Finite.pipe(
      $I.annoteKey("GitConfigDiagnostic.length", { description: "The length of the problematic span." })
    ),
    /** Zero-based line of `offset`. */
    line: S.Finite.pipe($I.annoteKey("GitConfigDiagnostic.line", { description: "Zero-based line of `offset`." })),
    /** Zero-based character-in-line of `offset`. */
    character: S.Finite.pipe(
      $I.annoteKey("GitConfigDiagnostic.character", { description: "Zero-based character-in-line of `offset`." })
    ),
  }).pipe(
    $I.annoteSchema("GitConfigDiagnostic", {
      description: "One structural problem found while parsing git-config text.",
    })
  )
) {}

/**
 * **Details**
 *
 * Malformed input always fails through this typed error, never as a defect.
 * `diagnostics` is an array even when only one is populated — the array is
 * the cross-package diagnostic contract.
 *
 * **Example** (Inspect a parse failure)
 *
 * ```ts
 * import { GitConfigParseError } from "@beep/git/GitConfig";
 * const error = GitConfigParseError.make({ input: "[broken", diagnostics: [] });
 * console.log(error.message); // malformed git-config text
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GitConfigParseError extends S.TaggedError<GitConfigParseError, { readonly brand: unique symbol }>(
  $I`GitConfigParseError`
)(
  "GitConfigParseError",
  {
    /** The raw input that failed to parse. */
    input: S.String.pipe(
      $I.annoteKey("GitConfigParseError.input", { description: "The raw input that failed to parse." })
    ),
    /** Every structural problem found, in document order. */
    diagnostics: S.Array(GitConfigDiagnostic).pipe(
      $I.annoteKey("GitConfigParseError.diagnostics", {
        description: "Every structural problem found, in document order.",
      })
    ),
  },
  $I.annoteError<GitConfigParseError>("GitConfigParseError", {
    description: "The document could not be parsed as git-config text.",
  })
) {
  /**
   * Renders the first diagnostic and the total count into a one-line message.
   *
   * **Example** (Render the error message)
   *
   * ```ts
   * import { GitConfigParseError } from "@beep/git/GitConfig";
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

const editErrorAddress = (section: string, subsection: string | undefined): string =>
  subsection === undefined ? `[${section}]` : `[${section} "${subsection}"]`;

const EDIT_ERROR_DETAILS: {
  readonly [Reason in GitConfigEditError["reason"]]: (
    section: string,
    subsection: string | undefined,
    key: string | undefined
  ) => string;
} = {
  missingSection: (section, subsection) => `section ${editErrorAddress(section, subsection)} does not exist`,
  missingKey: (section, subsection, key) =>
    `${key === undefined ? editErrorAddress(section, subsection) : `${editErrorAddress(section, subsection)} ${key}`} does not exist`,
  invalidSectionName: (section) => `invalid section name "${section}"`,
  invalidSubsection: () => "invalid subsection name",
  invalidKey: (_section, _subsection, key) => `invalid variable name "${key ?? ""}"`,
  invalidValue: () => "the value cannot be represented in git-config syntax",
};

/**
 * **Example** (Describe a missing variable)
 *
 * ```ts
 * import { GitConfigEditError } from "@beep/git/GitConfig";
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
export class GitConfigEditError extends S.TaggedError<GitConfigEditError, { readonly brand: unique symbol }>(
  $I`GitConfigEditError`
)(
  "GitConfigEditError",
  {
    /** The edit operation that was refused. */
    op: S.Literals(["set", "append", "unset", "unsetAll", "addSection", "removeSection", "renameSection"]).pipe(
      $I.annoteKey("GitConfigEditError.op", { description: "The edit operation that was refused." })
    ),
    /** Why it was refused. */
    reason: S.Literals([
      "missingSection",
      "missingKey",
      "invalidSectionName",
      "invalidSubsection",
      "invalidKey",
      "invalidValue",
    ]).pipe($I.annoteKey("GitConfigEditError.reason", { description: "Why it was refused." })),
    /** The section name the edit addressed. */
    section: S.String.pipe(
      $I.annoteKey("GitConfigEditError.section", { description: "The section name the edit addressed." })
    ),
    /** The subsection name the edit addressed, when it had one. */
    subsection: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitConfigEditError.subsection", {
        description: "The subsection name the edit addressed, when it had one.",
      })
    ),
    /** The variable name the edit addressed, when it had one. */
    key: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitConfigEditError.key", { description: "The variable name the edit addressed, when it had one." })
    ),
  },
  $I.annoteError<GitConfigEditError>("GitConfigEditError", {
    description: "A surgical edit could not be applied to a GitConfig document.",
  })
) {
  /**
   * Renders the refused operation into a one-line message.
   *
   * **Example** (Render the error message)
   *
   * ```ts
   * import { GitConfigEditError } from "@beep/git/GitConfig";
   * const error = GitConfigEditError.make({ op: "unset", reason: "missingSection", section: "core" });
   * console.log(error.message); // unset: section [core] does not exist
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `${this.op}: ${EDIT_ERROR_DETAILS[this.reason](this.section, this.subsection, this.key)}`;
  }
}

/**
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
 * import { GitConfigEntry } from "@beep/git/GitConfig";
 * const entry = GitConfigEntry.make({ key: "bare", offset: 7, length: 6 });
 * console.log(entry.value === undefined); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitConfigEntry extends S.Opaque<GitConfigEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The variable name, raw spelling preserved (names compare case-insensitively). */
    key: S.String.pipe(
      $I.annoteKey("GitConfigEntry.key", {
        description: "The variable name, raw spelling preserved (names compare case-insensitively).",
      })
    ),
    /** The decoded value; absent for the bare boolean-true shorthand. */
    value: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitConfigEntry.value", {
        description: "The decoded value; absent for the bare boolean-true shorthand.",
      })
    ),
    /** Character offset of the entry span (after `]` for an inline declaration). */
    offset: S.Finite.pipe(
      $I.annoteKey("GitConfigEntry.offset", {
        description: "Character offset of the entry span (after `]` for an inline declaration).",
      })
    ),
    /** Length through the entry's final newline (continuation lines included). */
    length: S.Finite.pipe(
      $I.annoteKey("GitConfigEntry.length", {
        description: "Length through the entry's final newline (continuation lines included).",
      })
    ),
  }).pipe($I.annoteSchema("GitConfigEntry", { description: "One variable line of a git-config document." }))
) {}

/**
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
 * import { GitConfigSection } from "@beep/git/GitConfig";
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
export class GitConfigSection extends S.Opaque<GitConfigSection, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The section name, raw spelling preserved. */
    name: S.String.pipe(
      $I.annoteKey("GitConfigSection.name", { description: "The section name, raw spelling preserved." })
    ),
    /** The decoded subsection name, when present. */
    subsection: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitConfigSection.subsection", { description: "The decoded subsection name, when present." })
    ),
    /** Character offset of the header's line start. */
    offset: S.Finite.pipe(
      $I.annoteKey("GitConfigSection.offset", { description: "Character offset of the header's line start." })
    ),
    /** Length of the whole section span (header through the next header's line start). */
    length: S.Finite.pipe(
      $I.annoteKey("GitConfigSection.length", {
        description: "Length of the whole section span (header through the next header's line start).",
      })
    ),
    /** The section's variable lines, in document order. */
    entries: S.Array(GitConfigEntry).pipe(
      $I.annoteKey("GitConfigSection.entries", { description: "The section's variable lines, in document order." })
    ),
  }).pipe($I.annoteSchema("GitConfigSection", { description: "One section of a git-config document." }))
) {}

/**
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
 * import { GitConfigInclude } from "@beep/git/GitConfig";
 * const include = GitConfigInclude.make({ path: "~/work/config", condition: "gitdir:~/work/" });
 * console.log(include.path); // ~/work/config
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitConfigInclude extends S.Opaque<GitConfigInclude, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The include path exactly as written (not resolved, not expanded). */
    path: S.String.pipe(
      $I.annoteKey("GitConfigInclude.path", {
        description: "The include path exactly as written (not resolved, not expanded).",
      })
    ),
    /** The `includeIf` condition, when this came from an `includeIf` section. */
    condition: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitConfigInclude.condition", {
        description: "The `includeIf` condition, when this came from an `includeIf` section.",
      })
    ),
  }).pipe(
    $I.annoteSchema("GitConfigInclude", { description: "One `include` / `includeIf` directive found in the document." })
  )
) {}

const lineStarts = (text: string): readonly [number, ...Array<number>] => {
  const starts: [number, ...Array<number>] = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
};

const positionOf: {
  (starts: readonly [number, ...Array<number>], offset: number): { readonly line: number; readonly character: number };
  (
    offset: number
  ): (starts: readonly [number, ...Array<number>]) => { readonly line: number; readonly character: number };
} = dual(
  2,
  (
    starts: readonly [number, ...Array<number>],
    offset: number
  ): { readonly line: number; readonly character: number } => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      const start = A.getUnsafe(starts, mid);
      if (start <= offset) low = mid;
      else high = mid - 1;
    }
    return { line: low, character: offset - A.getUnsafe(starts, low) };
  }
);

const toDiagnostic: {
  (raw: RawDiagnostic, starts: readonly [number, ...Array<number>]): GitConfigDiagnostic;
  (starts: readonly [number, ...Array<number>]): (raw: RawDiagnostic) => GitConfigDiagnostic;
} = dual(2, (raw: RawDiagnostic, starts: readonly [number, ...Array<number>]): GitConfigDiagnostic => {
  const { line, character } = positionOf(starts, raw.offset);
  return GitConfigDiagnostic.make({
    code: raw.code,
    message: raw.message,
    offset: raw.offset,
    length: raw.length,
    line,
    character,
  });
});

const fromRaw: {
  (text: string, raw: RawParse): GitConfig;
  (raw: RawParse): (text: string) => GitConfig;
} = dual(
  2,
  (text: string, raw: RawParse): GitConfig =>
    GitConfig.make({
      text,
      sections: A.map(raw.sections, (section) =>
        GitConfigSection.make({
          name: section.name,
          ...O.getSomesStruct({ subsection: O.fromUndefinedOr(section.subsection) }),
          offset: section.offset,
          length: section.contentEnd - section.offset,
          entries: A.map(section.entries, (entry) =>
            GitConfigEntry.make({
              key: entry.key,
              ...O.getSomesStruct({ value: O.fromUndefinedOr(entry.value) }),
              offset: entry.offset,
              length: entry.length,
            })
          ),
        })
      ),
    })
);

class GitConfigInvariantError extends S.TaggedError<GitConfigInvariantError, { readonly brand: unique symbol }>(
  $I`GitConfigInvariantError`
)(
  "GitConfigInvariantError",
  {
    message: S.String.pipe(
      $I.annoteKey("GitConfigInvariantError.message", { description: "The violated document invariant." })
    ),
  },
  $I.annoteError<GitConfigInvariantError>("GitConfigInvariantError", {
    description: "A GitConfig document contains text that does not scan cleanly.",
  })
) {}

const reparse = (text: string): RawParse => {
  const raw = scan(text);
  if (raw.diagnostics.length > 0) {
    throw GitConfigInvariantError.make({
      message:
        "GitConfig invariant violated: the document text does not scan cleanly. Construct GitConfig via GitConfig.parse / parseResult, never by hand from arbitrary text.",
    });
  }
  return raw;
};

const sectionsMatching = (text: string, section: string, subsection: string | undefined): ReadonlyArray<RawSection> =>
  A.filter(reparse(text).sections, matchesSection(section, subsection));

const lastMatchingEntry: {
  (
    sections: ReadonlyArray<RawSection>,
    key: string
  ): { readonly section: RawSection; readonly entry: RawEntry } | undefined;
  (
    key: string
  ): (sections: ReadonlyArray<RawSection>) => { readonly section: RawSection; readonly entry: RawEntry } | undefined;
} = dual(
  2,
  (
    sections: ReadonlyArray<RawSection>,
    key: string
  ): { readonly section: RawSection; readonly entry: RawEntry } | undefined => {
    let found:
      | {
          readonly section: RawSection;
          readonly entry: RawEntry;
        }
      | undefined;
    for (const section of sections) {
      for (const entry of section.entries) {
        if (matchesKey(entry, key)) found = { section, entry };
      }
    }
    return found;
  }
);

const trailingBackslashes = (text: string, offset: number): number => {
  let slashStart = offset;
  while (text[slashStart - 1] === "\\") slashStart -= 1;
  return offset - slashStart;
};

const valueEndSeparator = (text: string, offset: number, separator: string): string => {
  const spanConsumedContinuation = text[offset - 1] === "\n";
  if (spanConsumedContinuation) return text[offset - 2] === "\r" ? "\r\n" : "\n";
  const finalBackslashOpen = trailingBackslashes(text, offset) % 2 === 1;
  return finalBackslashOpen ? `${separator}\n` : separator;
};

const isIncludeSection = (section: RawSection): boolean => {
  const name = Str.toLowerCase(section.name);
  return name === "include"
    ? section.subsection === undefined
    : name === "includeif" && section.subsection !== undefined;
};

const sectionIncludes = (section: RawSection): Array<GitConfigInclude> =>
  A.filterMap(section.entries, (entry) =>
    matchesKey(entry, "path") && entry.value !== undefined
      ? Result.succeed(
          GitConfigInclude.make({
            path: entry.value,
            ...O.getSomesStruct({ condition: O.fromUndefinedOr(section.subsection) }),
          })
        )
      : Result.failVoid
  );

const sectionValues = (section: RawSection, key: string): Array<string> =>
  A.filterMap(section.entries, (entry) =>
    matchesKey(entry, key) ? Result.succeed(entry.value ?? "true") : Result.failVoid
  );

const keyRemovalSplices = (text: string, sections: ReadonlyArray<RawSection>, key: string): Array<Splice> =>
  A.flatMap(sections, (candidate) =>
    A.filterMap(candidate.entries, (entry) =>
      matchesKey(entry, key)
        ? Result.succeed(
            Splice.make({ offset: entry.offset, length: entry.length, content: removalSuffix(text, candidate, entry) })
          )
        : Result.failVoid
    )
  );

const insertionSeparator: {
  (text: string, offset: number, entry: RawEntry | undefined): string;
  (offset: number, entry: RawEntry | undefined): (text: string) => string;
} = dual(3, (text: string, offset: number, entry: RawEntry | undefined): string => {
  const separator = offset > 0 && text[offset - 1] !== "\n" ? "\n" : "";
  if (entry === undefined || entry.valueOffset + entry.valueLength !== offset) return separator;
  return valueEndSeparator(text, offset, separator);
});

const appendAtEof: {
  (text: string, content: string): string;
  (content: string): (text: string) => string;
} = dual(2, (text: string, content: string): string => {
  const sections = reparse(text).sections;
  const section = sections[sections.length - 1];
  const entry = section?.entries[section.entries.length - 1];
  return text + insertionSeparator(text, text.length, entry) + content;
});

/**
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
 * import { GitConfig } from "@beep/git/GitConfig";
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
export class GitConfig extends S.Class<GitConfig, { readonly brand: unique symbol }>($I`GitConfig`)(
  {
    /** The document's source text — `stringify` returns exactly this. */
    text: S.String.pipe(
      $I.annoteKey("GitConfig.text", { description: "The document's source text — `stringify` returns exactly this." })
    ),
    /** The sections scanned from `text`, in document order. */
    sections: S.Array(GitConfigSection).pipe(
      $I.annoteKey("GitConfig.sections", { description: "The sections scanned from `text`, in document order." })
    ),
  },
  $I.annote("GitConfig", {
    description: "A lossless git-config document: the source text plus the structural index scanned from it.",
  })
) {
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
   * import { GitConfig } from "@beep/git/GitConfig";
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
          diagnostics: A.map(raw.diagnostics, toDiagnostic(starts)),
        })
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
   * import { GitConfig } from "@beep/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * const config = Effect.runSync(GitConfig.parse("[core]\n\tbare\n"));
   * console.log(config.sections.length); // 1
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly parse = Effect.fn("GitConfig.parse")((text: string) =>
    Effect.fromResult(GitConfig.parseResult(text))
  );

  /**
   * The document's source text, byte-for-byte — identity for an unmodified document.
   *
   * **Example** (Round-trip comments and formatting)
   *
   * ```ts
   * import { GitConfig } from "@beep/git/GitConfig";
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
   * import { GitConfig } from "@beep/git/GitConfig";
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
   * import { GitConfig } from "@beep/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * const config = Effect.runSync(GitConfig.parse("[core]\neditor = vim\neditor = nano\n"));
   * console.log(JSON.stringify(config.getAll("core", undefined, "editor"))); // ["vim","nano"]
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  getAll(section: string, subsection: string | undefined, key: string): ReadonlyArray<string> {
    return A.flatMap(sectionsMatching(this.text, section, subsection), (candidate) => sectionValues(candidate, key));
  }

  /**
   * Every `include` / `includeIf` directive in the document — surfaced, never resolved.
   *
   * **Example** (Inspect a conditional include)
   *
   * ```ts
   * import { GitConfig } from "@beep/git/GitConfig";
   * import * as Effect from "effect/Effect";
   * const config = Effect.runSync(GitConfig.parse('[includeIf "gitdir:~/work/"]\npath = ~/work/config\n'));
   * console.log(config.includes()[0]?.condition); // gitdir:~/work/
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  includes(): ReadonlyArray<GitConfigInclude> {
    return A.flatMap(A.filter(reparse(this.text).sections, isIncludeSection), sectionIncludes);
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
   * import { GitConfig } from "@beep/git/GitConfig";
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
    value: string
  ): Result.Result<GitConfig, GitConfigEditError> {
    return editLastEntry("set", this.text, section, subsection, key, value, (found) => {
      const splice = replaceValueSplice(this.text, found.entry, value);
      return rebuild(applySplice(this.text, splice));
    });
  }

  /**
   * Appends a NEW `key = value` line (multi-valued append) — after the last
   * occurrence of `key` when one exists, at the end of the last matching
   * section otherwise, creating the section when none matches.
   *
   * **Example** (Append a second value)
   *
   * ```ts
   * import { GitConfig } from "@beep/git/GitConfig";
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
    value: string
  ): Result.Result<GitConfig, GitConfigEditError> {
    return editLastEntry("append", this.text, section, subsection, key, value, (found) => {
      const indent = sectionIndent(this.text, found.section);
      const offset = found.entry.offset + found.entry.length;
      const line = `${indent}${key} = ${serializeValue(value)}\n`;
      const content = insertionSeparator(this.text, offset, found.entry) + line;
      return rebuild(applySplice(this.text, Splice.make({ offset, length: 0, content })));
    });
  }

  /**
   * Removes the LAST occurrence of `key` in matching sections; fails typed when it does not exist.
   *
   * **Example** (Remove only the last value)
   *
   * ```ts
   * import { GitConfig } from "@beep/git/GitConfig";
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
    const matches = sectionsMatching(this.text, section, subsection);
    if (matches.length === 0) return Result.fail(editError("unset", "missingSection", section, subsection, key));
    const found = lastMatchingEntry(matches, key);
    if (found === undefined) return Result.fail(editError("unset", "missingKey", section, subsection, key));
    return Result.succeed(
      rebuild(
        applySplice(
          this.text,
          Splice.make({
            offset: found.entry.offset,
            length: found.entry.length,
            content: removalSuffix(this.text, found.section, found.entry),
          })
        )
      )
    );
  }

  /**
   * Removes EVERY occurrence of `key` in matching sections; fails typed when none exists.
   *
   * **Example** (Remove every value of a variable)
   *
   * ```ts
   * import { GitConfig } from "@beep/git/GitConfig";
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
    const matches = sectionsMatching(this.text, section, subsection);
    if (matches.length === 0) return Result.fail(editError("unsetAll", "missingSection", section, subsection, key));
    const targets = keyRemovalSplices(this.text, matches, key);
    if (targets.length === 0) return Result.fail(editError("unsetAll", "missingKey", section, subsection, key));
    return Result.succeed(
      rebuild(A.reduce(A.reverse(targets), this.text, (text, splice) => applySplice(text, splice)))
    );
  }

  /**
   * Appends a new empty `[section]` / `[section "subsection"]` at the end of the document.
   *
   * **Example** (Add an empty remote section)
   *
   * ```ts
   * import { GitConfig } from "@beep/git/GitConfig";
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
   * import { GitConfig } from "@beep/git/GitConfig";
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
    const matches = sectionsMatching(this.text, section, subsection);
    if (matches.length === 0)
      return Result.fail(editError("removeSection", "missingSection", section, subsection, undefined));
    let text = this.text;
    for (const target of A.reverse(matches)) {
      text = applySplice(
        text,
        Splice.make({
          offset: target.offset,
          length: target.contentEnd - target.offset,
          content: "",
        })
      );
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
   * import { GitConfig } from "@beep/git/GitConfig";
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
    newSubsection: string | undefined
  ): Result.Result<GitConfig, GitConfigEditError> {
    const invalid = validateAddress("renameSection", newSection, newSubsection, undefined, undefined);
    if (invalid !== undefined) return Result.fail(invalid);
    const matches = sectionsMatching(this.text, section, subsection);
    if (matches.length === 0)
      return Result.fail(editError("renameSection", "missingSection", section, subsection, undefined));
    let text = this.text;
    for (const target of A.reverse(matches)) {
      text = applySplice(
        text,
        Splice.make({
          offset: target.bracketOffset,
          length: target.bracketLength,
          content: serializeHeader(newSection, newSubsection),
        })
      );
    }
    return Result.succeed(rebuild(text));
  }
}

const editError: {
  (
    op: GitConfigEditError["op"],
    reason: GitConfigEditError["reason"],
    section: string,
    subsection: string | undefined,
    key: string | undefined
  ): GitConfigEditError;
  (
    reason: GitConfigEditError["reason"],
    section: string,
    subsection: string | undefined,
    key: string | undefined
  ): (op: GitConfigEditError["op"]) => GitConfigEditError;
} = dual(
  5,
  (
    op: GitConfigEditError["op"],
    reason: GitConfigEditError["reason"],
    section: string,
    subsection: string | undefined,
    key: string | undefined
  ): GitConfigEditError =>
    GitConfigEditError.make({
      op,
      reason,
      section,
      ...O.getSomesStruct({ subsection: O.fromUndefinedOr(subsection) }),
      ...O.getSomesStruct({ key: O.fromUndefinedOr(key) }),
    })
);

const validateAddress: {
  (
    op: GitConfigEditError["op"],
    section: string,
    subsection: string | undefined,
    key: string | undefined,
    value: string | undefined
  ): GitConfigEditError | undefined;
  (
    section: string,
    subsection: string | undefined,
    key: string | undefined,
    value: string | undefined
  ): (op: GitConfigEditError["op"]) => GitConfigEditError | undefined;
} = dual(
  5,
  (
    op: GitConfigEditError["op"],
    section: string,
    subsection: string | undefined,
    key: string | undefined,
    value: string | undefined
  ): GitConfigEditError | undefined => {
    if (!isValidSectionName(section) || Str.includes(".")(section)) {
      return editError(op, "invalidSectionName", section, subsection, key);
    }
    if (subsection !== undefined && /[\n\r\0]/.test(subsection)) {
      return editError(op, "invalidSubsection", section, subsection, key);
    }
    if (key !== undefined && !isValidKey(key)) return editError(op, "invalidKey", section, subsection, key);
    if (value !== undefined && Str.includes("\0")(value))
      return editError(op, "invalidValue", section, subsection, key);
    return undefined;
  }
);

const replaceValueSplice: {
  (text: string, entry: RawEntry, value: string): Splice;
  (entry: RawEntry, value: string): (text: string) => Splice;
} = dual(3, (text: string, entry: RawEntry, value: string): Splice => {
  const serialized = serializeValue(value);
  const isBareShorthand = entry.valueOffset === -1;
  if (isBareShorthand) {
    return Splice.make({ offset: entry.keyEnd, length: 0, content: ` = ${serialized}` });
  }
  const following = text[entry.valueOffset + entry.valueLength];
  const commentSeparatingPad = entry.valueLength === 0 && (following === "#" || following === ";") ? " " : "";
  return Splice.make({
    offset: entry.valueOffset,
    length: entry.valueLength,
    content: serialized + commentSeparatingPad,
  });
});

const editLastEntry = (
  op: GitConfigEditError["op"],
  text: string,
  section: string,
  subsection: string | undefined,
  key: string,
  value: string,
  onFound: (found: { readonly section: RawSection; readonly entry: RawEntry }) => GitConfig
): Result.Result<GitConfig, GitConfigEditError> => {
  const invalid = validateAddress(op, section, subsection, key, value);
  if (invalid !== undefined) return Result.fail(invalid);
  const matches = sectionsMatching(text, section, subsection);
  const found = lastMatchingEntry(matches, key);
  return Result.succeed(
    found === undefined ? insertEntry(text, matches, section, subsection, key, value) : onFound(found)
  );
};

const insertEntry: {
  (
    text: string,
    matches: ReadonlyArray<RawSection>,
    section: string,
    subsection: string | undefined,
    key: string,
    value: string
  ): GitConfig;
  (
    matches: ReadonlyArray<RawSection>,
    section: string,
    subsection: string | undefined,
    key: string,
    value: string
  ): (text: string) => GitConfig;
} = dual(
  6,
  (
    text: string,
    matches: ReadonlyArray<RawSection>,
    section: string,
    subsection: string | undefined,
    key: string,
    value: string
  ): GitConfig => {
    const target = matches[matches.length - 1];
    if (target === undefined) {
      return rebuild(
        appendAtEof(text, `${serializeHeader(section, subsection)}\n\t${key} = ${serializeValue(value)}\n`)
      );
    }
    const indent = sectionIndent(text, target);
    const offset = sectionInsertOffset(target);
    const line = `${indent}${key} = ${serializeValue(value)}\n`;
    const content = insertionSeparator(text, offset, target.entries[target.entries.length - 1]) + line;
    return rebuild(applySplice(text, Splice.make({ offset, length: 0, content })));
  }
);

const rebuild = (text: string): GitConfig => fromRaw(text, reparse(text));

const removalSuffix: {
  (text: string, section: RawSection, entry: RawEntry): string;
  (section: RawSection, entry: RawEntry): (text: string) => string;
} = dual(3, (text: string, section: RawSection, entry: RawEntry): string => {
  if (entry.offset <= section.bracketOffset || entry.offset >= section.bodyStart) return "";
  const end = entry.offset + entry.length;
  if (text[end - 1] === "\n") return text[end - 2] === "\r" ? "\r\n" : "\n";
  return text[end - 1] === "\r" ? "\r" : "";
});
