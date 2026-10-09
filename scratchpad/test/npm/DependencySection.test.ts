import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { DependencyField, DependencyKind, DependencySection } from "../../effected/npm/index.ts";

describe("DependencySection", () => {
	it("maps every kind to its field and back (bijective)", () => {
		const kinds = ["prod", "dev", "peer", "optional"] as const;
		for (const kind of kinds) {
			const field = DependencySection.fieldOf(kind);
			assert.strictEqual(DependencySection.kindOf(field), kind, kind);
		}
	});

	it("maps every field to its kind and back (bijective)", () => {
		const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
		for (const field of fields) {
			const kind = DependencySection.kindOf(field);
			assert.strictEqual(DependencySection.fieldOf(kind), field, field);
		}
	});

	it("uses the concrete manifest field names", () => {
		assert.strictEqual(DependencySection.fieldOf("prod"), "dependencies");
		assert.strictEqual(DependencySection.fieldOf("dev"), "devDependencies");
		assert.strictEqual(DependencySection.fieldOf("peer"), "peerDependencies");
		assert.strictEqual(DependencySection.fieldOf("optional"), "optionalDependencies");
	});

	it.effect("DependencyKind schema accepts the four kinds and rejects a field name", () =>
		Effect.gen(function* () {
			for (const kind of ["prod", "dev", "peer", "optional"]) {
				assert.strictEqual(yield* S.decodeUnknownEffect(DependencyKind)(kind), kind);
			}
			const error = yield* Effect.flip(S.decodeUnknownEffect(DependencyKind)("dependencies"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("DependencyField schema accepts the four field names and rejects a kind", () =>
		Effect.gen(function* () {
			for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
				assert.strictEqual(yield* S.decodeUnknownEffect(DependencyField)(field), field);
			}
			const error = yield* Effect.flip(S.decodeUnknownEffect(DependencyField)("prod"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);
});
