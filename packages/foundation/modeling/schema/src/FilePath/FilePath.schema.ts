/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Str, thunkTrue } from "@beep/utils";
import { Match } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { LiteralKit } from "../LiteralKit/index.ts";
import { HasNullByte, SupportedWindowsNamespace, UsesPosixSeparator, UsesWindowsSeparator } from "./FilePath.guards.ts";
import { HasLeafSegment } from "./FilePath.roots.ts";
import { $I, isWindowsDrivePrefix } from "./FilePath.shared.ts";
import { WindowsDrivePath, WindowsRelativePath, WindowsUncPath } from "./FilePath.windows.ts";

const SupportedPathFamilyKit = LiteralKit([
  "posixAbsolute",
  "posixRelative",
  "windowsDrive",
  "windowsUnc",
  "windowsRelative",
]);

/**
 * Literal union of file-path families recognized by {@link FilePath}.
 *
 * **Example** (Check supported path family)
 *
 * ```ts
 * import { SupportedPathFamily } from "@beep/schema/FilePath"
 *
 * console.log(SupportedPathFamily.Options.includes("posixAbsolute"))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SupportedPathFamily = SupportedPathFamilyKit.pipe(
  $I.annoteSchema("SupportedPathFamily", {
    description: "The supported filesystem path families recognized by FilePath.",
  })
);

/**
 * Type for {@link SupportedPathFamily}.
 *
 * **Example** (Decode path family literal)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SupportedPathFamily } from "@beep/schema/FilePath"
 *
 * const value: SupportedPathFamily = S.decodeUnknownSync(SupportedPathFamily)("posixAbsolute")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SupportedPathFamily = typeof SupportedPathFamily.Type;

const isSupportedWindowsNamespace = SupportedWindowsNamespace.is;
const isUsesPosixSeparator = UsesPosixSeparator.is;
const isUsesWindowsSeparator = UsesWindowsSeparator.is;
const isWindowsDrivePath = WindowsDrivePath.is;
const isWindowsUncPath = WindowsUncPath.is;
const isWindowsRelativePath = WindowsRelativePath.is;
const isHasNullByte = HasNullByte.is;
const isHasLeafSegment = HasLeafSegment.is;

const classifyPathFamily = Match.type<string>().pipe(
  Match.when(Str.startsWith("\\\\"), SupportedPathFamilyKit.thunk.windowsUnc),
  Match.when(isWindowsDrivePrefix, SupportedPathFamilyKit.thunk.windowsDrive),
  Match.whenAnd(isUsesPosixSeparator, Str.startsWith("/"), SupportedPathFamilyKit.thunk.posixAbsolute),
  Match.when(isUsesPosixSeparator, SupportedPathFamilyKit.thunk.posixRelative),
  Match.when(isUsesWindowsSeparator, SupportedPathFamilyKit.thunk.windowsRelative),
  Match.orElse(SupportedPathFamilyKit.thunk.posixRelative)
);

const matchesSupportedPathFamily = (value: string): boolean =>
  isSupportedWindowsNamespace(value) &&
  SupportedPathFamilyKit.$match(classifyPathFamily(value), {
    posixAbsolute: thunkTrue,
    posixRelative: thunkTrue,
    windowsDrive: () => isWindowsDrivePath(value),
    windowsUnc: () => isWindowsUncPath(value),
    windowsRelative: () => isWindowsRelativePath(value),
  });

const FilePathChecks = S.makeFilterGroup(
  [
    S.isNonEmpty({
      identifier: $I`FilePathNonEmptyCheck`,
      title: "File Path Non-empty",
      description: "A file path string that is not empty.",
      message: "File path must not be empty",
    }),
    S.makeFilter(P.not(isHasNullByte), {
      identifier: $I`FilePathNoNullByteCheck`,
      title: "File Path No Null Byte",
      description: "A file path string without embedded NUL bytes.",
      message: "File path must not contain embedded NUL bytes",
    }),
    S.makeFilter(isHasLeafSegment, {
      identifier: $I`FilePathHasLeafSegmentCheck`,
      title: "File Path Has Leaf Segment",
      description: "A file path string that includes a leaf segment and is not just a root.",
      message: "File path must include a leaf segment",
    }),
    S.makeFilter(matchesSupportedPathFamily, {
      identifier: $I`FilePathSupportedFamilyCheck`,
      title: "File Path Supported Family",
      description: "A file path string that matches a supported POSIX or Windows path family.",
      message: "File path must use supported POSIX or Windows file path syntax",
    }),
  ],
  {
    identifier: $I`FilePathChecks`,
    title: "File Path",
    description: "Checks for a file path string accepted by at least one supported filesystem path family.",
  }
);

/**
 * Branded schema for file path strings that are valid on at least one major OS.
 *
 * **Details**
 *
 * Validates POSIX absolute, POSIX relative, Windows drive, Windows UNC, and
 * Windows relative path families. Rejects empty strings, embedded NUL bytes,
 * bare root paths, and unsupported Windows namespace prefixes.
 *
 * **Example** (Decode valid file paths)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FilePath } from "@beep/schema/FilePath"
 *
 * const decode = S.decodeUnknownSync(FilePath)
 *
 * const posix = decode("/usr/local/bin/node")
 * const relative = decode("src/index.ts")
 * ```
 *
 * **Example** (Reject bare root paths)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FilePath } from "@beep/schema/FilePath"
 *
 * const is = S.is(FilePath)
 *
 * console.log(is("/")) // false -- bare root
 * console.log(is("src/index.ts")) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const FilePath = S.String.check(FilePathChecks).pipe(
  S.brand("FilePath"),
  $I.annoteSchema("FilePath", {
    description: "A file path string valid for at least one supported operating-system path family.",
  })
);

/**
 * Branded file path string type extracted from {@link FilePath}.
 *
 * **Example** (Type annotated file path)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FilePath } from "@beep/schema/FilePath"
 *
 * const value: FilePath = S.decodeUnknownSync(FilePath)("src/index.ts")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FilePath = typeof FilePath.Type;
