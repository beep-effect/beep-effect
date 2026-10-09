import { $ScratchpadId } from "@beep/identity/packages";
import { DependencyField } from "../npm/index.ts";
import { Range, SemVer } from "../semver/index.ts";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import { DEP_TYPES, isWorkspaceSpecifier } from "./internal/shared.ts";
import type { Lockfile } from "./Lockfile.ts";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/lockfiles/LockfileIntegrity");

/**
 * The minimal manifest shape {@link LockfileIntegrity.compare} checks a
 * lockfile against: a package name plus the four optional dependency maps.
 *
 * @remarks
 * Deliberately *not* a `@effected/package-json` type — this package takes
 * manifests as plain values so its consumers own the manifest IO (and may
 * derive these from any richer model).
 *
 * @public
 */
export class WorkspaceManifest extends S.Class<WorkspaceManifest>($I`WorkspaceManifest`)({
	name: S.NonEmptyString.annotateKey({ description: "Workspace package identity used to match its manifest against lockfile workspace entries" }),
	dependencies: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Runtime dependency specifiers declared by the workspace manifest" }),
	devDependencies: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Development dependency specifiers declared by the workspace manifest" }),
	peerDependencies: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Peer dependency specifiers declared by the workspace manifest" }),
	optionalDependencies: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Optional dependency specifiers declared by the workspace manifest" }),
}, $I.annote("WorkspaceManifest", { description: "The minimal manifest shape LockfileIntegrity.compare checks a lockfile against: a package name plus the four optional dependency maps." })) {}

const decodeRange = S.decodeUnknownExit(Range.FromString);
const decodeSemVer = S.decodeUnknownExit(SemVer.FromString);

/**
 * Result of checking a parsed lockfile against the workspace's declared
 * manifests.
 *
 * @remarks
 * A data type, not an error: it reports *what* mismatches exist without
 * failing anything.
 *
 * - `valid` — `true` when the lockfile is fully consistent.
 * - `missingWorkspaces` — workspace names present in the manifests but
 *   absent from the lockfile.
 * - `extraWorkspaces` — workspace names in the lockfile with no matching
 *   manifest.
 * - `unsatisfiedConstraints` — declared constraints the lockfile's resolved
 *   versions do not satisfy.
 *
 * @public
 */
export class LockfileIntegrity extends S.Class<LockfileIntegrity>($I`LockfileIntegrity`)({
	valid: S.Boolean.annotateKey({ description: "Whether comparison found no missing workspaces, extra workspaces or unsatisfied constraints among the rows it checked" }),
	missingWorkspaces: S.Array(S.String).annotateKey({ description: "Workspace package names declared by manifests but absent from the lockfile's workspace entries" }),
	extraWorkspaces: S.Array(S.String).annotateKey({ description: "Workspace package names recorded in the lockfile without matching manifests" }),
	unsatisfiedConstraints: S.Array(
		S.Struct({
			workspace: S.String,
			dependency: S.String,
			constraint: S.String,
			resolved: S.String,
			depType: DependencyField,
		}),
	).annotateKey({ description: "Declared SemVer constraints satisfied by no parseable resolved candidate, with workspace, dependency section and all candidate versions" }),
}, $I.annote("LockfileIntegrity", { description: "Result of checking a parsed lockfile against the workspace's declared manifests." })) {
	/**
	 * Check a lockfile's consistency against workspace manifests — a total,
	 * pure function: no Effect, no error channel, no IO.
	 *
	 * @remarks
	 * Constraint checking is best-effort by design: `workspace:` / `link:` /
	 * `file:` specifiers and rows whose range (or every resolved version) does
	 * not parse as SemVer are skipped.
	 * A lockfile may resolve the same package at several versions; a
	 * constraint is satisfied when *any* resolved version matches, and an
	 * unsatisfied row reports every candidate in `resolved`. The
	 * caller reads the manifests (this package does no IO). For pnpm, apply
	 * `Lockfile#withImporterNames` first so workspace names align with
	 * manifest names.
	 *
	 * (Named `compare`, not `check`: every `Schema.Class` already carries a
	 * `static check(...checks)` for attaching schema checks, and statics cannot
	 * be shadowed with an incompatible signature.)
	 *
	 * @param lockfile - The parsed lockfile.
	 * @param manifests - The workspace manifests to compare against.
	 * @returns The integrity report.
	 */
	static compare(lockfile: Lockfile, manifests: ReadonlyArray<WorkspaceManifest>): LockfileIntegrity {
		const workspacePackages = lockfile.packages.filter((p) => p.isWorkspace && p.relativePath !== undefined);

		const lockfileWsNames = new Set(workspacePackages.map((p) => p.name));
		const manifestNames = new Set(manifests.map((m) => m.name));
		const missingWorkspaces = [...manifestNames].filter((n) => !lockfileWsNames.has(n));
		const extraWorkspaces = [...lockfileWsNames].filter((n) => !manifestNames.has(n));

		// A lockfile can resolve the same name at several versions; keep them all
		// so the verdict never depends on entry order.
		const resolvedIndex = new Map<string, Array<string>>();
		for (const p of lockfile.packages) {
			const versions = resolvedIndex.get(p.name);
			if (versions === undefined) resolvedIndex.set(p.name, [p.version]);
			else versions.push(p.version);
		}

		const unsatisfiedConstraints: Array<{
			workspace: string;
			dependency: string;
			constraint: string;
			resolved: string;
			depType: DependencyField;
		}> = [];

		for (const manifest of manifests) {
			for (const depType of DEP_TYPES) {
				const depMap = manifest[depType];
				if (depMap === undefined) continue;

				for (const [dependency, constraint] of R.toEntries(depMap)) {
					if (isWorkspaceSpecifier(constraint)) continue;

					const candidates = resolvedIndex.get(dependency);
					if (candidates === undefined) continue;

					const rangeExit = decodeRange(constraint);
					if (Exit.isFailure(rangeExit)) continue; // unparseable rows are skipped

					const versions = candidates.map((candidate) => decodeSemVer(candidate)).filter(Exit.isSuccess);
					if (versions.length === 0) continue; // unparseable rows are skipped

					if (!versions.some((v) => rangeExit.value.test(v.value))) {
						unsatisfiedConstraints.push({
							workspace: manifest.name,
							dependency,
							constraint,
							resolved: candidates.join(", "),
							depType,
						});
					}
				}
			}
		}

		return LockfileIntegrity.make({
			valid: missingWorkspaces.length === 0 && extraWorkspaces.length === 0 && unsatisfiedConstraints.length === 0,
			missingWorkspaces,
			extraWorkspaces,
			unsatisfiedConstraints,
		});
	}
}
