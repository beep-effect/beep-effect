import { $ScratchpadId } from "@beep/identity/packages";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import { DependencyMapField, PeerDependenciesMetaField, PublishConfigField, StringMapField } from "../../effected/package-json/Package.ts";

describe("Package field schemas", () => {
	it("carry their owning schema identity metadata", () => {
		const $I = $ScratchpadId.create("effected/package-json/Package");
		for (const [name, schema] of [
			["DependencyMapField", DependencyMapField],
			["StringMapField", StringMapField],
			["PublishConfigField", PublishConfigField],
			["PeerDependenciesMetaField", PeerDependenciesMetaField],
		] as const) {
			assert.include(S.resolveAnnotations(schema), $I.annote(name));
		}
	});

	it.effect("preserve map round trips, validation and the absent dependency default", () =>
		Effect.gen(function* () {
			for (const schema of [DependencyMapField, StringMapField]) {
				const input = { lodash: "^4.0.0", "@scope/pkg": "workspace:*" };
				const decoded = yield* S.decodeEffect(schema)(input);
				assert.isTrue(HashMap.isHashMap(decoded));
				assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), input);
				assert.strictEqual((yield* Effect.flip(S.decodeUnknownEffect(schema)({ lodash: 42 })))._tag, "SchemaError");
			}
			const fields = S.Struct({ dependencies: DependencyMapField, engines: S.optionalKey(StringMapField) });
			const decoded = yield* S.decodeEffect(fields)({});
			assert.isTrue(HashMap.isEmpty(decoded.dependencies));
			assert.isUndefined(decoded.engines);
			assert.deepStrictEqual(yield* S.encodeEffect(fields)(decoded), { dependencies: {} });
		}),
	);

	it.effect("preserve open publish config and optional peer metadata", () =>
		Effect.gen(function* () {
			const config = { access: "public", targets: ["node"], custom: { enabled: true } };
			assert.deepStrictEqual(yield* S.encodeEffect(PublishConfigField)(yield* S.decodeEffect(PublishConfigField)(config)), config);
			const peers = { lodash: { optional: true }, react: {} };
			assert.deepStrictEqual(yield* S.encodeEffect(PeerDependenciesMetaField)(yield* S.decodeEffect(PeerDependenciesMetaField)(peers)), peers);
			assert.strictEqual((yield* Effect.flip(S.decodeUnknownEffect(PeerDependenciesMetaField)({ react: { optional: "yes" } })))._tag, "SchemaError");
		}),
	);
});
