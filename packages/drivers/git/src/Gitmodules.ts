/**
 * Typed `.gitmodules` documents: decode submodule entries from git-config
 * text and edit them without disturbing the rest of the file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, identity, pipe } from "effect/Function";
import * as Iterable from "effect/Iterable";
import * as MutableHashMap from "effect/MutableHashMap";
import * as N from "effect/Number";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { GitConfig } from "./GitConfig.ts";
import { serializeHeader, serializeValue } from "./internal/config.ts";
import type { GitConfigEditError, GitConfigParseError } from "./GitConfig.ts";

const $I = $GitId.create("Gitmodules");

const isGitConfig = S.is(GitConfig);
const DiagnosticJsonString = S.fromJsonString(S.String).pipe(
  $I.annoteSchema("DiagnosticJsonString", { description: "JSON quoting for synchronous submodule field diagnostics." })
);
const encodeDiagnosticJsonString = S.encodeResult(DiagnosticJsonString);

const GitmodulesValue = S.String.check(S.isPattern(/^[^\0]*$/u)).pipe(
  $I.annoteSchema("GitmodulesValue", { description: "A NUL-free git-config field value." })
);

const SubmoduleIgnore = LiteralKit(["all", "dirty", "untracked", "none"]).pipe(
  $I.annoteSchema("SubmoduleIgnore", { description: "Git's case-folded submodule status-ignore policies." })
);
const isSubmoduleIgnore = S.is(SubmoduleIgnore);

const GitIntegerText = S.String.check(
  S.isPattern(/^[ \t\n\r\v\f]*[+-]?(?:0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)[kKmMgG]?$/)
).pipe(
  $I.annoteSchema("GitIntegerText", {
    description: "A signed decimal, octal or hexadecimal Git integer, optionally suffixed by k, m or g.",
  })
);
const isGitIntegerText = S.is(GitIntegerText);

const GIT_TRUE_WORDS = ["true", "yes", "on"];
const GIT_FALSE_WORDS = ["", "false", "no", "off"];
const GIT_INTEGER_MULTIPLIERS: Readonly<Record<string, number>> = { k: 1024, m: 1048576, g: 1073741824 };

const gitIntegerValue = (value: string): number => {
  const trimmed = Str.trimStart(Str.toLowerCase(value));
  const integer = Str.replace(/^[+-]/, "")(trimmed);
  const multiplier = GIT_INTEGER_MULTIPLIERS[integer[integer.length - 1] ?? ""] ?? 1;
  const digits = multiplier === 1 ? integer : Str.slice(0, -1)(integer);
  const normalized = /^0[0-7]+$/.test(digits) ? `0o${digits}` : digits;
  return N.Number(normalized) * multiplier * (Str.startsWith("-")(trimmed) ? -1 : 1);
};

const isOutsideInt32 = (value: number): boolean => value < -2147483648 || value > 2147483647;

const invalidGitBoolean = (value: string): Effect.Effect<boolean, SchemaIssue.Issue> =>
  Effect.fail(
    new SchemaIssue.InvalidValue({ message: "Expected a Git boolean or a signed 32-bit Git integer" }, value)
  );

const decodeGitIntegerBoolean = (value: string): Effect.Effect<boolean, SchemaIssue.Issue> => {
  if (!isGitIntegerText(value)) return invalidGitBoolean(value);
  const signed = gitIntegerValue(value);
  return isOutsideInt32(signed) ? invalidGitBoolean(value) : Effect.succeed(signed !== 0);
};

const GitBoolean = S.UndefinedOr(S.String).pipe(
  S.decodeTo(S.Boolean, {
    decode: SchemaGetter.transformEffect(
      Effect.fn("GitBoolean.decode")((value: string | undefined): Effect.Effect<boolean, SchemaIssue.Issue> => {
        if (value === undefined) return Effect.succeed(true);
        const folded = Str.toLowerCase(value);
        if (A.contains(GIT_TRUE_WORDS, folded)) return Effect.succeed(true);
        if (A.contains(GIT_FALSE_WORDS, folded)) return Effect.succeed(false);
        return decodeGitIntegerBoolean(value);
      })
    ),
    encode: SchemaGetter.forbiddenEncoding,
  }),
  $I.annoteSchema("GitBoolean", { description: "Git boolean words, integer spellings and bare-key semantics." })
);
const decodeGitBoolean = S.decodeUnknownOption(GitBoolean);

/**
 * **Example** (Construct a submodule entry)
 *
 * ```ts
 * import { GitmodulesEntry } from "@beep/git/Gitmodules"
 *
 * const entry = GitmodulesEntry.make({ name: "lib", path: "vendor/lib", url: "../lib.git" })
 * console.log(entry.path) // vendor/lib
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitmodulesEntry extends S.Opaque<GitmodulesEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The submodule's logical name — the section's subsection, case-sensitive.
     *
     * **Gotchas**
     *
     * Constrained to exclude newline, carriage return and NUL: `render` quotes
     * and escapes header names for `"` and `\` only (git's subsection grammar
     * has no newline escape), so an unconstrained name could serialize a
     * document that does not re-parse to the same entries. The parse side can
     * never produce such a name — the scanner refuses a header broken across
     * lines — so the check bites only on hand-built entries, matching
     * `GitConfig.addSection`'s refusal of `[\n\r\0]` subsections.
     */
    name: S.String.check(S.isPattern(/^[^\n\r\0]*$/u)).pipe(
      $I.annoteKey("GitmodulesEntry.name", {
        description: "The submodule's logical name — the section's subsection, case-sensitive.",
      })
    ),
    /** The submodule's path relative to the superproject root (`submodule.<name>.path`). */
    path: GitmodulesValue.pipe(
      $I.annoteKey("GitmodulesEntry.path", {
        description: "The submodule's path relative to the superproject root (`submodule.<name>.path`).",
      })
    ),
    /** The submodule's remote URL (`submodule.<name>.url`). */
    url: GitmodulesValue.pipe(
      $I.annoteKey("GitmodulesEntry.url", { description: "The submodule's remote URL (`submodule.<name>.url`)." })
    ),
    /** The branch the submodule tracks (`submodule.<name>.branch`), when recorded. */
    branch: S.optionalKey(GitmodulesValue).pipe(
      $I.annoteKey("GitmodulesEntry.branch", {
        description: "The branch the submodule tracks (`submodule.<name>.branch`), when recorded.",
      })
    ),
    /** Whether the submodule clones shallow (`submodule.<name>.shallow`), when recorded. */
    shallow: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("GitmodulesEntry.shallow", {
        description: "Whether the submodule clones shallow (`submodule.<name>.shallow`), when recorded.",
      })
    ),
    /**
     * The update strategy (`submodule.<name>.update`), when recorded. Kept as a
     * raw string deliberately: beyond `checkout`/`rebase`/`merge`/`none` git
     * accepts arbitrary `!command` values, so a literal union would reject
     * valid documents.
     */
    update: S.optionalKey(GitmodulesValue).pipe(
      $I.annoteKey("GitmodulesEntry.update", {
        description:
          "The update strategy (`submodule.<name>.update`), when recorded. Kept as a raw string deliberately: beyond `checkout`/`rebase`/`merge`/`none` git accepts arbitrary `!command` values, so a literal union would reject valid documents.",
      })
    ),
    /** The status-ignore policy (`submodule.<name>.ignore`), when recorded. */
    ignore: S.optionalKey(SubmoduleIgnore).pipe(
      $I.annoteKey("GitmodulesEntry.ignore", {
        description: "The status-ignore policy (`submodule.<name>.ignore`), when recorded.",
      })
    ),
    /** Whether fetch recurses into the submodule (`submodule.<name>.fetchRecurseSubmodules`), when recorded. */
    fetchRecurseSubmodules: S.optionalKey(S.Union([S.Boolean, S.Literal("on-demand")])).pipe(
      $I.annoteKey("GitmodulesEntry.fetchRecurseSubmodules", {
        description:
          "Whether fetch recurses into the submodule (`submodule.<name>.fetchRecurseSubmodules`), when recorded.",
      })
    ),
  }).pipe(
    $I.annoteSchema("GitmodulesEntry", {
      description: 'One `[submodule "<name>"]` entry of a `.gitmodules` document, decoded into typed fields.',
    })
  )
) {}

