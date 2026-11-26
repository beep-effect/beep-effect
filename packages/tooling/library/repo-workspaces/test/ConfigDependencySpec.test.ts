import { IntegrityHash, SriIntegrityHash } from "@beep/npm-spec/IntegrityHash";
import { ConfigDependencySpec, InvalidConfigDependencySpecError } from "@beep/repo-workspaces/ConfigDependencySpec";
import { lookupPnpmfiles } from "@beep/repo-workspaces/internal/configDependencyResolution";
import { SemVer } from "@beep/semver";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const SRI = "sha512-m35mtvgU4nbE8ZHd4EFqKu5jJeQY0gPUYHzKTno57JT/QeHzM9RRLNQsIcG0npsFYBxJfJ1tC/NH4zEWc2gdxQ==";
const SRI_WITH_PLUS = "sha512-6GbxZtliXuGHKFzJGFkqqNAbZzErb42XvCLdnr29KVR3OwvwU+D1MxNPpfzKOkde/TlM/KLsciuNqqmCSS/Yag==";

const reasonOf = (input: string) => {
  const parsed = ConfigDependencySpec.parseResult(input);
  return Result.isFailure(parsed) ? parsed.failure.reason : undefined;
};

describe("ConfigDependencySpec.parseResult over real SRI values from savvy-web/silk-update-action's pnpm-workspace.yaml", () => {
  it("parses the legacy inline SRI form", () => {
    const parsed = ConfigDependencySpec.parseResult(`0.11.1+${SRI}`);
    assertSuccess(parsed, Result.getOrThrow(parsed));
    if (Result.isSuccess(parsed)) {
      assert.strictEqual(parsed.success.version.toString(), "0.11.1");
      assertSome<string>(parsed.success.integrity, SRI);
      assert.isTrue(parsed.success.hasIntegrity);
      assert.strictEqual(parsed.success.bare, "0.11.1");
      assert.strictEqual(parsed.success.toString(), `0.11.1+${SRI}`);
    }
  });

  it("splits on the FIRST + when the SRI base64 itself contains +", () => {
    const parsed = ConfigDependencySpec.parseResult(`0.44.0+${SRI_WITH_PLUS}`);
    assertSuccess(parsed, Result.getOrThrow(parsed));
    if (Result.isSuccess(parsed)) {
      assert.strictEqual(parsed.success.bare, "0.44.0");
      assertSome<string>(parsed.success.integrity, SRI_WITH_PLUS);
    }
  });

  it("parses the bare form pnpm 11+ writes", () => {
    const parsed = ConfigDependencySpec.parseResult("0.11.1");
    assertSuccess(parsed, Result.getOrThrow(parsed));
    if (Result.isSuccess(parsed)) {
      assertNone(parsed.success.integrity);
      assert.isFalse(parsed.success.hasIntegrity);
      assert.strictEqual(parsed.success.bare, "0.11.1");
      assert.strictEqual(parsed.success.toString(), "0.11.1");
    }
  });

  it("accepts a prerelease version", () => {
    const parsed = ConfigDependencySpec.parseResult(`1.0.0-rc.1+${SRI}`);
    assertSuccess(parsed, Result.getOrThrow(parsed));
    if (Result.isSuccess(parsed)) assert.strictEqual(parsed.success.bare, "1.0.0-rc.1");
  });

  it("rejects a malformed version half with reason 'version'", () => {
    for (const input of ["", "latest", "^0.11.1", "0.11", "v0.11.1", " 0.11.1", "01.2.3", `^0.11.1+${SRI}`]) {
      assert.strictEqual(reasonOf(input), "version", input);
    }
  });

  it("rejects a malformed integrity half with reason 'integrity', even the corepack form IntegrityHash accepts", () => {
    const corepackIntegrityForm = "0.11.1+sha512.deadbeef";
    const semverBuildMetadata = "0.11.1+build.5";
    for (const input of [
      "0.11.1+",
      "0.11.1+garbage",
      corepackIntegrityForm,
      semverBuildMetadata,
      "0.11.1+sha512-not base64",
    ]) {
      assert.strictEqual(reasonOf(input), "integrity", input);
    }
  });

  it("carries the input and names the failing half in the message", () => {
    const parsed = ConfigDependencySpec.parseResult("0.11.1+garbage");
    assertFailure(parsed, parsed.pipe(Result.flip, Result.getOrThrow));
    if (Result.isFailure(parsed)) {
      assert.instanceOf(parsed.failure, InvalidConfigDependencySpecError);
      assert.strictEqual(parsed.failure.input, "0.11.1+garbage");
      assert.include(parsed.failure.message, "integrity");
    }
  });
});

