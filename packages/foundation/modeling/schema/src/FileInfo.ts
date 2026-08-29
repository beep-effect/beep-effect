/**
 * Schemas for normalized file-system stat metadata.
 *
 * **Details**
 *
 * File-system entry kinds are represented as a `type`-discriminated union.
 * Platform-dependent stat fields decode to `Option` and default to `None` when
 * omitted during construction.
 *
 * **Example** (Construct a File stat)
 *
 * ```ts
 * import { FileInfo } from "@beep/schema/FileInfo";
 * import { FileSystem } from "effect";
 *
 * const info = FileInfo.cases.File.make({ dev: 1, mode: 0o644, size: FileSystem.Size(12n) });
 *
 * console.log(info.type); // "File"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import { LiteralKit } from "./LiteralKit/index.ts";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("FileInfo");

const FileInfoSize = S.BigInt.pipe(
  S.brand("Size"),
  $I.annoteSchema("FileInfoSize", {
    description: "A file-system entry size or block size measured in bytes.",
  })
);

const OptionalStatDate = (description: string) =>
  S.Date.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({ description });

const OptionalStatFinite = (description: string) =>
  S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({ description });

const OptionalStatSize = (description: string) =>
  FileInfoSize.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({ description });

/**
 * File-system entry kinds recognized by {@link FileInfo}.
 *
 * **Details**
 *
 * The attached `makeMember` helper builds a tagged stat schema for each entry
 * kind while keeping the shared metadata fields consistent across the union.
 *
 * **Example** (Pick an entry kind)
 *
 * ```ts import.meta.vitest name="Pick an entry kind"
 * import { FileInfoType } from "@beep/schema/FileInfo";
 *
 * const kind: FileInfoType = FileInfoType.Enum.SymbolicLink;
 *
 * kind // => "SymbolicLink"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileInfoType = LiteralKit([
  "File",
  "Directory",
  "SymbolicLink",
  "BlockDevice",
  "CharacterDevice",
  "FIFO",
  "Socket",
  "Unknown",
])
  .annotate(
    $I.annote("FileInfoType", {
      description: "The supported kinds of file-system entries, with a helper for constructing union members.",
    })
  )
  .pipe(
    SchemaUtils.withStatics((schema) => ({
      makeMember: <const Type extends typeof schema.Type>(typeLiteral: S.Literal<Type>) =>
        S.Struct({
          type: S.tag(typeLiteral.literal),
          mtime: OptionalStatDate("Last content-modification time when reported by the file system."),
          atime: OptionalStatDate("Last access time when reported by the file system."),
          birthtime: OptionalStatDate("Creation time when reported by the file system."),
          dev: S.Finite.annotateKey({ description: "Numeric identifier of the device containing the entry." }),
          ino: OptionalStatFinite("Inode number when reported by the file system."),
          mode: S.Finite.annotateKey({ description: "Numeric file type and permission mode bits." }),
          nlink: OptionalStatFinite("Hard-link count when reported by the file system."),
          uid: OptionalStatFinite("Owner user identifier when reported by the file system."),
          gid: OptionalStatFinite("Owner group identifier when reported by the file system."),
          rdev: OptionalStatFinite("Device identifier for special files when reported by the file system."),
          size: FileInfoSize.annotateKey({ description: "Entry size in bytes." }),
          blksize: OptionalStatSize("Preferred I/O block size in bytes when reported by the file system."),
          blocks: OptionalStatFinite("Allocated block count when reported by the file system."),
        }),
    }))
  );

/**
 * Runtime type for {@link FileInfoType}.
 *
 * **Example** (Use the literal type)
 *
 * ```ts import.meta.vitest name="Use the literal type"
 * import { FileInfoType } from "@beep/schema/FileInfo";
 *
 * const kind: FileInfoType = FileInfoType.Enum.Directory;
 *
 * kind // => "Directory"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FileInfoType = typeof FileInfoType.Type;

/**
 * Discriminated schema for normalized file-system stat metadata.
 *
 * **Details**
 *
 * Constructors are available under `FileInfo.cases`. Optional timestamps,
 * identifiers, and allocation fields default to `Option.none()` when omitted.
 *
 * **Example** (Construct a Directory stat)
 *
 * ```ts
 * import { FileInfo } from "@beep/schema/FileInfo";
 * import { FileSystem } from "effect";
 *
 * const info = FileInfo.cases.Directory.make({ dev: 1, mode: 0o755, size: FileSystem.Size(0n) });
 *
 * console.log(info.type); // "Directory"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileInfo = FileInfoType.mapMembers(
  Tuple.evolve([
    FileInfoType.makeMember,
    FileInfoType.makeMember,
    FileInfoType.makeMember,
    FileInfoType.makeMember,
    FileInfoType.makeMember,
    FileInfoType.makeMember,
    FileInfoType.makeMember,
    FileInfoType.makeMember,
  ])
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("FileInfo", {
    description: "File-system stat metadata discriminated by entry kind.",
    documentation:
      "Provides one case constructor per FileInfoType and represents platform-dependent stat fields as Option values.",
  })
);

/**
 * Runtime type for {@link FileInfo}.
 *
 * **Example** (Type a stat value)
 *
 * ```typescript
 * import { FileInfo } from "@beep/schema/FileInfo";
 * import { FileSystem } from "effect";
 *
 * const info: FileInfo = FileInfo.cases.Socket.make({ dev: 1, mode: 0o600, size: FileSystem.Size(0n) });
 *
 * console.log(info.type); // "Socket"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FileInfo = typeof FileInfo.Type;
