import { assert, describe, it } from "@effect/vitest";
import { EXCEPTION_IDS } from "../../effected/spdx/internal/exceptions.ts";
import { DEPRECATED_LICENSE_IDS, LICENSE_IDS } from "../../effected/spdx/internal/licenseIds.ts";

describe("vendored spdx data", () => {
	it("carries the active license identifiers", () => {
		assert.isTrue(LICENSE_IDS.has("MIT"));
		assert.isTrue(LICENSE_IDS.has("Apache-2.0"));
		assert.isTrue(LICENSE_IDS.has("GPL-3.0-or-later"));
		assert.isFalse(LICENSE_IDS.has("NOT-A-LICENSE"));
	});
	it("separates deprecated identifiers", () => {
		assert.isTrue(DEPRECATED_LICENSE_IDS.has("GPL-3.0"));
		assert.isTrue(DEPRECATED_LICENSE_IDS.has("AGPL-3.0"));
		assert.isFalse(LICENSE_IDS.has("GPL-3.0")); // deprecated ids are not in the active set
	});
	it("carries the exception identifiers", () => {
		assert.isTrue(EXCEPTION_IDS.has("Classpath-exception-2.0"));
		assert.isTrue(EXCEPTION_IDS.has("Bison-exception-2.2"));
	});
	it("matches the upstream counts", () => {
		assert.strictEqual(LICENSE_IDS.size, 695);
		assert.strictEqual(DEPRECATED_LICENSE_IDS.size, 26);
		assert.strictEqual(EXCEPTION_IDS.size, 66);
	});
});
