import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import { DEPRECATED_LICENSE_IDS, LICENSE_IDS } from "../../effected/spdx/internal/licenseIds.ts";
import { LICENSE_META } from "../../effected/spdx/internal/licenseMeta.ts";
import { License } from "../../effected/spdx/License.ts";

describe("License metadata", () => {
	it("covers every cataloged id, active and deprecated", () => {
		assert.strictEqual(HashMap.size(LICENSE_META), HashSet.size(LICENSE_IDS) + HashSet.size(DEPRECATED_LICENSE_IDS));
		for (const id of LICENSE_IDS) assert.isTrue(HashMap.has(LICENSE_META, id), `missing metadata for ${id}`);
		for (const id of DEPRECATED_LICENSE_IDS) assert.isTrue(HashMap.has(LICENSE_META, id), `missing metadata for ${id}`);
	});

	it.effect("carries reference url, name and both approval flags for a known license", () =>
		Effect.gen(function* () {
			const mit = yield* License.parse("MIT");
			assert.deepStrictEqual(mit.referenceUrl, O.some("https://spdx.org/licenses/MIT.html"));
			assert.deepStrictEqual(mit.name, O.some("MIT License"));
			assert.isTrue(mit.osiApproved);
			assert.isTrue(mit.fsfLibre);
		}),
	);

	it.effect("keeps metadata on a deprecated id", () =>
		Effect.gen(function* () {
			const gpl = yield* License.parse("GPL-3.0");
			assert.isTrue(gpl.deprecated);
			assert.deepStrictEqual(gpl.referenceUrl, O.some("https://spdx.org/licenses/GPL-3.0.html"));
			assert.deepStrictEqual(gpl.name, O.some("GNU General Public License v3.0 only"));
			assert.isTrue(gpl.osiApproved);
			assert.isTrue(gpl.fsfLibre);
		}),
	);

	it("distinguishes OSI approval from FSF libre in both directions", () => {
		// 0BSD is OSI-approved and not FSF-libre; Apache-1.0 is the converse.
		const zeroBsd = License.of("0BSD");
		assert.isTrue(zeroBsd.osiApproved);
		assert.isFalse(zeroBsd.fsfLibre);

		const apache1 = License.of("Apache-1.0");
		assert.isFalse(apache1.osiApproved);
		assert.isTrue(apache1.fsfLibre);
	});

	it.effect("yields None and false for a LicenseRef", () =>
		Effect.gen(function* () {
			const ref = yield* License.parse("LicenseRef-MyProprietary");
			assert.isTrue(O.isNone(ref.referenceUrl));
			assert.isTrue(O.isNone(ref.name));
			assert.isFalse(ref.osiApproved);
			assert.isFalse(ref.fsfLibre);
		}),
	);

	it.effect("yields None and false for a DocumentRef-scoped LicenseRef", () =>
		Effect.gen(function* () {
			const ref = yield* License.parse("DocumentRef-spdx-tool:LicenseRef-MyProprietary");
			assert.isTrue(O.isNone(ref.referenceUrl));
			assert.isTrue(O.isNone(ref.name));
			assert.isFalse(ref.osiApproved);
			assert.isFalse(ref.fsfLibre);
		}),
	);

	it("answers from the catalog for an `of`-built instance, which never consults it", () => {
		const mit = License.of("MIT");
		assert.deepStrictEqual(mit.referenceUrl, O.some("https://spdx.org/licenses/MIT.html"));
		assert.deepStrictEqual(mit.name, O.some("MIT License"));
		assert.isTrue(mit.osiApproved);
		assert.isTrue(mit.fsfLibre);
	});

	it("yields None and false for an uncataloged id", () => {
		const junk = License.of("NOT-A-LICENSE");
		assert.isTrue(O.isNone(junk.referenceUrl));
		assert.isTrue(O.isNone(junk.name));
		assert.isFalse(junk.osiApproved);
		assert.isFalse(junk.fsfLibre);
	});

	it("leaves the encoded shape and structural equality untouched", () => {
		// Metadata is resolved by id at access time, never stored on the
		// instance: storing it would change the class's encoded shape.
		assert.deepStrictEqual({ ...License.of("MIT") }, { id: "MIT", deprecated: false });
	});
});
