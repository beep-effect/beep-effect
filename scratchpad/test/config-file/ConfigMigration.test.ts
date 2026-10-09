import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { VersionAccess } from "../../effected/config-file/ConfigMigration.ts";
import { ConfigMigration, ConfigMigrationError } from "../../effected/config-file/ConfigMigration.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";

const bump = (version: number, name: string, fn: (raw: Record<string, unknown>) => Record<string, unknown>) => ({
	version,
	name,
	up: (raw: unknown) => {
		if (!P.isObject(raw)) return assert.fail("expected a migration document");
		return Effect.succeed(fn(raw));
	},
});

describe("ConfigMigration.make", () => {
	it.effect("applies pending migrations in ascending order and stamps the version", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [bump(3, "add-c", (r) => ({ ...r, c: 3 })), bump(2, "add-b", (r) => ({ ...r, b: 2 }))],
			});
			const parsed = yield* codec.parse(`{"version":1,"a":1}`);
			assert.deepStrictEqual(parsed, { version: 3, a: 1, b: 2, c: 3 });
		}),
	);

	it.effect("skips migrations at or below the current version", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [bump(2, "add-b", (r) => ({ ...r, b: 2 }))],
			});
			const parsed = yield* codec.parse(`{"version":2,"a":1}`);
			assert.deepStrictEqual(parsed, { version: 2, a: 1 });
		}),
	);

	it.effect("fails with ConfigMigrationError naming the step — not a reason string", () =>
		Effect.gen(function* () {
			const boom = new Error("upstream exploded");
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [{ version: 2, name: "add-b", up: () => Effect.fail(boom) }],
			});
			const error = yield* codec.parse(`{"version":1}`).pipe(Effect.asVoid, Effect.flip);
			assert.instanceOf(error, ConfigMigrationError);
			assert.isTrue(S.is(ConfigMigrationError)(error));
			assert.strictEqual(error._tag, "ConfigMigrationError");
			assert.strictEqual(error.name, "add-b");
			assert.strictEqual(error.version, 2);
			assert.strictEqual(error.phase, "apply");
			// identity preserved — not String(e), not e.message, not a reason string.
			assert.strictEqual(error.cause, boom);
		}),
	);

	it.effect("fails with phase read-version when the version field is missing", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [bump(2, "add-b", (r) => r)],
			});
			const error = yield* codec.parse(`{"a":1}`).pipe(Effect.asVoid, Effect.flip);
			if (!S.is(ConfigMigrationError)(error)) throw error;
			assert.strictEqual(error.phase, "read-version");
		}),
	);

	it.effect("a codec failure surfaces as ConfigCodecError, not ConfigMigrationError", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({ codec: JsonCodec, migrations: [bump(2, "x", (r) => r)] });
			const error = yield* codec.parse("{ not json").pipe(Effect.asVoid, Effect.flip);
			assert.strictEqual(error._tag, "ConfigCodecError");
			// The SchemaError from JSON decoding must survive structurally through the
			// decorator. Asserting the tag alone would still pass if a regression
			// stringified the cause, which is the one thing this error model forbids.
			assert.instanceOf(error.cause, S.SchemaError);
		}),
	);

	it.effect("with no migrations, parse is the inner codec's parse", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({ codec: JsonCodec, migrations: [] });
			assert.deepStrictEqual(yield* codec.parse(`{"a":1}`), { a: 1 });
		}),
	);

	it.effect("a migration that throws instead of failing its Effect is a defect, not a typed error", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [
					{
						version: 2,
						name: "throws-sync",
						up: () => {
							throw new Error("bug");
						},
					},
				],
			});
			const exit = yield* Effect.exit(codec.parse(`{"version":1}`));
			assert.isTrue(Exit.isFailure(exit));
			const cause = Exit.getCause(exit);
			assert.isTrue(O.isSome(cause));
			if (O.isSome(cause)) {
				// A throw from caller-supplied migration code is a programmer bug: it stays a
				// defect so catchTag("ConfigMigrationError") cannot silently swallow it.
				assert.isTrue(Cause.hasDies(cause.value));
				assert.isFalse(Cause.hasFails(cause.value));
			}
		}),
	);

	it.effect("a throw inside the returned Effect dies the same way", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [
					{
						version: 2,
						name: "throws-inside",
						up: () =>
							Effect.sync(() => {
								throw new Error("bug");
							}),
					},
				],
			});
			const exit = yield* Effect.exit(codec.parse(`{"version":1}`));
			assert.isTrue(Exit.isFailure(exit));
			const cause = Exit.getCause(exit);
			assert.isTrue(O.isSome(cause));
			if (O.isSome(cause)) assert.isTrue(Cause.hasDies(cause.value));
		}),
	);
});

