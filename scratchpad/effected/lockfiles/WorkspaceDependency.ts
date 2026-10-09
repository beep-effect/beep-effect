import { DependencyField } from "../npm/index.ts";
import { Schema } from "effect";

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
export class WorkspaceDependency extends Schema.Class<WorkspaceDependency>("WorkspaceDependency")({
	from: Schema.NonEmptyString,
	to: Schema.NonEmptyString,
	depType: DependencyField,
	constraint: Schema.String,
}) {}
