import { CorepackIntegrityHash, IntegrityHash } from "@beep/npm-spec/IntegrityHash";
import { PackageManager } from "@beep/package-json/PackageManager";
import { SemVer } from "@beep/semver";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const UnknownJson = S.fromJsonString(S.Unknown);

const decode = S.decodeUnknownEffect(PackageManager.FromString);
const encode = S.encodeUnknownEffect(PackageManager.FromString);

describe("PackageManager.FromString (<name>@<version>[+<integrity>])", () => {
  it.effect("parses name, version and integrity", () =>
    Effect.gen(function* () {
      const pm = yield* decode("pnpm@10.33.0+sha512.abc");
      assert.strictEqual(pm.name, "pnpm");
      assert.strictEqual(pm.version, "10.33.0");
      assert.deepStrictEqual(pm.integrity, O.some("sha512.abc"));
      assert.isTrue(pm.hasIntegrity);
    })
  );

  it.effect("parses without integrity", () =>
    Effect.gen(function* () {
      const pm = yield* decode("pnpm@10.33.0");
      assert.deepStrictEqual(pm.integrity, O.none());
      assert.isFalse(pm.hasIntegrity);
    })
  );

  it.effect("round-trips encode(decode)", () =>
    Effect.gen(function* () {
      for (const input of ["pnpm@10.33.0+sha512.abc", "yarn@4.1.0", "npm@10.2.3-beta.1", "bun@1.2.20"]) {
        const pm = yield* decode(input);
        const encoded = yield* encode(pm);
        assert.strictEqual(encoded, input);
      }
    })
  );

  it.effect("rejects an invalid format", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decode("not-a-pm"));
      assert.strictEqual(error._tag, "SchemaError");
    })
  );

  it.effect("rejects a malformed integrity as a typed failure, not a defect", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decode("pnpm@10.33.0+GARBAGE!!"));
      assert.strictEqual(
        error._tag,
        "SchemaError",
        "an integrity that is not an IntegrityHash must fail the decode, never escape as a defect"
      );
    })
  );

  it.effect("rejects an SRI integrity (not the corepack form)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decode("pnpm@10.33.0+sha512-abcd1234=="));
      assert.strictEqual(
        error._tag,
        "SchemaError",
        "the field carries only corepack's <algo>.<hex> integrity, narrower than the IntegrityHash brand"
      );
    })
  );

  it.effect("rejects a yarn 10c0/ checksum integrity (not the corepack form)", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decode("pnpm@10.33.0+10c0/abcdef0123"));
      assert.strictEqual(
        error._tag,
        "SchemaError",
        "the field carries only corepack's <algo>.<hex> integrity, narrower than the IntegrityHash brand"
      );
    })
  );

  it.effect("accepts a real corepack sha512.<hex> integrity", () =>
    Effect.gen(function* () {
      const pm = yield* decode("pnpm@10.33.0+sha512.deadbeef");
      assert.deepStrictEqual(pm.integrity, O.some("sha512.deadbeef"));
      assert.isTrue(pm.hasIntegrity);
    })
  );

  it.effect("accepts corepack's sha224 default-pin integrity", () =>
    Effect.gen(function* () {
      const input = "yarn@4.12.0+sha224.877304e3c9e5b53431969ee2ca17ee44f366533b0da5a4ba9c2bd447";
      const pm = yield* decode(input);
      const encoded1 = yield* encode(pm);
      assert.strictEqual(encoded1, input, "corepack's own package.json pins yarn with a sha224 tail");
    })
  );

  it.effect("the first + begins the integrity, never semver build metadata", () =>
    Effect.gen(function* () {
      const pm = yield* decode("pnpm@10.33.0+sha512.abc");
      assert.strictEqual(pm.version, "10.33.0", "a semver split would read the version as 10.33.0+sha512.abc");
      assert.deepStrictEqual(pm.integrity, O.some("sha512.abc"));
    })
  );

  it.effect("a valid build-metadata tail that is not a corepack hash still fails", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decode("pnpm@10.33.0+deadbeef"));
      assert.strictEqual(
        error._tag,
        "SchemaError",
        "deadbeef is a valid semver build identifier, so a build-metadata fallback would accept it"
      );
      assert.include(String(error), "integrity");
    })
  );
});

