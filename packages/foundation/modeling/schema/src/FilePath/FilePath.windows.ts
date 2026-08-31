/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Str } from "@beep/utils";
import { flow, pipe } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { SupportedWindowsNamespace, UsesPosixSeparator, UsesWindowsSeparator } from "./FilePath.guards.ts";
import { HasLeafSegment } from "./FilePath.roots.ts";
import { ValidWindowsUncSegments, WindowsSegments } from "./FilePath.segments.ts";
import {
  $I,
  isWindowsDrivePrefix,
  splitNonEmpty,
  windowsDrivePrefixRegExp,
  windowsUncPrefixRegExp,
} from "./FilePath.shared.ts";

const isSupportedWindowsNamespace = SupportedWindowsNamespace.is;
const isUsesPosixSeparator = UsesPosixSeparator.is;
const isUsesWindowsSeparator = UsesWindowsSeparator.is;
const isHasLeafSegment = HasLeafSegment.is;
const isWindowsSegments = WindowsSegments.is;
const isValidWindowsUncSegments = ValidWindowsUncSegments.is;

/**
 * Branded schema for Windows drive paths with a leaf segment.
 *
 * **Example** (Decode Windows drive path)
 *
 * ```ts
 * import { WindowsDrivePath } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(WindowsDrivePath)("C:\\Users\\Ada")
 * console.log(path)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const WindowsDrivePath = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.makeFilter(isSupportedWindowsNamespace, {
        identifier: $I`WindowsDrivePathSupportedNamespaceCheck`,
        title: "Windows Drive Path Supported Namespace",
        description: "A drive path that does not use an unsupported Windows namespace prefix.",
        message: "Windows drive paths must not use unsupported namespace prefixes",
      }),
      S.isPattern(windowsDrivePrefixRegExp, {
        identifier: $I`WindowsDrivePathPrefixCheck`,
        title: "Windows Drive Path Prefix",
        description: "A drive path that starts with `<letter>:`.",
        message: "Windows drive paths must start with a drive prefix like C:",
      }),
      S.makeFilter(isHasLeafSegment, {
        identifier: $I`WindowsDrivePathLeafSegmentCheck`,
        title: "Windows Drive Path Leaf Segment",
        description: "A drive path that includes a leaf segment and is not only a drive root.",
        message: "Windows drive paths must include a leaf segment",
      }),
      S.makeFilter((value: string) => pipe(Str.substring(2)(value), splitNonEmpty(/[\\/]+/), isWindowsSegments), {
        identifier: $I`WindowsDrivePathSegmentsCheck`,
        title: "Windows Drive Path Segments",
        description: "A drive path whose segments after the drive prefix are valid Windows path segments.",
        message: "Windows drive paths must contain valid Windows path segments after the drive prefix",
      }),
    ],
    {
      identifier: $I`WindowsDrivePathChecks`,
      title: "Windows Drive Path",
      description: "Checks for a Windows drive path with a leaf segment.",
    }
  )
).pipe(
  S.brand("WindowsDrivePath"),
  $I.annoteSchema("WindowsDrivePath", {
    description: "A Windows drive path with a drive prefix and at least one leaf segment.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type for {@link WindowsDrivePath}.
 *
 * **Example** (Annotate WindowsDrivePath value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WindowsDrivePath } from "@beep/schema/FilePath"
 *
 * const value: WindowsDrivePath = S.decodeUnknownSync(WindowsDrivePath)("C:\\Users\\Ada")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WindowsDrivePath = typeof WindowsDrivePath.Type;

/**
 * Branded schema for Windows UNC file paths with server, share, and leaf
 * segments.
 *
 * **Example** (Decode Windows UNC path)
 *
 * ```ts
 * import { WindowsUncPath } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(WindowsUncPath)("\\\\server\\share\\folder")
 * console.log(path)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const WindowsUncPath = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.makeFilter(isSupportedWindowsNamespace, {
        identifier: $I`WindowsUncPathSupportedNamespaceCheck`,
        title: "Windows UNC Path Supported Namespace",
        description: "A UNC path that does not use an unsupported Windows namespace prefix.",
        message: "Windows UNC paths must not use unsupported namespace prefixes",
      }),
      S.isPattern(windowsUncPrefixRegExp, {
        identifier: $I`WindowsUncPathPrefixCheck`,
        title: "Windows UNC Path Prefix",
        description: "A UNC path that starts with two leading backslashes.",
        message: "Windows UNC paths must start with \\\\",
      }),
      S.makeFilter(P.not(isUsesPosixSeparator), {
        identifier: $I`WindowsUncPathNoPosixSeparatorCheck`,
        title: "Windows UNC Path No Posix Separator",
        description: "A UNC path that does not contain the POSIX separator /.",
        message: "Windows UNC paths must not contain /",
      }),
      S.makeFilter(isHasLeafSegment, {
        identifier: $I`WindowsUncPathLeafSegmentCheck`,
        title: "Windows UNC Path Leaf Segment",
        description: "A UNC path that includes a leaf segment and is not only a UNC root.",
        message: "Windows UNC paths must include a leaf segment",
      }),
      S.makeFilter(flow(Str.substring(2), splitNonEmpty(/\\+/), isValidWindowsUncSegments), {
        identifier: $I`WindowsUncPathSegmentsCheck`,
        title: "Windows UNC Path Segments",
        description: "A UNC path whose segments form `[server, share, ...rest]` with valid Windows path segments.",
        message: "Windows UNC paths must include valid server, share, and leaf segments",
      }),
    ],
    {
      identifier: $I`WindowsUncPathChecks`,
      title: "Windows UNC Path",
      description: "Checks for a Windows UNC file path.",
    }
  )
).pipe(
  S.brand("WindowsUncPath"),
  $I.annoteSchema("WindowsUncPath", {
    description: "A Windows UNC file path with valid server, share, and leaf segments.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type for {@link WindowsUncPath}.
 *
 * **Example** (Annotate WindowsUncPath value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WindowsUncPath } from "@beep/schema/FilePath"
 *
 * const value: WindowsUncPath = S.decodeUnknownSync(WindowsUncPath)("\\\\server\\share\\folder")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WindowsUncPath = typeof WindowsUncPath.Type;

/**
 * Branded schema for Windows relative paths that use backslash separators and
 * include a leaf segment.
 *
 * **Example** (Decode Windows relative path)
 *
 * ```ts
 * import { WindowsRelativePath } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(WindowsRelativePath)("Users\\Ada")
 * console.log(path)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const WindowsRelativePath = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.makeFilter(isSupportedWindowsNamespace, {
        identifier: $I`WindowsRelativePathSupportedNamespaceCheck`,
        title: "Windows Relative Path Supported Namespace",
        description: "A Windows relative path that does not use an unsupported namespace prefix.",
        message: "Windows relative paths must not use unsupported namespace prefixes",
      }),
      S.makeFilter(isUsesWindowsSeparator, {
        identifier: $I`WindowsRelativePathWindowsSeparatorCheck`,
        title: "Windows Relative Path Uses Windows Separator",
        description: "A Windows relative path that contains at least one backslash separator.",
        message: "Windows relative paths must contain a Windows separator",
      }),
      S.makeFilter(P.not(isUsesPosixSeparator), {
        identifier: $I`WindowsRelativePathNoPosixSeparatorCheck`,
        title: "Windows Relative Path No Posix Separator",
        description: "A Windows relative path that does not contain the POSIX separator /.",
        message: "Windows relative paths must not contain /",
      }),
      S.makeFilter(P.not(Str.startsWith("\\\\")), {
        identifier: $I`WindowsRelativePathNotUncCheck`,
        title: "Windows Relative Path Not UNC",
        description: "A Windows relative path that does not start with a UNC prefix.",
        message: "Windows relative paths must not start with \\\\",
      }),
      S.makeFilter(P.not(isWindowsDrivePrefix), {
        identifier: $I`WindowsRelativePathNotDrivePrefixedCheck`,
        title: "Windows Relative Path Not Drive Prefixed",
        description: "A Windows relative path that does not begin with a drive prefix.",
        message: "Windows relative paths must not start with a drive prefix like C:",
      }),
      S.makeFilter(isHasLeafSegment, {
        identifier: $I`WindowsRelativePathLeafSegmentCheck`,
        title: "Windows Relative Path Leaf Segment",
        description: "A Windows relative path that includes a leaf segment and does not end with a separator.",
        message: "Windows relative paths must include a leaf segment",
      }),
      S.makeFilter(flow(splitNonEmpty(/\\+/), isWindowsSegments), {
        identifier: $I`WindowsRelativePathSegmentsCheck`,
        title: "Windows Relative Path Segments",
        description: "A Windows relative path whose segments are valid Windows path segments.",
        message: "Windows relative paths must contain valid Windows path segments",
      }),
    ],
    {
      identifier: $I`WindowsRelativePathChecks`,
      title: "Windows Relative Path",
      description: "Checks for a Windows relative path that uses backslashes and contains a leaf segment.",
    }
  )
).pipe(
  S.brand("WindowsRelativePath"),
  $I.annoteSchema("WindowsRelativePath", {
    description: "A Windows relative path that uses backslashes and contains a leaf segment.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type for {@link WindowsRelativePath}.
 *
 * **Example** (Annotate WindowsRelativePath value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WindowsRelativePath } from "@beep/schema/FilePath"
 *
 * const value: WindowsRelativePath = S.decodeUnknownSync(WindowsRelativePath)("Users\\Ada")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WindowsRelativePath = typeof WindowsRelativePath.Type;
