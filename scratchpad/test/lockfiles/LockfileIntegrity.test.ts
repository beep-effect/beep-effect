// Seam repair 2: integrity checking as a total, pure function fed by
// in-memory manifests — no Effect, no error channel, no IO anywhere.

import { assert, describe, it } from "@effect/vitest";
import { Lockfile } from "../../effected/lockfiles/Lockfile.ts";
import { LockfileIntegrity, WorkspaceManifest } from "../../effected/lockfiles/LockfileIntegrity.ts";
import { ResolvedPackage } from "../../effected/lockfiles/ResolvedPackage.ts";

const workspace = (name: string, relativePath: string): ResolvedPackage =>
	ResolvedPackage.make({ name, version: "1.0.0", instanceId: relativePath, isWorkspace: true, relativePath });

const registry = (name: string, version: string): ResolvedPackage =>
	ResolvedPackage.make({ name, version, instanceId: `${name}@${version}`, isWorkspace: false });

const lockfileWith = (packages: ReadonlyArray<ResolvedPackage>): Lockfile =>
	Lockfile.make({ format: "npm", lockfileVersion: "3", packages, workspaceDependencies: [] });

describe("LockfileIntegrity.compare", () => {
	it("reports a fully consistent lockfile as valid", () => {
		const lockfile = lockfileWith([
			workspace("@acme/core", "packages/core"),
			workspace("@acme/utils", "packages/utils"),
			registry("lodash", "4.17.21"),
		]);
		const manifests = [
			WorkspaceManifest.make({
				name: "@acme/core",
				dependencies: { lodash: "^4.17.0", "@acme/utils": "workspace:*" },
			}),
			WorkspaceManifest.make({ name: "@acme/utils" }),
		];

		const report = LockfileIntegrity.compare(lockfile, manifests);

		assert.isTrue(report.valid);
		assert.deepStrictEqual(report.missingWorkspaces, []);
		assert.deepStrictEqual(report.extraWorkspaces, []);
		assert.deepStrictEqual(report.unsatisfiedConstraints, []);
	});

	it("reports manifests absent from the lockfile as missing", () => {
		const lockfile = lockfileWith([workspace("@acme/core", "packages/core")]);
		const manifests = [
			WorkspaceManifest.make({ name: "@acme/core" }),
			WorkspaceManifest.make({ name: "@acme/brand-new" }),
		];

		const report = LockfileIntegrity.compare(lockfile, manifests);

		assert.isFalse(report.valid);
		assert.deepStrictEqual(report.missingWorkspaces, ["@acme/brand-new"]);
		assert.deepStrictEqual(report.extraWorkspaces, []);
	});

	it("reports lockfile workspaces with no manifest as extra", () => {
		const lockfile = lockfileWith([
			workspace("@acme/core", "packages/core"),
			workspace("@acme/removed", "packages/removed"),
		]);
		const manifests = [WorkspaceManifest.make({ name: "@acme/core" })];

		const report = LockfileIntegrity.compare(lockfile, manifests);

		assert.isFalse(report.valid);
		assert.deepStrictEqual(report.missingWorkspaces, []);
		assert.deepStrictEqual(report.extraWorkspaces, ["@acme/removed"]);
	});

	it("ignores workspace packages without a relativePath for presence checks", () => {
		const pathless = ResolvedPackage.make({
			name: "@acme/ghost",
			version: "1.0.0",
			instanceId: "@acme/ghost",
			isWorkspace: true,
		});
		const lockfile = lockfileWith([workspace("@acme/core", "packages/core"), pathless]);
		const manifests = [WorkspaceManifest.make({ name: "@acme/core" })];

		const report = LockfileIntegrity.compare(lockfile, manifests);

		assert.isTrue(report.valid);
		assert.deepStrictEqual(report.extraWorkspaces, []);
	});

	it("reports resolved versions that do not satisfy the declared range", () => {
		const lockfile = lockfileWith([workspace("@acme/core", "packages/core"), registry("lodash", "4.17.21")]);
		const manifests = [WorkspaceManifest.make({ name: "@acme/core", devDependencies: { lodash: "^5.0.0" } })];

		const report = LockfileIntegrity.compare(lockfile, manifests);

		assert.isFalse(report.valid);
		assert.deepStrictEqual(report.unsatisfiedConstraints, [
			{
				workspace: "@acme/core",
				dependency: "lodash",
				constraint: "^5.0.0",
				resolved: "4.17.21",
				depType: "devDependencies",
			},
		]);
	});

	it("satisfies a constraint when any of several resolved versions matches, regardless of order", () => {
		const oneFirst = lockfileWith([
			workspace("@acme/core", "packages/core"),
			registry("foo", "1.5.0"),
			registry("foo", "2.0.0"),
		]);
		const twoFirst = lockfileWith([
			workspace("@acme/core", "packages/core"),
			registry("foo", "2.0.0"),
			registry("foo", "1.5.0"),
		]);
		const manifests = [WorkspaceManifest.make({ name: "@acme/core", dependencies: { foo: "^1.0.0" } })];

		assert.isTrue(LockfileIntegrity.compare(oneFirst, manifests).valid);
		assert.isTrue(LockfileIntegrity.compare(twoFirst, manifests).valid);
	});

	it("reports every resolved version when none of them satisfies", () => {
		const lockfile = lockfileWith([
			workspace("@acme/core", "packages/core"),
			registry("foo", "1.5.0"),
			registry("foo", "2.0.0"),
		]);
		const manifests = [WorkspaceManifest.make({ name: "@acme/core", dependencies: { foo: "^3.0.0" } })];

		const report = LockfileIntegrity.compare(lockfile, manifests);

		assert.isFalse(report.valid);
		assert.deepStrictEqual(report.unsatisfiedConstraints, [
			{
				workspace: "@acme/core",
				dependency: "foo",
				constraint: "^3.0.0",
				resolved: "1.5.0, 2.0.0",
				depType: "dependencies",
			},
		]);
	});

	it("checks all four dependency maps and tags rows with their depType", () => {
		const lockfile = lockfileWith([
			workspace("@acme/core", "packages/core"),
			registry("a", "1.0.0"),
			registry("b", "1.0.0"),
			registry("c", "1.0.0"),
			registry("d", "1.0.0"),
		]);
		const manifests = [
			WorkspaceManifest.make({
				name: "@acme/core",
				dependencies: { a: "^2.0.0" },
				devDependencies: { b: "^2.0.0" },
				peerDependencies: { c: "^2.0.0" },
				optionalDependencies: { d: "^2.0.0" },
			}),
		];

		const report = LockfileIntegrity.compare(lockfile, manifests);

		assert.deepStrictEqual(
			report.unsatisfiedConstraints.map((row) => [row.dependency, row.depType]),
			[
				["a", "dependencies"],
				["b", "devDependencies"],
				["c", "peerDependencies"],
				["d", "optionalDependencies"],
			],
		);
	});

	it("skips workspace:, link: and file: specifiers even when they would not satisfy", () => {
		const lockfile = lockfileWith([
			workspace("@acme/core", "packages/core"),
			workspace("@acme/utils", "packages/utils"),
			registry("local-a", "0.1.0"),
			registry("local-b", "0.1.0"),
		]);
		const manifests = [
			WorkspaceManifest.make({
				name: "@acme/core",
				dependencies: {
					"@acme/utils": "workspace:^9.9.9",
					"local-a": "link:../local-a",
					"local-b": "file:../local-b",
				},
			}),
			WorkspaceManifest.make({ name: "@acme/utils" }),
		];

		const report = LockfileIntegrity.compare(lockfile, manifests);

		assert.isTrue(report.valid);
	});

	it("skips rows whose range or resolved version does not parse", () => {
		const lockfile = lockfileWith([
			workspace("@acme/core", "packages/core"),
			registry("weird-version", "not-a-semver"),
			registry("fine", "1.0.0"),
		]);
		const manifests = [
			WorkspaceManifest.make({
				name: "@acme/core",
				dependencies: {
					"weird-version": "^1.0.0", // resolved side unparseable — skipped
					fine: "definitely !! not a range", // range side unparseable — skipped
					"not-resolved-at-all": "^1.0.0", // not in the lockfile — skipped
				},
			}),
		];

		const report = LockfileIntegrity.compare(lockfile, manifests);

		assert.isTrue(report.valid);
		assert.deepStrictEqual(report.unsatisfiedConstraints, []);
	});

	it("handles an empty manifest set and an empty lockfile", () => {
		const emptyLockfile = lockfileWith([]);
		assert.isTrue(LockfileIntegrity.compare(emptyLockfile, []).valid);

		const report = LockfileIntegrity.compare(emptyLockfile, [WorkspaceManifest.make({ name: "@acme/core" })]);
		assert.isFalse(report.valid);
		assert.deepStrictEqual(report.missingWorkspaces, ["@acme/core"]);
	});
});
