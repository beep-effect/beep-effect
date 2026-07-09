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
import * as Str from "effect/String";

const $I = $WorkspaceDomainId.create("entities/Workspace/Workspace.values");

const isFilePath = S.is(FilePath);
const isAbsoluteWindowsDrivePath = (value: string): boolean =>
  WindowsDrivePath.is(value) && /^[A-Za-z]:[\\/]/u.test(value);

const isAbsoluteVaultRootPath = (value: string): boolean =>
  isFilePath(value) && (Str.startsWith("/")(value) || isAbsoluteWindowsDrivePath(value) || WindowsUncPath.is(value));

const WorkspaceVaultRootPathChecks = S.makeFilter(isAbsoluteVaultRootPath, {
  identifier: $I`WorkspaceVaultRootPathAbsoluteCheck`,
  title: "Workspace Vault Root Absolute Path",
  description: "A workspace vault root path must be an absolute POSIX, Windows drive, or Windows UNC path.",
  message: "Workspace vault root path must be absolute.",
});

/**
 * Absolute local root path for a workspace document vault.
 *
 * @example
 * ```ts
 * import { WorkspaceVaultRootPath } from "@beep/workspace-domain/entities/Workspace"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(WorkspaceVaultRootPath)("/tmp/beep-documents-vault")
 * console.log(path)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const WorkspaceVaultRootPath = S.String.check(WorkspaceVaultRootPathChecks).pipe(
  S.brand("WorkspaceVaultRootPath"),
  $I.annoteSchema("WorkspaceVaultRootPath", {
    description: "Absolute local filesystem path configured as the workspace vault root.",
  })
);

/**
 * {@inheritDoc WorkspaceVaultRootPath}
 *
 * @category value-objects
 * @since 0.0.0
 */
export type WorkspaceVaultRootPath = typeof WorkspaceVaultRootPath.Type;
