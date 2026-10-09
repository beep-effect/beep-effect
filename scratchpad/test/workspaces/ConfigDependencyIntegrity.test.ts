import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { PnpmEnvLockfile } from "../../effected/lockfiles/index.ts";
import { expectedIntegrity } from "../../effected/workspaces/internal/configDependencyFetch.ts";

const integrity = "sha512-YWJj";
const lockfile = A.join([
	"lockfileVersion: '9.0'",
	"importers:",
	"  .:",
	"    configDependencies:",
	"      cfg:",
	"        specifier: 1.0.0",
	"        version: 1.0.0",
	"packages:",
	"  cfg@1.0.0:",
	`    resolution: {integrity: '${integrity}'}`,
	"---",
	"lockfileVersion: '9.0'",
	"importers: {}",
	"",
], "\n");

describe("config-dependency integrity from the lockfile reader's HashMap", () => {
	it.effect("uses the checksum returned by PnpmEnvLockfile.configDependencies", () =>
		Effect.gen(function* () {
			const actual = yield* expectedIntegrity({
				name: "cfg", version: "1.0.0", spec: "1.0.0", side: { ref: "base" },
				locks: PnpmEnvLockfile.configDependencies(lockfile),
			});
			assert.strictEqual(actual, integrity);
		}),
	);

	it.effect("fails typed when the inline checksum disagrees with the HashMap entry", () =>
		Effect.gen(function* () {
			const failure = yield* Effect.flip(expectedIntegrity({
				name: "cfg", version: "1.0.0", spec: "1.0.0+sha512-ZGVm", side: { ref: "base" },
				locks: PnpmEnvLockfile.configDependencies(lockfile),
			}));
			assert.strictEqual(failure.reason, "integrityMismatch");
			assert.include(failure.message, integrity);
		}),
	);

	it.effect("never uses a checksum recorded for another version", () =>
		Effect.gen(function* () {
			const failure = yield* Effect.flip(expectedIntegrity({
				name: "cfg", version: "2.0.0", spec: "2.0.0", side: { ref: "base" },
				locks: PnpmEnvLockfile.configDependencies(lockfile),
			}));
			assert.strictEqual(failure.reason, "integrityUnavailable");
		}),
	);
});
