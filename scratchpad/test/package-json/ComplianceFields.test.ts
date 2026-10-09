// `maintainers` and `keywords` — the remaining manifest fields the CycloneDX
// 1.6 + NTIA mapping reads that the model did not carry.
//
// Both targets were verified against the CycloneDX 1.6 schema itself
// (`res/schema/bom-1.6.SNAPSHOT.schema.json` in the published library), not
// from memory: `component.tags` exists, `component.authors` and
// `metadata.authors` exist. `funding` was checked the same way and has NO
// externalReference type in 1.6, which is why it was absent from this file.
//
// `funding` HAS SINCE BEEN MODELLED, and its tests live in `Funding.test.ts`.
// It did not arrive through this file's CycloneDX lens and it still has no
// 1.6 externalReference type — it earned its place when a consumer named a
// target for it (a docs site crediting maintainers). The scope rule this
// header encodes is "something consumes it", not "CycloneDX or nothing", so
// this file's coverage stays CycloneDX/NTIA-shaped and `funding` is simply
// out of ITS scope rather than out of the model.

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Package } from "../../effected/package-json/index.ts";

const base = { name: "@scope/pkg", version: "1.0.0" };

const decode = (extra: Record<string, unknown>) => S.decodeEffect(Package.schema)({ ...base, ...extra });
const encode = (pkg: Package) => S.encodeUnknownEffect(Package.schema)(pkg);

describe("maintainers", () => {
	it.effect("decodes the object form into People", () =>
		Effect.gen(function* () {
			// Serves `metadata.supplier.contact` and `component.authors` — NTIA
			// element 1 (supplier name) and element 6 (author of SBOM data).
			const pkg = yield* decode({
				maintainers: [{ name: "Dee", email: "dee@example.com" }, { name: "Ray" }],
			});
			assert.lengthOf(pkg.maintainers ?? [], 2);
			assert.strictEqual(pkg.maintainers?.[0]?.name, "Dee");
			assert.strictEqual(pkg.maintainers?.[0]?.email, "dee@example.com");
			assert.strictEqual(pkg.maintainers?.[1]?.name, "Ray");
		}),
	);

	it.effect("decodes the shorthand string form", () =>
		Effect.gen(function* () {
			const pkg = yield* decode({ maintainers: ["Dee <dee@example.com> (https://dee.example)"] });
			assert.strictEqual(pkg.maintainers?.[0]?.name, "Dee");
			assert.strictEqual(pkg.maintainers?.[0]?.email, "dee@example.com");
			assert.strictEqual(pkg.maintainers?.[0]?.url, "https://dee.example");
		}),
	);

	it.effect("round-trips each encoding, per maintainer", () =>
		Effect.gen(function* () {
			// The `Person` fidelity obligation applies element-wise: a mixed array
			// must not be normalized into one shape. The package's own CLAUDE.md
			// names `maintainers` in its round-trip warning — it just was not a
			// modeled field until now, so nothing enforced it.
			//
			// NOTE, verified by mutation: this assertion does NOT discriminate
			// modeled-vs-unmodeled, because `rest` round-trips unknown keys too, so
			// it passes either way. It guards fidelity, not modeling. The tests that
			// actually pin the field are the two decode cases above and the
			// completeness guard below — those fail when the field is removed.
			const wire = [{ name: "Dee", email: "dee@example.com" }, "Ray <ray@example.com>"];
			const encoded = yield* encode(yield* decode({ maintainers: wire }));
			assert.deepStrictEqual<unknown>((encoded as { maintainers: unknown }).maintainers, wire);
		}),
	);

	it.effect("keeps unknown keys on a maintainer object", () =>
		Effect.gen(function* () {
			const wire = [{ name: "Dee", github: "@dee" }];
			const encoded = yield* encode(yield* decode({ maintainers: wire }));
			assert.deepStrictEqual<unknown>((encoded as { maintainers: unknown }).maintainers, wire);
		}),
	);

	it.effect("is absent when the manifest omits it", () =>
		Effect.gen(function* () {
			const pkg = yield* decode({});
			assert.isUndefined(pkg.maintainers);
			// And absence must not materialize an empty array on the way out.
			assert.isFalse("maintainers" in (yield* encode(pkg)));
		}),
	);
});

describe("keywords", () => {
	it.effect("decodes a string array", () =>
		Effect.gen(function* () {
			// Serves `component.tags`, which CycloneDX added in 1.6.
			const pkg = yield* decode({ keywords: ["effect", "sbom", "cyclonedx"] });
			assert.deepStrictEqual(pkg.keywords, ["effect", "sbom", "cyclonedx"]);
		}),
	);

	it.effect("round-trips order verbatim", () =>
		Effect.gen(function* () {
			// Keyword order is authored, not incidental — sorting it would be a
			// rewrite of legal input.
			const wire = ["zebra", "alpha", "middle"];
			const encoded = yield* encode(yield* decode({ keywords: wire }));
			assert.deepStrictEqual<unknown>((encoded as { keywords: unknown }).keywords, wire);
		}),
	);

	it.effect("an empty array stays an empty array, not an absent key", () =>
		Effect.gen(function* () {
			const encoded = yield* encode(yield* decode({ keywords: [] }));
			assert.deepStrictEqual<unknown>((encoded as { keywords: unknown }).keywords, []);
		}),
	);

	it.effect("is absent when the manifest omits it", () =>
		Effect.gen(function* () {
			assert.isUndefined((yield* decode({})).keywords);
		}),
	);
});

describe("the compliance field set is complete against the mapping", () => {
	it.effect("every field the CycloneDX 1.6 + NTIA mapping reads is modeled", () =>
		Effect.gen(function* () {
			// A guard against the mapping and the model drifting apart. Each name
			// here is read by `SbomMetadataSource.fromPackage` in the sbom design;
			// if a future edit drops one from `Package`, this fails rather than the
			// SBOM silently losing a field.
			const pkg = yield* decode({
				description: "a package",
				license: "MIT",
				author: "Dee <dee@example.com>",
				contributors: ["Ray"],
				maintainers: ["Sam"],
				keywords: ["k"],
				repository: "effected/kit",
				bugs: "https://github.com/effected/kit/issues",
				homepage: "https://effected.dev",
			});
			for (const field of [
				"name",
				"version",
				"description",
				"license",
				"author",
				"contributors",
				"maintainers",
				"keywords",
				"repository",
				"bugs",
				"homepage",
			] as const) {
				assert.isDefined(pkg[field], `${field} should be modeled and populated`);
			}
		}),
	);
});
