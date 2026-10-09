import type { DependencyField } from "../../npm/index.ts";

/** Every dependency map a manifest declares, in manifest order. */
export const ALL_DEPENDENCY_FIELDS: ReadonlyArray<DependencyField> = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
];

/** The maps an installed package's own dependencies come from — never devDependencies. */
export const RUNTIME_DEPENDENCY_FIELDS: ReadonlyArray<DependencyField> = [
	"dependencies",
	"optionalDependencies",
	"peerDependencies",
];
