import { fcRuns } from "@beep/fc-runs";
import { IdentityEncoding } from "@beep/identity/IdentityRegistry";
import { ReleaseVersion } from "@beep/identity/Term";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";

// D12: @beep/identity keeps a local version pattern and S.Literals literal domains,
// because it cannot depend on @beep/schema. This cross-check runs here, where the
// dependency edge schema -> identity is legal.

const runs = { arbitrary: fcRuns(200) };
const isRelease = S.is(ReleaseVersion);
const isSemantic = S.is(SemanticVersion);

const VersionLike = S.Union([
  SemanticVersion,
  S.TemplateLiteral([S.Int, ".", S.Int, ".", S.Int]),
  S.TemplateLiteral([S.Int, ".", S.Int, ".", S.Int, "-", S.String]),
  S.TemplateLiteral([S.Int, ".", S.Int]),
  S.String,
]);

describe("identity registry parity with @beep/schema", () => {
  it("accepts and refuses the same fixed versions as SemanticVersion", () => {
    for (const version of ["0.0.0", "1.0.0", "10.20.30", "01.0.0", "1.0", "1.0.0-beta", "1.0.0+sha", "", "v1.0.0"]) {
      assert.strictEqual(isRelease(version), isSemantic(version), version);
    }
  });

  it.prop(
    "ReleaseVersion and SemanticVersion agree on every version-like string",
    [VersionLike],
    ([candidate]) => {
      assert.strictEqual(isRelease(candidate), isSemantic(candidate));
    },
    runs
  );

  it("the S.Literals domains of identity equal a LiteralKit of the same members", () => {
    const Kit = LiteralKit(IdentityEncoding.literals);
    assert.deepStrictEqual(Kit.literals, IdentityEncoding.literals);
    for (const candidate of A.appendAll(IdentityEncoding.literals, ["identifier", "IRI", ""])) {
      assert.strictEqual(S.is(Kit)(candidate), S.is(IdentityEncoding)(candidate), candidate);
    }
  });
});
