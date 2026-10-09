import { DependencyField } from "../npm/index.ts";
import * as S from "effect/Schema";

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
export class WorkspaceDependency extends S.Class<WorkspaceDependency>("WorkspaceDependency")({
	from: S.NonEmptyString,
	to: S.NonEmptyString,
	depType: DependencyField,
	constraint: S.String,
}) {}
