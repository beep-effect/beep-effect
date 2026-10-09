// `Workspaces.localExecLayer` — this package's implementation of
// `@effected/commands`' inverted `LocalExec` contract.
//
// The inversion: tool discovery needs package-manager detection and workspace-
// root resolution, both of which live here. A direct edge from `commands` to
// this package would make `commands` integrated and drag `npm`, `lockfiles`
// (pure!) and `package-json` up a tier with it, so `commands` declares the
// narrow contract and we ship the layer — the `@effected/npm` CatalogResolver
// precedent exactly.
//
// The argv knowledge stays in `commands`: we call `LocalExec.prefixes(name)`
// with the manager we detected and duplicate nothing. These tests assert
// against that same static rather than hard-coding prefixes, so a change to the
// table cannot leave this package silently disagreeing with it.

import { assert, describe, it } from "@effect/vitest";
import { ExecContext, LocalExec, LocalExecError } from "../../effected/commands/index.ts";
import { Effect, Layer, Option } from "effect";
import type { PackageManagerName } from "../../effected/workspaces/index.ts";
import {
	DetectedPackageManager,
	PackageManagerDetectionError,
	PackageManagerDetector,
	WorkspaceManifestError,
	WorkspaceRoot,
	WorkspaceRootNotFoundError,
	Workspaces,
} from "../../effected/workspaces/index.ts";

/** A detector that reports `name` at any root. */
const detects = (name: PackageManagerName, runtime: "node" | "bun" = "node") =>
	Layer.succeed(PackageManagerDetector, {
		detect: () =>
			Effect.succeed(
				// The declaration-tier evidence is the one rung valid for every manager.
				DetectedPackageManager.make({ name, version: Option.none(), runtime, evidence: "package.json#packageManager" }),
			),
	});

/** A detector that fails the way `failure` says. */
const detectorFailing = (failure: PackageManagerDetectionError | WorkspaceManifestError) =>
	Layer.succeed(PackageManagerDetector, { detect: () => Effect.fail(failure) });

/** A root resolver that never finds a workspace. */
const noRoot = Layer.succeed(WorkspaceRoot, {
	find: (cwd: string) =>
		Effect.fail(new WorkspaceRootNotFoundError({ searchPath: cwd, markers: ["pnpm-workspace.yaml"] })),
});

const contextOf = (layers: Layer.Layer<PackageManagerDetector | WorkspaceRoot>) =>
	Effect.flatMap(LocalExec, (local) => local.context).pipe(
		Effect.provide(Workspaces.localExecLayer({ cwd: "/repo/packages/thing" }).pipe(Layer.provide(layers))),
	);

const workspaceAt = (root: string, detector: Layer.Layer<PackageManagerDetector>) =>
	Layer.mergeAll(WorkspaceRoot.layerTest(root), detector);

describe("Workspaces.localExecLayer — a detected workspace", () => {
	it.effect("answers a context built from the detected manager's prefixes", () =>
		Effect.gen(function* () {
			const context = yield* contextOf(workspaceAt("/repo", detects("pnpm")));
			assert.isTrue(Option.isSome(context));
			if (Option.isNone(context)) return;
			assert.instanceOf(context.value, ExecContext);
			assert.strictEqual(context.value.label, "pnpm");
			// Asserted against the contract's own table, never a copy of it: the
			// argv knowledge lives in `commands` and this package must not hold a
			// second opinion about it.
			const expected = LocalExec.prefixes("pnpm");
			assert.deepStrictEqual(context.value.prefix, expected.prefix);
			assert.deepStrictEqual(context.value.dlxPrefix, expected.dlxPrefix);
			assert.deepStrictEqual(context.value.scriptPrefix, expected.scriptPrefix);
		}),
	);

	it.effect("runs the prefix in the WORKSPACE ROOT, not the caller's cwd", () =>
		Effect.gen(function* () {
			// The cwd handed in is a nested package directory; the context must point
			// at the resolved root, which is the whole reason this layer resolves one.
			const context = yield* contextOf(workspaceAt("/repo", detects("pnpm")));
			if (Option.isNone(context)) {
				assert.fail("expected a context");
				return;
			}
			assert.strictEqual(context.value.directory, "/repo");
		}),
	);

	it.effect("covers every manager the detector can report", () =>
		Effect.gen(function* () {
			for (const name of ["npm", "pnpm", "yarn", "bun"] as const) {
				const context = yield* contextOf(workspaceAt("/repo", detects(name, name === "bun" ? "bun" : "node")));
				if (Option.isNone(context)) {
					assert.fail(`expected a context for ${name}`);
					return;
				}
				const expected = LocalExec.prefixes(name);
				assert.strictEqual(context.value.label, name, `${name} label`);
				assert.deepStrictEqual(context.value.prefix, expected.prefix, `${name} prefix`);
				assert.deepStrictEqual(context.value.dlxPrefix, expected.dlxPrefix, `${name} dlx prefix`);
				assert.deepStrictEqual(context.value.scriptPrefix, expected.scriptPrefix, `${name} script prefix`);
			}
		}),
	);
});

