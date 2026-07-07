/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { HashSet } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import {
  $I,
  windowsInvalidSegmentCharacterRegExp,
  windowsInvalidTrailingSegmentRegExp,
  windowsSegmentWithoutSeparatorsRegExp,
} from "./FilePath.shared.ts";

const WindowsDotSegmentKit = LiteralKit([".", ".."]);

/**
 * Literal union for Windows dot-segment markers.
 *
 * @example
 * ```ts
 * import { WindowsDotSegment } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const parent = S.decodeUnknownSync(WindowsDotSegment)("..")
 * console.log(parent)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const WindowsDotSegment = WindowsDotSegmentKit.pipe(
  $I.annoteSchema("WindowsDotSegment", {
    description: "Windows dot-segment markers used for current and parent directory traversal.",
  })
);

/**
 * Type for {@link WindowsDotSegment}.
 *
 * @since 0.0.0
 * @category models
 */
export type WindowsDotSegment = typeof WindowsDotSegment.Type;

/**
 * Branded schema for Windows path segments that are plain names rather than
 * separators or dot-segment markers.
 *
 * @example
 * ```ts
 * import { ValidWindowsPlainPathSegment } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const segment = S.decodeUnknownSync(ValidWindowsPlainPathSegment)("documents")
 * console.log(segment)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const ValidWindowsPlainPathSegment = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.isPattern(windowsSegmentWithoutSeparatorsRegExp, {
        identifier: $I`WindowsPlainPathSegmentNoSeparatorsCheck`,
        title: "Windows Plain Path Segment Without Separators",
        description: "A Windows path segment that does not contain / or \\.",
        message: "Windows path segments must not contain / or \\",
      }),
      S.isPattern(windowsInvalidSegmentCharacterRegExp, {
        identifier: $I`WindowsPlainPathSegmentCharacterCheck`,
        title: "Windows Plain Path Segment Characters",
        description: 'A Windows path segment without reserved characters <>:"|?*.',
        message: 'Windows path segments must not contain <>:"|?*',
      }),
      S.isPattern(windowsInvalidTrailingSegmentRegExp, {
        identifier: $I`WindowsPlainPathSegmentTrailingCheck`,
        title: "Windows Plain Path Segment Trailing Character",
        description: "A Windows path segment that does not end with a trailing dot or space.",
        message: "Windows path segments must not end with a dot or space",
      }),
    ],
    {
      identifier: $I`ValidWindowsPlainPathSegmentChecks`,
      title: "Valid Windows Plain Path Segment",
      description: "Checks for a Windows path segment that is neither empty nor structurally invalid.",
    }
  )
).pipe(
  S.brand("ValidWindowsPlainPathSegment"),
  $I.annoteSchema("ValidWindowsPlainPathSegment", {
    description: "A non-empty Windows path segment without separators, reserved characters, or trailing dots/spaces.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ValidWindowsPlainPathSegment}.
 *
 * @since 0.0.0
 * @category models
 */
export type ValidWindowsPlainPathSegment = typeof ValidWindowsPlainPathSegment.Type;

const windowsDotSegmentSet = HashSet.fromIterable(WindowsDotSegment.Options);
const isWindowsDotSegment = (value: string): value is WindowsDotSegment => HashSet.has(windowsDotSegmentSet, value);

/**
 * Branded schema for Windows root segments such as UNC server and share names.
 *
 * @example
 * ```ts
 * import { ValidWindowsRootSegment } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const server = S.decodeUnknownSync(ValidWindowsRootSegment)("fileserver")
 * console.log(server)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const ValidWindowsRootSegment = ValidWindowsPlainPathSegment.check(
  S.makeFilter(P.not(isWindowsDotSegment), {
    identifier: $I`ValidWindowsRootSegmentCheck`,
    title: "Valid Windows Root Segment",
    description: "A Windows root segment that is not . or ..",
    message: "Windows root segments must not be . or ..",
  })
).pipe(
  S.brand("ValidWindowsRootSegment"),
  $I.annoteSchema("ValidWindowsRootSegment", {
    description: "A Windows root segment suitable for drive roots and UNC server/share segments.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ValidWindowsRootSegment}.
 *
 * @since 0.0.0
 * @category models
 */
export type ValidWindowsRootSegment = typeof ValidWindowsRootSegment.Type;

/**
 * Branded schema for Windows path segments that may be either plain segments or
 * dot-segment markers.
 *
 * @example
 * ```ts
 * import { ValidWindowsPathSegment } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const segment = S.decodeUnknownSync(ValidWindowsPathSegment)(".")
 * console.log(segment)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const ValidWindowsPathSegment = S.Union([WindowsDotSegment, ValidWindowsPlainPathSegment]).pipe(
  S.brand("ValidWindowsPathSegment"),
  $I.annoteSchema("ValidWindowsPathSegment", {
    description: "A Windows path segment that is either a valid plain segment or a dot-segment marker.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ValidWindowsPathSegment}.
 *
 * @since 0.0.0
 * @category models
 */
export type ValidWindowsPathSegment = typeof ValidWindowsPathSegment.Type;

/**
 * Branded schema for a non-empty Windows path segment list.
 *
 * @example
 * ```ts
 * import { WindowsSegments } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const segments = S.decodeUnknownSync(WindowsSegments)(["Users", "Ada"])
 * console.log(segments.length)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const WindowsSegments = S.NonEmptyArray(ValidWindowsPathSegment).pipe(
  S.brand("WindowsSegments"),
  $I.annoteSchema("WindowsSegments", {
    description: "A non-empty Windows path segment list.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link WindowsSegments}.
 *
 * @since 0.0.0
 * @category models
 */
export type WindowsSegments = typeof WindowsSegments.Type;

/**
 * Branded schema for the tail segment list of a UNC file path after the server
 * and share segments.
 *
 * @example
 * ```ts
 * import { ValidWindowsUncRest } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const rest = S.decodeUnknownSync(ValidWindowsUncRest)(["folder", "file.txt"])
 * console.log(rest.length)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const ValidWindowsUncRest = S.NonEmptyArray(ValidWindowsPathSegment).pipe(
  S.brand("ValidWindowsUncRest"),
  $I.annoteSchema("ValidWindowsUncRest", {
    description: "The non-empty remainder segment list of a UNC file path after the server and share segments.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ValidWindowsUncRest}.
 *
 * @since 0.0.0
 * @category models
 */
export type ValidWindowsUncRest = typeof ValidWindowsUncRest.Type;

/**
 * Branded schema for a full UNC segment list `[server, share, ...rest]`.
 *
 * @example
 * ```ts
 * import { ValidWindowsUncSegments } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const segments = S.decodeUnknownSync(ValidWindowsUncSegments)(["server", "share", "folder"])
 * console.log(segments[0])
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const ValidWindowsUncSegments = S.TupleWithRest(
  S.Tuple([ValidWindowsRootSegment, ValidWindowsRootSegment, ValidWindowsPathSegment]),
  [ValidWindowsPathSegment]
).pipe(
  S.brand("ValidWindowsUncSegments"),
  $I.annoteSchema("ValidWindowsUncSegments", {
    description: "A UNC segment list with server, share, and at least one leaf segment.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ValidWindowsUncSegments}.
 *
 * @since 0.0.0
 * @category models
 */
export type ValidWindowsUncSegments = typeof ValidWindowsUncSegments.Type;