class VersionAccessError extends S.TaggedError<VersionAccessError>()("VersionAccessError", { message: S.String }) {
	override name = "Error";
}

/** Reads and writes the version at `meta.schemaVersion` instead of the default top-level `version`. */
const metaAccess: VersionAccess<VersionAccessError> = {
	get: (raw) => {
		const meta = P.hasProperty(raw, "meta") ? raw.meta : undefined;
		const version = P.hasProperty(meta, "schemaVersion") ? meta.schemaVersion : undefined;
		return P.isNumber(version)
			? Effect.succeed(version)
			: Effect.fail(VersionAccessError.make({ message: "meta.schemaVersion is missing or not a number" }));
	},
	set: (raw, version) => {
		if (!P.isObject(raw)) return assert.fail("expected a migration document");
		const meta = raw.meta;
		if (!P.isObject(meta)) return assert.fail("expected version metadata");
		return Effect.succeed({ ...raw, meta: { ...meta, schemaVersion: version } });
	},
};

describe("ConfigMigration.make with a custom versionAccess", () => {
	it.effect("reads the version through the custom get, not the default field", () =>
		Effect.gen(function* () {
			// The top-level `version` is 0: if the default accessor were consulted, BOTH
			// migrations would run and `b` would appear. The custom accessor reads 2 from
			// meta.schemaVersion, so only the v3 step is pending.
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [bump(3, "add-c", (r) => ({ ...r, c: 3 })), bump(2, "add-b", (r) => ({ ...r, b: 2 }))],
				versionAccess: metaAccess,
			});
			const parsed = yield* codec.parse(`{"version":0,"meta":{"schemaVersion":2},"a":1}`);
			assert.deepStrictEqual(parsed, { version: 0, meta: { schemaVersion: 3 }, a: 1, c: 3 });
		}),
	);

	it.effect("stamps the version through the custom set after every applied step", () =>
		Effect.gen(function* () {
			const setVersions: Array<number> = [];
			const seenByUp: Array<unknown> = [];
			const recordingAccess: VersionAccess<VersionAccessError> = {
				get: metaAccess.get,
				set: (raw, version) => {
					setVersions.push(version);
					return metaAccess.set(raw, version);
				},
			};
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [
					bump(2, "add-b", (r) => ({ ...r, b: 2 })),
					{
						version: 3,
						name: "add-c",
						up: (raw) => {
							seenByUp.push(raw);
							if (!P.isObject(raw)) return assert.fail("expected a migration document");
							return Effect.succeed({ ...raw, c: 3 });
						},
					},
				],
				versionAccess: recordingAccess,
			});
			const parsed = yield* codec.parse(`{"meta":{"schemaVersion":1},"a":1}`);
			// set ran once per applied migration, in ascending order.
			assert.deepStrictEqual(setVersions, [2, 3]);
			// The v3 step saw the document AS STAMPED by the v2 write-version phase —
			// the chain is keyed through the custom accessor, not around it.
			assert.deepStrictEqual(seenByUp, [{ meta: { schemaVersion: 2 }, a: 1, b: 2 }]);
			// No default top-level `version` field appears anywhere.
			assert.deepStrictEqual(parsed, { meta: { schemaVersion: 3 }, a: 1, b: 2, c: 3 });
		}),
	);

	it.effect("a custom get failing surfaces phase read-version with the cause by identity", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [bump(2, "add-b", (r) => r)],
				versionAccess: metaAccess,
			});
			// The document satisfies the DEFAULT accessor (top-level version) but not the
			// custom one — the failure proves the custom get was the one consulted.
			const error = yield* codec.parse(`{"version":1,"a":1}`).pipe(Effect.asVoid, Effect.flip);
			assert.instanceOf(error, ConfigMigrationError);
			assert.isTrue(S.is(ConfigMigrationError)(error));
			assert.strictEqual(error.phase, "read-version");
			assert.strictEqual(error.version, 0);
			assert.strictEqual(error.name, "");
			assert.instanceOf(error.cause, Error);
			assert.isTrue(error.cause instanceof Error);
			assert.strictEqual(
				error.cause.message,
				"meta.schemaVersion is missing or not a number",
			);
		}),
	);

	it.effect("a custom get pointing at a wrong-typed field fails with phase read-version", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [bump(2, "add-b", (r) => r)],
				versionAccess: metaAccess,
			});
			const error = yield* codec.parse(`{"meta":{"schemaVersion":"two"}}`).pipe(Effect.asVoid, Effect.flip);
			assert.instanceOf(error, ConfigMigrationError);
			assert.isTrue(S.is(ConfigMigrationError)(error));
			assert.strictEqual(error.phase, "read-version");
		}),
	);

	it.effect("a custom set failing surfaces phase write-version naming the step, cause by identity", () =>
		Effect.gen(function* () {
			const boom = new Error("cannot stamp");
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [bump(2, "add-b", (r) => ({ ...r, b: 2 }))],
				versionAccess: { get: metaAccess.get, set: () => Effect.fail(boom) },
			});
			const error = yield* codec.parse(`{"meta":{"schemaVersion":1}}`).pipe(Effect.asVoid, Effect.flip);
			assert.instanceOf(error, ConfigMigrationError);
			assert.isTrue(S.is(ConfigMigrationError)(error));
			assert.strictEqual(error.phase, "write-version");
			assert.strictEqual(error.version, 2);
			assert.strictEqual(error.name, "add-b");
			assert.strictEqual(error.cause, boom);
		}),
	);

	it.effect("a custom get that throws instead of failing its Effect stays a defect", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [bump(2, "add-b", (r) => r)],
				versionAccess: {
					get: () => {
						throw new Error("bug in get");
					},
					set: metaAccess.set,
				},
			});
			const exit = yield* Effect.exit(codec.parse(`{"meta":{"schemaVersion":1}}`));
			assert.isTrue(Exit.isFailure(exit));
			const cause = Exit.getCause(exit);
			assert.isTrue(O.isSome(cause));
			if (O.isSome(cause)) {
				// A throw from a caller-supplied VersionAccess is a contract violation — it
				// must NOT be laundered into ConfigMigrationError.
				assert.isTrue(Cause.hasDies(cause.value));
				assert.isFalse(Cause.hasFails(cause.value));
			}
		}),
	);

	it.effect("a custom set throwing inside its returned Effect stays a defect", () =>
		Effect.gen(function* () {
			const codec = ConfigMigration.make({
				codec: JsonCodec,
				migrations: [bump(2, "add-b", (r) => r)],
				versionAccess: {
					get: metaAccess.get,
					set: () =>
						Effect.sync(() => {
							throw new Error("bug in set");
						}),
				},
			});
			const exit = yield* Effect.exit(codec.parse(`{"meta":{"schemaVersion":1}}`));
			assert.isTrue(Exit.isFailure(exit));
			const cause = Exit.getCause(exit);
			assert.isTrue(O.isSome(cause));
			if (O.isSome(cause)) {
				assert.isTrue(Cause.hasDies(cause.value));
				assert.isFalse(Cause.hasFails(cause.value));
			}
		}),
	);
});
