/**
 * Versioned, secure-runner migration-map schemas for Box content migration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { Sha256Hex } from "@beep/schema";
import { Effect, MutableHashSet } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { BoxContentMigrationMapError, BoxProvisioningSchemaError } from "./BoxProvisioningErrors.ts";
import { BoxFolderName, BoxSourceRevision } from "./BoxProvisioningIntent.ts";
import { BoxProviderId } from "./BoxProvisioningObserved.ts";
import { contentDestinationKey, requiredContentFolders } from "./internal/contentMigration.ts";

const $I = $BoxProvisioningId.create("BoxContentMigrationMap");

/**
 * Provider-compatible Box file name accepted by a content-migration map.
 *
 * **Details**
 *
 * The rule is the package's Box folder-name rule (1–255 characters, no slash,
 * backslash, or non-printable ASCII, not `.` or `..`, no trailing whitespace)
 * plus a ban on leading whitespace, which Box strips from uploaded file names.
 *
 * **Example** (Create a valid Box file name)
 *
 * ```ts
 * import { BoxFileName } from "@beep/box-provisioning/BoxContentMigrationMap"
 *
 * console.log(BoxFileName.make("engagement-letter.pdf"))
 * ```
 *
 * @see {@link https://developer.box.com/reference/post-files-content} for the upload name contract.
 * @category value-objects
 * @since 0.0.0
 */
export const BoxFileName = BoxFolderName.check(
  S.makeFilter((value: string) => Eq.equals(Str.trimStart(value), value), {
    identifier: $I`BoxFileNameLeadingWhitespaceCheck`,
    title: "Box File Name Leading Whitespace",
    description: "A Box file name without leading whitespace.",
    message: "Box file names must not start with whitespace",
  })
).pipe(
  $I.annoteSchema("BoxFileName", {
    description: "Destination file name accepted by Box's documented upload contract.",
  })
);

