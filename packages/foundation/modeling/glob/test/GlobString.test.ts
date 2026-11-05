import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GlobString } from "@beep/glob";
import { GlobString as GlobStringLeaf } from "@beep/glob/GlobString";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeGlobString = S.decodeUnknownEffect(GlobString);
const isGlobString = S.is(GlobString);
const GlobStringPayload = S.Struct({ glob: GlobString });
const decodeGlobStringPayload = S.decodeUnknownEffect(GlobStringPayload);
const decodeGlobStringArray = S.decodeUnknownEffect(S.Array(GlobString));

const failureMessage = Effect.fnUntraced(function* (input: unknown) {
  const exit = yield* Effect.exit(decodeGlobString(input));
  assert.isTrue(Exit.isFailure(exit));
  return Exit.isFailure(exit) ? String(exit.cause) : "";
});

describe("GlobString", () => {
  it.effect("accepts portable patterns, including unterminated classes and braces", () =>
    Effect.gen(function* () {
      for (const pattern of [
        "src/**/*.ts",
        "{src,test}/**/*.ts",
        "foo/bar",
        "foo/[bar",
        "foo/{bar",
        "!index.ts",
        "@(a|b)/[[:alpha:]]*",
        "../a",
        "/abs/**",
      ]) {
        const decodedGlobString = yield* decodeGlobString(pattern);
        assert.strictEqual(decodedGlobString, pattern);
      }
    })
  );

  it.effect("rejects empty input", () =>
    Effect.gen(function* () {
      const failureMessage1 = yield* failureMessage("");
      assert.include(failureMessage1, "Glob pattern must not be empty");
    })
  );

  it.effect("rejects backslash-separated patterns", () =>
    Effect.gen(function* () {
      const failureMessage2 = yield* failureMessage("src\\**\\*.ts");
      assert.include(failureMessage2, "Glob pattern must use forward slashes instead of backslashes");
      const failureMessage3 = yield* failureMessage("a\\");
      assert.include(failureMessage3, "Glob pattern must use forward slashes instead of backslashes");
    })
  );

  it.effect("rejects patterns longer than 64 KiB and accepts exactly 64 KiB", () =>
    Effect.gen(function* () {
      const atCap = Str.repeat(65_536)("a");
      const decodedGlobString4 = yield* decodeGlobString(atCap);
      assert.strictEqual(decodedGlobString4, atCap);
      const failureMessage5 = yield* failureMessage(Str.repeat(65_537)("a"));
      assert.include(failureMessage5, "Glob pattern must not exceed 65536 characters");
    })
  );

  it.effect("rejects patterns that trip the expansion or nesting caps at compile time", () =>
    Effect.gen(function* () {
      const message = "Glob pattern must compile within the expansion and nesting caps";
      // 2^17 = 131072 alternatives exceeds the 100000 expansion budget; 2^16 does not.
      const failureMessage6 = yield* failureMessage(Str.repeat(17)("{a,b}"));
      assert.include(failureMessage6, message);
      assert.isTrue(isGlobString(Str.repeat(16)("{a,b}")));
      const failureMessage7 = yield* failureMessage("{1..100001}");
      assert.include(failureMessage7, message);
      assert.isTrue(isGlobString("{1..10}"));
      const failureMessage8 = yield* failureMessage(`${Str.repeat(300)("{")}a${Str.repeat(300)(",b}")}`);
      assert.include(failureMessage8, message);
      const failureMessage9 = yield* failureMessage(`${Str.repeat(300)("+(")}a${Str.repeat(300)(")")}`);
      assert.include(failureMessage9, message);
    })
  );

  it("supports guard-style checks", () => {
    assert.isTrue(isGlobString("src/**/*.ts"));
    assert.isFalse(isGlobString("src\\**\\*.ts"));
    assert.isFalse(isGlobString(42));
  });

  it("make validates and throws on an invalid pattern", () => {
    assert.strictEqual(GlobString.make(".changeset/*.md"), ".changeset/*.md");
    assert.throws(() => GlobString.make("src\\*.ts"));
    assert.throws(() => GlobString.make(""));
  });

  it.effect("reports nested field failures at the glob key", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(decodeGlobStringPayload({ glob: "src\\**\\*.ts" }));
      exit.pipe(Exit.isFailure, assertTrue);
      assert.include(Exit.isFailure(exit) ? String(exit.cause) : "", `["glob"]`);
    })
  );

  it.effect("decodes every element of an array field", () =>
    Effect.gen(function* () {
      const patterns = ["packages/a/dist/**", "packages/a/.beep/**"];
      const decoded: ReadonlyArray<string> = yield* decodeGlobStringArray(patterns);
      assert.deepStrictEqual(decoded, patterns);
      const exit = yield* Effect.exit(decodeGlobStringArray(A.append(patterns, "")));
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect.prop(
    "derives valid glob strings from the schema arbitrary",
    [Arbitrary.schema(GlobString)],
    ([pattern]) =>
      Effect.gen(function* () {
        assert.isTrue(isGlobString(pattern));
        const decodedGlobString10 = yield* decodeGlobString(pattern);
        assert.strictEqual(decodedGlobString10, pattern);
      }),
    { arbitrary: fcRuns(25) }
  );

  it("exposes the same schema from the root barrel and the leaf module", () => {
    assert.strictEqual(GlobString, GlobStringLeaf);
  });
});
