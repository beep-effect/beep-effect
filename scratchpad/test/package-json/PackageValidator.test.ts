import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Package } from "../../effected/package-json/Package.ts";
import {
	PackageValidationError,
	PackageValidator,
	noLocalDepsRule,
	noUnresolvedDepsRule,
} from "../../effected/package-json/PackageValidator.ts";

describe("PackageValidator", () => {
	layer(PackageValidator.layer, { timeout: "30 seconds" })((it) => {
		it.effect("passes a package satisfying the default rules", () =>
			Effect.gen(function* () {
				const validator = yield* PackageValidator;
				const pkg = yield* Package.decode({
					name: "p",
					version: "1.0.0",
					description: "d",
					license: "MIT",
					repository: { type: "git", url: "https://example.com/p.git" },
				});
				yield* validator.validate(pkg);
			}),
		);

		it.effect("aggregates every default-rule failure into one error", () =>
			Effect.gen(function* () {
				const validator = yield* PackageValidator;
				const pkg = yield* Package.decode({ name: "p", version: "1.0.0", private: true });
				const error = yield* Effect.flip(validator.validate(pkg));
				assert.instanceOf(error, PackageValidationError);
				assert.strictEqual(error._tag, "PackageValidationError");
				// missing license, description, repository + is private
				assert.strictEqual(error.failures.length, 4);
				assert.include(error.message, "has-license");
				assert.include(error.message, "not-private");
			}),
		);
	});

	layer(PackageValidator.layerRules({ rules: [noUnresolvedDepsRule, noLocalDepsRule] }), { timeout: "30 seconds" })((it) => {
		it.effect("custom rules flag unresolved and local dependencies", () =>
			Effect.gen(function* () {
				const validator = yield* PackageValidator;
				const pkg = yield* Package.decode({
					name: "p",
					version: "1.0.0",
					dependencies: { lib: "workspace:*", local: "file:../x" },
				});
				const error = yield* Effect.flip(validator.validate(pkg));
				assert.strictEqual(error.failures.length, 2);
			}),
		);

		it.effect("passes when no dependency is unresolved or local", () =>
			Effect.gen(function* () {
				const validator = yield* PackageValidator;
				const pkg = yield* Package.decode({ name: "p", version: "1.0.0", dependencies: { lodash: "^4.0.0" } });
				yield* validator.validate(pkg);
			}),
		);
	});
});
