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
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { HasNullByte } from "@beep/schema/FilePath"
 *
 * const is = S.is(HasNullByte)
 *
 * console.log(is("hello\x00world")) // true
 * console.log(is("hello")) // false
 * ```
 *
 * @since 0.0.0
 * @category guards
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
  SchemaUtils.withCodecStatics
);

/**
 * Branded string type containing an embedded NUL byte.
 *
 * @since 0.0.0
 * @category models
 */
export type HasNullByte = typeof HasNullByte.Type;

/**
 * Branded schema for path strings that do not use unsupported Windows device
 * namespace prefixes.
 *
 * @example
 * ```ts
 * import { SupportedWindowsNamespace } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(SupportedWindowsNamespace)("C:\\Users\\Ada")
 * console.log(path)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link SupportedWindowsNamespace}.
 *
 * @since 0.0.0
 * @category models
 */
export type SupportedWindowsNamespace = typeof SupportedWindowsNamespace.Type;

/**
 * Branded schema for strings that contain a POSIX separator.
 *
 * @example
 * ```ts
 * import { UsesPosixSeparator } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(UsesPosixSeparator)("src/index.ts")
 * console.log(path)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link UsesPosixSeparator}.
 *
 * @since 0.0.0
 * @category models
 */
export type UsesPosixSeparator = typeof UsesPosixSeparator.Type;

/**
 * Branded schema for strings that contain a Windows separator.
 *
 * @example
 * ```ts
 * import { UsesWindowsSeparator } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(UsesWindowsSeparator)("C:\\Users\\Ada")
 * console.log(path)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link UsesWindowsSeparator}.
 *
 * @since 0.0.0
 * @category models
 */
export type UsesWindowsSeparator = typeof UsesWindowsSeparator.Type;

/**
 * Branded schema for strings that end with a POSIX or Windows path separator.
 *
 * @example
 * ```ts
 * import { EndsWithSeparator } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(EndsWithSeparator)("src/")
 * console.log(path)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link EndsWithSeparator}.
 *
 * @since 0.0.0
 * @category models
 */
export type EndsWithSeparator = typeof EndsWithSeparator.Type;
