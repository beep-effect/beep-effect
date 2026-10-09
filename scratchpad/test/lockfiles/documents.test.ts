// @effect-diagnostics nodeBuiltinImport:skip-file
// Document framing: a lockfile file is a YAML *stream*, not necessarily a
// single document. pnpm 11 writes a config-dependencies ("env") preamble
// document ahead of the lockfile whenever the workspace uses
// `configDependencies` — the effected repo's own pnpm-lock.yaml is exactly
// that shape.
//
// Both documents declare lockfileVersion, importers and packages, so the
// preamble *validates* against the pnpm schema. A single-document parse
// therefore succeeded and handed back a Lockfile describing an empty
// workspace: the worst failure shape there is, because it looks like an
// answer. These tests pin the deterministic framing rule (the lockfile is the
// last document — pnpm composes the preamble as a prefix) and prove that an
// unlocatable lockfile now fails typed instead of returning an empty model.
// A preamble followed by an empty main document is AMBIGUOUS: pnpm writes
// those exact bytes both for a config-dependency-only workspace with no root
// package.json (effected#845) and for a workspace whose first install failed.
// It reads as an empty model only when the caller asserts `configOnly`.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { Lockfile, LockfileFramingError, LockfileParseError } from "../../effected/lockfiles/Lockfile.ts";
import type { LockfileFormat } from "../../effected/lockfiles/LockfileFormat.ts";
import { PnpmEnvLockfile } from "../../effected/lockfiles/PnpmEnvLockfile.ts";
import { isUnsupportedLockfileVersion } from "../../effected/lockfiles/UnsupportedLockfileVersion.ts";

const fixture = (relative: string): string => readFileSync(join(import.meta.dirname, "fixtures", relative), "utf8");

/** Flip a failing parse and hand back the typed framing error. */
const framingError = Effect.fn("framingError")(function*(content: string, format: LockfileFormat) {
	const error = yield* Effect.flip(Lockfile.parse(content, { format }));
	assert.instanceOf(error, LockfileFramingError);
	assert.strictEqual(error.format, format);
	return error;
});

/** A pnpm config-dependencies preamble document, verbatim in shape. */
const preamble = [
	"---",
	"lockfileVersion: '9.0'",
	"",
	"importers:",
	"",
	"  .:",
	"    configDependencies:",
	"      '@effected/pnpm-plugin-effect':",
	"        specifier: 0.1.0",
	"        version: 0.1.0",
	"",
	"packages:",
	"",
	"  '@effected/pnpm-plugin-effect@0.1.0':",
	"    resolution: {integrity: sha512-abc}",
	"",
	"snapshots:",
	"",
	"  '@effected/pnpm-plugin-effect@0.1.0': {}",
	"",
].join("\n");

