/**
 * Canonical labs-path constants and guards for the `apps/labs/*` lab-app root.
 *
 * **Details**
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

import { $RepoCliKitId } from "@beep/identity/packages";
import { normalizePath } from "@beep/schema/PosixPath";
import { Str } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $RepoCliKitId.create("cli/Labs/LabsWorkspace");

/**
 * Repo-relative root directory that holds every lab app.
 *
 * **Example** (Inspect the labs path convention)
 *
 * ```ts
 * import { LABS_WORKSPACE_ROOT } from "@beep/repo-cli-kit/cli/Labs/LabsWorkspace"
 *
 * console.log(LABS_WORKSPACE_ROOT) // apps/labs
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LABS_WORKSPACE_ROOT = "apps/labs";

/**
 * Workspace-membership glob for lab apps (root `package.json` workspaces).
 *
 * **Example** (Inspect the labs path convention)
 *
 * ```ts
 * import { LABS_WORKSPACE_GLOB } from "@beep/repo-cli-kit/cli/Labs/LabsWorkspace"
 *
 * console.log(LABS_WORKSPACE_GLOB) // apps/labs/*
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LABS_WORKSPACE_GLOB = "apps/labs/*";

/**
 * Recursive glob covering every file below the labs root.
 *
 * **Example** (Inspect the labs path convention)
 *
 * ```ts
 * import { LABS_PATH_IGNORE_GLOB } from "@beep/repo-cli-kit/cli/Labs/LabsWorkspace"
 *
 * console.log(LABS_PATH_IGNORE_GLOB) // apps/labs/**
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LABS_PATH_IGNORE_GLOB = "apps/labs/**";

/**
 * Turbo filter for hosted product lint/test partitioning in `CiLane`.
 *
 * **Details**
 *
 * Root lint, check, test, and coverage commands include labs (operator amendment
 * 2026-10-20, lab-apps-lifecycle D15). Hosted product partitions retain this
 * filter because the separate labs lane owns their lab-specific execution.
 *
 * **Example** (Inspect the labs path convention)
 *
 * ```ts
 * import { LABS_TURBO_EXCLUDE_FILTER } from "@beep/repo-cli-kit/cli/Labs/LabsWorkspace"
 *
 * console.log(LABS_TURBO_EXCLUDE_FILTER) // --filter=!./apps/labs/**
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LABS_TURBO_EXCLUDE_FILTER = "--filter=!./apps/labs/**";

/**
 * Turbo filter that positively selects lab workspaces for the non-required
 * labs lane (ratified lab-apps-lifecycle row 10).
 *
 * **Example** (Inspect the labs path convention)
 *
 * ```ts
 * import { LABS_TURBO_SELECT_FILTER } from "@beep/repo-cli-kit/cli/Labs/LabsWorkspace"
 *
 * console.log(LABS_TURBO_SELECT_FILTER) // --filter=./apps/labs/**
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LABS_TURBO_SELECT_FILTER = "--filter=./apps/labs/**";

/**
 * Repo-relative workspace directory below the labs root (`apps/labs/<name>`).
 *
 * **Example** (Validate a lab workspace directory)
 *
 * ```ts
 * import { LabsWorkspaceDir } from "@beep/repo-cli-kit/cli/Labs/LabsWorkspace"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LabsWorkspaceDir)("apps/labs/example")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LabsWorkspaceDir = S.String.check(S.isStartingWith(`${LABS_WORKSPACE_ROOT}/`)).pipe(
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
 * **Example** (Recognize lab paths)
 *
 * ```ts
 * import { isLabsWorkspaceDir } from "@beep/repo-cli-kit/cli/Labs/LabsWorkspace"
 *
 * console.log(isLabsWorkspaceDir("apps/labs/example")) // true
 * console.log(isLabsWorkspaceDir("apps/editor")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isLabsWorkspaceDir = S.is(LabsWorkspaceDir);

/**
 * Predicate matching the labs root itself or any repo-relative path below it.
 *
 * **Details**
 *
 * Accepts native separators; the input is POSIX-normalized before matching so
 * absolute paths never match and `apps/labsx` never false-positives.
 *
 * **Example** (Recognize lab paths)
 *
 * ```ts
 * import { isLabsWorkspacePath } from "@beep/repo-cli-kit/cli/Labs/LabsWorkspace"
 *
 * console.log(isLabsWorkspacePath("apps/labs/example")) // true
 * console.log(isLabsWorkspacePath("apps/editor")) // false
 * ```
 *
 * @param filePath - A repo-relative path, with native or POSIX separators.
 * @returns `true` for the labs root or any path below it.
 * @category guards
 * @since 0.0.0
 */
export const isLabsWorkspacePath = (filePath: string): boolean => {
  const normalized = normalizePath(filePath);
  return normalized === LABS_WORKSPACE_ROOT || Str.startsWith(`${LABS_WORKSPACE_ROOT}/`)(normalized);
};
