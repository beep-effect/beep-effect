/**
 * Snippet language normalization and TypeScript property-name quoting used
 * when rendering API reference signatures and examples.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { MappedLiteralKit } from "@beep/schema/MappedLiteralKit";
import { Effect, SchemaGetter, SchemaIssue } from "effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
const $I = $ScratchpadId.create("beep-docs/api-reference/CodeSnippet");

/**
 * Maps a file extension onto its canonical snippet-language name.
 *
 * **Details**
 *
 * The extensions are the unique last segments of git-tracked files in the
 * Effect repository. Related extensions that would share a language id
 * (`js`/`mjs`, `ts`/`mts`, `yml`/`yaml`) stay distinct because
 * {@link MappedLiteralKit} requires unique literals on both sides.
 *
 * **Example** (Decode an extension)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CodeSnippetLanguageFromExtension } from "../../../beep-docs/api-reference/CodeSnippet.ts"
 *
 * console.log(S.decodeUnknownSync(CodeSnippetLanguageFromExtension)("sh")) // "bash"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CodeSnippetLanguageFromExtension = MappedLiteralKit([
  ["binx", "binx"],
  ["gz", "gzip"],
  ["html", "html"],
  ["js", "javascript"],
  ["json", "json"],
  ["lock", "lock"],
  ["md", "markdown"],
  ["mjs", "javascript-esm"],
  ["mts", "typescript-esm"],
  ["nix", "nix"],
  ["patch", "patch"],
  ["sh", "bash"],
  ["snap", "snap"],
  ["ts", "typescript"],
  ["tsx", "tsx"],
  ["txt", "text"],
  ["yaml", "yaml"],
  ["yml", "yml"],
]).pipe(
  $I.annoteSchema("CodeSnippetLanguageFromExtension", {
    description: "Maps a file extension to its canonical snippet language name.",
  })
);

/**
 * Encoded companions for {@link CodeSnippetLanguageFromExtension}.
 *
 * @see {@link CodeSnippetLanguageFromExtension} for the runtime codec that maps extensions to language names.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CodeSnippetLanguageFromExtension {
  /**
   * File-extension input accepted by {@link CodeSnippetLanguageFromExtension} before mapping.
   *
   * @see {@link CodeSnippetLanguageFromExtension} for the runtime codec that maps extensions to language names.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CodeSnippetLanguageFromExtension.Encoded;
}

/**
 * Decoded language name produced by {@link CodeSnippetLanguageFromExtension}.
 *
 * @see {@link CodeSnippetLanguageFromExtension} for the runtime codec and encoded extension side.
 * @category type-level
 * @since 0.0.0
 */
export type CodeSnippetLanguageFromExtension = typeof CodeSnippetLanguageFromExtension.Type;

/**
 * Canonical snippet-language names accepted for fenced code examples.
 *
 * **Example** (Guard a language name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CodeSnippetLanguage } from "../../../beep-docs/api-reference/CodeSnippet.ts"
 *
 * console.log(S.is(CodeSnippetLanguage)(CodeSnippetLanguage.Enum.typescript)) // true
 * console.log(S.is(CodeSnippetLanguage)("cobol")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodeSnippetLanguage = LiteralKit(CodeSnippetLanguageFromExtension.To.Options).pipe(
  $I.annoteSchema("CodeSnippetLanguage", {
    description: "Canonical snippet language names accepted for fenced code examples.",
  })
);

/**
 * Literal type extracted from {@link CodeSnippetLanguage}.
 *
 * @see {@link CodeSnippetLanguage} for the runtime schema and membership guard.
 * @category type-level
 * @since 0.0.0
 */
export type CodeSnippetLanguage = typeof CodeSnippetLanguage.Type;

const languageFromExtension = S.decodeUnknownOption(CodeSnippetLanguageFromExtension);
const canonicalLanguage = S.decodeUnknownOption(CodeSnippetLanguage);

const resolveInfoString = (info: string): O.Option<CodeSnippetLanguage> => {
  const trimmed = Str.trim(info);
  return Str.isEmpty(trimmed)
    ? O.some(CodeSnippetLanguage.Enum.typescript)
    : pipe(
        languageFromExtension(trimmed),
        O.orElse(() => canonicalLanguage(trimmed))
      );
};

const decodeInfoString = (info: string): Effect.Effect<CodeSnippetLanguage, SchemaIssue.Issue> =>
  pipe(
    resolveInfoString(info),
    O.map(Effect.succeed),
    O.getOrElse(() => Effect.fail(new SchemaIssue.InvalidValue({ message: `Unknown snippet language: ${info}` })))
  );

