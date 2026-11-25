import { InvalidPackageManagerPinError, PackageManagerPin } from "@beep/npm-spec/PackageManagerPin";
import { SemVer } from "@beep/semver/SemVer";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decode = S.decodeUnknownEffect(PackageManagerPin.FromString);
const encode = S.encodeUnknownEffect(PackageManagerPin.FromString);

const quoteInput = flow(
  S.encodeResult(S.fromJsonString(S.String)),
  Result.getOrElse((error) => assert.fail(`Rejection name JSON encoding failed: ${error.message}`))
);

const flipParse = (input: string) => Effect.flip(PackageManagerPin.parse(input));

describe("PackageManagerPin.parse", () => {
  it.effect("parses the bare <name>@<version> form", () =>
    Effect.gen(function* () {
      const pin = yield* PackageManagerPin.parse("pnpm@11.17.0");
      assert.strictEqual(pin.name, "pnpm");
      assert.strictEqual(pin.version.toString(), "11.17.0");
      assert.strictEqual(pin.version.major, 11);
      assert.notProperty(pin, "integrity", "optionalKey: the field is absent, not present-but-undefined");
      assert.strictEqual(pin.toString(), "pnpm@11.17.0");
    })
  );

  it.effect("parses the <name>@<version>+<integrity> form", () =>
    Effect.gen(function* () {
      const pin = yield* PackageManagerPin.parse("pnpm@11.17.0+sha512.deadbeef01");
      assert.strictEqual(pin.name, "pnpm");
      assert.strictEqual(pin.version.toString(), "11.17.0");
      assert.strictEqual(pin.integrity, "sha512.deadbeef01");
      assert.strictEqual(pin.toString(), "pnpm@11.17.0+sha512.deadbeef01");
    })
  );

  it.effect("accepts every supported manager name", () =>
    Effect.gen(function* () {
      for (const name of ["npm", "pnpm", "yarn", "bun"] as const) {
        const pin = yield* PackageManagerPin.parse(`${name}@1.2.3`);
        assert.strictEqual(pin.name, name);
      }
    })
  );

  it.effect("accepts prerelease versions — corepack pins can carry them", () =>
    Effect.gen(function* () {
      const bare = yield* PackageManagerPin.parse("yarn@4.0.0-rc.1");
      assert.strictEqual(bare.version.toString(), "4.0.0-rc.1");
      assert.deepStrictEqual(bare.version.prerelease, ["rc", 1]);

      const withIntegrity = yield* PackageManagerPin.parse("pnpm@10.0.0-beta.2+sha512.abc123");
      const corepackDefaultYarnBerryPinSha224OnceFailedAsIntegrity = yield* PackageManagerPin.parse(
        "yarn@4.12.0+sha224.877304e3c9e5b53431969ee2ca17ee44f366533b0da5a4ba9c2bd447"
      );
      assert.strictEqual(
        corepackDefaultYarnBerryPinSha224OnceFailedAsIntegrity.integrity,
        "sha224.877304e3c9e5b53431969ee2ca17ee44f366533b0da5a4ba9c2bd447"
      );
      assert.strictEqual(withIntegrity.version.toString(), "10.0.0-beta.2");
      assert.strictEqual(withIntegrity.integrity, "sha512.abc123");
    })
  );
});

describe("the +-split rule", () => {
  it.effect(
    "the first + begins the integrity, never semver build metadata, whose split would read version 11.17.0+sha512.abc with no integrity",
    () =>
      Effect.gen(function* () {
        const pin = yield* PackageManagerPin.parse("pnpm@11.17.0+sha512.abc");
        assert.strictEqual(pin.version.toString(), "11.17.0");
        assert.deepStrictEqual(pin.version.build, []);
        assert.strictEqual(pin.integrity, "sha512.abc");
      })
  );

  it.effect("a malformed tail after + fails typed — no fallback to build-metadata parsing", () =>
    Effect.gen(function* () {
      const error = yield* flipParse("pnpm@11.17.0+garbage");
      assert.instanceOf(error, InvalidPackageManagerPinError);
      assert.strictEqual(
        error.reason,
        "integrity",
        "`garbage` is a valid semver build identifier, so a build-metadata fallback would accept it: it must fail on the integrity component"
      );
    })
  );

  it("a version constructed with build metadata is a wiring defect at make: it would encode to a string that re-parses differently", () => {
    assert.throws(() => PackageManagerPin.make({ name: "pnpm", version: SemVer.of(1, 2, 3, [], ["sha"]) }));
    const pin = PackageManagerPin.make({ name: "pnpm", version: SemVer.of(1, 2, 3) });
    assert.strictEqual(pin.toString(), "pnpm@1.2.3", "control: the same construction without build metadata succeeds");
  });
});

