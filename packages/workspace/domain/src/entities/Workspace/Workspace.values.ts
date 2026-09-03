/**
 * Workspace value schemas.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import { FilePath, WindowsDrivePath, WindowsUncPath } from "@beep/schema/FilePath";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { SchemaGetter } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $WorkspaceDomainId.create("entities/Workspace/Workspace.values");

const isAbsoluteWindowsDrivePath = (value: string): boolean =>
  WindowsDrivePath.is(value) && /^[A-Za-z]:[\\/]/u.test(value);

const isAbsoluteVaultRootPath = (value: string): boolean =>
  FilePath.is(value) && (Str.startsWith("/")(value) || isAbsoluteWindowsDrivePath(value) || WindowsUncPath.is(value));

const WorkspaceVaultRootPathChecks = S.makeFilter(isAbsoluteVaultRootPath, {
  identifier: $I`WorkspaceVaultRootPathAbsoluteCheck`,
  title: "Workspace Vault Root Absolute Path",
  description: "A workspace vault root path must be an absolute POSIX, Windows drive, or Windows UNC path.",
  message: "Workspace vault root path must be absolute.",
});

// Trailing separators are dropped only after a non-separator segment character,
// so bare roots ("/", "C:\", "\\host\share") keep their existing rejection path.
const stripTrailingSeparators = Str.replace(/([^:/\\])[\\/]+$/u, "$1");

const WorkspaceVaultRootPathValue = S.String.check(WorkspaceVaultRootPathChecks).pipe(
  S.brand("WorkspaceVaultRootPath")
);

/**
 * Absolute local root path for a workspace document vault.
 *
 * **Details**
 *
 * Decoding normalizes trailing path separators, so `"/tmp/vault/"` and
 * `"/tmp/vault"` decode to the same value.
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
  SchemaUtils.withCodecStatics(["decodeUnknownSync", "encodeSync"]),
  $I.annoteSchema("WorkspaceVaultRootPath", {
    description: "Absolute local filesystem path configured as the workspace vault root.",
  })
);

/**
 * {@inheritDoc WorkspaceVaultRootPath}
 * @category value-objects
 * @since 0.0.0
 */
export type WorkspaceVaultRootPath = typeof WorkspaceVaultRootPath.Type;