/**
 * Normalizes a fenced-code info string (`ts`, `typescript`, `` `` ``) into a
 * {@link CodeSnippetLanguage}.
 *
 * **Details**
 *
 * An empty info string defaults to `typescript`; an extension is mapped
 * through {@link CodeSnippetLanguageFromExtension}; anything else must
 * already be a canonical language name.
 *
 * **Gotchas**
 *
 * Encode is passthrough of the canonical language id and does not restore the
 * original info string or extension (`" ts "` and `"ts"` both decode to
 * `"typescript"`; encoding `"typescript"` stays `"typescript"`).
 *
 * **Example** (Normalize an info string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CodeSnippetLanguageFromInfoString } from "../../../beep-docs/api-reference/CodeSnippet.ts"
 *
 * console.log(S.decodeUnknownSync(CodeSnippetLanguageFromInfoString)(" ts ")) // "typescript"
 * console.log(S.encodeUnknownSync(CodeSnippetLanguageFromInfoString)("typescript")) // "typescript"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CodeSnippetLanguageFromInfoString = S.String.pipe(
  S.decodeTo(CodeSnippetLanguage, {
    decode: SchemaGetter.transformOrFail(decodeInfoString),
    encode: SchemaGetter.passthrough({ strict: false }),
  }),
  SchemaUtils.withOptionCodecStatics,
  $I.annoteSchema("CodeSnippetLanguageFromInfoString", {
    description: "Normalizes a fenced-code info string into a canonical snippet language name.",
  })
);

/**
 * Decoded type of {@link CodeSnippetLanguageFromInfoString}.
 *
 * @see {@link CodeSnippetLanguageFromInfoString} for the runtime codec that normalizes info strings.
 * @category type-level
 * @since 0.0.0
 */
export type CodeSnippetLanguageFromInfoString = typeof CodeSnippetLanguageFromInfoString.Type;

/**
 * Resolves a fenced-code info string to a {@link CodeSnippetLanguage} without
 * throwing.
 *
 * **Details**
 *
 * Empty and whitespace-only info strings become `typescript` (`Some`), not
 * `None`. An unknown token such as `cobol` is `None`.
 *
 * **Example** (Resolve a known, empty, and unknown language)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { languageFromInfoString } from "../../../beep-docs/api-reference/CodeSnippet.ts"
 *
 * console.log(O.getOrUndefined(languageFromInfoString("mjs"))) // "javascript-esm"
 * console.log(O.getOrUndefined(languageFromInfoString(""))) // "typescript"
 * console.log(O.isNone(languageFromInfoString("cobol"))) // true
 * ```
 *
 * @see {@link CodeSnippetLanguageFromInfoString} for the Issue-bearing codec that fails instead of returning `None`.
 * @category decoding
 * @since 0.0.0
 */
export const languageFromInfoString: (info: string) => O.Option<CodeSnippetLanguage> = S.decodeOption(
  CodeSnippetLanguageFromInfoString
);

const TsIdentifier = S.String.check(
  S.isPattern(/^[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*$/u, {
    identifier: $I`TsIdentifierCheck`,
    title: "TypeScript Identifier",
    description: "A string that is a valid ECMAScript identifier name.",
    message: "Expected a valid ECMAScript identifier name",
  })
);

const TsComputedPropertyKey = S.String.check(
  S.isPattern(/^\[[^\]\r\n]+]$/, {
    identifier: $I`TsComputedPropertyKeyCheck`,
    title: "TypeScript Computed Property Key",
    description: "A bracketed computed property key such as `[Symbol.iterator]`.",
    message: "Expected a bracketed computed property key",
  })
);

/**
 * Property names that can appear unquoted in a TypeScript object type.
 *
 * **Example** (Guard a property name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BareTsPropertyName } from "../../../beep-docs/api-reference/CodeSnippet.ts"
 *
 * const isBare = S.is(BareTsPropertyName)
 * console.log(isBare("value"), isBare("[Symbol.iterator]"), isBare("needs quotes"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BareTsPropertyName = S.Union([TsIdentifier, TsComputedPropertyKey]).pipe(
  $I.annoteSchema("BareTsPropertyName", {
    description: "A property name that needs no quoting in a TypeScript object type.",
  })
);

/**
 * String type extracted from {@link BareTsPropertyName}.
 *
 * @see {@link BareTsPropertyName} for the runtime schema and membership guard.
 * @category type-level
 * @since 0.0.0
 */
export type BareTsPropertyName = typeof BareTsPropertyName.Type;

const isBareTsPropertyName = S.is(BareTsPropertyName);
const encodeJsonString = S.encodeOption(S.fromJsonString(S.String));

/**
 * Renders a member name for a TypeScript object type, quoting it as a JSON
 * string when it is neither an identifier nor a computed key.
 *
 * **Example** (Quote only when needed)
 *
 * ```ts
 * import { typescriptPropertyName } from "../../../beep-docs/api-reference/CodeSnippet.ts"
 *
 * console.log(typescriptPropertyName("value")) // value
 * console.log(typescriptPropertyName("content-type")) // "content-type"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const typescriptPropertyName = (name: string): string =>
  isBareTsPropertyName(name)
    ? name
    : pipe(
        encodeJsonString(name),
        O.getOrElse(() => name)
      );
