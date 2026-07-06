/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Eq from "effect/Equal";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { EndsWithSeparator } from "./FilePath.guards.ts";
import { $I, windowsDriveRootRegExp, windowsUncRootRegExp } from "./FilePath.shared.ts";

/**
 * Branded schema for Windows drive roots such as `C:` and `C:\\`.
 *
 * @example
 * ```ts
 * import { WindowsDriveRoot } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const root = S.decodeUnknownSync(WindowsDriveRoot)("C:\\")
 * console.log(root)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const WindowsDriveRoot = S.String.check(
  S.isPattern(windowsDriveRootRegExp, {
    identifier: $I`WindowsDriveRootCheck`,
    title: "Windows Drive Root",
    description: "A Windows drive root in the form `<letter>:` with an optional trailing separator.",
    message: "Windows drive roots must look like C: or C:\\",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(/^[A-Za-z]:[\\/]?$/),
  })
  .pipe(
    S.brand("WindowsDriveRoot"),
    $I.annoteSchema("WindowsDriveRoot", {
      description: "A Windows drive root such as C: or C:\\.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Type for {@link WindowsDriveRoot}.
 *
 * @since 0.0.0
 * @category models
 */
export type WindowsDriveRoot = typeof WindowsDriveRoot.Type;

/**
 * Branded schema for UNC roots such as `\\\\server\\share`.
 *
 * @example
 * ```ts
 * import { WindowsUncRoot } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const root = S.decodeUnknownSync(WindowsUncRoot)("\\\\server\\share")
 * console.log(root)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const WindowsUncRoot = S.String.check(
  S.isPattern(windowsUncRootRegExp, {
    identifier: $I`WindowsUncRootCheck`,
    title: "Windows UNC Root",
    description: "A UNC root in the form \\\\server\\share without a trailing separator.",
    message: "Windows UNC roots must look like \\\\server\\share",
  })
).pipe(
  S.brand("WindowsUncRoot"),
  $I.annoteSchema("WindowsUncRoot", {
    description: "A Windows UNC root such as \\\\server\\share.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link WindowsUncRoot}.
 *
 * @since 0.0.0
 * @category models
 */
export type WindowsUncRoot = typeof WindowsUncRoot.Type;

const isEndsWithSeparator = EndsWithSeparator.is;
const isWindowsDriveRoot = WindowsDriveRoot.is;
const isWindowsUncRoot = WindowsUncRoot.is;

/**
 * Branded schema for path strings that include a non-root leaf segment.
 *
 * @example
 * ```ts
 * import { HasLeafSegment } from "@beep/schema/FilePath"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(HasLeafSegment)("src/index.ts")
 * console.log(path)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const HasLeafSegment = S.NonEmptyString.check(
  S.makeFilterGroup(
    [
      S.makeFilter(P.not(Eq.equals("/")), {
        identifier: $I`HasLeafSegmentNotPosixRootCheck`,
        title: "Has Leaf Segment Not Posix Root",
        description: "A path that is not exactly the POSIX root /.",
        message: "File paths must not be the POSIX root /",
      }),
      S.makeFilter(P.not(isEndsWithSeparator), {
        identifier: $I`HasLeafSegmentNoTrailingSeparatorCheck`,
        title: "Has Leaf Segment No Trailing Separator",
        description: "A path that does not end with a trailing path separator.",
        message: "File paths must not end with a path separator",
      }),
      S.makeFilter(P.not(isWindowsDriveRoot), {
        identifier: $I`HasLeafSegmentNotWindowsDriveRootCheck`,
        title: "Has Leaf Segment Not Windows Drive Root",
        description: "A path that is not only a Windows drive root.",
        message: "File paths must not be only a Windows drive root",
      }),
      S.makeFilter(P.not(isWindowsUncRoot), {
        identifier: $I`HasLeafSegmentNotWindowsUncRootCheck`,
        title: "Has Leaf Segment Not Windows UNC Root",
        description: "A path that is not only a Windows UNC root.",
        message: "File paths must not be only a Windows UNC root",
      }),
    ],
    {
      identifier: $I`HasLeafSegmentChecks`,
      title: "Has Leaf Segment",
      description: "Checks for a path string that includes a concrete leaf segment.",
    }
  )
).pipe(
  S.brand("HasLeafSegment"),
  $I.annoteSchema("HasLeafSegment", {
    description: "A non-empty path string that is not just a root and does not end with a separator.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link HasLeafSegment}.
 *
 * @since 0.0.0
 * @category models
 */
export type HasLeafSegment = typeof HasLeafSegment.Type;