describe("document framing", () => {
	describe("pnpm: a two-document lockfile parses the lockfile, not the preamble", () => {
		it.effect("reads the real workspace out of the second document", () =>
			Effect.gen(function* () {
				const lockfile = yield* Lockfile.parse(fixture("pnpm/multidoc/pnpm-lock.yaml"), { format: "pnpm" });

				// The preamble also declares lockfileVersion/importers/packages, so
				// these assertions are what tell the two documents apart.
				assert.deepStrictEqual(
					lockfile.workspacePackages.map((p) => p.name),
					["packages/core", "packages/utils"],
				);
				assert.strictEqual(lockfile.packages.length, 5);

				// The decisive one: the preamble's config-dependency package must NOT
				// appear. Before the fix this was the *only* package in the model.
				assert.deepStrictEqual(lockfile.packagesNamed("@effected/pnpm-plugin-effect"), []);

				const chalk = lockfile.packagesNamed("chalk");
				assert.strictEqual(chalk.length, 1);
				assert.strictEqual(chalk[0]?.version, "5.6.2");
			}),
		);

		it.effect("carries the second document's catalogs, overrides and settings", () =>
			Effect.gen(function* () {
				const lockfile = yield* Lockfile.parse(fixture("pnpm/multidoc/pnpm-lock.yaml"), { format: "pnpm" });

				assert.strictEqual(lockfile.extension?._tag, "pnpm");
				if (lockfile.extension?._tag === "pnpm") {
					// The preamble has no catalogs at all — 0 catalogs was a symptom.
					assert.deepStrictEqual(lockfile.extension.catalogs?.effect, {
						effect: { specifier: "4.0.0-beta.94", version: "4.0.0-beta.94" },
					});
					assert.deepStrictEqual(lockfile.extension.overrides, { lodash: "4.17.21" });
					assert.strictEqual(lockfile.extension.settings?.autoInstallPeers, true);
				}
			}),
		);

		it.effect("resolves workspace dependency edges from the second document", () =>
			Effect.gen(function* () {
				const lockfile = yield* Lockfile.parse(fixture("pnpm/multidoc/pnpm-lock.yaml"), { format: "pnpm" });

				assert.strictEqual(lockfile.workspaceDependencies.length, 1);
				const edge = lockfile.workspaceDependencies[0];
				assert.strictEqual(edge?.from, "packages/core");
				assert.strictEqual(edge?.to, "@test-monorepo/utils");
				assert.strictEqual(edge?.constraint, "workspace:*");
			}),
		);
	});

	describe("pnpm: single-document lockfiles are unaffected", () => {
		it.effect("v1 still parses (no regression from stream parsing)", () =>
			Effect.gen(function* () {
				const lockfile = yield* Lockfile.parse(fixture("pnpm/v1/pnpm-lock.yaml"), { format: "pnpm" });

				assert.strictEqual(lockfile.packages.length, 5);
				assert.deepStrictEqual(
					lockfile.workspacePackages.map((p) => p.name),
					["packages/core", "packages/utils"],
				);
			}),
		);

		it.effect("a lone document carrying a leading '---' marker is still the lockfile", () =>
			Effect.gen(function* () {
				// pnpm's own byte-level reader keys off a leading "---" and would call
				// this env-only. Selecting by document position rather than by prefix
				// byte keeps a normalized single-document lockfile readable.
				const content = `---\n${fixture("pnpm/v1/pnpm-lock.yaml")}`;
				const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });

				assert.strictEqual(lockfile.packages.length, 5);
			}),
		);
	});

	describe("pnpm: a preamble followed by an empty main document is ambiguous", () => {
		// pnpm 11 and 12 write these bytes for a workspace with no root
		// package.json and only configDependencies (effected#845) — AND pnpm 12
		// writes the very same bytes when a workspace WITH a root package.json
		// fails its first install after the config dependencies went in
		// (`pnpm/unsupported-interrupted-pnpm12`). The parser cannot tell them
		// apart, so by default it fails closed, and reads the stream as an empty
		// lockfile only on the caller's `configOnly` assertion.
		const configOnly = { format: "pnpm", configOnly: true } as const;

		it("the interrupted-install capture is byte-identical to the config-only capture", () => {
			// The evidence the whole opt-in rests on: were these ever to differ, the
			// parser could decide by content and the flag would be unnecessary.
			assert.strictEqual(
				fixture("pnpm/unsupported-interrupted-pnpm12/pnpm-lock.yaml"),
				fixture("pnpm/env-configonly-pnpm12/pnpm-lock.yaml"),
			);
		});

		for (const name of ["env-configonly-pnpm11", "env-configonly-pnpm12", "unsupported-interrupted-pnpm12"]) {
			it.effect(`${name}, by default: fails 'noLockfileDocument', never an empty model`, () =>
				Effect.gen(function* () {
					const error = yield* framingError(fixture(`pnpm/${name}/pnpm-lock.yaml`), "pnpm");

					assert.strictEqual(error.reason, "noLockfileDocument");
					assert.strictEqual(error.documents, 2);
				}),
			);

			it.effect(`${name}, configOnly: false is the default, not a different mode`, () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(
						Lockfile.parse(fixture(`pnpm/${name}/pnpm-lock.yaml`), { format: "pnpm", configOnly: false }),
					);

					assert.instanceOf(error, LockfileFramingError);
					assert.strictEqual(error.reason, "noLockfileDocument");
				}),
			);
		}

		for (const major of ["pnpm11", "pnpm12"]) {
			it.effect(`${major} real output, configOnly: no packages, no importers, the preamble's version`, () =>
				Effect.gen(function* () {
					const lockfile = yield* Lockfile.parse(fixture(`pnpm/env-configonly-${major}/pnpm-lock.yaml`), configOnly);

					assert.strictEqual(lockfile.format, "pnpm");
					assert.strictEqual(lockfile.lockfileVersion, "9.0");
					assert.deepStrictEqual(lockfile.packages, []);
					assert.deepStrictEqual(lockfile.importers, []);
					assert.deepStrictEqual(lockfile.workspaceDependencies, []);
					assert.deepStrictEqual(lockfile.workspacePackages, []);
					// The decisive one: the preamble records a config dependency, and it
					// must not surface as a workspace package.
					assert.deepStrictEqual(lockfile.packagesNamed("@effected/pnpm-plugin-effect"), []);
					assert.strictEqual(lockfile.extension?._tag, "pnpm");
				}),
			);
		}

		it.effect("configOnly: the version is the preamble's, not a constant", () =>
			Effect.gen(function* () {
				const lockfile = yield* Lockfile.parse(`${preamble.replace("'9.0'", "'9.5'")}\n---\n`, configOnly);

				assert.strictEqual(lockfile.lockfileVersion, "9.5");
				assert.deepStrictEqual(lockfile.packages, []);
			}),
		);

		it.effect("configOnly: a preamble below the supported version still fails the gate", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Lockfile.parse(`${preamble.replace("'9.0'", "'6.0'")}\n---\n`, configOnly));

				assert.instanceOf(error, LockfileParseError);
				assert.strictEqual(error.stage, "validation");
				assert.isTrue(isUnsupportedLockfileVersion(error.cause));
			}),
		);

		it.effect("configOnly: a preamble that is not a mapping fails validation, not as an empty lockfile", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Lockfile.parse("--- 42\n---\n", configOnly));

				assert.instanceOf(error, LockfileParseError);
				assert.strictEqual(error.stage, "validation");
			}),
		);

		describe("configOnly loosens nothing else", () => {
			it.effect("no preamble (two empty documents) still fails 'noLockfileDocument'", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Lockfile.parse("---\n---\n", configOnly));

					assert.instanceOf(error, LockfileFramingError);
					assert.strictEqual(error.reason, "noLockfileDocument");
					assert.strictEqual(error.documents, 2);
				}),
			);

			it.effect("a lone empty document still fails 'noLockfileDocument'", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Lockfile.parse("---\n", configOnly));

					assert.instanceOf(error, LockfileFramingError);
					assert.strictEqual(error.reason, "noLockfileDocument");
					assert.strictEqual(error.documents, 1);
				}),
			);

			it.effect("more than two documents still fail 'unexpectedDocuments'", () =>
				Effect.gen(function* () {
					// A preamble, an empty document, then a third: the config-only shape
					// with one document too many is still outside the writer contract.
					const error = yield* Effect.flip(Lockfile.parse(`${preamble}\n---\n---\n`, configOnly));

					assert.instanceOf(error, LockfileFramingError);
					assert.strictEqual(error.reason, "unexpectedDocuments");
					assert.strictEqual(error.documents, 3);
				}),
			);

			it.effect("a non-empty main document declaring no importers still fails 'noImporters'", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(
						Lockfile.parse(`${preamble}\n---\nlockfileVersion: '9.0'\nimporters: {}\n`, configOnly),
					);

					assert.instanceOf(error, LockfileFramingError);
					assert.strictEqual(error.reason, "noImporters");
				}),
			);

			it.effect("a populated two-document stream parses exactly as it does without the flag", () =>
				Effect.gen(function* () {
					const content = fixture("pnpm/multidoc/pnpm-lock.yaml");
					const flagged = yield* Lockfile.parse(content, configOnly);
					const plain = yield* Lockfile.parse(content, { format: "pnpm" });

					assert.isAbove(flagged.packages.length, 0);
					assert.deepStrictEqual(flagged, plain);
				}),
			);

			it.effect("ignored for a non-pnpm format: an empty yarn.lock still fails 'noLockfileDocument'", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Lockfile.parse("", { format: "yarn", configOnly: true }));

					assert.instanceOf(error, LockfileFramingError);
					assert.strictEqual(error.reason, "noLockfileDocument");
				}),
			);
		});
	});

	describe("pnpm: an unlocatable lockfile fails typed, never as an empty model", () => {
		it.effect("two empty documents (no preamble to vouch for the stream) fail 'noLockfileDocument'", () =>
			Effect.gen(function* () {
				const error = yield* framingError("---\n---\n", "pnpm");

				assert.strictEqual(error.reason, "noLockfileDocument");
				assert.strictEqual(error.documents, 2);
			}),
		);

		it.effect("a lone empty document fails 'noLockfileDocument'", () =>
			Effect.gen(function* () {
				const error = yield* framingError("---\n", "pnpm");

				assert.strictEqual(error.reason, "noLockfileDocument");
				assert.strictEqual(error.documents, 1);
			}),
		);

		it.effect("more than two documents fail 'unexpectedDocuments', the same limit the env reader holds", () =>
			Effect.gen(function* () {
				// Outside pnpm's writer contract, so no position identifies the
				// lockfile. One splitter serves Lockfile.parse and PnpmEnvLockfile, so
				// both refuse this stream the same way.
				const v1 = fixture("pnpm/v1/pnpm-lock.yaml");
				const content = `${preamble}\n---\n${v1}---\n${v1}`;
				const error = yield* framingError(content, "pnpm");

				assert.strictEqual(error.reason, "unexpectedDocuments");
				assert.strictEqual(error.documents, 3);
				const envError = yield* Effect.flip(PnpmEnvLockfile.configDependencies(content));
				assert.instanceOf(envError, LockfileFramingError);
				assert.strictEqual(envError.reason, "unexpectedDocuments");
				assert.strictEqual(envError.documents, 3);
			}),
		);

		it.effect("empty content fails 'noLockfileDocument'", () =>
			Effect.gen(function* () {
				const error = yield* framingError("", "pnpm");
				assert.strictEqual(error.reason, "noLockfileDocument");
			}),
		);

		it.effect("a lockfile document declaring no importers fails 'noImporters'", () =>
			Effect.gen(function* () {
				// pnpm always records at least the root importer ".", so an empty
				// importers map describes no workspace. Failing typed here is what
				// keeps "empty workspace" from ever being a successful answer.
				const error = yield* framingError("lockfileVersion: '9.0'\nimporters: {}\n", "pnpm");

				assert.strictEqual(error.reason, "noImporters");
			}),
		);

		it.effect("the framing failure is not reported as a LockfileParseError", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Lockfile.parse("---\n---\n", { format: "pnpm" }));

				assert.instanceOf(error, LockfileFramingError);
				assert.isFalse(Schema.is(LockfileParseError)(error));
				assert.strictEqual(error._tag, "LockfileFramingError");
			}),
		);
	});

	describe("yarn: no document framing means multi-document input is refused, not truncated", () => {
		const berry = ["__metadata:\n  version: 8\n", '"a@npm:^1.0.0":\n  version: 1.0.0\n  linkType: hard\n'].join("");

		it.effect("a multi-document yarn.lock fails 'unexpectedDocuments'", () =>
			Effect.gen(function* () {
				const error = yield* framingError(`${berry}---\n${berry}`, "yarn");

				assert.strictEqual(error.reason, "unexpectedDocuments");
				assert.strictEqual(error.documents, 2);
			}),
		);

		it.effect("a single-document yarn.lock still parses", () =>
			Effect.gen(function* () {
				const lockfile = yield* Lockfile.parse(berry, { format: "yarn" });

				assert.strictEqual(lockfile.format, "yarn");
				assert.strictEqual(lockfile.lockfileVersion, "8");
			}),
		);
	});

	describe("npm and bun define no document framing and never shared the assumption", () => {
		// JSON and JSONC are single-value by construction: a second top-level
		// value is a syntax error, not a silently-ignored second document. These
		// pin that, so the formats' framing posture is asserted rather than
		// assumed.
		it.effect("npm: a second JSON value is a syntax error", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Lockfile.parse('{"lockfileVersion":3}\n{"a":1}', { format: "npm" }));

				assert.instanceOf(error, LockfileParseError);
				assert.strictEqual(error.stage, "syntax");
			}),
		);

		it.effect("bun: a second JSONC value is a syntax error", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Lockfile.parse('{"lockfileVersion":1}\n{"a":1}', { format: "bun" }));

				assert.instanceOf(error, LockfileParseError);
				assert.strictEqual(error.stage, "syntax");
			}),
		);
	});
});
