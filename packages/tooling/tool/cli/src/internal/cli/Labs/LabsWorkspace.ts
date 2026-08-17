/**
 * Canonical labs-path constants and guards for the `apps/labs/*` lab-app root.
 *
 * Every repo-CLI consumer of the labs path (tsconfig-sync root-reference
 * exclusion, ceremony scoping, CI lane filters, QA host resolution, lifecycle
 * commands) imports these symbols instead of minting its own literal.
 * JSON/JSONC config surfaces that cannot import TypeScript reference this
 * module by comment and repeat the literal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { normalizePath } from "@beep/schema/PosixPath";
import { Str } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/Labs/LabsWorkspace");

/**
 * Repo-relative root directory that holds every lab app.
 *
 * @category configuration
 * @since 0.0.0
 */
export const LABS_WORKSPACE_ROOT = "apps/labs";

/**
 * Workspace-membership glob for lab apps (root `package.json` workspaces).
 *
 * @category configuration
 * @since 0.0.0
 */
export const LABS_WORKSPACE_GLOB = "apps/labs/*";

/**
 * Recursive glob covering every file below the labs root.
 *
 * @category configuration
 * @since 0.0.0
 */
export const LABS_PATH_IGNORE_GLOB = "apps/labs/**";

/**
 * Turbo filter that excludes lab workspaces from required lanes (ratified
 * lab-apps-lifecycle row 9).
 *
 * @category configuration
 * @since 0.0.0
 */
export const LABS_TURBO_EXCLUDE_FILTER = "--filter=!./apps/labs/**";

/**
 * Turbo filter that positively selects lab workspaces for the non-required
 * labs lane (ratified lab-apps-lifecycle row 10).
 *
 * @category configuration
 * @since 0.0.0
 */
export const LABS_TURBO_SELECT_FILTER = "--filter=./apps/labs/**";

/**
 * Repo-relative workspace directory below the labs root (`apps/labs/<name>`).
 *
 * @category schemas
 * @since 0.0.0
 */
export const LabsWorkspaceDir = S.String.check(S.isStartsWith(`${LABS_WORKSPACE_ROOT}/`)).pipe(
  S.brand("LabsWorkspaceDir"),
  $I.annoteSchema("LabsWorkspaceDir", {
    description: "Repo-relative workspace directory below the apps/labs root.",
  })
);

/**
 * Decoded {@link LabsWorkspaceDir} type.
 *
 * @category models
 * @since 0.0.0
 */
export type LabsWorkspaceDir = typeof LabsWorkspaceDir.Type;

/**
 * Guard for repo-relative workspace directories below the labs root.
 *
 * @category guards
 * @since 0.0.0
 */
export const isLabsWorkspaceDir = S.is(LabsWorkspaceDir);

/**
 * Predicate matching the labs root itself or any repo-relative path below it.
 *
 * Accepts native separators; the input is POSIX-normalized before matching so
 * absolute paths never match and `apps/labsx` never false-positives.
 *
 * @category guards
 * @since 0.0.0
 */
export const isLabsWorkspacePath = (filePath: string): boolean => {
  const normalized = normalizePath(filePath);
  return normalized === LABS_WORKSPACE_ROOT || Str.startsWith(`${LABS_WORKSPACE_ROOT}/`)(normalized);
};
