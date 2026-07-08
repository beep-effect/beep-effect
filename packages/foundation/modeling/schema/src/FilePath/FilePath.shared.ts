/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import { A, Str, thunkFalse, thunkTrue } from "@beep/utils";
import { flow, Match } from "effect";
import * as O from "effect/Option";

/**
 * Internal identity composer.
 *
 * @example
 * ```ts
 * import { $I } from "../../src/FilePath/FilePath.shared.ts"
 *
 * const identifier = $I`ExampleCheck`
 * console.log(identifier)
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const $I = $SchemaId.create("FilePath");

/**
 * Matches strings beginning with a Windows drive letter prefix such as `C:`.
 *
 * @example
 * ```ts
 * import { windowsDrivePrefixRegExp } from "../../src/FilePath/FilePath.shared.ts"
 *
 * console.log(windowsDrivePrefixRegExp.test("C:\\Users"))
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const windowsDrivePrefixRegExp = /^[A-Za-z]:/;
/**
 * Matches a full Windows drive root such as `C:` or `C:\`.
 *
 * @example
 * ```ts
 * import { windowsDriveRootRegExp } from "../../src/FilePath/FilePath.shared.ts"
 *
 * console.log(windowsDriveRootRegExp.test("C:\\"))
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const windowsDriveRootRegExp = /^[A-Za-z]:[\\/]?$/;
/**
 * Matches strings beginning with the Windows UNC prefix `\\`.
 *
 * @example
 * ```ts
 * import { windowsUncPrefixRegExp } from "../../src/FilePath/FilePath.shared.ts"
 *
 * console.log(windowsUncPrefixRegExp.test("\\\\server\\share"))
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const windowsUncPrefixRegExp = /^\\\\/;
/**
 * Matches a full Windows UNC root such as `\\server\share`.
 *
 * @example
 * ```ts
 * import { windowsUncRootRegExp } from "../../src/FilePath/FilePath.shared.ts"
 *
 * console.log(windowsUncRootRegExp.test("\\\\server\\share"))
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const windowsUncRootRegExp = /^\\\\[^\\/]+\\[^\\/]+$/;
/**
 * Matches a Windows path segment containing no path separators.
 *
 * @example
 * ```ts
 * import { windowsSegmentWithoutSeparatorsRegExp } from "../../src/FilePath/FilePath.shared.ts"
 *
 * console.log(windowsSegmentWithoutSeparatorsRegExp.test("documents"))
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const windowsSegmentWithoutSeparatorsRegExp = /^[^\\/]+$/;
/**
 * Matches a Windows path segment containing none of the reserved characters
 * `<>:"|?*`.
 *
 * @example
 * ```ts
 * import { windowsInvalidSegmentCharacterRegExp } from "../../src/FilePath/FilePath.shared.ts"
 *
 * console.log(windowsInvalidSegmentCharacterRegExp.test("documents"))
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const windowsInvalidSegmentCharacterRegExp = /^[^<>:"|?*]+$/;
/**
 * Matches a Windows path segment that does not end with a trailing dot or
 * space.
 *
 * @example
 * ```ts
 * import { windowsInvalidTrailingSegmentRegExp } from "../../src/FilePath/FilePath.shared.ts"
 *
 * console.log(windowsInvalidTrailingSegmentRegExp.test("documents"))
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const windowsInvalidTrailingSegmentRegExp = /^(?!.*[ .]$).+$/;

const matchesPattern =
  (pattern: RegExp) =>
  (value: string): boolean =>
    O.isSome(Str.match(pattern)(value));

/**
 * Split a string on a separator and drop empty segments.
 *
 * @example
 * ```ts
 * import { splitNonEmpty } from "../../src/FilePath/FilePath.shared.ts"
 *
 * const segments = splitNonEmpty("/")("/usr//local/bin")
 * console.log(segments)
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const splitNonEmpty = (separator: string | RegExp) => flow(Str.split(separator), A.filter(Str.isNonEmpty));

/**
 * Check whether a path string starts with an unsupported Windows device
 * namespace prefix (`\\?\` or `\\.\`).
 *
 * @example
 * ```ts
 * import { usesUnsupportedWindowsNamespacePrefix } from "../../src/FilePath/FilePath.shared.ts"
 *
 * console.log(usesUnsupportedWindowsNamespacePrefix("\\\\?\\C:\\Users"))
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const usesUnsupportedWindowsNamespacePrefix = Match.type<string>().pipe(
  Match.whenOr(Str.startsWith("\\\\?\\"), Str.startsWith("\\\\.\\"), thunkTrue),
  Match.orElse(thunkFalse)
);

/**
 * Check whether a string starts with a Windows drive letter prefix.
 *
 * @example
 * ```ts
 * import { isWindowsDrivePrefix } from "../../src/FilePath/FilePath.shared.ts"
 *
 * console.log(isWindowsDrivePrefix("C:\\Users"))
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const isWindowsDrivePrefix = matchesPattern(windowsDrivePrefixRegExp);
