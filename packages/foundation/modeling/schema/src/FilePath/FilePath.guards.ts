/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Str } from "@beep/utils";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { $I, usesUnsupportedWindowsNamespacePrefix } from "./FilePath.shared.ts";

/**
 * Branded schema for strings that contain an embedded NUL byte.
 *
 * **Example** (Detect embedded NUL byte)
 *
 * ```ts import.meta.vitest name="Detect embedded NUL byte"
 * import * as S from "effect/Schema"
 * import { HasNullByte } from "@beep/schema/FilePath"
 *
 * const is = S.is(HasNullByte)
 *
 * is("hello\x00world") // => true
 * is("hello") // => false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const HasNullByte = S.String.check(
  S.isIncludes("\u0000", {
    identifier: $I`HasNullByteCheck`,
    title: "Has Null Byte",
    description: "A string that contains an embedded NUL byte.",
    message: "Path text must contain an embedded NUL byte",
  })
).pipe(
  S.brand("HasNullByte"),
  $I.annoteSchema("HasNullByte", {
    description: "A string that contains an embedded NUL byte.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Branded string type containing an embedded NUL byte.
 *
 * **Example** (Decode branded NUL string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { HasNullByte } from "@beep/schema/FilePath"
 *
 * const value: HasNullByte = S.decodeUnknownSync(HasNullByte)("hello\x00world")
 * console.log(value.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HasNullByte = typeof HasNullByte.Type;

/**
 * Branded schema for path strings that do not use unsupported Windows device
 * namespace prefixes.
 *
 * **Example** (Decode supported Windows path)
 *
 * ```ts
 * import { SupportedWindowsNamespace } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(SupportedWindowsNamespace)("C:\\Users\\Ada")
 * console.log(path)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SupportedWindowsNamespace = S.NonEmptyString.check(
  S.makeFilter(P.not(usesUnsupportedWindowsNamespacePrefix), {
    identifier: $I`SupportedWindowsNamespaceCheck`,
    title: "Supported Windows Namespace",
    description: "A path string that does not start with \\\\?\\ or \\\\.\\.",
    message: "Windows namespace paths starting with \\\\?\\ or \\\\.\\ are not supported",
  })
).pipe(
  S.brand("SupportedWindowsNamespace"),
  $I.annoteSchema("SupportedWindowsNamespace", {
    description: "A non-empty path string that does not use unsupported Windows namespace prefixes.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type for {@link SupportedWindowsNamespace}.
 *
 * **Example** (Type annotated Windows path)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SupportedWindowsNamespace } from "@beep/schema/FilePath"
 *
 * const value: SupportedWindowsNamespace = S.decodeUnknownSync(SupportedWindowsNamespace)("C:\\Users\\Ada")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SupportedWindowsNamespace = typeof SupportedWindowsNamespace.Type;

/**
 * Branded schema for strings that contain a POSIX separator.
 *
 * **Example** (Decode POSIX separator path)
 *
 * ```ts
 * import { UsesPosixSeparator } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(UsesPosixSeparator)("src/index.ts")
 * console.log(path)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const UsesPosixSeparator = S.String.check(
  S.isIncludes("/", {
    identifier: $I`UsesPosixSeparatorCheck`,
    title: "Uses Posix Separator",
    description: "A string that contains the POSIX path separator /.",
    message: "Path text must contain the POSIX separator /",
  })
).pipe(
  S.brand("UsesPosixSeparator"),
  $I.annoteSchema("UsesPosixSeparator", {
    description: "A string that contains the POSIX path separator /.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type for {@link UsesPosixSeparator}.
 *
 * **Example** (Type annotated POSIX path)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UsesPosixSeparator } from "@beep/schema/FilePath"
 *
 * const value: UsesPosixSeparator = S.decodeUnknownSync(UsesPosixSeparator)("src/index.ts")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UsesPosixSeparator = typeof UsesPosixSeparator.Type;

/**
 * Branded schema for strings that contain a Windows separator.
 *
 * **Example** (Decode Windows separator path)
 *
 * ```ts
 * import { UsesWindowsSeparator } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(UsesWindowsSeparator)("C:\\Users\\Ada")
 * console.log(path)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const UsesWindowsSeparator = S.String.check(
  S.makeFilter(Str.includes("\\"), {
    identifier: $I`UsesWindowsSeparatorCheck`,
    title: "Uses Windows Separator",
    description: "A string that contains the Windows path separator \\.",
    message: "Path text must contain the Windows separator \\",
  })
).pipe(
  S.brand("UsesWindowsSeparator"),
  $I.annoteSchema("UsesWindowsSeparator", {
    description: "A string that contains the Windows path separator \\.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type for {@link UsesWindowsSeparator}.
 *
 * **Example** (Type annotated Windows path)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UsesWindowsSeparator } from "@beep/schema/FilePath"
 *
 * const value: UsesWindowsSeparator = S.decodeUnknownSync(UsesWindowsSeparator)("C:\\Users\\Ada")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UsesWindowsSeparator = typeof UsesWindowsSeparator.Type;

/**
 * Branded schema for strings that end with a POSIX or Windows path separator.
 *
 * **Example** (Decode trailing separator path)
 *
 * ```ts
 * import { EndsWithSeparator } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(EndsWithSeparator)("src/")
 * console.log(path)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const EndsWithSeparator = S.String.check(
  S.makeFilter(P.or(Str.endsWith("/"), Str.endsWith("\\")), {
    identifier: $I`EndsWithSeparatorCheck`,
    title: "Ends With Separator",
    description: "A string that ends with either / or \\.",
    message: "Path text must end with a path separator",
  })
).pipe(
  S.brand("EndsWithSeparator"),
  $I.annoteSchema("EndsWithSeparator", {
    description: "A string that ends with either the POSIX or Windows path separator.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type for {@link EndsWithSeparator}.
 *
 * **Example** (Type annotated trailing separator)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EndsWithSeparator } from "@beep/schema/FilePath"
 *
 * const value: EndsWithSeparator = S.decodeUnknownSync(EndsWithSeparator)("src/")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndsWithSeparator = typeof EndsWithSeparator.Type;