/**
 * Runtime type for {@link BoxFileName}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxFileName = typeof BoxFileName.Type;

/**
 * Bounded lowercase token grouping migration files for plan counts.
 *
 * **Example** (Create a rule identifier)
 *
 * ```ts
 * import { BoxContentMigrationRuleId } from "@beep/box-provisioning/BoxContentMigrationMap"
 *
 * console.log(BoxContentMigrationRuleId.make("closed-matters"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const BoxContentMigrationRuleId = S.String.check(
  S.isPattern(/^[a-z0-9-]{1,64}$/u, {
    identifier: $I`BoxContentMigrationRuleIdCheck`,
    title: "Box Content Migration Rule Identifier",
    description: "A lowercase rule token containing 1 to 64 letters, digits, or hyphens.",
    message: "Box content migration rule identifiers must match ^[a-z0-9-]{1,64}$",
  })
).pipe(
  S.brand("BoxContentMigrationRuleId"),
  $I.annoteSchema("BoxContentMigrationRuleId", {
    description: "Bounded opaque rule token safe for grouped counts in a redacted plan.",
  })
);

/**
 * Runtime type for {@link BoxContentMigrationRuleId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentMigrationRuleId = typeof BoxContentMigrationRuleId.Type;

/**
 * Source file location relative to the map's `sourceRoot`.
 *
 * **Details**
 *
 * The path must be non-empty, must not be absolute (POSIX root, backslash
 * root, or drive letter), and must not contain a `..` segment, so resolving it
 * can never leave `sourceRoot`.
 *
 * **Example** (Create a relative source path)
 *
 * ```ts
 * import { BoxContentSourceRelativePath } from "@beep/box-provisioning/BoxContentMigrationMap"
 *
 * console.log(BoxContentSourceRelativePath.make("matters/alpha/letter.pdf"))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BoxContentSourceRelativePath = S.String.check(
  S.isPattern(/^(?![/\\])(?![A-Za-z]:)(?!.*(?:^|[/\\])\.\.(?:[/\\]|$))[^\u0000]+$/u, {
    identifier: $I`BoxContentSourceRelativePathCheck`,
    title: "Box Content Source Relative Path",
    description: "A non-empty relative path without a parent-directory segment or NUL character.",
    message: "Source paths must be relative and must not contain a .. segment",
  })
).pipe(
  $I.annoteSchema("BoxContentSourceRelativePath", {
    description: "Relative local source path that cannot escape the migration source root.",
  })
);

/**
 * Runtime type for {@link BoxContentSourceRelativePath}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentSourceRelativePath = typeof BoxContentSourceRelativePath.Type;

/**
 * Destination folder path, from the first folder below the root to the leaf.
 *
 * **Example** (Create a folder path)
 *
 * ```ts
 * import { BoxContentFolderPath } from "@beep/box-provisioning/BoxContentMigrationMap"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BoxContentFolderPath)(["Clients", "Alpha"]))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BoxContentFolderPath = S.NonEmptyArray(BoxFolderName).pipe(
  $I.annoteSchema("BoxContentFolderPath", {
    description: "Non-empty ordered Box folder names below the migration root folder.",
  })
);

/**
 * Runtime type for {@link BoxContentFolderPath}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentFolderPath = typeof BoxContentFolderPath.Type;

/**
 * Folder that must exist below the migration root even when it receives no file.
 *
 * **Example** (Declare an empty destination folder)
 *
 * ```ts
 * import { BoxContentMigrationFolder } from "@beep/box-provisioning/BoxContentMigrationMap"
 *
 * const folder = BoxContentMigrationFolder.make({ path: ["Clients", "Alpha", "Correspondence"] })
 * console.log(folder.path.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentMigrationFolder extends S.Class<BoxContentMigrationFolder>($I`BoxContentMigrationFolder`)(
  { path: BoxContentFolderPath },
  $I.annote("BoxContentMigrationFolder", {
    description: "Required destination folder path below the migration root folder.",
  })
) {}

/**
 * One local source file and its destination inside the Box tree.
 *
 * **Details**
 *
 * `folderPath` is implicitly a required folder, as is every ancestor of it.
 * `ruleId` only groups upload counts on the redacted plan.
 *
 * **Example** (Declare one migrated file)
 *
 * ```ts
 * import {
 *   BoxContentMigrationFile,
 *   BoxContentMigrationRuleId
 * } from "@beep/box-provisioning/BoxContentMigrationMap"
 * import { Sha256Hex } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const file = BoxContentMigrationFile.make({
 *   fileName: "letter.pdf",
 *   folderPath: ["Clients", "Alpha"],
 *   ruleId: O.some(BoxContentMigrationRuleId.make("closed-matters")),
 *   sha256: Sha256Hex.make("a".repeat(64)),
 *   sizeBytes: 1024,
 *   sourceRelativePath: "alpha/letter.pdf"
 * })
 * console.log(file.sizeBytes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentMigrationFile extends S.Class<BoxContentMigrationFile>($I`BoxContentMigrationFile`)(
  {
    sourceRelativePath: BoxContentSourceRelativePath,
    sha256: Sha256Hex,
    sizeBytes: S.Natural,
    folderPath: BoxContentFolderPath,
    fileName: BoxFileName,
    ruleId: S.OptionFromOptionalKey(BoxContentMigrationRuleId).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("BoxContentMigrationFile", {
    description: "Local source file identity, content hash, size, and Box destination.",
  })
) {}

/**
 * Secure-runner document mapping local source files into an anchored Box folder tree.
 *
 * **Gotchas**
 *
 * The map carries folder names, file names, and local paths. It stays in the
 * secure runner; only the redacted plan, receipt, and journal leave it.
 *
 * **Example** (Create an empty migration map)
 *
 * ```ts
 * import { BoxContentMigrationMap } from "@beep/box-provisioning/BoxContentMigrationMap"
 * import { BoxSourceRevision } from "@beep/box-provisioning/BoxProvisioningIntent"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * const map = BoxContentMigrationMap.make({
 *   expectedEnterpriseId: BoxProviderId.make("enterprise-id"),
 *   expectedSubjectId: BoxProviderId.make("service-account-id"),
 *   files: [],
 *   folders: [],
 *   rootFolderId: BoxProviderId.make("100"),
 *   sourceRevision: BoxSourceRevision.make("map-1"),
 *   sourceRoot: "/srv/migration/source"
 * })
 * console.log(map.version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentMigrationMap extends S.Class<BoxContentMigrationMap>($I`BoxContentMigrationMap`)(
  {
    version: S.Literal("box-content-migration-map/v1").pipe(
      S.withConstructorDefault(Effect.succeed("box-content-migration-map/v1"))
    ),
    sourceRevision: BoxSourceRevision,
    expectedEnterpriseId: BoxProviderId,
    expectedSubjectId: BoxProviderId,
    rootFolderId: BoxProviderId,
    sourceRoot: S.NonEmptyString,
    folders: S.Array(BoxContentMigrationFolder),
    files: S.Array(BoxContentMigrationFile),
  },
  $I.annote("BoxContentMigrationMap", {
    description: "Versioned confidential mapping of local source files into an anchored Box folder tree.",
  })
) {}

const decodeUnknownBoxContentMigrationMap = S.decodeUnknownEffect(BoxContentMigrationMap);

const mapError = (reason: BoxContentMigrationMapError["reason"], violationCount: number) =>
  BoxContentMigrationMapError.make({ reason, violationCount });

/**
 * Enforces the cross-entry destination rules of a decoded migration map.
 *
 * **Details**
 *
 * Names are compared with Box's provider-equivalent sibling rule
 * (case-insensitive, trailing whitespace trimmed). The map is rejected when two
 * files share one destination, or when a file's destination equals a declared
 * or implied folder path. Whether `sourceRoot` is absolute is checked by the
 * migration service, which owns the platform path rules.
 *
 * **Example** (Validate an empty map)
 *
 * ```ts
 * import {
 *   BoxContentMigrationMap,
 *   validateBoxContentMigrationMap
 * } from "@beep/box-provisioning/BoxContentMigrationMap"
 * import { BoxSourceRevision } from "@beep/box-provisioning/BoxProvisioningIntent"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * const program = validateBoxContentMigrationMap(
 *   BoxContentMigrationMap.make({
 *     expectedEnterpriseId: BoxProviderId.make("enterprise-id"),
 *     expectedSubjectId: BoxProviderId.make("service-account-id"),
 *     files: [],
 *     folders: [],
 *     rootFolderId: BoxProviderId.make("100"),
 *     sourceRevision: BoxSourceRevision.make("map-1"),
 *     sourceRoot: "/srv/migration/source"
 *   })
 * )
 * console.log(program)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateBoxContentMigrationMap = Effect.fn("BoxContentMigrationMap.validate")(function* (
  map: BoxContentMigrationMap
): Effect.fn.Return<BoxContentMigrationMap, BoxContentMigrationMapError> {
  const destinations = MutableHashSet.empty<string>();
  const duplicateCount = A.reduce(map.files, 0, (count, file) => {
    const key = contentDestinationKey(file);
    if (MutableHashSet.has(destinations, key)) {
      return count + 1;
    }
    MutableHashSet.add(destinations, key);
    return count;
  });
  if (duplicateCount > 0) {
    return yield* mapError("duplicate-destination", duplicateCount);
  }
  const collisionCount = A.length(
    A.filter(requiredContentFolders(map), (folder) => MutableHashSet.has(destinations, folder.pathKey))
  );
  if (collisionCount > 0) {
    return yield* mapError("file-folder-name-collision", collisionCount);
  }
  return map;
});

/**
 * Decode and validate a secure migration-map value before any provider access.
 *
 * **Details**
 *
 * Shape failures become a sanitized `BoxProvisioningSchemaError` with stage
 * `migration-map`; cross-entry failures become `BoxContentMigrationMapError`.
 * Neither carries a name or a path.
 *
 * **Example** (Decode a minimal migration map)
 *
 * ```ts
 * import { decodeBoxContentMigrationMap } from "@beep/box-provisioning/BoxContentMigrationMap"
 *
 * const program = decodeBoxContentMigrationMap({
 *   expectedEnterpriseId: "enterprise-id",
 *   expectedSubjectId: "service-account-id",
 *   files: [],
 *   folders: [{ path: ["Clients"] }],
 *   rootFolderId: "100",
 *   sourceRevision: "map-1",
 *   sourceRoot: "/srv/migration/source",
 *   version: "box-content-migration-map/v1"
 * })
 * console.log(program)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeBoxContentMigrationMap = (
  value: unknown
): Effect.Effect<BoxContentMigrationMap, BoxProvisioningSchemaError | BoxContentMigrationMapError> =>
  decodeUnknownBoxContentMigrationMap(value).pipe(
    Effect.mapError(() => BoxProvisioningSchemaError.make({ stage: "migration-map" })),
    Effect.flatMap(validateBoxContentMigrationMap)
  );
