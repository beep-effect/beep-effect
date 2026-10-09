import type { DependencyField } from "../../npm/index.ts";

/**
 * Lists every dependency map a manifest declares, in manifest order.
 *
 * **Example** (Inspect manifest dependency field order)
 *
 * ```ts
 * import { ALL_DEPENDENCY_FIELDS } from "@beep/scratchpad/effected/workspaces/internal/dependencyFields"
 *
 * console.log(ALL_DEPENDENCY_FIELDS.join(", ")) // dependencies, devDependencies, peerDependencies, optionalDependencies
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ALL_DEPENDENCY_FIELDS: ReadonlyArray<DependencyField> = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
];

/**
 * Lists the maps an installed package's own dependencies come from — never devDependencies.
 *
 * **Example** (Inspect runtime dependency field order)
 *
 * ```ts
 * import { RUNTIME_DEPENDENCY_FIELDS } from "@beep/scratchpad/effected/workspaces/internal/dependencyFields"
 *
 * console.log(RUNTIME_DEPENDENCY_FIELDS.join(", ")) // dependencies, optionalDependencies, peerDependencies
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RUNTIME_DEPENDENCY_FIELDS: ReadonlyArray<DependencyField> = [
	"dependencies",
	"optionalDependencies",
	"peerDependencies",
];
