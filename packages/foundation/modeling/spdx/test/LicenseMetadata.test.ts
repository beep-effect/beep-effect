import { DEPRECATED_LICENSE_IDS, LICENSE_IDS } from "@beep/spdx/internal/licenseIds";
import { LICENSE_META } from "@beep/spdx/internal/licenseMeta";
import { License } from "@beep/spdx/License";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";

describe("License metadata", () => {
  it("covers every cataloged id, active and deprecated", () => {
    assert.strictEqual(HashMap.size(LICENSE_META), HashSet.size(LICENSE_IDS) + HashSet.size(DEPRECATED_LICENSE_IDS));
    for (const id of LICENSE_IDS) assert.isTrue(HashMap.has(LICENSE_META, id), `missing metadata for ${id}`);
    for (const id of DEPRECATED_LICENSE_IDS) assert.isTrue(HashMap.has(LICENSE_META, id), `missing metadata for ${id}`);
  });

  it.effect("carries reference url, name and both approval flags for a known license", () =>
    Effect.gen(function* () {
      const mit = yield* License.parse("MIT");
      assertSome(mit.referenceUrl, "https://spdx.org/licenses/MIT.html");
      assertSome(mit.name, "MIT License");
      assert.isTrue(mit.osiApproved);
      assert.isTrue(mit.fsfLibre);
    })
  );

  it.effect("keeps metadata on a deprecated id", () =>
    Effect.gen(function* () {
      const gpl = yield* License.parse("GPL-3.0");
      assert.isTrue(gpl.deprecated);
      assertSome(gpl.referenceUrl, "https://spdx.org/licenses/GPL-3.0.html");
      assertSome(gpl.name, "GNU General Public License v3.0 only");
      assert.isTrue(gpl.osiApproved);
      assert.isTrue(gpl.fsfLibre);
    })
  );

  it("distinguishes OSI approval from FSF libre in both directions", () => {
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
      assertNone(ref.referenceUrl);
      assertNone(ref.name);
      assert.isFalse(ref.osiApproved);
      assert.isFalse(ref.fsfLibre);
    })
  );

  it.effect("yields None and false for a DocumentRef-scoped LicenseRef", () =>
    Effect.gen(function* () {
      const ref = yield* License.parse("DocumentRef-spdx-tool:LicenseRef-MyProprietary");
      assertNone(ref.referenceUrl);
      assertNone(ref.name);
      assert.isFalse(ref.osiApproved);
      assert.isFalse(ref.fsfLibre);
    })
  );

  it("answers from the catalog for an `of`-built instance, which never consults it", () => {
    const mit = License.of("MIT");
    assertSome(mit.referenceUrl, "https://spdx.org/licenses/MIT.html");
    assertSome(mit.name, "MIT License");
    assert.isTrue(mit.osiApproved);
    assert.isTrue(mit.fsfLibre);
  });

  it("yields None and false for an uncataloged id", () => {
    const junk = License.of("NOT-A-LICENSE");
    assertNone(junk.referenceUrl);
    assertNone(junk.name);
    assert.isFalse(junk.osiApproved);
    assert.isFalse(junk.fsfLibre);
  });

  it("leaves the encoded shape and structural equality untouched", () => {
    assert.deepStrictEqual({ ...License.of("MIT") }, { id: "MIT", deprecated: false });
  });
});