describe("Workspaces.localExecLayer — NONE is success, not failure", () => {
	it.effect("outside any workspace, the answer is None rather than an error", () =>
		Effect.gen(function* () {
			// THE boundary. "There is no project-local way to run tools here" is the
			// honest answer for a bare directory, and the contract reserves its typed
			// error for MECHANISM failure. Failing here would force every consumer
			// outside a monorepo to catch an error to learn a normal fact.
			const context = yield* contextOf(Layer.mergeAll(noRoot, detects("pnpm")));
			assert.isTrue(Option.isNone(context));
		}),
	);

	it.effect("a workspace whose manager cannot be identified is also None", () =>
		Effect.gen(function* () {
			// `PackageManagerDetectionError` means the detector found no evidence and
			// refused to guess. That is "no identifiable project-local launcher",
			// which is the same honest None — not a mechanism failure.
			const context = yield* contextOf(
				workspaceAt(
					"/repo",
					detectorFailing(new PackageManagerDetectionError({ root: "/repo", checked: ["pnpm-workspace.yaml"] })),
				),
			);
			assert.isTrue(Option.isNone(context));
		}),
	);
});

describe("Workspaces.localExecLayer — mechanism failure IS the typed error", () => {
	it.effect("a corrupt root manifest fails with LocalExecError", () =>
		Effect.gen(function* () {
			// The other side of the boundary. A manifest that exists but cannot be
			// read or parsed is something BROKEN, not an absence — reporting None
			// would tell the caller "no local tooling here" when the truth is "your
			// repository is damaged".
			const error = yield* Effect.flip(
				contextOf(
					workspaceAt(
						"/repo",
						detectorFailing(
							new WorkspaceManifestError({
								packageJsonPath: "/repo/package.json",
								kind: "decode",
								cause: new Error("Unexpected token"),
							}),
						),
					),
				),
			);
			assert.instanceOf(error, LocalExecError);
		}),
	);

	it.effect("the failure names the directory it was resolving for", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				contextOf(
					workspaceAt(
						"/repo",
						detectorFailing(
							new WorkspaceManifestError({
								packageJsonPath: "/repo/package.json",
								kind: "read",
								cause: new Error("EACCES"),
							}),
						),
					),
				),
			);
			assert.instanceOf(error, LocalExecError);
			assert.strictEqual(error.directory, "/repo");
		}),
	);

	it.effect("the originating failure is preserved structurally on `cause`", () =>
		Effect.gen(function* () {
			const underlying = new WorkspaceManifestError({
				packageJsonPath: "/repo/package.json",
				kind: "decode",
				cause: new Error("Unexpected token"),
			});
			const error = yield* Effect.flip(contextOf(workspaceAt("/repo", detectorFailing(underlying))));
			assert.instanceOf(error, LocalExecError);
			// Carried, not stringified — a consumer can still reach the original
			// error's own fields.
			assert.strictEqual(error.cause, underlying);
		}),
	);
});

describe("Workspaces.localExecLayer — cwd", () => {
	it.effect("passes the configured cwd to root resolution", () =>
		Effect.gen(function* () {
			const seen: Array<string> = [];
			const recordingRoot = Layer.succeed(WorkspaceRoot, {
				// Wrapped in `suspend` so the push happens when the effect RUNS, not
				// when it is built — an eager recorder logs calls that never executed.
				find: (cwd: string) =>
					Effect.suspend(() => {
						seen.push(cwd);
						return Effect.succeed("/repo");
					}),
			});
			const context = yield* Effect.flatMap(LocalExec, (local) => local.context).pipe(
				Effect.provide(
					Workspaces.localExecLayer({ cwd: "/somewhere/else" }).pipe(
						Layer.provide(Layer.mergeAll(recordingRoot, detects("npm"))),
					),
				),
			);
			assert.isTrue(Option.isSome(context));
			assert.deepStrictEqual(seen, ["/somewhere/else"]);
		}),
	);
});