describe("PackageManager.FromString version rejection matrix (strict SemVer parse, as corepack's semver.valid)", () => {
  const rejects = (input: string, why: string) =>
    it.effect(`rejects ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(input), identity)} — ${why}`, () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(decode(input));
        assert.strictEqual(error._tag, "SchemaError");
        assert.include(String(error), "version", "the failure must name the component that failed");
      })
    );

  rejects("pnpm@01.2.3", "leading zero on major (SemVer §2)");
  rejects("pnpm@1.02.3", "leading zero on minor (SemVer §2)");
  rejects("pnpm@1.2.03", "leading zero on patch (SemVer §2)");
  rejects("pnpm@1.2.3-01", "leading zero on a numeric prerelease identifier (SemVer §9)");
  rejects("pnpm@1.2.3-a..b", "empty prerelease identifier (SemVer §9)");
  rejects("pnpm@1.2.3-", "empty prerelease");
  rejects("pnpm@^9.0.0", "range");
  rejects("pnpm@9", "partial version");
  rejects("pnpm@9.1", "partial version");
  rejects("pnpm@latest", "dist-tag");
  rejects("pnpm@v1.2.3", "v prefix");
  rejects("pnpm@", "empty version");
  rejects("pnpm@ 10.33.0", "leading whitespace on the version (isPinnable refuses padding, parseResult trims)");
  rejects("pnpm@10.33.0 ", "trailing whitespace on the version (isPinnable refuses padding, parseResult trims)");

  it.effect("still accepts the prerelease forms that ARE valid", () =>
    Effect.gen(function* () {
      for (const input of ["pnpm@1.2.3-rc.1", "pnpm@1.2.3-0rc", "pnpm@1.2.3-alpha.0", "pnpm@0.0.0"]) {
        const pm = yield* decode(input);
        const encoded2 = yield* encode(pm);
        assert.strictEqual(encoded2, input, input);
      }
    })
  );

  it("a malformed version is rejected at construction, not encoded to a string that re-parses differently", () => {
    assert.throws(() => PackageManager.make({ name: "pnpm", version: "01.2.3", integrity: O.none() }));
    assert.throws(() => PackageManager.make({ name: "pnpm", version: "latest", integrity: O.none() }));
    const buildMetadataInIntegritySlot = () =>
      PackageManager.make({ name: "pnpm", version: "1.2.3+build", integrity: O.none() });
    assert.throws(buildMetadataInIntegritySlot);
    const paddedVersionAtConstruction = () =>
      PackageManager.make({ name: "pnpm", version: " 1.2.3", integrity: O.none() });
    assert.throws(paddedVersionAtConstruction);
    const pm = PackageManager.make({ name: "pnpm", version: "1.2.3", integrity: O.none() });
    assert.strictEqual(pm.version, "1.2.3", "the control: the same construction with an exact version succeeds");
  });
});

describe("PackageManager name latitude (deliberately wider than PackageManagerPin)", () => {
  it.effect("accepts names outside the pin's four literals", () =>
    Effect.gen(function* () {
      for (const input of ["bun@1.2.20", "deno@2.5.1", "cargo@1.0.0"]) {
        const pm = yield* decode(input);
        const encoded3 = yield* encode(pm);
        assert.strictEqual(encoded3, input, input);
      }
    })
  );

  it.effect("still rejects names outside the lowercase grammar", () =>
    Effect.gen(function* () {
      for (const input of ["PNPM@1.0.0", "pnpm2@1.0.0", "@scope/pm@1.0.0", "@1.0.0"]) {
        const error = yield* Effect.flip(decode(input));
        assert.strictEqual(error._tag, "SchemaError", input);
      }
    })
  );
});

describe("PackageManager consolidation (Schema.check is erased from the type, so identity guards the sharing)", () => {
  it("integrity IS @beep/npm-spec's shared corepack schema, not a copy that agrees with it", () => {
    const optionWrappedIntegrity = PackageManager.fields.integrity.value;
    assert.strictEqual(
      optionWrappedIntegrity,
      CorepackIntegrityHash,
      "the corepack restriction must not be re-derived here — consume CorepackIntegrityHash; a copy compiles clean"
    );
    assert.notStrictEqual<unknown>(
      optionWrappedIntegrity,
      IntegrityHash,
      "the control: the unrestricted brand the shared schema narrows must not satisfy the identity check"
    );
  });

  it("version IS @beep/semver's shared pinnable schema, not a copy that agrees with it", () => {
    assert.strictEqual(
      PackageManager.fields.version,
      SemVer.PinnableVersionString,
      "the pinnable-version restriction must not be re-derived here — consume SemVer.PinnableVersionString"
    );
    assert.notStrictEqual(
      PackageManager.fields.version,
      SemVer.ExactVersionString,
      "the control: a plausible faithful re-derivation must not satisfy the identity check"
    );
    assert.notStrictEqual(
      PackageManager.fields.version,
      S.String,
      "the control: a plausible faithful re-derivation must not satisfy the identity check"
    );
  });

  it.effect(
    "accepts exactly what SemVer.parseResult accepts, minus build metadata (the + slot is the integrity's)",
    () =>
      Effect.gen(function* () {
        const unpaddedCorpus = [
          "1.2.3",
          "0.0.0",
          "10.33.0",
          "1.2.3-rc.1",
          "1.2.3-0rc",
          "1.2.3-alpha.0",
          "1.2.3-0.3.7",
          "01.2.3",
          "1.02.3",
          "1.2.03",
          "1.2.3-01",
          "1.2.3-a..b",
          "1.2.3-",
          "1.2",
          "1",
          "v1.2.3",
          "^1.2.3",
          "latest",
          "",
          "1.2.3+build",
        ];
        for (const version of unpaddedCorpus) {
          const parsed = SemVer.parseResult(version);
          const semverAccepts = Result.isSuccess(parsed) && parsed.success.build.length === 0;
          const decoded = yield* Effect.result(decode(`pnpm@${version}`));
          assert.strictEqual(
            Result.isSuccess(decoded),
            semverAccepts,
            `"${version}": the field and SemVer.parseResult must agree; a drifting hand-rolled parser fails here`
          );
        }
      })
  );
});
