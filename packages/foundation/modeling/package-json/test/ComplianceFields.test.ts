import { Package } from "@beep/package-json";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const base = { name: "@scope/pkg", version: "1.0.0" };

const decode = (extra: Record<string, unknown>) => S.decodeEffect(Package.schema)({ ...base, ...extra });
const encode = (pkg: Package) => S.encodeUnknownEffect(Package.schema)(pkg);

describe("maintainers (CycloneDX 1.6 component.authors and metadata.supplier.contact, NTIA elements 1 and 6)", () => {
  it.effect("decodes the object form into People", () =>
    Effect.gen(function* () {
      const pkg = yield* decode({
        maintainers: [{ name: "Dee", email: "dee@example.com" }, { name: "Ray" }],
      });
      assert.lengthOf(pkg.maintainers ?? [], 2);
      assert.strictEqual(pkg.maintainers?.[0]?.name, "Dee");
      assert.strictEqual(pkg.maintainers?.[0]?.email, "dee@example.com");
      assert.strictEqual(pkg.maintainers?.[1]?.name, "Ray");
    })
  );

  it.effect("decodes the shorthand string form", () =>
    Effect.gen(function* () {
      const pkg = yield* decode({ maintainers: ["Dee <dee@example.com> (https://dee.example)"] });
      assert.strictEqual(pkg.maintainers?.[0]?.name, "Dee");
      assert.strictEqual(pkg.maintainers?.[0]?.email, "dee@example.com");
      assert.strictEqual(pkg.maintainers?.[0]?.url, "https://dee.example");
    })
  );

  it.effect("round-trips each encoding, per maintainer", () =>
    Effect.gen(function* () {
      const wire = [{ name: "Dee", email: "dee@example.com" }, "Ray <ray@example.com>"];
      const decoded = yield* decode({ maintainers: wire });
      const encoded = yield* encode(decoded);
      assert.deepStrictEqual<unknown>(
        encoded.maintainers,
        wire,
        "a mixed array must not be normalized into one shape; guards fidelity, not modeling, as rest round-trips too"
      );
    })
  );

  it.effect("keeps unknown keys on a maintainer object", () =>
    Effect.gen(function* () {
      const wire = [{ name: "Dee", github: "@dee" }];
      const decoded1 = yield* decode({ maintainers: wire });
      const encoded = yield* encode(decoded1);
      assert.deepStrictEqual<unknown>(encoded.maintainers, wire);
    })
  );

  it.effect("is absent when the manifest omits it", () =>
    Effect.gen(function* () {
      const pkg = yield* decode({});
      assert.isUndefined(pkg.maintainers);
      assert.isFalse(
        "maintainers" in (yield* encode(pkg)),
        "absence must not materialize an empty array on the way out"
      );
    })
  );
});

describe("keywords (CycloneDX 1.6 component.tags)", () => {
  it.effect("decodes a string array", () =>
    Effect.gen(function* () {
      const pkg = yield* decode({ keywords: ["effect", "sbom", "cyclonedx"] });
      assert.deepStrictEqual(pkg.keywords, ["effect", "sbom", "cyclonedx"]);
    })
  );

  it.effect("round-trips order verbatim", () =>
    Effect.gen(function* () {
      const wire = ["zebra", "alpha", "middle"];
      const decoded2 = yield* decode({ keywords: wire });
      const encoded = yield* encode(decoded2);
      assert.deepStrictEqual<unknown>(
        encoded.keywords,
        wire,
        "keyword order is authored: sorting would rewrite legal input"
      );
    })
  );

  it.effect("an empty array stays an empty array, not an absent key", () =>
    Effect.gen(function* () {
      const decoded3 = yield* decode({ keywords: [] });
      const encoded = yield* encode(decoded3);
      assert.deepStrictEqual<unknown>(encoded.keywords, []);
    })
  );

  it.effect("is absent when the manifest omits it", () =>
    Effect.gen(function* () {
      assert.isUndefined((yield* decode({})).keywords);
    })
  );
});

describe("the compliance field set is complete against the mapping (funding has no CycloneDX 1.6 externalReference type)", () => {
  it.effect("every field the CycloneDX 1.6 + NTIA mapping reads is modeled", () =>
    Effect.gen(function* () {
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
        assert.isDefined(
          pkg[field],
          `${field} should be modeled and populated: SbomMetadataSource.fromPackage reads it`
        );
      }
    })
  );
});