describe("ConfigDependencySpec.parse", () => {
  it.effect("fails typed through the error channel", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(ConfigDependencySpec.parse("latest"));
      assert.strictEqual(error._tag, "InvalidConfigDependencySpecError");
      assert.strictEqual(error.reason, "version");
    })
  );

  it.effect("succeeds on a valid spec", () =>
    Effect.gen(function* () {
      const spec = yield* ConfigDependencySpec.parse(`0.11.1+${SRI}`);
      assert.strictEqual(spec.bare, "0.11.1");
    })
  );
});

describe("ConfigDependencySpec.FromString", () => {
  const decode = S.decodeUnknownEffect(ConfigDependencySpec.FromString);
  const encode = S.encodeUnknownEffect(ConfigDependencySpec.FromString);

  it.effect("round-trips encode(decode) byte-identically", () =>
    Effect.gen(function* () {
      for (const input of ["0.11.1", `0.11.1+${SRI}`, `0.44.0+${SRI_WITH_PLUS}`, "1.0.0-rc.1"]) {
        const decoded = yield* decode(input);
        const encoded = yield* encode(decoded);
        assert.strictEqual(encoded, input);
      }
    })
  );

  it.effect("reports a malformed spec as a SchemaError", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decode("0.11.1+garbage"));
      assert.strictEqual(error._tag, "SchemaError");
    })
  );
});

describe("ConfigDependencySpec construction", () => {
  it("rejects a version carrying build metadata, which the grammar cannot encode", () => {
    assert.throws(() => ConfigDependencySpec.make({ version: SemVer.of(1, 2, 3, [], ["build"]), integrity: O.none() }));
  });
});

// decision: config-dependency-integrity-identity-guard
describe("ConfigDependencySpec.integrity", () => {
  it("IS @effected/npm's SriIntegrityHash, not a copy that agrees with it", () => {
    assert.strictEqual(ConfigDependencySpec.fields.integrity.value, SriIntegrityHash);
    assert.notStrictEqual<unknown>(
      ConfigDependencySpec.fields.integrity.value,
      IntegrityHash,
      "the control: the unrestricted brand does not satisfy the identity"
    );
  });
});

describe("hook replay shares the split but keeps its lenient, verbatim reading: the strict model must not leak into it", () => {
  it.effect("resolves a spec whose integrity half the strict model rejects", () =>
    Effect.gen(function* () {
      assert.strictEqual(reasonOf("0.11.1+garbage"), "integrity");
      const resolved = yield* lookupPnpmfiles({ "cfg@0.11.1": "/p/pnpmfile.mjs" }, { cfg: "0.11.1+garbage" });
      assert.deepStrictEqual(
        A.map(resolved, (entry) => [entry.name, entry.version, entry.path]),
        [["cfg", "0.11.1", "/p/pnpmfile.mjs"]]
      );
    })
  );

  it.effect("resolves a non-semver version key the strict model rejects", () =>
    Effect.gen(function* () {
      assert.strictEqual(reasonOf("next"), "version");
      const resolved = yield* lookupPnpmfiles({ "cfg@next": "/p/pnpmfile.mjs" }, { cfg: `next+${SRI}` });
      assert.strictEqual(resolved[0]?.version, "next");
    })
  );
});
