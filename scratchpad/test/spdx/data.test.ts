import { assert, describe, it } from "@effect/vitest";
import * as HashSet from "effect/HashSet";
import { EXCEPTION_IDS } from "../../effected/spdx/internal/exceptions.ts";
import { DEPRECATED_LICENSE_IDS, LICENSE_IDS } from "../../effected/spdx/internal/licenseIds.ts";

describe("vendored spdx data", () => {
	it("carries the active license identifiers", () => {
		assert.isTrue(HashSet.has(LICENSE_IDS, "MIT"));
		assert.isTrue(HashSet.has(LICENSE_IDS, "Apache-2.0"));
		assert.isTrue(HashSet.has(LICENSE_IDS, "GPL-3.0-or-later"));
		assert.isFalse(HashSet.has(LICENSE_IDS, "NOT-A-LICENSE"));
	});
	it("separates deprecated identifiers", () => {
		assert.isTrue(HashSet.has(DEPRECATED_LICENSE_IDS, "GPL-3.0"));
		assert.isTrue(HashSet.has(DEPRECATED_LICENSE_IDS, "AGPL-3.0"));
		assert.isFalse(HashSet.has(LICENSE_IDS, "GPL-3.0")); // deprecated ids are not in the active set
	});
	it("carries the exception identifiers", () => {
		assert.isTrue(HashSet.has(EXCEPTION_IDS, "Classpath-exception-2.0"));
		assert.isTrue(HashSet.has(EXCEPTION_IDS, "Bison-exception-2.2"));
	});
	it("matches the upstream counts", () => {
		assert.strictEqual(HashSet.size(LICENSE_IDS), 695);
		assert.strictEqual(HashSet.size(DEPRECATED_LICENSE_IDS), 26);
		assert.strictEqual(HashSet.size(EXCEPTION_IDS), 66);
	});
});