describe("PackageManagerPin rejection matrix", () => {
  const rejects = (input: string, reason: "format" | "name" | "version" | "integrity", because = "") =>
    it.effect(`rejects ${quoteInput(input)} with reason "${reason}"${because === "" ? "" : `: ${because}`}`, () =>
      Effect.gen(function* () {
        const error = yield* flipParse(input);
        assert.instanceOf(error, InvalidPackageManagerPinError);
        assert.strictEqual(error._tag, "InvalidPackageManagerPinError");
        assert.strictEqual(error.reason, reason);
        const resultTwinSharingOneGrammar = PackageManagerPin.parseResult(input);
        assertFailure(resultTwinSharingOneGrammar, resultTwinSharingOneGrammar.pipe(Result.flip, Result.getOrThrow));
      })
    );

  const rangesAreNotPinnable = "ranges are not pinnable";
  rejects("pnpm@^9.0.0", "version", rangesAreNotPinnable);
  rejects("pnpm@~9.0.0", "version", rangesAreNotPinnable);
  rejects("pnpm@>=9", "version", rangesAreNotPinnable);
  const partialVersionsAreNotExact = "partial versions are not exact versions";
  rejects("pnpm@9", "version", partialVersionsAreNotExact);
  rejects("pnpm@9.1", "version", partialVersionsAreNotExact);
  const distTagsAreNotVersions = "dist-tags are not versions";
  rejects("yarn@berry", "version", distTagsAreNotVersions);
  rejects("pnpm@latest", "version", distTagsAreNotVersions);
  rejects("pnpm@v1.2.3", "version");
  rejects("pnpm@", "version");
  const paddedDiscriminatesIsPinnableFromTrimmingParse =
    "SemVer.isPinnable rejects the padding SemVer.parseResult alone trims, so a bare-parse implementation would canonicalize it";
  rejects("pnpm@ 11.17.0", "version", paddedDiscriminatesIsPinnableFromTrimmingParse);
  rejects("pnpm@11.17.0 ", "version", paddedDiscriminatesIsPinnableFromTrimmingParse);
  rejects("pnpm@ 11.17.0 +sha512.deadbeef", "version", paddedDiscriminatesIsPinnableFromTrimmingParse);
  rejects("cargo@1.0.0", "name");
  rejects("PNPM@1.0.0", "name");
  rejects("@1.0.0", "name");
  rejects("pnpm", "format");
  rejects("", "format");
  rejects("pnpm@11.17.0+", "integrity");
  rejects("pnpm@11.17.0+sha512-YWJjZGVm", "integrity");
  rejects("pnpm@11.17.0+sha512.DEADBEEF", "integrity");
  rejects("pnpm@11.17.0+md5.deadbeef", "integrity");
});

describe("PackageManagerPin.FromString", () => {
  it.effect("round-trips both forms byte-for-byte", () =>
    Effect.gen(function* () {
      for (const input of ["pnpm@11.17.0", "npm@10.9.2+sha512.abcdef0123", "yarn@4.0.0-rc.1+sha512.0badf00d"]) {
        const pin = yield* decode(input);
        assert.instanceOf(pin, PackageManagerPin);
        const encoded = yield* encode(pin);
        assert.strictEqual(encoded, input);
      }
    })
  );

  it.effect("fails decode with the pin error's message on malformed input", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decode("pnpm@^9.0.0"));
      assert.strictEqual(error._tag, "SchemaError");
      assert.include(String(error), "exact SemVer version");
    })
  );

  it.effect("encodes a constructed pin without integrity to the bare form", () =>
    Effect.gen(function* () {
      const parsed = PackageManagerPin.parseResult("bun@1.3.0");
      assertSuccess(parsed, Result.getOrThrow(parsed));
      if (Result.isSuccess(parsed)) {
        const encoded1 = yield* encode(parsed.success);
        assert.strictEqual(encoded1, "bun@1.3.0");
      }
    })
  );
});

describe("PackageManagerPin.parseResult", () => {
  it("is the sync primitive: success carries the pin, failure the typed error", () => {
    const ok = PackageManagerPin.parseResult("pnpm@11.17.0+sha512.abc");
    assertSuccess(ok, Result.getOrThrow(ok));
    if (Result.isSuccess(ok)) {
      assert.strictEqual(ok.success.name, "pnpm");
      assert.strictEqual(ok.success.integrity, "sha512.abc");
    }

    const bad = PackageManagerPin.parseResult("pnpm@11");
    assertFailure(bad, bad.pipe(Result.flip, Result.getOrThrow));
    if (Result.isFailure(bad)) {
      assert.strictEqual(bad.failure._tag, "InvalidPackageManagerPinError");
      assert.strictEqual(bad.failure.reason, "version");
      assert.strictEqual(bad.failure.input, "pnpm@11");
      assert.include(bad.failure.message, "pnpm@11");
    }
  });
});

describe("PackageManagerPin.bare", () => {
  it("renders name@version without the integrity, and equals toString for a bare pin", () => {
    const hashed = PackageManagerPin.parseResult(`pnpm@12.6.0+sha512.${Str.repeat(64)("ab")}`);
    const plain = PackageManagerPin.parseResult("pnpm@12.6.0");
    assertSuccess(hashed, Result.getOrThrow(hashed));
    assertSuccess(plain, Result.getOrThrow(plain));
    if (Result.isSuccess(hashed) && Result.isSuccess(plain)) {
      assert.strictEqual(hashed.success.bare, "pnpm@12.6.0");
      assert.notStrictEqual(hashed.success.toString(), hashed.success.bare);
      assert.strictEqual(plain.success.bare, plain.success.toString());
    }
  });
});

describe("PackageManagerPin.FromString properties", () => {
  it.effect.prop("prints a pin that parses back to the same pin text", [PackageManagerPin], ([pin]) =>
    Effect.gen(function* () {
      const printed = yield* encode(pin);
      const reparsed = yield* decode(printed);
      const encoded2 = yield* encode(reparsed);
      assert.strictEqual(encoded2, printed);
    })
  );
});
