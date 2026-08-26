/**
 * Portable file-name schema helpers for strings shaped like `basename.ext`.
 *
 * **Details**
 *
 * The basename must be non-empty and may include additional dots, while the
 * final extension segment must be one of the known {@link FileExtension}
 * values.
 *
 * **Example** (Decode basename with extension)
 *
 * ```ts import.meta.vitest name="Decode basename with extension"
 * import * as S from "effect/Schema";
 * import { FileName } from "@beep/schema/FileName";
 *
 * const decodeFileName = S.decodeUnknownSync(FileName);
 *
 * decodeFileName("readme.txt");
 * decodeFileName("archive.tar.gz");
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { flow, HashSet, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FileExtension } from "./FileExtension.ts";
import { HasNullByte, UsesPosixSeparator, UsesWindowsSeparator } from "./FilePath/index.ts";

const $I = $SchemaId.create("FileName");

const fileExtensionSet = HashSet.fromIterable(FileExtension.Options);
const isHasNullByte = HasNullByte.is;
const isFileExtension = (value: string): value is FileExtension => HashSet.has(fileExtensionSet, value);
const isNonEmptyString = S.is(S.NonEmptyString);
const isUsesPosixSeparator = UsesPosixSeparator.is;
const isUsesWindowsSeparator = UsesWindowsSeparator.is;

const fileNameLastDotIndex = (value: string): number =>
  pipe(
    Str.lastIndexOf(".")(value),
    O.getOrElse(() => -1)
  );

const fileNameStem = (value: string): string => {
  const index = fileNameLastDotIndex(value);
  return index < 0 ? "" : pipe(value, Str.slice(0, index));
};

const fileNameExtension = (value: string): string => {
  const index = fileNameLastDotIndex(value);
  return index < 0 ? "" : pipe(value, Str.slice(index + 1));
};

const FileNameChecks = S.makeFilterGroup(
  [
    S.makeFilter(flow(fileNameStem, isNonEmptyString), {
      identifier: $I`FileNameStemNonEmptyCheck`,
      title: "File Name Stem Non Empty",
      description: "A file name with a non-empty stem before the final extension separator.",
      message: "File name stems must not be empty",
    }),
    S.makeFilter(flow(fileNameStem, P.not(isHasNullByte)), {
      identifier: $I`FileNameStemNoNullByteCheck`,
      title: "File Name Stem No Null Byte",
      description: "A file-name stem without embedded NUL bytes.",
      message: "File name stems must not contain embedded NUL bytes",
    }),
    S.makeFilter(flow(fileNameStem, P.not(isUsesPosixSeparator)), {
      identifier: $I`FileNameStemNoPosixSeparatorCheck`,
      title: "File Name Stem No Posix Separator",
      description: "A file-name stem that does not contain the POSIX path separator /.",
      message: "File name stems must not contain /",
    }),
    S.makeFilter(flow(fileNameStem, P.not(isUsesWindowsSeparator)), {
      identifier: $I`FileNameStemNoWindowsSeparatorCheck`,
      title: "File Name Stem No Windows Separator",
      description: "A file-name stem that does not contain the Windows path separator \\.",
      message: "File name stems must not contain \\",
    }),
    S.makeFilter(flow(fileNameExtension, isFileExtension), {
      identifier: $I`FileNameKnownExtensionCheck`,
      title: "File Name Known Extension",
      description: "A file name whose final extension segment is a known file extension.",
      message: "File names must end with a known file extension",
    }),
  ],
  {
    identifier: $I`FileNameChecks`,
    title: "File Name",
    description: "Checks for a portable file name with a non-empty stem and known final extension.",
  }
);

/**
 * Schema for portable file names with a non-empty basename and known file extension.
 *
 * **Details**
 *
 * This schema follows the same portability policy as {@link FilePath}: it
 * rejects universal filename hazards such as path separators and embedded NUL
 * bytes while still allowing names that are valid on at least one major
 * operating system.
 *
 * **Example** (Decode portable file names)
 *
 * ```ts import.meta.vitest name="Decode portable file names"
 * import * as S from "effect/Schema";
 * import { FileName } from "@beep/schema/FileName";
 *
 * const decodeFileName = S.decodeUnknownSync(FileName);
 *
 * decodeFileName("photo.png");
 * decodeFileName(".cache.png");
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
const FileNameSchema = S.String.check(FileNameChecks).pipe(
  (schema) =>
    schema.annotate({
      toArbitrary: () => (fc) =>
        fc
          .tuple(fc.stringMatching(/^[^ /\\.]+(?:\.[^ /\\.]+)*$/), fc.constantFrom(...FileExtension.Options))
          .map(([stem, ext]) => `${stem}.${ext}` as `${string}.${FileExtension}`),
    }),
  $I.annoteSchema("FileName", {
    description: "A portable file name in the format basename.ext.",
    documentation:
      "Requires a non-empty basename before the final dot, allows additional dots in the basename, and validates the final extension against FileExtension.",
  })
);

/**
 * Portable file name schema.
 *
 * **Example** (Decode a file name)
 *
 * ```ts import.meta.vitest name="Decode a file name"
 * import { FileName } from "@beep/schema/FileName"
 * import * as S from "effect/Schema"
 *
 * const fileName = S.decodeUnknownSync(FileName)("readme.txt")
 * console.log(fileName)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const FileName: S.Codec<`${string}.${string}`, `${string}.${string}`> = FileNameSchema as unknown as S.Codec<
  `${string}.${string}`,
  `${string}.${string}`
>;

/**
 * Type for {@link FileName}.
 *
 * **Example** (Type a decoded file name)
 *
 * ```ts import.meta.vitest name="Type a decoded file name"
 * import * as S from "effect/Schema"
 * import { FileName } from "@beep/schema/FileName"
 *
 * const file: FileName = S.decodeUnknownSync(FileName)("readme.txt")
 * file // => "readme.txt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileName = typeof FileName.Type;
