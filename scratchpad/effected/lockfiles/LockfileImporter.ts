import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { ImporterDependency } from "./ImporterDependency.ts";

const $I = $ScratchpadId.create("effected/lockfiles/LockfileImporter");

/**
 * One workspace importer's declared dependencies, as the lockfile records them.
 *
 * **Details**
 *
 * - `path` — the importer path relative to the workspace root, `"."` for the
 *   root package (never empty — a `NonEmptyString`) — the same keys as
 *   `WorkspaceDiscovery.importerMap` in
 *   `@effected/workspaces`. This is the stable join key: `Lockfile#importer`
 *   looks importers up by it, and `Lockfile#withImporterNames` deliberately
 *   leaves importers untouched because the path — not a package name — keys
 *   them.
 * - `dependencies` — each declared dependency as an {@link ImporterDependency}.
 *
 * Populated by the pnpm, bun and npm parsers. yarn does not record importers,
 * so a yarn lockfile always yields an empty `importers` array.
 *
 * **Example** (Construct the root importer)
 *
 * ```ts
 * import { LockfileImporter } from "@beep/scratchpad/effected/lockfiles/LockfileImporter";
 *
 * const importer = LockfileImporter.make({ path: ".", dependencies: [] });
 * console.log(importer.path); // .
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LockfileImporter extends S.Class<LockfileImporter>($I`LockfileImporter`)({
	path: S.NonEmptyString.annotateKey({ description: "Importer path relative to the workspace root, with `.` identifying the root package" }),
	dependencies: S.Array(ImporterDependency).annotateKey({ description: "Dependencies declared by this importer across its runtime, development, peer and optional sections" }),
}, $I.annote("LockfileImporter", { description: "One workspace importer's declared dependencies, as the lockfile records them." })) {}
