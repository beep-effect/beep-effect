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
 * **Example** (Decode parent directory marker)
 *
 * ```ts
 * import { WindowsDotSegment } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const parent = S.decodeUnknownSync(WindowsDotSegment)("..")
 * console.log(parent)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const WindowsDotSegment = WindowsDotSegmentKit.pipe(
  $I.annoteSchema("WindowsDotSegment", {
    description: "Windows dot-segment markers used for current and parent directory traversal.",
  })
);

/**
 * Type for {@link WindowsDotSegment}.
 *
 * **Example** (Type annotated parent marker)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WindowsDotSegment } from "@beep/schema/FilePath"
 *
 * const value: WindowsDotSegment = S.decodeUnknownSync(WindowsDotSegment)("..")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WindowsDotSegment = typeof WindowsDotSegment.Type;

/**
 * Branded schema for Windows path segments that are plain names rather than
 * separators or dot-segment markers.
 *
 * **Example** (Decode plain path segment)
 *
 * ```ts
 * import { ValidWindowsPlainPathSegment } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const segment = S.decodeUnknownSync(ValidWindowsPlainPathSegment)("documents")
 * console.log(segment)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
  })
);

/**
 * Type for {@link ValidWindowsPlainPathSegment}.
 *
 * **Example** (Type annotated plain segment)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ValidWindowsPlainPathSegment } from "@beep/schema/FilePath"
 *
 * const value: ValidWindowsPlainPathSegment = S.decodeUnknownSync(ValidWindowsPlainPathSegment)("documents")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ValidWindowsPlainPathSegment = typeof ValidWindowsPlainPathSegment.Type;

const windowsDotSegmentSet = HashSet.fromIterable(WindowsDotSegment.Options);
const isWindowsDotSegment = (value: string): value is WindowsDotSegment => HashSet.has(windowsDotSegmentSet, value);

/**
 * Branded schema for Windows root segments such as UNC server and share names.
 *
 * **Example** (Decode UNC server name)
 *
 * ```ts
 * import { ValidWindowsRootSegment } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const server = S.decodeUnknownSync(ValidWindowsRootSegment)("fileserver")
 * console.log(server)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
  })
);

/**
 * Type for {@link ValidWindowsRootSegment}.
 *
 * **Example** (Type annotated root segment)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ValidWindowsRootSegment } from "@beep/schema/FilePath"
 *
 * const value: ValidWindowsRootSegment = S.decodeUnknownSync(ValidWindowsRootSegment)("fileserver")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ValidWindowsRootSegment = typeof ValidWindowsRootSegment.Type;

/**
 * Branded schema for Windows path segments that may be either plain segments or
 * dot-segment markers.
 *
 * **Example** (Decode current directory marker)
 *
 * ```ts
 * import { ValidWindowsPathSegment } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const segment = S.decodeUnknownSync(ValidWindowsPathSegment)(".")
 * console.log(segment)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ValidWindowsPathSegment = S.Union([WindowsDotSegment, ValidWindowsPlainPathSegment]).pipe(
  S.brand("ValidWindowsPathSegment"),
  $I.annoteSchema("ValidWindowsPathSegment", {
    description: "A Windows path segment that is either a valid plain segment or a dot-segment marker.",
  })
);

/**
 * Type for {@link ValidWindowsPathSegment}.
 *
 * **Example** (Type annotated path segment)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ValidWindowsPathSegment } from "@beep/schema/FilePath"
 *
 * const value: ValidWindowsPathSegment = S.decodeUnknownSync(ValidWindowsPathSegment)(".")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ValidWindowsPathSegment = typeof ValidWindowsPathSegment.Type;

/**
 * Branded schema for a non-empty Windows path segment list.
 *
 * **Example** (Decode non-empty segment list)
 *
 * ```ts
 * import { WindowsSegments } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const segments = S.decodeUnknownSync(WindowsSegments)(["Users", "Ada"])
 * console.log(segments.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const WindowsSegments = S.NonEmptyArray(ValidWindowsPathSegment).pipe(
  S.brand("WindowsSegments"),
  $I.annoteSchema("WindowsSegments", {
    description: "A non-empty Windows path segment list.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type for {@link WindowsSegments}.
 *
 * **Example** (Type annotated segment list)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WindowsSegments } from "@beep/schema/FilePath"
 *
 * const value: WindowsSegments = S.decodeUnknownSync(WindowsSegments)(["Users", "Ada"])
 * console.log(value.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WindowsSegments = typeof WindowsSegments.Type;

/**
 * Branded schema for the tail segment list of a UNC file path after the server
 * and share segments.
 *
 * **Example** (Decode UNC rest segments)
 *
 * ```ts
 * import { ValidWindowsUncRest } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const rest = S.decodeUnknownSync(ValidWindowsUncRest)(["folder", "file.txt"])
 * console.log(rest.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ValidWindowsUncRest = S.NonEmptyArray(ValidWindowsPathSegment).pipe(
  S.brand("ValidWindowsUncRest"),
  $I.annoteSchema("ValidWindowsUncRest", {
    description: "The non-empty remainder segment list of a UNC file path after the server and share segments.",
  })
);

/**
 * Type for {@link ValidWindowsUncRest}.
 *
 * **Example** (Type annotated UNC rest)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ValidWindowsUncRest } from "@beep/schema/FilePath"
 *
 * const value: ValidWindowsUncRest = S.decodeUnknownSync(ValidWindowsUncRest)(["folder", "file.txt"])
 * console.log(value.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ValidWindowsUncRest = typeof ValidWindowsUncRest.Type;

/**
 * Branded schema for a full UNC segment list `[server, share, ...rest]`.
 *
 * **Example** (Decode full UNC segments)
 *
 * ```ts
 * import { ValidWindowsUncSegments } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const segments = S.decodeUnknownSync(ValidWindowsUncSegments)(["server", "share", "folder"])
 * console.log(segments[0])
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ValidWindowsUncSegments = S.TupleWithRest(
  S.Tuple([ValidWindowsRootSegment, ValidWindowsRootSegment, ValidWindowsPathSegment]),
  [ValidWindowsPathSegment]
).pipe(
  S.brand("ValidWindowsUncSegments"),
  $I.annoteSchema("ValidWindowsUncSegments", {
    description: "A UNC segment list with server, share, and at least one leaf segment.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type for {@link ValidWindowsUncSegments}.
 *
 * **Example** (Type annotated UNC segments)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ValidWindowsUncSegments } from "@beep/schema/FilePath"
 *
 * const value: ValidWindowsUncSegments = S.decodeUnknownSync(ValidWindowsUncSegments)(["server", "share", "folder"])
 * console.log(value[0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ValidWindowsUncSegments = typeof ValidWindowsUncSegments.Type;
