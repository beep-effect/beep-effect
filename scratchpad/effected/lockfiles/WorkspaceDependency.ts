import { $ScratchpadId } from "@beep/identity/packages";
import { DependencyField } from "../npm/index.ts";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/lockfiles/WorkspaceDependency");

/**
 * A directed dependency edge between two workspace packages as recorded in
 * the lockfile.
 *
 * @remarks
 * - `from` — the workspace package declaring the dependency. For pnpm this
 *   is the importer path until `Lockfile#withImporterNames` rewrites it.
 * - `to` — the workspace package depended upon.
 * - `depType` — which dependency map holds the edge, spelled with
 *   `@effected/npm`'s kit-wide `DependencyField` vocabulary.
 * - `constraint` — the declared specifier (e.g. `"workspace:*"`, `"^1.0.0"`).
 *
 * @public
 */
export class WorkspaceDependency extends S.Class<WorkspaceDependency>($I`WorkspaceDependency`)({
	from: S.NonEmptyString.annotateKey({ description: "Workspace package declaring the dependency; pnpm initially uses its importer path until rewritten with its manifest name" }),
	to: S.NonEmptyString.annotateKey({ description: "Workspace package depended upon by the declaring package" }),
	depType: DependencyField.annotateKey({ description: "Dependency section containing this workspace edge, such as `dependencies` or `devDependencies`" }),
	constraint: S.String.annotateKey({ description: "Declared dependency specifier for this workspace edge, such as `workspace:*` or `^1.0.0`" }),
}, $I.annote("WorkspaceDependency", { description: "A directed dependency edge between two workspace packages as recorded in the lockfile." })) {}
