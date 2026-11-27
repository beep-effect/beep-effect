/**
 * Workspace value schemas.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import { FilePath, WindowsDrivePath, WindowsUncPath } from "@beep/schema/FilePath";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";

const $I = $WorkspaceDomainId.create("entities/Workspace/Workspace.values");

const isAbsoluteWindowsDrivePath = (value: string): boolean =>
  S.is(WindowsDrivePath)(value) && /^[A-Za-z]:[\\/]/u.test(value);

const isAbsoluteVaultRootPath = (value: string): boolean =>
  S.is(FilePath)(value) &&
  (Str.startsWith("/")(value) || isAbsoluteWindowsDrivePath(value) || S.is(WindowsUncPath)(value));

const WorkspaceVaultRootPathChecks = S.makeFilter(
  isAbsoluteVaultRootPath,
  $I.annote("WorkspaceVaultRootPathAbsoluteCheck", {
    title: "Workspace Vault Root Absolute Path",
    description: "A workspace vault root path must be an absolute POSIX, Windows drive, or Windows UNC path.",
    message: "Workspace vault root path must be absolute.",
  })
);

const stripTrailingSeparators = Str.replace(/([^:/\\])[\\/]+$/u, "$1");

const WorkspaceVaultRootPathValue = S.String.check(WorkspaceVaultRootPathChecks).pipe(
  S.brand("WorkspaceVaultRootPath")
);

/**
 * **Details**
 *
 * Decoding normalizes trailing path separators, so `"/tmp/vault/"` and
 * `"/tmp/vault"` decode to the same value. Separators are dropped only after a
 * segment character, so a bare root (`"/"`, `"C:\"`, `"\\host\share"`) reaches the
 * absolute-path check unchanged.
 *
 * **Example** (Decode trailing-slash vault path)
 *
 * ```ts
 * import { WorkspaceVaultRootPath } from "@beep/workspace-domain/entities/Workspace"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(WorkspaceVaultRootPath)("/tmp/beep-documents-vault/")
 * console.log(path) // "/tmp/beep-documents-vault"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const WorkspaceVaultRootPath = S.String.pipe(
  S.decodeTo(WorkspaceVaultRootPathValue, {
    decode: SchemaGetter.transform(stripTrailingSeparators),
    encode: SchemaGetter.transform(stripTrailingSeparators),
  }),
  $I.annoteSchema("WorkspaceVaultRootPath", {
    description: "Absolute local filesystem path configured as the workspace vault root.",
  })
);

/**
 * @category value-objects
 * @since 0.0.0
 */
export type WorkspaceVaultRootPath = typeof WorkspaceVaultRootPath.Type;