/**
 * **Example** (Describe a missing submodule path)
 *
 * ```ts
 * import { GitmodulesDecodeError } from "@beep/git/Gitmodules"
 *
 * const error = GitmodulesDecodeError.make({ submodule: "lib", reason: "missingPath" })
 * console.log(error.message) // submodule "lib" has no path
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GitmodulesDecodeError extends S.TaggedError<GitmodulesDecodeError, { readonly brand: unique symbol }>(
  $I`GitmodulesDecodeError`
)(
  "GitmodulesDecodeError",
  {
    /** The submodule name (the section's subsection) that failed to decode. */
    submodule: S.String.pipe(
      $I.annoteKey("GitmodulesDecodeError.submodule", {
        description: "The submodule name (the section's subsection) that failed to decode.",
      })
    ),
    /** The field the failure is about, when it is field-specific. */
    field: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitmodulesDecodeError.field", {
        description: "The field the failure is about, when it is field-specific.",
      })
    ),
    /** The offending raw value, when there was one. */
    value: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitmodulesDecodeError.value", { description: "The offending raw value, when there was one." })
    ),
    /** What went wrong. */
    reason: S.Literals(["missingPath", "missingUrl", "invalidValue"]).pipe(
      $I.annoteKey("GitmodulesDecodeError.reason", { description: "What went wrong." })
    ),
  },
  $I.annoteError<GitmodulesDecodeError>("GitmodulesDecodeError", {
    description: "A `[submodule]` section could not be decoded into a GitmodulesEntry.",
  })
) {
  /**
   *  Renders the failing submodule and field into a one-line message.
   *
   * **Example** (Read a missing URL diagnostic)
   *
   * ```ts
   * import { GitmodulesDecodeError } from "@beep/git/Gitmodules"
   *
   * const error = GitmodulesDecodeError.make({ submodule: "lib", reason: "missingUrl" })
   * console.log(error.message) // submodule "lib" has no url
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return this.reason === "missingPath"
      ? `submodule "${this.submodule}" has no path`
      : this.reason === "missingUrl"
        ? `submodule "${this.submodule}" has no url`
        : `submodule "${this.submodule}": invalid value ${Result.getOrThrowWith(encodeDiagnosticJsonString(this.value ?? ""), identity)} for ${this.field ?? "a field"}`;
  }
}

type RawSubmoduleFields = MutableHashMap.MutableHashMap<string, string | null>;

interface CollectedSubmodule {
  readonly fields: RawSubmoduleFields;
  readonly name: string;
}

const collectSubmodules = (config: GitConfig): MutableHashMap.MutableHashMap<string, CollectedSubmodule> => {
  const byName = MutableHashMap.empty<string, CollectedSubmodule>();
  for (const section of config.sections) {
    const name = section.subsection;
    if (Str.toLowerCase(section.name) !== "submodule" || name === undefined) continue;
    const collected = O.getOrElse(MutableHashMap.get(byName, name), () => ({
      name,
      fields: MutableHashMap.empty<string, string | null>(),
    }));
    for (const entry of section.entries) {
      MutableHashMap.set(collected.fields, Str.toLowerCase(entry.key), entry.value ?? null);
    }
    MutableHashMap.set(byName, name, collected);
  }
  return byName;
};

const rawSubmoduleField = (fields: RawSubmoduleFields, key: string): string | null | undefined =>
  O.getOrUndefined(MutableHashMap.get(fields, key));

const invalidSubmoduleField = (name: string, field: string, value: string | null): GitmodulesDecodeError =>
  GitmodulesDecodeError.make({
    submodule: name,
    field,
    ...(value !== null ? { value } : {}),
    reason: "invalidValue",
  });

const requiredSubmoduleField = (
  { fields, name }: CollectedSubmodule,
  field: "path" | "url",
  reason: "missingPath" | "missingUrl"
): Result.Result<string, GitmodulesDecodeError> => {
  const value = rawSubmoduleField(fields, field);
  return value === undefined || value === null
    ? Result.fail(GitmodulesDecodeError.make({ submodule: name, field, reason }))
    : Result.succeed(value);
};

const textSubmoduleField = (
  { fields, name }: CollectedSubmodule,
  field: "branch" | "update"
): Result.Result<string | undefined, GitmodulesDecodeError> => {
  const value = rawSubmoduleField(fields, field);
  return value === null ? Result.fail(invalidSubmoduleField(name, field, value)) : Result.succeed(value);
};

const booleanSubmoduleValue = (
  name: string,
  field: string,
  raw: string | null
): Result.Result<boolean, GitmodulesDecodeError> =>
  O.match(decodeGitBoolean(raw ?? undefined), {
    onNone: () => Result.fail(invalidSubmoduleField(name, field, raw)),
    onSome: Result.succeed,
  });

const shallowSubmoduleField = ({
  fields,
  name,
}: CollectedSubmodule): Result.Result<boolean | undefined, GitmodulesDecodeError> => {
  const raw = rawSubmoduleField(fields, "shallow");
  return raw === undefined ? Result.succeed(undefined) : booleanSubmoduleValue(name, "shallow", raw);
};

const ignoreSubmoduleField = ({
  fields,
  name,
}: CollectedSubmodule): Result.Result<GitmodulesEntry["ignore"], GitmodulesDecodeError> => {
  const raw = rawSubmoduleField(fields, "ignore");
  if (raw === undefined) return Result.succeed(undefined);
  const folded = raw === null ? undefined : Str.toLowerCase(raw);
  return folded !== undefined && isSubmoduleIgnore(folded)
    ? Result.succeed(folded)
    : Result.fail(invalidSubmoduleField(name, "ignore", raw));
};

const fetchRecurseSubmoduleField = ({
  fields,
  name,
}: CollectedSubmodule): Result.Result<GitmodulesEntry["fetchRecurseSubmodules"], GitmodulesDecodeError> => {
  const raw = rawSubmoduleField(fields, "fetchrecursesubmodules");
  if (raw === undefined) return Result.succeed(undefined);
  if (raw !== null && Str.toLowerCase(raw) === "on-demand") return Result.succeed("on-demand");
  return booleanSubmoduleValue(name, "fetchRecurseSubmodules", raw);
};

const decodeSubmodule = (collected: CollectedSubmodule): Result.Result<GitmodulesEntry, GitmodulesDecodeError> =>
  Result.gen(function* () {
    const path = yield* requiredSubmoduleField(collected, "path", "missingPath");
    const url = yield* requiredSubmoduleField(collected, "url", "missingUrl");
    const branch = yield* textSubmoduleField(collected, "branch");
    const update = yield* textSubmoduleField(collected, "update");
    const shallow = yield* shallowSubmoduleField(collected);
    const ignore = yield* ignoreSubmoduleField(collected);
    const fetchRecurse = yield* fetchRecurseSubmoduleField(collected);
    return GitmodulesEntry.make({
      name: collected.name,
      path,
      url,
      ...O.getSomesStruct({ branch: O.fromUndefinedOr(branch) }),
      ...O.getSomesStruct({ shallow: O.fromUndefinedOr(shallow) }),
      ...O.getSomesStruct({ update: O.fromUndefinedOr(update) }),
      ...O.getSomesStruct({ ignore: O.fromUndefinedOr(ignore) }),
      ...O.getSomesStruct({ fetchRecurseSubmodules: O.fromUndefinedOr(fetchRecurse) }),
    });
  });

/**
 * Everything {@link Gitmodules.parseResult} can fail with: the text failed to
 * parse as git-config at all, or a submodule section failed to decode.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type GitmodulesParseError = GitConfigParseError | GitmodulesDecodeError;

const renderGitBoolean = (value: boolean): string => (value ? "true" : "false");

const renderFetchRecurse = (value: boolean | "on-demand"): string =>
  value === "on-demand" ? "on-demand" : renderGitBoolean(value);

const renderOptional = <A>(value: A | undefined, show: (value: A) => string): string | undefined =>
  value === undefined ? undefined : show(value);

const optionalFieldValues = (
  entry: (typeof Gitmodules)["Encoded"]["entries"][number]
): ReadonlyArray<readonly [string, string | undefined]> => [
  ["branch", renderOptional(entry.branch, serializeValue)],
  ["shallow", renderOptional(entry.shallow, renderGitBoolean)],
  ["update", renderOptional(entry.update, serializeValue)],
  ["ignore", renderOptional(entry.ignore, identity)],
  ["fetchRecurseSubmodules", renderOptional(entry.fetchRecurseSubmodules, renderFetchRecurse)],
];

const renderEntryLines = (entry: (typeof Gitmodules)["Encoded"]["entries"][number]): Array<string> => [
  serializeHeader("submodule", entry.name),
  `\tpath = ${serializeValue(entry.path)}`,
  `\turl = ${serializeValue(entry.url)}`,
  ...A.filterMap(optionalFieldValues(entry), ([key, value]) =>
    value === undefined ? Result.failVoid : Result.succeed(`\t${key} = ${value}`)
  ),
];

const render = (fields: (typeof Gitmodules)["Encoded"]): string => {
  const lines = A.flatMap(fields.entries, renderEntryLines);
  return lines.length === 0 ? "" : `${A.join(lines, "\n")}\n`;
};

/**
 * **Details**
 *
 * This class is the READ side. The write side deliberately does not go
 * through it: entry-level mutations ({@link Gitmodules.setUrl} and friends)
 * take a {@link GitConfig} document and compile into its surgical edits, so
 * git's own formatting — comments, ordering, indentation — survives a
 * mutation. Use `stringify`/`FromString`'s encode direction only when a
 * canonical, freshly-rendered document is wanted (there is no source
 * formatting to preserve).
 *
 * **Example** (Inspect decoded entries)
 *
 * ```ts
 * import { Gitmodules } from "@beep/git/Gitmodules"
 * import * as Result from "effect/Result"
 *
 * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
 * const modules = Result.getOrThrow(Gitmodules.parseResult(text))
 * console.log(modules.entries[0]?.name) // lib
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Gitmodules extends S.Class<Gitmodules, { readonly brand: unique symbol }>($I`Gitmodules`)(
  {
    /** The decoded submodule entries, in first-appearance order. */
    entries: S.Array(GitmodulesEntry)
      .check(
        S.makeFilter(
          (entries) => A.dedupe(A.map(entries, (entry) => entry.name)).length === entries.length,
          $I.annote("UniqueSubmoduleNames", {
            message: "Unique submodule names",
            description: "Submodule entries must have distinct case-sensitive names.",
          })
        )
      )
      .pipe(
        $I.annoteKey("Gitmodules.entries", { description: "The decoded submodule entries, in first-appearance order." })
      ),
  },
  $I.annote("Gitmodules", {
    description:
      "The typed view over a `.gitmodules` document: the decoded submodule entries, in first-appearance order.",
  })
) {
  /**
   * Decodes an already-parsed git-config document into submodule entries —
   * the pure, synchronous primitive.
   *
   * **Details**
   *
   * Sections named `submodule` (case-insensitively) with a subsection are
   * decoded; duplicate sections for one name merge with git's last-wins
   * read semantics. An entry missing `path` or `url`, or carrying an
   * undecodable `shallow`/`ignore`/`fetchRecurseSubmodules` value, fails
   * typed.
   *
   * **Example** (Decode a parsed config)
   *
   * ```ts
   * import { Gitmodules } from "@beep/git/Gitmodules"
   * import { GitConfig } from "@beep/git/GitConfig"
   * import * as Result from "effect/Result"
   *
   * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
   * const config = Result.getOrThrow(GitConfig.parseResult(text))
   * const modules = Result.getOrThrow(Gitmodules.fromConfigResult(config))
   * console.log(modules.entries[0]?.url) // ../lib.git
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static fromConfigResult(config: GitConfig): Result.Result<Gitmodules, GitmodulesDecodeError> {
    return pipe(
      collectSubmodules(config),
      MutableHashMap.values,
      Iterable.map(decodeSubmodule),
      Result.all,
      Result.map((entries) => Gitmodules.make({ entries }))
    );
  }

  /**
   * Parses `.gitmodules` text into the typed view — the pure, synchronous
   * primitive over {@link GitConfig.parseResult} plus
   * {@link Gitmodules.fromConfigResult}.
   *
   * **Example** (Parse a submodule synchronously)
   *
   * ```ts
   * import { Gitmodules } from "@beep/git/Gitmodules"
   * import * as Result from "effect/Result"
   *
   * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
   * const modules = Result.getOrThrow(Gitmodules.parseResult(text))
   * console.log(modules.entries[0]?.path) // lib
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static parseResult(text: string): Result.Result<Gitmodules, GitmodulesParseError> {
    const config = GitConfig.parseResult(text);
    if (Result.isFailure(config)) return Result.fail(config.failure);
    return Gitmodules.fromConfigResult(config.success);
  }

  /**
   * Parses `.gitmodules` text into the typed view.
   *
   * **Details**
   *
   * Defined in terms of {@link Gitmodules.parseResult} — synchronous callers
   * can use that variant directly.
   *
   * **Example** (Run the submodule parser)
   *
   * ```ts
   * import { Gitmodules } from "@beep/git/Gitmodules"
   * import * as Effect from "effect/Effect"
   *
   * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
   * const modules = Effect.runSync(Gitmodules.parse(text))
   * console.log(modules.entries[0]?.url) // ../lib.git
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly parse = Effect.fn("Gitmodules.parse")((text: string) =>
    Effect.fromResult(Gitmodules.parseResult(text))
  );

  /**
   * Renders the entries as a canonical `.gitmodules` document.
   *
   * **Gotchas**
   *
   * This is a fresh, canonical rendering — one section per entry, tabs, a
   * fixed field order — NOT a lossless round-trip of any source document.
   * To mutate an existing `.gitmodules` while preserving its formatting,
   * compile entry-level mutations into {@link GitConfig} edits instead
   * ({@link Gitmodules.setUrl} and friends).
   *
   * **Example** (Render canonical submodule text)
   *
   * ```ts
   * import { Gitmodules, GitmodulesEntry } from "@beep/git/Gitmodules"
   *
   * const modules = Gitmodules.make({
   *   entries: [GitmodulesEntry.make({ name: "lib", path: "lib", url: "../lib.git" })]
   * })
   * console.log(JSON.stringify(modules.stringify())) // "[submodule \"lib\"]\n\tpath = lib\n\turl = ../lib.git\n"
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  stringify(): string {
    return render(this);
  }

  /**
   * Schema transformation between `.gitmodules` text and the typed view:
   * decoding parses (and fails on the first undecodable entry), encoding
   * renders the canonical document per {@link Gitmodules.stringify}.
   *
   * **Example** (Decode submodule text with a codec)
   *
   * ```ts
   * import { Gitmodules } from "@beep/git/Gitmodules"
   * import * as S from "effect/Schema"
   *
   * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
   * const modules = S.decodeUnknownSync(Gitmodules.FromString)(text)
   * console.log(modules.entries[0]?.name) // lib
   * ```
   *
   * @category codecs
   * @since 0.0.0
   */
  static readonly FromString: S.Codec<Gitmodules, string> = S.String.pipe(
    S.decodeTo(
      Gitmodules,
      SchemaTransformation.transformEffect<(typeof Gitmodules)["Encoded"], string>({
        decode: (text: string) => {
          const result = Gitmodules.parseResult(text);
          return Result.isSuccess(result)
            ? Effect.succeed(result.success)
            : Effect.fail(new SchemaIssue.InvalidValue({ message: result.failure.message }, text));
        },
        encode: (fields) => Effect.succeed(render(fields)),
      })
    )
  );

  /**
   * Rewrites `submodule.<name>.url` in the document — a surgical
   * {@link GitConfig.set}, so git's own formatting survives.
   *
   * **Example** (Rewrite a submodule URL)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { Gitmodules } from "@beep/git/Gitmodules"
   * import { GitConfig } from "@beep/git/GitConfig"
   * import * as Result from "effect/Result"
   *
   * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
   * const config = Result.getOrThrow(GitConfig.parseResult(text))
   * const edited = Result.getOrThrow(Gitmodules.setUrl(config, "lib", "../new.git"))
   * console.log(O.getOrNull(edited.get("submodule", "lib", "url"))) // ../new.git
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly setUrl: {
    (config: GitConfig, name: string, url: string): Result.Result<GitConfig, GitConfigEditError>;
    (name: string, url: string): (config: GitConfig) => Result.Result<GitConfig, GitConfigEditError>;
  } = dual(
    3,
    (config: GitConfig, name: string, url: string): Result.Result<GitConfig, GitConfigEditError> =>
      config.set("submodule", name, "url", url)
  );

  /**
   *  Rewrites `submodule.<name>.path` in the document, surgically.
   *
   * **Example** (Rewrite a submodule path)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { Gitmodules } from "@beep/git/Gitmodules"
   * import { GitConfig } from "@beep/git/GitConfig"
   * import * as Result from "effect/Result"
   *
   * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
   * const config = Result.getOrThrow(GitConfig.parseResult(text))
   * const edited = Result.getOrThrow(Gitmodules.setPath(config, "lib", "vendor/lib"))
   * console.log(O.getOrNull(edited.get("submodule", "lib", "path"))) // vendor/lib
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly setPath: {
    (config: GitConfig, name: string, path: string): Result.Result<GitConfig, GitConfigEditError>;
    (name: string, path: string): (config: GitConfig) => Result.Result<GitConfig, GitConfigEditError>;
  } = dual(
    3,
    (config: GitConfig, name: string, path: string): Result.Result<GitConfig, GitConfigEditError> =>
      config.set("submodule", name, "path", path)
  );

  /**
   * Records (or, with `branch` omitted, removes) `submodule.<name>.branch`,
   * surgically.
   *
   * **Example** (Record a tracking branch)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { Gitmodules } from "@beep/git/Gitmodules"
   * import { GitConfig } from "@beep/git/GitConfig"
   * import * as Result from "effect/Result"
   *
   * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
   * const config = Result.getOrThrow(GitConfig.parseResult(text))
   * const edited = Result.getOrThrow(Gitmodules.setBranch(config, "lib", "main"))
   * console.log(O.getOrNull(edited.get("submodule", "lib", "branch"))) // main
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly setBranch: {
    (config: GitConfig, name: string, branch?: string): Result.Result<GitConfig, GitConfigEditError>;
    (name: string, branch?: string): (config: GitConfig) => Result.Result<GitConfig, GitConfigEditError>;
  } = dual(
    (args) => isGitConfig(args[0]),
    (config: GitConfig, name: string, branch?: string): Result.Result<GitConfig, GitConfigEditError> =>
      branch === undefined ? config.unset("submodule", name, "branch") : config.set("submodule", name, "branch", branch)
  );

  /**
   * Records (or, with `shallow` omitted, removes) `submodule.<name>.shallow`,
   * surgically.
   *
   * **Example** (Record shallow cloning)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { Gitmodules } from "@beep/git/Gitmodules"
   * import { GitConfig } from "@beep/git/GitConfig"
   * import * as Result from "effect/Result"
   *
   * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
   * const config = Result.getOrThrow(GitConfig.parseResult(text))
   * const edited = Result.getOrThrow(Gitmodules.setShallow(config, "lib", true))
   * console.log(O.getOrNull(edited.get("submodule", "lib", "shallow"))) // true
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly setShallow: {
    (config: GitConfig, name: string, shallow?: boolean): Result.Result<GitConfig, GitConfigEditError>;
    (name: string, shallow?: boolean): (config: GitConfig) => Result.Result<GitConfig, GitConfigEditError>;
  } = dual(
    (args) => isGitConfig(args[0]),
    (config: GitConfig, name: string, shallow?: boolean): Result.Result<GitConfig, GitConfigEditError> =>
      shallow === undefined
        ? config.unset("submodule", name, "shallow")
        : config.set("submodule", name, "shallow", shallow ? "true" : "false")
  );

  /**
   * Adds a whole entry as a new `[submodule "<name>"]` section at the end of
   * the document, field by field through the surgical editor.
   *
   * **Example** (Append a submodule entry)
   *
   * ```ts
   * import { Gitmodules, GitmodulesEntry } from "@beep/git/Gitmodules"
   * import { GitConfig } from "@beep/git/GitConfig"
   * import * as Result from "effect/Result"
   * import * as O from "effect/Option"
   *
   * const config = Result.getOrThrow(GitConfig.parseResult(""))
   * const entry = GitmodulesEntry.make({ name: "lib", path: "lib", url: "../lib.git" })
   * const edited = Result.getOrThrow(Gitmodules.add(config, entry))
   * console.log(O.getOrNull(edited.get("submodule", "lib", "path"))) // lib
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly add: {
    (config: GitConfig, entry: GitmodulesEntry): Result.Result<GitConfig, GitConfigEditError>;
    (entry: GitmodulesEntry): (config: GitConfig) => Result.Result<GitConfig, GitConfigEditError>;
  } = dual(2, (config: GitConfig, entry: GitmodulesEntry): Result.Result<GitConfig, GitConfigEditError> => {
    const steps: ReadonlyArray<readonly [string, string | undefined]> = [
      ["path", entry.path],
      ["url", entry.url],
      ["branch", entry.branch],
      ["shallow", renderOptional(entry.shallow, renderGitBoolean)],
      ["update", entry.update],
      ["ignore", entry.ignore],
      ["fetchRecurseSubmodules", renderOptional(entry.fetchRecurseSubmodules, renderFetchRecurse)],
    ];
    return A.reduce(steps, config.addSection("submodule", entry.name), (result, [key, value]) =>
      Result.isFailure(result) || value === undefined ? result : result.success.set("submodule", entry.name, key, value)
    );
  });

  /**
   *  Removes every `[submodule "<name>"]` section from the document, surgically.
   *
   * **Example** (Remove all sections for a submodule)
   *
   * ```ts
   * import { Gitmodules } from "@beep/git/Gitmodules"
   * import { GitConfig } from "@beep/git/GitConfig"
   * import * as Result from "effect/Result"
   *
   * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
   * const config = Result.getOrThrow(GitConfig.parseResult(text))
   * const edited = Result.getOrThrow(Gitmodules.remove(config, "lib"))
   * console.log(edited.stringify() === "") // true
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly remove: {
    (config: GitConfig, name: string): Result.Result<GitConfig, GitConfigEditError>;
    (name: string): (config: GitConfig) => Result.Result<GitConfig, GitConfigEditError>;
  } = dual(
    2,
    (config: GitConfig, name: string): Result.Result<GitConfig, GitConfigEditError> =>
      config.removeSection("submodule", name)
  );

  /**
   * Renames the submodule's section header(s) from `oldName` to `newName`,
   * leaving every field line untouched.
   *
   * **Gotchas**
   *
   * This renames the `.gitmodules` section ONLY. A full submodule rename is
   * a multi-step sequence (worktree move, `.git/modules` move, gitdir
   * pointer, `core.worktree`, index restage) that belongs to the caller.
   *
   * **Example** (Rename a submodule section)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { Gitmodules } from "@beep/git/Gitmodules"
   * import { GitConfig } from "@beep/git/GitConfig"
   * import * as Result from "effect/Result"
   *
   * const text = '[submodule "lib"]\n\tpath = lib\n\turl = ../lib.git\n'
   * const config = Result.getOrThrow(GitConfig.parseResult(text))
   * const edited = Result.getOrThrow(Gitmodules.rename(config, "lib", "library"))
   * console.log(O.getOrNull(edited.get("submodule", "library", "path"))) // lib
   * ```
   *
   * @category setters
   * @since 0.0.0
   */
  static readonly rename: {
    (config: GitConfig, oldName: string, newName: string): Result.Result<GitConfig, GitConfigEditError>;
    (oldName: string, newName: string): (config: GitConfig) => Result.Result<GitConfig, GitConfigEditError>;
  } = dual(
    3,
    (config: GitConfig, oldName: string, newName: string): Result.Result<GitConfig, GitConfigEditError> =>
      config.renameSection("submodule", oldName, "submodule", newName)
  );
}
